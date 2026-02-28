"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { GameState, Player } from "@/types/game";
import { useGameStore } from "@/lib/store/game-store";
import { RoleBadge } from "@/components/game/role-badge";
import { QuestProgress } from "@/components/game/quest-progress";
import { ScanButton } from "@/components/game/scan-button";
import { CameraScanner } from "@/components/game/camera-scanner";
import { EliminationButton } from "@/components/game/elimination-button";
import { EliminatedScreen } from "@/components/game/eliminated-screen";
import { useCameraScanner } from "@/hooks/use-camera-scanner";
import { getBatch } from "@/lib/redis/batch-actions";

interface GameHomeProps {
    gameState: GameState;
    currentPlayer: Player;
    userId: string;
}

export function GameHome({ gameState, currentPlayer, userId }: GameHomeProps) {
    const [showEliminatedOverlay, setShowEliminatedOverlay] = React.useState(!currentPlayer.isAlive);
    const { 
        questsCompleted, 
        questsTotal, 
        isLoading,
        impostorQuestsInitialized,
        initializeImpostorQuests,
        generateImpostorQuestAssignments,
        completeImpostorQuest,
        setImpostorQuestLocation,
        isEliminating,
        eliminationError,
        eliminatePlayerAction
    } = useGameStore();
    
    // Sync local overlay state with player alive status
    useEffect(() => {
        if (!currentPlayer.isAlive) {
            setShowEliminatedOverlay(true);
        }
    }, [currentPlayer.isAlive]);

    // Camera scanner state management
    const { isOpen, openScanner, closeScanner, handleScan: originalHandleScan } = useCameraScanner({
        gameId: gameState.id,
    });

    // Wrapper for handleScan to also complete impostor quests
    const handleScan = async (questId: string) => {
        // For impostors, also mark quest as completed in their fake quest list
        if (currentPlayer.role === "IMPOSTOR") {
            const { getImpostorQuestData } = useGameStore.getState();
            const impostorQuestData = getImpostorQuestData();
            
            // Find the next uncompleted quest and mark it as complete
            const nextUncompletedQuest = impostorQuestData.quests.find(q => !q.completed);
            if (nextUncompletedQuest) {
                // Set location based on current quest being scanned
                const location = `Scanned Location ${Date.now() % 100}`; // Simple location placeholder
                setImpostorQuestLocation(nextUncompletedQuest.id, location);
                completeImpostorQuest(nextUncompletedQuest.id);
            }
        }

        // Call original handleScan for navigation
        await originalHandleScan(questId);
    };

    // Initialize impostor quests when player is an impostor and quests aren't initialized yet
    useEffect(() => {
        const initializeImpostorQuestsIfNeeded = async () => {
            if (currentPlayer.role === "IMPOSTOR" && !impostorQuestsInitialized && gameState.batchId) {
                try {
                    // Load batch data to generate fake quest assignments
                    const batchResponse = await getBatch(gameState.batchId);
                    if (batchResponse.success && batchResponse.data && gameState.questsPerPlayer) {
                        const fakeAssignments = generateImpostorQuestAssignments(
                            batchResponse.data.quests,
                            gameState.questsPerPlayer
                        );
                        initializeImpostorQuests(fakeAssignments);
                    }
                } catch (error) {
                    console.error("Failed to initialize impostor quests:", error);
                }
            }
        };

        initializeImpostorQuestsIfNeeded();
    }, [currentPlayer.role, impostorQuestsInitialized, gameState.batchId, gameState.questsPerPlayer, initializeImpostorQuests, generateImpostorQuestAssignments]);
    
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
                        Role Assignment Error
                    </div>
                    <p className="text-muted-foreground text-center font-rajdhani">
                        Your role has not been assigned yet. Please refresh the page or return to the lobby.
                    </p>
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors uppercase tracking-widest font-rajdhani touch-manipulation min-h-[44px] border border-primary/20 p-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Return to Home
                    </Link>
                </div>
            </main>
        );
    }
    
    const role = currentPlayer.role;

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
            <div className="max-w-2xl w-full border-2 border-primary/20 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm shadow-[0_0_50px_rgba(var(--primary),0.05)]">
                {/* Header: Title + Status Indicator */}
                <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                    <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                        Game Cockpit
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full animate-pulse bg-green-500" aria-hidden="true" />
                        <span className="text-[10px] text-green-400/80 tracking-widest">
                            ACTIVE
                        </span>
                        <span className="sr-only">Game is active</span>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Role Badge */}
                    <RoleBadge role={role} />

                    {/* Quest Progress (Crewmate only) */}
                    <QuestProgress
                        role={role}
                        completed={questsCompleted}
                        total={questsTotal}
                        isLoading={isLoading}
                    />

                    {/* Player List */}
                    <div className="p-6 border border-primary/20 bg-black/30">
                        <div className="text-xs text-primary/60 uppercase tracking-widest mb-4 font-rajdhani">
                            Joueurs connectés ({gameState.players.length})
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
                                                    HOST
                                                </span>
                                            )}
                                            {player.id === userId && (
                                                <span className="text-[8px] opacity-50 px-2 py-0.5 border border-primary/50">
                                                    YOU
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>

                    {/* SCAN Button (thumb zone — bottom) */}
                    {gameState.creatorId !== userId && (
                        <ScanButton 
                            disabled={false} 
                            onClick={openScanner}
                            gameId={gameState.id}
                        />
                    )}

                    {/* Camera Scanner Overlay */}
                    {gameState.creatorId !== userId && (
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
                            onDismiss={currentPlayer.role === "CREWMATE" ? () => setShowEliminatedOverlay(false) : undefined}
                        />
                    )}

                    {/* No Dead End — Return link */}
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest font-rajdhani touch-manipulation min-h-[44px]"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour à l&apos;accueil
                    </Link>
                </div>

                {/* Footer */}
                <div className="pt-4 flex justify-between items-center opacity-40">
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)]">
                        Role: {currentPlayer.role}
                    </div>
                    {gameState.creatorId !== userId && (
                        <EliminationButton
                            onEliminate={handleElimination}
                            disabled={isEliminating}
                            isEliminating={isEliminating}
                        />
                    )}
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)]">
                        Status: {currentPlayer.isAlive ? "READY" : "ELIMINATED"}
                    </div>
                </div>
                
                {/* Elimination error display */}
                {eliminationError && (
                    <div className="mt-2 p-2 border border-destructive/20 bg-destructive/10 text-destructive text-xs text-center">
                        {eliminationError}
                    </div>
                )}
            </div>
        </main>
    );
}
