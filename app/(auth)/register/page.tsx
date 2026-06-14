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
  const [formState, setFormState] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    showPassword: false,
    isLoading: false,
    error: "",
  });
  const router = useRouter();

  const { username, password, confirmPassword, showPassword, isLoading, error } = formState;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, error: "", isLoading: true }));

    if (password !== confirmPassword) {
      setFormState((prev) => ({
        ...prev,
        error: t("auth.register.errors.passwordMismatch"),
        isLoading: false,
      }));
      return;
    }

    if (password.length < 8) {
      setFormState((prev) => ({
        ...prev,
        error: t("auth.register.errors.passwordMinLength"),
        isLoading: false,
      }));
      return;
    }

    try {
      const result = await register(username, password);

      if (result.success) {
        router.push("/login?registered=true");
      } else {
        setFormState((prev) => ({
          ...prev,
          error: getLocalizedErrorMessage({
            t,
            code: result.code,
            fallback: result.error,
          }),
        }));
      }
    } catch {
      setFormState((prev) => ({
        ...prev,
        error: getLocalizedErrorMessage({
          t,
          code: ERROR_CODES.ERR_SIGNAL_LOST,
        }),
      }));
    } finally {
      setFormState((prev) => ({ ...prev, isLoading: false }));
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
            <p className="text-xs text-muted-foreground uppercase tracking-wider leading-relaxed">
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
                <label className="text-xs uppercase tracking-wide text-primary/70 ml-1">{t("auth.register.usernameLabel")}</label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, username: e.target.value }))
                    }
                    className="w-full bg-black border border-primary/30 p-3 pl-10 text-lg tracking-[0.1em] text-foreground focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                    placeholder={t("auth.register.usernamePlaceholder")}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-primary/70 ml-1">{t("auth.register.passwordLabel")}</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, password: e.target.value }))
                    }
                    className="w-full bg-black border border-primary/30 p-3 pl-10 pr-10 text-lg tracking-[0.1em] text-foreground focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                    placeholder={t("auth.register.passwordPlaceholder")}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({ ...prev, showPassword: !prev.showPassword }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-primary/70 ml-1">{t("auth.register.confirmPasswordLabel")}</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    className="w-full bg-black border border-primary/30 p-3 pl-10 text-lg tracking-[0.1em] text-foreground focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                    placeholder={t("auth.register.confirmPasswordPlaceholder")}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive uppercase tracking-wider text-center" role="alert" aria-live="assertive">
                {t("auth.register.setupFailedPrefix")} {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !username || !password || password !== confirmPassword}
              className="w-full bg-primary hover:bg-primary/90 active:scale-95 disabled:bg-primary/10 disabled:text-primary/30 text-primary-foreground font-black py-4 transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
            >
              {isLoading ? t("auth.register.initializing") : t("auth.register.registerOperator")}
            </button>
            
            <div className="text-center pt-2">
              <button 
                type="button"
                onClick={() => router.push("/login")}
                className="text-xs uppercase tracking-wider text-primary/60 hover:text-primary transition-colors min-h-[44px] inline-flex items-center"
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
            className="text-xs uppercase tracking-wider text-primary/60 hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1 min-h-[44px]"
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
