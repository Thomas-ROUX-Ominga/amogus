"use client";

import { AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface EliminationButtonProps {
    onEliminate: () => Promise<void>;
    disabled?: boolean;
    isEliminating?: boolean;
}

export function EliminationButton({ 
    onEliminate, 
    disabled = false, 
    isEliminating = false 
}: EliminationButtonProps) {
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleEliminate = async () => {
        setShowConfirmDialog(false);
        await onEliminate();
    };

    const handlePress = () => {
        // Haptic feedback for touch devices
        try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                if (disabled || isEliminating) {
                    navigator.vibrate([200]);
                } else {
                    navigator.vibrate([50]);
                }
            }
        } catch {
            // Ignore haptic failures silently
        }

        if (!disabled && !isEliminating) {
            setShowConfirmDialog(true);
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
            <div onMouseDown={disabled || isEliminating ? handlePress : undefined}>
                <button
                    onClick={handlePress}
                    onKeyDown={handleKeyDown}
                    disabled={disabled || isEliminating}
                    aria-label={
                        isEliminating 
                            ? "Signaling elimination..." 
                            : disabled && !isEliminating 
                                ? "Already eliminated" 
                                : "Signal elimination"
                    }
                    className="
                        flex items-center gap-1 px-3 py-1.5
                        text-xs text-destructive/80 
                        border border-destructive/20 
                        bg-destructive/5
                        hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors duration-200
                        touch-manipulation min-h-[32px]
                        font-rajdhani uppercase tracking-widest
                    "
                >
                    <AlertTriangle className="w-3 h-3" />
                    {isEliminating 
                        ? "SIGNALING..." 
                        : disabled && !isEliminating 
                            ? "ELIMINATION SIGNALED" 
                            : "SIGNAL ELIMINATION"
                    }
                </button>
            </div>

            {showConfirmDialog && mounted && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="max-w-md w-full border border-destructive/20 bg-black p-6 space-y-4 shadow-xl">
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-4 h-4" />
                            <h2 className="text-lg font-bold font-orbitron uppercase tracking-wider">
                                Signal Elimination
                            </h2>
                        </div>
                        <p className="text-sm text-muted-foreground font-rajdhani">
                            Are you sure you want to signal that you have been eliminated? 
                            This action cannot be undone and you will no longer receive game updates.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirmDialog(false)}
                                className="px-4 py-2 text-sm border border-primary/20 hover:bg-primary/10 transition-colors font-rajdhani uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEliminate}
                                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-rajdhani uppercase tracking-widest"
                            >
                                Signal Elimination
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
