import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import HomePageClient from "./page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata.pages.home");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function HomePage() {
  return <HomePageClient />;
}
