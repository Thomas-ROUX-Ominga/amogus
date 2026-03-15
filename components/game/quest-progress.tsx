"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GameState, PlayerRole } from "@/types/game";
import { QuestList } from "./quest-list";
import { useGameStore } from "@/lib/store/game-store";
import { Quest, SabotageType } from "@/types/quest";
import { triggerSabotage } from "@/lib/redis/actions";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";

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
}

const EMPTY_ARRAY: string[] = [];
const EMPTY_QUESTS: Quest[] = [];
const QUEST_CATALOG_RETRY_MS = 10000;

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

    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!shouldRunImpostorTimer) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [shouldRunImpostorTimer]);

    const [crewQuests, setCrewQuests] = useState<Array<Quest & { completed: boolean; location?: string }>>([]);
    const [isCrewQuestsLoading, setIsCrewQuestsLoading] = useState(false);
    const [isTriggeringSabotage, setIsTriggeringSabotage] = useState<SabotageType | null>(null);
    const [sabotageFeedback, setSabotageFeedback] = useState<string | null>(null);
    const lastQuestCatalogFetchRef = useRef<{ gameId: string; at: number } | null>(null);

    const triggerImpostorSabotage = async (type: SabotageType) => {
        if (!currentPlayerId || !activeGameState?.id) return;
        setSabotageFeedback(null);
        setIsTriggeringSabotage(type);

        try {
            const response = await triggerSabotage(activeGameState.id, currentPlayerId, type);
            if (response.success) {
                switch (response.data?.event) {
                    case "COMMUNICATIONS_ACTIVATED":
                        setSabotageFeedback(t("game.sabotage.messages.communicationsActivated"));
                        break;
                    case "LIGHTS_ACTIVATED":
                        // Lights state is already visible on the sabotage button; avoid redundant toast text.
                        break;
                    case "REACTOR_ACTIVATED":
                        setSabotageFeedback(t("game.sabotage.messages.reactorActivated"));
                        break;
                    default:
                        setSabotageFeedback(t("game.sabotage.messages.scanHandled"));
                }
            } else {
                setSabotageFeedback(
                    getLocalizedErrorMessage({
                        t,
                        code: response.code,
                        fallback: response.error,
                    }),
                );
            }

            await refreshGameData(activeGameState.id, currentPlayerId);
        } finally {
            setIsTriggeringSabotage(null);
        }
    };

    useEffect(() => {
        if (role !== "CREWMATE") return;

        const fetchQuests = async () => {
            setIsCrewQuestsLoading(true);
            try {
                let assignedList: Array<Quest & { completed: boolean; location?: string }> = [];

                if (batchId) {
                    let allQuests = resolvedGameQuests;
                    const activeGameId = activeGameState?.id;

                    if (allQuests.length === 0 && activeGameId && !isGameQuestsLoading && fetchGameQuests) {
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
                    } else {
                        setCrewQuests([]);
                        return;
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

                setCrewQuests(assignedList);
            } finally {
                setIsCrewQuestsLoading(false);
            }
        };
        fetchQuests();
    }, [
        role,
        batchId,
        assignedQuests,
        completedQuests,
        total,
        completed,
        resolvedGameQuests.length,
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
            const isBlockedByOtherAction = isAnySabotageTriggering && !isTriggeringThis;
            const isDisabled =
                isTriggeringThis || isBlockedByOtherAction || isUnavailable || isActive || isCoolingDown;

            let statusLabel = t("game.sabotage.statusReady");
            let actionLabel = t("game.sabotage.triggerButton");
            let cardClassName = "border-emerald-400/30 bg-emerald-500/5";
            let statusClassName = "text-emerald-200/90 border border-emerald-300/30 bg-emerald-500/10";
            let buttonClassName =
                "border-emerald-300/50 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25";

            if (isTriggeringThis) {
                statusLabel = t("game.sabotage.triggeringButton");
                actionLabel = t("game.sabotage.triggeringButton");
                cardClassName = "border-sky-300/40 bg-sky-500/10 shadow-[0_0_24px_rgba(56,189,248,0.15)]";
                statusClassName = "text-sky-100 border border-sky-300/40 bg-sky-500/15";
                buttonClassName = "border-sky-300/60 bg-sky-500/25 text-sky-50 animate-pulse";
            } else if (isActive) {
                statusLabel = activeLabelOverride ?? t("game.sabotage.statusActive");
                actionLabel = t("game.sabotage.statusActive");
                cardClassName = "border-rose-300/40 bg-rose-500/10 shadow-[0_0_24px_rgba(251,113,133,0.16)]";
                statusClassName = "text-rose-100 border border-rose-300/40 bg-rose-500/15";
                buttonClassName = "border-rose-300/55 bg-rose-500/20 text-rose-50";
            } else if (isCoolingDown) {
                statusLabel = t("game.sabotage.statusCooldown", {
                    time: formatCooldown(cooldownMs),
                });
                actionLabel = `T-${formatCooldown(cooldownMs)}`;
                cardClassName = "border-amber-300/40 bg-amber-500/10";
                statusClassName = "text-amber-100 border border-amber-300/40 bg-amber-500/15";
                buttonClassName = "border-amber-300/60 bg-amber-500/25 text-amber-50";
            } else if (isUnavailable) {
                statusLabel = t("game.sabotage.statusUnavailable");
                actionLabel = t("game.sabotage.statusUnavailable");
                cardClassName = "border-slate-400/30 bg-slate-800/40";
                statusClassName = "text-slate-200/80 border border-slate-300/30 bg-slate-700/35";
                buttonClassName = "border-slate-300/40 bg-slate-700/45 text-slate-300";
            } else if (isBlockedByOtherAction) {
                buttonClassName = "border-emerald-300/35 bg-emerald-500/10 text-emerald-100/70";
            }

            return {
                isDisabled,
                statusLabel,
                actionLabel,
                cardClassName,
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
            <div className="p-4 border border-primary/25 bg-slate-950/45 space-y-4 h-full min-h-0 overflow-y-auto">
                <div className="text-xs text-primary/90 uppercase tracking-widest font-rajdhani">
                    {t("game.sabotage.impostorPanelTitle")}
                </div>

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
                        <div className={`p-3 border bg-black/35 transition-colors ${communicationsUi.cardClassName}`}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="text-slate-100 uppercase tracking-wide">
                                    {t("game.sabotage.locationCommunications")}
                                </div>
                                <div className={`inline-flex px-2 py-1 text-[10px] uppercase tracking-widest shrink-0 ${communicationsUi.statusClassName}`}>
                                    {communicationsUi.statusLabel}
                                </div>
                            </div>
                            <div className="text-slate-300/90">
                                {sabotageConfig?.communications.location?.trim() ||
                                    t("game.sabotage.locationUnknown")}
                            </div>
                            <button
                                type="button"
                                onClick={() => triggerImpostorSabotage("COMMUNICATIONS")}
                                disabled={communicationsUi.isDisabled}
                                className={`mt-2 w-full min-h-[40px] border uppercase tracking-widest text-xs transition-all ${communicationsUi.buttonClassName} ${communicationsUi.isDisabled ? "cursor-not-allowed" : ""}`}
                            >
                                {communicationsUi.actionLabel}
                            </button>
                        </div>

                        <div className={`p-3 border bg-black/35 transition-colors ${lightsUi.cardClassName}`}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="text-slate-100 uppercase tracking-wide">
                                    {t("game.sabotage.locationLights")}
                                </div>
                                <div className={`inline-flex px-2 py-1 text-[10px] uppercase tracking-widest shrink-0 ${lightsUi.statusClassName}`}>
                                    {lightsUi.statusLabel}
                                </div>
                            </div>
                            <div className="text-slate-300/90">
                                {lightsConfig?.location?.trim() || t("game.sabotage.locationUnknown")}
                            </div>
                            <button
                                type="button"
                                onClick={() => triggerImpostorSabotage("LIGHTS")}
                                disabled={lightsUi.isDisabled}
                                className={`mt-2 w-full min-h-[40px] border uppercase tracking-widest text-xs transition-all ${lightsUi.buttonClassName} ${lightsUi.isDisabled ? "cursor-not-allowed" : ""}`}
                            >
                                {lightsUi.actionLabel}
                            </button>
                        </div>

                        <div className={`p-3 border bg-black/35 transition-colors ${reactorUi.cardClassName}`}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="text-slate-100 uppercase tracking-wide">{t("game.sabotage.reactorCardTitle")}</div>
                                <div className={`inline-flex px-2 py-1 text-[10px] uppercase tracking-widest shrink-0 ${reactorUi.statusClassName}`}>
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
                                className={`mt-2 w-full min-h-[40px] border uppercase tracking-widest text-xs transition-all ${reactorUi.buttonClassName} ${reactorUi.isDisabled ? "cursor-not-allowed" : ""}`}
                            >
                                {reactorUi.actionLabel}
                            </button>
                        </div>
                    </div>
                </div>

                {sabotageFeedback && (
                    <div className="text-xs text-primary/90 border border-primary/25 bg-primary/10 p-2">
                        {sabotageFeedback}
                    </div>
                )}
            </div>
        );
    }

    if (role === "CREWMATE" && lightsSabotaged) {
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
        <div className="p-4 border border-primary/20 bg-black/30 relative h-full min-h-0 flex flex-col">
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

            <div className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani shrink-0">
                {t("game.questProgress.questsProgress")}
            </div>
            <div className="w-full h-2 bg-white/10 overflow-hidden shrink-0 mt-4">
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
            <div className="text-sm text-muted-foreground font-rajdhani tracking-wide shrink-0 mt-4">
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
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                    <QuestList quests={crewQuests} isLoading={isLoading || isCrewQuestsLoading} />
                </div>
            )}
        </div>
    );
}
