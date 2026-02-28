"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Save, Edit2, Check, Play, Lock } from "lucide-react";
import { Batch, Quest } from "@/types/quest";
import { updateQuestsLocations } from "@/lib/redis/batch-actions";
import { createGame } from "@/lib/redis/actions";
import { generateQuestPDF, downloadPDF } from "@/lib/utils/pdf-utils";
import { useAuthGuard } from "@/hooks/use-auth";

interface BatchDetailProps {
  batch: Batch;
  onUpdate: (batch: Batch) => void;
}

export function BatchDetail({ batch, onUpdate }: BatchDetailProps) {
  const router = useRouter();
  const authGuard = useAuthGuard(true); // Require organizer account
  
  const [locations, setLocations] = useState<Record<string, string>>(
    batch.quests.reduce((acc, quest) => {
      acc[quest.id] = quest.location || "";
      return acc;
    }, {} as Record<string, string>)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Story 11.3: Game Settings from Batch - Quest distribution state
  const [questDistribution, setQuestDistribution] = useState({
    short: 4,
    medium: 2,
    long: 1
  });

  const handleLocationChange = (questId: string, value: string) => {
    setLocations((prev) => ({
      ...prev,
      [questId]: value,
    }));
  };

  // Story 11.3: Game Settings from Batch - Quest distribution handlers
  const handleQuestDistributionChange = (duration: 'short' | 'medium' | 'long', value: string) => {
    const numValue = parseInt(value) || 0;
    setQuestDistribution(prev => ({
      ...prev,
      [duration]: Math.max(0, numValue)
    }));
  };

  const handleSaveLocations = async () => {
    if (authGuard.isLoading) return;
    if (!authGuard.canProceed) {
      setError(authGuard.reason || "Authentication required");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await updateQuestsLocations(batch.id, locations);

      if (!result.success) {
        setError(result.error || "Failed to save locations");
        return;
      }

      onUpdate(result.data!);
      setSuccessMessage("Locations saved successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    setError("");

    try {
      const pdfBlob = await generateQuestPDF(batch.quests);
      downloadPDF(pdfBlob, `batch-${batch.id.slice(-8)}-quests.pdf`);
    } catch {
      setError("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLaunchGame = async () => {
    if (authGuard.isLoading) return;
    if (!authGuard.canProceed) {
      setError(authGuard.reason || "Organizer authentication required to launch games");
      return;
    }

    setIsLaunching(true);
    setError("");

    // Story 11.3: Game Settings from Batch - Validate quest distribution
    const totalQuests = questDistribution.short + questDistribution.medium + questDistribution.long;
    if (totalQuests < 1) {
      setError("At least 1 quest total must be selected");
      setIsLaunching(false);
      return;
    }

    if (totalQuests > batch.questCount) {
      setError(`Cannot assign ${totalQuests} quests per player. Only ${batch.questCount} quests available in batch.`);
      setIsLaunching(false);
      return;
    }

    try {
      // Story 11.3: Game Settings from Batch - Pass quest distribution to createGame
      const result = await createGame({ 
        batchId: batch.id,
        questsPerPlayer: questDistribution
      });

      if (!result.success) {
        setError(result.error || "Failed to launch game");
        return;
      }

      router.push(`/game/${result.data}`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLaunching(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const getFormatLabel = (duration: Quest["duration"]) => {
    const formatMap = {
      short: "S",
      medium: "M",
      long: "L",
    };
    return formatMap[duration];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider text-primary mb-2">
              BATCH-{batch.id.slice(-8).toUpperCase()}
            </h1>
            <div className="flex items-center gap-4 text-[8px] text-muted-foreground uppercase tracking-widest">
              <span>{batch.questCount} QUESTS</span>
              <span>•</span>
              <span>CREATED: {formatDate(batch.createdAt)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            {/* Authentication Status - Only show if definitely not authorized and not loading */}
            {!authGuard.isLoading && !authGuard.canProceed && (
              <div className="flex items-center gap-2 px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive">
                <Lock size={14} />
                <span className="text-xs font-black tracking-widest uppercase">
                  {authGuard.reason || "Authentication Required"}
                </span>
              </div>
            )}

            <button
              onClick={handleLaunchGame}
              disabled={isLaunching || authGuard.isLoading || !authGuard.canProceed}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 px-6 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs tracking-widest animate-pulse hover:animate-none"
            >
              <Play size={14} />
              {isLaunching ? "INITIALIZING..." : (authGuard.isLoading ? "CHECKING AUTH..." : "LAUNCH MISSION")}
            </button>

            <button
              onClick={handleSaveLocations}
              disabled={isSaving || authGuard.isLoading || !authGuard.canProceed}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-black font-black py-3 px-6 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs tracking-widest"
            >
              <Save size={14} />
              {isSaving ? "SAVING..." : "SAVE LOCATIONS"}
            </button>

            <button
              onClick={handleGeneratePDF}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-black/80 border border-primary/30 hover:border-primary/50 text-primary font-black py-3 px-6 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs tracking-widest"
            >
              <FileDown size={14} />
              {isGenerating ? "GENERATING..." : "GENERATE PDF"}
            </button>
          </div>
        </div>

        {/* Story 11.3: Game Settings from Batch - Quest Distribution Settings */}
        <div className="border border-primary/20 bg-black/30 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
            QUEST DISTRIBUTION SETTINGS
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[8px] text-muted-foreground uppercase tracking-widest mb-1">
                SHORT QUESTS
              </label>
              <input
                type="number"
                min="0"
                max={batch.questCount}
                value={questDistribution.short}
                onChange={(e) => handleQuestDistributionChange('short', e.target.value)}
                className="w-full bg-black/50 border border-primary/30 text-primary text-xs px-3 py-2 focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-[8px] text-muted-foreground uppercase tracking-widest mb-1">
                MEDIUM QUESTS
              </label>
              <input
                type="number"
                min="0"
                max={batch.questCount}
                value={questDistribution.medium}
                onChange={(e) => handleQuestDistributionChange('medium', e.target.value)}
                className="w-full bg-black/50 border border-primary/30 text-primary text-xs px-3 py-2 focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-[8px] text-muted-foreground uppercase tracking-widest mb-1">
                LONG QUESTS
              </label>
              <input
                type="number"
                min="0"
                max={batch.questCount}
                value={questDistribution.long}
                onChange={(e) => handleQuestDistributionChange('long', e.target.value)}
                className="w-full bg-black/50 border border-primary/30 text-primary text-xs px-3 py-2 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
          <div className={`mt-2 text-[8px] uppercase tracking-widest ${
            questDistribution.short + questDistribution.medium + questDistribution.long > batch.questCount 
              ? "text-destructive font-bold animate-pulse" 
              : "text-muted-foreground"
          }`}>
            TOTAL: {questDistribution.short + questDistribution.medium + questDistribution.long} / {batch.questCount} QUESTS PER PLAYER
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mt-4 p-3 border border-destructive/30 bg-destructive/10 text-destructive text-[10px] uppercase tracking-widest">
            [ERROR] {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 border border-primary/30 bg-primary/10 text-primary text-[10px] uppercase tracking-widest">
            ✓ {successMessage}
          </div>
        )}
      </div>

      {/* Quest List */}
      <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
        <h2 className="text-lg font-bold uppercase tracking-wider text-primary mb-6">
          Quest Locations
        </h2>

        <div className="space-y-3">
          {batch.quests.map((quest, index) => (
            <div
              key={quest.id}
              className="flex items-center gap-4 p-4 border border-primary/10 bg-black/30 hover:border-primary/30 transition-all"
            >
              {/* Quest Number & Format */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center bg-primary/5">
                  <span className="text-primary text-xs font-bold">
                    {index + 1}
                  </span>
                </div>
                <div className="w-8 h-8 rounded border border-primary/30 flex items-center justify-center bg-primary/5">
                  <span className="text-primary text-[10px] font-bold">
                    {getFormatLabel(quest.duration)}
                  </span>
                </div>
              </div>

              {/* Quest Info */}
              <div className="flex-1">
                <div className="text-[10px] font-mono text-primary uppercase tracking-widest">
                  {quest.id}
                </div>
                <div className="text-[8px] text-muted-foreground uppercase tracking-widest mt-1">
                  {quest.type} • {quest.duration}
                </div>
              </div>

              {/* Location Input */}
              <div className="flex items-center gap-2 flex-1">
                {editingId === quest.id ? (
                  <>
                    <input
                      type="text"
                      value={locations[quest.id] || ""}
                      onChange={(e) =>
                        handleLocationChange(quest.id, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setEditingId(null);
                        }
                      }}
                      placeholder="Enter location..."
                      className="flex-1 bg-black/50 border border-primary/30 text-primary text-xs px-3 py-2 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
                      autoFocus
                    />
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/50 transition-all"
                    >
                      <Check size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 text-xs text-primary px-3 py-2 border border-primary/10 bg-black/20">
                      {locations[quest.id] || (
                        <span className="text-muted-foreground/50">
                          No location set
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingId(quest.id)}
                      className="p-2 text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/50 transition-all"
                      title="Edit location"
                    >
                      <Edit2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
