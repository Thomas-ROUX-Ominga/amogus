"use client";

import { PlayerRole } from "@/types/game";

interface QuestProgressProps {
    role: PlayerRole;
    completed: number;
    total: number;
    isLoading?: boolean;
}

export function QuestProgress({ role, completed, total, isLoading = false }: QuestProgressProps) {
    if (role === "IMPOSTOR") {
        return null;
    }

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="p-4 border border-primary/20 bg-black/30 space-y-3">
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
        </div>
    );
}
