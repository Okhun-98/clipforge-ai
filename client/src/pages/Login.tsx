import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, LogIn, User, Mail } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const signIn = trpc.auth.signIn.useMutation({
    onSuccess: () => {
      toast.success("Signed in!");
      navigate("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message ?? "Sign in failed");
    },
  });

  // If already signed in, go straight to the dashboard.
  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    signIn.mutate({ name: name.trim(), email: email.trim() || undefined });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="container pt-28 pb-16 max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="text-center mb-10">
            <div className="w-14 h-14 rounded-2xl forge-gradient flex items-center justify-center mx-auto mb-5 forge-glow">
              <LogIn className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-display text-3xl font-bold mb-2">Sign in</h1>
            <p className="text-muted-foreground text-sm">
              Enter your name to get started. Your videos are stored locally on this machine.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="forge-card p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Email <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={signIn.isPending}
              className="w-full forge-gradient text-white border-0 hover:opacity-90 h-12 text-base font-semibold forge-glow"
            >
              {signIn.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Sign in
                </>
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
