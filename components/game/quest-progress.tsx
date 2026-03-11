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
                        setSabotageFeedback(t("game.sabotage.messages.lightsActivated"));
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
                            await fetchGameQuests(activeGameId);
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

        const impostorTeammates = (activeGameState?.players ?? []).filter(
            (player) =>
                player.role === "IMPOSTOR" &&
                player.id !== currentPlayerId &&
                player.name,
        );

        return (
            <div className="p-4 border border-red-500/30 bg-red-950/20 space-y-4">
                <div className="text-xs text-red-200 uppercase tracking-widest font-rajdhani">
                    {t("game.sabotage.impostorPanelTitle")}
                </div>

                <div className="space-y-2">
                    <div className="text-[10px] text-red-200/70 uppercase tracking-widest">
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
                                    className="px-2 py-1 text-xs border border-red-400/40 bg-red-500/10 text-red-100 uppercase tracking-wide"
                                >
                                    {mate.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="text-[10px] text-red-200/70 uppercase tracking-widest">
                        {t("game.sabotage.impostorActionsTitle")}
                    </div>
                    <div className="space-y-2 text-sm font-rajdhani">
                        <div className="p-3 border border-red-500/20 bg-black/30">
                            <div className="text-red-100 uppercase tracking-wide">
                                {t("game.sabotage.locationCommunications")}
                            </div>
                            <div className="text-muted-foreground">
                                {sabotageConfig?.communications.location?.trim() ||
                                    t("game.sabotage.locationUnknown")}
                            </div>
                            <div className="text-xs uppercase tracking-widest text-red-200/80 mt-1">
                                {communicationsActive
                                    ? t("game.sabotage.statusActive")
                                    : communicationsCooldownMs > 0
                                    ? t("game.sabotage.statusCooldown", {
                                          time: formatCooldown(communicationsCooldownMs),
                                      })
                                    : t("game.sabotage.statusReady")}
                            </div>
                            <button
                                type="button"
                                onClick={() => triggerImpostorSabotage("COMMUNICATIONS")}
                                disabled={
                                    isTriggeringSabotage !== null ||
                                    communicationsActive ||
                                    communicationsCooldownMs > 0
                                }
                                className="mt-2 w-full min-h-[40px] border border-red-400/40 bg-red-500/10 text-red-100 uppercase tracking-widest text-xs hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isTriggeringSabotage === "COMMUNICATIONS"
                                    ? t("game.sabotage.triggeringButton")
                                    : t("game.sabotage.triggerButton")}
                            </button>
                        </div>

                        <div className="p-3 border border-red-500/20 bg-black/30">
                            <div className="text-red-100 uppercase tracking-wide">
                                {t("game.sabotage.locationLights")}
                            </div>
                            <div className="text-muted-foreground">
                                {lightsConfig?.location?.trim() || t("game.sabotage.locationUnknown")}
                            </div>
                            <div className="text-xs uppercase tracking-widest text-red-200/80 mt-1">
                                {!lightsConfigured
                                    ? t("game.sabotage.statusUnavailable")
                                    : lightsActive
                                    ? t("game.sabotage.statusActive")
                                    : lightsCooldownMs > 0
                                    ? t("game.sabotage.statusCooldown", {
                                          time: formatCooldown(lightsCooldownMs),
                                      })
                                    : t("game.sabotage.statusReady")}
                            </div>
                            <button
                                type="button"
                                onClick={() => triggerImpostorSabotage("LIGHTS")}
                                disabled={
                                    isTriggeringSabotage !== null ||
                                    !lightsConfigured ||
                                    lightsActive ||
                                    lightsCooldownMs > 0
                                }
                                className="mt-2 w-full min-h-[40px] border border-red-400/40 bg-red-500/10 text-red-100 uppercase tracking-widest text-xs hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isTriggeringSabotage === "LIGHTS"
                                    ? t("game.sabotage.triggeringButton")
                                    : t("game.sabotage.triggerButton")}
                            </button>
                        </div>

                        <div className="p-3 border border-red-500/20 bg-black/30">
                            <div className="text-red-100 uppercase tracking-wide">{t("game.sabotage.reactorCardTitle")}</div>
                            <div className="text-muted-foreground text-xs mt-1">
                                {t("game.sabotage.reactorPositions", {
                                    locationA:
                                        sabotageConfig?.reactor[0]?.location?.trim() ||
                                        t("game.sabotage.locationUnknown"),
                                    locationB:
                                        sabotageConfig?.reactor[1]?.location?.trim() ||
                                        t("game.sabotage.locationUnknown"),
                                })}
                            </div>
                            <div className="text-xs uppercase tracking-widest text-red-200/80 mt-1">
                                {reactorActive
                                    ? t("game.sabotage.reactorProgress", {
                                          scanned: String(reactorProgress),
                                          total: String(2),
                                      })
                                    : reactorCooldownMs > 0
                                    ? t("game.sabotage.statusCooldown", {
                                          time: formatCooldown(reactorCooldownMs),
                                      })
                                    : t("game.sabotage.statusReady")}
                            </div>
                            <button
                                type="button"
                                onClick={() => triggerImpostorSabotage("REACTOR")}
                                disabled={
                                    isTriggeringSabotage !== null ||
                                    reactorActive ||
                                    reactorCooldownMs > 0
                                }
                                className="mt-2 w-full min-h-[40px] border border-red-400/40 bg-red-500/10 text-red-100 uppercase tracking-widest text-xs hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isTriggeringSabotage === "REACTOR"
                                    ? t("game.sabotage.triggeringButton")
                                    : t("game.sabotage.triggerButton")}
                            </button>
                        </div>
                    </div>
                </div>

                {sabotageFeedback && (
                    <div className="text-xs text-red-100/90 border border-red-500/20 bg-red-950/30 p-2">
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
        <div className="p-4 border border-primary/20 bg-black/30 space-y-4 relative">
            {role === "CREWMATE" && communicationsSabotaged && (
                <div className="border border-red-500/30 bg-red-950/30 p-3 text-center">
                    <div className="text-xs text-red-100 font-orbitron uppercase tracking-wider">
                        {t("game.sabotage.communicationsOverlayTitle")}
                    </div>
                    <div className="text-[11px] text-red-100/80 font-rajdhani mt-1">
                        {t("game.sabotage.communicationsOverlayMessage")}
                    </div>
                </div>
            )}

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
                        completed: String(completed),
                        total: String(total),
                        scope: role === "ADMIN" ? t("game.questProgress.completedScopeTotal") : "",
                    })
                ) : (
                    t("game.questProgress.pendingMissions")
                )}
            </div>

            {role === "CREWMATE" && (
                <QuestList quests={crewQuests} isLoading={isLoading || isCrewQuestsLoading} />
            )}
        </div>
    );
}
