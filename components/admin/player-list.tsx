"use client";

import React from "react";
import { Player } from "@/types/game";
import { useLocale, useTranslations } from "next-intl";
import { PlayerQuestProgress } from "./player-quest-progress";

interface PlayerListProps {
    players: Player[];
    currentUserId: string;
}

function PlayerListInner({ players, currentUserId }: PlayerListProps) {
    const t = useTranslations();
    const locale = useLocale();
    const roleLabelMap: Record<string, string> = {
        CREWMATE: t("game.roleBadge.crewmate"),
        IMPOSTOR: t("game.roleBadge.impostor"),
    };

    return (
        <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm shadow-[0_0_50px_rgb(var(--primary-rgb)/0.05)]">
            <div className="flex items-center justify-between border-b border-primary/20 pb-4 mb-6">
                <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-primary font-orbitron">
                    {t("admin.playerList.title")}
                </h2>
                <div className="text-[10px] text-primary/50 tracking-widest">
                    {t("admin.playerList.members", { count: String(players.length) })}
                </div>
            </div>

            <div className="space-y-3">
                {players.map((player) => {
                    const isCurrentUser = player.id === currentUserId;

                    return (
                        <div
                            key={player.id}
                            className={`p-4 border text-xs tracking-widest uppercase transition-all ${
                                isCurrentUser 
                                    ? 'border-primary bg-primary/10 text-primary font-bold' 
                                    : 'border-white/10 bg-white/5 text-muted-foreground hover:border-primary/30'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <div className="font-bold text-sm">{player.name}</div>
                                        <div className="text-[8px] opacity-50 mt-1">
                                            {player.role ? roleLabelMap[player.role] || player.role : t("admin.playerList.noRole")} • {player.isAlive ? t("admin.playerList.active") : t("admin.playerList.eliminated")}
                                        </div>
                                    </div>
                                    {isCurrentUser && (
                                        <span className="text-[8px] opacity-50 px-2 py-0.5 border border-primary/50">
                                            {t("admin.playerList.you")}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="w-48">
                                    <PlayerQuestProgress 
                                        player={player} 
                                        isCurrentUser={isCurrentUser}
                                        locale={locale}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {players.length === 0 && (
                <div className="text-center py-12 text-muted-foreground/50 text-xs tracking-widest uppercase">
                    {t("admin.playerList.noCrew")}
                </div>
            )}
        </div>
    );
}

export const PlayerList = React.memo(PlayerListInner);
