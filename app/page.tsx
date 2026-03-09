"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, Shield, ChevronRight, Hash, LogOut, User } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { isValidShortCode, normalizeShortCode } from "@/lib/utils/short-code";
import { useAuth } from "@/hooks/use-auth";
import { clearSession } from "@/lib/redis/auth-actions";

export default function Home() {
  const t = useTranslations();
  const [gameId, setGameId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { authState, refreshAuth } = useAuth();
  const { isAuthenticated, session } = authState;

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

  const handleLogout = async () => {
    await clearSession();
    await refreshAuth();
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-black text-foreground font-mono overflow-hidden flex flex-col md:flex-row">
      {/* LEFT PANEL: GUEST ACCESS (PRIMARY) */}
      <section className="flex-1 flex flex-col items-center justify-center p-8 relative border-b md:border-b-0 md:border-r border-primary/10">
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
        
        <div className="max-w-md w-full space-y-12 relative z-10">
          <header className="space-y-4">
            <motion.div 
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
            </motion.div>
            <p className="text-muted-foreground text-xs uppercase tracking-[0.2em] border-l-2 border-primary/20 pl-4 py-1">
              {t("home.missionUplink")}
            </p>
          </header>

          <div className="space-y-8">
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div className="relative group">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  value={gameId}
                  onChange={handleInputChange}
                  placeholder={t("home.sessionCodePlaceholder")}
                  className={`w-full bg-black/50 border-2 p-5 pl-12 text-2xl font-black tracking-[0.3em] text-foreground placeholder:text-primary/10 focus:outline-none transition-all rounded-none uppercase ${
                    error 
                      ? 'border-destructive animate-pulse' 
                      : 'border-primary/20 focus:border-primary'
                  }`}
                  maxLength={6}
                />
              </div>
              
              {error && (
                <div className="text-destructive text-[10px] uppercase tracking-widest text-center">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={!gameId.trim() || !!error}
                className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border-2 border-primary/30 hover:border-primary font-black py-4 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="tracking-[0.4em] uppercase text-sm">{t("home.joinSession")}</span>
                <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* RIGHT PANEL: ORGANIZER ACCESS (SECONDARY) */}
      <section className="md:w-1/4 bg-primary/5 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
          <Shield className="w-64 h-64 text-primary" />
        </div>

        <div className="space-y-8 relative z-10 text-center w-full">
          {isAuthenticated && session ? (
            <>
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full border-2 border-primary/30 flex items-center justify-center bg-primary/10 mx-auto">
                  <User className="text-primary w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary">
                    {session.username}
                  </h2>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-widest">
                    {t("home.organizerAuthorized")}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => router.push("/batches")}
                  className="w-full border border-primary/30 py-3 px-4 text-[10px] uppercase tracking-[0.2em] bg-primary/10 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all font-bold"
                >
                  {t("home.manageBatches")}
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full border border-primary/10 py-3 px-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={12} />
                  {t("home.terminate")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Shield className="w-12 h-12 text-primary/40 mx-auto" />
                <h2 className="text-sm font-black uppercase tracking-[0.3em] font-orbitron">
                  {t("home.organizer")}
                </h2>
              </div>

              <p className="text-[9px] text-muted-foreground uppercase leading-relaxed tracking-widest max-w-[180px] mx-auto">
                {t("home.organizerDescription")}
              </p>

              <button
                onClick={() => router.push("/login")}
                className="w-full max-w-[200px] border border-primary/30 py-3 px-4 text-[10px] uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all font-bold"
              >
                {t("home.loginPortal")}
              </button>
            </>
          )}
        </div>

        <div className="absolute bottom-4 text-[8px] text-primary/20 uppercase tracking-widest">
          {t("home.secureTerminal")}
        </div>
      </section>

      {/* Global Visual Decor */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
    </main>
  );
}
