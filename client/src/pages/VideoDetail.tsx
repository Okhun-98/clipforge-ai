import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import {
  Loader2, CheckCircle2, AlertCircle, ArrowLeft, Play,
  Zap, Clock, Star, Download, ChevronRight, Brain, Mic, Scissors
} from "lucide-react";
import { motion } from "framer-motion";
import type { Short, Video } from "../../../drizzle/schema";

const PIPELINE_STAGES: { key: Video["status"]; label: string; icon: React.ElementType }[] = [
  { key: "uploading",    label: "Uploading",    icon: Loader2 },
  { key: "transcribing", label: "Transcribing", icon: Mic },
  { key: "analyzing",    label: "Analyzing",    icon: Brain },
  { key: "generating",   label: "Generating",   icon: Scissors },
  { key: "ready",        label: "Ready",        icon: CheckCircle2 },
];

const STAGE_ORDER = ["uploading", "transcribing", "analyzing", "generating", "ready"];

function PipelineProgress({ status }: { status: Video["status"] }) {
  const currentIdx = STAGE_ORDER.indexOf(status);
  return (
    <div className="forge-card p-6 mb-8">
      <h2 className="font-display font-semibold mb-5">Processing Pipeline</h2>
      <div className="flex items-center gap-0">
        {PIPELINE_STAGES.map((stage, i) => {
          const isDone = currentIdx > i;
          const isActive = currentIdx === i && status !== "ready" && status !== "error";
          const Icon = stage.icon;
          return (
            <div key={stage.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500
                  ${isDone ? "border-primary bg-primary/20" : isActive ? "border-primary bg-primary/10 forge-glow" : "border-border/60 bg-card"}`}>
                  <Icon className={`w-4 h-4 ${isDone ? "text-primary" : isActive ? "text-primary animate-spin" : "text-muted-foreground"}`} />
                </div>
                <span className={`text-xs font-medium ${isDone || isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {stage.label}
                </span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div className={`h-px flex-1 mb-6 transition-all duration-500 ${isDone ? "bg-primary" : "bg-border/60"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const cls = score >= 80 ? "score-badge-high" : score >= 60 ? "score-badge-mid" : "score-badge-low";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      <Star className="w-3 h-3" fill="currentColor" />
      {score.toFixed(0)}
    </span>
  );
}

function ShortCard({ short }: { short: Short }) {
  const duration = (short.endTime - short.startTime).toFixed(0);
  const captions = (short.captions as Array<{ text: string }> | null) ?? [];
  const preview = captions.slice(0, 2).map((c) => c.text).join(" ");
  const hook = (short as { hook?: string | null }).hook?.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="forge-card hover:border-primary/40 transition-all duration-300 group overflow-hidden"
    >
      {/* Vertical preview */}
      <div className="flex gap-4 p-5">
        <div className="shrink-0 w-[72px] rounded-xl overflow-hidden border border-border/60 bg-muted/20 flex items-center justify-center"
          style={{ aspectRatio: "9/16" }}>
          <Play className="w-6 h-6 text-muted-foreground/50" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-display font-semibold text-sm leading-tight">{short.title}</h3>
            <ScoreBadge score={short.score} />
          </div>
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{short.description}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{duration}s</span>
            <span>{short.startTime.toFixed(1)}s – {short.endTime.toFixed(1)}s</span>
          </div>
          {hook ? (
            <div className="flex items-start gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1.5 mb-3">
              <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" fill="currentColor" />
              <p className="text-xs font-medium text-foreground/90 leading-snug line-clamp-2">"{hook}"</p>
            </div>
          ) : (
            preview && (
              <p className="text-xs text-muted-foreground/70 italic line-clamp-1">"{preview}"</p>
            )
          )}
          {/* Tags */}
          {Array.isArray(short.tags) && short.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(short.tags as string[]).slice(0, 4).map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-accent text-muted-foreground border border-border/60">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-4">
            <Link href={`/short/${short.id}`} className="flex-1">
              <Button size="sm" className="w-full gap-1.5 forge-gradient text-white border-0 hover:opacity-90 text-xs h-8">
                <Play className="w-3 h-3" fill="white" /> Preview Short
              </Button>
            </Link>
            {short.storageUrl && (
              <a href={short.storageUrl} download>
                <Button size="sm" variant="outline" className="gap-1.5 border-border/60 hover:bg-accent text-xs h-8">
                  <Download className="w-3 h-3" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function VideoDetail() {
  const params = useParams<{ id: string }>();
  const videoId = parseInt(params.id ?? "0");
  const { isAuthenticated } = useAuth();

  const { data, isLoading, refetch } = trpc.videos.get.useQuery(
    { id: videoId },
    { enabled: isAuthenticated && !!videoId, refetchInterval: (q) => {
      const status = q.state.data?.video?.status;
      return status && !["ready", "error"].includes(status) ? 3000 : false;
    }}
  );

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const { video, shorts, transcript } = data ?? {};

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="container pt-28 pb-16 max-w-4xl mx-auto">
        {/* Back */}
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground mb-6 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
        </Link>

        {!video ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <AlertCircle className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">Video not found.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-8">
              <div>
                <h1 className="font-display text-2xl font-bold mb-1">{video.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {new Date(video.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              {video.status === "error" && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4" />
                  {video.errorMessage ?? "Processing failed"}
                </div>
              )}
            </div>

            {/* Pipeline */}
            {video.status !== "error" && <PipelineProgress status={video.status} />}

            {/* Shorts */}
            {video.status === "ready" && shorts && shorts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-xl font-bold flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Generated Shorts
                    <span className="text-sm font-normal text-muted-foreground ml-1">({shorts.length})</span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shorts.map((short) => <ShortCard key={short.id} short={short} />)}
                </div>
              </div>
            )}

            {/* Transcript */}
            {transcript?.fullText && (
              <div className="mt-8">
                <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary" /> Transcript
                  {transcript.language && transcript.language !== "unknown" && (
                    <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 capitalize">
                      🌐 {(() => {
                        try {
                          return new Intl.DisplayNames(["en"], { type: "language" }).of(transcript.language) ?? transcript.language;
                        } catch {
                          return transcript.language;
                        }
                      })()}
                    </span>
                  )}
                </h2>
                <div className="forge-card p-5">
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-6">
                    {transcript.fullText}
                  </p>
                </div>
              </div>
            )}

            {/* Still processing */}
            {!["ready", "error"].includes(video.status) && (
              <div className="forge-card p-8 text-center mt-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                <h3 className="font-display font-semibold mb-2">Processing your video…</h3>
                <p className="text-sm text-muted-foreground">
                  This page refreshes automatically. Come back in a few minutes.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
