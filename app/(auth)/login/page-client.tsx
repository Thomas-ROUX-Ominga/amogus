"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ChevronRight, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { login } from "@/lib/redis/auth-actions";
import { useAuth } from "@/hooks/use-auth";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";
import { ERROR_CODES } from "@/lib/constants/error-codes";

interface LoginPageClientProps {
  redirectParam?: string | null;
  registeredParam?: string | null;
}

export default function LoginPage({
  redirectParam = null,
  registeredParam = null,
}: LoginPageClientProps) {
  const t = useTranslations();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const redirect =
    redirectParam && redirectParam.startsWith("/") ? redirectParam : "/batches";
  const registered = registeredParam === "true";

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
            <p className="text-xs text-muted-foreground uppercase tracking-wider leading-relaxed">
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
                <label className="text-xs uppercase tracking-wide text-primary/70 ml-1">{t("auth.login.usernameLabel")}</label>
                <div className="relative group/input">
                  <div className="absolute -inset-0.5 bg-primary/20 rounded-sm opacity-0 group-focus-within/input:opacity-100 transition duration-300 blur-sm"></div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("auth.login.usernamePlaceholder")}
                    autoComplete="username"
                    className="relative w-full bg-black border border-primary/30 p-3 text-lg tracking-[0.2em] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-primary/70 ml-1">{t("auth.login.passwordLabel")}</label>
                <div className="relative group/input">
                  <div className="absolute -inset-0.5 bg-primary/20 rounded-sm opacity-0 group-focus-within/input:opacity-100 transition duration-300 blur-sm"></div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.login.passwordPlaceholder")}
                    autoComplete="current-password"
                    className="relative w-full bg-black border border-primary/30 p-3 pr-10 text-lg tracking-[0.2em] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {registered && (
                <div className="bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-500 uppercase tracking-wider text-center" role="status">
                  {t("auth.login.registeredSuccess")}
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive uppercase tracking-wider text-center animate-shake" role="alert" aria-live="assertive">
                {t("auth.login.errorPrefix")} {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!username.trim() || !password.trim() || isLoading}
              className="w-full bg-primary hover:bg-primary/90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-black py-4 transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
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
                className="text-xs uppercase tracking-wider text-primary/60 hover:text-primary transition-colors min-h-[44px] inline-flex items-center"
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
            className="text-xs uppercase tracking-wider text-primary/60 hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1 min-h-[44px]"
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
