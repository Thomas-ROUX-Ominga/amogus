import type { Metadata } from "next";
import HomePageClient from "./page-client";

export const metadata: Metadata = {
  title: "AMOGUS Cockpit",
  description: "Join a game session or launch an organizer session.",
};

export default function HomePage() {
  return <HomePageClient />;
}
