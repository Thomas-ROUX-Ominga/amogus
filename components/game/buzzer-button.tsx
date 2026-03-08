"use client";

import { Siren } from "lucide-react";

interface BuzzerButtonProps {
    onBuzz: () => Promise<void>;
    disabled?: boolean;
    isBuzzing?: boolean;
    hasUsed?: boolean;
    meetingActive?: boolean;
}

export function BuzzerButton({
    onBuzz,
    disabled = false,
    isBuzzing = false,
    hasUsed = false,
    meetingActive = false,
}: BuzzerButtonProps) {
    const handleClick = async () => {
        try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                navigator.vibrate(disabled ? [200] : [50]);
            }
        } catch {
            // Ignore haptic errors.
        }

        if (!disabled && !isBuzzing) {
            await onBuzz();
        }
    };

    const label = isBuzzing
        ? "BUZZ..."
        : meetingActive
        ? "MEETING ACTIF"
        : hasUsed
        ? "BUZZ UTILISÉ"
        : "BUZZER";

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled || isBuzzing}
            aria-label={label}
            className="
                flex items-center gap-1 px-3 py-1.5
                text-xs text-red-300
                border border-red-500/50
                bg-red-500/15
                hover:bg-red-500/25 hover:text-red-200
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-200
                touch-manipulation min-h-[32px]
                font-rajdhani uppercase tracking-widest
            "
        >
            <Siren className="w-3 h-3" />
            {label}
        </button>
    );
}
