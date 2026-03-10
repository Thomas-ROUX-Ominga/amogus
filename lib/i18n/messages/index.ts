import { AppLocale } from "@/lib/i18n/config";
import en from "@/lib/i18n/messages/en";
import fr from "@/lib/i18n/messages/fr";

type DeepStringifyLiterals<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
  ? readonly DeepStringifyLiterals<U>[]
  : T extends object
  ? { [K in keyof T]: DeepStringifyLiterals<T[K]> }
  : T;

type MessageSchema = DeepStringifyLiterals<typeof en>;

export const messages = {
  en,
  fr,
} satisfies Record<AppLocale, MessageSchema>;
