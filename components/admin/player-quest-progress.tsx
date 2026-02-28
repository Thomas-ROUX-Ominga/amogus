"use client";

import { Player } from "@/types/game";
import { getTotalQuests } from "@/lib/utils/quest-calculations";
import { Clock, CheckCircle } from "lucide-react";

interface PlayerQuestProgressProps {
    player: Player;
    isCurrentUser?: boolean;
    totalCount?: number;
}

export function PlayerQuestProgress({ player, isCurrentUser = false, totalCount: providedTotalCount }: PlayerQuestProgressProps) {
    const completedCount = player.completedQuests?.length || 0;
    const totalCount = providedTotalCount || getTotalQuests();
    const completionPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
        <div className="space-y-3" data-testid="player-quest-progress">
            {/* Progress Overview */}
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-primary/80">
                        {completedCount}/{totalCount} Quêtes
                    </span>
                </div>
                <div className="text-primary/60">
                    {completionPercentage.toFixed(0)}%
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500"
                    style={{ width: `${completionPercentage}%` }}
                />
            </div>

            {/* Recent Activity */}
            {player.lastQuestCompleted && (
                <div className="flex items-center gap-2 text-[8px] text-primary/50">
                    <Clock className="w-2 h-2" />
                    <span>
                        Dernière quête: {new Date(player.lastQuestCompleted).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                </div>
            )}

            {/* Current User Indicator */}
            {isCurrentUser && (
                <div className="text-[8px] text-primary/70 text-center">
                    VOUS
                </div>
            )}
        </div>
    );
}
