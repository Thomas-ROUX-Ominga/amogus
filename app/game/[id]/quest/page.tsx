import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import QuestPageClient from "./page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata.pages.quest");
  return {
    title: t("title"),
    description: t("description"),
  };
}

interface QuestPageProps {
  searchParams?: {
    duration?: string | string[];
    questId?: string | string[];
  };
}

export default function QuestPage({ searchParams }: QuestPageProps) {
  const durationParam =
    typeof searchParams?.duration === "string" ? searchParams.duration : null;
  const questIdParam =
    typeof searchParams?.questId === "string" ? searchParams.questId : null;

  return (
    <QuestPageClient durationParam={durationParam} questIdParam={questIdParam} />
  );
}
