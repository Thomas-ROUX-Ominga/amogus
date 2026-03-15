import type { Metadata } from "next";
import CreateGamePageClient from "./page-client";

export const metadata: Metadata = {
  title: "Create Game",
  description: "Configure and launch a new game session.",
};

export default function CreateGamePage() {
  return <CreateGamePageClient />;
}
