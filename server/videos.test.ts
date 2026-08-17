import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB helpers
vi.mock("./db", () => ({
  createVideo: vi.fn().mockResolvedValue(42),
  getVideoById: vi.fn().mockResolvedValue({
    id: 42,
    userId: 1,
    title: "Test Video",
    status: "uploading",
    storageKey: null,
    storageUrl: null,
    duration: null,
    fileSize: 1024,
    mimeType: "video/mp4",
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getVideosByUserId: vi.fn().mockResolvedValue([]),
  updateVideoStatus: vi.fn().mockResolvedValue(undefined),
  deleteVideo: vi.fn().mockResolvedValue(undefined),
  deleteShortsByVideoId: vi.fn().mockResolvedValue(undefined),
  getShortsByVideoId: vi.fn().mockResolvedValue([]),
  getTranscriptByVideoId: vi.fn().mockResolvedValue(null),
  upsertTranscript: vi.fn().mockResolvedValue(undefined),
  createShort: vi.fn().mockResolvedValue(1),
  getShortById: vi.fn().mockResolvedValue(null),
  updateShortStatus: vi.fn().mockResolvedValue(undefined),
}));

// Mock pipeline
vi.mock("./pipeline", () => ({
  runFullPipeline: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "videos/1/42/test.mp4", url: "/manus-storage/test.mp4" }),
}));

function createUserContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("videos.create", () => {
  it("creates a video record and returns videoId", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.videos.create({
      title: "My Test Video",
      mimeType: "video/mp4",
      fileSize: 10485760,
    });
    expect(result).toHaveProperty("videoId");
    expect(typeof result.videoId).toBe("number");
  });
});

describe("videos.list", () => {
  it("returns an array for authenticated user", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.videos.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("videos.get", () => {
  it("returns video with shorts and transcript", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.videos.get({ id: 42 });
    expect(result).toHaveProperty("video");
    expect(result).toHaveProperty("shorts");
    expect(result).toHaveProperty("transcript");
    expect(result.video.id).toBe(42);
  });
});

describe("videos.delete", () => {
  it("deletes video and returns success", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.videos.delete({ id: 42 });
    expect(result).toEqual({ success: true });
  });
});

describe("shorts.list", () => {
  it("returns shorts array for a video", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.shorts.list({ videoId: 42 });
    expect(Array.isArray(result)).toBe(true);
  });
});
