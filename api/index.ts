// Vercel serverless entrypoint. Vercel compiles this file with @vercel/node and
// routes every request to it, so the whole Express app (API + client) runs in a
// single lambda. NOTE: the local transcription/rendering pipeline and the JSON
// datastore need a persistent filesystem, so this deployment is for the UI +
// API shell only.
import { createApp } from "../server/_core/app";

export default createApp();
