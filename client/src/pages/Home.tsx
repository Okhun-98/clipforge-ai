import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import { Link, useLocation } from "wouter";
import { Zap, Upload, Brain, Scissors, Download, ArrowRight, Play, Sparkles, TrendingUp, Clock } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Upload,
    title: "Smart Upload",
    description: "Drag and drop MP4 or MOV files up to any size. Secure cloud storage with real-time progress tracking.",
    color: "oklch(0.65 0.22 285)",
  },
  {
    icon: Brain,
    title: "AI Transcription",
    description: "Whisper-powered speech-to-text converts your entire video to a timestamped transcript in seconds.",
    color: "oklch(0.68 0.2 320)",
  },
  {
    icon: Sparkles,
    title: "Intelligent Analysis",
    description: "Our AI agent scores every segment for emotional impact, engagement, and viral potential.",
    color: "oklch(0.72 0.18 165)",
  },
  {
    icon: Scissors,
    title: "Auto-Generated Shorts",
    description: "Top segments are packaged as 9:16 YouTube Shorts with AI-written titles and descriptions.",
    color: "oklch(0.78 0.16 75)",
  },
  {
    icon: TrendingUp,
    title: "Caption Overlay",
    description: "Auto-generated captions synced to every Short for maximum accessibility and engagement.",
    color: "oklch(0.65 0.22 285)",
  },
  {
    icon: Download,
    title: "One-Click Export",
    description: "Download polished, upload-ready MP4 Shorts directly to your device for YouTube.",
    color: "oklch(0.68 0.2 320)",
  },
];

const steps = [
  { step: "01", title: "Upload your video", desc: "Drop any long-form MP4 or MOV — podcast, lecture, vlog, or stream." },
  { step: "02", title: "AI processes it", desc: "Transcription, analysis, and scoring happen automatically in the background." },
  { step: "03", title: "Review your Shorts", desc: "Browse AI-selected clips with scores, titles, and captions ready to go." },
  { step: "04", title: "Download & publish", desc: "Export polished 9:16 Shorts and upload directly to YouTube." },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />

      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-20"
            style={{ background: "radial-gradient(ellipse, oklch(0.65 0.22 285), transparent 70%)" }} />
        </div>

        <div className="container relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-card/50 backdrop-blur text-sm text-muted-foreground mb-8">
              <Zap className="w-3.5 h-3.5 text-primary" />
              AI-powered YouTube Shorts generator
            </div>

            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
              Turn long videos into<br />
              <span className="forge-gradient-text">viral Shorts</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Upload any video. Our AI transcribes, analyzes, and automatically selects the most engaging moments — delivering polished YouTube Shorts ready to upload.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isAuthenticated ? (
                <Link href="/upload">
                  <Button size="lg" className="gap-2 forge-gradient text-white border-0 hover:opacity-90 transition-all duration-200 forge-glow px-8 h-12 text-base font-semibold">
                    <Upload className="w-5 h-5" />
                    Upload a Video
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  size="lg"
                  onClick={() => navigate("/login")}
                  className="gap-2 forge-gradient text-white border-0 hover:opacity-90 transition-all duration-200 forge-glow px-8 h-12 text-base font-semibold"
                >
                  <Zap className="w-5 h-5" />
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              {isAuthenticated && (
                <Link href="/dashboard">
                  <Button size="lg" variant="outline" className="gap-2 h-12 px-8 text-base border-border/60 hover:bg-accent">
                    View Dashboard
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>

          {/* Mock UI preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="mt-20 relative max-w-4xl mx-auto"
          >
            <div className="rounded-2xl border border-border/60 overflow-hidden forge-card"
              style={{ boxShadow: "0 40px 80px oklch(0 0 0 / 0.5), 0 0 60px oklch(0.65 0.22 285 / 0.1)" }}>
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-card/80">
                <div className="w-3 h-3 rounded-full bg-destructive/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <div className="flex-1 mx-4">
                  <div className="h-6 rounded-md bg-muted/40 max-w-xs mx-auto" />
                </div>
              </div>
              {/* Mock dashboard */}
              <div className="p-6 bg-background/80 grid grid-cols-3 gap-4">
                {[92, 87, 81].map((score, i) => (
                  <div key={i} className="rounded-xl border border-border/60 overflow-hidden bg-card">
                    <div className="aspect-[9/16] bg-muted/30 relative flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Play className="w-5 h-5 text-primary" fill="currentColor" />
                      </div>
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold score-badge-high">
                        {score}
                      </div>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <div className="h-3 rounded bg-muted/60 w-3/4" />
                      <div className="h-2.5 rounded bg-muted/40 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t border-border/40">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Everything you need to go viral
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              A complete pipeline from raw footage to upload-ready Shorts — powered by state-of-the-art AI.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: [0.23, 1, 0.32, 1] }}
                className="forge-card p-6 hover:border-primary/40 transition-all duration-300 group"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110"
                  style={{ background: `${f.color}22`, border: `1px solid ${f.color}44` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="font-display font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-t border-border/40">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-muted-foreground text-lg">Four steps from upload to viral Short.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.step} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-[calc(100%-1rem)] w-8 h-px bg-border/60 z-10" />
                )}
                <div className="forge-card p-6">
                  <div className="font-display text-4xl font-bold forge-gradient-text mb-4">{s.step}</div>
                  <h3 className="font-display font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border/40">
        <div className="container text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Ready to forge your Shorts?
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Upload your first video and get AI-generated Shorts in minutes.
            </p>
            {isAuthenticated ? (
              <Link href="/upload">
                <Button size="lg" className="gap-2 forge-gradient text-white border-0 hover:opacity-90 px-10 h-12 text-base font-semibold forge-glow">
                  <Upload className="w-5 h-5" />
                  Upload Your First Video
                </Button>
              </Link>
            ) : (
              <Button
                size="lg"
                onClick={() => navigate("/login")}
                className="gap-2 forge-gradient text-white border-0 hover:opacity-90 px-10 h-12 text-base font-semibold forge-glow"
              >
                <Zap className="w-5 h-5" />
                Start for Free
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md forge-gradient flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" fill="white" />
            </div>
            <span className="font-display font-semibold text-sm">ClipForge AI</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ClipForge AI. Transform your content.
          </p>
        </div>
      </footer>
    </div>
  );
}
