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
  searchParams?: Promise<{
    redirect?: string | string[];
    registered?: string | string[];
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const redirectParam =
    typeof resolvedSearchParams?.redirect === "string" ? resolvedSearchParams.redirect : null;
  const registeredParam =
    typeof resolvedSearchParams?.registered === "string" ? resolvedSearchParams.registered : null;

  return (
    <LoginPageClient
      redirectParam={redirectParam}
      registeredParam={registeredParam}
    />
  );
}
