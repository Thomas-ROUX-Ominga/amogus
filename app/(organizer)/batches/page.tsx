import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AdminBatchesPageClient from "./page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata.pages.batches");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function AdminBatchesPage() {
  return <AdminBatchesPageClient />;
}
