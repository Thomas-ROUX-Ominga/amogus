"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGameStore, useRealTimeGamePolling } from "@/lib/store/game-store";
import { useAuth } from "@/hooks/use-auth";
import { ErrorView } from "@/components/game/error-view";
import { QuestView } from "@/components/game/quest-view";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { isValidDuration, getRandomQuestGame, getQuestGamesByDuration } from "@/lib/constants/quest-pool";
import { QuestDuration, Quest } from "@/types/quest";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";

interface QuestPageClientProps {
    durationParam?: string | null;
    questIdParam?: string | null;
}

export default function QuestPage({
    durationParam = null,
    questIdParam = null,
}: QuestPageClientProps) {
    return <QuestPageContent durationParam={durationParam} questIdParam={questIdParam} />;
}

function QuestPageContent({ durationParam = null, questIdParam = null }: QuestPageClientProps) {
    const t = useTranslations();
    const { id } = useParams();
    const router = useRouter();
    const queryParams = useSearchParams();
    const duration: string | null = durationParam ?? queryParams.get("duration");
    const questId: string | null = questIdParam ?? queryParams.get("questId");
    const { authState } = useAuth();
    const userId = authState.session?.userId;
    const {
        gameState,
        isLoading,
        isCompletingQuest,
        fatalError,
        fatalErrorCode,
        currentQuest,
        questAnswered,
        currentQuestContent,
        setCurrentQuest,
        fetchGame = async () => {},
        loadDynamicQuestContent = async () => {},
        loadFailedQuests = async () => {},
    } = useGameStore();

    const gameId = id as string;
    const contentLoadInFlightRef = useRef<string | null>(null);

    useRealTimeGamePolling(gameId, userId ?? undefined, Boolean(userId));

    // Story 11.1: Synchronous stale check to prevent flicker
    // If we have a questId in URL but the store has a different quest,
    // or if we have a duration but the store has a different duration,
    // we must show the loading state IMMEDIATELY instead of waiting for useEffect.
    const isStale = (questId && currentQuest?.id !== questId) || 
                   (!questId && duration && currentQuest?.duration !== duration);

    useEffect(() => {
        if (id && userId) {
            fetchGame(id as string, userId);
        }
    }, [id, userId, fetchGame]);

    // Load failed quests when game and user are available
    useEffect(() => {
        if (gameState && userId && gameState.status === "IN_PROGRESS") {
            loadFailedQuests(gameId, userId);
        }
    }, [gameState, userId, gameId, loadFailedQuests]);

    // Update quest metadata when dynamic content loads
    useEffect(() => {
        if (currentQuestContent && questId) {
            if (currentQuestContent.questId !== questId) {
                return;
            }

            contentLoadInFlightRef.current = null;

            // If currentQuest is null, or it's out of sync with content
            if (!currentQuest || currentQuest.id !== questId || 
                currentQuest.type !== currentQuestContent.content.type ||
                currentQuest.duration !== currentQuestContent.content.duration) {
                
                const updatedQuest: Quest = {
                    id: questId,
                    type: currentQuestContent.content.type,
                    duration: currentQuestContent.content.duration,
                    location: currentQuest?.location || t("game.questPage.questZone"),
                };
                setCurrentQuest(updatedQuest);
            }
        }
    }, [currentQuestContent, currentQuest, questId, setCurrentQuest, t]);

    // Select a random quest once game is loaded and duration is valid
    const questError = useMemo(() => {
        // If targeting a specific quest by ID, skip duration validation
        if (questId) return null;

        if (!isValidDuration(duration)) {
            return { code: ERROR_CODES.ERR_INVALID_DURATION, message: t("game.questPage.invalidDurationMessage") };
        }
        return null;
    }, [duration, questId, t]);

    useEffect(() => {
        if (!gameState || !userId) return;

        // Role check for Impostors - Story 4.1
        const currentPlayer = gameState.players.find((p) => p.id === userId);
        const isImpostor = currentPlayer?.role === "IMPOSTOR";
        
        if (isImpostor && isValidDuration(duration)) {
            if (currentQuest?.id !== "impostor-sim") {
                setCurrentQuest({
                    id: "impostor-sim",
                    type: "true-false",
                    duration: (isValidDuration(duration) ? duration : "short") as QuestDuration,
                    location: t("game.questPage.camouflageSystem"),
                });
            }
            return;
        }

        if (questId) {
            const hasMatchingContent = currentQuestContent?.questId === questId;
            const isContentLoading = contentLoadInFlightRef.current === questId;
            if (!hasMatchingContent && !isContentLoading) {
                contentLoadInFlightRef.current = questId;
                // Story 8.2: Use dynamic content mapper for questId-based content
                void loadDynamicQuestContent(questId, gameId, userId).finally(() => {
                    if (contentLoadInFlightRef.current === questId) {
                        contentLoadInFlightRef.current = null;
                    }
                });
                
                // Haptic feedback on successful quest load initiation
                try {
                    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                        navigator.vibrate([30]);
                    }
                } catch {
                    // Ignore haptic failures
                }
            }
        } else if (isValidDuration(duration)) {
            if (!currentQuest || currentQuest.duration !== duration) {
                const questGame = getRandomQuestGame("true-false", duration); // TODO: This needs to be updated to get type from somewhere
                if (questGame) {
                    // Convert QuestGame to Quest for now (temporary fix)
                    const quest: Quest = {
                        id: questGame.id,
                        type: questGame.type,
                        duration: questGame.duration,
                        location: t("game.questPage.questZone"), // TODO: This should come from actual quest assignment
                    };
                    setCurrentQuest(quest);
                    // Haptic feedback on successful quest load
                    try {
                        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                            navigator.vibrate([30]);
                        }
                    } catch {
                        // Ignore haptic failures
                    }
                }
            }
        }
    }, [
        gameState,
        duration,
        questId,
        currentQuest?.id,
        currentQuest?.duration,
        currentQuestContent?.questId,
        setCurrentQuest,
        userId,
        gameId,
        loadDynamicQuestContent,
        t,
    ]);

    if (isStale || isLoading || !userId) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-primary/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm animate-pulse">
                    <div className="text-primary text-center tracking-[0.2em] uppercase text-sm font-orbitron">
                        {t("game.questPage.loading")}
                    </div>
                </div>
            </main>
        );
    }

    // Game fetch error
    if (fatalError) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <ErrorView
                    title={fatalErrorCode === ERROR_CODES.GAME_NOT_FOUND ? t("game.questPage.sessionNotFoundTitle") : t("game.questPage.signalLostTitle")}
                    message={getLocalizedErrorMessage({
                        t,
                        code: fatalErrorCode,
                        fallback: fatalError,
                    })}
                    code={fatalErrorCode || ERROR_CODES.ERR_QUEST_LOAD_FAILED}
                    onRetry={() => { if (id && userId) fetchGame(gameId, userId); }}
                    showRecoverSignalAction={false}
                    retryActionPrimary
                />
            </main>
        );
    }

    // Duration validation error
    if (questError) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <ErrorView
                    title={t("game.questPage.invalidDurationTitle")}
                    message={questError.message}
                    code={questError.code}
                    onRetry={() => { router.push(`/game/${gameId}`); }}
                    showRecoverSignalAction={false}
                    retryActionPrimary
                />
            </main>
        );
    }

    // Game state validations
    if (gameState) {
        const isQuestCompletionFlowActive = questAnswered || isCompletingQuest;

        // Game not in progress
        if (gameState.status !== "IN_PROGRESS") {
            return (
                <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                    <ErrorView
                        title={t("game.questPage.missionInactiveTitle")}
                        message={t("game.questPage.missionInactiveMessage")}
                        code={ERROR_CODES.ERR_INVALID_STATE}
                        onRetry={() => { router.push(`/game/${gameId}`); }}
                        showRecoverSignalAction={false}
                        retryActionPrimary
                    />
                </main>
            );
        }

        // Player not in game
        const currentPlayer = gameState.players.find((p) => p.id === userId);
        if (!currentPlayer) {
            return (
                <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                    <ErrorView
                        title={t("game.questPage.accessDeniedTitle")}
                        message={t("game.questPage.accessDeniedMessage")}
                        code={ERROR_CODES.ERR_INVALID_SIGNATURE}
                        onRetry={() => { router.push(`/game/${gameId}`); }}
                        showRecoverSignalAction={false}
                        retryActionPrimary
                    />
                </main>
            );
        }

        // Player has no role
        if (!currentPlayer.role) {
            return (
                <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                    <ErrorView
                        title={t("game.questPage.roleNotAssignedTitle")}
                        message={t("game.questPage.roleNotAssignedMessage")}
                        code={ERROR_CODES.ERR_INVALID_ROLE}
                        onRetry={() => { router.push(`/game/${gameId}`); }}
                        showRecoverSignalAction={false}
                        retryActionPrimary
                    />
                </main>
            );
        }

        if (currentPlayer.role === "CREWMATE" && gameState.sabotageState?.active === "COMMUNICATIONS") {
            return (
                <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                    <ErrorView
                        title={t("game.questPage.missionInactiveTitle")}
                        message={t("errors.codes.ERR_SABOTAGE_COMMUNICATIONS_QUESTS_BLOCKED")}
                        code={ERROR_CODES.ERR_SABOTAGE_COMMUNICATIONS_QUESTS_BLOCKED}
                        onRetry={() => { router.push(`/game/${gameId}`); }}
                        showRecoverSignalAction={false}
                        retryActionPrimary
                    />
                </main>
            );
        }

        if (gameState.meeting?.status === "ACTIVE") {
            return (
                <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                    <div className="max-w-2xl w-full border-2 border-red-500/30 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm">
                        <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-red-300 font-orbitron text-center">
                            {t("game.questPage.meetingActiveTitle")}
                        </h1>
                        <p className="text-center text-muted-foreground font-rajdhani">
                            {t("game.questPage.meetingActiveMessage")}
                        </p>
                        <div className="flex flex-col gap-3">
                            <Link
                                href={`/game/${gameId}/meeting`}
                                className="flex items-center justify-center w-full min-h-[44px] border-2 border-red-500/40 text-red-200 font-rajdhani font-bold uppercase tracking-widest text-sm hover:bg-red-500/15 transition-colors"
                            >
                                {t("game.questPage.joinMeeting")}
                            </Link>
                            <Link
                                href={`/game/${gameId}`}
                                className="flex items-center justify-center w-full min-h-[44px] border-2 border-primary/50 bg-transparent text-primary font-rajdhani font-bold uppercase tracking-widest text-sm hover:bg-primary/10 transition-colors"
                            >
                                {t("game.questPage.returnToCockpit")}
                            </Link>
                        </div>
                    </div>
                </main>
            );
        }

        // Quest already completed guard
        if (currentQuest) {
            const completedQuests = currentPlayer.completedQuests ?? [];
            if (!isQuestCompletionFlowActive && completedQuests.includes(currentQuest.id)) {
                return (
                    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                        <div className="max-w-2xl w-full border-2 border-role-crewmate/20 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm">
                            <div className="flex items-center justify-center gap-3">
                                <Check className="w-6 h-6 text-role-crewmate" aria-hidden="true" />
                                <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-role-crewmate font-orbitron">
                                    {t("game.questPage.questAlreadyCompletedTitle")}
                                </h1>
                            </div>
                            <p className="text-center text-muted-foreground font-rajdhani">
                                {t("game.questPage.questAlreadyCompletedMessage")}
                            </p>
                            <Link
                                href={`/game/${gameId}`}
                                className="flex items-center justify-center w-full min-h-[44px] border-2 border-primary/50 bg-transparent text-primary font-rajdhani font-bold uppercase tracking-widest text-sm hover:bg-primary/10 active:scale-95 transition-all touch-manipulation"
                            >
                                {t("game.questPage.returnToCockpit")}
                            </Link>
                        </div>
                    </main>
                );
            }

            // Quest assignment guard (Story 11.3)
            if (gameState.batchId && currentQuest.id !== "impostor-sim") {
                const assignedQuests = currentPlayer.assignedQuests ?? [];
                if (!assignedQuests.includes(currentQuest.id)) {
                    return (
                        <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                            <ErrorView
                                title={t("game.questPage.questNotAssignedTitle")}
                                message={t("game.questPage.questNotAssignedMessage")}
                                code={ERROR_CODES.ERR_QUEST_NOT_ASSIGNED}
                                onRetry={() => { router.push(`/game/${gameId}`); }}
                                showRecoverSignalAction={false}
                                retryActionPrimary
                            />
                        </main>
                    );
                }
            }
        }
    }

    // No quest available
    if (!currentQuest) {
        if (gameState && isValidDuration(duration)) {
            // Check if quest pool is empty (deterministic check, no random)
            if (getQuestGamesByDuration(duration).length === 0) {
                return (
                    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                        <ErrorView
                            title={t("game.questPage.noQuestTitle")}
                            message={t("game.questPage.noQuestMessage")}
                            code={ERROR_CODES.ERR_NO_QUESTS}
                            onRetry={() => { router.push(`/game/${gameId}`); }}
                            showRecoverSignalAction={false}
                            retryActionPrimary
                        />
                    </main>
                );
            }
        }

        // Still loading quest
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-primary/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm animate-pulse">
                    <div className="text-primary text-center tracking-[0.2em] uppercase text-sm font-orbitron">
                        {t("game.questPage.selectingQuest")}
                    </div>
                </div>
            </main>
        );
    }

    return <QuestView quest={currentQuest} gameId={gameId} userId={userId ?? undefined} />;
}
