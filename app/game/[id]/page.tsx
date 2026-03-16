import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LobbyPageClient from "./page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata.pages.gameLobby");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function LobbyPage() {
  return <LobbyPageClient />;
}
