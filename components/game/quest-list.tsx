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
        <div className="space-y-2.5">
            {quests.map((quest, index) => (
                <div
                    key={quest.id}
                    className="p-3 border border-white/10 bg-white/5 rounded-lg flex items-center justify-between gap-3"
                >
                    <div className="min-w-0">
                        <div className="text-sm text-primary font-rajdhani tracking-wide leading-tight">
                            {quest.location?.trim() ||
                                t("game.questProgress.locationLabel", {
                                    index: String(index + 1),
                                })}
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-widest font-rajdhani">
                            {quest.completed ? (
                                <>
                                    <svg
                                        className="w-3 h-3 text-[#2DA44E]"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                        aria-hidden="true"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    <span className="text-[#2DA44E]">{t("game.questList.completed")}</span>
                                </>
                            ) : (
                                <span className="text-muted-foreground">{t("game.questList.inProgress")}</span>
                            )}
                        </div>
                    </div>

                    <span
                        aria-label={
                            quest.completed
                                ? t("game.questList.completed")
                                : t("game.questList.inProgress")
                        }
                        title={
                            quest.completed
                                ? t("game.questList.completed")
                                : t("game.questList.inProgress")
                        }
                        className={`shrink-0 self-center inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                            quest.completed
                                ? "border-[#2DA44E]/70 bg-[#2DA44E]/20 text-[#2DA44E]"
                                : "border-slate-400/45 bg-slate-500/5"
                        }`}
                    />
                </div>
            ))}
        </div>
    );
}
