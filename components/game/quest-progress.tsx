"use client";

import { PlayerRole } from "@/types/game";
import { QuestList } from "./quest-list";
import { useGameStore } from "@/lib/store/game-store";

interface QuestProgressProps {
    role: PlayerRole;
    completed: number;
    total: number;
    isLoading?: boolean;
}

export function QuestProgress({ role, completed, total, isLoading = false }: QuestProgressProps) {
    const { getImpostorQuestData, impostorQuestsInitialized } = useGameStore();

    // For impostors, show quest list if initialized, otherwise show loading
    if (role === "IMPOSTOR") {
        if (!impostorQuestsInitialized) {
            return (
                <div className="p-4 border border-primary/20 bg-black/30 space-y-3">
                    <div className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani">
                        Progression des quêtes
                    </div>
                    <div className="animate-pulse space-y-2">
                        <div className="h-2 bg-white/10 rounded w-full"></div>
                        <div className="h-3 bg-white/5 rounded w-3/4"></div>
                        <div className="h-3 bg-white/5 rounded w-1/2"></div>
                    </div>
                </div>
            );
        }

        const impostorQuestData = getImpostorQuestData();
        
        return (
            <div className="p-4 border border-primary/20 bg-black/30 space-y-4">
                <div className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani">
                    Progression des quêtes
                </div>
                
                {/* Progress Bar */}
                <div className="w-full h-2 bg-white/10 overflow-hidden">
                    <div
                        className={`h-full bg-[#2DA44E] transition-all duration-500 ${
                            isLoading ? "animate-pulse" : ""
                        }`}
                        style={{ width: `${impostorQuestData.percentage}%` }}
                        role="progressbar"
                        aria-valuenow={impostorQuestData.completed}
                        aria-valuemin={0}
                        aria-valuemax={impostorQuestData.total}
                        aria-busy={isLoading}
                    />
                </div>
                
                {/* Progress Text */}
                <div className="text-sm text-muted-foreground font-rajdhani tracking-wide">
                    {isLoading ? (
                        <span className="animate-pulse">Chargement...</span>
                    ) : impostorQuestData.total > 0 ? (
                        `${impostorQuestData.completed}/${impostorQuestData.total} quêtes accomplies`
                    ) : (
                        "En attente de missions..."
                    )}
                </div>

                {/* Quest List */}
                <QuestList quests={impostorQuestData.quests} isLoading={isLoading} />
            </div>
        );
    }

    // Crewmate behavior - show quest list if there are completed quests
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const showQuestList = completed > 0; // Show quest list when crewmate has completed quests
    
    // Create mock quest list for crewmates based on completed count
    const crewmateQuests = Array.from({ length: Math.min(completed, total) }, (_, index) => ({
        id: `crewmate-quest-${index}`,
        type: 'qcm' as const,
        duration: index % 3 === 0 ? 'short' as const : index % 3 === 1 ? 'medium' as const : 'long' as const,
        location: `Location ${index + 1}`,
        completed: true
    }));

    return (
        <div className="p-4 border border-primary/20 bg-black/30 space-y-4">
            <div className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani">
                Progression des quêtes
            </div>
            <div className="w-full h-2 bg-white/10 overflow-hidden">
                <div
                    className={`h-full bg-[#2DA44E] transition-all duration-500 ${
                        isLoading ? "animate-pulse" : ""
                    }`}
                    style={{ width: `${percentage}%` }}
                    role="progressbar"
                    aria-valuenow={completed}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-busy={isLoading}
                />
            </div>
            <div className="text-sm text-muted-foreground font-rajdhani tracking-wide">
                {isLoading ? (
                    <span className="animate-pulse">Chargement...</span>
                ) : total > 0 ? (
                    `${completed}/${total} quêtes accomplies`
                ) : (
                    "En attente de missions..."
                )}
            </div>
            
            {/* Quest List for crewmates - show when they have completed quests */}
            {showQuestList && (
                <QuestList quests={crewmateQuests} isLoading={isLoading} />
            )}
        </div>
    );
}
