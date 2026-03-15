"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff, ShieldPlus, ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { register } from "@/lib/redis/auth-actions";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";
import { ERROR_CODES } from "@/lib/constants/error-codes";

export default function RegisterPage() {
  const t = useTranslations();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError(t("auth.register.errors.passwordMismatch"));
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError(t("auth.register.errors.passwordMinLength"));
      setIsLoading(false);
      return;
    }

    try {
      const result = await register(username, password);

      if (result.success) {
        router.push("/login?registered=true");
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
            <ShieldPlus className="text-primary w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
              {t("auth.register.title")}
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
              {t("auth.register.subtitle")}
            </p>
          </div>
        </div>

        {/* Registration Form */}
        <div className="relative p-8 border border-primary/20 bg-black/50 backdrop-blur-md overflow-hidden">
          {/* Decorative Corner */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/40" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/40" />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-tighter text-primary/60 ml-1">{t("auth.register.usernameLabel")}</label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-black border border-primary/30 p-3 pl-10 text-lg tracking-[0.1em] text-foreground focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                    placeholder={t("auth.register.usernamePlaceholder")}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-tighter text-primary/60 ml-1">{t("auth.register.passwordLabel")}</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black border border-primary/30 p-3 pl-10 pr-10 text-lg tracking-[0.1em] text-foreground focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                    placeholder={t("auth.register.passwordPlaceholder")}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-tighter text-primary/60 ml-1">{t("auth.register.confirmPasswordLabel")}</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black border border-primary/30 p-3 pl-10 text-lg tracking-[0.1em] text-foreground focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                    placeholder={t("auth.register.confirmPasswordPlaceholder")}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 p-3 text-[10px] text-destructive uppercase tracking-widest text-center">
                {t("auth.register.setupFailedPrefix")} {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !username || !password || password !== confirmPassword}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/10 disabled:text-primary/30 text-primary-foreground font-black py-4 transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
            >
              {isLoading ? t("auth.register.initializing") : t("auth.register.registerOperator")}
            </button>
            
            <div className="text-center pt-2">
              <button 
                type="button"
                onClick={() => router.push("/login")}
                className="text-[10px] uppercase tracking-widest text-primary/50 hover:text-primary transition-colors"
              >
                {t("auth.register.existingAccount")}
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
            {t("auth.register.backHome")}
          </button>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-[8px] text-primary/40 font-mono border-t border-primary/10 pt-4 uppercase tracking-widest">
          <div className="mb-2 text-primary/60">{t("auth.register.securityTitle")}</div>
          <div>{t("auth.register.securityPassword")}</div>
          <div>{t("auth.register.securitySession")}</div>
          <div>{t("auth.register.securityIsolation")}</div>
        </div>
      </div>
    </div>
  );
}
