import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getShortById, getShortsByVideoId, getVideoById } from "../db";

export const shortsRouter = router({
  // List shorts for a video
  list: protectedProcedure
    .input(z.object({ videoId: z.number() }))
    .query(async ({ ctx, input }) => {
      const video = await getVideoById(input.videoId);
      if (!video || video.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return getShortsByVideoId(input.videoId);
    }),

  // Get a single short
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const short = await getShortById(input.id);
      if (!short || short.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return short;
    }),

  // Get download URL for a short
  downloadUrl: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const short = await getShortById(input.id);
      if (!short || short.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (!short.storageUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Short not yet generated" });
      }
      return { url: short.storageUrl };
    }),
});

