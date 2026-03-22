"use client";

import { m, useReducedMotion } from "framer-motion";
import { Scan } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface ScanButtonProps {
    disabled?: boolean;
    onClick?: () => void;
    href?: string;
    communicationsSabotaged?: boolean;
    disabledReason?: "coming-soon" | "death-waiting";
    disabledHint?: string | null;
}

export function ScanButton({
    disabled = true,
    onClick,
    href,
    communicationsSabotaged = false,
    disabledReason = "coming-soon",
    disabledHint = null,
}: ScanButtonProps) {
    const t = useTranslations();
    const prefersReducedMotion = useReducedMotion();

    const handlePress = () => {
        // Different haptic patterns based on state
        try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                if (disabled) {
                    // Long continuous vibration for disabled/error state (UX Design line 357)
                    navigator.vibrate([200]);
                } else {
                    // Short vibration for successful interaction
                    navigator.vibrate([50]);
                }
            }
        } catch {
            // Ignore haptic failures silently
        }

        if (onClick && !disabled) {
            onClick();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handlePress();
        }
    };

    const pulseAnimation = prefersReducedMotion
        ? {}
        : {
              scale: [1, 1.02, 1],
          };

    const pulseTransition = prefersReducedMotion
        ? {}
        : {
              repeat: Infinity,
              duration: 2,
              ease: "easeInOut" as const,
          };

    const deathWaitingDisabled = disabled && disabledReason === "death-waiting";
    const hintLabel = disabledHint ?? (disabled && disabledReason === "coming-soon" ? t("game.scanButton.comingSoon") : null);

    const content = (
        <>
            <Scan
                className={`w-10 h-10 ${
                    deathWaitingDisabled
                        ? "text-slate-300"
                        : communicationsSabotaged
                        ? "text-red-200"
                        : "text-primary"
                }`}
            />
            <span
                className={`text-xl font-black tracking-[0.3em] ${
                    deathWaitingDisabled
                        ? "text-slate-200"
                        : communicationsSabotaged
                        ? "text-red-100"
                        : "text-primary"
                }`}
            >
                {t("game.scanButton.label")}
            </span>
            {hintLabel && (
                <span className={`text-xs font-rajdhani tracking-widest ${deathWaitingDisabled ? "text-slate-300/80" : "text-primary/60"}`}>
                    {hintLabel}
                </span>
            )}
        </>
    );

    const className = `
        w-full min-h-[120px] p-6
        relative overflow-hidden
        flex flex-col items-center justify-center gap-3
        border-2
        font-orbitron uppercase tracking-wider
        touch-manipulation
        transition-all duration-200
        ${
            deathWaitingDisabled
                ? "border-slate-400/50 bg-[linear-gradient(150deg,rgba(100,116,139,0.24)_0%,rgba(30,41,59,0.3)_45%,rgba(2,6,23,0.85)_100%)] shadow-[0_0_24px_rgba(100,116,139,0.2)]"
                :
            communicationsSabotaged
                ? "border-red-400/70 bg-[linear-gradient(150deg,rgba(239,68,68,0.22)_0%,rgba(153,27,27,0.22)_45%,rgba(2,6,23,0.85)_100%)] shadow-[0_0_28px_rgba(239,68,68,0.22)]"
                : "border-primary bg-primary/10"
        }
        ${disabled
            ? "opacity-50 cursor-not-allowed"
            : communicationsSabotaged
            ? "hover:bg-red-500/20 cursor-pointer"
            : "hover:bg-primary/20 cursor-pointer"
        }
    `;

    if (href && !disabled) {
        return (
            <div className="w-full px-1 overflow-visible">
                <Link
                    href={href}
                    onClick={handlePress}
                    aria-label={t("game.scanButton.scannerAria")}
                    className={className}
                >
                    {content}
                </Link>
            </div>
        );
    }

    return (
        <div className="w-full px-1 overflow-visible">
            <m.button
                animate={pulseAnimation}
                transition={pulseTransition}
                onClick={handlePress}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-label={
                    disabled
                        ? deathWaitingDisabled
                            ? t("game.home.awaitingMeetingScanDisabled")
                            : t("game.scanButton.scannerComingSoonAria")
                        : t("game.scanButton.scannerAria")
                }
                className={className}
            >
                {communicationsSabotaged && (
                    <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,transparent_42%,rgba(254,202,202,0.2)_50%,transparent_58%,transparent_100%)] motion-safe:animate-[pulse_1.8s_ease-in-out_infinite]"
                    />
                )}
                {content}
            </m.button>
        </div>
    );
}
