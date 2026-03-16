"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createGame, CreateGameInput } from "@/lib/redis/actions";
import { getAllBatches, getBatch } from "@/lib/redis/batch-actions";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";
import { NumberStepperInput } from "@/components/common/number-stepper-input";
import { BatchListItem } from "@/types/quest";

export default function CreateGamePage() {
  const t = useTranslations();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedBatchLimits, setSelectedBatchLimits] = useState<{
    short: number;
    medium: number;
    long: number;
  } | null>(null);
  const [batchQuery, setBatchQuery] = useState("");
  const [isBatchMenuOpen, setIsBatchMenuOpen] = useState(false);
  const [highlightedBatchIndex, setHighlightedBatchIndex] = useState(0);
  const [questsPerPlayer, setQuestsPerPlayer] = useState({
    short: 1,
    medium: 1,
    long: 1,
  });
  const [impostorMode, setImpostorMode] = useState<"auto" | "manual">("auto");
  const [manualImpostorCount, setManualImpostorCount] = useState(1);
  const totalQuests = questsPerPlayer.short + questsPerPlayer.medium + questsPerPlayer.long;
  const isValidTotal = totalQuests >= 1;
  const isBatchLimitsReady = !selectedBatch || selectedBatchLimits !== null;
  const minimumPlayersForLaunch =
    impostorMode === "manual"
      ? Math.max(1, manualImpostorCount) * 2 + 1
      : 3;
  const [error, setError] = useState("");
  const batchAutocompleteRef = useRef<HTMLDivElement>(null);

  // Load batches on component mount
  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    const onDocumentClick = (event: globalThis.MouseEvent) => {
      if (!batchAutocompleteRef.current) return;
      if (!batchAutocompleteRef.current.contains(event.target as globalThis.Node)) {
        setIsBatchMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const getBatchDisplayName = (batch: BatchListItem) =>
    batch.name?.trim() || `ZONE-${batch.id.slice(-8).toUpperCase()}`;

  const filteredBatches = useMemo(() => {
    const normalizedQuery = batchQuery.trim().toLowerCase();
    if (!normalizedQuery) return batches;

    return batches.filter((batch) => {
      const zoneName = (batch.name || "").toLowerCase();
      const batchId = batch.id.toLowerCase();
      const searchableText = `${batch.name || ""} ${batch.id} ${batch.questCount}`.toLowerCase();
      return (
        zoneName.includes(normalizedQuery) ||
        batchId.includes(normalizedQuery) ||
        searchableText.includes(normalizedQuery)
      );
    });
  }, [batchQuery, batches]);

  const selectBatch = (batch: BatchListItem) => {
    setSelectedBatch(batch.id);
    setBatchQuery(getBatchDisplayName(batch));
    setHighlightedBatchIndex(0);
    setIsBatchMenuOpen(false);
  };

  const clearBatchSelection = () => {
    setSelectedBatch("");
    setSelectedBatchLimits(null);
    setBatchQuery("");
    setHighlightedBatchIndex(0);
    setIsBatchMenuOpen(false);
  };

  const clampByBatchLimit = (duration: "short" | "medium" | "long", value: number) => {
    const maxByDuration = selectedBatchLimits?.[duration];
    const normalizedValue = Math.max(0, Number.isNaN(value) ? 0 : value);
    if (typeof maxByDuration !== "number") {
      return normalizedValue;
    }
    return Math.min(normalizedValue, maxByDuration);
  };

  const updateQuestDuration = (duration: "short" | "medium" | "long", nextValue: number) => {
    const clamped = clampByBatchLimit(duration, nextValue);
    setQuestsPerPlayer((prev) => ({
      ...prev,
      [duration]: clamped,
    }));
  };

  const loadBatches = async () => {
    try {
      const response = await getAllBatches();
      if (response.success && response.data) {
        setBatches(response.data);
      }
    } catch (error) {
      console.error("Failed to load batches:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let shouldResetCreatingState = true;
    setIsCreating(true);
    setError("");

    try {
      if (!selectedBatch) {
        setError(t("organizer.gamesCreate.errors.batchRequired"));
        return;
      }

      // Validate minimum quests per player
      const totalQuests = questsPerPlayer.short + questsPerPlayer.medium + questsPerPlayer.long;
      if (totalQuests < 1) {
        setError(t("organizer.gamesCreate.errors.minimumThree"));
        return;
      }

      if (impostorMode === "manual" && manualImpostorCount < 1) {
        setError(t("organizer.gamesCreate.errors.manualImpostorMin"));
        return;
      }

      if (
        selectedBatchLimits &&
        (questsPerPlayer.short > selectedBatchLimits.short ||
          questsPerPlayer.medium > selectedBatchLimits.medium ||
          questsPerPlayer.long > selectedBatchLimits.long)
      ) {
        setError(
          t("organizer.gamesCreate.errors.durationLimitExceeded", {
            short: String(selectedBatchLimits.short),
            medium: String(selectedBatchLimits.medium),
            long: String(selectedBatchLimits.long),
          }),
        );
        return;
      }

      const input: CreateGameInput = {
        batchId: selectedBatch || undefined,
        questsPerPlayer,
        impostorMode,
        manualImpostorCount: impostorMode === "manual" ? manualImpostorCount : undefined,
        enforceDurationLimits: true,
      };

      const response = await createGame(input);
      
      if (response.success && response.data) {
        shouldResetCreatingState = false;
        router.push(`/game/${response.data}`);
        return;
      } else {
        setError(
          getLocalizedErrorMessage({
            t,
            code: response.code,
            fallback: response.error,
          }),
        );
      }
    } catch (error) {
      console.error("Failed to create game:", error);
      setError(getLocalizedErrorMessage({ t, code: "ERR_SIGNAL_LOST" }));
    } finally {
      if (shouldResetCreatingState) {
        setIsCreating(false);
      }
    }
  };

  useEffect(() => {
    const loadSelectedBatchLimits = async () => {
      let nextBatchLimits: { short: number; medium: number; long: number } | null = null;

      if (selectedBatch) {
        const response = await getBatch(selectedBatch);
        if (response.success && response.data) {
          const shortCount = response.data.quests.filter((q) => q.duration === "short").length;
          const mediumCount = response.data.quests.filter((q) => q.duration === "medium").length;
          const longCount = response.data.quests.filter((q) => q.duration === "long").length;

          nextBatchLimits = {
            short: shortCount,
            medium: mediumCount,
            long: longCount,
          };
        }
      }

      setSelectedBatchLimits(nextBatchLimits);
    };

    void loadSelectedBatchLimits();
  }, [selectedBatch]);

  useEffect(() => {
    if (!selectedBatchLimits) return;
    setQuestsPerPlayer((prev) => ({
      short: Math.min(prev.short, selectedBatchLimits.short),
      medium: Math.min(prev.medium, selectedBatchLimits.medium),
      long: Math.min(prev.long, selectedBatchLimits.long),
    }));
  }, [selectedBatchLimits]);

  return (
    <div className="h-full min-h-0 max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 pt-16 pb-4 sm:pt-20 sm:pb-6 flex flex-col overflow-y-auto">
      <div className="mb-3 sm:mb-6">
        <h1 className="text-lg sm:text-2xl font-black uppercase tracking-[0.12em] sm:tracking-[0.2em] text-primary font-orbitron">
          {t("organizer.gamesCreate.title")}
        </h1>
        <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-[0.14em] sm:tracking-widest mt-1">
          {t("organizer.gamesCreate.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="border border-primary/20 bg-black/30 p-2.5 sm:p-6 flex flex-col gap-2.5 sm:gap-4">
        <div className="pr-1 space-y-3 sm:space-y-4">
          {/* Batch Selection */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
              {t("organizer.gamesCreate.batchSelectionTitle")}
            </h2>

            <div className="space-y-2">
              <div className="relative" ref={batchAutocompleteRef}>
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary/70" />
                  <input
                    type="text"
                    value={batchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBatchQuery(value);
                      setHighlightedBatchIndex(0);
                      setIsBatchMenuOpen(true);
                      setSelectedBatch("");
                      setSelectedBatchLimits(null);
                    }}
                    onFocus={() => setIsBatchMenuOpen(true)}
                    onKeyDown={(e) => {
                      if (!isBatchMenuOpen) {
                        if (e.key === "ArrowDown" && filteredBatches.length > 0) {
                          setIsBatchMenuOpen(true);
                        }
                        return;
                      }

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightedBatchIndex((prev) =>
                          Math.min(prev + 1, Math.max(filteredBatches.length - 1, 0)),
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightedBatchIndex((prev) => Math.max(prev - 1, 0));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        const highlighted = filteredBatches[highlightedBatchIndex];
                        if (highlighted) {
                          selectBatch(highlighted);
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setIsBatchMenuOpen(false);
                      }
                    }}
                    placeholder={t("organizer.gamesCreate.batchSelectPlaceholder")}
                    className="w-full h-10 sm:h-12 bg-black border border-primary/35 hover:border-primary/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/35 text-foreground pl-10 pr-10 transition-all"
                  />
                  {batchQuery && (
                    <button
                      type="button"
                      onClick={clearBatchSelection}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 border border-primary/25 text-primary/80 hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-all inline-flex items-center justify-center"
                      aria-label={t("common.actions.cancel")}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {isBatchMenuOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 border border-primary/35 bg-black shadow-[0_10px_28px_rgba(0,0,0,0.55)] max-h-52 overflow-y-auto inventory-scroll">
                    {filteredBatches.length === 0 ? (
                      <div className="px-3 py-3 space-y-2">
                        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                          {t("admin.batches.noBatchesFound")}
                        </p>
                        {batches.length === 0 && (
                          <Link
                            href="/batches"
                            className="inline-flex h-8 items-center px-3 border border-primary/40 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10 hover:border-primary/60 transition-all"
                          >
                            {t("organizer.gamesCreate.createZoneButton")}
                          </Link>
                        )}
                      </div>
                    ) : (
                      filteredBatches.map((batch, index) => {
                        const isHighlighted = index === highlightedBatchIndex;
                        return (
                          <button
                            key={batch.id}
                            type="button"
                            onMouseEnter={() => setHighlightedBatchIndex(index)}
                            onClick={() => selectBatch(batch)}
                            className={`w-full text-left px-3 py-2 border-b border-primary/10 last:border-b-0 transition-colors ${
                              isHighlighted
                                ? "bg-primary/15 text-foreground"
                                : "bg-transparent text-foreground/90 hover:bg-primary/10"
                            }`}
                          >
                            <div className="text-[11px] uppercase tracking-wider font-semibold">
                              {getBatchDisplayName(batch)}
                            </div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                              {t("admin.batchDetail.questsCount", {
                                count: String(batch.questCount),
                              })}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {selectedBatch && (
                <p className="text-[9px] text-primary/60 uppercase tracking-wider">
                  {t("organizer.gamesCreate.selectedBatchHint")}
                </p>
              )}
            </div>
          </section>

          {/* Quest Distribution */}
          <section className="pt-3 sm:pt-4 border-t border-primary/15">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
              {t("organizer.gamesCreate.questsPerPlayer")}
            </h2>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div>
                <label htmlFor="short-quests" className="text-[9px] sm:text-[10px] text-primary/60 uppercase tracking-widest block mb-1.5">
                  {t("organizer.gamesCreate.shortQuests")}
                </label>
                <NumberStepperInput
                  id="short-quests"
                  value={questsPerPlayer.short}
                  min={0}
                  max={selectedBatchLimits?.short}
                  onChange={(value) => updateQuestDuration("short", value)}
                  incrementAriaLabel="Increase short quests"
                  decrementAriaLabel="Decrease short quests"
                />
                {selectedBatchLimits && (
                  <p className="mt-1.5 text-[8px] uppercase tracking-widest text-muted-foreground">
                    Max: {selectedBatchLimits.short}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="medium-quests" className="text-[9px] sm:text-[10px] text-primary/60 uppercase tracking-widest block mb-1.5">
                  {t("organizer.gamesCreate.mediumQuests")}
                </label>
                <NumberStepperInput
                  id="medium-quests"
                  value={questsPerPlayer.medium}
                  min={0}
                  max={selectedBatchLimits?.medium}
                  onChange={(value) => updateQuestDuration("medium", value)}
                  incrementAriaLabel="Increase medium quests"
                  decrementAriaLabel="Decrease medium quests"
                />
                {selectedBatchLimits && (
                  <p className="mt-1.5 text-[8px] uppercase tracking-widest text-muted-foreground">
                    Max: {selectedBatchLimits.medium}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="long-quests" className="text-[9px] sm:text-[10px] text-primary/60 uppercase tracking-widest block mb-1.5">
                  {t("organizer.gamesCreate.longQuests")}
                </label>
                <NumberStepperInput
                  id="long-quests"
                  value={questsPerPlayer.long}
                  min={0}
                  max={selectedBatchLimits?.long}
                  onChange={(value) => updateQuestDuration("long", value)}
                  incrementAriaLabel="Increase long quests"
                  decrementAriaLabel="Decrease long quests"
                />
                {selectedBatchLimits && (
                  <p className="mt-1.5 text-[8px] uppercase tracking-widest text-muted-foreground">
                    Max: {selectedBatchLimits.long}
                  </p>
                )}
              </div>
            </div>
            
            <p className="text-[9px] sm:text-[10px] text-primary/60 mt-3 uppercase tracking-wider">
              {t("organizer.gamesCreate.totalPerPlayer", {
                count: String(
                  questsPerPlayer.short +
                    questsPerPlayer.medium +
                    questsPerPlayer.long,
                ),
              })}
              {questsPerPlayer.short + questsPerPlayer.medium + questsPerPlayer.long < 1 && (
                <span className="text-destructive block mt-1 uppercase tracking-wider">
                  {t("organizer.gamesCreate.minimumRequired")}
                </span>
              )}
            </p>
          </section>

          {/* Impostor Configuration */}
          <section className="pt-3 sm:pt-4 border-t border-primary/15">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
              {t("organizer.gamesCreate.impostorConfigTitle")}
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setImpostorMode("auto")}
                className={`h-10 sm:h-12 px-3 sm:px-4 border text-[10px] sm:text-xs uppercase tracking-widest transition-all ${
                  impostorMode === "auto"
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-primary/25 bg-black text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {t("organizer.gamesCreate.impostorModeAuto")}
              </button>
              <button
                type="button"
                onClick={() => setImpostorMode("manual")}
                className={`h-10 sm:h-12 px-3 sm:px-4 border text-[10px] sm:text-xs uppercase tracking-widest transition-all ${
                  impostorMode === "manual"
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-primary/25 bg-black text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {t("organizer.gamesCreate.impostorModeManual")}
              </button>
            </div>

            {impostorMode === "manual" && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <label htmlFor="manual-impostors" className="text-[9px] sm:text-[10px] text-primary/60 uppercase tracking-widest">
                  {t("organizer.gamesCreate.manualImpostorCountLabel")}
                </label>
                <NumberStepperInput
                  id="manual-impostors"
                  className="w-[120px] sm:w-[160px] shrink-0"
                  value={manualImpostorCount}
                  min={1}
                  max={10}
                  onChange={(value) => setManualImpostorCount(value)}
                  incrementAriaLabel="Increase impostor count"
                  decrementAriaLabel="Decrease impostor count"
                />
              </div>
            )}

            <p className="mt-3 text-[9px] sm:text-[10px] text-primary/60 uppercase tracking-wider">
              {impostorMode === "auto"
                ? t("organizer.gamesCreate.autoImpostorRule")
                : t("organizer.gamesCreate.manualImpostorRule", {
                    impostors: String(manualImpostorCount),
                    minPlayers: String(minimumPlayersForLaunch),
                  })}
            </p>
          </section>
        </div>

        {/* Messages */}
        {error && (
          <div className="border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-destructive text-[10px] uppercase tracking-wider">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isCreating || !isValidTotal || !selectedBatch || !isBatchLimitsReady}
          className="w-full bg-primary text-primary-foreground border border-primary font-black py-3 sm:py-4 transition-all hover:opacity-95 hover:shadow-[0_0_20px_hsl(var(--primary)/0.25)] flex items-center justify-center gap-2 group"
        >
          <Plus size={16} />
          <span className="tracking-[0.2em] sm:tracking-[0.35em] uppercase text-xs sm:text-sm">
            {isCreating
              ? t("organizer.gamesCreate.creatingGame")
              : t("organizer.gamesCreate.createGameSession")}
          </span>
        </button>
      </form>
    </div>
  );
}
