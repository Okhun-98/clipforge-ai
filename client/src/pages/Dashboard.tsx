import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Upload, Film, Clock, CheckCircle2, AlertCircle, Loader2, Zap, Trash2, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { Video } from "../../../drizzle/schema";

const STATUS_CONFIG: Record<Video["status"], { label: string; color: string; icon: React.ElementType; pulse?: boolean }> = {
  uploading:    { label: "Uploading",    color: "oklch(0.78 0.16 75)",   icon: Upload,       pulse: true },
  transcribing: { label: "Transcribing", color: "oklch(0.65 0.22 285)",  icon: Loader2,      pulse: true },
  analyzing:    { label: "Analyzing",    color: "oklch(0.68 0.2 320)",   icon: Loader2,      pulse: true },
  generating:   { label: "Generating",   color: "oklch(0.72 0.18 165)",  icon: Loader2,      pulse: true },
  ready:        { label: "Ready",        color: "oklch(0.72 0.18 145)",  icon: CheckCircle2 },
  error:        { label: "Error",        color: "oklch(0.62 0.22 25)",   icon: AlertCircle  },
};

function StatusBadge({ status }: { status: Video["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
      <Icon className={`w-3 h-3 ${cfg.pulse ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function Dashboard() {
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const { data: videos, isLoading } = trpc.videos.list.useQuery(undefined, { enabled: isAuthenticated });
  const deleteVideo = trpc.videos.delete.useMutation({
    onSuccess: () => {
      utils.videos.list.invalidate();
      toast.success("Video deleted");
    },
    onError: () => toast.error("Failed to delete video"),
  });

  if (loading || isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Sign in to view your dashboard.</p>
        <Button onClick={() => navigate("/login")} className="forge-gradient text-white border-0">Sign in</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="container pt-28 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="font-display text-3xl font-bold mb-1">My Videos</h1>
            <p className="text-muted-foreground">
              {videos?.length ?? 0} video{videos?.length !== 1 ? "s" : ""} processed
            </p>
          </div>
          <Link href="/upload">
            <Button className="gap-2 forge-gradient text-white border-0 hover:opacity-90 forge-glow">
              <Upload className="w-4 h-4" />
              Upload Video
            </Button>
          </Link>
        </div>

        {/* Empty state */}
        {(!videos || videos.length === 0) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-20 h-20 rounded-2xl forge-gradient flex items-center justify-center mb-6 forge-glow">
              <Film className="w-9 h-9 text-white" />
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">No videos yet</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Upload your first long-form video and let AI generate YouTube Shorts for you.
            </p>
            <Link href="/upload">
              <Button className="gap-2 forge-gradient text-white border-0 hover:opacity-90 forge-glow">
                <Upload className="w-4 h-4" />
                Upload Your First Video
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Video grid */}
        {videos && videos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {videos.map((video, i) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                className="forge-card group hover:border-primary/40 transition-all duration-300"
              >
                {/* Thumbnail placeholder */}
                <div className="aspect-video bg-muted/20 rounded-t-xl flex items-center justify-center relative overflow-hidden">
                  <Film className="w-10 h-10 text-muted-foreground/40" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <StatusBadge status={video.status} />
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-display font-semibold truncate mb-1">{video.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(video.createdAt)}
                    </span>
                    <span>{formatBytes(video.fileSize)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/video/${video.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 border-border/60 hover:bg-accent">
                        {video.status === "ready" ? (
                          <><Zap className="w-3.5 h-3.5 text-primary" /> View Shorts</>
                        ) : (
                          <><ChevronRight className="w-3.5 h-3.5" /> View Status</>
                        )}
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => deleteVideo.mutate({ id: video.id })}
                      disabled={deleteVideo.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
