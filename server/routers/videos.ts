import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { ENV } from "../_core/env";
import { sanitizeFilename } from "../utils";
import {
  createVideo,
  deleteShortsByVideoId,
  deleteVideo,
  getShortsByVideoId,
  getTranscriptByVideoId,
  getVideoById,
  getVideosByUserId,
  updateVideoStatus,
} from "../db";
import { runFullPipeline } from "../pipeline";

// In-memory chunk buffer: videoId -> sorted chunks
const chunkBuffers = new Map<number, Map<number, Buffer>>();

export const videosRouter = router({
  // List all videos for the authenticated user
  list: protectedProcedure.query(async ({ ctx }) => {
    return getVideosByUserId(ctx.user.id);
  }),

  // Get a single video with its shorts and transcript
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const video = await getVideoById(input.id);
      if (!video || video.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Video not found" });
      }
      const shorts = await getShortsByVideoId(input.id);
      const transcript = await getTranscriptByVideoId(input.id);
      return { video, shorts, transcript };
    }),

  // Create a video record and get a storage upload URL
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        mimeType: z.string(),
        fileSize: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const videoId = await createVideo({
        userId: ctx.user.id,
        title: input.title,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        status: "uploading",
      });
      return { videoId };
    }),

  // Confirm upload complete — store the key and trigger pipeline
  confirmUpload: protectedProcedure
    .input(
      z.object({
        videoId: z.number(),
        storageKey: z.string(),
        storageUrl: z.string(),
        duration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const video = await getVideoById(input.videoId);
      if (!video || video.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await updateVideoStatus(input.videoId, "transcribing", {
        storageKey: input.storageKey,
        storageUrl: input.storageUrl,
        duration: input.duration,
      });
      // Run pipeline asynchronously (fire-and-forget)
      runFullPipeline(input.videoId).catch((err) =>
        console.error("[Pipeline] Unhandled error:", err)
      );
      return { success: true };
    }),

  // Upload small chunks from the client (base64 encoded)
  uploadChunk: protectedProcedure
    .input(
      z.object({
        videoId: z.number(),
        fileName: z.string(),
        mimeType: z.string(),
        chunkData: z.string(), // base64
        chunkIndex: z.number(),
        totalChunks: z.number(),
        isLastChunk: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const video = await getVideoById(input.videoId);
      if (!video || video.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const buffer = Buffer.from(input.chunkData, "base64");

      // Store chunk in memory buffer
      if (!chunkBuffers.has(input.videoId)) {
        chunkBuffers.set(input.videoId, new Map());
      }
      chunkBuffers.get(input.videoId)!.set(input.chunkIndex, buffer);

      if (input.isLastChunk) {
        // Reassemble all chunks in order
        const chunks = chunkBuffers.get(input.videoId)!;
        const assembled: Buffer[] = [];
        for (let i = 0; i < input.totalChunks; i++) {
          const chunk = chunks.get(i);
          if (!chunk) throw new TRPCError({ code: "BAD_REQUEST", message: `Missing chunk ${i}` });
          assembled.push(chunk);
        }
        const fullBuffer = Buffer.concat(assembled);
        chunkBuffers.delete(input.videoId);

        const safeFileName = sanitizeFilename(input.fileName);
        const key = `videos/${ctx.user.id}/${input.videoId}/${safeFileName}`;
        const { key: storedKey, url } = await storagePut(key, fullBuffer, input.mimeType);

        await updateVideoStatus(input.videoId, "transcribing", {
          storageKey: storedKey,
          storageUrl: url,
        });
        // Fire pipeline asynchronously
        runFullPipeline(input.videoId).catch((err) =>
          console.error("[Pipeline] Unhandled error:", err)
        );
        return { done: true, storageUrl: url };
      }

      return { done: false, received: input.chunkIndex + 1 };
    }),

  // Poll status for real-time updates
  status: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const video = await getVideoById(input.id);
      if (!video || video.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const shorts = video.status === "ready" ? await getShortsByVideoId(input.id) : [];
      return {
        status: video.status,
        errorMessage: video.errorMessage,
        shortsCount: shorts.length,
      };
    }),

  // Delete a video and its shorts
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const video = await getVideoById(input.id);
      if (!video || video.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await deleteShortsByVideoId(input.id);
      await deleteVideo(input.id);
      return { success: true };
    }),
});
