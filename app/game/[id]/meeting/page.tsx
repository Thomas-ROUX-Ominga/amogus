import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import MeetingPageClient from "./page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata.pages.meeting");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function MeetingPage() {
  return <MeetingPageClient />;
}
