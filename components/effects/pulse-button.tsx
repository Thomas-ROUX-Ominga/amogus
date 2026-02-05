"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PulseButtonProps {
    onClick?: () => void;
    isLoading?: boolean;
    children: ReactNode;
    disabled?: boolean;
}

export function PulseButton({
    onClick,
    isLoading,
    children,
    disabled,
}: PulseButtonProps) {
    return (
        <div className="relative inline-block">
            {isLoading && (
                <motion.div
                    className="absolute inset-0 rounded bg-primary/20"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeOut",
                    }}
                />
            )}
            <button
                onClick={onClick}
                disabled={disabled || isLoading}
                className={`
          relative px-8 py-4 bg-primary text-0D1117 font-mono font-bold uppercase tracking-wider
          border-2 border-primary hover:bg-transparent hover:text-primary transition-all duration-300
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isLoading ? "cursor-wait" : ""}
        `}
            >
                {isLoading ? (
                    <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-background rounded-full animate-bounce" />
                        INITIALIZING...
                    </span>
                ) : children}
            </button>
        </div>
    );
}
