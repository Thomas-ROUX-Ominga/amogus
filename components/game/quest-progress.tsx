"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GameState, PlayerRole } from "@/types/game";
import { QuestList } from "./quest-list";
import { useGameStore } from "@/lib/store/game-store";
import { Quest, SabotageType } from "@/types/quest";
import { triggerSabotage } from "@/lib/redis/actions";

interface QuestProgressProps {
    role: PlayerRole;
    completed: number;
    total: number;
    isLoading?: boolean;
    assignedQuests?: string[];
    completedQuests?: string[];
    batchId?: string;
    currentPlayerId?: string;
    communicationsSabotaged?: boolean;
    lightsSabotaged?: boolean;
    gameStateOverride?: GameState;
    deadAwaitingMeeting?: boolean;
}

const EMPTY_ARRAY: string[] = [];
const EMPTY_QUESTS: Quest[] = [];
const QUEST_CATALOG_RETRY_MS = 10000;

function sortQuestsForDisplay<T extends { completed: boolean }>(
    quests: T[],
): T[] {
    const inProgress: T[] = [];
    const done: T[] = [];

    quests.forEach((quest) => {
        if (quest.completed) {
            done.push(quest);
            return;
        }
        inProgress.push(quest);
    });

    return [...inProgress, ...done];
}

function formatCooldown(ms: number): string {
    if (ms <= 0) return "00:00";
    const seconds = Math.floor(ms / 1000);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function QuestProgress({
    role,
    completed,
    total,
    isLoading = false,
    assignedQuests = EMPTY_ARRAY,
    completedQuests = EMPTY_ARRAY,
    batchId,
    currentPlayerId,
    communicationsSabotaged = false,
    lightsSabotaged = false,
    gameStateOverride,
    deadAwaitingMeeting = false,
}: QuestProgressProps) {
    const t = useTranslations();
    const {
        gameQuests,
        fetchGameQuests,
        isGameQuestsLoading,
        gameState,
        refreshGameData,
    } = useGameStore();
    const resolvedGameQuests = gameQuests ?? EMPTY_QUESTS;

    const activeGameState = gameStateOverride ?? gameState;
    const sabotageState = activeGameState?.sabotageState;
    const shouldRunImpostorTimer =
        role === "IMPOSTOR" &&
        (sabotageState?.active === "REACTOR" ||
            (sabotageState?.cooldowns.communicationsAvailableAt ?? 0) > Date.now() ||
            (sabotageState?.cooldowns.lightsAvailableAt ?? 0) > Date.now() ||
            (sabotageState?.cooldowns.reactorAvailableAt ?? 0) > Date.now());

    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!shouldRunImpostorTimer) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [shouldRunImpostorTimer]);

    const [crewQuests, setCrewQuests] = useState<Array<Quest & { completed: boolean; location?: string }>>([]);
    const [isTriggeringSabotage, setIsTriggeringSabotage] = useState<SabotageType | null>(null);
    const lastQuestCatalogFetchRef = useRef<{ gameId: string; at: number } | null>(null);

    const triggerImpostorSabotage = async (type: SabotageType) => {
        if (!currentPlayerId || !activeGameState?.id) return;
        setIsTriggeringSabotage(type);

        try {
            await triggerSabotage(activeGameState.id, currentPlayerId, type);
            await refreshGameData(activeGameState.id, currentPlayerId);
        } finally {
            setIsTriggeringSabotage(null);
        }
    };

    useEffect(() => {
        if (role !== "CREWMATE") return;

        let cancelled = false;

        const fetchQuests = async () => {
            let assignedList: Array<Quest & { completed: boolean; location?: string }> = [];

                if (batchId) {
                    let allQuests = resolvedGameQuests;
                    const activeGameId = activeGameState?.id;
                    const hasMissingAssignedQuestDefinition =
                        assignedQuests.length > 0 &&
                        assignedQuests.some((questId) => !allQuests.some((quest) => quest.id === questId));

                    if (
                        (allQuests.length === 0 || hasMissingAssignedQuestDefinition) &&
                        activeGameId &&
                        !isGameQuestsLoading &&
                        fetchGameQuests
                    ) {
                        const nowTs = Date.now();
                        const lastFetch = lastQuestCatalogFetchRef.current;
                        const shouldFetch =
                            !lastFetch ||
                            lastFetch.gameId !== activeGameId ||
                            nowTs - lastFetch.at >= QUEST_CATALOG_RETRY_MS;

                        if (shouldFetch) {
                            lastQuestCatalogFetchRef.current = { gameId: activeGameId, at: nowTs };
                            await fetchGameQuests(activeGameId, currentPlayerId);
                            allQuests = useGameStore.getState().gameQuests ?? EMPTY_QUESTS;
                        }
                    }

                    if (allQuests.length > 0) {
                        if (assignedQuests.length > 0) {
                            assignedList = assignedQuests.map((id) => {
                                const questDef = allQuests.find((q) => q.id === id);
                                return {
                                    id,
                                    type: questDef?.type || "qcm",
                                    duration: questDef?.duration || "short",
                                    location: questDef?.location,
                                    completed: completedQuests.includes(id),
                                };
                            });
                        } else if (total > 0) {
                            const completedQ = completedQuests.map((id) => {
                                const questDef = allQuests.find((q) => q.id === id);
                                return {
                                    id,
                                    type: questDef?.type || "qcm",
                                    duration: questDef?.duration || "short",
                                    location: questDef?.location,
                                    completed: true,
                                };
                            });

                            const remainingCount = Math.max(0, total - completedQuests.length);
                            const availableQuests = allQuests.filter((q) => !completedQuests.includes(q.id));
                            const remainingQ = availableQuests.slice(0, remainingCount).map((q) => ({
                                ...q,
                                completed: false,
                            }));

                            assignedList = [...completedQ, ...remainingQ];
                        }
                    }
                }

                if (!batchId && assignedList.length === 0 && total > 0) {
                    assignedList = Array.from({ length: total }, (_, index) => {
                        const isCompleted = index < completed;
                        return {
                            id:
                                isCompleted && completedQuests[index]
                                    ? completedQuests[index]
                                    : `crewmate-quest-${index}`,
                            type: "qcm" as const,
                            duration:
                                index % 3 === 0
                                    ? ("short" as const)
                                    : index % 3 === 1
                                    ? ("medium" as const)
                                    : ("long" as const),
                            location: isCompleted
                                ? t("game.questProgress.locationLabel", {
                                      index: String(index + 1),
                                  })
                                : undefined,
                            completed: isCompleted,
                        };
                    });
                }

            if (!cancelled) {
                setCrewQuests(sortQuestsForDisplay(assignedList));
            }
        };
        void fetchQuests();

        return () => {
            cancelled = true;
        };
    }, [
        role,
        batchId,
        assignedQuests,
        completedQuests,
        total,
        completed,
        resolvedGameQuests,
        activeGameState?.id,
        currentPlayerId,
        isGameQuestsLoading,
        fetchGameQuests,
        t,
    ]);

    if (role === "IMPOSTOR") {
        const sabotageConfig = activeGameState?.sabotages;
        const lightsConfig = (sabotageConfig as { lights?: { location?: string; qrId?: string } } | undefined)
            ?.lights;
        const communicationsCooldownMs = Math.max(
            0,
            (sabotageState?.cooldowns.communicationsAvailableAt ?? 0) - now,
        );
        const lightsCooldownMs = Math.max(
            0,
            (sabotageState?.cooldowns.lightsAvailableAt ?? 0) - now,
        );
        const reactorCooldownMs = Math.max(
            0,
            (sabotageState?.cooldowns.reactorAvailableAt ?? 0) - now,
        );
        const reactorProgress = sabotageState?.reactor?.scannedByQrId.length ?? 0;
        const communicationsActive = sabotageState?.active === "COMMUNICATIONS";
        const lightsActive = sabotageState?.active === "LIGHTS";
        const reactorActive = sabotageState?.active === "REACTOR";
        const lightsConfigured = Boolean(lightsConfig?.qrId);
        const isAnySabotageTriggering = isTriggeringSabotage !== null;
        const disabledByDeathWaiting = deadAwaitingMeeting;

        const impostorTeammates = (activeGameState?.players ?? []).filter(
            (player) =>
                player.role === "IMPOSTOR" &&
                player.id !== currentPlayerId &&
                player.name,
        );

        const resolveActionUi = ({
            type,
            isActive,
            cooldownMs,
            isUnavailable = false,
            activeLabelOverride,
        }: {
            type: SabotageType;
            isActive: boolean;
            cooldownMs: number;
            isUnavailable?: boolean;
            activeLabelOverride?: string;
        }) => {
            const isTriggeringThis = isTriggeringSabotage === type;
            const isCoolingDown = cooldownMs > 0;
            const isAnotherSabotageAlreadyActive =
                Boolean(sabotageState?.active) && sabotageState?.active !== type;
            const isBlockedByOtherAction =
                (isAnySabotageTriggering && !isTriggeringThis) || isAnotherSabotageAlreadyActive;
            const isDisabled =
                disabledByDeathWaiting ||
                isTriggeringThis ||
                isBlockedByOtherAction ||
                isUnavailable ||
                isActive ||
                isCoolingDown;

            let statusLabel = t("game.sabotage.statusReady");
            let actionLabel = t("game.sabotage.triggerButton");
            let cardClassName =
                "border-emerald-300/35 bg-[linear-gradient(130deg,rgba(16,185,129,0.14)_0%,rgba(4,22,16,0.8)_58%,rgba(2,6,23,0.82)_100%)] shadow-[0_10px_32px_rgba(16,185,129,0.12)]";
            let accentClassName = "bg-emerald-300/90";
            let statusClassName =
                "rounded-full text-emerald-100 border border-emerald-300/35 bg-emerald-500/14 shadow-[0_0_18px_rgba(16,185,129,0.15)]";
            let buttonClassName =
                "border-emerald-300/50 bg-[linear-gradient(140deg,rgba(16,185,129,0.24),rgba(6,95,70,0.2))] text-emerald-100 hover:bg-emerald-500/28 shadow-[inset_0_1px_0_rgba(167,243,208,0.2)]";

            if (disabledByDeathWaiting) {
                statusLabel = t("game.questProgress.awaitingMeetingStatus");
                actionLabel = t("game.questProgress.awaitingMeetingAction");
                cardClassName =
                    "border-slate-400/35 bg-[linear-gradient(130deg,rgba(100,116,139,0.16)_0%,rgba(30,41,59,0.65)_58%,rgba(2,6,23,0.82)_100%)]";
                accentClassName = "bg-slate-300/75";
                statusClassName =
                    "rounded-full text-slate-200/85 border border-slate-300/30 bg-slate-700/35";
                buttonClassName =
                    "border-slate-300/40 bg-[linear-gradient(140deg,rgba(71,85,105,0.6),rgba(51,65,85,0.55))] text-slate-300";
            } else if (isTriggeringThis) {
                statusLabel = t("game.sabotage.triggeringButton");
                actionLabel = t("game.sabotage.triggeringButton");
                cardClassName =
                    "border-sky-300/45 bg-[linear-gradient(130deg,rgba(14,165,233,0.2)_0%,rgba(2,52,75,0.7)_56%,rgba(2,6,23,0.82)_100%)] shadow-[0_0_26px_rgba(56,189,248,0.2)]";
                accentClassName = "bg-sky-200/95";
                statusClassName =
                    "rounded-full text-sky-100 border border-sky-300/40 bg-sky-500/18 shadow-[0_0_20px_rgba(56,189,248,0.2)]";
                buttonClassName =
                    "border-sky-300/60 bg-[linear-gradient(140deg,rgba(56,189,248,0.3),rgba(6,78,115,0.24))] text-sky-50 animate-pulse shadow-[0_0_20px_rgba(56,189,248,0.25)]";
            } else if (isActive) {
                statusLabel = activeLabelOverride ?? t("game.sabotage.statusActive");
                actionLabel = t("game.sabotage.statusActive");
                cardClassName =
                    "border-rose-300/42 bg-[linear-gradient(130deg,rgba(244,63,94,0.2)_0%,rgba(96,15,45,0.72)_58%,rgba(2,6,23,0.82)_100%)] shadow-[0_0_28px_rgba(244,63,94,0.22)]";
                accentClassName = "bg-rose-200/95";
                statusClassName =
                    "rounded-full text-rose-100 border border-rose-300/40 bg-rose-500/18 shadow-[0_0_20px_rgba(244,63,94,0.2)]";
                buttonClassName =
                    "border-rose-300/55 bg-[linear-gradient(140deg,rgba(244,63,94,0.27),rgba(136,19,55,0.24))] text-rose-50";
            } else if (isCoolingDown) {
                statusLabel = t("game.sabotage.statusCooldown", {
                    time: formatCooldown(cooldownMs),
                });
                actionLabel = `T-${formatCooldown(cooldownMs)}`;
                cardClassName =
                    "border-amber-300/40 bg-[linear-gradient(130deg,rgba(245,158,11,0.2)_0%,rgba(120,53,15,0.7)_58%,rgba(2,6,23,0.82)_100%)]";
                accentClassName = "bg-amber-200/95";
                statusClassName =
                    "rounded-full text-amber-100 border border-amber-300/40 bg-amber-500/18";
                buttonClassName =
                    "border-amber-300/60 bg-[linear-gradient(140deg,rgba(245,158,11,0.28),rgba(146,64,14,0.25))] text-amber-50";
            } else if (isUnavailable) {
                statusLabel = t("game.sabotage.statusUnavailable");
                actionLabel = t("game.sabotage.statusUnavailable");
                cardClassName =
                    "border-slate-400/35 bg-[linear-gradient(130deg,rgba(100,116,139,0.16)_0%,rgba(30,41,59,0.65)_58%,rgba(2,6,23,0.82)_100%)]";
                accentClassName = "bg-slate-300/75";
                statusClassName =
                    "rounded-full text-slate-200/85 border border-slate-300/30 bg-slate-700/35";
                buttonClassName =
                    "border-slate-300/40 bg-[linear-gradient(140deg,rgba(71,85,105,0.6),rgba(51,65,85,0.55))] text-slate-300";
            } else if (isBlockedByOtherAction) {
                buttonClassName =
                    "border-emerald-300/35 bg-[linear-gradient(140deg,rgba(16,185,129,0.14),rgba(6,95,70,0.12))] text-emerald-100/70";
            }

            return {
                isDisabled,
                statusLabel,
                actionLabel,
                cardClassName,
                accentClassName,
                statusClassName,
                buttonClassName,
            };
        };

        const communicationsUi = resolveActionUi({
            type: "COMMUNICATIONS",
            isActive: communicationsActive,
            cooldownMs: communicationsCooldownMs,
        });
        const lightsUi = resolveActionUi({
            type: "LIGHTS",
            isActive: lightsActive,
            cooldownMs: lightsCooldownMs,
            isUnavailable: !lightsConfigured,
        });
        const reactorUi = resolveActionUi({
            type: "REACTOR",
            isActive: reactorActive,
            cooldownMs: reactorCooldownMs,
            activeLabelOverride: t("game.sabotage.reactorProgress", {
                scanned: String(reactorProgress),
                total: String(2),
            }),
        });

        return (
            <div className={`p-4 border border-primary/25 bg-slate-950/45 space-y-4 h-full min-h-0 overflow-y-auto ${deadAwaitingMeeting ? "opacity-60 saturate-50" : ""}`}>
                <div className="text-xs text-primary/90 uppercase tracking-widest font-rajdhani">
                    {t("game.sabotage.impostorPanelTitle")}
                </div>
                {deadAwaitingMeeting && (
                    <div className="border border-red-500/30 bg-red-950/35 p-2 text-[11px] text-red-100 font-rajdhani tracking-wide">
                        {t("game.questProgress.awaitingMeetingNotice")}
                    </div>
                )}

                <div className="space-y-2">
                    <div className="text-[10px] text-slate-200/70 uppercase tracking-widest">
                        {t("game.sabotage.teammatesTitle")}
                    </div>
                    {impostorTeammates.length === 0 ? (
                        <div className="text-sm text-muted-foreground font-rajdhani">
                            {t("game.sabotage.noTeammates")}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {impostorTeammates.map((mate) => (
                                <span
                                    key={mate.id}
                                    className="px-2 py-1 text-xs border border-primary/35 bg-primary/10 text-primary uppercase tracking-wide"
                                >
                                    {mate.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="text-[10px] text-slate-200/70 uppercase tracking-widest">
                        {t("game.sabotage.impostorActionsTitle")}
                    </div>
                    <div className="space-y-2 text-sm font-rajdhani">
                        <div className={`group relative overflow-hidden rounded-lg p-3.5 border transition-colors ${communicationsUi.cardClassName}`}>
                            <span
                                aria-hidden="true"
                                className={`absolute inset-y-0 left-0 w-[3px] ${communicationsUi.accentClassName}`}
                            />
                            <div className="flex items-start justify-between gap-2">
                                <div className="text-slate-100 uppercase tracking-[0.09em]">
                                    {t("game.sabotage.locationCommunications")}
                                </div>
                                <div className={`inline-flex px-2.5 py-1 text-[10px] uppercase tracking-widest shrink-0 ${communicationsUi.statusClassName}`}>
                                    {communicationsUi.statusLabel}
                                </div>
                            </div>
                            <div className="text-slate-300/90 mt-1">
                                {sabotageConfig?.communications.location?.trim() ||
                                    t("game.sabotage.locationUnknown")}
                            </div>
                            <button
                                type="button"
                                onClick={() => triggerImpostorSabotage("COMMUNICATIONS")}
                                disabled={communicationsUi.isDisabled}
                                className={`relative overflow-hidden mt-3 w-full min-h-[42px] border uppercase tracking-[0.22em] text-[11px] transition-all ${communicationsUi.buttonClassName} ${communicationsUi.isDisabled ? "cursor-not-allowed" : ""}`}
                            >
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.22)_50%,transparent_100%)]"
                                />
                                <span className="relative">{communicationsUi.actionLabel}</span>
                            </button>
                        </div>

                        <div className={`group relative overflow-hidden rounded-lg p-3.5 border transition-colors ${lightsUi.cardClassName}`}>
                            <span
                                aria-hidden="true"
                                className={`absolute inset-y-0 left-0 w-[3px] ${lightsUi.accentClassName}`}
                            />
                            <div className="flex items-start justify-between gap-2">
                                <div className="text-slate-100 uppercase tracking-[0.09em]">
                                    {t("game.sabotage.locationLights")}
                                </div>
                                <div className={`inline-flex px-2.5 py-1 text-[10px] uppercase tracking-widest shrink-0 ${lightsUi.statusClassName}`}>
                                    {lightsUi.statusLabel}
                                </div>
                            </div>
                            <div className="text-slate-300/90 mt-1">
                                {lightsConfig?.location?.trim() || t("game.sabotage.locationUnknown")}
                            </div>
                            <button
                                type="button"
                                onClick={() => triggerImpostorSabotage("LIGHTS")}
                                disabled={lightsUi.isDisabled}
                                className={`relative overflow-hidden mt-3 w-full min-h-[42px] border uppercase tracking-[0.22em] text-[11px] transition-all ${lightsUi.buttonClassName} ${lightsUi.isDisabled ? "cursor-not-allowed" : ""}`}
                            >
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.22)_50%,transparent_100%)]"
                                />
                                <span className="relative">{lightsUi.actionLabel}</span>
                            </button>
                        </div>

                        <div className={`group relative overflow-hidden rounded-lg p-3.5 border transition-colors ${reactorUi.cardClassName}`}>
                            <span
                                aria-hidden="true"
                                className={`absolute inset-y-0 left-0 w-[3px] ${reactorUi.accentClassName}`}
                            />
                            <div className="flex items-start justify-between gap-2">
                                <div className="text-slate-100 uppercase tracking-[0.09em]">{t("game.sabotage.reactorCardTitle")}</div>
                                <div className={`inline-flex px-2.5 py-1 text-[10px] uppercase tracking-widest shrink-0 ${reactorUi.statusClassName}`}>
                                    {reactorUi.statusLabel}
                                </div>
                            </div>
                            <div className="text-slate-300/90 text-xs mt-1">
                                {t("game.sabotage.reactorPositions", {
                                    locationA:
                                        sabotageConfig?.reactor[0]?.location?.trim() ||
                                        t("game.sabotage.locationUnknown"),
                                    locationB:
                                        sabotageConfig?.reactor[1]?.location?.trim() ||
                                        t("game.sabotage.locationUnknown"),
                                })}
                            </div>
                            <button
                                type="button"
                                onClick={() => triggerImpostorSabotage("REACTOR")}
                                disabled={reactorUi.isDisabled}
                                className={`relative overflow-hidden mt-3 w-full min-h-[42px] border uppercase tracking-[0.22em] text-[11px] transition-all ${reactorUi.buttonClassName} ${reactorUi.isDisabled ? "cursor-not-allowed" : ""}`}
                            >
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.22)_50%,transparent_100%)]"
                                />
                                <span className="relative">{reactorUi.actionLabel}</span>
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        );
    }

    if (role === "CREWMATE" && lightsSabotaged && !deadAwaitingMeeting) {
        return (
            <div className="p-4 border border-yellow-500/30 bg-yellow-950/20 space-y-2">
                <div className="text-sm text-yellow-100 font-orbitron uppercase tracking-wider text-center">
                    {t("game.sabotage.lightsOverlayTitle")}
                </div>
                <div className="text-xs text-yellow-100/80 font-rajdhani text-center">
                    {t("game.sabotage.lightsOverlayMessage")}
                </div>
            </div>
        );
    }

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className={`p-4 border border-primary/20 bg-black/30 relative h-full min-h-0 flex flex-col ${deadAwaitingMeeting ? "opacity-60 saturate-50" : ""}`}>
            {deadAwaitingMeeting && (
                <div className="border border-red-500/30 bg-red-950/35 p-2 text-center text-[11px] text-red-100 font-rajdhani tracking-wide shrink-0 mb-3">
                    {t("game.questProgress.awaitingMeetingNotice")}
                </div>
            )}
            {role === "CREWMATE" && communicationsSabotaged && (
                <div className="border border-red-500/30 bg-red-950/30 p-3 text-center shrink-0 mb-3">
                    <div className="text-xs text-red-100 font-orbitron uppercase tracking-wider">
                        {t("game.sabotage.communicationsOverlayTitle")}
                    </div>
                    <div className="text-[11px] text-red-100/80 font-rajdhani mt-1">
                        {t("game.sabotage.communicationsOverlayMessage")}
                    </div>
                </div>
            )}

            <div className="mt-1 flex items-center justify-between gap-2 shrink-0">
                <div className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani">
                    {t("game.questProgress.questsProgress")}
                </div>
                <div className="text-[11px] text-primary/75 font-rajdhani tracking-[0.22em] uppercase">
                    {percentage}%
                </div>
            </div>
            <div className="relative mt-3 w-full h-2.5 overflow-hidden shrink-0 rounded-full border border-white/10 bg-slate-900/80">
                <div
                    className={`relative h-full rounded-full bg-[linear-gradient(90deg,#22c55e_0%,#34d399_50%,#7dd3fc_100%)] transition-all duration-700 ease-out ${
                        isLoading ? "animate-pulse" : ""
                    }`}
                    style={{ width: `${percentage}%` }}
                    role="progressbar"
                    aria-valuenow={completed}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-busy={isLoading}
                >
                    {percentage > 0 && (
                        <span
                            aria-hidden="true"
                            className="absolute top-1/2 right-0 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/4 rounded-full border border-emerald-100/70 bg-emerald-200/80 shadow-[0_0_14px_rgba(52,211,153,0.9)]"
                        />
                    )}
                </div>
            </div>
            <div className="text-sm text-muted-foreground font-rajdhani tracking-wide shrink-0 mt-3">
                {isLoading ? (
                    <span className="animate-pulse">{t("game.questProgress.loading")}</span>
                ) : total > 0 ? (
                    t("game.questProgress.completedOutOf", {
                        completed: String(completed),
                        total: String(total),
                    })
                ) : (
                    t("game.questProgress.pendingMissions")
                )}
            </div>

            {role === "CREWMATE" && (
                <div className={`mt-3 min-h-0 flex-1 overflow-y-auto pr-1 ${deadAwaitingMeeting ? "pointer-events-none select-none" : ""}`}>
                    <QuestList quests={crewQuests} isLoading={isLoading} />
                </div>
            )}
        </div>
    );
}
