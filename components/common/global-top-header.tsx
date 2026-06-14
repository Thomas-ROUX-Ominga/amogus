"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Shield,
  User,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Plus,
  ScrollText,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { clearSession, disconnectPlayer } from "@/lib/redis/auth-actions";
import { GameRulesModal } from "@/components/common/game-rules-modal";
import {
  AppLocale,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
} from "@/lib/i18n/config";

const HIDDEN_ROUTES = new Set(["/", "/login", "/register"]);

export function GlobalTopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const { authState, refreshAuth, clearAnonymousSession } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shouldHide = HIDDEN_ROUTES.has(pathname);

  const nextLocale: AppLocale = locale === "fr" ? "en" : "fr";
  const nextLanguageLabel =
    nextLocale === "fr" ? t("common.language.french") : t("common.language.english");

  const handleSwitchLanguage = () => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    router.refresh();
  };

  const isOrganizer = authState.isAuthenticated && authState.session?.sessionType === "admin";
  const hasAnonymousPseudo =
    authState.session?.sessionType === "anonymous" &&
    Boolean(authState.session.username?.trim());
  const canShowSignOut = isOrganizer || hasAnonymousPseudo;
  const hasAccountMenuActions = isOrganizer || hasAnonymousPseudo;
  const displayName = authState.isLoading
    ? t("common.actions.loading")
    : authState.session?.username || t("common.user.guest");

  useEffect(() => {
    if (shouldHide) return;

    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as globalThis.Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shouldHide]);

  const handleGoToBatches = () => {
    setIsMenuOpen(false);
    router.push("/batches");
  };

  const handleGoToCreateGame = () => {
    setIsMenuOpen(false);
    router.push("/games/create");
  };

  const handleLogout = async () => {
    setIsMenuOpen(false);
    const anonymousSession =
      authState.session?.sessionType === "anonymous" ? authState.session : null;

    // Local-first logout: always clear client-side anonymous identity immediately.
    // This prevents stale pseudo display if a server-side disconnect call fails.
    clearAnonymousSession();

    try {
      if (isOrganizer) {
        await clearSession();
      } else {
        if (anonymousSession?.gameId && anonymousSession.userId) {
          await disconnectPlayer(anonymousSession.gameId, anonymousSession.userId);
        }
      }
    } catch {
      // no-op: fallback navigation below
    } finally {
      await refreshAuth();
      router.push("/");
      router.refresh();
    }
  };

  if (shouldHide) {
    return null;
  }

  return (
    <>
      <div className="fixed top-3 left-3 right-3 z-[999] flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="min-h-[44px] px-1 bg-transparent text-foreground hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-2"
          aria-label={t("game.meeting.home")}
        >
          <span className="h-7 w-7 border border-primary/35 bg-black inline-flex items-center justify-center text-primary text-[11px] font-bold leading-none">
            {">_"}
          </span>
          <span className="font-orbitron font-black tracking-[0.12em] text-sm text-foreground">
            AMOGUS
          </span>
        </button>

        <div className="flex items-center gap-2">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => {
                if (!hasAccountMenuActions) return;
                setIsMenuOpen((prev) => !prev);
              }}
              aria-haspopup={hasAccountMenuActions ? "menu" : undefined}
              aria-expanded={hasAccountMenuActions ? isMenuOpen : undefined}
              className="min-h-[44px] px-3 border border-primary/25 bg-black/75 inline-flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/90 hover:bg-primary/10 hover:border-primary/45 transition-colors cursor-pointer"
            >
              {isOrganizer ? (
                <Shield className="h-3.5 w-3.5 text-primary" />
              ) : (
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="max-w-[150px] truncate">{displayName}</span>
              {hasAccountMenuActions && (
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} />
              )}
            </button>

            {isMenuOpen && hasAccountMenuActions && (
              <div className="absolute right-0 mt-2 w-44 border border-primary/25 bg-black/95 backdrop-blur-sm">
                {isOrganizer && (
                  <button
                    type="button"
                    onClick={handleGoToCreateGame}
                    className="w-full min-h-[44px] px-3 text-left inline-flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/90 hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" />
                    {t("home.createGame")}
                  </button>
                )}
                {isOrganizer && (
                  <button
                    type="button"
                    onClick={handleGoToBatches}
                    className="w-full min-h-[44px] px-3 text-left inline-flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/90 hover:bg-primary/10 transition-colors cursor-pointer border-t border-primary/15"
                  >
                    <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                    {t("common.user.myBatches")}
                  </button>
                )}
                {canShowSignOut && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={`w-full min-h-[44px] px-3 text-left inline-flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/90 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer ${
                      isOrganizer ? "border-t border-primary/15" : ""
                    }`}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t("common.user.signOut")}
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              setIsRulesOpen(true);
            }}
            className="min-h-[44px] px-3 border border-primary/30 bg-black/75 text-primary hover:bg-primary/10 transition-colors cursor-pointer inline-flex items-center gap-2 text-xs uppercase tracking-wider"
            aria-label={t("common.rules.buttonLabel")}
            title={t("common.rules.buttonLabel")}
          >
            <ScrollText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("common.rules.buttonLabel")}</span>
          </button>

          <button
            type="button"
            onClick={handleSwitchLanguage}
            className="min-h-[44px] px-3 text-xs uppercase tracking-wider border border-primary/30 bg-black/75 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            aria-label={t("common.language.switchTo", { language: nextLanguageLabel })}
            title={t("common.language.currentLocale", { locale })}
          >
            {nextLocale.toUpperCase()}
          </button>
        </div>
      </div>

      <GameRulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </>
  );
}
