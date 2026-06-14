"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BatchForm } from "@/components/admin/batch-form";
import { BatchList } from "@/components/admin/batch-list";

export default function AdminBatchesPage() {
  const t = useTranslations();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleBatchCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleBatchDeleted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="h-full overflow-hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-4 sm:pt-20 sm:pb-6">
      <div className="h-full min-h-0 flex flex-col gap-6 sm:gap-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
              {t("admin.batches.title")}
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2">
              {t("admin.batches.subtitle")}
            </p>
          </div>
          <BatchForm onBatchCreated={handleBatchCreated} />
        </div>

        {/* Batch List */}
        <BatchList
          refreshTrigger={refreshTrigger}
          onBatchDeleted={handleBatchDeleted}
        />
      </div>
    </div>
  );
}
