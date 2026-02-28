"use client";

import { useRouter } from "next/navigation";
import { LogOut, Shield, Lock, CheckCircle, AlertTriangle } from "lucide-react";
import { clearSession } from "@/lib/redis/auth-actions";
import { useAuth } from "@/hooks/use-auth";

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { authState } = useAuth();

  const handleLogout = async () => {
    try {
      await clearSession();
      router.push("/login"); // Redirect to new auth path
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-black font-mono">
      {/* Organizer Header */}
      <header className="border-b border-primary/20 bg-black/80 backdrop-blur-sm relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded border border-primary/30 flex items-center justify-center bg-primary/10">
                <Shield className="text-primary w-4 h-4" />
              </div>
              <h1 className="text-lg font-black uppercase tracking-[0.2em] text-primary font-orbitron">
                Organizer Control
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Authentication Status */}
              <div className="flex items-center gap-2 px-3 py-1.5 border text-[10px] uppercase tracking-widest transition-all rounded-none">
                {authState.isLoading ? (
                  <>
                    <AlertTriangle className="w-3 h-3 animate-pulse" />
                    <span className="text-muted-foreground">Checking...</span>
                  </>
                ) : authState.isAuthenticated ? (
                  <>
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-green-500">
                      {authState.session?.username || "Admin"}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-destructive" />
                    <span className="text-destructive">Unauthorized</span>
                  </>
                )}
              </div>

              <button
                onClick={handleLogout}
                disabled={!authState.isAuthenticated}
                className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest text-primary/70 hover:text-primary border border-primary/30 hover:border-primary/50 transition-all rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut size={14} />
                Term_Session
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        {children}
      </main>
      
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] opacity-20" />
      </div>
    </div>
  );
}
