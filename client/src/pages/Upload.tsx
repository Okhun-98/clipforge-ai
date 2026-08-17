import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Upload as UploadIcon, Film, X, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/mov", "video/mpeg"];
const MAX_SIZE_GB = 2;
const MAX_SIZE_BYTES = MAX_SIZE_GB * 1024 * 1024 * 1024;
const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

export default function Upload() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [videoId, setVideoId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createVideo = trpc.videos.create.useMutation();
  const uploadChunk = trpc.videos.uploadChunk.useMutation();

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(mp4|mov|mpeg)$/i)) {
      return "Only MP4 and MOV files are supported.";
    }
    if (f.size > MAX_SIZE_BYTES) {
      return `File exceeds the ${MAX_SIZE_GB}GB limit.`;
    }
    return null;
  };

  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) { toast.error(err); return; }
    setFile(f);
    setUploadState("idle");
    setProgress(0);
    setErrorMsg("");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploadState("uploading");
    setProgress(0);
    setErrorMsg("");

    try {
      // Create video record
      const { videoId: vid } = await createVideo.mutateAsync({
        title: file.name.replace(/\.[^/.]+$/, ""),
        mimeType: file.type || "video/mp4",
        fileSize: file.size,
      });
      setVideoId(vid);

      // Upload in chunks
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const arrayBuffer = await chunk.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let j = 0; j < bytes.byteLength; j++) binary += String.fromCharCode(bytes[j]!);
        const base64 = btoa(binary);

        await uploadChunk.mutateAsync({
          videoId: vid,
          fileName: file.name,
          mimeType: file.type || "video/mp4",
          chunkData: base64,
          chunkIndex: i,
          totalChunks,
          isLastChunk: i === totalChunks - 1,
        });

        setProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      setUploadState("processing");
      toast.success("Upload complete! AI is now processing your video.");
      setTimeout(() => navigate(`/video/${vid}`), 1500);
    } catch (err) {
      const msg = (err as Error).message ?? "Upload failed";
      setErrorMsg(msg);
      setUploadState("error");
      toast.error(msg);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Sign in to upload videos.</p>
        <Button onClick={() => navigate("/login")} className="forge-gradient text-white border-0">Sign in</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="container pt-28 pb-16 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        >
          <h1 className="font-display text-3xl font-bold mb-2">Upload Video</h1>
          <p className="text-muted-foreground mb-10">
            Upload an MP4 or MOV file and our AI will generate YouTube Shorts automatically.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
              ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/60 hover:border-primary/50 hover:bg-accent/30"}
              ${file ? "cursor-default" : ""}
            `}
            style={{ minHeight: 240 }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,.mov,.mpeg,video/mp4,video/quicktime"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center p-12 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl forge-gradient flex items-center justify-center mb-5 forge-glow">
                    <UploadIcon className="w-7 h-7 text-white" />
                  </div>
                  <p className="font-display font-semibold text-lg mb-1">Drop your video here</p>
                  <p className="text-muted-foreground text-sm mb-4">or click to browse files</p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="px-2.5 py-1 rounded-full border border-border/60 bg-card">MP4</span>
                    <span className="px-2.5 py-1 rounded-full border border-border/60 bg-card">MOV</span>
                    <span className="px-2.5 py-1 rounded-full border border-border/60 bg-card">Up to {MAX_SIZE_GB}GB</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="file"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Film className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{formatBytes(file.size)}</p>
                    </div>
                    {uploadState === "idle" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Progress */}
                  {uploadState === "uploading" && (
                    <div className="mt-5 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Uploading…</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}

                  {uploadState === "processing" && (
                    <div className="mt-5 flex items-center gap-3 text-sm text-primary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecting to your video…
                    </div>
                  )}

                  {uploadState === "done" && (
                    <div className="mt-5 flex items-center gap-3 text-sm text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Upload complete!
                    </div>
                  )}

                  {uploadState === "error" && (
                    <div className="mt-5 flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      {errorMsg}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Upload button */}
          {file && uploadState === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <Button
                size="lg"
                className="w-full forge-gradient text-white border-0 hover:opacity-90 h-12 text-base font-semibold forge-glow"
                onClick={handleUpload}
              >
                <UploadIcon className="w-5 h-5 mr-2" />
                Start Processing
              </Button>
            </motion.div>
          )}

          {file && uploadState === "error" && (
            <Button
              size="lg"
              variant="outline"
              className="w-full mt-4 h-12"
              onClick={() => { setUploadState("idle"); setProgress(0); }}
            >
              Try Again
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
