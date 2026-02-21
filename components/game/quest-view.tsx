"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { X, Clock, Check, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Quest, QuestDuration, QuestGame } from "@/types/quest";
import { useGameStore } from "@/lib/store/game-store";
import { getRandomQuestGame } from "@/lib/constants/quest-pool";
import { QuestRenderer } from "@/components/game/quest-renderer";
import { SuccessOverlay } from "@/components/game/success-overlay";
import { ERROR_CODES } from "@/lib/constants/error-codes";

interface QuestViewProps {
    quest: Quest;
    gameId: string;
    userId?: string;
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

const REDIRECT_DELAY_MS = 2500;

export function QuestView({ quest, gameId, userId }: QuestViewProps) {
    const router = useRouter();
    const prefersReducedMotion = useReducedMotion();
    const { gameState, clearQuest, setQuestAnswered, completeQuestAction, isCompletingQuest, completionError, completionErrorCode, questAnswered } = useGameStore();
    
    // Story 4.1: Identify player role
    const currentPlayer = gameState?.players.find(p => p.id === userId);
    const isImpostor = currentPlayer?.role === "IMPOSTOR";
    const completionTriggered = useRef(false);
    const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
    
    // Fetch QuestGame based on Quest metadata
    const [questGame, setQuestGame] = useState<QuestGame | null>(null);
    const [isLoadingGame, setIsLoadingGame] = useState(true);
    
    useEffect(() => {
        const loadQuestGame = () => {
            if (quest.id === "impostor-sim") {
                // Impostor simulated quest - create a fake QuestGame
                const impostorGame = {
                    id: quest.id,
                    type: quest.type,
                    duration: quest.duration,
                    title: "SIGNAL OVERRIDE",
                    instruction: "PROTOCOL DE CAMOUFLAGE ACTIF",
                    options: [
                        { label: "VRAI", value: "true" },
                        { label: "FAUX", value: "false" }
                    ],
                    answer: "true"
                };
                setQuestGame(impostorGame);
                setIsLoadingGame(false);
            } else {
                // Regular quest - fetch QuestGame
                const game = getRandomQuestGame(quest.type, quest.duration);
                setQuestGame(game);
                setIsLoadingGame(false);
            }
        };

        loadQuestGame();
    }, [quest]);

    const triggerSuccessFlow = useCallback(() => {
        setShowSuccessOverlay(true);
        try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                navigator.vibrate([100, 50, 100]);
            }
        } catch {
            // Ignore haptic failures
        }
    }, []);

    const handleSuccess = useCallback(() => {
        setQuestAnswered(true);
    }, [setQuestAnswered]);

    // Trigger quest completion recording after answer is correct
    useEffect(() => {
        if (questAnswered && userId && !completionTriggered.current) {
            completionTriggered.current = true;
            completeQuestAction(gameId, userId, quest.id).then((success) => {
                if (success) {
                    triggerSuccessFlow();
                }
            });
        }
    }, [questAnswered, userId, gameId, quest.id, completeQuestAction, triggerSuccessFlow]);

    // Auto-redirect after success overlay
    useEffect(() => {
        if (showSuccessOverlay) {
            const timer = setTimeout(() => {
                clearQuest();
                router.push(`/game/${gameId}`);
            }, REDIRECT_DELAY_MS);

            return () => {
                clearTimeout(timer);
                clearQuest();
            };
        }
    }, [showSuccessOverlay, clearQuest, router, gameId]);

    const handleManualExit = useCallback(() => {
        clearQuest();
        router.push(`/game/${gameId}`);
    }, [clearQuest, router, gameId]);

    const handleRetryCompletion = useCallback(() => {
        if (userId) {
            completeQuestAction(gameId, userId, quest.id).then((success) => {
                if (success) {
                    triggerSuccessFlow();
                }
            });
        }
    }, [userId, gameId, quest.id, completeQuestAction, triggerSuccessFlow]);

    const handleError = useCallback(() => {
        // No store update on error — visual feedback only (handled by quest components)
    }, []);

    const handleFlee = useCallback(() => {
        try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                navigator.vibrate([50]);
            }
        } catch {
            // Ignore haptic failures
        }
        clearQuest();
        router.push(`/game/${gameId}`);
    }, [clearQuest, router, gameId]);

    // Impostor Immediate Success Effect
    useEffect(() => {
        if (isImpostor && !completionTriggered.current) {
            // Story 4.2: Trigger success flow immediately for impostors
            completionTriggered.current = true;
            triggerSuccessFlow(); // eslint-disable-line react-hooks/set-state-in-effect
        }
    }, [isImpostor, triggerSuccessFlow]);

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
            data-quest-id={quest.id}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-primary/20 pb-4 mb-6">
                <h1 className="text-sm font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                    Quest Active
                </h1>
                {!isImpostor && (
                    <div
                        className={`flex items-center gap-1.5 px-3 py-1 border text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)] ${DURATION_COLORS[quest.duration]}`}
                        role="status"
                    >
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        <span aria-hidden="true">{DURATION_LABELS[quest.duration]}</span>
                        <span className="sr-only">Durée {DURATION_LABELS[quest.duration]}</span>
                    </div>
                )}
            </div>

            {/* Quest Content — top section */}
            <div className="flex-1 space-y-6">
                {!isImpostor && (
                    <>
                        {isLoadingGame ? (
                            <div className="p-6 border border-primary/20 bg-black/50 backdrop-blur-sm relative overflow-hidden">
                                <div className="text-center space-y-4">
                                    <div className="animate-pulse">
                                        <div className="h-6 bg-primary/20 rounded mb-4"></div>
                                        <div className="h-4 bg-primary/10 rounded mb-2"></div>
                                        <div className="h-4 bg-primary/10 rounded w-3/4 mx-auto"></div>
                                    </div>
                                    <p className="text-sm text-primary/60 font-rajdhani">Chargement de la quête...</p>
                                </div>
                            </div>
                        ) : !questGame ? (
                            <div className="p-6 border border-destructive/30 bg-destructive/5 backdrop-blur-sm text-center space-y-4">
                                <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
                                <p className="text-sm text-destructive/80 font-rajdhani">
                                    Données de quête invalides. Options ou réponse manquantes.
                                </p>
                                <a 
                                    href={`/game/${gameId}`}
                                    className="inline-block min-h-[44px] leading-[44px] px-6 border border-primary/30 text-primary/70 font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/10 transition-colors touch-manipulation"
                                >
                                    Retour au Game Home
                                </a>
                            </div>
                        ) : (
                            <>
                                <div className="p-6 border border-primary/20 bg-black/50 backdrop-blur-sm relative overflow-hidden">
                                    <h2 className="text-xl font-bold font-orbitron text-primary mb-4 tracking-wide">
                                        {questGame.title}
                                    </h2>
                                    <div className="w-full h-px bg-primary/20 mb-4" />
                                    <p className="text-base text-foreground/90 font-rajdhani leading-relaxed">
                                        {questGame.instruction}
                                    </p>
                                </div>

                                {/* Interactive Quest Area */}
                                <QuestRenderer
                                    quest={questGame}
                                    gameId={gameId}
                                    onSuccess={handleSuccess}
                                    onError={handleError}
                                />
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Completion Status Area */}
            {questAnswered && (
                <div className="space-y-3">
                    {isCompletingQuest && (
                        <div className="p-4 border border-primary/20 bg-black/30 text-center" role="status" aria-live="polite">
                            <span className="text-sm text-primary/80 font-rajdhani tracking-wide animate-pulse">
                                Enregistrement...
                            </span>
                        </div>
                    )}

                    {!isCompletingQuest && !completionError && (
                        <motion.div
                            {...(prefersReducedMotion ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 } })}
                            transition={prefersReducedMotion ? {} : { duration: 0.3 }}
                            className="p-4 border border-[#2DA44E]/30 bg-[#2DA44E]/10 text-center"
                            role="status"
                            aria-live="polite"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Check className="w-5 h-5 text-[#2DA44E]" aria-hidden="true" />
                                <span className="text-sm font-bold text-[#2DA44E] font-orbitron tracking-wide">
                                    MISSION ENREGISTRÉE
                                </span>
                            </div>
                        </motion.div>
                    )}

                    {!isCompletingQuest && completionError && (
                        <div className="p-4 border border-destructive/30 bg-destructive/10 space-y-3" role="alert" aria-live="assertive">
                            <div className="flex items-center justify-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-destructive" aria-hidden="true" />
                                <span className="text-sm font-bold text-destructive font-orbitron tracking-wide">
                                    ERREUR DE SAUVEGARDE
                                </span>
                            </div>
                            <p className="text-xs text-destructive/80 text-center font-rajdhani">
                                {completionError}
                            </p>
                            
                            {completionErrorCode === ERROR_CODES.GAME_NOT_FOUND ? (
                                <button
                                    onClick={() => router.push(`/game/${gameId}`)}
                                    className="w-full min-h-[44px] flex items-center justify-center border-2 border-destructive/50 bg-transparent text-destructive font-rajdhani font-bold uppercase tracking-widest text-sm hover:bg-destructive/10 active:scale-95 transition-all touch-manipulation"
                                >
                                    RETOUR ACCUEIL
                                </button>
                            ) : (
                                <button
                                    onClick={handleRetryCompletion}
                                    aria-label="Réessayer la sauvegarde de la quête"
                                    className="w-full min-h-[44px] flex items-center justify-center border-2 border-primary/50 bg-transparent text-primary font-rajdhani font-bold uppercase tracking-widest text-sm hover:bg-primary/10 active:scale-95 transition-all touch-manipulation"
                                >
                                    RÉESSAYER
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

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

            <AnimatePresence>
                {showSuccessOverlay && (
                    <SuccessOverlay 
                        onManualExit={handleManualExit} 
                        reducedMotion={!!prefersReducedMotion}
                        isImpostor={isImpostor}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
