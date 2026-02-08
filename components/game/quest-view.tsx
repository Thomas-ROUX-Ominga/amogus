"use client";

import { useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Quest, QuestDuration } from "@/types/quest";
import { useGameStore } from "@/lib/store/game-store";
import { QuestRenderer } from "@/components/game/quest-renderer";

interface QuestViewProps {
    quest: Quest;
    gameId: string;
}

const DURATION_COLORS: Record<QuestDuration, string> = {
    short: "border-[#2DA44E] text-[#2DA44E] bg-[#2DA44E]/10",
    medium: "border-[#D29922] text-[#D29922] bg-[#D29922]/10",
    long: "border-[#DA3633] text-[#DA3633] bg-[#DA3633]/10",
};

const DURATION_LABELS: Record<QuestDuration, string> = {
    short: "COURT",
    medium: "MOYEN",
    long: "LONG",
};

export function QuestView({ quest, gameId }: QuestViewProps) {
    const router = useRouter();
    const prefersReducedMotion = useReducedMotion();
    const { clearQuest, setQuestAnswered } = useGameStore();

    const handleSuccess = useCallback(() => {
        setQuestAnswered(true);
    }, [setQuestAnswered]);

    const handleError = useCallback(() => {
        // No store update on error — visual feedback only (handled by quest components)
    }, []);

    const handleFlee = () => {
        try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                navigator.vibrate([50]);
            }
        } catch {
            // Ignore haptic failures
        }
        clearQuest();
        router.push(`/game/${gameId}`);
    };

    const containerVariants = prefersReducedMotion
        ? {}
        : { initial: { opacity: 0 }, animate: { opacity: 1 } };

    const containerTransition = prefersReducedMotion
        ? {}
        : { duration: 0.3 };

    return (
        <motion.div
            {...containerVariants}
            transition={containerTransition}
            className="flex flex-col min-h-screen bg-background text-foreground p-4"
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-primary/20 pb-4 mb-6">
                <h1 className="text-sm font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                    Quest Active
                </h1>
                <div
                    className={`flex items-center gap-1.5 px-3 py-1 border text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)] ${DURATION_COLORS[quest.duration]}`}
                    role="status"
                >
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    <span aria-hidden="true">{DURATION_LABELS[quest.duration]}</span>
                    <span className="sr-only">Durée {DURATION_LABELS[quest.duration]}</span>
                </div>
            </div>

            {/* Quest Content — top section */}
            <div className="flex-1 space-y-6">
                <div className="p-6 border border-primary/20 bg-black/50 backdrop-blur-sm">
                    <h2 className="text-xl font-bold font-orbitron text-primary mb-4 tracking-wide">
                        {quest.title}
                    </h2>
                    <div className="w-full h-px bg-primary/20 mb-4" />
                    <p className="text-base text-foreground/90 font-rajdhani leading-relaxed">
                        {quest.instruction}
                    </p>
                </div>

                {/* Interactive Quest Area */}
                <QuestRenderer
                    quest={quest}
                    gameId={gameId}
                    onSuccess={handleSuccess}
                    onError={handleError}
                />
            </div>

            {/* Flee Button — bottom thumb zone */}
            <div className="pt-6 pb-4">
                <button
                    onClick={handleFlee}
                    aria-label="Abandonner la quête et retourner au Game Home"
                    className="w-full min-h-[56px] flex items-center justify-center gap-3 border-2 border-destructive/50 bg-transparent text-destructive font-rajdhani font-bold uppercase tracking-widest text-sm hover:bg-destructive/10 active:scale-95 transition-all touch-manipulation"
                >
                    <X className="w-5 h-5" />
                    Abandonner
                </button>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center opacity-40 pt-2">
                <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)]">
                    Quest: {quest.id}
                </div>
                <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)]">
                    Type: {quest.type}
                </div>
            </div>
        </motion.div>
    );
}
