"use client";

import { ERROR_CODES } from "@/lib/constants/error-codes";

import { motion } from "framer-motion";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ErrorViewProps {
    title?: string;
    message?: string;
    code?: string;
    onRetry?: () => void;
}

export function ErrorView({
    title = "SIGNAL LOST",
    message = "Unable to establish secure uplink with game module.",
    code = ERROR_CODES.ERR_SIGNAL_LOST,
    onRetry
}: ErrorViewProps) {
    const router = useRouter();

    useEffect(() => {
        // Trigger haptic alert on mount - Safe check
        try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                navigator.vibrate([200, 100, 200]);
            }
        } catch (e) {
            // Ignore haptic failures
        }
    }, []);

    const handleRetry = () => {
        if (onRetry) {
            onRetry();
        } else {
            window.location.reload();
        }
    };

    const glitchVariants = {
        initial: { x: 0, opacity: 0 },
        animate: {
            x: [-1, 1, -1, 0],
            opacity: 1,
            transition: {
                duration: 0.2,
                times: [0, 0.2, 0.4, 1],
                repeat: 0
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
            <motion.div
                initial="initial"
                animate="animate"
                variants={glitchVariants}
                className="mb-8"
            >
                <div className="relative inline-block">
                    <AlertTriangle className="w-24 h-24 text-destructive animate-pulse" />
                    <motion.div
                        className="absolute inset-0 text-destructive/30 w-24 h-24"
                        animate={{
                            x: [-2, 2, -2],
                            opacity: [0.5, 0.2, 0.5]
                        }}
                        transition={{ duration: 0.1, repeat: Infinity }}
                    >
                        <AlertTriangle className="w-full h-full" />
                    </motion.div>
                </div>
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-4xl font-bold font-orbitron text-destructive mb-4 tracking-tighter"
            >
                {title}
            </motion.h1>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="max-w-md bg-destructive/5 border border-destructive/20 rounded-lg p-6 backdrop-blur-sm mb-8"
            >
                <p className="text-destructive/80 font-mono text-sm leading-relaxed mb-4">
                    {message}
                </p>
                <div className="text-[10px] font-mono text-destructive/40 uppercase tracking-widest">
                    SYSTEM_REPORT: {code}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col gap-4 w-full max-w-xs"
            >
                <button
                    onClick={() => router.push("/")}
                    className="flex items-center justify-center gap-2 w-full h-14 bg-destructive text-destructive-foreground font-bold rounded-md hover:bg-destructive/90 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-95 touch-manipulation"
                >
                    <Home className="w-5 h-5" />
                    <span className="font-orbitron tracking-wide text-lg">RECOVER SIGNAL</span>
                </button>

                <button
                    onClick={handleRetry}
                    className="flex items-center justify-center gap-2 w-full h-12 border border-destructive/30 text-destructive/70 font-mono text-sm rounded-md hover:bg-destructive/5 transition-colors active:scale-95 touch-manipulation"
                >
                    <RefreshCw className="w-4 h-4" />
                    RETRY SYNC
                </button>
            </motion.div>

            <div className="mt-12 text-[10px] text-destructive/20 font-mono uppercase tracking-[0.2em]">
                Protocol: No-Dead-End-Active
            </div>
        </div>
    );
}
