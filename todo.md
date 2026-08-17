# ClipForge AI — Project TODO

## Database & Backend
- [x] Add videos table (id, userId, title, status, storageKey, storageUrl, duration, size, mimeType, createdAt)
- [x] Add shorts table (id, videoId, userId, title, description, score, startTime, endTime, storageKey, storageUrl, status, captions JSON)
- [x] Add transcripts table (id, videoId, fullText, segments JSON, language, createdAt)
- [x] Run DB migrations via webdev_execute_sql
- [x] tRPC router: video.create (record creation)
- [x] tRPC router: video.list (user's videos with status)
- [x] tRPC router: video.get (single video with shorts and transcript)
- [x] tRPC router: video.delete
- [x] tRPC router: video.uploadChunk (chunked upload pipeline trigger)
- [x] tRPC router: video.confirmUpload (trigger pipeline)
- [x] tRPC router: video.status (polling endpoint)
- [x] tRPC router: shorts.list (by videoId)
- [x] tRPC router: shorts.get (single short with captions)
- [x] tRPC router: shorts.downloadUrl
- [x] Backend: chunked upload endpoint for large files
- [x] Backend: transcription pipeline (Whisper via voiceTranscription helper)
- [x] Backend: AI analysis agent (invokeLLM claude-sonnet-4-6 to score/select segments)
- [x] Backend: caption generation per short segment from Whisper segments
- [x] Backend: status update helpers (uploading → transcribing → analyzing → generating → ready)
- [x] Backend: polling via refetchInterval on VideoDetail page

## Frontend — Design System
- [x] Dark premium theme in index.css (deep charcoal bg, violet/purple accent, Inter + Space Grotesk fonts)
- [x] Global animations and transitions (framer-motion)
- [x] Reusable StatusBadge component (in Dashboard)
- [x] Reusable PipelineProgress component (in VideoDetail)
- [x] Reusable ScoreBadge component (in VideoDetail and ShortPreview)
- [x] forge-gradient, forge-gradient-text, forge-glow utility classes

## Frontend — Pages
- [x] Landing page (hero, features, how-it-works, CTA, footer)
- [x] Upload page with drag-and-drop, file validation, chunked upload, progress bar
- [x] Dashboard page: video list with status indicators, delete, empty state
- [x] Video detail page: pipeline progress, shorts list, transcript, auto-polling
- [x] Shorts preview page: vertical player, captions overlay, score meter, timing, tags, download

## Frontend — Routing
- [x] All routes registered in App.tsx
- [x] Auth-guard on dashboard, upload, and detail pages
- [x] NavBar with active route highlighting

## Testing
- [x] Vitest: video router unit tests (create, list, get, delete)
- [x] Vitest: shorts router unit tests (list)
- [x] Vitest: auth logout test (pre-existing)

## Bug Fixes
- [x] Audio extraction before Whisper transcription (videos need audio extracted to MP3 before sending to Whisper)
- [x] Custom Dockerfile with FFmpeg for production audio extraction
