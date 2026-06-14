"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useGameStore, useRealTimeGamePolling } from "@/lib/store/game-store";
import { useAuth } from "@/hooks/use-auth";
import { JoinForm } from "@/components/game/join-form";
import { ErrorView } from "@/components/game/error-view";
import { GameHome } from "@/components/game/game-home";
import { RoleRevealScreen } from "@/components/game/role-reveal-screen";
import { Rocket, Loader2, Wifi, WifiOff } from "lucide-react";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";

export default function LobbyPage() {
    const t = useTranslations();
    const { id } = useParams();
    const [showRoleReveal, setShowRoleReveal] = useState(false);
    const previousIsJoinedRef = useRef(false);
    const previousIsJoiningRef = useRef(false);
    const isJoinedRef = useRef(false);
    const roleRevealEligibleRef = useRef(false);
    const pendingRoleRevealRef = useRef(false);
    const {
        gameState,
        isLoading,
        isJoining,
        isLaunching,
        fatalError,
        fatalErrorCode,
        launchError,
        launchErrorCode,
        fetchGame,
        launch,
        reset,
    } = useGameStore();
    const { authState } = useAuth();
    
    // Reset state when switching between different games
    useEffect(() => {
        if (id && gameState && gameState.id !== id) {
            reset();
        }
    }, [id, gameState, reset]);

    // Cleanup store when leaving the game page
    useEffect(() => {
        return () => {
            reset();
        };
    }, [reset]);
    
    // Auth session is now the single source of truth for both admin and anonymous players.
    // AuthProvider ensures at least an anonymous session is always present.
    const userId = authState.session?.userId;
    // Real-time polling for lobby updates
    const { 
        isConnected, 
        syncStatus,
        isGameInProgress: realTimeGameInProgress,
        isGameFinished: realTimeGameFinished,
        playerCount: realTimePlayerCount,
        newPlayers
    } = useRealTimeGamePolling(id as string || '', userId ?? undefined, true);

    // Use store data as the primary source of truth (always freshest)
    const currentGameState = gameState;
    const currentPlayerCount = realTimePlayerCount || currentGameState?.players.length || 0;
    const currentGameInProgress = realTimeGameInProgress || currentGameState?.status === 'IN_PROGRESS';
    const currentGameFinished = realTimeGameFinished || currentGameState?.status === 'FINISHED';
    const isGameStarted = currentGameInProgress || currentGameFinished;

    useEffect(() => {
        if (id && userId && !gameState) {
            fetchGame(id as string, userId);
        }
    }, [id, userId, fetchGame, gameState]);

    const handleLaunch = useCallback(async () => {
        if (!id || isLaunching) return;
        const success = await launch(id as string);
        if (success) {
            try {
                if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                    navigator.vibrate([50, 30, 50]);
                }
            } catch {
                // Ignore haptic failures
            }
        }
    }, [id, isLaunching, launch]);

    // Check if the current user is already in the player list
    const isJoined = currentGameState?.players.some((p) => p.id === userId);
    const currentPlayer = currentGameState?.players.find((p) => p.id === userId);
    const hasRole = currentPlayer?.role !== undefined;
    
    // Only the game creator can launch the game
    const minimumPlayersToLaunch =
        currentGameState?.impostorMode === "manual"
            ? Math.max(1, currentGameState.manualImpostorCount || 1) * 2 + 1
            : currentGameState?.impostorMode === "auto"
            ? 3
            : 3;
    const canLaunch = Boolean(
        currentGameState &&
        currentPlayerCount >= minimumPlayersToLaunch &&
        currentGameState.status === "LOBBY" &&
        currentGameState.creatorId === userId
    );
    const shouldShowGameHome = isGameStarted && hasRole;

    useEffect(() => {
        isJoinedRef.current = Boolean(isJoined);
    }, [isJoined]);

    useEffect(() => {
        const wasJoining = previousIsJoiningRef.current;

        if (isJoining && !wasJoining) {
            roleRevealEligibleRef.current = true;
        }
        if (!isJoining && wasJoining && !isJoinedRef.current) {
            roleRevealEligibleRef.current = false;
        }

        previousIsJoiningRef.current = isJoining;
    }, [isJoining]);

    useEffect(() => {
        if (!isJoined) return;
        if (currentGameState?.status !== "LOBBY") return;
        if (currentPlayer?.role !== undefined) return;

        // Hosts and already-joined players skip the join action, so arm reveal in lobby.
        roleRevealEligibleRef.current = true;
    }, [isJoined, currentGameState?.status, currentPlayer?.role]);

    useEffect(() => {
        const nowJoined = Boolean(isJoined);
        const wasJoined = previousIsJoinedRef.current;

        if (nowJoined && !wasJoined) {
            pendingRoleRevealRef.current = roleRevealEligibleRef.current;
        } else if (!nowJoined) {
            pendingRoleRevealRef.current = false;
            setShowRoleReveal(false);
        }

        previousIsJoinedRef.current = nowJoined;
    }, [isJoined]);

    useEffect(() => {
        if (!pendingRoleRevealRef.current) return;
        if (!currentGameState || !currentPlayer) return;

        const shouldTriggerReveal =
            currentGameState.status === "IN_PROGRESS" && currentPlayer.role !== undefined;
        if (!shouldTriggerReveal) return;

        pendingRoleRevealRef.current = false;
        roleRevealEligibleRef.current = false;
        setShowRoleReveal(true);
    }, [currentGameState, currentPlayer]);

    if (isLoading || !userId) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-primary/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm animate-pulse">
                    <div className="text-primary text-center tracking-[0.2em] uppercase text-sm font-orbitron">
                        {t("game.lobby.establishingUplink")}
                    </div>
                </div>
            </main>
        );
    }

    if (fatalError) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <ErrorView
                    title={
                        fatalErrorCode === ERROR_CODES.GAME_NOT_FOUND
                            ? t("game.lobby.sessionDecommissioned")
                            : t("game.lobby.signalInterrupted")
                    }
                    message={getLocalizedErrorMessage({ t, code: fatalErrorCode, fallback: fatalError })}
                    code={fatalErrorCode || "ERR_UNKNOWN_SIG"}
                    onRetry={() => {
                        if (id && userId) fetchGame(id as string, userId);
                    }}
                />
            </main>
        );
    }

    if (showRoleReveal && currentPlayer?.role) {
        return (
            <RoleRevealScreen
                role={currentPlayer.role}
                onComplete={() => setShowRoleReveal(false)}
            />
        );
    }

    // Show game home as soon as roles are assigned
    if (shouldShowGameHome && currentPlayer) {
        return <GameHome gameState={currentGameState!} currentPlayer={currentPlayer} userId={userId} />;
    }

    // In auto-assignment mode, briefly show waiting UI until role assignment arrives
    if (currentGameInProgress && isJoined && !hasRole) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-primary/20 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm shadow-[0_0_50px_rgb(var(--primary-rgb)/0.05)]">
                    <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                        <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                            {t("game.lobby.missionActive")}
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full animate-pulse bg-green-500" />
                            <span className="text-[10px] text-green-400/80 tracking-widest">
                                {t("game.lobby.statusInProgress")}
                            </span>
                        </div>
                    </div>
                    <div className="p-6 border border-primary/20 bg-primary/5 text-center">
                        <div className="text-xs text-primary uppercase tracking-widest animate-pulse">
                            {t("game.lobby.assigningRoles")}
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="flex h-[100dvh] overflow-hidden flex-col items-center justify-start bg-background text-foreground font-mono px-4 pb-4 pt-20 md:pt-24">
            <div className="max-w-2xl w-full h-full max-h-full border-2 border-primary/20 p-8 md:p-12 bg-black/50 backdrop-blur-sm shadow-[0_0_50px_rgb(var(--primary-rgb)/0.05)] flex flex-col gap-6 overflow-hidden">
                <div className="flex flex-col items-start gap-3 border-b border-primary/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="text-lg sm:text-xl font-bold uppercase tracking-[0.22em] sm:tracking-[0.3em] text-primary font-orbitron leading-tight">
                        {isJoined ? t("game.lobby.cockpitTerminal") : t("game.lobby.inboundEntry")}
                    </h1>
                    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 sm:w-auto sm:justify-end">
                        {/* Connection Status Indicator */}
                        <div className="flex items-center gap-1">
                            {isConnected ? (
                                <Wifi className="w-3 h-3 text-green-400" />
                            ) : (
                                <WifiOff className="w-3 h-3 text-red-400" />
                            )}
                            <span className={`text-[8px] tracking-widest ${
                                isConnected ? 'text-green-400/80' : 'text-red-400/80'
                            }`}>
                                {isConnected
                                    ? t("game.lobby.sync")
                                    : syncStatus === "reconnecting"
                                    ? t("game.lobby.establishingUplink")
                                    : t("game.lobby.offline")}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full animate-pulse ${isJoined ? 'bg-primary' : 'bg-yellow-500'}`} />
                            <span className="text-[10px] text-primary/80 tracking-widest">
                                {isJoined ? t("game.lobby.sessionActive") : t("game.lobby.pendingAuth")}
                            </span>
                        </div>
                    </div>
                </div>

                <div className={isJoined ? "py-4 flex-1 min-h-0" : "space-y-4 py-8 min-h-[300px] flex items-center justify-center"}>
                    {!isJoined ? (
                        <JoinForm gameId={id as string} userId={userId} />
                    ) : (
                        <div className="w-full h-full min-h-0 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-primary/5 p-6 border border-primary/10 rounded-sm">
                                <label className="text-[8px] text-primary/50 uppercase block mb-1 tracking-widest">
                                    {t("game.lobby.gameIdentifier")}
                                </label>
                                <div className="text-xl md:text-2xl font-black tracking-tight text-foreground break-all">
                                    {currentGameState?.id}
                                </div>
                            </div>

                            <div className="space-y-4 flex-1 min-h-0 flex flex-col">
                                <label className="text-[8px] text-primary/50 uppercase block tracking-widest">
                                    {t("game.lobby.crewManifest", { count: String(currentPlayerCount) })}
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 overflow-y-auto min-h-0 px-1 py-1 pr-3">
                                    {currentGameState?.players.map((player, index) => {
                                        const isNewPlayer = newPlayers?.some(np => np.id === player.id);
                                        return (
                                            <div
                                                key={player.id}
                                                className={`p-3 border text-xs tracking-widest uppercase flex items-center justify-between animate-in fade-in zoom-in-95 duration-300 ${
                                                    player.id === userId
                                                        ? 'border-primary bg-primary/10 text-primary font-bold'
                                                        : isNewPlayer
                                                        ? 'border-green-500/50 bg-green-500/10 text-green-400 animate-pulse'
                                                        : 'border-white/10 bg-white/5 text-muted-foreground'
                                                }`}
                                                style={{ animationDelay: `${index * 100}ms` }}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {player.name}
                                                    {isNewPlayer && (
                                                        <span className="text-[8px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">
                                                            {t("game.lobby.new")}
                                                        </span>
                                                    )}
                                                    {player.id === currentGameState?.creatorId && player.id !== userId && (
                                                        <span className="text-[8px] bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/30 font-bold">
                                                            {t("game.lobby.host")}
                                                        </span>
                                                    )}
                                                </span>
                                                {player.id === userId && (
                                                    <span className="text-[8px] opacity-50 px-2 py-0.5 border border-primary/50">{t("game.lobby.you")}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {currentGameState?.creatorId === userId && (
                                <button
                                    onClick={handleLaunch}
                                    disabled={!canLaunch || isLaunching}
                                    className="w-full min-h-[44px] bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-black py-4 rounded-sm transition-all flex items-center justify-center gap-3 group relative overflow-hidden touch-manipulation font-orbitron"
                                >
                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 group-disabled:translate-y-full transition-transform duration-300" />
                                    <span className="relative flex items-center gap-3 tracking-[0.3em] uppercase text-sm">
                                        {isLaunching ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                {t("game.lobby.launching")}
                                            </>
                                        ) : (
                                            <>
                                                <Rocket className="w-5 h-5" />
                                                {t("game.lobby.launchGame")}
                                            </>
                                        )}
                                    </span>
                                </button>
                            )}

                            {launchError && (
                                <div className="p-4 border border-destructive/40 bg-destructive/5 text-xs text-destructive/80 tracking-wide space-y-2">
                                    <div className="font-bold uppercase">{t("game.lobby.launchFailedTitle")}</div>
                                    <div>
                                        {getLocalizedErrorMessage({
                                            t,
                                            code: launchErrorCode,
                                            fallback: launchError,
                                        })}
                                    </div>
                                    <button
                                        onClick={handleLaunch}
                                        className="mt-2 px-4 py-2 border border-destructive/30 text-destructive/70 text-xs uppercase tracking-widest hover:bg-destructive/10 transition-colors touch-manipulation"
                                    >
                                        {t("game.lobby.retryLaunch")}
                                    </button>
                                </div>
                            )}

                            {!launchError && !canLaunch && currentPlayerCount < minimumPlayersToLaunch && (
                                <div className="p-4 border border-yellow-500/30 bg-yellow-500/5 text-xs text-yellow-500/80 italic tracking-wide">
                                    {t("game.lobby.awaitingPlayers", {
                                        current: String(currentPlayerCount),
                                        required: String(minimumPlayersToLaunch),
                                    })}
                                </div>
                            )}

                            {!launchError && canLaunch && (
                                <div className="p-4 border border-primary/20 bg-primary/5 text-xs text-muted-foreground italic tracking-wide">
                                    {t("game.lobby.systemReady")}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="pt-4 flex justify-between items-center opacity-40">
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest">
                        {t("game.lobby.securityEncryption")}
                    </div>
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest">
                        {t("game.lobby.estimatedPing")}
                    </div>
                </div>
            </div>
        </main>
    );
}
