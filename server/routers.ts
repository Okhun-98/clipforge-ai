import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getUserByOpenId, upsertUser } from "./db";
import { videosRouter } from "./routers/videos";
import { shortsRouter } from "./routers/shorts";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    // Local sign-in: create/find a user from a name + optional email, then set a
    // session cookie. No external OAuth provider required.
    signIn: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          email: z.string().email().max(320).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const openId =
          (input.email ?? "").trim().toLowerCase() || `local_${nanoid(12)}`;

        await upsertUser({
          openId,
          name: input.name.trim(),
          email: input.email ?? null,
          loginMethod: "local",
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(openId, {
          name: input.name.trim(),
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        const user = await getUserByOpenId(openId);
        if (!user) throw new Error("Failed to load signed-in user");
        return user;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  videos: videosRouter,
  shorts: shortsRouter,
});

export type AppRouter = typeof appRouter;
