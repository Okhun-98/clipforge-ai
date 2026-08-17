import { invokeLLM } from "./_core/llm";
import { transcribeLocalVideo } from "./localTranscription";
import { renderShortClip } from "./shortsRenderer";
import { resolveStoragePath, storagePut } from "./storage";
import { readFile } from "node:fs/promises";
import {
  createShort,
  deleteShortsByVideoId,
  getShortsByVideoId,
  getTranscriptByVideoId,
  getVideoById,
  updateShortStatus,
  updateVideoStatus,
  upsertTranscript,
} from "./db";

export interface WhisperSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
}

export interface ShortCandidate {
  title: string;
  description: string;
  hook: string;
  score: number;
  startTime: number;
  endTime: number;
  tags: string[];
  reason: string;
}

export interface Caption {
  start: number;
  end: number;
  text: string;
}

const AI_MODEL = process.env.AI_MODEL ?? "deepseek-chat";

// ─── Step 1: Transcription (local, free) ──────────────────────────────────────

export async function runTranscription(videoId: number): Promise<void> {
  const video = await getVideoById(videoId);
  if (!video || !video.storageKey) throw new Error("Video not found or not uploaded");

  await updateVideoStatus(videoId, "transcribing");

  try {
    const result = await transcribeLocalVideo(video.storageKey);

    await updateVideoStatus(videoId, "transcribing", {
      duration: result.duration > 0 ? result.duration : video.duration ?? null,
    });

    const segments: WhisperSegment[] = result.segments.map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    }));

    await upsertTranscript({
      videoId,
      fullText: result.text,
      segments: segments as unknown as Record<string, unknown>[],
      language: result.language ?? "unknown",
    });
  } catch (err) {
    await updateVideoStatus(videoId, "error", {
      errorMessage: `Transcription failed: ${(err as Error).message}`,
    });
    throw err;
  }
}

// ─── Step 2: AI Analysis — Select best segments ───────────────────────────────

export async function runAnalysis(videoId: number): Promise<void> {
  const video = await getVideoById(videoId);
  if (!video) throw new Error("Video not found");

  await updateVideoStatus(videoId, "analyzing");

  try {
    const transcript = await getTranscriptByVideoId(videoId);
    if (!transcript?.fullText) throw new Error("No transcript available");

    const segments = (transcript.segments as unknown as WhisperSegment[]) ?? [];
    const duration = video.duration ?? 0;
    const language = transcript.language ?? null;

    let videoContext: VideoContext | null = null;
    let candidates: ShortCandidate[];

    // Compact very long transcripts so the agent stays within the LLM context.
    const llmSegments = compactSegmentsForLLM(segments, 500);
    const llmFullText =
      transcript.fullText.length > 16000 ? transcript.fullText.slice(0, 16000) + "…" : transcript.fullText;

    try {
      // Phase 1: the agent listens to the whole video and builds an
      // understanding of its purpose before choosing any clips.
      videoContext = await understandVideo({
        title: video.title,
        fullText: llmFullText,
        duration,
        language,
      });

      // Phase 2: pick clips that serve the video's purpose.
      candidates = await pickCandidatesWithLLM({
        title: video.title,
        fullText: llmFullText,
        segments: llmSegments,
        duration,
        language,
        context: videoContext,
      });
    } catch (llmErr) {
      console.warn(`[Pipeline] LLM analysis unavailable (${(llmErr as Error).message}), using heuristic fallback`);
      candidates = pickCandidatesHeuristically(segments, duration);
    }

    // Keep only clips that actually contain continuous speech (no long silent
    // gaps), snap boundaries to natural speech breaks, drop clips that mostly
    // overlap a stronger one, and enforce the viral length window.
    candidates = candidates
      .filter((c) => speechCoverage(segments, c.startTime, c.endTime) >= 0.45)
      .map((c) => snapCandidateToSegments(c, segments))
      .map((c) => clampCandidateLength(c, segments, 15, 60));
    candidates = dedupeOverlapping(candidates);

    // Viral post-check: a short must OPEN with a hook — i.e. speech begins
    // within the first ~1.5s. If the chosen start is lazy (trailing silence or
    // a mid-sentence gap), back it up to the start of the segment that is
    // actually spoken. Derive a hook line from the first caption if the LLM
    // didn't return one.
    candidates = candidates.map((c) => {
      const hooked = ensureHookWindow(c, segments);
      return {
        ...hooked,
        hook:
          (hooked.hook?.trim() ?? "") ||
          (generateCaptionsFromSegments(segments, hooked.startTime, hooked.startTime + 3)[0]?.text ?? "").slice(0, 90),
      };
    });

    // Clear old shorts for this video before inserting new ones
    await deleteShortsByVideoId(videoId);

    for (const c of candidates) {
      const segmentCaptions = generateCaptionsFromSegments(segments, c.startTime, c.endTime);

      await createShort({
        videoId,
        userId: video.userId,
        title: c.title,
        description: c.description,
        hook: c.hook || null,
        score: Math.min(100, Math.max(0, c.score)),
        startTime: c.startTime,
        endTime: c.endTime,
        tags: c.tags,
        captions: segmentCaptions as unknown as Record<string, unknown>[],
        status: "generating",
      });
    }
  } catch (err) {
    await updateVideoStatus(videoId, "error", {
      errorMessage: `Analysis failed: ${(err as Error).message}`,
    });
    throw err;
  }
}

export interface VideoContext {
  summary: string;
  purpose: string;
  coreMessage: string;
  themes: string[];
  narrative: string;
  emotionalPeaks: Array<{ time: number; note: string }>;
}

function languageNoteFor(language: string): string {
  return language !== "unknown"
    ? `The video language is **${language}**. Write ALL titles, descriptions, tags, and reasons in ${language}. Use proper grammar and natural phrasing in that language.`
    : "Write titles, descriptions, tags, and reasons in the same language as the transcript.";
}

/**
 * Phase 1 of the analysis agent: read the WHOLE transcript and build an
 * understanding of the video — its purpose, core message, emotional peaks and
 * structure — before any clips are chosen. This keeps the shorts on-message
 * instead of feeling like random, mixed cuts, and gives Phase 2 the moments
 * where the video is most emotionally charged (where viral clips live).
 */
async function understandVideo(opts: {
  title: string;
  fullText: string;
  duration: number;
  language: string | null;
}): Promise<VideoContext> {
  const language = opts.language ?? "unknown";
  const systemPrompt = `You are a video comprehension agent. Your job is to LISTEN to the whole video by reading its transcript, then build a clear mental model of what this video is about.
Extract:
- summary: a 1-2 sentence neutral summary of what the video covers
- purpose: the video's main purpose (e.g. educate, persuade, entertain, demonstrate, sell, explain a process)
- coreMessage: the single most important message the creator wants the viewer to remember
- themes: 3-6 key topics covered
- narrative: how the video is structured (opening → main sections → conclusion)
- emotionalPeaks: up to 10 moments where the video is most emotionally charged. These are moments with surprise, revelation, a strong claim, humor, anger, excitement, a punchline, a big result, or the most important conclusion. For each, give an approximate timestamp (seconds) and a short note on why it hits.

Respond ONLY with a single valid JSON object:
{"summary":"...","purpose":"...","coreMessage":"...","themes":["..."],"narrative":"...","emotionalPeaks":[{"time":123.4,"note":"..."}]}`;

  const userPrompt = `Video title: "${opts.title}"
Video language: ${language}
Total duration: ${opts.duration.toFixed(1)} seconds

Full transcript:
${opts.fullText}

Respond ONLY with the JSON object.`;

  const response = await invokeLLM({
    model: AI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = parseJsonResponse<Partial<VideoContext>>(response);
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    purpose: typeof parsed.purpose === "string" ? parsed.purpose : "",
    coreMessage: typeof parsed.coreMessage === "string" ? parsed.coreMessage : "",
    themes: Array.isArray(parsed.themes) ? parsed.themes.map(String) : [],
    narrative: typeof parsed.narrative === "string" ? parsed.narrative : "",
    emotionalPeaks: Array.isArray(parsed.emotionalPeaks)
      ? parsed.emotionalPeaks
          .filter((p) => p && typeof p === "object" && typeof p.time === "number")
          .map((p) => ({
            time: (p as { time: number }).time,
            note: typeof (p as { note?: unknown }).note === "string" ? ((p as { note: string }).note) : "",
          }))
          .slice(0, 10)
      : [],
  };
}

/**
 * Phase 2 of the analysis agent: using the video context from Phase 1, choose
 * the most important clips that support the video's purpose.
 */
async function pickCandidatesWithLLM(opts: {
  title: string;
  fullText: string;
  segments: WhisperSegment[];
  duration: number;
  language: string | null;
  context: VideoContext | null;
}): Promise<ShortCandidate[]> {
  const language = opts.language || "unknown";
  const languageNote = languageNoteFor(language);

  const contextBlock = opts.context
    ? `UNDERSTANDING OF THE WHOLE VIDEO (built by the comprehension agent):
- Summary: ${opts.context.summary || "n/a"}
- Purpose: ${opts.context.purpose || "n/a"}
- Core message: ${opts.context.coreMessage || "n/a"}
- Themes: ${opts.context.themes.join(", ") || "n/a"}
- Structure: ${opts.context.narrative || "n/a"}
- Emotional peaks (approx. timestamps where the video hits hardest):
${opts.context.emotionalPeaks.map((p) => `  • ${p.time.toFixed(1)}s — ${p.note || "high-emotion moment"}`).join("\n") || "  • n/a"}

`
    : "";

  const systemPrompt = `You are a viral Shorts strategist and expert video editor for YouTube.
Your task is to choose the segments MOST LIKELY TO GO VIRAL — clips that stop people mid-scroll, hold attention, and deliver the video's meaning in a single self-contained short (15-60 seconds, sweet spot 20-40s).

A candidate that charts must satisfy ALL of these:

1. HOOK-FIRST (non-negotiable): The clip must START exactly at its strongest spoken line — a surprising claim, a bold opinion, a provocative question, a secret/reveal, a shocking stat, or an emotionally charged moment (check the emotional peaks list). The first 2-3 seconds are a pattern interrupt; if the opening is flat, the viewer swipes away. Set startTime so the hook line begins the clip.
2. MEANINGFUL: The short must be a complete mini-story — setup, tension, payoff — that a stranger understands WITHOUT the rest of the video. It must deliver the video's core message. Never pick a random mid-thought sentence that doesn't stand alone.
3. EMOTIONAL: Prefer clips built around the video's emotional peaks (reference the timestamps you're given). Emotion drives shares.
4. RETENTION: Prefer segments that escalate or build to a punchline/conclusion. Avoid long flat stretches of background narrative.
5. CLEAN & LOOPABLE: Start and end at natural sentence/pause boundaries. A clip that ends on a punchline or resolves the opening question loops better, which earns replays.
6. ON-MESSAGE: The clip serves the video's purpose and core message — no random tangents.

Scoring (0-100, "score"): weight 60% on hook strength and opening retention, 25% on emotional/payoff impact, 15% on how completely it stands alone.

Return up to 5 candidates. For each provide:
- title: a scroll-stopping title in the video's language (max 60 chars) — curiosity, benefit, or bold claim
- description: YouTube-optimized description in the video's language (max 150 chars)
- hook: the EXACT opening spoken line of the clip (as it appears in the transcript, max 90 chars) — this is what viewers hear in the first seconds
- score: 0-100 viral potential
- startTime/endTime: seconds, aligned to the segment boundaries from the transcript
- tags: 3-5 relevant tags in the video's language
- reason: why this will go viral — name its hook, emotional peak, and why it stands alone

Respond ONLY with a single valid JSON object of this shape:
{"candidates":[{"title":"...","description":"...","hook":"...","score":85,"startTime":12.5,"endTime":45.0,"tags":["a","b","c"],"reason":"..."}]}

${languageNote}`;

  const userPrompt = `${contextBlock}Video title: "${opts.title}"
Total duration: ${opts.duration.toFixed(1)} seconds
Video language: ${language}

Full transcript:
${opts.fullText}

Timestamped segments:
${opts.segments.map((s) => `[${s.start.toFixed(1)}s – ${s.end.toFixed(1)}s]: ${s.text}`).join("\n")}

Choose up to 5 segments that best match the viral criteria above. Start each clip at the exact moment its strongest (hook) line begins. For "hook", copy the exact opening line verbatim from the transcript.

Respond ONLY with the JSON object.`;

  const response = await invokeLLM({
    model: AI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = parseJsonResponse<{ candidates?: ShortCandidate[] }>(response);
  const candidates = parsed.candidates ?? [];
  if (!Array.isArray(candidates)) throw new Error("Response missing 'candidates' array");

  return candidates
    .filter((c) => typeof c.startTime === "number" && typeof c.endTime === "number")
    .filter((c) => c.endTime - c.startTime >= 5)
    .map((c) => ({
      ...c,
      title: typeof c.title === "string" ? c.title.slice(0, 60) : "Viral Short",
      description: typeof c.description === "string" ? c.description.slice(0, 160) : "",
      hook: typeof c.hook === "string" && c.hook.trim().length > 0 ? c.hook.trim().slice(0, 90) : "",
      score: typeof c.score === "number" ? c.score : 60,
      tags: Array.isArray(c.tags) ? c.tags.map(String).slice(0, 5) : [],
      reason: typeof c.reason === "string" ? c.reason : "",
    }));
}

function parseJsonResponse<T>(response: { choices?: Array<{ message?: { content?: unknown } }> }): T {
  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from AI");

  const rawContent = typeof content === "string" ? content : JSON.stringify(content);

  try {
    return JSON.parse(rawContent) as T;
  } catch {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Failed to extract JSON from response: ${rawContent.substring(0, 120)}`);
    return JSON.parse(jsonMatch[0]) as T;
  }
}

/** Fraction of the clip's duration that contains transcribed speech. */
function speechCoverage(segments: WhisperSegment[], start: number, end: number): number {
  let covered = 0;
  for (const s of segments) {
    const lo = Math.max(s.start, start);
    const hi = Math.min(s.end, end);
    if (hi > lo) covered += hi - lo;
  }
  return covered / Math.max(1, end - start);
}

/** Drop clips that overlap a stronger one by more than 50% of the shorter clip. */
function dedupeOverlapping(candidates: ShortCandidate[]): ShortCandidate[] {
  const sorted = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const kept: ShortCandidate[] = [];
  for (const c of sorted) {
    const overlaps = kept.some((k) => {
      const lo = Math.max(k.startTime, c.startTime);
      const hi = Math.min(k.endTime, c.endTime);
      if (hi <= lo) return false;
      const inter = hi - lo;
      const shorter = Math.min(k.endTime - k.startTime, c.endTime - c.startTime);
      return inter / shorter > 0.5;
    });
    if (!overlaps) kept.push(c);
  }
  return kept.sort((a, b) => a.startTime - b.startTime).slice(0, 5);
}

/** Sample evenly so the agent sees a bounded number of segments. */
function compactSegmentsForLLM(segments: WhisperSegment[], max = 500): WhisperSegment[] {
  if (segments.length <= max) return segments;
  const step = segments.length / max;
  const out: WhisperSegment[] = [];
  for (let i = 0; i < segments.length; i += step) {
    out.push(segments[Math.floor(i)]);
  }
  const last = segments[segments.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** Rule-based fallback when no AI API key is configured. */
function pickCandidatesHeuristically(segments: WhisperSegment[], duration: number): ShortCandidate[] {
  const usable = segments
    .filter((s) => s.end > s.start && s.text?.trim().length > 0)
    .sort((a, b) => a.start - b.start);

  const candidates: ShortCandidate[] = [];
  const windowLen = 35;
  const step = Math.max(10, (duration > 0 ? Math.min(duration, 240) : 120) / 5);
  let cursor = 0;

  while (candidates.length < 5 && cursor < Math.max(duration, usable.length * 5)) {
    const inWindow = usable.filter((s) => s.start >= cursor && s.start < cursor + windowLen);
    if (inWindow.length > 0) {
      const text = inWindow.map((s) => s.text).join(" ").trim();
      if (text.length > 60) {
        const wordCount = text.split(/\s+/).length;
        const score = Math.min(95, Math.round(55 + wordCount * 2));
        const endTime = Math.min(duration || cursor + windowLen, inWindow[inWindow.length - 1]?.end ?? cursor + windowLen);
        candidates.push({
          title: text.slice(0, 60) + (text.length > 60 ? "…" : ""),
          description: text.slice(0, 150),
          hook: (inWindow[0]?.text ?? text.slice(0, 90)).trim().slice(0, 90),
          score,
          startTime: cursor,
          endTime,
          tags: ["shorts", "highlight"],
          reason: "Selected by automatic fallback (no AI key configured).",
        });
        cursor = endTime + 5; // avoid overlapping clips
        continue;
      }
    }
    cursor += step;
  }

  if (candidates.length === 0 && usable.length > 0) {
    candidates.push({
      title: "Video Highlight",
      description: "Automatically selected highlight clip.",
      hook: (usable[0].text ?? "").trim().slice(0, 90),
      score: 60,
      startTime: usable[0].start,
      endTime: Math.min(usable[0].end, usable[0].start + 60),
      tags: ["shorts"],
      reason: "Fallback selection.",
    });
  }

  return candidates;
}

/** Snap a candidate's start/end to the nearest whisper segment boundaries. */
function snapCandidateToSegments(c: ShortCandidate, segments: WhisperSegment[]): ShortCandidate {
  const sorted = segments
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
  if (sorted.length === 0) return c;

  const firstStart = sorted[0].start;
  const lastEnd = sorted[sorted.length - 1].end;

  let bestStart = firstStart;
  let bestD = Infinity;
  for (const s of sorted) {
    const d = Math.abs(s.start - c.startTime);
    if (d < bestD) {
      bestD = d;
      bestStart = s.start;
    }
  }

  let bestEnd = lastEnd;
  bestD = Infinity;
  for (const s of sorted) {
    const d = Math.abs(s.end - c.endTime);
    if (d < bestD) {
      bestD = d;
      bestEnd = s.end;
    }
  }

  if (bestEnd - bestStart < 8) bestEnd = Math.min(lastEnd, bestStart + 15);
  if (bestEnd - bestStart > 60) bestEnd = bestStart + 60;

  return {
    ...c,
    startTime: Math.max(0, Math.min(bestStart, lastEnd - 5)),
    endTime: Math.min(Math.max(bestEnd, bestStart + 8), lastEnd),
  };
}

/** Clamp a candidate to a target length window, keeping the hook (start) fixed. */
function clampCandidateLength(c: ShortCandidate, segments: WhisperSegment[], minLen: number, maxLen: number): ShortCandidate {
  const len = c.endTime - c.startTime;
  let end = c.endTime;
  if (len > maxLen) {
    end = c.startTime + maxLen;
    const boundaries = segments
      .map((s) => s.end)
      .filter((b) => b >= c.startTime + minLen && b <= end)
      .sort((a, b) => a - b);
    if (boundaries.length > 0) end = boundaries[boundaries.length - 1];
  } else if (len < minLen) {
    const candidates = segments
      .filter((s) => s.end >= c.startTime)
      .map((s) => s.end)
      .sort((a, b) => a - b);
    const target = c.startTime + minLen;
    end = candidates.find((b) => b >= target) ?? candidates[candidates.length - 1] ?? c.endTime;
  }
  return { ...c, endTime: Math.max(end, c.startTime + minLen) };
}

/**
 * Guarantee the clip actually opens with speech: if there is a spoken segment
 * that starts just before the candidate start, back the start up so the hook
 * line is not cut off. Only the first ~3 seconds are inspected.
 */
function ensureHookWindow(c: ShortCandidate, segments: WhisperSegment[]): ShortCandidate {
  const hookWindow = 3;
  const coverage = speechCoverage(segments, c.startTime, c.startTime + Math.min(hookWindow, c.endTime - c.startTime));
  if (coverage >= 0.3) return c;

  const sorted = segments
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const preceding = sorted
    .filter((s) => s.start <= c.startTime && s.end > c.startTime)
    .sort((a, b) => b.start - a.start);

  if (preceding.length > 0) {
    const newStart = preceding[0].start;
    if (newStart < c.startTime && c.endTime - newStart >= 15) {
      return { ...c, startTime: newStart };
    }
  }

  const firstInside = sorted.find((s) => s.end > c.startTime);
  if (firstInside && firstInside.start > c.startTime) {
    const newStart = firstInside.start;
    if (c.endTime - newStart >= 15) {
      return { ...c, startTime: newStart };
    }
  }

  return c;
}

// ─── Step 3: Render actual short clips with captions ─────────────────────────

export async function runRendering(videoId: number): Promise<void> {
  const video = await getVideoById(videoId);
  if (!video || !video.storageKey) throw new Error("Video not found");

  await updateVideoStatus(videoId, "generating");

  const sourcePath = resolveStoragePath(video.storageKey);
  const shorts = await getShortsByVideoId(videoId);
  const transcript = await getTranscriptByVideoId(videoId);
  const language = transcript?.language ?? null;

  for (const short of shorts) {
    try {
      const captions = ((short.captions as unknown as Caption[]) ?? []).map((c) => ({
        start: c.start,
        end: c.end,
        text: c.text,
      }));

      const outKey = `shorts/${video.userId}/${videoId}/short_${short.id}.mp4`;
      const outPath = resolveStoragePath(outKey);

      await renderShortClip({
        sourcePath,
        outputPath: outPath,
        startTime: short.startTime,
        endTime: short.endTime,
        captions,
        language,
      });

      const { key, url } = await storagePut(outKey, await readFile(outPath), "video/mp4");
      await updateShortStatus(short.id, "ready", { storageKey: key, storageUrl: url });

      // Remove the intermediate rendered file (the storage copy is authoritative)
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(outPath);
      } catch {
        // ignore cleanup errors
      }
    } catch (err) {
      console.error(`[Pipeline] Failed to render short ${short.id}:`, err);
      // Keep the short ready (with captions) even if clip rendering failed.
      await updateShortStatus(short.id, "ready");
    }
  }
}

// ─── Caption extraction from Whisper segments ────────────────────────────────

function generateCaptionsFromSegments(
  segments: WhisperSegment[],
  startTime: number,
  endTime: number,
): Caption[] {
  const relevant = segments.filter((s) => s.end > startTime && s.start < endTime);

  return relevant.map((s) => ({
    start: Math.max(0, s.start - startTime),
    end: Math.min(endTime - startTime, s.end - startTime),
    text: s.text.trim(),
  }));
}

// ─── Full pipeline orchestrator ───────────────────────────────────────────────

export async function runFullPipeline(videoId: number): Promise<void> {
  try {
    await runTranscription(videoId);
    await runAnalysis(videoId);
    await runRendering(videoId);
    await updateVideoStatus(videoId, "ready");
  } catch (err) {
    console.error(`[Pipeline] Error for video ${videoId}:`, err);
    // Status already set to error inside each step
  }
}
