export const APP_LOCALES = ["fr", "en"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_COOKIE_NAME = "amogus-locale";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "fr" || value === "en";
}
