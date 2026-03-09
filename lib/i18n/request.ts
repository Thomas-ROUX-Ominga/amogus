import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/config";
import { resolveAppLocale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const locale = resolveAppLocale({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });

  return {
    locale,
    messages: messages[locale],
  };
});
