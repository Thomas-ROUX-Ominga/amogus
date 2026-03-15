import type { Metadata } from "next";
import AdminBatchesPageClient from "./page-client";

export const metadata: Metadata = {
  title: "Batches",
  description: "Create and manage quest batches.",
};

export default function AdminBatchesPage() {
  return <AdminBatchesPageClient />;
}
