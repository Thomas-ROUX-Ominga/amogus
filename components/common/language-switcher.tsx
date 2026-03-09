"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AppLocale,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
} from "@/lib/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations();

  const nextLocale: AppLocale = locale === "fr" ? "en" : "fr";
  const nextLanguageLabel = nextLocale === "fr" ? t("common.language.french") : t("common.language.english");

  const handleSwitch = () => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleSwitch}
      className="fixed top-3 right-3 z-[999] px-2 py-1 text-[10px] uppercase tracking-wider border border-primary/30 bg-black/70 text-primary hover:bg-primary/10 transition-colors"
      aria-label={t("common.language.switchTo", { language: nextLanguageLabel })}
      title={t("common.language.currentLocale", { locale })}
    >
      {nextLocale.toUpperCase()}
    </button>
  );
}
