"use client";

import { useState, useEffect } from "react";
import { Trash2, List, AlertTriangle, Settings, Pencil, Check, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getAllBatches, deleteBatch, updateBatchName } from "@/lib/redis/batch-actions";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";
import { BatchListItem } from "@/types/quest";

interface BatchListProps {
  refreshTrigger?: number;
  onBatchDeleted?: () => void;
}

export function BatchList({ refreshTrigger, onBatchDeleted }: BatchListProps) {
  const t = useTranslations();
  const maxZones = Number(process.env.NEXT_PUBLIC_MAX_GAME_ZONES || 50);
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingNameId, setSavingNameId] = useState<string | null>(null);

  const getDefaultZoneName = (batchId: string) => `ZONE-${batchId.slice(-8).toUpperCase()}`;
  const getZoneDisplayName = (batch: BatchListItem) => batch.name?.trim() || getDefaultZoneName(batch.id);

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

  const handleStartEditing = (batch: BatchListItem) => {
    setEditingBatchId(batch.id);
    setEditingName(batch.name?.trim() || getDefaultZoneName(batch.id));
  };

  const handleCancelEditing = () => {
    setEditingBatchId(null);
    setEditingName("");
  };

  const handleSaveName = async (batchId: string) => {
    const trimmedName = editingName.trim();
    if (!trimmedName) return;

    setSavingNameId(batchId);
    setError("");

    try {
      const result = await updateBatchName(batchId, trimmedName);
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

      setBatches((prev) =>
        prev.map((batch) =>
          batch.id === batchId
            ? {
                ...batch,
                name: trimmedName,
              }
            : batch,
        ),
      );
      handleCancelEditing();
    } catch {
      setError(
        getLocalizedErrorMessage({
          t,
          code: "ERR_SIGNAL_LOST",
        }),
      );
    } finally {
      setSavingNameId(null);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
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
      <div className="flex-1 min-h-0 border-2 border-destructive/20 p-6 bg-black/50 backdrop-blur-sm">
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
      <div className="flex-1 min-h-0 border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
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
    <div className="flex-1 min-h-0 border-2 border-primary/20 p-4 sm:p-6 bg-black/50 backdrop-blur-sm flex flex-col">
      <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold uppercase tracking-wider text-primary">
          {t("admin.batches.inventoryTitle")}
        </h3>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">
          {t("admin.batches.totalWithMax", {
            count: String(batches.length),
            max: String(maxZones),
          })}
        </span>
      </div>
      
      <div className="inventory-scroll flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {batches.map((batch) => (
          <div
            key={batch.id}
            className="flex items-center justify-between p-3 sm:p-4 border border-primary/10 bg-black/30 hover:border-primary/30 transition-all min-h-[96px]"
          >
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-primary/30 flex items-center justify-center bg-primary/5 shrink-0">
                <List className="text-primary w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                {editingBatchId === batch.id ? (
                  <div className="flex items-center gap-2 max-w-full">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value.slice(0, 60))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleSaveName(batch.id);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          handleCancelEditing();
                        }
                      }}
                      className="h-8 w-full max-w-[240px] bg-black border border-primary/40 px-2 text-[11px] font-mono text-primary uppercase tracking-wider focus:outline-none focus:border-primary"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveName(batch.id)}
                      disabled={savingNameId === batch.id || !editingName.trim()}
                      className="p-1.5 border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t("common.actions.save")}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditing}
                      disabled={savingNameId === batch.id}
                      className="p-1.5 border border-primary/25 text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t("common.actions.cancel")}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-[10px] font-mono text-primary uppercase tracking-widest truncate">
                      {getZoneDisplayName(batch)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartEditing(batch)}
                      className="p-1 border border-primary/25 text-primary/70 hover:text-primary hover:border-primary/45 hover:bg-primary/10 transition-colors shrink-0"
                      title={t("admin.batches.editZoneName")}
                    >
                      <Pencil size={10} />
                    </button>
                  </div>
                )}
                <div className="mt-1 text-[8px] text-muted-foreground uppercase tracking-widest">
                  {t("admin.batchDetail.questsCount", { count: String(batch.questCount) })}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
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
                  batchCode:
                    batches.find((batch) => batch.id === confirmDeleteId)?.name?.trim() ||
                    `ZONE-${confirmDeleteId.slice(-8).toUpperCase()}`,
                })}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 bg-black/80 border border-primary/30 hover:border-primary/50 text-primary font-black py-3 rounded-sm transition-all text-xs tracking-widest"
              >
                {t("admin.batches.cancelDelete")}
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
                    : t("admin.batches.deleteNow")}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
