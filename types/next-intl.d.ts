import { APP_LOCALES } from "@/lib/i18n/config";
import en from "@/lib/i18n/messages/en";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof APP_LOCALES)[number];
    Messages: typeof en;
  }
}
