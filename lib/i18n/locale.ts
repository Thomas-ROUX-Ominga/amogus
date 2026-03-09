import { AppLocale, DEFAULT_LOCALE, isAppLocale } from "@/lib/i18n/config";

export function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): AppLocale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  const primaryLanguage = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  return primaryLanguage.startsWith("fr") ? "fr" : "en";
}

export function resolveAppLocale(input: {
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): AppLocale {
  if (isAppLocale(input.cookieLocale)) {
    return input.cookieLocale;
  }

  return detectLocaleFromAcceptLanguage(input.acceptLanguage);
}
