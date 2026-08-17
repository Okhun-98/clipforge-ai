import "dotenv/config";
import express from "express";
import type { Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { STORAGE_DIR } from "../storage";
import { serveStatic } from "./vite";

/**
 * Build the shared Express application (middleware + tRPC + static client).
 * Local entry (`index.ts`) adds the Vite dev server on top and listens on a
 * port; the serverless entry (`api/index.ts`) exports this directly so Vercel
 * can serve it as a single lambda.
 */
export function createApp(): Express {
  const app = express();

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Local file storage (uploaded videos + generated shorts)
  app.use("/storage", express.static(STORAGE_DIR, { fallthrough: false, maxAge: "1h", immutable: true }));

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Production mode serves the built client from dist/public
  if (process.env.NODE_ENV !== "development") {
    serveStatic(app);
  }

  return app;
}
