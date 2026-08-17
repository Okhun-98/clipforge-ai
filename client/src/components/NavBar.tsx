import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Zap, LayoutDashboard, Upload, LogOut, LogIn } from "lucide-react";

export default function NavBar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-xl"
      style={{ background: "oklch(0.11 0.008 265 / 0.85)" }}>
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg forge-gradient flex items-center justify-center forge-glow transition-all duration-300 group-hover:scale-105">
            <Zap className="w-4 h-4 text-white" fill="white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">
            Clip<span className="forge-gradient-text">Forge</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {isAuthenticated && (
            <>
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-2 text-muted-foreground hover:text-foreground transition-colors ${location === "/dashboard" ? "text-foreground bg-accent" : ""}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/upload">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-2 text-muted-foreground hover:text-foreground transition-colors ${location === "/upload" ? "text-foreground bg-accent" : ""}`}
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-7 h-7 rounded-full forge-gradient flex items-center justify-center text-white text-xs font-semibold">
                  {user?.name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <span className="text-sm text-muted-foreground">{user?.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => navigate("/login")}
              className="gap-2 forge-gradient text-white border-0 hover:opacity-90 transition-opacity"
            >
              <LogIn className="w-4 h-4" />
              Sign in
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
