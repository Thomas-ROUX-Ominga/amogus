"use client";

import { useState, useEffect } from "react";
import { Trash2, List, Calendar, AlertTriangle, Settings } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { getAllBatches, deleteBatch } from "@/lib/redis/batch-actions";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";
import { BatchListItem } from "@/types/quest";

interface BatchListProps {
  refreshTrigger?: number;
  onBatchDeleted?: () => void;
}

export function BatchList({ refreshTrigger, onBatchDeleted }: BatchListProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadBatches = async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getAllBatches();
      
      if (!result.success) {
        setError(
          getLocalizedErrorMessage({
            t,
            code: result.code,
            fallback: result.error,
          }),
        );
        return;
      }

      setBatches(result.data || []);
    } catch {
      setError(
        getLocalizedErrorMessage({
          t,
          code: "ERR_SIGNAL_LOST",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (batchId: string) => {
    setDeletingId(batchId);
    setError("");

    try {
      const result = await deleteBatch(batchId);
      
      if (!result.success) {
        setError(
          getLocalizedErrorMessage({
            t,
            code: result.code,
            fallback: result.error,
          }),
        );
        return;
      }

      // Remove from local state
      setBatches(prev => prev.filter(batch => batch.id !== batchId));
      onBatchDeleted?.();
      setConfirmDeleteId(null);
    } catch {
      setError(
        getLocalizedErrorMessage({
          t,
          code: "ERR_SIGNAL_LOST",
        }),
      );
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [refreshTrigger]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  if (isLoading) {
    return (
      <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center justify-center py-8">
          <div className="text-[10px] text-primary uppercase tracking-widest animate-pulse">
            {t("admin.batches.loadingList")}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-2 border-destructive/20 p-6 bg-black/50 backdrop-blur-sm">
        <div className="text-center">
          <div className="text-[10px] text-destructive uppercase tracking-widest">
            [ERROR] {error}
          </div>
          <button
            onClick={loadBatches}
            className="mt-4 text-[8px] text-primary uppercase tracking-widest hover:text-primary/80"
          >
            {t("common.actions.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
        <div className="text-center py-8">
          <List className="text-primary/30 w-12 h-12 mx-auto mb-4" />
          <h3 className="text-lg font-bold uppercase tracking-wider text-primary mb-2">
            {t("admin.batches.noBatchesFound")}
          </h3>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            {t("admin.batches.noBatchesDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
      <h3 className="text-lg font-bold uppercase tracking-wider text-primary mb-6">
        {t("admin.batches.inventoryTitle")}
      </h3>
      
      <div className="space-y-3">
        {batches.map((batch) => (
          <div
            key={batch.id}
            className="flex items-center justify-between p-4 border border-primary/10 bg-black/30 hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center bg-primary/5">
                <List className="text-primary w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-mono text-primary uppercase tracking-widest">
                  BATCH-{batch.id.slice(-8).toUpperCase()}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-1 text-[8px] text-muted-foreground uppercase tracking-widest">
                    <Calendar size={10} />
                    {formatDate(batch.createdAt)}
                  </div>
                  <div className="text-[8px] text-muted-foreground uppercase tracking-widest">
                    {t("admin.batchDetail.questsCount", { count: batch.questCount })}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link
                href={`/batches/${batch.id}`}
                className="p-2 text-primary hover:text-primary/80 hover:bg-primary/10 border border-primary/30 hover:border-primary/50 transition-all"
                title={t("admin.batches.manageBatch")}
              >
                <Settings size={16} />
              </Link>

              <button
                onClick={() => setConfirmDeleteId(batch.id)}
                disabled={deletingId === batch.id}
                className="p-2 text-destructive hover:text-destructive/80 hover:bg-destructive/10 border border-destructive/30 hover:border-destructive/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("admin.batches.deleteBatch")}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-black border border-destructive/30 rounded-sm p-6 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertTriangle size={18} />
                <h2 className="text-lg font-black uppercase tracking-[0.2em] font-orbitron">
                  {t("admin.batches.confirmDeletion")}
                </h2>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
                {t("admin.batches.confirmDeletionMessage", {
                  batchCode: `BATCH-${confirmDeleteId.slice(-8).toUpperCase()}`,
                })}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 bg-black/80 border border-primary/30 hover:border-primary/50 text-primary font-black py-3 rounded-sm transition-all text-xs tracking-widest"
              >
                {t("common.actions.abort")}
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-white font-black py-3 rounded-sm transition-all relative overflow-hidden group text-xs tracking-widest"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <span className="relative">
                  {deletingId === confirmDeleteId
                    ? t("admin.batches.purgeInProgress")
                    : t("admin.batches.confirmPurge")}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-6 pt-4 border-t border-primary/10">
        <div className="flex justify-between items-center text-[8px] text-muted-foreground uppercase tracking-widest">
          <span>{t("admin.batches.totalBatches", { count: batches.length })}</span>
          <span>
            {t("admin.batches.totalQuests", {
              count: batches.reduce((sum, batch) => sum + batch.questCount, 0),
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
