"use client";

import { useEffect, useCallback, useState } from "react";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { useParams } from "next/navigation";
import { useGameStore, useRealTimeGamePolling } from "@/lib/store/game-store";
import { useLocalUser } from "@/hooks/use-local-user";
import { JoinForm } from "@/components/game/join-form";
import { ErrorView } from "@/components/game/error-view";
import { RoleSelection } from "@/components/game/role-selection";
import { RoleTransition } from "@/components/effects/role-transition";
import { GameHome } from "@/components/game/game-home";
import { Rocket, Loader2, Wifi, WifiOff } from "lucide-react";

export default function LobbyPage() {
    const { id } = useParams();
    const { gameState, isLoading, isLaunching, error, errorCode, launchError, selectedRole, fetchGame, launch } = useGameStore();
    const { userId } = useLocalUser();
    const [showTransition, setShowTransition] = useState(false);
    const [showGameHome, setShowGameHome] = useState(false);

    // Real-time polling for lobby updates
    const { 
        gameState: realTimeGameState, 
        isConnected, 
        isGameInProgress: realTimeGameInProgress,
        playerCount: realTimePlayerCount,
        newPlayers
    } = useRealTimeGamePolling(id as string || '', userId ?? undefined, true);

    // Use real-time data when available, fallback to store data
    const currentGameState = realTimeGameState || gameState;
    const currentPlayerCount = realTimePlayerCount || currentGameState?.players.length || 0;
    const currentGameInProgress = realTimeGameInProgress || currentGameState?.status === 'IN_PROGRESS';

    useEffect(() => {
        if (id) {
            fetchGame(id as string, userId ?? undefined);
        }
    }, [id, userId, fetchGame]);

    // Game start detection - redirect when game starts
    useEffect(() => {
        if (currentGameInProgress && currentGameState && !showTransition && !showGameHome) {
            const currentPlayer = currentGameState.players.find((p) => p.id === userId);
            
            // Haptic feedback for game start
            try {
                if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                    navigator.vibrate([100, 50, 100]);
                }
            } catch {
                // Ignore haptic failures
            }
            
            // If player has no role, they need to select one first
            if (!currentPlayer?.role) {
                // Role selection will be handled by existing logic below
                return;
            }
            
            // Player has role, show game home (using setTimeout to avoid setState in effect)
            setTimeout(() => setShowGameHome(true), 0);
        }
    }, [currentGameInProgress, currentGameState, userId, showTransition, showGameHome]);

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
    const canLaunch = currentGameState && currentPlayerCount >= 1 && currentGameState.status === "LOBBY";
    
    // Get current player's role
    const currentPlayer = currentGameState?.players.find((p) => p.id === userId);
    const hasRole = currentPlayer?.role !== undefined;

    const handleRoleSelected = useCallback(() => {
        setShowTransition(true);
    }, []);

    const handleTransitionComplete = useCallback(() => {
        setShowTransition(false);
        setShowGameHome(true);
    }, []);

    // Derive whether to show game home: either after transition completes,
    // or directly if player already has a role (idempotency / page reload)
    const shouldShowGameHome = currentGameInProgress && hasRole && (showGameHome || !showTransition);

    if (isLoading || !userId) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-primary/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm animate-pulse">
                    <div className="text-primary text-center tracking-[0.2em] uppercase text-sm font-orbitron">
                        Establishing Uplink...
                    </div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <ErrorView
                    title={errorCode === ERROR_CODES.GAME_NOT_FOUND ? "SESSION DECOMMISSIONED" : "SIGNAL INTERRUPTED"}
                    message={error}
                    code={errorCode || "ERR_UNKNOWN_SIG"}
                    onRetry={() => {
                        if (id) fetchGame(id as string);
                    }}
                />
            </main>
        );
    }

    // Show role transition animation
    if (showTransition && selectedRole) {
        return <RoleTransition role={selectedRole} gameId={id as string} onComplete={handleTransitionComplete} />;
    }

    // Show game home after role selection
    if (shouldShowGameHome && currentPlayer) {
        return <GameHome gameState={currentGameState!} currentPlayer={currentPlayer} userId={userId} />;
    }

    // Show role selection when game is IN_PROGRESS and no role selected yet
    if (currentGameInProgress && !hasRole) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-primary/20 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm shadow-[0_0_50px_rgba(var(--primary),0.05)]">
                    <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                        <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                            Mission Active
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full animate-pulse bg-green-500" />
                            <span className="text-[10px] text-green-400/80 tracking-widest">
                                IN_PROGRESS
                            </span>
                        </div>
                    </div>
                    <RoleSelection gameId={id as string} onRoleSelected={handleRoleSelected} />
                </div>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
            <div className="max-w-2xl w-full border-2 border-primary/20 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm shadow-[0_0_50px_rgba(var(--primary),0.05)]">
                <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                    <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                        {isJoined ? "Cockpit Terminal" : "Inbound Entry"}
                    </h1>
                    <div className="flex items-center gap-4">
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
                                {isConnected ? 'SYNC' : 'OFFLINE'}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full animate-pulse ${isJoined ? 'bg-primary' : 'bg-yellow-500'}`} />
                            <span className="text-[10px] text-primary/80 tracking-widest">
                                {isJoined ? "SESSION_ACTIVE" : "PENDING_AUTH"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 py-8 min-h-[300px] flex items-center justify-center">
                    {!isJoined ? (
                        <JoinForm gameId={id as string} userId={userId} />
                    ) : (
                        <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-primary/5 p-6 border border-primary/10 rounded-sm">
                                <label className="text-[8px] text-primary/50 uppercase block mb-1 tracking-widest">
                                    Game Identifier
                                </label>
                                <div className="text-xl md:text-2xl font-black tracking-tight text-foreground break-all">
                                    {currentGameState?.id}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[8px] text-primary/50 uppercase block tracking-widest">
                                    Manifest: Crew Members ({currentPlayerCount})
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                                                            NEW
                                                        </span>
                                                    )}
                                                </span>
                                                {player.id === userId && (
                                                    <span className="text-[8px] opacity-50 px-2 py-0.5 border border-primary/50">YOU</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

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
                                            Lancement...
                                        </>
                                    ) : (
                                        <>
                                            <Rocket className="w-5 h-5" />
                                            Lancer la partie
                                        </>
                                    )}
                                </span>
                            </button>

                            {launchError && (
                                <div className="p-4 border-l-4 border-destructive/50 bg-destructive/5 text-xs text-destructive/80 tracking-wide space-y-2">
                                    <div className="font-bold uppercase">Launch Failed</div>
                                    <div>{launchError}</div>
                                    <button
                                        onClick={handleLaunch}
                                        className="mt-2 px-4 py-2 border border-destructive/30 text-destructive/70 text-xs uppercase tracking-widest hover:bg-destructive/10 transition-colors touch-manipulation"
                                    >
                                        Retry Launch
                                    </button>
                                </div>
                            )}

                            {!launchError && !canLaunch && currentPlayerCount === 0 && (
                                <div className="p-4 border-l-4 border-yellow-500/30 bg-yellow-500/5 text-xs text-yellow-500/80 italic tracking-wide">
                                    Awaiting crew members before launch authorization...
                                </div>
                            )}

                            {!launchError && canLaunch && (
                                <div className="p-4 border-l-4 border-primary/30 bg-primary/5 text-xs text-muted-foreground italic tracking-wide">
                                    System ready. Commander may launch the mission.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="pt-4 flex justify-between items-center opacity-40">
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest">
                        SEC_ENC: AES-256-BMAD
                    </div>
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest">
                        EST_PING: 14MS
                    </div>
                </div>
            </div>
        </main>
    );
}
