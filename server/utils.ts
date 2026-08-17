/**
 * Sanitize filename to ASCII-only characters safe for S3 storage keys
 * Removes/replaces non-ASCII, special chars, and whitespace
 */
  export function sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^\x20-\x7E]/g, "") // Remove non-ASCII
      .replace(/[<>:"/\\|?*]/g, "-") // Replace forbidden chars
      .replace(/\s+/g, "_") // Replace whitespace with underscore
      .replace(/-+/g, "-") // Collapse multiple dashes
      .replace(/^-+|-+$/g, "") // Trim leading/trailing dashes
      .slice(0, 200); // Limit length
  }

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { storagePut } from "./storage";
import { storageGetSignedUrl } from "./storage";

/**
 * Extract audio from a video file and upload to storage
 * Returns a signed URL that Whisper API can access
 */
  export async function extractAudioFromVideo(videoUrl: string, videoId: number, userId: number): Promise<string> {
    // Download video to temp file
    const tempDir = "/tmp";
    const videoFile = path.join(tempDir, `video_${videoId}.mp4`);
    const audioFile = path.join(tempDir, `audio_${videoId}.mp3`);

    try {
    // Extract storage key from /manus-storage/{key} URL
    let storageKey = videoUrl;
    if (videoUrl.startsWith("/manus-storage/")) {
      storageKey = videoUrl.replace("/manus-storage/", "");
    }

    // Get a signed URL that allows direct S3 download
    const fetchUrl = await storageGetSignedUrl(storageKey);

    // Download video from storage URL
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
    const buffer = await response.arrayBuffer();

    // Check size before writing (Whisper has 16MB limit for audio)
    if (buffer.byteLength > 2 * 1024 * 1024 * 1024) {
      throw new Error(`Video file too large: ${(buffer.byteLength / (1024 * 1024 * 1024)).toFixed(2)}GB (max 2GB)`);
    }

    fs.writeFileSync(videoFile, Buffer.from(buffer));

    // Extract audio using FFmpeg
    // -i input -q:a 5 output: extract audio at quality 5 (lower = better, but larger)
    // For long videos, compress audio to fit Whisper's 16MB limit
    execSync(`ffmpeg -i "${videoFile}" -q:a 9 -y "${audioFile}"`, {
      stdio: "pipe",
      timeout: 300000, // 5 minutes
    });

    // Check extracted audio size (Whisper limit is 16MB)
    const audioSize = fs.statSync(audioFile).size;
    if (audioSize > 16 * 1024 * 1024) {
      throw new Error(`Extracted audio too large: ${(audioSize / (1024 * 1024)).toFixed(1)}MB (Whisper limit: 16MB). Try a shorter video.`);
    }

    // Upload extracted audio to storage
    const audioBuffer = fs.readFileSync(audioFile);
    const audioKey = `audio/${userId}/${videoId}/extracted.mp3`;
    const { key } = await storagePut(audioKey, audioBuffer, "audio/mpeg");

    // Get a signed URL that Whisper API can access
    const signedUrl = await storageGetSignedUrl(key);

    return signedUrl;
  } finally {
    // Cleanup temp files
    try { fs.unlinkSync(videoFile); } catch (_) {}
    try { fs.unlinkSync(audioFile); } catch (_) {}
  }
}
