"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { getBatch } from "@/lib/redis/batch-actions";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";
import { Batch } from "@/types/quest";
import { BatchDetail } from "@/components/admin/batch-detail";

export default function BatchDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  const [viewState, setViewState] = useState<{
    batch: Batch | null;
    isLoading: boolean;
    error: string;
  }>({
    batch: null,
    isLoading: true,
    error: "",
  });

  const { batch, isLoading, error } = viewState;

  useEffect(() => {
    let cancelled = false;

    const loadBatch = async () => {
      setViewState((prev) => ({ ...prev, isLoading: true, error: "" }));

      try {
        const result = await getBatch(batchId);
        if (cancelled) return;

        if (!result.success) {
          setViewState({
            batch: null,
            isLoading: false,
            error: getLocalizedErrorMessage({
              t,
              code: result.code,
              fallback: result.error,
            }),
          });
          return;
        }

        setViewState({
          batch: result.data || null,
          isLoading: false,
          error: "",
        });
      } catch {
        if (cancelled) return;
        setViewState({
          batch: null,
          isLoading: false,
          error: getLocalizedErrorMessage({ t, code: "ERR_SIGNAL_LOST" }),
        });
      }
    };

    if (batchId) {
      void loadBatch();
    }

    return () => {
      cancelled = true;
    };
  }, [batchId, t]);

  if (isLoading) {
    return (
      <div className="h-full overflow-hidden bg-black text-primary px-4 sm:px-6 lg:px-8 pt-16 pb-4 sm:pt-20 sm:pb-6">
        <div className="max-w-7xl h-full min-h-0 mx-auto">
          <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
            <div className="flex items-center justify-center py-8">
              <div className="text-[10px] text-primary uppercase tracking-widest animate-pulse">
                {t("admin.batches.loadBatchData")}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="h-full overflow-hidden bg-black text-primary px-4 sm:px-6 lg:px-8 pt-16 pb-4 sm:pt-20 sm:pb-6">
        <div className="max-w-7xl h-full min-h-0 mx-auto">
          <button
            onClick={() => router.push("/batches")}
            className="flex items-center gap-2 text-[10px] text-primary uppercase tracking-widest hover:text-primary/80 mb-6"
          >
            <ArrowLeft size={14} />
            {t("admin.batches.backToBatches")}
          </button>

          <div className="border-2 border-destructive/20 p-6 bg-black/50 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-[10px] text-destructive uppercase tracking-widest">
                [ERROR] {error || t("errors.codes.ERR_NOT_FOUND")}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-black text-primary px-4 sm:px-6 lg:px-8 pt-16 pb-4 sm:pt-20 sm:pb-6">
      <div className="max-w-7xl h-full min-h-0 mx-auto flex flex-col">
        <button
          onClick={() => router.push("/batches")}
          className="shrink-0 flex items-center gap-2 text-[10px] text-primary uppercase tracking-widest hover:text-primary/80 mb-4"
        >
          <ArrowLeft size={14} />
          {t("admin.batches.backToBatches")}
        </button>

        <BatchDetail
          batch={batch}
          onUpdate={(nextBatch) => setViewState((prev) => ({ ...prev, batch: nextBatch }))}
          className="flex-1 min-h-0"
        />
      </div>
    </div>
  );
}
