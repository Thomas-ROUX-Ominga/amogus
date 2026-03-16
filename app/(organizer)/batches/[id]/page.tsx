import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import BatchDetailPageClient from "./page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata.pages.batchDetail");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function BatchDetailPage() {
  return <BatchDetailPageClient />;
}
