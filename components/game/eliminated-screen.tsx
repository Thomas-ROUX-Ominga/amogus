"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface EliminatedScreenProps {
    playerName?: string;
    playerRole?: string;
    onDismiss?: () => void;
}

export function EliminatedScreen({ playerName, playerRole, onDismiss }: EliminatedScreenProps) {
    const isImpostor = playerRole === "IMPOSTOR";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black backdrop-blur-md">
            <div className={`max-w-md w-full border-2 ${isImpostor ? "border-red-600/50" : "border-red-500/50"} bg-gray-900 p-6 space-y-4 shadow-2xl ${isImpostor ? "shadow-red-900/40" : "shadow-red-500/20"}`}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-6 h-6" />
                        <h1 className="text-xl font-bold font-orbitron uppercase tracking-wider">
                            {isImpostor ? "MISSION TERMINATED" : "ELIMINATED"}
                        </h1>
                    </div>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Dismiss"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="space-y-4">
                    <div className="text-center space-y-2">
                        <p className="text-lg text-red-400 font-rajdhani uppercase tracking-widest">
                            {isImpostor ? "YOU HAVE BEEN DECOMMISSIONED" : "YOU HAVE BEEN ELIMINATED"}
                        </p>
                        <p className="text-sm text-muted-foreground font-rajdhani">
                            {isImpostor 
                                ? "Your sabotage mission has failed. The crew has neutralized you." 
                                : "Your crew member status has been terminated."}
                        </p>
                    </div>

                    {!isImpostor && (
                        <>
                            {playerName && (
                                <div className="p-3 border border-blue-500/30 bg-blue-500/10">
                                    <p className="text-xs text-blue-400 font-rajdhani uppercase tracking-widest">
                                        Player: {playerName}
                                    </p>
                                    <p className="text-xs text-blue-300 font-[family-name:var(--font-jetbrains-mono)]">
                                        Status: ELIMINATED - GHOST MODE ACTIVE
                                    </p>
                                </div>
                            )}

                            <div className="text-xs text-muted-foreground font-rajdhani space-y-1">
                                <p>• You can continue scanning QR codes</p>
                                <p>• Complete your remaining assigned quests</p>
                                <p className="text-blue-400/80">• Help your crew finish the mission from beyond</p>
                            </div>
                        </>
                    )}

                    {isImpostor && (
                        <div className="text-xs text-red-400/60 font-rajdhani text-center italic">
                            Awaiting game conclusion or return to lobby.
                        </div>
                    )}
                </div>

                {/* Action */}
                <div className="pt-2 space-y-3">
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="block w-full text-center px-4 py-3 bg-red-600 hover:bg-red-700 text-white transition-colors font-orbitron font-bold uppercase tracking-[0.2em] text-sm shadow-lg shadow-red-900/20 active:scale-[0.98] touch-manipulation min-h-[48px]"
                        >
                            Continuer
                        </button>
                    )}
                    <a
                        href="/"
                        className="block w-full text-center px-4 py-2 border border-white/10 hover:bg-white/5 transition-colors font-rajdhani uppercase tracking-widest text-xs text-muted-foreground touch-manipulation min-h-[40px]"
                    >
                        Retour à l'accueil
                    </a>
                </div>
            </div>
        </div>
    );
}
