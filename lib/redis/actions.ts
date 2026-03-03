"use server";

import { redis, GAME_TTL_SECONDS } from "./client";
import { GameState, ActionResponse, PlayerRole } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { getBatch, getBatchData } from "./batch-actions";
import { getTotalQuestGamesCount } from "@/lib/constants/quest-pool";
import { generateShortCode } from "@/lib/utils/short-code.server";
import { Quest, QuestGame } from "@/types/quest";
import { assignQuestsFromBatch } from "@/lib/quests/quest-assignment";

import { verifySession, createPlayerSession, verifyPlayerSession } from "./auth-utils";

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
        const defaultQuestsPerPlayer = { short: 1, medium: 1, long: 1 }; // 3 quests minimum
        const questsPerPlayer = input?.questsPerPlayer || defaultQuestsPerPlayer;

        // Validate minimum quests per player (must be at least 1 total)
        const totalRequested = questsPerPlayer.short + questsPerPlayer.medium + questsPerPlayer.long;
        if (totalRequested < 1) {
            return {
                success: false,
                error: "At least 1 quest per player required",
                code: ERROR_CODES.ERR_INVALID_INPUT,
            };
        }

        // Validate quests per player if batch is provided
        if (batchId) {
            const batchResponse = await getBatchData(batchId);
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

        let questsTotal = getTotalQuestGamesCount(); // Default total from pool
        if (batchId) {
            const batchResponse = await getBatchData(batchId);
            if (!batchResponse.success || !batchResponse.data) {
                return {
                    success: false,
                    error: `Failed to load batch [${batchId}]: ${batchResponse.error || "Unknown error"}`,
                    code: ERROR_CODES.ERR_INVALID_INPUT,
                };
            }
            questsTotal = batchResponse.data.quests.length;
        }

        // Get admin session info to add admin as first player
        const adminSession = await verifySession();
        if (!adminSession.success || !adminSession.data) {
            return {
                success: false,
                error: "Unauthorized access: Organizer credentials required.",
                code: ERROR_CODES.ERR_UNAUTHORIZED,
            };
        }

        const initialState: GameState = {
            id: shortCode,
            status: "LOBBY",
            players: [
                {
                    id: adminSession.data.userId,
                    name: adminSession.data.username,
                    role: "ADMIN",
                    isAlive: true,
                }
            ],
            createdAt: Date.now(),
            creatorId: adminSession.data.userId,
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
        // Verify admin session and permissions
        const session = await verifySession();
        if (!session.success || !session.data) {
            return {
                success: false,
                error: "Unauthorized: Only the game creator can start the game.",
                code: ERROR_CODES.ERR_UNAUTHORIZED,
            };
        }

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

            // Check if the session user is the game creator
            if (state.creatorId !== session.data!.userId) {
                validationError = {
                    success: false,
                    error: "Unauthorized: Only the game creator can start the game.",
                    code: ERROR_CODES.ERR_UNAUTHORIZED,
                };
                return null; // Abort transaction
            }

            // Idempotent: already IN_PROGRESS is fine
            if (state.status === "IN_PROGRESS") {
                validationError = null; // Not an error, handled below
                return state; // Return current state to maintain success response
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

        // If result is null (shouldn't happen with current logic), get current state
        if (!result) {
            const currentState = await redis.get<GameState>(stateKey);
            return {
                success: true,
                data: currentState!,
            };
        }

        // result is the updated state (or original if no update was needed)
        return {
            success: true,
            data: result,
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

        // Story 11.3: Game Settings from Batch - Assign quests from batch
        let assignedQuestIds: string[] | undefined = undefined;

        if (state.batchId) {
            const assignedQuests = await assignQuestsFromBatch(state);

            // If we have a batch but failed to assign quests, treat as an error
            // (Unless the intended distribution was 0 total, which we validated above as 1 min)
            if (assignedQuests.length === 0) {
                return {
                    success: false,
                    error: "Failed to assign quests from mission batch.",
                    code: ERROR_CODES.ERR_SIGNAL_LOST
                };
            }
            assignedQuestIds = assignedQuests.map(a => a.questId);
        }

        // Add new player with assigned quests
        const newPlayer = {
            id: userId,
            name: sanitizedName,
            isAlive: true,
            assignedQuests: assignedQuestIds,
        };

        const updatedState: GameState = {
            ...state,
            players: [...state.players, newPlayer],
        };

        await redis.set(stateKey, updatedState);

        // Secure the player's identity moving forward
        const sessionResult = await createPlayerSession(userId, gameId);
        if (!sessionResult.success) {
            console.error("Failed to establish secure session:", sessionResult.error);
        }

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
        const sessionCheck = await verifyPlayerSession(userId, gameId);
        if (!sessionCheck.success) {
            return {
                success: false,
                error: sessionCheck.error || "Session verification failed",
                code: sessionCheck.code || "ERR_INVALID_SESSION"
            };
        }

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

            // Story 11.3: Game Settings from Batch - Validate quest is in player's assigned quests
            // CRITICAL: If game is from a batch, player MUST have assignedQuests
            if (state.batchId) {
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
        const sessionCheck = await verifyPlayerSession(userId, gameId);
        if (!sessionCheck.success) {
            return {
                success: false,
                error: sessionCheck.error || "Session verification failed",
                code: sessionCheck.code || "ERR_INVALID_SESSION"
            };
        }

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

// Quest metadata actions for Story 8.2
export async function getQuestMetadata(questId: string, gameId: string): Promise<ActionResponse<Quest>> {
    try {
        // Get game state to find batchId
        const gameResponse = await getGame(gameId);
        if (gameResponse.success && gameResponse.data && gameResponse.data.batchId) {
            const batchResponse = await getBatchData(gameResponse.data.batchId);
            if (batchResponse.success && batchResponse.data) {
                // Search for quest in batch's quests array
                const quest = batchResponse.data.quests.find(q => q.id === questId);
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
        const failedQuestsKey = `game:${gameId}:player:${userId}:failed-quests`;
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
        const failedQuestsKey = `game:${gameId}:player:${userId}:failed-quests`;

        let validationError: ActionResponse<void> | null = null;

        await redis.atomicUpdate<Record<string, string[]>>(failedQuestsKey, (failedQuests) => {
            const current = failedQuests ?? {};
            const questFailed = current[questId] ?? [];

            // Avoid duplicates
            if (!questFailed.includes(contentId)) {
                current[questId] = [...questFailed, contentId];
            }

            return current;
        }, GAME_TTL_SECONDS);

        if (validationError) {
            return validationError;
        }

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

export async function eliminatePlayer(
    gameId: string,
    userId: string
): Promise<ActionResponse<{ isAlive: boolean }>> {
    try {
        const sessionCheck = await verifyPlayerSession(userId, gameId);
        if (!sessionCheck.success) {
            return {
                success: false,
                error: sessionCheck.error || "Session verification failed",
                code: sessionCheck.code || "ERR_INVALID_SESSION"
            };
        }

        const stateKey = `game:${gameId}:state`;

        let validationError: ActionResponse<{ isAlive: boolean }> | null = null;

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
                    error: "Cannot eliminate player: game is not in progress.",
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

            // Idempotent: already eliminated - return success without changing state
            if (!player.isAlive) {
                validationError = {
                    success: true,
                    data: { isAlive: false },
                };
                return null;
            }

            const updatedPlayers = [...state.players];
            updatedPlayers[playerIndex] = {
                ...updatedPlayers[playerIndex],
                isAlive: false,
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
        const isAlive = updatedPlayer?.isAlive ?? false;

        return {
            success: true,
            data: { isAlive },
        };
    } catch (error) {
        console.error("Failed to eliminate player:", error);
        return {
            success: false,
            error: "Failed to eliminate player.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}


export async function getGameQuests(gameId: string): Promise<ActionResponse<Quest[]>> {
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

        if (!state.batchId) {
            return {
                success: true,
                data: [],
            };
        }

        const batchResponse = await getBatchData(state.batchId);
        if (batchResponse.success && batchResponse.data) {
            return {
                success: true,
                data: batchResponse.data.quests,
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

export async function deleteGame(gameId: string): Promise<ActionResponse<void>> {
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

        if (!gameId?.trim()) {
            return {
                success: false,
                error: "Game ID is required",
                code: ERROR_CODES.ERR_INVALID_INPUT,
            };
        }

        // Find all keys associated with this game
        // Patterns used in the codebase:
        // game:${gameId}:state
        // game:${gameId}:player:${userId}:failed-quests
        const gameKeys = await redis.keys(`game:${gameId}:*`);
        
        if (gameKeys.length > 0) {
            const deletePromises = gameKeys.map(key => redis.del(key));
            await Promise.all(deletePromises);
        }

        return {
            success: true,
        };
    } catch (error) {
        console.error(`Failed to delete game ${gameId}:`, error);
        return {
            success: false,
            error: "Failed to stop game session.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}
