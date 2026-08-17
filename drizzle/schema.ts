import { float, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Videos ──────────────────────────────────────────────────────────────────
export const videos = mysqlTable("videos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", [
    "uploading",
    "transcribing",
    "analyzing",
    "generating",
    "ready",
    "error",
  ])
    .default("uploading")
    .notNull(),
  storageKey: varchar("storageKey", { length: 512 }),
  storageUrl: text("storageUrl"),
  duration: float("duration"), // seconds
  fileSize: bigint("fileSize", { mode: "number" }), // bytes
  mimeType: varchar("mimeType", { length: 64 }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;

// ─── Transcripts ──────────────────────────────────────────────────────────────
export const transcripts = mysqlTable("transcripts", {
  id: int("id").autoincrement().primaryKey(),
  videoId: int("videoId").notNull().unique(),
  fullText: text("fullText"),
  segments: json("segments"), // Whisper segments array
  language: varchar("language", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transcript = typeof transcripts.$inferSelect;
export type InsertTranscript = typeof transcripts.$inferInsert;

// ─── Shorts ───────────────────────────────────────────────────────────────────
export const shorts = mysqlTable("shorts", {
  id: int("id").autoincrement().primaryKey(),
  videoId: int("videoId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  hook: varchar("hook", { length: 500 }), // opening spoken line, the scroll-stopper
  score: float("score"), // 0–100 engagement score
  startTime: float("startTime").notNull(), // seconds
  endTime: float("endTime").notNull(), // seconds
  storageKey: varchar("storageKey", { length: 512 }),
  storageUrl: text("storageUrl"),
  status: mysqlEnum("status", ["pending", "generating", "ready", "error"])
    .default("pending")
    .notNull(),
  captions: json("captions"), // array of { start, end, text }
  tags: json("tags"), // string[]
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Short = typeof shorts.$inferSelect;
export type InsertShort = typeof shorts.$inferInsert;
