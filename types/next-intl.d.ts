import { APP_LOCALES } from "@/lib/i18n/config";
import en from "@/lib/i18n/messages/en";

type DeepStringifyLiterals<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
  ? readonly DeepStringifyLiterals<U>[]
  : T extends object
  ? { [K in keyof T]: DeepStringifyLiterals<T[K]> }
  : T;

type MessageSchema = DeepStringifyLiterals<typeof en>;

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof APP_LOCALES)[number];
    Messages: MessageSchema;
  }
}
