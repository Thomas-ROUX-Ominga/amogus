"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Scan } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface ScanButtonProps {
    disabled?: boolean;
    onClick?: () => void;
    href?: string;
    communicationsSabotaged?: boolean;
}

export function ScanButton({
    disabled = true,
    onClick,
    href,
    communicationsSabotaged = false,
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

    const content = (
        <>
            <Scan
                className={`w-10 h-10 ${
                    communicationsSabotaged ? "text-red-200" : "text-primary"
                }`}
            />
            <span
                className={`text-xl font-black tracking-[0.3em] ${
                    communicationsSabotaged ? "text-red-100" : "text-primary"
                }`}
            >
                {t("game.scanButton.label")}
            </span>
            {disabled && (
                <span className="text-xs text-primary/60 font-rajdhani tracking-widest">
                    {t("game.scanButton.comingSoon")}
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
            <motion.button
                animate={pulseAnimation}
                transition={pulseTransition}
                onClick={handlePress}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-label={
                    disabled
                        ? t("game.scanButton.scannerComingSoonAria")
                        : t("game.scanButton.scannerAria")
                }
                style={{ willChange: prefersReducedMotion ? "auto" : "transform" }}
                className={className}
            >
                {communicationsSabotaged && (
                    <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,transparent_42%,rgba(254,202,202,0.2)_50%,transparent_58%,transparent_100%)] motion-safe:animate-[pulse_1.8s_ease-in-out_infinite]"
                    />
                )}
                {content}
            </motion.button>
        </div>
    );
}
