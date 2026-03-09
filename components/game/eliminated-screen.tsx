"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface EliminatedScreenProps {
    playerName?: string;
    playerRole?: string;
    onDismiss?: () => void;
}

export function EliminatedScreen({ playerName, playerRole, onDismiss }: EliminatedScreenProps) {
    const t = useTranslations();
    const isImpostor = playerRole === "IMPOSTOR";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black backdrop-blur-md">
            <div className={`max-w-md w-full border-2 ${isImpostor ? "border-red-600/50" : "border-red-500/50"} bg-gray-900 p-6 space-y-4 shadow-2xl ${isImpostor ? "shadow-red-900/40" : "shadow-red-500/20"}`}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-6 h-6" />
                        <h1 className="text-xl font-bold font-orbitron uppercase tracking-wider">
                            {isImpostor ? t("game.eliminated.titleImpostor") : t("game.eliminated.titleCrewmate")}
                        </h1>
                    </div>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={t("game.eliminated.dismissAria")}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="space-y-4">
                    <div className="text-center space-y-2">
                        <p className="text-lg text-red-400 font-rajdhani uppercase tracking-widest">
                            {isImpostor ? t("game.eliminated.messageImpostor") : t("game.eliminated.messageCrewmate")}
                        </p>
                        <p className="text-sm text-muted-foreground font-rajdhani">
                            {isImpostor 
                                ? t("game.eliminated.descriptionImpostor")
                                : t("game.eliminated.descriptionCrewmate")}
                        </p>
                    </div>

                    {!isImpostor && (
                        <>
                            {playerName && (
                                <div className="p-3 border border-blue-500/30 bg-blue-500/10">
                                    <p className="text-xs text-blue-400 font-rajdhani uppercase tracking-widest">
                                        {t("game.eliminated.playerLabel", { playerName })}
                                    </p>
                                    <p className="text-xs text-blue-300 font-[family-name:var(--font-jetbrains-mono)]">
                                        {t("game.eliminated.ghostStatus")}
                                    </p>
                                </div>
                            )}

                            <div className="text-xs text-muted-foreground font-rajdhani space-y-1">
                                <p>{t("game.eliminated.hintScan")}</p>
                                <p>{t("game.eliminated.hintComplete")}</p>
                                <p className="text-blue-400/80">{t("game.eliminated.hintHelp")}</p>
                            </div>
                        </>
                    )}

                    {isImpostor && (
                        <div className="text-xs text-red-400/60 font-rajdhani text-center italic">
                            {t("game.eliminated.awaitingConclusion")}
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
                            {t("common.actions.continue")}
                        </button>
                    )}
                    <a
                        href="/"
                        className="block w-full text-center px-4 py-2 border border-white/10 hover:bg-white/5 transition-colors font-rajdhani uppercase tracking-widest text-xs text-muted-foreground touch-manipulation min-h-[40px]"
                    >
                        {t("game.eliminated.returnHome")}
                    </a>
                </div>
            </div>
        </div>
    );
}
