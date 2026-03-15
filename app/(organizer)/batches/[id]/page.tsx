import type { Metadata } from "next";
import BatchDetailPageClient from "./page-client";

export const metadata: Metadata = {
  title: "Batch Detail",
  description: "Inspect and edit a quest batch.",
};

export default function BatchDetailPage() {
  return <BatchDetailPageClient />;
}
