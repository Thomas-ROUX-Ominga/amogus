import type { Metadata } from "next";
import QuestPageClient from "./page-client";

export const metadata: Metadata = {
  title: "Quest",
  description: "Current mission and quest progress.",
};

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
