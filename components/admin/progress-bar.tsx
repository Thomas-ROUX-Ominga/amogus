"use client";

import { GameState } from "@/types/game";
import { getTotalQuests, calculateGlobalProgress, calculatePlayerProgress } from "@/lib/utils/quest-calculations";

interface ProgressBarProps {
    gameState: GameState;
}

export function ProgressBar({ gameState }: ProgressBarProps) {
    const progress = calculateGlobalProgress(gameState.players, gameState);
    const totalQuests = getTotalQuests(gameState);
    let totalCompleted = 0;
    
    gameState.players.forEach(player => {
        totalCompleted += player.completedQuests?.length || 0;
    });

    return (
        <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm shadow-[0_0_50px_rgba(var(--primary),0.05)]">
            <div className="flex items-center justify-between border-b border-primary/20 pb-4 mb-6">
                <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-primary font-orbitron">
                    Global Progress
                </h2>
                <div className="text-[10px] text-primary/50 tracking-widest">
                    CREW WIDE
                </div>
            </div>

            <div className="space-y-4">
                {/* Main Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Mission Completion</span>
                        <span className="text-primary font-bold">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-1000 ease-out relative"
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 border border-primary/20 bg-primary/5">
                        <div className="text-lg font-bold text-primary">
                            {totalCompleted}
                        </div>
                        <div className="text-[8px] text-primary/50 tracking-widest uppercase">
                            Quests Done
                        </div>
                    </div>
                    <div className="p-3 border border-white/20 bg-white/5">
                        <div className="text-lg font-bold text-muted-foreground">
                            {gameState.players.length * totalQuests}
                        </div>
                        <div className="text-[8px] text-muted-foreground/50 tracking-widest uppercase">
                            Total Possible
                        </div>
                    </div>
                </div>

                {/* Progress by Player */}
                <div className="space-y-2">
                    <div className="text-[8px] text-primary/50 tracking-widest uppercase">
                        Individual Progress
                    </div>
                    {gameState.players.map(player => {
                        const playerProgress = calculatePlayerProgress(player.completedQuests, gameState);
                        
                        return (
                            <div key={player.id} className="flex items-center gap-3 text-xs">
                                <span className="w-16 truncate">{player.name}</span>
                                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-primary/60 transition-all duration-500"
                                        style={{ width: `${playerProgress}%` }}
                                    />
                                </div>
                                <span className="w-8 text-right text-primary/50">
                                    {playerProgress.toFixed(0)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
