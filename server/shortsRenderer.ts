// Renders a vertical 9:16 short clip from the source video with captions
// burned into the frame using ffmpeg drawtext. Captions are word-wrapped,
// styled with a dark box + outline, and rendered in a font that matches the
// spoken language of the video. Falls back to a plain cut if text rendering
// is unavailable.

import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";

export interface RenderCaption {
  start: number;
  end: number;
  text: string;
}

export interface RenderOptions {
  sourcePath: string; // absolute path of the uploaded video on disk
  outputPath: string; // absolute destination .mp4 path
  startTime: number; // seconds into the source video
  endTime: number; // seconds into the source video
  captions: RenderCaption[]; // timestamps are relative to the clip start
  language?: string | null; // ISO language code of the spoken text
}

const FONT_LANGUAGE_MAP: Record<string, string[]> = {
  latin: [
    "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
  ],
  cyrillic: ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"],
  zh: ["/System/Library/Fonts/STHeiti Medium.ttc", "/System/Library/Fonts/Hiragino Sans GB.ttc"],
  ja: ["/System/Library/Fonts/Hiragino Sans GB.ttc", "/System/Library/Fonts/STHeiti Medium.ttc"],
  ko: ["/System/Library/Fonts/AppleSDGothicNeo.ttc"],
  ar: ["/System/Library/Fonts/GeezaPro.ttc"],
  he: ["/System/Library/Fonts/GeezaPro.ttc"],
  fallback: ["/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"],
};

const LATIN_LANGS = new Set([
  "en","es","fr","de","pt","it","nl","pl","ro","tr","vi","id","ms","sv","no","da","fi","hu","cs","sk",
  "el","bg","sr","hr","lt","lv","et","sq","mk","sl","ga","is","mt","ca","eu","gl","af","sw","tl","cy",
]);

const CYRILLIC_LANGS = new Set(["ru", "uk", "be", "bg", "sr", "mk", "kk", "ky", "mn", "tg"]);

function languageBucket(language?: string | null): string {
  const l = (language ?? "en").toLowerCase().split(/[-_]/)[0];
  if (CYRILLIC_LANGS.has(l)) return "cyrillic";
  if (LATIN_LANGS.has(l)) return "latin";
  if (l === "zh" || l === "yue") return "zh";
  if (l === "ja") return "ja";
  if (l === "ko") return "ko";
  if (l === "ar" || l === "fa" || l === "ur") return "ar";
  if (l === "he" || l === "yi") return "he";
  return "fallback";
}

function findFont(language?: string | null): string | null {
  const list = FONT_LANGUAGE_MAP[languageBucket(language)] ?? FONT_LANGUAGE_MAP.fallback;
  for (const font of list) {
    if (existsSync(font)) return font;
  }
  return null;
}

function hasCJK(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
}

/** Escape text for use inside an ffmpeg drawtext filter argument. */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\u2019") // apostrophe -> right single quote (avoids quoting hell)
    .replace(/%/g, "\\u0025")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

/** Wrap text into lines, breaking at word boundaries (or by chars for CJK). */
function wrapText(text: string, maxChars: number): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (hasCJK(clean)) {
    const lines: string[] = [];
    for (let i = 0; i < clean.length; i += maxChars) lines.push(clean.slice(i, i + maxChars));
    return lines;
  }
  const words = clean.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    if (!cur) cur = word;
    else if ((cur + " " + word).length <= maxChars) cur += " " + word;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawtextFilter(caption: RenderCaption, font: string, language?: string | null): string {
  const cjk = hasCJK(caption.text);
  const fontSize = cjk ? 84 : 76;
  const usableWidth = 1080 - 180; // horizontal margins
  const avgCharWidth = cjk ? 1.0 : 0.55;
  const maxChars = Math.max(6, Math.floor(usableWidth / (fontSize * avgCharWidth)));

  const lines = wrapText(caption.text, maxChars);
  if (lines.length === 0) return "";

  const escapedLines = lines.map((line) => escapeDrawtext(line));
  const text = escapedLines.join("\\n");

  const lineHeight = Math.round(fontSize * 1.35);
  const bottomSafe = 320; // keep clear of phone gesture bar / UI
  const y = `h-${bottomSafe + (lines.length - 1) * lineHeight}`;
  const enable = `between(t\\,${caption.start.toFixed(2)}\\,${caption.end.toFixed(2)})`;

  // Make the frame fully transparent first (only the drawn text/box pixels
  // carry alpha) so inactive captions never cover the video.
  const drawOptions = [
    `fontfile=${font}`,
    `text='${text}'`,
    `fontcolor=white`,
    `fontsize=${fontSize}`,
    `line_spacing=10`,
    `borderw=6`,
    `bordercolor=black@0.95`,
    `shadowx=0`,
    `shadowy=4`,
    `shadowcolor=black@0.6`,
    `box=1`,
    `boxcolor=black@0.45`,
    `boxborderw=22`,
    `x=(w-text_w)/2`,
    `y=${y}`,
    `enable='${enable}'`,
  ].join(":");

  return `format=rgba,colorchannelmixer=aa=0,drawtext=${drawOptions}`;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegStatic) return reject(new Error("ffmpeg binary not found"));
    const child = execFile(ffmpegStatic, args, { maxBuffer: 16 * 1024 * 1024 });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-800)}`));
    });
  });
}

export async function renderShortClip(options: RenderOptions): Promise<void> {
  const { sourcePath, outputPath, startTime, endTime, captions, language } = options;
  if (!ffmpegStatic) throw new Error("ffmpeg binary not found");
  if (!existsSync(sourcePath)) throw new Error(`Source video missing: ${sourcePath}`);

  mkdirSync(path.dirname(outputPath), { recursive: true });

  const font = findFont(language);
  const duration = Math.max(0.5, endTime - startTime);

  // Base filter: scale to 1080x1920 (center crop) for vertical short.
  let vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";

  const visibleCaptions = captions.filter((c) => c.text?.trim() && c.end > c.start);
  const hasText = font !== null && visibleCaptions.length > 0;
  if (hasText) {
    const drawTexts = visibleCaptions.map((c) => drawtextFilter(c, font!, language)).filter(Boolean);
    // Branch 0 stays the opaque video background. Each caption branch is made
    // fully transparent first (only the drawn text/box pixels carry alpha), so
    // captions outside their time window never cover the active one.
    const n = drawTexts.length;
    if (n > 0) {
      vf += `,split=${n + 1}${drawTexts.map((_, i) => `[v${i + 1}]`).join("")}[v0]`;
      vf += `;[v0]null[bg]`;
      vf += drawTexts.map((f, i) => `;[v${i + 1}]${f}[t${i + 1}]`).join("");
      let prev = "bg";
      for (let i = 1; i <= n; i++) {
        const out = `v${i}`;
        vf += `;[${prev}][t${i}]overlay=0:0[${out}]`;
        prev = out;
      }
    }
  }

  const baseArgs = [
    "-y",
    "-ss", startTime.toFixed(3),
    "-t", duration.toFixed(3),
    "-i", sourcePath,
    "-vf", vf,
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath,
  ];

  try {
    await runFfmpeg(baseArgs);
  } catch (error) {
    // Retry without caption text if text rendering failed (e.g. no freetype)
    console.warn("[ShortsRenderer] Caption render failed, falling back to plain clip:", (error as Error).message);
    if (process.env.DEBUG_SHORTS) {
      console.log("[DEBUG] -vf:", vf);
      console.log("[DEBUG] args:", baseArgs.map((a) => (a.length > 300 ? a.slice(0, 300) + "…" : a)).join(" | "));
    }
    const plainArgs: string[] = [];
    for (let i = 0; i < baseArgs.length; i++) {
      if (baseArgs[i] === "-vf") {
        i += 1; // skip the -vf filter argument and its value
        continue;
      }
      plainArgs.push(baseArgs[i]);
    }
    await runFfmpeg(plainArgs);
  }
}
