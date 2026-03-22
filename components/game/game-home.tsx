"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { GameState, Player } from "@/types/game";
import { useGameStore } from "@/lib/store/game-store";
import { QuestProgress } from "@/components/game/quest-progress";
import { ScanButton } from "@/components/game/scan-button";
import { BuzzerButton } from "@/components/game/buzzer-button";
import { CameraScanner } from "@/components/game/camera-scanner";
import { EliminationButton } from "@/components/game/elimination-button";
import { EliminatedScreen } from "@/components/game/eliminated-screen";
import { GameOverScreen } from "@/components/game/game-over-screen";
import { ReactorSabotageAlert } from "@/components/game/reactor-sabotage-alert";
import { useCameraScanner } from "@/hooks/use-camera-scanner";
import { scanSabotage } from "@/lib/redis/actions";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";

interface GameHomeProps {
    gameState: GameState;
    currentPlayer: Player;
    userId: string;
}

export function GameHome({ gameState, currentPlayer, userId }: GameHomeProps) {
    const t = useTranslations();
    const locale = useLocale();
    const isFrench = locale.startsWith("fr");
    const gameWinner = gameState.winner;
    const isGameOver = gameState.status === "FINISHED" && Boolean(gameWinner);
    const isMeetingActive = gameState.meeting?.status === "ACTIVE";
    const activeMeetingId = gameState.meeting?.id;

    const ghostPopupStorageKey = `ghost-popup-dismissed-${gameState.id}-${userId}`;
    const meetingPopupStorageKey = activeMeetingId
        ? `meeting-popup-dismissed-${gameState.id}-${activeMeetingId}-${userId}`
        : null;

    const hasPostEliminationBuzzerWindow =
        !currentPlayer.isAlive &&
        Boolean(currentPlayer.postEliminationBuzzerGrantedAt) &&
        (currentPlayer.postEliminationBuzzerGrantedAt ?? 0) > (gameState.meeting?.startedAt ?? 0);
    const isAwaitingMeetingAfterDeath = !currentPlayer.isAlive && hasPostEliminationBuzzerWindow;
    const isGhostAfterMeeting =
        !currentPlayer.isAlive &&
        !isAwaitingMeetingAfterDeath &&
        gameState.meeting?.status !== "ACTIVE";

    const [showGhostPopup, setShowGhostPopup] = React.useState(() => {
        if (!isGhostAfterMeeting || isGameOver) return false;
        if (typeof window !== "undefined") {
            return !sessionStorage.getItem(ghostPopupStorageKey);
        }
        return true;
    });
    const [showMeetingPopup, setShowMeetingPopup] = React.useState(false);
    const [scanFeedback, setScanFeedback] = React.useState<string | null>(null);

    const {
        questsCompleted,
        questsTotal,
        isLoading,
        refreshGameData,
        isEliminating,
        eliminationError,
        eliminationErrorCode,
        eliminatePlayerAction,
        isTriggeringMeeting = false,
        meetingError = null,
        meetingErrorCode = null,
        triggerMeetingAction = async () => false,
    } = useGameStore();

    const allQuestsDone = questsTotal > 0 && questsCompleted >= questsTotal;

    useEffect(() => {
        if (isGameOver || !isGhostAfterMeeting) {
            setShowGhostPopup(false);
            return;
        }

        const dismissed = sessionStorage.getItem(ghostPopupStorageKey);
        setShowGhostPopup(!dismissed);
    }, [isGhostAfterMeeting, ghostPopupStorageKey, isGameOver]);

    useEffect(() => {
        if (!isMeetingActive || !meetingPopupStorageKey) {
            setShowMeetingPopup(false);
            return;
        }

        const dismissed = sessionStorage.getItem(meetingPopupStorageKey);
        setShowMeetingPopup(!dismissed);
    }, [isMeetingActive, meetingPopupStorageKey]);

    const { isOpen, openScanner, closeScanner, handleScan: originalHandleScan } = useCameraScanner({
        gameId: gameState.id,
    });

    useEffect(() => {
        if (isAwaitingMeetingAfterDeath && isOpen) {
            closeScanner();
        }
    }, [isAwaitingMeetingAfterDeath, isOpen, closeScanner]);

    const communicationsSabotaged = gameState.sabotageState?.active === "COMMUNICATIONS";
    const lightsSabotaged = gameState.sabotageState?.active === "LIGHTS";
    const hasActiveSabotage = Boolean(gameState.sabotageState?.active);

    const sabotageCodes = new Set([
        "ERR_SABOTAGE_FORBIDDEN",
        "ERR_SABOTAGE_ALREADY_ACTIVE",
        "ERR_SABOTAGE_COOLDOWN",
        "ERR_SABOTAGE_NOT_ACTIVE",
        "ERR_SABOTAGE_COMMUNICATIONS_ACTIVE",
        "ERR_SABOTAGE_COMMUNICATIONS_QUESTS_BLOCKED",
    ]);

    const handleScan = async (questId: string): Promise<boolean> => {
        if (isAwaitingMeetingAfterDeath) {
            setScanFeedback(t("game.home.awaitingMeetingScanDisabled"));
            return true;
        }

        try {
            const sabotageResponse = await scanSabotage(gameState.id, userId, questId);
            const wasHandled = Boolean(sabotageResponse.data?.handled);
            const shouldKeepScannerOpenForCommunicationsBlock =
                currentPlayer.role === "CREWMATE" &&
                communicationsSabotaged &&
                sabotageResponse.code === "ERR_SABOTAGE_NOT_ACTIVE";

            if (shouldKeepScannerOpenForCommunicationsBlock) {
                setScanFeedback(t("game.sabotage.messages.communicationsQuestBlocked"));
                return false;
            }

            if (wasHandled) {
                if (sabotageResponse.success && sabotageResponse.data) {
                    const event = sabotageResponse.data.event;
                    switch (event) {
                        case "COMMUNICATIONS_REPAIRED":
                            setScanFeedback(t("game.sabotage.messages.communicationsRepaired"));
                            break;
                        case "LIGHTS_REPAIRED":
                            setScanFeedback(t("game.sabotage.messages.lightsRepaired"));
                            break;
                        case "REACTOR_PROGRESS":
                            if (sabotageResponse.data.reactorProgress) {
                                setScanFeedback(
                                    t("game.sabotage.messages.reactorProgress", {
                                        scanned: String(sabotageResponse.data.reactorProgress.scanned),
                                        total: String(sabotageResponse.data.reactorProgress.total),
                                    }),
                                );
                            } else {
                                setScanFeedback(t("game.sabotage.messages.scanHandled"));
                            }
                            break;
                        case "REACTOR_REPAIRED":
                            setScanFeedback(t("game.sabotage.messages.reactorRepaired"));
                            break;
                        case "REACTOR_ALREADY_SCANNED":
                            setScanFeedback(t("game.sabotage.messages.reactorAlreadyScanned"));
                            break;
                        case "REACTOR_DISTINCT_CREWMATE_REQUIRED":
                            setScanFeedback(t("game.sabotage.messages.reactorDistinctCrewmateRequired"));
                            break;
                        default:
                            setScanFeedback(t("game.sabotage.messages.scanHandled"));
                    }
                } else {
                    setScanFeedback(
                        getLocalizedErrorMessage({
                            t,
                            code: sabotageResponse.code,
                            fallback: sabotageResponse.error,
                        }),
                    );
                }

                await refreshGameData(gameState.id, userId);
                return true;
            }

            if (!sabotageResponse.success && sabotageCodes.has(sabotageResponse.code || "")) {
                const shouldHideInactiveSabotageMessage =
                    currentPlayer.role === "CREWMATE" &&
                    sabotageResponse.code === "ERR_SABOTAGE_NOT_ACTIVE";

                if (!shouldHideInactiveSabotageMessage) {
                    setScanFeedback(
                        getLocalizedErrorMessage({
                            t,
                            code: sabotageResponse.code,
                            fallback: sabotageResponse.error,
                        }),
                    );
                }
                return true;
            }

            if (currentPlayer.role === "CREWMATE" && communicationsSabotaged) {
                setScanFeedback(t("game.sabotage.messages.communicationsQuestBlocked"));
                return false;
            }

            await originalHandleScan(questId);
            return true;
        } catch (error) {
            console.error("Failed to process scan:", error);
            setScanFeedback(t("errors.codes.ERR_SIGNAL_LOST"));
            return true;
        }
    };

    const handleElimination = async () => {
        const success = await eliminatePlayerAction(gameState.id, userId);
        if (!success) {
            console.error("Elimination failed");
        }
    };

    if (!currentPlayer.role) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-start bg-background text-foreground font-mono px-4 pt-16 pb-4 sm:pt-20 overflow-y-auto">
                <div className="max-w-2xl w-full border-2 border-destructive/20 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm">
                    <div className="text-destructive text-center tracking-[0.2em] uppercase text-sm font-orbitron">
                        {t("game.home.roleAssignmentErrorTitle")}
                    </div>
                    <p className="text-muted-foreground text-center font-rajdhani">
                        {t("game.home.roleAssignmentErrorMessage")}
                    </p>
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors uppercase tracking-widest font-rajdhani touch-manipulation min-h-[44px] border border-primary/20 p-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t("game.home.returnHome")}
                    </Link>
                </div>
            </main>
        );
    }

    const role = currentPlayer.role;
    const isImpostor = role === "IMPOSTOR";
    const ghostReminderCrewmate = (() => {
        try {
            return t("game.home.ghostReminderCrewmate");
        } catch {
            return isFrench
                ? "Fantôme: restez muet. Vous pouvez finir vos quêtes, mais pas stopper les sabotages."
                : "Ghost: stay silent. You can finish quests, but you cannot stop sabotages.";
        }
    })();
    const ghostReminderImpostor = (() => {
        try {
            return t("game.home.ghostReminderImpostor");
        } catch {
            return isFrench
                ? "Fantôme: restez muet. Vous pouvez encore déclencher des sabotages."
                : "Ghost: stay silent. You can still trigger sabotages.";
        }
    })();
    const ghostReminderMessage = isImpostor
        ? ghostReminderImpostor
        : ghostReminderCrewmate;
    const hasUsedBuzzer = Boolean(currentPlayer.meetingBuzzUsedAt);
    const canUseBuzzer =
        (currentPlayer.isAlive || hasPostEliminationBuzzerWindow) &&
        (!hasActiveSabotage || hasPostEliminationBuzzerWindow) &&
        !hasUsedBuzzer &&
        !isMeetingActive &&
        gameState.status === "IN_PROGRESS";

    const handleBuzz = async () => {
        const success = await triggerMeetingAction(gameState.id, userId);
        if (!success) {
            console.error("Meeting trigger failed");
        }
    };

    const dismissMeetingPopup = () => {
        if (meetingPopupStorageKey) {
            sessionStorage.setItem(meetingPopupStorageKey, "true");
        }
        setShowMeetingPopup(false);
    };

    const dismissGhostPopup = () => {
        sessionStorage.setItem(ghostPopupStorageKey, "true");
        setShowGhostPopup(false);
    };

    return (
        <main className="flex h-[100dvh] overflow-hidden flex-col items-center justify-start bg-background text-foreground font-mono px-4 pt-16 pb-4 sm:pt-20">
            <div
                className={`max-w-2xl w-full border-2 p-6 md:p-10 bg-black/50 backdrop-blur-sm transition-all duration-500 ${
                    currentPlayer.isAlive
                        ? "border-primary/20 shadow-[0_0_50px_rgba(var(--primary),0.05)]"
                        : "border-red-500/40 shadow-[0_0_50px_rgba(239,68,68,0.2)]"
                } h-full min-h-0 flex flex-col`}
            >
                <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                    <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                        {t("game.home.title")}
                    </h1>
                    <div className="flex items-center gap-2">
                        <span
                            className={`w-2 h-2 rounded-full animate-pulse ${
                                currentPlayer.isAlive ? "bg-green-500" : "bg-red-500"
                            }`}
                            aria-hidden="true"
                        />
                        <span
                            className={`text-[10px] tracking-widest ${
                                currentPlayer.isAlive ? "text-green-400/80" : "text-red-400/80 font-bold"
                            }`}
                        >
                            {currentPlayer.isAlive ? t("game.home.statusActive") : t("game.home.statusDead")}
                        </span>
                        <span className="sr-only">
                            {currentPlayer.isAlive
                                ? t("game.home.screenReaderAlive")
                                : t("game.home.screenReaderDead")}
                        </span>
                    </div>
                </div>

                {isGameOver && gameWinner && (
                    <GameOverScreen winner={gameWinner} userRole={role} gameId={gameState.id} />
                )}

                <div className="min-h-0 flex-1 overflow-hidden flex flex-col gap-4">
                    <ReactorSabotageAlert gameState={gameState} />

                    {isAwaitingMeetingAfterDeath && (
                        <div className="border border-red-500/30 bg-red-950/35 p-3 text-center text-xs text-red-100 font-rajdhani tracking-wide">
                            {t("game.home.awaitingMeetingBanner")}
                        </div>
                    )}
                    {isGhostAfterMeeting && (
                        <div className="border border-blue-500/30 bg-blue-950/30 p-3 text-center text-xs text-blue-100 font-rajdhani tracking-wide">
                            {ghostReminderMessage}
                        </div>
                    )}

                    <div className="min-h-0 flex-1">
                        <QuestProgress
                            role={role}
                            completed={questsCompleted}
                            total={questsTotal}
                            isLoading={isLoading}
                            assignedQuests={currentPlayer.assignedQuests}
                            completedQuests={currentPlayer.completedQuests}
                            batchId={gameState.batchId}
                            currentPlayerId={currentPlayer.id}
                            communicationsSabotaged={currentPlayer.role === "CREWMATE" && communicationsSabotaged}
                            lightsSabotaged={currentPlayer.role === "CREWMATE" && lightsSabotaged}
                            gameStateOverride={gameState}
                            deadAwaitingMeeting={isAwaitingMeetingAfterDeath}
                        />
                    </div>

                    {!isImpostor && !allQuestsDone && !isMeetingActive && (
                        <ScanButton
                            disabled={isAwaitingMeetingAfterDeath}
                            disabledReason={isAwaitingMeetingAfterDeath ? "death-waiting" : "coming-soon"}
                            disabledHint={
                                isAwaitingMeetingAfterDeath ? t("game.home.awaitingMeetingScanDisabled") : null
                            }
                            communicationsSabotaged={!isAwaitingMeetingAfterDeath && communicationsSabotaged}
                            onClick={() => {
                                setScanFeedback(null);
                                openScanner();
                            }}
                        />
                    )}

                    {isImpostor ? (
                        <div className="shrink-0">
                            <BuzzerButton
                                onBuzz={handleBuzz}
                                disabled={!canUseBuzzer || isTriggeringMeeting}
                                isBuzzing={isTriggeringMeeting}
                                hasUsed={hasUsedBuzzer}
                                meetingActive={isMeetingActive}
                                className="w-full min-h-[56px] justify-center gap-2 px-4 py-3 text-[11px] border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary-foreground tracking-[0.14em]"
                            />
                        </div>
                    ) : (
                        <div className="shrink-0 grid grid-cols-2 gap-3">
                            <BuzzerButton
                                onBuzz={handleBuzz}
                                disabled={!canUseBuzzer || isTriggeringMeeting}
                                isBuzzing={isTriggeringMeeting}
                                hasUsed={hasUsedBuzzer}
                                meetingActive={isMeetingActive}
                                className="w-full min-h-[56px] justify-center gap-2 px-4 py-3 text-[11px] border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary-foreground tracking-[0.12em]"
                            />
                            <EliminationButton
                                onEliminate={handleElimination}
                                disabled={
                                    isEliminating ||
                                    !currentPlayer.isAlive ||
                                    isMeetingActive ||
                                    gameState.status !== "IN_PROGRESS"
                                }
                                isEliminating={isEliminating}
                                className="w-full min-h-[56px] justify-center gap-2 px-4 py-3 text-[11px] tracking-[0.12em]"
                            />
                        </div>
                    )}

                    {!isImpostor && !allQuestsDone && !isAwaitingMeetingAfterDeath && (
                        <CameraScanner
                            isOpen={isOpen}
                            onClose={closeScanner}
                            onScan={handleScan}
                            statusMessage={scanFeedback}
                        />
                    )}

                </div>

                <div className="pt-4 flex justify-between items-center">
                    <div className="text-[8px] opacity-40 text-muted-foreground uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)]">
                        {t("game.home.footerRole", { role: currentPlayer.role })}
                    </div>
                    <div
                        className={`text-[8px] uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)] ${
                            currentPlayer.isAlive ? "opacity-40 text-muted-foreground" : "text-red-500 font-bold"
                        }`}
                    >
                        {currentPlayer.isAlive
                            ? t("game.home.footerStatusReady")
                            : t("game.home.footerStatusEliminated")}
                    </div>
                </div>

                {eliminationError && (
                    <div className="mt-2 p-2 border border-destructive/20 bg-destructive/10 text-destructive text-xs text-center">
                        {getLocalizedErrorMessage({
                            t,
                            code: eliminationErrorCode,
                            fallback: eliminationError,
                        })}
                    </div>
                )}
                {meetingError && (
                    <div className="mt-2 p-2 border border-destructive/20 bg-destructive/10 text-destructive text-xs text-center">
                        {getLocalizedErrorMessage({
                            t,
                            code: meetingErrorCode,
                            fallback: meetingError,
                        })}
                    </div>
                )}
                {scanFeedback && !isOpen && (
                    <div className="mt-2 p-2 border border-primary/20 bg-primary/10 text-primary text-xs text-center">
                        {scanFeedback}
                    </div>
                )}
            </div>

            {showMeetingPopup && isMeetingActive && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="max-w-md w-full border border-red-500/30 bg-black p-6 space-y-4 shadow-xl">
                        <h2 className="text-lg font-bold uppercase tracking-wider text-red-300 font-orbitron">
                            {t("game.home.meetingTriggeredTitle")}
                        </h2>
                        <p className="text-sm text-muted-foreground font-rajdhani">
                            {t("game.home.meetingTriggeredMessage")}
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Link
                                href={`/game/${gameState.id}/meeting`}
                                onClick={dismissMeetingPopup}
                                className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-500 transition-colors font-rajdhani uppercase tracking-widest"
                            >
                                {t("game.home.meetingJoin")}
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {showGhostPopup && !isGameOver && isGhostAfterMeeting && (
                <EliminatedScreen
                    playerRole={currentPlayer.role}
                    phase="ghost-info"
                    onDismiss={dismissGhostPopup}
                />
            )}
        </main>
    );
}
