// Local transcription using ffmpeg (audio extraction) + whisper.cpp.
// No external transcription API is required — everything runs on this machine.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegStatic from "ffmpeg-static";
import { STORAGE_DIR } from "./storage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BIN_DIR = path.resolve(__dirname, "..", "data", "bin");
export const MODELS_DIR = path.resolve(__dirname, "..", "data", "models");

const WHISPER_BIN =
  process.env.WHISPER_BIN ?? path.join(BIN_DIR, process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli");

// Prefer the higher-accuracy "small" model, fall back to "base" if it isn't downloaded.
function resolveWhisperModel(): string {
  const fromEnv = process.env.WHISPER_MODEL;
  if (fromEnv) return fromEnv;
  const small = path.join(MODELS_DIR, "ggml-small.bin");
  if (existsSync(small)) return small;
  return path.join(MODELS_DIR, "ggml-base.bin");
}

const WHISPER_MODEL = resolveWhisperModel();

export interface LocalSegment {
  start: number;
  end: number;
  text: string;
}

export interface LocalTranscriptionResult {
  text: string;
  language: string | null;
  duration: number;
  segments: LocalSegment[];
}

function run(command: string, args: string[]): void {
  execFileSync(command, args, { stdio: "pipe", timeout: 30 * 60 * 1000 });
}

/** Parse "Duration: HH:MM:SS.xx" from ffmpeg -i stderr output. */
export function getVideoDuration(videoPath: string): number {
  let stderr = "";
  try {
    execFileSync(ffmpegStatic!, ["-i", videoPath], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? "";
  }
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseFloat(match[3]);
}

/**
 * Transcribe a locally-stored video file.
 * @param storageKey storage key of the uploaded video (must exist under data/storage)
 */
export async function transcribeLocalVideo(storageKey: string): Promise<LocalTranscriptionResult> {
  if (!ffmpegStatic) throw new Error("ffmpeg-static binary not found — run npm install ffmpeg-static");
  if (!existsSync(WHISPER_BIN)) {
    throw new Error(
      `whisper binary not found at ${WHISPER_BIN}. Run npm run setup:whisper or place the whisper-cli binary in data/bin`,
    );
  }
  if (!existsSync(WHISPER_MODEL)) {
    throw new Error(`whisper model not found at ${WHISPER_MODEL}. Download ggml-base.bin into data/models`);
  }

  const videoPath = path.join(STORAGE_DIR, storageKey.replace(/^\/+/, ""));
  if (!existsSync(videoPath)) throw new Error(`Video file missing on disk: ${storageKey}`);

  const workDir = path.join(STORAGE_DIR, ".work");
  mkdirSync(workDir, { recursive: true });

  const safeName = storageKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-40) || "video";
  const wavPath = path.join(workDir, `${safeName}.wav`);
  const outPrefix = path.join(workDir, `${safeName}_whisper`);

  const duration = getVideoDuration(videoPath);

  // 1. Extract 16kHz mono WAV audio (whisper.cpp native input format)
  run(ffmpegStatic, ["-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", wavPath]);

  // 2. Run whisper.cpp with automatic language detection and JSON output.
  //    -ml forces short segments (better captions), -sow splits on word
  //    boundaries instead of mid-word.
  run(WHISPER_BIN, [
    "-m", WHISPER_MODEL,
    "-f", wavPath,
    "-l", "auto",
    "-ml", "42",
    "-sow",
    "--output-json",
    "-of", outPrefix,
  ]);

  const jsonPath = `${outPrefix}.json`;
  if (!existsSync(jsonPath)) throw new Error("Whisper did not produce output JSON");

  const parsed = JSON.parse(readFileSync(jsonPath, "utf-8")) as {
    result?: { language?: string } | null;
    transcription?: Array<{
      text?: string;
      offsets?: { from?: number; to?: number };
    }>;
  };

  const entries = parsed.transcription ?? [];
  const segments: LocalSegment[] = entries
    .map((s) => ({
      start: (s.offsets?.from ?? 0) / 1000,
      end: (s.offsets?.to ?? 0) / 1000,
      text: (s.text ?? "").trim(),
    }))
    .filter((s) => s.text.length > 0 && s.end >= s.start);

  const text = segments.map((s) => s.text).join(" ").trim();
  const language = parsed.result?.language ?? null;

  return { text, language, duration, segments };
}
