"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/game-store";
import { useLocalUser } from "@/hooks/use-local-user";
import { ErrorView } from "@/components/game/error-view";
import { QuestView } from "@/components/game/quest-view";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { isValidDuration, getRandomQuest, getQuestsByDuration } from "@/lib/constants/quest-pool";

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
            fetchGame(id as string);
        }
    }, [id, fetchGame]);

    // Select a random quest once game is loaded and duration is valid
    const questError = useMemo(() => {
        if (!isValidDuration(duration)) {
            return { code: ERROR_CODES.ERR_INVALID_DURATION, message: "Durée invalide. Les valeurs acceptées sont : short, medium, long." };
        }
        return null;
    }, [duration]);

    useEffect(() => {
        if (gameState && isValidDuration(duration) && !currentQuest) {
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
    }, [gameState, duration, currentQuest, setCurrentQuest]);

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

    return <QuestView quest={currentQuest} gameId={gameId} />;
}
