"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m, useReducedMotion, AnimatePresence } from "framer-motion";
import { X, Brain, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Quest, QuestDuration, QuestGame } from "@/types/quest";
import { useGameStore } from "@/lib/store/game-store";
import { getRandomQuestGame } from "@/lib/constants/quest-pool";
import { QuestRenderer } from "@/components/game/quest-renderer";
import { SuccessOverlay } from "@/components/game/success-overlay";
import { FailedOverlay } from "@/components/game/failed-overlay";
import { ReactorSabotageAlert } from "@/components/game/reactor-sabotage-alert";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";

interface QuestViewProps {
    quest: Quest;
    gameId: string;
    userId?: string;
}

const DURATION_COLORS: Record<QuestDuration, string> = {
    short: "border-role-crewmate text-role-crewmate bg-role-crewmate/10",
    medium: "border-warning text-warning bg-warning/10",
    long: "border-role-impostor text-role-impostor bg-role-impostor/10",
};

const SUCCESS_OVERLAY_DURATION_MS = 2000;

export function QuestView({ quest, gameId, userId }: QuestViewProps) {
    const router = useRouter();
    const t = useTranslations();
    const prefersReducedMotion = useReducedMotion();
    const { gameState, clearQuest, setQuestAnswered, completeQuestAction, isCompletingQuest, completionError, completionErrorCode, questAnswered, currentQuestContent, recordFailedQuest, loadDynamicQuestContent } = useGameStore();
    
    // Story 4.1: Identify player role
    const currentPlayer = gameState?.players.find(p => p.id === userId);
    const isImpostor = currentPlayer?.role === "IMPOSTOR";
    const completionTriggered = useRef(false);
    const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
    const [showFailedOverlay, setShowFailedOverlay] = useState(false);
    
    const questGame = useMemo<QuestGame | null>(() => {
        // Story 9.1: Skip all quest content loading for impostors
        if (isImpostor) return null;

        if (currentQuestContent && currentQuestContent.questId === quest.id) {
            return currentQuestContent.content;
        }

        if (quest.type === "mini-game") {
            // Mini-games are self-contained — provide a synthetic entry so the renderer picks it up
            return {
                id: `mini-game-${quest.duration}`,
                type: "mini-game",
                duration: quest.duration,
                title: t("game.questView.miniGameTitle"),
                instruction: t("game.questView.miniGameInstruction"),
                data: {},
            };
        }

        return getRandomQuestGame(quest.type, quest.duration);
    }, [currentQuestContent, isImpostor, quest.id, quest.type, quest.duration, t]);

    const isLoadingGame = false;
    const difficultyLabels: Record<QuestDuration, string> = useMemo(
        () => ({
            short: t("game.questView.difficulty.short"),
            medium: t("game.questView.difficulty.medium"),
            long: t("game.questView.difficulty.long"),
        }),
        [t]
    );

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

    // Handle background redirect during success overlay
    const handleAutoRedirect = useCallback(async () => {
        if (typeof clearQuest === "function") {
            clearQuest({ preserveCurrentQuest: true, preserveCurrentQuestContent: true });
        }
        try {
            await router.push(`/game/${gameId}`);
        } catch (error) {
            console.error('Redirect failed:', error);
            // Fallback: try again after a short delay
            setTimeout(() => router.push(`/game/${gameId}`), 100);
        }
    }, [clearQuest, router, gameId]);

    // Remove the old auto-redirect useEffect since we handle it in SuccessOverlay

    const handleManualExit = useCallback(() => {
        if (typeof clearQuest === "function") {
            clearQuest({ preserveCurrentQuest: true, preserveCurrentQuestContent: true });
        }
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
        // Story 8.2: Record failed quest when user gets wrong answer
        if (userId && currentQuestContent && currentQuestContent.questId === quest.id && !isImpostor) {
            recordFailedQuest(gameId, userId, quest.id, currentQuestContent.contentId);
            setShowFailedOverlay(true);
        }
    }, [userId, currentQuestContent, isImpostor, gameId, quest.id, recordFailedQuest]);

    const handleFailedAutoRedirect = useCallback(() => {
        setShowFailedOverlay(false);
        if (userId) {
            loadDynamicQuestContent(quest.id, gameId, userId);
        }
    }, [quest.id, gameId, userId, loadDynamicQuestContent]);

    const handleFlee = useCallback(() => {
        try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                navigator.vibrate([50]);
            }
        } catch {
            // Ignore haptic failures
        }
        if (typeof clearQuest === "function") {
            clearQuest({ preserveCurrentQuest: true, preserveCurrentQuestContent: true });
        }
        router.push(`/game/${gameId}`);
    }, [clearQuest, router, gameId]);

    // Impostor Immediate Success Effect - Story 9.1
    useEffect(() => {
        if (isImpostor && !completionTriggered.current && !showSuccessOverlay) {
            // Story 4.2: Trigger success flow immediately for impostors
            completionTriggered.current = true;
            // Use setTimeout to ensure component mount before showing overlay
            setTimeout(() => triggerSuccessFlow(), 0);
        }
    }, [isImpostor, triggerSuccessFlow, showSuccessOverlay]);

    const containerVariants = prefersReducedMotion
        ? {}
        : { initial: { opacity: 0 }, animate: { opacity: 1 } };

    const containerTransition = prefersReducedMotion
        ? {}
        : { duration: 0.3 };

    return (
        <m.div
            {...containerVariants}
            transition={containerTransition}
            className="flex h-[100dvh] flex-col overflow-hidden bg-background px-4 pt-20 text-foreground md:pt-24"
            data-quest-id={quest.id}
        >
            {gameState && <ReactorSabotageAlert gameState={gameState} />}

            <div className="mx-auto flex h-full w-full max-w-[920px] flex-col">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between gap-3 border-b border-primary/20 pb-4">
                    <h1 className="min-w-0 text-sm font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                        {t("game.questView.activeTitle")}
                    </h1>
                    {!isImpostor && (
                        <div
                            className={`inline-flex items-center gap-1.5 self-start border px-3 py-1 text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)] ${DURATION_COLORS[quest.duration]}`}
                            role="status"
                        >
                            <Brain className="h-3 w-3" aria-hidden="true" />
                            <span aria-hidden="true">{difficultyLabels[quest.duration]}</span>
                            <span className="sr-only">
                                {t("game.questView.durationSr", { duration: difficultyLabels[quest.duration] })}
                            </span>
                        </div>
                    )}
                </div>

                {/* Quest Content — top section */}
                <div className="flex-1 space-y-6 overflow-y-auto pb-6">
                    {/* Story 9.1: Show NO content for impostors */}
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
                                        <p className="text-sm text-primary/60 font-rajdhani">{t("game.questView.loadingQuest")}</p>
                                    </div>
                                </div>
                            ) : !questGame ? (
                                <div className="p-6 border border-destructive/30 bg-destructive/5 backdrop-blur-sm text-center space-y-4">
                                    <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
                                    <p className="text-sm text-destructive/80 font-rajdhani">
                                        {t("game.questView.invalidQuestData")}
                                    </p>
                                    <a 
                                        href={`/game/${gameId}`}
                                        className="inline-block min-h-[44px] leading-[44px] px-6 border border-primary/30 text-primary/70 font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/10 transition-colors touch-manipulation"
                                    >
                                        {t("game.questView.returnToGameHome")}
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
                                        key={questGame.id}
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

                <div className="shrink-0 bg-background/95 px-1 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-6 backdrop-blur-sm">
                    {/* Loading and Error States - Success completion shows atomic overlay */}
                    {questAnswered && (
                        <div className="mb-4 space-y-3">
                            {isCompletingQuest && (
                                <div className="border border-primary/20 bg-black/30 p-4 text-center" role="status" aria-live="polite">
                                    <span className="text-sm text-primary/80 font-rajdhani tracking-wide animate-pulse">
                                        {t("game.questView.saving")}
                                    </span>
                                </div>
                            )}

                            {completionError && (
                                <div className="space-y-3 border border-destructive/30 bg-destructive/10 p-4" role="alert" aria-live="assertive">
                                    <div className="flex items-center justify-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
                                        <span className="text-sm font-bold text-destructive font-orbitron tracking-wide">
                                            {t("game.questView.saveErrorTitle")}
                                        </span>
                                    </div>
                                    <p className="text-center text-xs text-destructive/80 font-rajdhani">
                                        {getLocalizedErrorMessage({
                                            t,
                                            code: completionErrorCode,
                                            fallback: completionError,
                                        })}
                                    </p>
                                    
                                    {completionErrorCode === ERROR_CODES.GAME_NOT_FOUND ? (
                                        <button
                                            onClick={() => router.push(`/game/${gameId}`)}
                                            className="w-full min-h-[44px] flex items-center justify-center border-2 border-destructive/50 bg-transparent text-destructive font-rajdhani font-bold uppercase tracking-widest text-sm hover:bg-destructive/10 active:scale-95 transition-all touch-manipulation"
                                        >
                                            {t("game.questView.returnHome")}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleRetryCompletion}
                                            aria-label={t("game.questView.retrySaveAria")}
                                            className="w-full min-h-[44px] flex items-center justify-center border-2 border-primary/50 bg-transparent text-primary font-rajdhani font-bold uppercase tracking-widest text-sm hover:bg-primary/10 active:scale-95 transition-all touch-manipulation"
                                        >
                                            {t("common.actions.retry")}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Flee Button — anchored bottom zone */}
                    <button
                        onClick={handleFlee}
                        aria-label={t("game.questView.fleeAria")}
                        className="w-full min-h-[56px] flex items-center justify-center gap-3 border-2 border-destructive/50 bg-transparent text-destructive font-rajdhani font-bold uppercase tracking-widest text-sm hover:bg-destructive/10 active:scale-95 transition-all touch-manipulation"
                    >
                        <X className="w-5 h-5" />
                        {t("game.questView.flee")}
                    </button>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 opacity-40">
                        <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)]">
                            {t("game.questView.questLabel", { questId: quest.id })}
                        </div>
                        <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)]">
                            {t("game.questView.typeLabel", { questType: quest.type })}
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showSuccessOverlay && (
                    <SuccessOverlay 
                        onManualExit={handleManualExit} 
                        onAutoExit={handleAutoRedirect}
                        reducedMotion={!!prefersReducedMotion}
                        isImpostor={isImpostor}
                        duration={SUCCESS_OVERLAY_DURATION_MS}
                        allowManualExit={false}
                    />
                )}
                {showFailedOverlay && (
                    <FailedOverlay 
                        onAutoExit={handleFailedAutoRedirect}
                        reducedMotion={!!prefersReducedMotion}
                        duration={2000}
                    />
                )}
            </AnimatePresence>
        </m.div>
    );
}
