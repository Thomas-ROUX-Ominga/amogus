"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Trophy, Skull, Users, ArrowLeft } from "lucide-react";
import { PlayerRole } from "@/types/game";

interface GameOverScreenProps {
    winner: PlayerRole;
    userRole: PlayerRole;
    isHost: boolean;
    gameId: string;
}

export function GameOverScreen({ winner, userRole, isHost, gameId }: GameOverScreenProps) {
    const router = useRouter();

    let title;
    let message;
    let icon;
    let colorClass;

    if (isHost) {
        title = "MISSION TERMINÉE";
        message = winner === "CREWMATE" ? "Les Crewmates ont remporté la victoire." : "L'imposteur a éliminé tout l'équipage.";
        icon = <Users className="w-16 h-16 text-primary" />;
        colorClass = "border-primary/40 shadow-[0_0_50px_rgba(var(--primary),0.2)]";
    } else if (winner === userRole) {
        title = "VICTOIRE";
        message = userRole === "IMPOSTOR" ? "Vous avez éliminé tout l'équipage." : "Toutes les quêtes ont été terminées !";
        icon = <Trophy className="w-16 h-16 text-green-500 animate-bounce" />;
        colorClass = "border-green-500/40 shadow-[0_0_50px_rgba(34,197,94,0.3)]";
    } else {
        title = "DÉFAITE";
        message = userRole === "IMPOSTOR" ? "L'équipage a terminé toutes ses quêtes." : "L'imposteur a pris le contrôle du vaisseau.";
        icon = <Skull className="w-16 h-16 text-red-500 animate-pulse" />;
        colorClass = "border-red-500/40 shadow-[0_0_50px_rgba(239,68,68,0.3)]";
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-700">
            <div className={`max-w-md w-full border-2 p-8 md:p-12 space-y-8 bg-black/80 text-center relative overflow-hidden ${colorClass}`}>
                {/* Background decorative elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20" />
                
                <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-2">
                        {icon}
                    </div>
                    
                    <h2 className="text-4xl font-black tracking-[0.2em] uppercase font-orbitron">
                        {title}
                    </h2>
                    
                    <p className="text-muted-foreground font-rajdhani text-lg tracking-wide">
                        {message}
                    </p>
                </div>

                <div className="space-y-4 py-4">
                    <button
                        onClick={() => router.push("/")}
                        className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-4 px-6 rounded-sm transition-all group font-orbitron uppercase tracking-widest text-sm"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Nouveau code partie
                    </button>
                    
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] opacity-50">
                        GAME ID: {gameId}
                    </p>
                </div>
            </div>
        </div>
    );
}
