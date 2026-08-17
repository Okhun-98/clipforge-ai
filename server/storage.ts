// Local-disk storage for ClipForge AI.
// Uploads are written under <project>/data/storage and served from /storage/*.
// No external S3 / presign service is required.

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.resolve(__dirname, "..", "data");
export const STORAGE_DIR = path.join(DATA_DIR, "storage");

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/** Absolute path on disk for a storage key (safe: no path traversal). */
export function resolveStoragePath(relKey: string): string {
  const key = normalizeKey(relKey);
  const abs = path.resolve(STORAGE_DIR, key);
  if (!abs.startsWith(path.resolve(STORAGE_DIR))) {
    throw new Error("Invalid storage key");
  }
  return abs;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const abs = resolveStoragePath(key);

  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data);

  return { key, url: `/storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/storage/${key}` };
}

/** Local files are served directly, so this is the same public URL. */
export async function storageGetSignedUrl(relKey: string): Promise<string> {
  return `/storage/${normalizeKey(relKey)}`;
}
