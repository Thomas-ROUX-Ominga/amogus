import { AppLocale } from "@/lib/i18n/config";
import en from "@/lib/i18n/messages/en";
import fr from "@/lib/i18n/messages/fr";

export const messages = {
  en,
  fr,
} satisfies Record<AppLocale, typeof en>;
