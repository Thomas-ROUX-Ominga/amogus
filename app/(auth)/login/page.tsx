import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LoginPageClient from "./page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata.pages.login");
  return {
    title: t("title"),
    description: t("description"),
  };
}

interface LoginPageProps {
  searchParams?: {
    redirect?: string | string[];
    registered?: string | string[];
  };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const redirectParam =
    typeof searchParams?.redirect === "string" ? searchParams.redirect : null;
  const registeredParam =
    typeof searchParams?.registered === "string" ? searchParams.registered : null;

  return (
    <LoginPageClient
      redirectParam={redirectParam}
      registeredParam={registeredParam}
    />
  );
}
