import type { Metadata } from "next";
import MeetingPageClient from "./page-client";

export const metadata: Metadata = {
  title: "Meeting",
  description: "Voting room and meeting outcomes.",
};

export default function MeetingPage() {
  return <MeetingPageClient />;
}
