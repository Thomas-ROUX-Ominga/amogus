"use server";

import { redis, GAME_TTL_SECONDS } from "@/lib/redis/client";
import { GameState, ActionResponse } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { getBatchData } from "@/lib/redis/batch-actions";
import { Quest } from "@/types/quest";
import { getFailedQuestsKey } from "@/lib/redis/game-state-keys";
import {
    mutateGameState,
    readGameState,
    resolveRuntimeTransitions,
    resolveActionAccess,
    resolveViewerScopeForGame,
    checkWinConditions,
} from "./state-core";

export async function completeQuest(
    gameId: string,
    userId: string,
    questId: string
): Promise<ActionResponse<{ completedQuests: string[]; questsCompleted: number }>> {
    try {
        const accessScope = await resolveActionAccess(gameId, userId);
        if (!accessScope.success || !accessScope.data) {
            return {
                success: false,
                error: accessScope.error || "Session verification failed",
                code: accessScope.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }
        userId = accessScope.data.viewerUserId;

        let validationError: ActionResponse<{ completedQuests: string[]; questsCompleted: number }> | null = null;

        const result = await mutateGameState(gameId, (state) => {
            const now = Date.now();
            const workingState = resolveRuntimeTransitions(state, now);

            if (workingState.meeting?.status === "ACTIVE") {
                validationError = {
                    success: false,
                    error: "Cannot complete quest during an active meeting.",
                    code: ERROR_CODES.ERR_MEETING_ACTIVE,
                };
                return null;
            }

            if (workingState.status !== "IN_PROGRESS") {
                validationError = {
                    success: false,
                    error: "Cannot complete quest: game is not in progress.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                };
                return null;
            }

            const playerIndex = workingState.players.findIndex((p) => p.id === userId);
            if (playerIndex === -1) {
                validationError = {
                    success: false,
                    error: "Player not found in game.",
                    code: ERROR_CODES.ERR_INVALID_SIGNATURE,
                };
                return null;
            }

            const player = workingState.players[playerIndex];

            // Story 11.5: Allow eliminated Crewmates to complete quests (Ghost Mode)
            // Only block if player is eliminated AND is an Impostor
            if (!player.isAlive && player.role === "IMPOSTOR") {
                validationError = {
                    success: false,
                    error: "Cannot complete quest: eliminated Impostors cannot complete quests.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                };
                return null;
            }

            if (player.role === "CREWMATE" && workingState.sabotageState?.active === "COMMUNICATIONS") {
                validationError = {
                    success: false,
                    error: "Communications sabotage is active. Crewmates cannot complete quests.",
                    code: ERROR_CODES.ERR_SABOTAGE_COMMUNICATIONS_QUESTS_BLOCKED,
                };
                return null;
            }

            // Story 11.3: Game Settings from Batch - Validate quest is in player's assigned quests
            // CRITICAL: If game is from a batch, player MUST have assignedQuests
            if (workingState.batchId) {
                if (!player.assignedQuests || !player.assignedQuests.includes(questId)) {
                    validationError = {
                        success: false,
                        error: "Cannot complete quest: this quest is not assigned to you.",
                        code: ERROR_CODES.ERR_INVALID_INPUT,
                    };
                    return null;
                }
            }

            const completed = player.completedQuests ?? [];

            // Idempotent: already completed — return success without duplicating
            if (completed.includes(questId)) {
                validationError = {
                    success: true,
                    data: { completedQuests: completed, questsCompleted: completed.length },
                };
                return null;
            }

            const updatedCompleted = [...completed, questId];
            const updatedPlayers = [...workingState.players];
            updatedPlayers[playerIndex] = {
                ...updatedPlayers[playerIndex],
                completedQuests: updatedCompleted,
                lastQuestCompleted: now, // Set timestamp for last completed quest
            };

            // Check for victory after quest completion
            const winCheck = checkWinConditions({ ...workingState, players: updatedPlayers });
            if (winCheck.finished) {
                return {
                    ...workingState,
                    players: updatedPlayers,
                    status: "FINISHED",
                    winner: winCheck.winner
                };
            }

            return {
                ...workingState,
                players: updatedPlayers,
            };
        });

        if (validationError) {
            return validationError;
        }

        if (!result) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        // Extract updated player data from result
        const updatedPlayer = result?.players.find((p) => p.id === userId);
        const updatedCompleted = updatedPlayer?.completedQuests ?? [];

        return {
            success: true,
            data: {
                completedQuests: updatedCompleted,
                questsCompleted: updatedCompleted.length,
            },
        };
    } catch (error) {
        console.error("Failed to complete quest:", error);
        return {
            success: false,
            error: "Failed to record quest completion.",
            code: ERROR_CODES.ERR_QUEST_COMPLETE_FAILED,
        };
    }
}
// Quest metadata actions for Story 8.2
export async function getQuestMetadata(
    questId: string,
    gameId: string,
    userId?: string
): Promise<ActionResponse<Quest>> {
    try {
        const state = await readGameState(gameId);
        if (!state) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        const viewerScope = await resolveViewerScopeForGame(gameId, state, userId);
        if (!viewerScope.success) {
            return {
                success: false,
                error: viewerScope.error ?? "Access denied.",
                code: viewerScope.code ?? ERROR_CODES.ERR_INVALID_SIGNATURE,
            };
        }

        if (state.batchId) {
            const batchResponse = await getBatchData(state.batchId);
            if (batchResponse.success && batchResponse.data) {
                // Search for quest in batch's quests array
                const quest = batchResponse.data.quests.find((q) => q.id === questId);
                if (quest) {
                    return {
                        success: true,
                        data: quest,
                    };
                }
            }
        }
        return {
            success: false,
            error: `Quest metadata not found for questId: ${questId}`,
            code: ERROR_CODES.ERR_NOT_FOUND,
        };
    } catch (error) {
        console.error("Failed to get quest metadata:", error);
        return {
            success: false,
            error: "Failed to retrieve quest metadata.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}
export async function getPlayerFailedQuests(gameId: string, userId: string): Promise<ActionResponse<Record<string, string[]>>> {
    try {
        const accessScope = await resolveActionAccess(gameId, userId);
        if (!accessScope.success || !accessScope.data) {
            return {
                success: false,
                error: accessScope.error || "Session verification failed",
                code: accessScope.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }
        userId = accessScope.data.viewerUserId;

        const failedQuestsKey = getFailedQuestsKey(gameId, userId);
        const failedQuests = await redis.get<Record<string, string[]>>(failedQuestsKey);

        return {
            success: true,
            data: failedQuests ?? {},
        };
    } catch (error) {
        console.error("Failed to get player failed quests:", error);
        return {
            success: false,
            error: "Failed to retrieve failed quest data.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}
export async function addFailedQuest(
    gameId: string,
    userId: string,
    questId: string,
    contentId: string
): Promise<ActionResponse<void>> {
    try {
        const accessScope = await resolveActionAccess(gameId, userId);
        if (!accessScope.success || !accessScope.data) {
            return {
                success: false,
                error: accessScope.error || "Session verification failed",
                code: accessScope.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }
        userId = accessScope.data.viewerUserId;

        const failedQuestsKey = getFailedQuestsKey(gameId, userId);

        await redis.atomicUpdate<Record<string, string[]>>(failedQuestsKey, (failedQuests) => {
            const current = failedQuests ?? {};
            const questFailed = current[questId] ?? [];

            // Avoid duplicates
            if (!questFailed.includes(contentId)) {
                current[questId] = [...questFailed, contentId];
            }

            return current;
        }, GAME_TTL_SECONDS);

        return {
            success: true,
        };
    } catch (error) {
        console.error("Failed to add failed quest:", error);
        return {
            success: false,
            error: "Failed to record failed quest.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}
export async function getGameQuests(gameId: string, userId?: string): Promise<ActionResponse<Quest[]>> {
    try {
        const state = await readGameState(gameId);

        if (!state) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        if (!state.batchId) {
            return {
                success: true,
                data: [],
            };
        }

        const viewerScope = await resolveViewerScopeForGame(gameId, state, userId);
        if (!viewerScope.success || !viewerScope.data) {
            return {
                success: false,
                error: viewerScope.error ?? "Access denied.",
                code: viewerScope.code ?? ERROR_CODES.ERR_INVALID_SIGNATURE,
            };
        }
        const viewerData = viewerScope.data;

        const batchResponse = await getBatchData(state.batchId);
        if (batchResponse.success && batchResponse.data) {
            if (viewerData.isOrganizer) {
                return {
                    success: true,
                    data: batchResponse.data.quests,
                };
            }

            const viewerPlayer = viewerData.viewerUserId
                ? state.players.find((player) => player.id === viewerData.viewerUserId)
                : undefined;
            const assignedQuestIds = new Set(viewerPlayer?.assignedQuests ?? []);

            return {
                success: true,
                data:
                    assignedQuestIds.size > 0
                        ? batchResponse.data.quests.filter((quest) => assignedQuestIds.has(quest.id))
                        : [],
            };
        }

        return {
            success: false,
            error: "Failed to get batch data for game.",
            code: ERROR_CODES.ERR_NOT_FOUND,
        };
    } catch (error) {
        console.error("Failed to get game quests:", error);
        return {
            success: false,
            error: "Failed to establish link with game module.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

