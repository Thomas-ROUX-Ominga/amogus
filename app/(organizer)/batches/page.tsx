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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
              {t("admin.batches.title")}
            </h2>
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
