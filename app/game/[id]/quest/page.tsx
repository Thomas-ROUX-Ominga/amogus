"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useGameStore } from "@/lib/store/game-store";
import { useLocalUser } from "@/hooks/use-local-user";
import { ErrorView } from "@/components/game/error-view";
import { QuestView } from "@/components/game/quest-view";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { isValidDuration, getRandomQuest, getQuestsByDuration, getQuestById } from "@/lib/constants/quest-pool";
import { QuestDuration } from "@/types/quest";

export default function QuestPage() {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                    <div className="max-w-2xl w-full border-2 border-primary/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm animate-pulse">
                        <div className="text-primary text-center tracking-[0.2em] uppercase text-sm font-orbitron">
                            Chargement de la quête...
                        </div>
                    </div>
                </main>
            }
        >
            <QuestPageContent />
        </Suspense>
    );
}

function QuestPageContent() {
    const { id } = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const duration = searchParams.get("duration");
    const questId = searchParams.get("questId");
    const { userId } = useLocalUser();
    const {
        gameState,
        isLoading,
        error,
        errorCode,
        currentQuest,
        setCurrentQuest,
        fetchGame,
    } = useGameStore();

    const gameId = id as string;

    useEffect(() => {
        if (id) {
            fetchGame(id as string, userId ?? undefined);
        }
    }, [id, userId, fetchGame]);

    // Select a random quest once game is loaded and duration is valid
    const questError = useMemo(() => {
        // If targeting a specific quest by ID, skip duration validation
        if (questId) return null;

        if (!isValidDuration(duration)) {
            return { code: ERROR_CODES.ERR_INVALID_DURATION, message: "Durée invalide. Les valeurs acceptées sont : short, medium, long." };
        }
        return null;
    }, [duration, questId]);

    useEffect(() => {
        if (gameState && !currentQuest) {
            // Role check for Impostors - Story 4.1
            const currentPlayer = gameState.players.find((p) => p.id === userId);
            if (currentPlayer?.role === "IMPOSTOR") {
                setCurrentQuest({
                    id: "impostor-sim",
                    type: "true-false", // Keep type for TS compatibility but it's irrelevant for UI
                    duration: (isValidDuration(duration) ? duration : "short") as QuestDuration,
                    title: "SIGNAL OVERRIDE",
                    instruction: "PROTOCOL DE CAMOUFLAGE ACTIF",
                });
                return;
            }

            if (questId) {
                const quest = getQuestById(questId);
                if (quest) {
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
            } else if (isValidDuration(duration)) {
                const quest = getRandomQuest(duration);
                if (quest) {
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
    }, [gameState, duration, questId, currentQuest, setCurrentQuest, userId]);

    // Loading state
    if (isLoading || !userId) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-primary/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm animate-pulse">
                    <div className="text-primary text-center tracking-[0.2em] uppercase text-sm font-orbitron">
                        Chargement de la quête...
                    </div>
                </div>
            </main>
        );
    }

    // Game fetch error
    if (error) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <ErrorView
                    title={errorCode === ERROR_CODES.GAME_NOT_FOUND ? "SESSION INTROUVABLE" : "SIGNAL PERDU"}
                    message={error}
                    code={errorCode || ERROR_CODES.ERR_QUEST_LOAD_FAILED}
                    onRetry={() => { if (id) fetchGame(gameId); }}
                />
            </main>
        );
    }

    // Duration validation error
    if (questError) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <ErrorView
                    title="DURÉE INVALIDE"
                    message={questError.message}
                    code={questError.code}
                    onRetry={() => { router.push(`/game/${gameId}`); }}
                />
            </main>
        );
    }

    // Game state validations
    if (gameState) {
        // Game not in progress
        if (gameState.status !== "IN_PROGRESS") {
            return (
                <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                    <ErrorView
                        title="MISSION INACTIVE"
                        message="La partie n'est pas en cours. Retournez au cockpit."
                        code={ERROR_CODES.ERR_INVALID_STATE}
                        onRetry={() => { router.push(`/game/${gameId}`); }}
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
                        title="ACCÈS REFUSÉ"
                        message="Vous n'êtes pas un membre de cet équipage."
                        code={ERROR_CODES.ERR_INVALID_SIGNATURE}
                        onRetry={() => { router.push(`/game/${gameId}`); }}
                    />
                </main>
            );
        }

        // Player has no role
        if (!currentPlayer.role) {
            return (
                <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                    <ErrorView
                        title="RÔLE NON ASSIGNÉ"
                        message="Vous devez d'abord sélectionner un rôle avant d'accéder aux quêtes."
                        code={ERROR_CODES.ERR_INVALID_ROLE}
                        onRetry={() => { router.push(`/game/${gameId}`); }}
                    />
                </main>
            );
        }

        // Quest already completed guard
        if (currentQuest) {
            const completedQuests = currentPlayer.completedQuests ?? [];
            if (completedQuests.includes(currentQuest.id)) {
                return (
                    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                        <div className="max-w-2xl w-full border-2 border-[#2DA44E]/20 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm">
                            <div className="flex items-center justify-center gap-3">
                                <Check className="w-6 h-6 text-[#2DA44E]" aria-hidden="true" />
                                <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-[#2DA44E] font-orbitron">
                                    QUÊTE DÉJÀ ACCOMPLIE
                                </h1>
                            </div>
                            <p className="text-center text-muted-foreground font-rajdhani">
                                Vous avez déjà validé cette mission.
                            </p>
                            <Link
                                href={`/game/${gameId}`}
                                className="flex items-center justify-center w-full min-h-[44px] border-2 border-primary/50 bg-transparent text-primary font-rajdhani font-bold uppercase tracking-widest text-sm hover:bg-primary/10 active:scale-95 transition-all touch-manipulation"
                            >
                                RETOUR AU COCKPIT
                            </Link>
                        </div>
                    </main>
                );
            }
        }
    }

    // No quest available
    if (!currentQuest) {
        if (gameState && isValidDuration(duration)) {
            // Check if quest pool is empty (deterministic check, no random)
            if (getQuestsByDuration(duration).length === 0) {
                return (
                    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                        <ErrorView
                            title="AUCUNE QUÊTE"
                            message="Aucune quête disponible pour cette durée."
                            code={ERROR_CODES.ERR_NO_QUESTS}
                            onRetry={() => { router.push(`/game/${gameId}`); }}
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
                        Sélection de la quête...
                    </div>
                </div>
            </main>
        );
    }

    return <QuestView quest={currentQuest} gameId={gameId} userId={userId ?? undefined} />;
}
