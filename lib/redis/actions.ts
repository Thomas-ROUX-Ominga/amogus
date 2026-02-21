"use server";

import { redis, GAME_TTL_SECONDS } from "./client";
import { GameState, ActionResponse, PlayerRole } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { getBatch } from "./batch-actions";
import { getTotalQuestGamesCount } from "@/lib/constants/quest-pool";
import { generateShortCode } from "@/lib/utils/short-code.server";

import { verifySession } from "./auth-utils";

export interface CreateGameInput {
  batchId?: string;
  questsPerPlayer?: {
    short: number;
    medium: number;
    long: number;
  };
}

export async function createGame(input?: CreateGameInput): Promise<ActionResponse<string>> {
    try {
        // Verify organizer session
        const session = await verifySession();
        if (!session.success) {
            return {
                success: false,
                error: "Unauthorized access: Organizer credentials required.",
                code: ERROR_CODES.ERR_UNAUTHORIZED,
            };
        }

        // Generate short code instead of UUID
        const shortCode = await generateShortCode();
        
        // Extract batchId and validate quests per player
        const batchId = input?.batchId;
        const questsPerPlayer = input?.questsPerPlayer || { short: 2, medium: 2, long: 2 };
        
        // Validate quests per player if batch is provided
        if (batchId) {
            const batchResponse = await getBatch(batchId);
            if (batchResponse.success && batchResponse.data) {
                const totalRequested = questsPerPlayer.short + questsPerPlayer.medium + questsPerPlayer.long;
                const availableQuests = batchResponse.data.quests.length;
                
                if (totalRequested > availableQuests) {
                    return {
                        success: false,
                        error: `Requested ${totalRequested} quests per player, but only ${availableQuests} available in batch.`,
                        code: ERROR_CODES.ERR_INVALID_INPUT,
                    };
                }
            }
        }
        
        // Fetch batch if batchId is provided
        let questsTotal = getTotalQuestGamesCount(); // Default total from pool
        if (batchId) {
            const batchResponse = await getBatch(batchId);
            if (!batchResponse.success || !batchResponse.data) {
                return {
                    success: false,
                    error: `Failed to load batch [${batchId}]: ${batchResponse.error || "Unknown error"}`,
                    code: ERROR_CODES.ERR_INVALID_INPUT,
                };
            }
            questsTotal = batchResponse.data.quests.length;
        }

        const initialState: GameState = {
            id: shortCode,
            status: "LOBBY",
            players: [],
            createdAt: Date.now(),
            batchId,
            questsTotal,
            questsPerPlayer,
        };

        // Store game state in Redis with 24h TTL using short code key pattern
        await redis.set(`game:${shortCode}:state`, initialState, GAME_TTL_SECONDS);

        return {
            success: true,
            data: shortCode,
        };
    } catch (error) {
        console.error("Failed to create game:", error);
        return {
            success: false,
            error: "Failed to create game. Please try again.",
        };
    }
}

export async function getGame(id: string): Promise<ActionResponse<GameState>> {
    try {
        const state = await redis.get<GameState>(`game:${id}:state`);

        if (!state) {
            return {
                success: false,
                error: "Game module not found or decommissioned.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        return {
            success: true,
            data: state,
        };
    } catch (error) {
        console.error("Failed to fetch game:", error);
        return {
            success: false,
            error: "Failed to establish link with game module.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export async function startGame(
    gameId: string
): Promise<ActionResponse<GameState>> {
    try {
        const stateKey = `game:${gameId}:state`;

        // Use a validation result holder to communicate errors from the updater
        let validationError: ActionResponse<GameState> | null = null;

        const result = await redis.atomicUpdate<GameState>(stateKey, (state) => {
            if (!state) {
                validationError = {
                    success: false,
                    error: "Game session not found.",
                    code: ERROR_CODES.GAME_NOT_FOUND,
                };
                return null; // Abort transaction
            }

            // Idempotent: already IN_PROGRESS is fine
            if (state.status === "IN_PROGRESS") {
                validationError = null; // Not an error, handled below
                return null; // No update needed
            }

            // Only LOBBY → IN_PROGRESS is allowed
            if (state.status !== "LOBBY") {
                validationError = {
                    success: false,
                    error: "Cannot launch: game is not in lobby state.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                };
                return null;
            }

            // Minimum players validation
            if (state.players.length < 1) {
                validationError = {
                    success: false,
                    error: "Cannot launch: at least one crew member must join.",
                    code: ERROR_CODES.ERR_NO_PLAYERS,
                };
                return null;
            }

            return { ...state, status: "IN_PROGRESS" };
        }, GAME_TTL_SECONDS);

        // If updater returned null, check why
        if (validationError) {
            return validationError;
        }

        // result is the updated state (or original if no update was needed)
        return {
            success: true,
            data: result!,
        };
    } catch (error) {
        console.error("Failed to start game:", error);
        return {
            success: false,
            error: "Signal lost while trying to launch mission.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export async function joinGame(
    gameId: string,
    playerName: string,
    userId: string
): Promise<ActionResponse<GameState>> {
    // 1. Strict Server-Side Validation
    const sanitizedName = playerName.trim().slice(0, 20);
    if (!sanitizedName) {
        return { success: false, error: "Identification failed: Empty alias.", code: ERROR_CODES.ERR_INVALID_ALIAS };
    }

    // Basic ID format validation (allow UUID or simple non-empty strings for flexibility)
    if (!userId || userId.length < 5) {
        return { success: false, error: "Identification failed: Invalid crew signature.", code: ERROR_CODES.ERR_INVALID_SIGNATURE };
    }

    try {
        const stateKey = `game:${gameId}:state`;
        const state = await redis.get<GameState>(stateKey);

        if (!state) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        // 2. Concurrency check (Check for existing player again before mutation)
        const existingPlayer = state.players.find((p) => p.id === userId);
        if (existingPlayer) {
            return {
                success: true,
                data: state,
            };
        }

        // 3. Prevent overflow
        if (state.players.length >= 10) {
            return { success: false, error: "Cockpit at maximum capacity.", code: ERROR_CODES.ERR_FULL_CAPACITY };
        }

        // Add new player
        const newPlayer = {
            id: userId,
            name: sanitizedName,
            isAlive: true,
        };

        const updatedState: GameState = {
            ...state,
            players: [...state.players, newPlayer],
            // Set creatorId if this is the first player joining
            creatorId: state.players.length === 0 ? userId : state.creatorId,
        };

        await redis.set(stateKey, updatedState);

        return {
            success: true,
            data: updatedState,
        };
    } catch (error) {
        console.error("Failed to join game:", error);
        return {
            success: false,
            error: "Signal lost while trying to join cockpit.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export async function completeQuest(
    gameId: string,
    userId: string,
    questId: string
): Promise<ActionResponse<{ completedQuests: string[]; questsCompleted: number }>> {
    try {
        const stateKey = `game:${gameId}:state`;

        let validationError: ActionResponse<{ completedQuests: string[]; questsCompleted: number }> | null = null;

        const result = await redis.atomicUpdate<GameState>(stateKey, (state) => {
            if (!state) {
                validationError = {
                    success: false,
                    error: "Game session not found.",
                    code: ERROR_CODES.GAME_NOT_FOUND,
                };
                return null;
            }

            if (state.status !== "IN_PROGRESS") {
                validationError = {
                    success: false,
                    error: "Cannot complete quest: game is not in progress.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                };
                return null;
            }

            const playerIndex = state.players.findIndex((p) => p.id === userId);
            if (playerIndex === -1) {
                validationError = {
                    success: false,
                    error: "Player not found in game.",
                    code: ERROR_CODES.ERR_INVALID_SIGNATURE,
                };
                return null;
            }

            const player = state.players[playerIndex];
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
            const updatedPlayers = [...state.players];
            updatedPlayers[playerIndex] = {
                ...updatedPlayers[playerIndex],
                completedQuests: updatedCompleted,
                lastQuestCompleted: Date.now(), // Set timestamp for last completed quest
            };

            return {
                ...state,
                players: updatedPlayers,
            };
        }, GAME_TTL_SECONDS);

        if (validationError) {
            return validationError;
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

export async function refreshGame(
    gameId: string
): Promise<ActionResponse<GameState>> {
    try {
        // Simply call getGame - this ensures fresh data from Redis
        const result = await getGame(gameId);
        return result;
    } catch (error) {
        console.error("Failed to refresh game:", error);
        return {
            success: false,
            error: "Failed to refresh game data.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export async function selectRole(
    gameId: string,
    userId: string,
    role: PlayerRole
): Promise<ActionResponse<{ role: PlayerRole }>> {
    // Validate role value
    if (role !== "CREWMATE" && role !== "IMPOSTOR") {
        return {
            success: false,
            error: "Invalid role selection.",
            code: ERROR_CODES.ERR_INVALID_ROLE,
        };
    }

    try {
        const stateKey = `game:${gameId}:state`;

        let validationError: ActionResponse<{ role: PlayerRole }> | null = null;

        await redis.atomicUpdate<GameState>(stateKey, (state) => {
            if (!state) {
                validationError = {
                    success: false,
                    error: "Game session not found.",
                    code: ERROR_CODES.GAME_NOT_FOUND,
                };
                return null;
            }

            if (state.status !== "IN_PROGRESS") {
                validationError = {
                    success: false,
                    error: "Cannot select role: game is not in progress.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                };
                return null;
            }

            const playerIndex = state.players.findIndex((p) => p.id === userId);
            if (playerIndex === -1) {
                validationError = {
                    success: false,
                    error: "Player not found in game.",
                    code: ERROR_CODES.ERR_INVALID_SIGNATURE,
                };
                return null;
            }

            const updatedPlayers = [...state.players];
            updatedPlayers[playerIndex] = {
                ...updatedPlayers[playerIndex],
                role,
            };

            return {
                ...state,
                players: updatedPlayers,
            };
        }, GAME_TTL_SECONDS);

        if (validationError) {
            return validationError;
        }

        return {
            success: true,
            data: { role },
        };
    } catch (error) {
        console.error("Failed to select role:", error);
        return {
            success: false,
            error: "Signal lost while assigning role.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

