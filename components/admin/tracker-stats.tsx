"use client";

import { GameState } from "@/types/game";
import { getTotalQuests, calculateGlobalProgress } from "@/lib/utils/quest-calculations";

interface TrackerStatsProps {
    gameState: GameState;
}

export function TrackerStats({ gameState }: TrackerStatsProps) {
    const totalQuests = getTotalQuests(gameState);
    let totalCompleted = 0;
    let activePlayers = 0;
    let eliminatedPlayers = 0;
    let crewmateCount = 0;
    let impostorCount = 0;

    gameState.players.forEach(player => {
        totalCompleted += player.completedQuests?.length || 0;
        
        if (player.isAlive) {
            activePlayers++;
        } else {
            eliminatedPlayers++;
        }

        if (player.role === "CREWMATE") {
            crewmateCount++;
        } else if (player.role === "IMPOSTOR") {
            impostorCount++;
        }
    });

    const averageProgress = calculateGlobalProgress(gameState.players);

    return (
        <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm shadow-[0_0_50px_rgba(var(--primary),0.05)]">
            <div className="flex items-center justify-between border-b border-primary/20 pb-4 mb-6">
                <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-primary font-orbitron">
                    Mission Stats
                </h2>
                <div className="text-[10px] text-primary/50 tracking-widest">
                    LIVE DATA
                </div>
            </div>

            <div className="space-y-4">
                {/* Game Status */}
                <div className="p-3 border border-primary/20 bg-primary/5">
                    <div className="text-sm font-bold text-primary uppercase tracking-widest">
                        {gameState.status}
                    </div>
                    <div className="text-[8px] text-primary/50 mt-1">
                        Game Status
                    </div>
                </div>

                {/* Player Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 border border-green-500/20 bg-green-500/5">
                        <div className="text-lg font-bold text-green-400">
                            {activePlayers}
                        </div>
                        <div className="text-[8px] text-green-400/50 tracking-widest uppercase">
                            Active
                        </div>
                    </div>
                    <div className="p-3 border border-red-500/20 bg-red-500/5">
                        <div className="text-lg font-bold text-red-400">
                            {eliminatedPlayers}
                        </div>
                        <div className="text-[8px] text-red-400/50 tracking-widest uppercase">
                            Eliminated
                        </div>
                    </div>
                </div>

                {/* Role Distribution */}
                <div className="space-y-2">
                    <div className="text-[8px] text-primary/50 tracking-widest uppercase">
                        Role Distribution
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 border border-blue-500/20 bg-blue-500/5">
                            <div className="text-lg font-bold text-blue-400">
                                {crewmateCount}
                            </div>
                            <div className="text-[8px] text-blue-400/50 tracking-widest uppercase">
                                Crewmates
                            </div>
                        </div>
                        <div className="p-3 border border-red-500/20 bg-red-500/5">
                            <div className="text-lg font-bold text-red-400">
                                {impostorCount}
                            </div>
                            <div className="text-[8px] text-red-400/50 tracking-widest uppercase">
                                Impostors
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quest Stats */}
                <div className="space-y-2">
                    <div className="text-[8px] text-primary/50 tracking-widest uppercase">
                        Quest Progress
                    </div>
                    <div className="p-3 border border-white/20 bg-white/5">
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="text-lg font-bold text-muted-foreground">
                                    {totalCompleted}
                                </div>
                                <div className="text-[8px] text-muted-foreground/50 tracking-widest uppercase">
                                    Completed
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-bold text-primary/50">
                                    {gameState.players.length * totalQuests}
                                </div>
                                <div className="text-[8px] text-primary/30 tracking-widest uppercase">
                                    Possible
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Average Progress */}
                <div className="space-y-2">
                    <div className="text-[8px] text-primary/50 tracking-widest uppercase">
                        Crew Performance
                    </div>
                    <div className="p-3 border border-primary/20 bg-primary/5">
                        <div className="text-lg font-bold text-primary">
                            {averageProgress.toFixed(1)}%
                        </div>
                        <div className="text-[8px] text-primary/50 tracking-widest uppercase">
                            Average Progress
                        </div>
                    </div>
                </div>

                {/* Game ID */}
                <div className="p-3 border border-white/10 bg-white/5">
                    <div className="text-xs font-mono text-muted-foreground break-all">
                        {gameState.id}
                    </div>
                    <div className="text-[8px] text-muted-foreground/50 tracking-widest uppercase mt-1">
                        Game Identifier
                    </div>
                </div>
            </div>
        </div>
    );
}
