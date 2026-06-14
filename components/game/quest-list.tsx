"use client";

import React from "react";
import { Quest } from "@/types/quest";
import { useTranslations } from "next-intl";

interface QuestListProps {
    quests: Array<Quest & { completed: boolean; location?: string }>;
    isLoading?: boolean;
}

function QuestListInner({ quests, isLoading = false }: QuestListProps) {
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
            {quests.map((quest, index) => {
                const isCompleted = quest.completed;
                const locationLabel =
                    quest.location?.trim() ||
                    t("game.questProgress.locationLabel", {
                        index: String(index + 1),
                    });
                const statusLabel = isCompleted
                    ? t("game.questList.completed")
                    : t("game.questList.inProgress");

                return (
                    <div
                        key={quest.id}
                        className={`group relative overflow-visible rounded-lg border p-3.5 flex items-center justify-between gap-3 transition-all ${
                            isCompleted
                                ? "border-emerald-300/30 bg-[linear-gradient(130deg,rgba(16,185,129,0.12)_0%,rgba(15,23,42,0.78)_58%)] shadow-[0_8px_30px_rgba(16,185,129,0.12)]"
                                : "border-white/10 bg-[linear-gradient(130deg,rgba(56,189,248,0.07)_0%,rgba(15,23,42,0.74)_62%)]"
                        }`}
                    >
                        <span
                            aria-hidden="true"
                            className={`absolute inset-y-0 left-0 w-[3px] ${
                                isCompleted ? "bg-emerald-300/85" : "bg-sky-300/65"
                            }`}
                        />

                        <div className="min-w-0">
                            <div className="text-sm text-primary font-rajdhani tracking-wide leading-tight">
                                {locationLabel}
                            </div>

                            <div className="mt-1.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-rajdhani">
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${
                                        isCompleted
                                            ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-200"
                                            : "border-sky-300/35 bg-sky-400/10 text-sky-100/90"
                                    }`}
                                >
                                    {isCompleted ? (
                                        <svg
                                            className="h-3 w-3"
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
                                    ) : (
                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-200 shadow-[0_0_8px_rgba(125,211,252,0.8)]" />
                                    )}
                                    <span>{statusLabel}</span>
                                </span>
                            </div>
                        </div>

                        <span
                            aria-label={statusLabel}
                            title={statusLabel}
                            className={`relative shrink-0 self-center inline-flex h-9 w-9 items-center justify-center rounded-full border ${
                                isCompleted
                                    ? "border-emerald-300/45 bg-emerald-400/10 shadow-[0_0_20px_rgba(16,185,129,0.28)]"
                                    : "border-sky-300/40 bg-slate-950/85"
                            }`}
                        >
                            {isCompleted ? (
                                <>
                                    <span className="absolute inset-0 rounded-full ring-2 ring-emerald-300/20" />
                                    <svg
                                        className="relative h-4 w-4 text-emerald-200"
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
                                </>
                            ) : (
                                <>
                                    <span
                                        aria-hidden="true"
                                        className="absolute inset-0 rounded-full bg-[conic-gradient(from_230deg,rgba(56,189,248,0.7)_0deg,rgba(56,189,248,0.28)_48deg,rgba(15,23,42,0.12)_130deg,rgba(15,23,42,0.02)_360deg)] motion-safe:animate-[spin_3.2s_linear_infinite]"
                                    />
                                    <span
                                        aria-hidden="true"
                                        className="absolute inset-[3px] rounded-full border border-sky-200/30"
                                    />
                                    <span
                                        aria-hidden="true"
                                        className="absolute inset-[8px] rounded-full border border-sky-200/20 motion-safe:animate-pulse"
                                    />
                                    <span className="relative h-2.5 w-2.5 rounded-full bg-sky-100 shadow-[0_0_10px_rgba(186,230,253,0.95)]" />
                                </>
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export const QuestList = React.memo(QuestListInner);
