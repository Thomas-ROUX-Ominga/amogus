"use client";

import { Player } from "@/types/game";
import { getTotalQuests, calculatePlayerProgress } from "@/lib/utils/quest-calculations";

interface PlayerListProps {
    players: Player[];
    currentUserId: string;
}

export function PlayerList({ players, currentUserId }: PlayerListProps) {

    return (
        <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm shadow-[0_0_50px_rgba(var(--primary),0.05)]">
            <div className="flex items-center justify-between border-b border-primary/20 pb-4 mb-6">
                <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-primary font-orbitron">
                    Crew Manifest
                </h2>
                <div className="text-[10px] text-primary/50 tracking-widest">
                    {players.length} MEMBERS
                </div>
            </div>

            <div className="space-y-3">
                {players.map((player) => {
                    const isCurrentUser = player.id === currentUserId;
                    const completedCount = player.completedQuests?.length || 0;
                    const totalCount = getTotalQuests();
                    const completionPercentage = calculatePlayerProgress(player.completedQuests);

                    return (
                        <div
                            key={player.id}
                            className={`p-4 border text-xs tracking-widest uppercase flex items-center justify-between transition-all ${
                                isCurrentUser 
                                    ? 'border-primary bg-primary/10 text-primary font-bold' 
                                    : 'border-white/10 bg-white/5 text-muted-foreground hover:border-primary/30'
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <div>
                                    <div className="font-bold text-sm">{player.name}</div>
                                    <div className="text-[8px] opacity-50 mt-1">
                                        {player.role || 'NO_ROLE'} • {player.isAlive ? 'ACTIVE' : 'ELIMINATED'}
                                    </div>
                                </div>
                                {isCurrentUser && (
                                    <span className="text-[8px] opacity-50 px-2 py-0.5 border border-primary/50">
                                        YOU
                                    </span>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="text-[8px] opacity-50">QUEST PROGRESS</div>
                                    <div className="text-sm font-bold">
                                        {completedCount}/{totalCount}
                                    </div>
                                </div>
                                <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-primary transition-all duration-500"
                                        style={{ width: `${completionPercentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {players.length === 0 && (
                <div className="text-center py-12 text-muted-foreground/50 text-xs tracking-widest uppercase">
                    No crew members detected
                </div>
            )}
        </div>
    );
}
