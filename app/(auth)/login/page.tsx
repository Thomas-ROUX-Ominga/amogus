"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ChevronRight, ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { login } from "@/lib/redis/auth-actions";
import { useAuth } from "@/hooks/use-auth";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";
import { ERROR_CODES } from "@/lib/constants/error-codes";

function LoginContent() {
  const t = useTranslations();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const redirect =
    redirectParam && redirectParam.startsWith("/") ? redirectParam : "/batches";
  const registered = searchParams.get("registered") === "true";

  const { refreshAuth } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await login(username.trim(), password.trim());
      
      if (result.success) {
        await refreshAuth();
        router.push(redirect);
        router.refresh();
      } else {
        setError(
          getLocalizedErrorMessage({
            t,
            code: result.code,
            fallback: result.error,
          }),
        );
      }
    } catch {
      setError(
        getLocalizedErrorMessage({
          t,
          code: ERROR_CODES.ERR_SIGNAL_LOST,
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 font-mono">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Terminal Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full border-2 border-primary/30 flex items-center justify-center bg-primary/5 animate-pulse">
            <Lock className="text-primary w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
              {t("auth.login.title")}
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
              {t("auth.login.subtitle")}
            </p>
          </div>
        </div>

        {/* Login Form */}
        <div className="relative p-8 border border-primary/20 bg-black/50 backdrop-blur-md overflow-hidden group">
          {/* Decorative Corner */}
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary/40" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary/40" />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-tighter text-primary/60 ml-1">{t("auth.login.usernameLabel")}</label>
                <div className="relative group/input">
                  <div className="absolute -inset-0.5 bg-primary/20 rounded-sm opacity-0 group-focus-within/input:opacity-100 transition duration-300 blur-sm"></div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("auth.login.usernamePlaceholder")}
                    autoComplete="username"
                    className="relative w-full bg-black border border-primary/30 p-3 text-lg tracking-[0.2em] text-foreground placeholder:text-primary/10 focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-tighter text-primary/60 ml-1">{t("auth.login.passwordLabel")}</label>
                <div className="relative group/input">
                  <div className="absolute -inset-0.5 bg-primary/20 rounded-sm opacity-0 group-focus-within/input:opacity-100 transition duration-300 blur-sm"></div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.login.passwordPlaceholder")}
                    autoComplete="current-password"
                    className="relative w-full bg-black border border-primary/30 p-3 text-lg tracking-[0.2em] text-foreground placeholder:text-primary/10 focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                  />
                </div>
              </div>
            </div>

            {registered && (
                <div className="bg-green-500/10 border border-green-500/20 p-3 text-[10px] text-green-500 uppercase tracking-widest text-center">
                  {t("auth.login.registeredSuccess")}
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 p-3 text-[10px] text-destructive uppercase tracking-widest text-center animate-shake">
                {t("auth.login.errorPrefix")} {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!username.trim() || !password.trim() || isLoading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-black py-4 transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2 tracking-[0.3em] uppercase text-sm">
                {isLoading ? t("auth.login.authorizing") : t("auth.login.initializeSession")}
                {!isLoading && <ChevronRight size={18} className="translate-x-0 group-hover:translate-x-1 transition-transform" />}
              </span>
            </button>
            
            <div className="text-center pt-2">
              <button 
                type="button"
                onClick={() => router.push("/register")}
                className="text-[10px] uppercase tracking-widest text-primary/50 hover:text-primary transition-colors"
              >
                {t("auth.login.noAccount")}
              </button>
            </div>
          </form>
        </div>

        <div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-[10px] uppercase tracking-widest text-primary/50 hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <ChevronLeft size={14} />
            {t("auth.login.backHome")}
          </button>
        </div>

        {/* Footer Info */}
        <div className="pt-4 flex justify-between items-center opacity-30 px-2">
          <div className="text-[8px] tracking-tighter uppercase">
            {t("auth.login.systemLabel")}
          </div>
          <div className="text-[8px] tracking-tighter uppercase">
            {t("auth.login.protocolLabel")}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginFallback() {
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-primary font-mono tracking-widest">{t("auth.login.connecting")}</div>
    </div>
  );
}
