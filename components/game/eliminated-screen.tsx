"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface EliminatedScreenProps {
    playerName?: string;
    onDismiss?: () => void;
}

export function EliminatedScreen({ playerName, onDismiss }: EliminatedScreenProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="max-w-md w-full border border-destructive/20 bg-black/90 p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-6 h-6" />
                        <h1 className="text-xl font-bold font-orbitron uppercase tracking-wider">
                            SYSTEM OFFLINE
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
                        <p className="text-lg text-destructive font-rajdhani uppercase tracking-widest">
                            ACCESS DENIED
                        </p>
                        <p className="text-sm text-muted-foreground font-rajdhani">
                            Your system has been permanently disconnected from the game network.
                        </p>
                    </div>

                    {playerName && (
                        <div className="p-3 border border-primary/20 bg-primary/5">
                            <p className="text-xs text-primary/80 font-rajdhani uppercase tracking-widest">
                                Player: {playerName}
                            </p>
                            <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                                Status: ELIMINATED
                            </p>
                        </div>
                    )}

                    <div className="text-xs text-muted-foreground font-rajdhani space-y-1">
                        <p>• Game updates are no longer available</p>
                        <p>• Quest scanning has been disabled</p>
                        <p>• Return to lobby to rejoin future games</p>
                    </div>
                </div>

                {/* Action */}
                <div className="pt-2">
                    <a
                        href="/"
                        className="block w-full text-center px-4 py-2 border border-primary/20 hover:bg-primary/10 transition-colors font-rajdhani uppercase tracking-widest text-sm touch-manipulation min-h-[44px]"
                    >
                        Return to Lobby
                    </a>
                </div>
            </div>
        </div>
    );
}
