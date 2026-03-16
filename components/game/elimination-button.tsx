"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

interface EliminationButtonProps {
    onEliminate: () => Promise<void>;
    disabled?: boolean;
    isEliminating?: boolean;
    className?: string;
}

export function EliminationButton({ 
    onEliminate, 
    disabled = false, 
    isEliminating = false,
    className = "",
}: EliminationButtonProps) {
    const t = useTranslations();
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const isDisabled = disabled || isEliminating;

    const triggerHapticFeedback = (isError: boolean) => {
        try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                navigator.vibrate(isError ? [200] : [50]);
            }
        } catch {
            // Ignore haptic failures silently
        }
    };

    const handleEliminate = async () => {
        setShowConfirmDialog(false);
        await onEliminate();
    };

    const handlePress = () => {
        if (isDisabled) {
            triggerHapticFeedback(true);
            return;
        }

        triggerHapticFeedback(false);
        setShowConfirmDialog(true);
    };

    const handleDisabledPressFeedback = () => {
        if (isDisabled) {
            triggerHapticFeedback(true);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handlePress();
        }
    };

    return (
        <>
            <div onMouseDown={handleDisabledPressFeedback} onTouchStart={handleDisabledPressFeedback}>
                <button
                    type="button"
                    onClick={handlePress}
                    onKeyDown={handleKeyDown}
                    disabled={isDisabled}
                    aria-label={
                        isEliminating 
                            ? t("game.actions.eliminationAriaSignaling")
                            : isDisabled
                                ? t("game.actions.eliminationAriaAlready")
                                : t("game.actions.eliminationAriaSignal")
                    }
                    className={`
                            flex items-center gap-1 px-3 py-1.5
                            text-xs text-destructive/80 
                            border border-destructive/20 
                            bg-destructive/5
                            hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-colors duration-200
                            touch-manipulation min-h-[32px]
                            font-rajdhani uppercase tracking-widest
                        ${className}
                    `}
                >
                    <AlertTriangle className="w-3 h-3" />
                    {isEliminating 
                        ? t("game.actions.signaling")
                        : isDisabled
                            ? t("game.actions.eliminationSignaled")
                            : t("game.actions.signalElimination")
                    }
                </button>
            </div>

            {showConfirmDialog && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="max-w-md w-full border border-destructive/20 bg-black p-6 space-y-4 shadow-xl">
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-4 h-4" />
                            <h2 className="text-lg font-bold font-orbitron uppercase tracking-wider">
                                {t("game.actions.confirmEliminationTitle")}
                            </h2>
                        </div>
                        <p className="text-sm text-muted-foreground font-rajdhani">
                            {t("game.actions.confirmEliminationMessage")}
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirmDialog(false)}
                                className="px-4 py-2 text-sm border border-primary/20 hover:bg-primary/10 transition-colors font-rajdhani uppercase tracking-widest"
                            >
                                {t("common.actions.cancel")}
                            </button>
                            <button
                                onClick={handleEliminate}
                                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-rajdhani uppercase tracking-widest"
                            >
                                {t("game.actions.signalElimination")}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
