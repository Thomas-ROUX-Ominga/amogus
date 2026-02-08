"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Scan } from "lucide-react";
import Link from "next/link";

interface ScanButtonProps {
    disabled?: boolean;
    onClick?: () => void;
    href?: string;
}

export function ScanButton({ disabled = true, onClick, href }: ScanButtonProps) {
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
            <Scan className="w-10 h-10 text-primary" />
            <span className="text-xl font-black text-primary tracking-[0.3em]">
                SCANNER
            </span>
            {disabled && (
                <span className="text-xs text-primary/60 font-rajdhani tracking-widest">
                    Bientôt disponible
                </span>
            )}
        </>
    );

    const className = `
        w-full min-h-[120px] p-6
        flex flex-col items-center justify-center gap-3
        border-2 border-primary bg-primary/10
        font-orbitron uppercase tracking-wider
        touch-manipulation
        transition-opacity duration-200
        ${disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-primary/20 cursor-pointer"
        }
    `;

    if (href && !disabled) {
        return (
            <Link
                href={href}
                onClick={handlePress}
                aria-label="Scanner"
                className={className}
            >
                {content}
            </Link>
        );
    }

    return (
        <motion.button
            animate={pulseAnimation}
            transition={pulseTransition}
            onClick={handlePress}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-label={disabled ? "Scanner — Bientôt disponible" : "Scanner"}
            style={{ willChange: prefersReducedMotion ? "auto" : "transform" }}
            className={className}
        >
            {content}
        </motion.button>
    );
}
