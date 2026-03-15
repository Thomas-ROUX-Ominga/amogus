import type { Metadata } from "next";
import LobbyPageClient from "./page-client";

export const metadata: Metadata = {
  title: "Game Lobby",
  description: "Session lobby and player status.",
};

export default function LobbyPage() {
  return <LobbyPageClient />;
}
