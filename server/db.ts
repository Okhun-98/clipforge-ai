// Lightweight JSON-file datastore for ClipForge AI.
// Replaces the external MySQL dependency with a simple, atomic JSON database so
// the whole app runs locally. Every mutation is persisted synchronously.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { InsertShort, InsertTranscript, InsertUser, InsertVideo, Short, Transcript, User, Video } from "../drizzle/schema";
import { DATA_DIR } from "./storage";
import { ENV } from "./_core/env";

const DB_FILE = path.join(DATA_DIR, "db.json");

type DbShape = {
  users: User[];
  videos: Video[];
  transcripts: Transcript[];
  shorts: Short[];
  seq: { users: number; videos: number; transcripts: number; shorts: number };
};

const emptyDb = (): DbShape => ({
  users: [],
  videos: [],
  transcripts: [],
  shorts: [],
  seq: { users: 0, videos: 0, transcripts: 0, shorts: 0 },
});

let cache: DbShape | null = null;

function load(): DbShape {
  if (cache) return cache;
  let data: DbShape = emptyDb();
  try {
    if (existsSync(DB_FILE)) {
      data = { ...emptyDb(), ...JSON.parse(readFileSync(DB_FILE, "utf-8")) };
    }
  } catch (error) {
    console.error("[Database] Failed to load db.json, starting fresh:", error);
    data = emptyDb();
  }
  cache = data;
  return data;
}

function persist(): void {
  if (!cache) return;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(cache, null, 2));
    renameSync(tmp, DB_FILE);
  } catch (error) {
    console.error("[Database] Failed to persist db.json:", error);
  }
}

function now(): Date {
  return new Date();
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = load();
  const existing = db.users.find((u) => u.openId === user.openId);

  const role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  const stamp = now();

  if (existing) {
    Object.assign(existing, {
      ...(user.name !== undefined ? { name: user.name ?? null } : {}),
      ...(user.email !== undefined ? { email: user.email ?? null } : {}),
      ...(user.loginMethod !== undefined ? { loginMethod: user.loginMethod ?? null } : {}),
      role,
      lastSignedIn: user.lastSignedIn ?? existing.lastSignedIn ?? stamp,
      updatedAt: stamp,
    });
  } else {
    db.seq.users += 1;
    db.users.push({
      id: db.seq.users,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role,
      createdAt: stamp,
      updatedAt: stamp,
      lastSignedIn: user.lastSignedIn ?? stamp,
    });
  }
  persist();
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  return load().users.find((u) => u.openId === openId);
}

export async function getUserById(id: number): Promise<User | undefined> {
  return load().users.find((u) => u.id === id);
}

// ─── Videos ───────────────────────────────────────────────────────────────────

export async function createVideo(data: InsertVideo): Promise<number> {
  const db = load();
  db.seq.videos += 1;
  const stamp = now();
  db.videos.push({
    id: db.seq.videos,
    userId: data.userId,
    title: data.title,
    status: data.status ?? "uploading",
    storageKey: data.storageKey ?? null,
    storageUrl: data.storageUrl ?? null,
    duration: data.duration ?? null,
    fileSize: data.fileSize ?? null,
    mimeType: data.mimeType ?? null,
    errorMessage: data.errorMessage ?? null,
    createdAt: stamp,
    updatedAt: stamp,
  });
  persist();
  return db.seq.videos;
}

export async function getVideoById(id: number): Promise<Video | undefined> {
  return load().videos.find((v) => v.id === id);
}

export async function getVideosByUserId(userId: number): Promise<Video[]> {
  return load()
    .videos.filter((v) => v.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateVideoStatus(
  id: number,
  status: Video["status"],
  extra?: Partial<Pick<Video, "storageKey" | "storageUrl" | "duration" | "fileSize" | "mimeType" | "errorMessage">>,
): Promise<void> {
  const video = load().videos.find((v) => v.id === id);
  if (!video) return;
  Object.assign(video, { status, ...extra, updatedAt: now() });
  persist();
}

export async function deleteVideo(id: number): Promise<void> {
  const db = load();
  db.videos = db.videos.filter((v) => v.id !== id);
  db.transcripts = db.transcripts.filter((t) => t.videoId !== id);
  persist();
}

// ─── Transcripts ──────────────────────────────────────────────────────────────

export async function upsertTranscript(data: InsertTranscript): Promise<void> {
  const db = load();
  const existing = db.transcripts.find((t) => t.videoId === data.videoId);
  if (existing) {
    Object.assign(existing, {
      fullText: data.fullText,
      segments: data.segments,
      language: data.language,
    });
  } else {
    db.seq.transcripts += 1;
    db.transcripts.push({
      id: db.seq.transcripts,
      videoId: data.videoId,
      fullText: data.fullText ?? null,
      segments: data.segments ?? null,
      language: data.language ?? null,
      createdAt: now(),
    });
  }
  persist();
}

export async function getTranscriptByVideoId(videoId: number): Promise<Transcript | undefined> {
  return load().transcripts.find((t) => t.videoId === videoId);
}

// ─── Shorts ───────────────────────────────────────────────────────────────────

export async function createShort(data: InsertShort): Promise<number> {
  const db = load();
  db.seq.shorts += 1;
  const stamp = now();
  db.shorts.push({
    id: db.seq.shorts,
    videoId: data.videoId,
    userId: data.userId,
    title: data.title ?? null,
    description: data.description ?? null,
    hook: data.hook ?? null,
    score: data.score ?? null,
    startTime: data.startTime,
    endTime: data.endTime,
    storageKey: data.storageKey ?? null,
    storageUrl: data.storageUrl ?? null,
    status: data.status ?? "pending",
    captions: data.captions ?? null,
    tags: data.tags ?? null,
    createdAt: stamp,
    updatedAt: stamp,
  });
  persist();
  return db.seq.shorts;
}

export async function getShortsByVideoId(videoId: number): Promise<Short[]> {
  return load()
    .shorts.filter((s) => s.videoId === videoId)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export async function getShortById(id: number): Promise<Short | undefined> {
  return load().shorts.find((s) => s.id === id);
}

export async function updateShortStatus(
  id: number,
  status: Short["status"],
  extra?: Partial<Pick<Short, "storageKey" | "storageUrl">>,
): Promise<void> {
  const short = load().shorts.find((s) => s.id === id);
  if (!short) return;
  Object.assign(short, { status, ...extra, updatedAt: now() });
  persist();
}

export async function deleteShortsByVideoId(videoId: number): Promise<void> {
  const db = load();
  db.shorts = db.shorts.filter((s) => s.videoId !== videoId);
  persist();
}
