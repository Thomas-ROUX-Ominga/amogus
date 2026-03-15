"use client";

import { useState } from "react";
import { Printer, Check, X, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { Batch, Quest } from "@/types/quest";
import { updateQuestsLocations } from "@/lib/redis/batch-actions";
import { generateQuestPDF, downloadPDF } from "@/lib/utils/pdf-utils";
import { useAuthGuard } from "@/hooks/use-auth";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";

interface BatchDetailProps {
  batch: Batch;
  onUpdate: (batch: Batch) => void;
  className?: string;
}

export function BatchDetail({ batch, onUpdate, className }: BatchDetailProps) {
  const t = useTranslations();
  const authGuard = useAuthGuard(true); // Require organizer account
  
  const getDefaultQuestLocation = (index: number) =>
    `${t("admin.batchDetail.defaultLocation")} ${index + 1}`;
  const getDefaultSabotageLocation = (index: number) =>
    `${t("admin.batchDetail.defaultLocation")} ${batch.quests.length + index + 1}`;

  const [locations, setLocations] = useState<Record<string, string>>(
    () =>
      batch.quests.reduce((acc, quest, index) => {
        acc[quest.id] = quest.location?.trim() || getDefaultQuestLocation(index);
        return acc;
      }, {} as Record<string, string>),
  );
  const [sabotageLocations, setSabotageLocations] = useState({
    communications: batch.sabotages?.communications.location?.trim() || getDefaultSabotageLocation(0),
    lights: batch.sabotages?.lights?.location?.trim() || getDefaultSabotageLocation(1),
    reactorA: batch.sabotages?.reactor[0]?.location?.trim() || getDefaultSabotageLocation(2),
    reactorB: batch.sabotages?.reactor[1]?.location?.trim() || getDefaultSabotageLocation(3),
  });
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const handleStartEditingLocation = (quest: Quest, index: number) => {
    setEditingId(quest.id);
    setEditingValue(locations[quest.id] || getDefaultQuestLocation(index));
  };

  const handleCancelEditingLocation = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const handleConfirmEditingLocation = async (questId: string, index: number) => {
    const normalized = editingValue.trim() || getDefaultQuestLocation(index);
    const nextLocations = {
      ...locations,
      [questId]: normalized,
    };
    setLocations(nextLocations);
    await persistLocations(nextLocations, sabotageLocations);
    handleCancelEditingLocation();
  };

  const handleStartEditingSabotageLocation = (
    sabotageKey: keyof typeof sabotageLocations,
    index: number,
  ) => {
    setEditingId(`sabotage:${sabotageKey}`);
    setEditingValue(sabotageLocations[sabotageKey] || getDefaultSabotageLocation(index));
  };

  const handleConfirmEditingSabotageLocation = async (
    sabotageKey: keyof typeof sabotageLocations,
    index: number,
  ) => {
    const normalized = editingValue.trim() || getDefaultSabotageLocation(index);
    const nextSabotageLocations = {
      ...sabotageLocations,
      [sabotageKey]: normalized,
    };
    setSabotageLocations(nextSabotageLocations);
    await persistLocations(locations, nextSabotageLocations);
    handleCancelEditingLocation();
  };

  const persistLocations = async (
    nextLocations: Record<string, string>,
    nextSabotageLocations: typeof sabotageLocations,
  ) => {
    if (authGuard.isLoading) return;
    if (!authGuard.canProceed) {
      setError(authGuard.reason || t("admin.batchDetail.authRequired"));
      return;
    }

    setIsAutoSaving(true);
    setError("");

    try {
      const result = await updateQuestsLocations(batch.id, nextLocations, nextSabotageLocations);

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

      onUpdate(result.data!);
    } catch {
      setError(getLocalizedErrorMessage({ t, code: "ERR_SIGNAL_LOST" }));
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    setError("");

    try {
      const pdfBlob = await generateQuestPDF(batch.quests, batch.sabotages);
      downloadPDF(pdfBlob, `batch-${batch.id.slice(-8)}-quests.pdf`);
    } catch {
      setError(getLocalizedErrorMessage({ t, code: "ERR_SIGNAL_LOST" }));
    } finally {
      setIsGenerating(false);
    }
  };

  const getFormatLabel = (duration: Quest["duration"]) => {
    const formatMap: Record<Quest["duration"], string> = {
      short: t("admin.dashboard.short"),
      medium: t("admin.dashboard.medium"),
      long: t("admin.dashboard.long"),
    };
    return formatMap[duration];
  };

  const getQuestTypeLabel = (type: Quest["type"]) => {
    const typeKeyMap: Record<
      Quest["type"],
      | "common.questTypes.true-false"
      | "common.questTypes.qcm"
      | "common.questTypes.single-input"
      | "common.questTypes.number-input"
      | "common.questTypes.intrus"
      | "common.questTypes.mini-game"
    > = {
      "true-false": "common.questTypes.true-false",
      qcm: "common.questTypes.qcm",
      "single-input": "common.questTypes.single-input",
      "number-input": "common.questTypes.number-input",
      intrus: "common.questTypes.intrus",
      "mini-game": "common.questTypes.mini-game",
    };

    return t(typeKeyMap[type]);
  };

  const sabotageItems = [
    { key: "communications" as const, label: t("admin.batchDetail.sabotageCommunications"), offset: 0 },
    { key: "lights" as const, label: t("admin.batchDetail.sabotageLights"), offset: 1 },
    { key: "reactorA" as const, label: t("admin.batchDetail.sabotageReactorA"), offset: 2 },
    { key: "reactorB" as const, label: t("admin.batchDetail.sabotageReactorB"), offset: 3 },
  ];

  return (
    <div className={`h-full min-h-0 flex flex-col gap-4 ${className || ""}`}>
      {/* Header */}
      <div className="shrink-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
              {batch.name?.trim() || `ZONE-${batch.id.slice(-8).toUpperCase()}`}
            </h1>
          </div>

          <div className="w-full sm:w-auto">
            <button
              onClick={handleGeneratePDF}
              disabled={isGenerating}
              className="w-full sm:w-auto justify-center flex items-center gap-2 bg-primary text-primary-foreground border border-primary font-black py-3 px-6 rounded-sm transition-all hover:opacity-95 hover:shadow-[0_0_20px_hsl(var(--primary)/0.25)] text-xs tracking-widest"
            >
              <Printer size={14} />
              {isGenerating ? t("admin.batchDetail.generating") : t("admin.batchDetail.printQuests")}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {isAutoSaving && (
          <div className="mt-4 p-3 border border-primary/20 bg-primary/5 text-primary text-[10px] uppercase tracking-widest">
            {t("admin.batchDetail.saving")}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 border border-destructive/30 bg-destructive/10 text-destructive text-[10px] uppercase tracking-widest">
            [ERROR] {error}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Quest List */}
        <div className="xl:col-span-2 border-2 border-primary/20 p-4 sm:p-6 bg-black/50 backdrop-blur-sm flex flex-col min-h-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold uppercase tracking-wider text-primary">
              {t("admin.batchDetail.questLocations")}
            </h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">
              {t("admin.batchDetail.totalLabel")}: {batch.quests.length}
            </span>
          </div>

          <div className="inventory-scroll flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {batch.quests.map((quest, index) => (
              <div
                key={quest.id}
                className="flex items-center gap-3 p-3 sm:p-4 border border-primary/10 bg-black/30 hover:border-primary/30 transition-all"
              >
                <div className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center bg-primary/5 shrink-0">
                  <span className="text-primary text-xs font-bold">{index + 1}</span>
                </div>

                <div className="min-w-0 w-full">
                  {editingId === quest.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value.slice(0, 50))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                              void handleConfirmEditingLocation(quest.id, index);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            handleCancelEditingLocation();
                          }
                        }}
                        placeholder={t("admin.batchDetail.enterLocation")}
                        className="flex-1 h-8 bg-black border border-primary/40 text-primary text-xs px-2 focus:outline-none focus:border-primary/60 placeholder:text-muted-foreground/50"
                      />
                      <button
                        type="button"
                          onClick={() => void handleConfirmEditingLocation(quest.id, index)}
                        className="p-1.5 border border-primary/40 text-primary hover:bg-primary/10 transition-all"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditingLocation}
                        className="p-1.5 border border-primary/25 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-[10px] font-mono text-primary uppercase tracking-widest truncate">
                          {locations[quest.id] || getDefaultQuestLocation(index)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartEditingLocation(quest, index)}
                        className="p-1 border border-primary/25 text-primary/70 hover:text-primary hover:border-primary/45 hover:bg-primary/10 transition-colors shrink-0"
                        title={t("admin.batchDetail.editLocation")}
                      >
                        <Pencil size={10} />
                      </button>
                    </div>
                  )}
                  <div className="text-[8px] text-muted-foreground uppercase tracking-widest mt-1">
                    {getQuestTypeLabel(quest.type)} - {getFormatLabel(quest.duration)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {batch.sabotages && (
          <div className="border-2 border-primary/20 p-4 sm:p-6 bg-black/50 backdrop-blur-sm flex flex-col min-h-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold uppercase tracking-wider text-primary">
                {t("admin.batchDetail.sabotageLocations")}
              </h2>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">
                {t("admin.batchDetail.totalLabel")}: {sabotageItems.length}
              </span>
            </div>

            <div className="inventory-scroll flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
              {sabotageItems.map((sabotage) => (
                <div key={sabotage.key} className="p-3 sm:p-4 border border-primary/10 bg-black/30 hover:border-primary/30 transition-all">
                  {editingId === `sabotage:${sabotage.key}` ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value.slice(0, 50))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleConfirmEditingSabotageLocation(sabotage.key, sabotage.offset);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            handleCancelEditingLocation();
                          }
                        }}
                        placeholder={t("admin.batchDetail.enterLocation")}
                        className="flex-1 h-8 bg-black border border-primary/40 text-primary text-xs px-2 focus:outline-none focus:border-primary/60 placeholder:text-muted-foreground/50"
                      />
                      <button
                        type="button"
                        onClick={() => void handleConfirmEditingSabotageLocation(sabotage.key, sabotage.offset)}
                        className="p-1.5 border border-primary/40 text-primary hover:bg-primary/10 transition-all"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditingLocation}
                        className="p-1.5 border border-primary/25 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-[10px] font-mono text-primary uppercase tracking-widest truncate">
                        {sabotageLocations[sabotage.key] || getDefaultSabotageLocation(sabotage.offset)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartEditingSabotageLocation(sabotage.key, sabotage.offset)}
                        className="p-1 border border-primary/25 text-primary/70 hover:text-primary hover:border-primary/45 hover:bg-primary/10 transition-colors shrink-0"
                        title={t("admin.batchDetail.editLocation")}
                      >
                        <Pencil size={10} />
                      </button>
                    </div>
                  )}
                  <div className="text-[8px] text-muted-foreground uppercase tracking-widest mt-1">
                    {sabotage.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
