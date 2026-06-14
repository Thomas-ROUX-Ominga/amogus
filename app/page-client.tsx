"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, ChevronRight, Hash, LogIn, UserPlus, LayoutGrid, Plus } from "lucide-react";
import { m } from "framer-motion";
import { useTranslations } from "next-intl";
import { isValidShortCode, normalizeShortCode } from "@/lib/utils/short-code";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const t = useTranslations();
  const [gameId, setGameId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { authState } = useAuth();
  const isOrganizerAuthenticated = authState.isAuthenticated && authState.session?.sessionType === "admin";

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const normalizedCode = normalizeShortCode(gameId.trim());
    
    if (!normalizedCode) {
      setError(t("home.errors.enterSessionCode"));
      return;
    }
    
    if (!isValidShortCode(normalizedCode)) {
      setError(t("home.errors.invalidSessionCodeFormat"));
      return;
    }
    
    router.push(`/game/${normalizedCode}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setGameId(value);
    setError("");
  };

  return (
    <main className="min-h-screen bg-black text-foreground font-mono overflow-hidden flex items-center justify-center p-8 relative">
      <section className="w-full max-w-md relative">
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
        
        <div className="w-full space-y-12 relative z-10">
          <header className="space-y-4">
            <m.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="p-2 border border-primary/30 bg-primary/5">
                <Terminal className="text-primary w-6 h-6" />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tighter font-orbitron">
                AMOGUS <span className="text-primary">COCKPIT</span>
              </h1>
            </m.div>
            <p className="text-muted-foreground text-xs uppercase tracking-[0.2em] border-l-2 border-primary/20 pl-4 py-1">
              {t("home.missionUplink")}
            </p>
          </header>

          <div className="space-y-8">
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div className="relative group">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30 group-focus-within:text-primary transition-colors" aria-hidden="true" />
                <label htmlFor="session-code" className="sr-only">{t("home.sessionCodePlaceholder")}</label>
                <input
                  id="session-code"
                  type="text"
                  value={gameId}
                  onChange={handleInputChange}
                  placeholder={t("home.sessionCodePlaceholder")}
                  autoComplete="off"
                  className={`w-full bg-black/50 border-2 p-5 pl-12 text-2xl font-black tracking-[0.3em] text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all rounded-none uppercase ${
                    error
                      ? 'border-destructive animate-pulse'
                      : 'border-primary/20 focus:border-primary'
                  }`}
                  maxLength={6}
                />
              </div>
              
              {error && (
                <div className="text-destructive text-xs uppercase tracking-wider text-center" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={!gameId.trim() || !!error}
                className="w-full h-14 bg-primary text-primary-foreground border border-primary font-semibold text-base transition-all hover:opacity-95 active:scale-95 hover:shadow-[0_0_20px_rgb(var(--primary-rgb)/0.25)] cursor-pointer flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                <span>{t("home.joinSession")}</span>
                <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-primary/20" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-black px-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {t("home.or")}
                </span>
              </div>
            </div>

            {isOrganizerAuthenticated ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => router.push("/games/create")}
                  className="w-full h-12 border border-primary/35 bg-background/40 text-foreground font-medium text-sm transition-all hover:bg-primary/10 hover:border-primary active:scale-95 hover:shadow-[0_10px_24px_rgb(var(--primary-rgb)/0.16)] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  {t("home.createGame")}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/batches")}
                  className="w-full h-12 border border-primary/35 bg-background/40 text-foreground font-medium text-sm transition-all hover:bg-primary/10 hover:border-primary active:scale-95 hover:shadow-[0_10px_24px_rgb(var(--primary-rgb)/0.16)] cursor-pointer flex items-center justify-center gap-2"
                >
                  <LayoutGrid size={18} />
                  {t("common.user.myBatches")}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="w-full h-12 border border-primary/35 bg-background/40 text-foreground font-medium text-sm transition-all hover:bg-primary/10 hover:border-primary active:scale-95 hover:shadow-[0_10px_24px_rgb(var(--primary-rgb)/0.16)] cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn size={18} />
                  {t("home.signIn")}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="w-full h-12 border border-primary/25 bg-transparent text-muted-foreground font-medium text-sm transition-all hover:text-foreground hover:border-primary/45 hover:bg-primary/10 active:scale-95 hover:shadow-[0_10px_24px_rgb(var(--primary-rgb)/0.12)] cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} />
                  {t("home.createAccount")}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Global Visual Decor */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
    </main>
  );
}
