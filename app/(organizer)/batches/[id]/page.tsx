"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBatch } from "@/lib/redis/batch-actions";
import { Batch } from "@/types/quest";
import { BatchDetail } from "@/components/admin/batch-detail";

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadBatch = async () => {
      setIsLoading(true);
      setError("");

      try {
        const result = await getBatch(batchId);

        if (!result.success) {
          setError(result.error || "Failed to load batch");
          return;
        }

        setBatch(result.data || null);
      } catch {
        setError("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    if (batchId) {
      loadBatch();
    }
  }, [batchId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-primary p-6">
        <div className="max-w-6xl mx-auto">
          <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
            <div className="flex items-center justify-center py-8">
              <div className="text-[10px] text-primary uppercase tracking-widest animate-pulse">
                LOADING BATCH DATA...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="min-h-screen bg-black text-primary p-6">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => router.push("/batches")}
            className="flex items-center gap-2 text-[10px] text-primary uppercase tracking-widest hover:text-primary/80 mb-6"
          >
            <ArrowLeft size={14} />
            BACK TO BATCHES
          </button>

          <div className="border-2 border-destructive/20 p-6 bg-black/50 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-[10px] text-destructive uppercase tracking-widest">
                [ERROR] {error || "Batch not found"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-primary p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push("/batches")}
          className="flex items-center gap-2 text-[10px] text-primary uppercase tracking-widest hover:text-primary/80 mb-6"
        >
          <ArrowLeft size={14} />
          BACK TO BATCHES
        </button>

        <BatchDetail batch={batch} onUpdate={setBatch} />
      </div>
    </div>
  );
}
