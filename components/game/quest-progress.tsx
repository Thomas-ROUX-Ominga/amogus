"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PlayerRole } from "@/types/game";
import { QuestList } from "./quest-list";
import { useGameStore } from "@/lib/store/game-store";
import { getBatch } from "@/lib/redis/batch-actions";
import { Quest } from "@/types/quest";

interface QuestProgressProps {
    role: PlayerRole;
    completed: number;
    total: number;
    isLoading?: boolean;
    assignedQuests?: string[];
    completedQuests?: string[];
    batchId?: string;
}

const EMPTY_ARRAY: string[] = [];

export function QuestProgress({ 
    role, 
    completed, 
    total, 
    isLoading = false,
    assignedQuests = EMPTY_ARRAY,
    completedQuests = EMPTY_ARRAY,
    batchId
}: QuestProgressProps) {
    const t = useTranslations();
    const { getImpostorQuestData, impostorQuestsInitialized, gameQuests = [], fetchGameQuests = async () => {}, isGameQuestsLoading, gameState } = useGameStore();

    // For impostors, show quest list if initialized, otherwise show loading
    if (role === "IMPOSTOR") {
        if (!impostorQuestsInitialized) {
            return (
                <div className="p-4 border border-primary/20 bg-black/30 space-y-3">
                    <div className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani">
                        {t("game.questProgress.questsProgress")}
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
                    {t("game.questProgress.questsProgress")}
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
                        <span className="animate-pulse">{t("game.questProgress.loading")}</span>
                    ) : impostorQuestData.total > 0 ? (
                        t("game.questProgress.completedOutOf", {
                            completed: impostorQuestData.completed,
                            total: impostorQuestData.total,
                            scope: "",
                        })
                    ) : (
                        t("game.questProgress.pendingMissions")
                    )}
                </div>

                {/* Quest List */}
                <QuestList quests={impostorQuestData.quests} isLoading={isLoading} />
            </div>
        );
    }

    // Crewmate behavior - load their full assumed quest list
    const [crewQuests, setCrewQuests] = useState<Array<Quest & { completed: boolean; location?: string }>>([]);
    const [isCrewQuestsLoading, setIsCrewQuestsLoading] = useState(false);

    useEffect(() => {
        if (role !== "CREWMATE") return;
        
        const fetchQuests = async () => {
            setIsCrewQuestsLoading(true);
            try {
                let assignedList: Array<Quest & { completed: boolean; location?: string }> = [];
                
                if (batchId) {
                    // Fetch quests from server action via store if they aren't loaded yet
                    if (gameQuests.length === 0 && gameState?.id && !isGameQuestsLoading) {
                        await fetchGameQuests(gameState.id);
                    }
                    
                    const storeState = useGameStore.getState();
                    const allQuests = storeState.gameQuests;
                    
                    if (allQuests.length > 0) {
                        if (assignedQuests.length > 0) {
                            assignedList = assignedQuests.map(id => {
                                const questDef = allQuests.find(q => q.id === id);
                                return {
                                    id: id,
                                    type: questDef?.type || 'qcm',
                                    duration: questDef?.duration || 'short',
                                    location: questDef?.location,
                                    completed: completedQuests.includes(id)
                                };
                            });
                        } else if (total > 0) {
                            // Map completed quests
                            const completedQ = completedQuests.map(id => {
                                const questDef = allQuests.find(q => q.id === id);
                                return {
                                    id: id,
                                    type: questDef?.type || 'qcm',
                                    duration: questDef?.duration || 'short',
                                    location: questDef?.location,
                                    completed: true
                                };
                            });
                            
                            // Get remaining quests up to total
                            const remainingCount = Math.max(0, total - completedQuests.length);
                            const availableQuests = allQuests.filter(q => !completedQuests.includes(q.id));
                            const remainingQ = availableQuests.slice(0, remainingCount).map(q => ({
                                ...q,
                                completed: false
                            }));
                            
                            assignedList = [...completedQ, ...remainingQ];
                        }
                    }
                }

                // Fallback if no batch or batch fetch failed but we have a total to reach
                if (assignedList.length === 0 && total > 0) {
                    assignedList = Array.from({ length: total }, (_, index) => {
                        const isCompleted = index < completed;
                        return {
                                    id: isCompleted && completedQuests[index] ? completedQuests[index] : `crewmate-quest-${index}`,
                                    type: 'qcm' as const,
                                    duration: index % 3 === 0 ? 'short' as const : index % 3 === 1 ? 'medium' as const : 'long' as const,
                                    location: isCompleted
                                        ? t("game.questProgress.locationLabel", { index: index + 1 })
                                        : undefined,
                                    completed: isCompleted
                                };
                            });
                }

                setCrewQuests(assignedList);
            } finally {
                setIsCrewQuestsLoading(false);
            }
        };
        fetchQuests();
    }, [role, batchId, assignedQuests, completedQuests, total, completed, gameQuests.length, gameState?.id]);

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="p-4 border border-primary/20 bg-black/30 space-y-4">
            <div className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani">
                {role === "ADMIN" ? t("game.questProgress.crewProgress") : t("game.questProgress.questsProgress")}
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
                    <span className="animate-pulse">{t("game.questProgress.loading")}</span>
                ) : total > 0 ? (
                    t("game.questProgress.completedOutOf", {
                        completed,
                        total,
                        scope: role === "ADMIN" ? t("game.questProgress.completedScopeTotal") : "",
                    })
                ) : (
                    t("game.questProgress.pendingMissions")
                )}
            </div>
            
            {/* Quest List for crewmates - show all assigned quests */}
            {role === "CREWMATE" && (
                <QuestList quests={crewQuests} isLoading={isLoading || isCrewQuestsLoading} />
            )}
        </div>
    );
}
