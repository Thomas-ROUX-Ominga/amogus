"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GameState, Player } from "@/types/game";
import { useGameStore } from "@/lib/store/game-store";
import { RoleBadge } from "@/components/game/role-badge";
import { QuestProgress } from "@/components/game/quest-progress";
import { ScanButton } from "@/components/game/scan-button";
import { CameraScanner } from "@/components/game/camera-scanner";
import { useCameraScanner } from "@/hooks/use-camera-scanner";

interface GameHomeProps {
    gameState: GameState;
    currentPlayer: Player;
    userId: string;
}

export function GameHome({ gameState, currentPlayer, userId }: GameHomeProps) {
    const { questsCompleted, questsTotal, isLoading } = useGameStore();
    
    // Camera scanner state management
    const { isOpen, openScanner, closeScanner, handleScan } = useCameraScanner({
        gameId: gameState.id,
    });
    
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
                                        {player.id === userId && (
                                            <span className="text-[8px] opacity-50 px-2 py-0.5 border border-primary/50">
                                                YOU
                                            </span>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>

                    {/* SCAN Button (thumb zone — bottom) */}
                    <ScanButton 
                        disabled={false} 
                        onClick={openScanner}
                        gameId={gameState.id}
                    />

                    {/* Camera Scanner Overlay */}
                    <CameraScanner
                        isOpen={isOpen}
                        onClose={closeScanner}
                        onScan={handleScan}
                    />

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
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)]">
                        Status: READY
                    </div>
                </div>
            </div>
        </main>
    );
}
