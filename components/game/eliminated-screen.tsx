"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTranslations } from "next-intl";

export type EliminatedScreenPhase = "awaiting-meeting" | "ghost-info";

interface EliminatedScreenProps {
    playerName?: string;
    playerRole?: string;
    phase?: EliminatedScreenPhase;
    onDismiss?: () => void;
}

export function EliminatedScreen({
    playerName,
    playerRole,
    phase = "awaiting-meeting",
    onDismiss,
}: EliminatedScreenProps) {
    const t = useTranslations();
    const isImpostor = playerRole === "IMPOSTOR";
    const isGhostInfo = phase === "ghost-info";

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="eliminated-screen-title"
            className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black backdrop-blur-md"
        >
            <div
                className={`max-w-md w-full border-2 ${
                    isImpostor ? "border-red-600/50" : "border-red-500/50"
                } bg-gray-900 p-6 space-y-4 shadow-2xl ${
                    isImpostor ? "shadow-red-900/40" : "shadow-red-500/20"
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-6 h-6" />
                        <h1 id="eliminated-screen-title" className="text-xl font-bold font-orbitron uppercase tracking-wider">
                            {isGhostInfo
                                ? t("game.eliminated.ghostPopupTitle")
                                : t("game.eliminated.awaitingTitle")}
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

                <div className="space-y-4">
                    <div className="text-center space-y-2">
                        <p className="text-lg text-red-400 font-rajdhani uppercase tracking-widest">
                            {isGhostInfo
                                ? isImpostor
                                    ? t("game.eliminated.ghostPopupMessageImpostor")
                                    : t("game.eliminated.ghostPopupMessageCrewmate")
                                : t("game.eliminated.awaitingMessage")}
                        </p>
                        <p className="text-sm text-muted-foreground font-rajdhani">
                            {isGhostInfo
                                ? isImpostor
                                    ? t("game.eliminated.ghostPopupDescriptionImpostor")
                                    : t("game.eliminated.ghostPopupDescriptionCrewmate")
                                : t("game.eliminated.awaitingDescription")}
                        </p>
                    </div>

                    {playerName && !isGhostInfo && (
                        <div className="p-3 border border-red-500/30 bg-red-500/10">
                            <p className="text-xs text-red-300 font-rajdhani uppercase tracking-widest">
                                {t("game.eliminated.playerLabel", { playerName })}
                            </p>
                        </div>
                    )}

                    {!isGhostInfo && (
                        <div className="text-xs text-muted-foreground font-rajdhani space-y-1">
                            <p>{t("game.eliminated.awaitingHintSit")}</p>
                            <p>{t("game.eliminated.awaitingHintFound")}</p>
                            <p className="text-red-300/80">{t("game.eliminated.awaitingHintSilence")}</p>
                        </div>
                    )}

                    {isGhostInfo && (
                        <div className="text-xs text-blue-300/90 font-rajdhani text-center italic">
                            {t("game.eliminated.ghostPopupFooter")}
                        </div>
                    )}
                </div>

                {onDismiss && (
                    <div className="pt-2">
                        <button
                            onClick={onDismiss}
                            className="block w-full text-center px-4 py-3 bg-red-600 hover:bg-red-700 text-white transition-colors font-orbitron font-bold uppercase tracking-[0.2em] text-sm shadow-lg shadow-red-900/20 active:scale-[0.98] touch-manipulation min-h-[48px]"
                        >
                            {t("common.actions.continue")}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
