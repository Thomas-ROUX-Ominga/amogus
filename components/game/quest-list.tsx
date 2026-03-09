"use client";

import { Quest } from "@/types/quest";
import { useTranslations } from "next-intl";

interface QuestListProps {
    quests: Array<Quest & { completed: boolean; location?: string }>;
    isLoading?: boolean;
}

export function QuestList({ quests, isLoading = false }: QuestListProps) {
    const t = useTranslations();
    if (isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="animate-pulse">
                        <div className="h-4 bg-white/10 rounded mb-1"></div>
                        <div className="h-3 bg-white/5 rounded w-3/4"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (quests.length === 0) {
        return (
            <div className="text-sm text-muted-foreground font-rajdhani tracking-wide">
                {t("game.questList.pendingMissions")}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {quests.map((quest, index) => (
                <div
                    key={quest.id}
                    className="flex items-start gap-3 p-3 border border-white/10 bg-white/5 rounded-lg"
                >
                    <div className="flex-shrink-0 mt-1">
                        <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                quest.completed
                                    ? "bg-[#2DA44E] border-[#2DA44E]"
                                    : "border-white/30"
                            }`}
                        >
                            {quest.completed && (
                                <svg
                                    className="w-2 h-2 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani">
                                {t("game.questList.questLabel", { index: index + 1 })}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full font-rajdhani ${
                                quest.duration === 'short'
                                    ? 'bg-green-500/20 text-green-400'
                                    : quest.duration === 'medium'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-red-500/20 text-red-400'
                            }`}>
                                {quest.duration === "short"
                                    ? t("game.questList.durationShort")
                                    : quest.duration === "medium"
                                    ? t("game.questList.durationMedium")
                                    : t("game.questList.durationLong")}
                            </span>
                        </div>
                        {quest.location && (
                            <div className="text-sm text-primary font-rajdhani tracking-wide mb-1">
                                📍 {quest.location}
                            </div>
                        )}
                        <div className="text-xs text-muted-foreground font-rajdhani tracking-wide">
                            {quest.completed ? t("game.questList.completed") : t("game.questList.inProgress")}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
