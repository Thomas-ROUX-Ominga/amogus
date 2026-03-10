"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { GameState, Player } from "@/types/game";
import { useGameStore } from "@/lib/store/game-store";
import { RoleBadge } from "@/components/game/role-badge";
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
import { getGlobalQuestStats } from "@/lib/utils/quest-calculations";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";

interface GameHomeProps {
    gameState: GameState;
    currentPlayer: Player;
    userId: string;
}

export function GameHome({ gameState, currentPlayer, userId }: GameHomeProps) {
    const t = useTranslations();
    const storageKey = `elimination-dismissed-${gameState.id}-${userId}`;
    const isMeetingActive = gameState.meeting?.status === "ACTIVE";
    const activeMeetingId = gameState.meeting?.id;
    const meetingPopupStorageKey = activeMeetingId
        ? `meeting-popup-dismissed-${gameState.id}-${activeMeetingId}-${userId}`
        : null;
    const [showEliminatedOverlay, setShowEliminatedOverlay] = React.useState(() => {
        if (currentPlayer.isAlive) return false;
        if (typeof window !== "undefined") {
            return !sessionStorage.getItem(storageKey);
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

    // Story 12.0: Check if all quests are finished to hide the scan button
    const allQuestsDone = questsTotal > 0 && questsCompleted >= questsTotal;

    // Sync local overlay state with player alive status
    useEffect(() => {
        if (!currentPlayer.isAlive) {
            const isDismissed = sessionStorage.getItem(storageKey);
            if (!isDismissed) {
                setShowEliminatedOverlay(true);
            }
        }
    }, [currentPlayer.isAlive, storageKey]);

    useEffect(() => {
        if (!isMeetingActive || !meetingPopupStorageKey) {
            setShowMeetingPopup(false);
            return;
        }

        const dismissed = sessionStorage.getItem(meetingPopupStorageKey);
        setShowMeetingPopup(!dismissed);
    }, [isMeetingActive, meetingPopupStorageKey]);

    // Camera scanner state management
    const { isOpen, openScanner, closeScanner, handleScan: originalHandleScan } = useCameraScanner({
        gameId: gameState.id,
    });

    const communicationsSabotaged = gameState.sabotageState?.active === "COMMUNICATIONS";
    const lightsSabotaged = gameState.sabotageState?.active === "LIGHTS";

    const sabotageCodes = new Set([
        "ERR_SABOTAGE_FORBIDDEN",
        "ERR_SABOTAGE_ALREADY_ACTIVE",
        "ERR_SABOTAGE_COOLDOWN",
        "ERR_SABOTAGE_NOT_ACTIVE",
        "ERR_SABOTAGE_COMMUNICATIONS_ACTIVE",
        "ERR_SABOTAGE_COMMUNICATIONS_QUESTS_BLOCKED",
    ]);

    // Wrapper for handleScan to intercept sabotage QR first
    const handleScan = async (questId: string) => {
        setScanFeedback(null);
        try {
            const sabotageResponse = await scanSabotage(gameState.id, userId, questId);
            const wasHandled = Boolean(sabotageResponse.data?.handled);

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
                return;
            }

            if (!sabotageResponse.success && sabotageCodes.has(sabotageResponse.code || "")) {
                setScanFeedback(
                    getLocalizedErrorMessage({
                        t,
                        code: sabotageResponse.code,
                        fallback: sabotageResponse.error,
                    }),
                );
                return;
            }

            if (currentPlayer.role === "CREWMATE" && communicationsSabotaged) {
                setScanFeedback(t("game.sabotage.messages.communicationsQuestBlocked"));
                return;
            }

            await originalHandleScan(questId);
        } catch (error) {
            console.error("Failed to process scan:", error);
            setScanFeedback(t("errors.codes.ERR_SIGNAL_LOST"));
        }
    };
    
    // Elimination handler
    const handleElimination = async () => {
        const success = await eliminatePlayerAction(gameState.id, userId);
        if (!success) {
            console.error("Elimination failed");
        }
    };
    
    // Defensive validation: ensure role exists
    if (!currentPlayer.role) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
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
    const hasUsedBuzzer = Boolean(currentPlayer.meetingBuzzUsedAt);
    const canUseBuzzer =
        currentPlayer.isAlive &&
        currentPlayer.role !== "ADMIN" &&
        !(currentPlayer.role === "CREWMATE" && communicationsSabotaged) &&
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

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
            <div className={`max-w-2xl w-full border-2 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm transition-all duration-500 ${
                currentPlayer.isAlive 
                    ? "border-primary/20 shadow-[0_0_50px_rgba(var(--primary),0.05)]" 
                    : "border-red-500/40 shadow-[0_0_50px_rgba(239,68,68,0.2)]"
            }`}>
                {/* Header: Title + Status Indicator */}
                <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                    <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                        {t("game.home.title")}
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full animate-pulse ${currentPlayer.isAlive ? "bg-green-500" : "bg-red-500"}`} aria-hidden="true" />
                        <span className={`text-[10px] tracking-widest ${currentPlayer.isAlive ? "text-green-400/80" : "text-red-400/80 font-bold"}`}>
                            {currentPlayer.isAlive ? t("game.home.statusActive") : t("game.home.statusDead")}
                        </span>
                        <span className="sr-only">{currentPlayer.isAlive ? t("game.home.screenReaderAlive") : t("game.home.screenReaderDead")}</span>
                    </div>
                </div>

                {/* Victory/Defeat Overlay */}
                {gameState.status === "FINISHED" && gameState.winner && (
                    <GameOverScreen 
                        winner={gameState.winner}
                        userRole={role}
                        isHost={gameState.creatorId === userId}
                        gameId={gameState.id}
                    />
                )}

                <div className="space-y-6">
                    <ReactorSabotageAlert gameState={gameState} />

                    {/* Role Badge */}
                    <RoleBadge role={role} />

                    {/* Quest Progress (Crewmate and Host only) */}
                    <QuestProgress
                        role={role}
                        completed={
                            gameState.creatorId === userId 
                                ? getGlobalQuestStats(gameState.players, gameState).completed 
                                : questsCompleted
                        }
                        total={
                            gameState.creatorId === userId 
                                ? getGlobalQuestStats(gameState.players, gameState).total 
                                : questsTotal
                        }
                        isLoading={isLoading}
                        assignedQuests={currentPlayer.assignedQuests}
                        completedQuests={currentPlayer.completedQuests}
                        batchId={gameState.batchId}
                        currentPlayerId={currentPlayer.id}
                        communicationsSabotaged={currentPlayer.role === "CREWMATE" && communicationsSabotaged}
                        lightsSabotaged={currentPlayer.role === "CREWMATE" && lightsSabotaged}
                        gameStateOverride={gameState}
                    />

                    {/* Player List (Host Only) */}
                    {gameState.creatorId === userId && (
                        <div className="p-6 border border-primary/20 bg-black/30">
                            <div className="text-xs text-primary/60 uppercase tracking-widest mb-4 font-rajdhani">
                            {t("game.home.connectedPlayers", { count: String(gameState.players.length) })}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {gameState.players
                                .filter((player) => player.id && player.name)
                                .map((player) => (
                                    <div
                                        key={player.id}
                                        className={`p-3 border text-xs tracking-widest uppercase flex items-center justify-between ${
                                            player.id === userId
                                                ? "border-primary bg-primary/10 text-primary font-bold"
                                                : "border-white/10 bg-white/5 text-muted-foreground"
                                        }`}
                                    >
                                        <span>{player.name}</span>
                                        <div className="flex items-center gap-2">
                                            {player.id === gameState.creatorId && player.id !== userId && (
                                                <span className="text-[8px] bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/30 font-bold">
                                                    {t("game.home.host")}
                                                </span>
                                            )}
                                            {player.id === userId && (
                                                <span className="text-[8px] opacity-50 px-2 py-0.5 border border-primary/50">
                                                    {t("game.home.you")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                        </div>
                    )}

                    {/* SCAN Button (thumb zone — bottom) */}
                    {gameState.creatorId !== userId && !allQuestsDone && !isMeetingActive && (
                        <ScanButton 
                            disabled={false} 
                            onClick={openScanner}
                        />
                    )}

                    {/* Camera Scanner Overlay */}
                    {gameState.creatorId !== userId && !allQuestsDone && !isMeetingActive && (
                        <CameraScanner
                            isOpen={isOpen}
                            onClose={closeScanner}
                            onScan={handleScan}
                            isPlayerEliminated={!currentPlayer.isAlive}
                            playerRole={currentPlayer.role}
                        />
                    )}

                    {/* Prominent Elimination Overlay */}
                    {showEliminatedOverlay && (
                        <EliminatedScreen 
                            playerName={currentPlayer.name}
                            playerRole={currentPlayer.role}
                            onDismiss={() => {
                                sessionStorage.setItem(storageKey, "true");
                                setShowEliminatedOverlay(false);
                            }}
                        />
                    )}

                    {/* No Dead End — Return link */}
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest font-rajdhani touch-manipulation min-h-[44px]"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t("game.home.returnHome")}
                    </Link>
                </div>

                {/* Footer */}
                <div className="pt-4 flex justify-between items-center">
                    <div className="text-[8px] opacity-40 text-muted-foreground uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)]">
                        {t("game.home.footerRole", { role: currentPlayer.role })}
                    </div>
                    <div className="flex items-center gap-2">
                        {currentPlayer.role !== "ADMIN" && (
                            <BuzzerButton
                                onBuzz={handleBuzz}
                                disabled={!canUseBuzzer || isTriggeringMeeting}
                                isBuzzing={isTriggeringMeeting}
                                hasUsed={hasUsedBuzzer}
                                meetingActive={isMeetingActive}
                            />
                        )}
                        {gameState.creatorId !== userId && (
                            <EliminationButton
                                onEliminate={handleElimination}
                                disabled={isEliminating || !currentPlayer.isAlive || isMeetingActive}
                                isEliminating={isEliminating}
                            />
                        )}
                    </div>
                    <div className={`text-[8px] uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)] ${currentPlayer.isAlive ? "opacity-40 text-muted-foreground" : "text-red-500 font-bold"}`}>
                        {currentPlayer.isAlive ? t("game.home.footerStatusReady") : t("game.home.footerStatusEliminated")}
                    </div>
                </div>
                
                {/* Elimination error display */}
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
                {scanFeedback && (
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
                            <button
                                type="button"
                                onClick={dismissMeetingPopup}
                                className="px-4 py-2 text-sm border border-primary/20 hover:bg-primary/10 transition-colors font-rajdhani uppercase tracking-widest"
                            >
                                {t("game.home.meetingLater")}
                            </button>
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
        </main>
    );
}
