import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import { ArrowLeft, Download, Star, Clock, Tag, FileText, Loader2, AlertCircle, Play, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useCallback } from "react";
import type { Short } from "../../../drizzle/schema";

interface Caption { start: number; end: number; text: string; }

function ScoreMeter({ score }: { score: number }) {
  const color = score >= 80 ? "oklch(0.72 0.18 145)" : score >= 60 ? "oklch(0.78 0.16 75)" : "oklch(0.62 0.22 25)";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1], delay: 0.3 }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>{score.toFixed(0)}/100</span>
    </div>
  );
}

/** Find the active caption for a given playback time (relative to clip start) */
function getActiveCaption(captions: Caption[], currentTime: number): Caption | null {
  // Look for an exact overlap first
  const exact = captions.find((c) => currentTime >= c.start && currentTime <= c.end);
  if (exact) return exact;
  // If between captions, return the nearest upcoming one (within 0.5s)
  const upcoming = captions.find((c) => c.start > currentTime && c.start - currentTime <= 0.5);
  return upcoming ?? null;
}

export default function ShortPreview() {
  const params = useParams<{ id: string }>();
  const shortId = parseInt(params.id ?? "0");
  const { isAuthenticated } = useAuth();

  const { data: short, isLoading } = trpc.shorts.get.useQuery(
    { id: shortId },
    { enabled: isAuthenticated && !!shortId }
  );

  // All hooks must be called unconditionally — derive captions from short early
  const captions = (short?.captions as Caption[] | null) ?? [];
  const tags = (short?.tags as string[] | null) ?? [];

  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeCaption, setActiveCaption] = useState<Caption | null>(null);

  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const t = vid.currentTime;
    setActiveCaption(getActiveCaption(captions, t));
  }, [captions]);

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!short) return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">Short not found.</p>
        <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
      </div>
    </div>
  );

  const duration = (short.endTime - short.startTime).toFixed(1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="container pt-28 pb-16 max-w-5xl mx-auto">
        <Link href={`/video/${short.videoId}`}>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground mb-6 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Back to Video
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
          {/* Left: vertical preview */}
          <div>
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="rounded-2xl overflow-hidden border border-border/60 bg-card"
              style={{ aspectRatio: "9/16", position: "relative" }}
            >
              {short.storageUrl ? (
                <video
                  ref={videoRef}
                  src={short.storageUrl}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  onSeeked={handleTimeUpdate}
                  className="w-full h-full object-cover"
                  style={{ background: "#000" }}
                />
              ) : (
                <div className="w-full h-full bg-muted/20 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Play className="w-7 h-7 text-primary" fill="currentColor" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center px-4">
                    Video preview will appear here once the Short is generated
                  </p>
                </div>
              )}
              {/* Live synced caption overlay */}
              <div className="absolute bottom-6 left-0 right-0 flex justify-center px-4 pointer-events-none">
                <AnimatePresence mode="wait">
                  {activeCaption ? (
                    <motion.div
                      key={activeCaption.start}
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="bg-black/80 backdrop-blur-md rounded-xl px-4 py-2 text-white text-sm font-semibold text-center max-w-[92%] shadow-lg"
                      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)", letterSpacing: "0.01em" }}
                    >
                      {activeCaption.text}
                    </motion.div>
                  ) : captions.length > 0 && !short.storageUrl ? (
                    <motion.div
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 text-white/70 text-xs text-center max-w-[92%]"
                    >
                      {captions[0]?.text}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Download */}
            {short.storageUrl && (
              <a href={short.storageUrl} download className="block mt-4">
                <Button className="w-full gap-2 forge-gradient text-white border-0 hover:opacity-90 forge-glow">
                  <Download className="w-4 h-4" />
                  Download Short
                </Button>
              </a>
            )}
          </div>

          {/* Right: metadata */}
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <h1 className="font-display text-2xl font-bold mb-2">{short.title}</h1>
              <p className="text-muted-foreground leading-relaxed">{short.description}</p>
              {(short as { hook?: string | null }).hook?.trim() && (
                <div className="flex items-start gap-2 mt-3 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                  <Zap className="w-4 h-4 shrink-0 mt-0.5 text-primary" fill="currentColor" />
                  <p className="text-sm font-medium text-foreground/90 leading-snug">
                    Hook: "{(short as { hook?: string | null }).hook?.trim()}"
                  </p>
                </div>
              )}
            </motion.div>

            {/* Score */}
            {short.score != null && (
              <div className="forge-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-primary" />
                  <span className="font-display font-semibold text-sm">Engagement Score</span>
                </div>
                <ScoreMeter score={short.score} />
              </div>
            )}

            {/* Timing */}
            <div className="forge-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-display font-semibold text-sm">Clip Timing</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { label: "Start", value: `${short.startTime.toFixed(1)}s` },
                  { label: "End",   value: `${short.endTime.toFixed(1)}s` },
                  { label: "Duration", value: `${duration}s` },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/20 rounded-lg p-3">
                    <div className="text-lg font-display font-bold">{item.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="forge-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-primary" />
                  <span className="font-display font-semibold text-sm">Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 rounded-full text-sm bg-accent text-muted-foreground border border-border/60">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Captions */}
            {captions.length > 0 && (
              <div className="forge-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-display font-semibold text-sm">Captions ({captions.length})</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {captions.map((cap, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums pt-0.5 w-16">
                        {cap.start.toFixed(1)}s
                      </span>
                      <span className="text-foreground/80 leading-relaxed">{cap.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

