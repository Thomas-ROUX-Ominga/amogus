"use server";

import { redis, GAME_TTL_SECONDS } from "@/lib/redis/client";
import { GameState, ActionResponse, ImpostorAssignmentMode } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { getBatchData } from "@/lib/redis/batch-actions";
import { getTotalQuestGamesCount } from "@/lib/constants/quest-pool";
import { generateShortCode } from "@/lib/utils/short-code.server";
import { Quest, BatchSabotages } from "@/types/quest";
import { hasCustomGameTimerSettings, normalizeGameTimerSettings } from "@/lib/game/timers";
import { getGameStateKey, getGameNamespacePattern } from "@/lib/redis/game-state-keys";
import { verifySession, createPlayerSession } from "@/lib/redis/auth-utils";
import {
    readGameState,
    mutateGameState,
    normalizeGameState,
    areGameStatesEquivalent,
    isWatchConflictError,
    resolveRuntimeTransitions,
    resolveActionAccess,
    resolveViewerScopeForGame,
    sanitizeGameStateForViewer,
    isPasswordAuthenticatedPlayer,
    normalizePlayerAlias,
    reassignPlayerIdentity,
    migrateReassignedPlayerData,
    markPlayerPresenceConnected,
    isPlayerCurrentlyConnected,
    assignRolesRandomly,
    getAutoImpostorCount,
    getManualImpostorCount,
    getMinimumPlayersToLaunch,
    hasCrewmateMajority,
    optimizeLobbyBatchQuests,
    optimizeCrewmateBatchQuests,
    assignMissingCrewmateBatchQuests,
    checkWinConditions,
    getDefaultSabotageState,
    MAX_PLAYERS_PER_GAME,
} from "./state-core";

export interface CreateGameInput {
    batchId?: string;
    questsPerPlayer?: {
        short: number;
        medium: number;
        long: number;
    };
    impostorMode?: ImpostorAssignmentMode;
    manualImpostorCount?: number;
    enforceDurationLimits?: boolean;
    timerSettings?: {
        meetingDurationSeconds?: number;
        postMeetingGraceSeconds?: number;
        sabotageDurationSeconds?: number;
        sabotageCooldownSeconds?: number;
    };
}

export async function createGame(input?: CreateGameInput): Promise<ActionResponse<string>> {
    try {
        // Verify organizer session
        const session = await verifySession();
        if (!session.success || !session.data) {
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
        const defaultQuestsPerPlayer = { short: 1, medium: 1, long: 1 }; // default distribution
        const questsPerPlayer = input?.questsPerPlayer || defaultQuestsPerPlayer;
        const impostorMode: ImpostorAssignmentMode = input?.impostorMode === "manual" ? "manual" : "auto";
        const manualImpostorCount = impostorMode === "manual"
            ? getManualImpostorCount(input?.manualImpostorCount)
            : undefined;
        const timerSettings = normalizeGameTimerSettings(input?.timerSettings);

        // Validate minimum quests per player (must be at least 1 total)
        const totalRequested = questsPerPlayer.short + questsPerPlayer.medium + questsPerPlayer.long;
        if (totalRequested < 1) {
            return {
                success: false,
                error: "At least 1 quest per player required",
                code: ERROR_CODES.ERR_INVALID_INPUT,
            };
        }

        let questsTotal = getTotalQuestGamesCount(); // Default total from pool
        let batchSabotages: BatchSabotages | undefined;
        if (batchId) {
            const batchResponse = await getBatchData(batchId, { ownerId: session.data.userId });
            if (!batchResponse.success || !batchResponse.data) {
                return {
                    success: false,
                    error: `Failed to load batch [${batchId}]: ${batchResponse.error || "Unknown error"}`,
                    code: ERROR_CODES.ERR_INVALID_INPUT,
                };
            }

            const availableQuests = batchResponse.data.quests.length;
            if (totalRequested > availableQuests) {
                return {
                    success: false,
                    error: `Requested ${totalRequested} quests per player, but only ${availableQuests} available in batch.`,
                    code: ERROR_CODES.ERR_INVALID_INPUT,
                };
            }

            if (input?.enforceDurationLimits) {
                const availableByDuration = {
                    short: batchResponse.data.quests.filter((q) => q.duration === "short").length,
                    medium: batchResponse.data.quests.filter((q) => q.duration === "medium").length,
                    long: batchResponse.data.quests.filter((q) => q.duration === "long").length,
                };

                if (
                    questsPerPlayer.short > availableByDuration.short ||
                    questsPerPlayer.medium > availableByDuration.medium ||
                    questsPerPlayer.long > availableByDuration.long
                ) {
                    return {
                        success: false,
                        error: `Requested quests exceed batch duration limits (short: ${availableByDuration.short}, medium: ${availableByDuration.medium}, long: ${availableByDuration.long}).`,
                        code: ERROR_CODES.ERR_INVALID_INPUT,
                    };
                }
            }

            questsTotal = availableQuests;
            batchSabotages = batchResponse.data.sabotages
                ? {
                      ...batchResponse.data.sabotages,
                      lights: {
                          qrId:
                              (batchResponse.data.sabotages as Partial<BatchSabotages>).lights?.qrId ?? "",
                          location:
                              (batchResponse.data.sabotages as Partial<BatchSabotages>).lights?.location ?? "",
                      },
                  }
                : undefined;
        }

        const organizerData = session.data;

        const now = Date.now();
        const initialState: GameState = {
            id: shortCode,
            status: "LOBBY",
            players: [
                {
                    id: organizerData.userId,
                    name: organizerData.username,
                    isAlive: true,
                }
            ],
            createdAt: now,
            revision: 1,
            updatedAt: now,
            creatorId: organizerData.userId,
            batchId,
            questsTotal,
            questsPerPlayer,
            impostorMode,
            manualImpostorCount,
            timerSettings: hasCustomGameTimerSettings(timerSettings) ? timerSettings : undefined,
            sabotages: batchSabotages,
            sabotageState: getDefaultSabotageState(),
        };

        // Store game state in Redis with 24h TTL using short code key pattern
        await redis.set(getGameStateKey(shortCode), initialState, GAME_TTL_SECONDS);

        // Ensure the creator immediately has a valid player-session for this game.
        try {
            const creatorSessionResult = await createPlayerSession(organizerData.userId, shortCode);
            if (!creatorSessionResult.success) {
                console.error(
                    `Failed to establish creator player-session for game ${shortCode}:`,
                    creatorSessionResult.error
                );
            }
        } catch (error) {
            // Best-effort only: the game must still be created even if cookie writing fails here.
            console.error(`Failed to establish creator player-session for game ${shortCode}:`, error);
        }

        return {
            success: true,
            data: shortCode,
        };
    } catch (error) {
        console.error("Failed to create game:", error);
        return {
            success: false,
            error: "Failed to create game. Please try again.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export async function getGame(id: string, userId?: string): Promise<ActionResponse<GameState>> {
    try {
        const state = await readGameState(id);

        if (!state) {
            return {
                success: false,
                error: "Game module not found or decommissioned.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        const hydratedState = await recoverMissingCrewmateAssignments(id, state);
        const viewerScope = await resolveViewerScopeForGame(id, hydratedState, userId);
        if (!viewerScope.success || !viewerScope.data) {
            return {
                success: false,
                error: viewerScope.error ?? "Access denied.",
                code: viewerScope.code ?? ERROR_CODES.ERR_INVALID_SIGNATURE,
            };
        }

        return {
            success: true,
            data: sanitizeGameStateForViewer(hydratedState, viewerScope.data),
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

async function recoverMissingCrewmateAssignments(
    gameId: string,
    state: GameState
): Promise<GameState> {
    const needsRecovery =
        state.status === "IN_PROGRESS" &&
        Boolean(state.batchId) &&
        Boolean(state.questsPerPlayer) &&
        state.players.some(
            (player) => player.role === "CREWMATE" && (!player.assignedQuests || player.assignedQuests.length === 0)
        );

    if (!needsRecovery || !state.batchId) {
        return state;
    }

    const batchResponse = await getBatchData(state.batchId);
    if (!batchResponse.success || !batchResponse.data) {
        return state;
    }

    const batch = {
        id: batchResponse.data.id,
        quests: batchResponse.data.quests,
    };

    const recovered = await mutateGameState(gameId, (workingState) => {
        if (
            workingState.status !== "IN_PROGRESS" ||
            !workingState.batchId ||
            workingState.batchId !== batch.id ||
            !workingState.questsPerPlayer
        ) {
            return workingState;
        }

        const playersWithAssignedQuests = assignMissingCrewmateBatchQuests(
            workingState,
            workingState.players,
            batch
        );
        if (!playersWithAssignedQuests) {
            return workingState;
        }

        return {
            ...workingState,
            players: playersWithAssignedQuests,
        };
    });

    return recovered ?? state;
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

        let assignmentBatch: { id: string; quests: Quest[] } | null = null;
        const preloadedState = await readGameState(gameId);
        if (preloadedState?.batchId && preloadedState.questsPerPlayer) {
            const batchResponse = await getBatchData(preloadedState.batchId);
            if (!batchResponse.success || !batchResponse.data) {
                return {
                    success: false,
                    error: "Failed to assign quests from mission batch.",
                    code: ERROR_CODES.ERR_SIGNAL_LOST,
                };
            }
            assignmentBatch = {
                id: batchResponse.data.id,
                quests: batchResponse.data.quests,
            };
        }

        // Use a validation result holder to communicate errors from the updater
        let validationError: ActionResponse<GameState> | null = null;

        const result = await mutateGameState(gameId, (state) => {
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
                if (state.impostorMode === undefined) {
                    validationError = null;
                    return state;
                }

                const hasUnassignedRole = state.players.some((player) => !player.role);
                if (!hasUnassignedRole) {
                    validationError = null; // Not an error, handled below
                    return state;
                }

                const fallbackImpostorCount = state.impostorMode === "manual"
                    ? getManualImpostorCount(state.manualImpostorCount)
                    : getAutoImpostorCount(state.players.length);
                const impostorCount = state.assignedImpostorCount || fallbackImpostorCount;
                if (!hasCrewmateMajority(state.players.length, impostorCount)) {
                    validationError = {
                        success: false,
                        error: "Cannot assign roles: crewmates must outnumber impostors.",
                        code: ERROR_CODES.ERR_INVALID_INPUT,
                    };
                    return null;
                }

                const playersWithAssignedRoles = assignRolesRandomly(state.players, impostorCount);
                const playersWithAssignedQuests = optimizeCrewmateBatchQuests(
                    state,
                    playersWithAssignedRoles,
                    assignmentBatch
                );
                if (!playersWithAssignedQuests) {
                    validationError = {
                        success: false,
                        error: "Failed to assign quests from mission batch.",
                        code: ERROR_CODES.ERR_SIGNAL_LOST,
                    };
                    return null;
                }

                validationError = null;
                return {
                    ...state,
                    players: playersWithAssignedQuests,
                    assignedImpostorCount: impostorCount,
                };
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
            const minimumPlayersToLaunch = getMinimumPlayersToLaunch(
                state.impostorMode,
                state.manualImpostorCount
            );

            if (state.players.length < minimumPlayersToLaunch) {
                validationError = {
                    success: false,
                    error: `Cannot launch: requires at least ${minimumPlayersToLaunch} players.`,
                    code: ERROR_CODES.ERR_NO_PLAYERS,
                };
                return null;
            }

            const impostorCount =
                state.impostorMode === undefined
                    ? 1
                    : state.impostorMode === "manual"
                    ? getManualImpostorCount(state.manualImpostorCount)
                    : getAutoImpostorCount(state.players.length);

            if (state.impostorMode !== undefined && !hasCrewmateMajority(state.players.length, impostorCount)) {
                validationError = {
                    success: false,
                    error: "Cannot launch: crewmates must outnumber impostors.",
                    code: ERROR_CODES.ERR_INVALID_INPUT,
                };
                return null;
            }

            const playersWithAssignedRoles =
                state.impostorMode === undefined
                    ? state.players
                    : assignRolesRandomly(state.players, impostorCount);
            const playersWithAssignedQuests = optimizeCrewmateBatchQuests(
                state,
                playersWithAssignedRoles,
                assignmentBatch
            );
            if (!playersWithAssignedQuests) {
                validationError = {
                    success: false,
                    error: "Failed to assign quests from mission batch.",
                    code: ERROR_CODES.ERR_SIGNAL_LOST,
                };
                return null;
            }

            return {
                ...state,
                status: "IN_PROGRESS",
                players: playersWithAssignedQuests,
                assignedImpostorCount:
                    state.impostorMode === undefined ? state.assignedImpostorCount : impostorCount,
            };
        });

        // If updater returned null, check why
        if (validationError) {
            return validationError;
        }

        // If result is null (shouldn't happen with current logic), get current state
        if (!result) {
            const currentState = await readGameState(gameId);
            if (!currentState) {
                return {
                    success: false,
                    error: "Game session not found.",
                    code: ERROR_CODES.GAME_NOT_FOUND,
                };
            }
            return {
                success: true,
                data: currentState,
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
        const preloadedState = await readGameState(gameId);
        const organizerSession = await verifySession();
        const isAuthenticatedCaller =
            organizerSession.success &&
            !!organizerSession.data &&
            organizerSession.data.userId === userId;

        if (!preloadedState) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        // Story 11.3: Game Settings from Batch - preload batch once, then assign inside atomic update
        let assignmentBatch: { id: string; quests: Quest[] } | null = null;
        let reconnectCandidateUserId: string | null = null;
        if (preloadedState.batchId) {
            const batchResponse = await getBatchData(preloadedState.batchId);
            if (!batchResponse.success || !batchResponse.data) {
                return {
                    success: false,
                    error: "Failed to assign quests from mission batch.",
                    code: ERROR_CODES.ERR_SIGNAL_LOST
                };
            }
            assignmentBatch = {
                id: batchResponse.data.id,
                quests: batchResponse.data.quests,
            };
        }

        if (preloadedState.status !== "LOBBY") {
            const alreadyJoined = preloadedState.players.some((player) => player.id === userId);
            if (!alreadyJoined) {
                const reconnectCandidates = preloadedState.players.filter(
                    (player) =>
                        player.id !== userId &&
                        normalizePlayerAlias(player.name) === normalizePlayerAlias(sanitizedName)
                );

                if (reconnectCandidates.length === 0) {
                    return {
                        success: false,
                        error: "Cannot join: game is already in progress.",
                        code: ERROR_CODES.ERR_GAME_ALREADY_STARTED,
                    };
                }

                for (const reconnectCandidate of reconnectCandidates) {
                    const isProtectedAccount = await isPasswordAuthenticatedPlayer(
                        reconnectCandidate.id
                    );
                    if (isProtectedAccount) {
                        if (isAuthenticatedCaller && reconnectCandidate.id === userId) {
                            reconnectCandidateUserId = reconnectCandidate.id;
                            continue;
                        }
                        return {
                            success: false,
                            error: "Protected account alias requires login.",
                            code: ERROR_CODES.ERR_LOGIN_REQUIRED_FOR_AUTH_PLAYER,
                        };
                    }

                    const isReconnectCandidateConnected = await isPlayerCurrentlyConnected(
                        gameId,
                        reconnectCandidate.id
                    );
                    if (isReconnectCandidateConnected && !isAuthenticatedCaller) {
                        return {
                            success: false,
                            error: "Alias already in use by an active player.",
                            code: ERROR_CODES.ERR_PLAYER_ALREADY_CONNECTED,
                        };
                    }
                }

                reconnectCandidateUserId = reconnectCandidates[0].id;
            }
        }

        let validationError: ActionResponse<GameState> | null = null;
        let reassignedFromUserId: string | null = null;
        const updatedState = await mutateGameState(gameId, (state) => {
            reassignedFromUserId = null;
            if (!state) {
                validationError = {
                    success: false,
                    error: "Game session not found.",
                    code: ERROR_CODES.GAME_NOT_FOUND,
                };
                return null;
            }

            const normalizedState = normalizeGameState(state);

            const existingPlayer = normalizedState.players.find((p) => p.id === userId);
            if (existingPlayer) {
                return normalizedState;
            }

            if (normalizedState.status !== "LOBBY") {
                const reconnectCandidate = reconnectCandidateUserId
                    ? normalizedState.players.find((player) => player.id === reconnectCandidateUserId)
                    : normalizedState.players.find(
                          (player) =>
                              player.id !== userId &&
                              normalizePlayerAlias(player.name) === normalizePlayerAlias(sanitizedName)
                      );

                if (!reconnectCandidate) {
                    validationError = {
                        success: false,
                        error: "Cannot join: game is already in progress.",
                        code: ERROR_CODES.ERR_GAME_ALREADY_STARTED,
                    };
                    return null;
                }

                reassignedFromUserId = reconnectCandidate.id;
                return reassignPlayerIdentity(normalizedState, reconnectCandidate.id, userId);
            }

            if (normalizedState.players.length >= MAX_PLAYERS_PER_GAME) {
                validationError = {
                    success: false,
                    error: "Cockpit at maximum capacity.",
                    code: ERROR_CODES.ERR_FULL_CAPACITY,
                };
                return null;
            }

            if (normalizedState.batchId && !assignmentBatch) {
                validationError = {
                    success: false,
                    error: "Failed to assign quests from mission batch.",
                    code: ERROR_CODES.ERR_SIGNAL_LOST,
                };
                return null;
            }

            if (assignmentBatch && normalizedState.batchId) {
                if (normalizedState.batchId !== assignmentBatch.id) {
                    validationError = {
                        success: false,
                        error: "Failed to assign quests from mission batch.",
                        code: ERROR_CODES.ERR_SIGNAL_LOST,
                    };
                    return null;
                }
            }

            const newPlayer = {
                id: userId,
                name: sanitizedName,
                isAlive: true,
            };

            const candidateState: GameState = {
                ...normalizedState,
                players: [...normalizedState.players, newPlayer],
            };

            if (assignmentBatch && candidateState.batchId) {
                const playersWithAssignments = optimizeLobbyBatchQuests(
                    candidateState,
                    candidateState.players,
                    assignmentBatch
                );
                if (!playersWithAssignments) {
                    validationError = {
                        success: false,
                        error: "Failed to assign quests from mission batch.",
                        code: ERROR_CODES.ERR_SIGNAL_LOST,
                    };
                    return null;
                }

                return {
                    ...candidateState,
                    players: playersWithAssignments,
                };
            }

            return candidateState;
        });

        if (validationError) {
            return validationError;
        }

        if (!updatedState) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        if (reassignedFromUserId && reassignedFromUserId !== userId) {
            await migrateReassignedPlayerData(gameId, reassignedFromUserId, userId, updatedState.meeting);
        }

        // Secure the player's identity moving forward
        const sessionResult = await createPlayerSession(userId, gameId);
        if (!sessionResult.success) {
            console.error("Failed to establish secure session:", sessionResult.error);
        }
        await markPlayerPresenceConnected(gameId, userId);

        return {
            success: true,
            data: sanitizeGameStateForViewer(normalizeGameState(updatedState), {
                viewerUserId: userId,
                isOrganizer: false,
            }),
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
export async function refreshGame(
    gameId: string,
    userId?: string
): Promise<ActionResponse<GameState>> {
    try {
        const initialState = await readGameState(gameId);
        if (!initialState) {
            return {
                success: false,
                error: "Game module not found or decommissioned.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        const state = await recoverMissingCrewmateAssignments(gameId, initialState);
        const resolved = resolveRuntimeTransitions(state, Date.now());
        const viewerScope = await resolveViewerScopeForGame(gameId, resolved, userId);
        if (!viewerScope.success || !viewerScope.data) {
            return {
                success: false,
                error: viewerScope.error ?? "Access denied.",
                code: viewerScope.code ?? ERROR_CODES.ERR_INVALID_SIGNATURE,
            };
        }

        if (areGameStatesEquivalent(state, resolved)) {
            return {
                success: true,
                data: sanitizeGameStateForViewer(state, viewerScope.data),
            };
        }

        const persisted = await mutateGameState(gameId, (currentState) =>
            resolveRuntimeTransitions(currentState, Date.now())
        );

        return {
            success: true,
            data: sanitizeGameStateForViewer(persisted ?? resolved, viewerScope.data),
        };
    } catch (error) {
        if (isWatchConflictError(error)) {
            const latestState = await readGameState(gameId);
            if (latestState) {
                const viewerScope = await resolveViewerScopeForGame(gameId, latestState, userId);
                if (!viewerScope.success || !viewerScope.data) {
                    return {
                        success: false,
                        error: viewerScope.error ?? "Access denied.",
                        code: viewerScope.code ?? ERROR_CODES.ERR_INVALID_SIGNATURE,
                    };
                }

                return {
                    success: true,
                    data: sanitizeGameStateForViewer(latestState, viewerScope.data),
                };
            }
        }

        console.error("Failed to refresh game:", error);
        return {
            success: false,
            error: "Failed to refresh game data.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export async function getGameSnapshot(
    gameId: string,
    userId?: string
): Promise<ActionResponse<GameState>> {
    try {
        const initialState = await readGameState(gameId);
        if (!initialState) {
            return {
                success: false,
                error: "Game module not found or decommissioned.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        const state = await recoverMissingCrewmateAssignments(gameId, initialState);

        // Snapshot reads stay mostly non-mutating; we only auto-heal missing
        // crewmate quest assignments when required for consistency.
        const resolvedSnapshot = resolveRuntimeTransitions(state, Date.now());
        const syntheticUpdatedAt = state.updatedAt + 1;
        const snapshot = areGameStatesEquivalent(state, resolvedSnapshot)
            ? state
            : normalizeGameState({
                  ...resolvedSnapshot,
                  revision: state.revision + 1,
                  updatedAt: syntheticUpdatedAt,
              });

        const viewerScope = await resolveViewerScopeForGame(gameId, snapshot, userId);
        if (!viewerScope.success || !viewerScope.data) {
            return {
                success: false,
                error: viewerScope.error ?? "Access denied.",
                code: viewerScope.code ?? ERROR_CODES.ERR_INVALID_SIGNATURE,
            };
        }

        return {
            success: true,
            data: sanitizeGameStateForViewer(normalizeGameState(snapshot), viewerScope.data),
        };
    } catch (error) {
        console.error("Failed to fetch game snapshot:", error);
        return {
            success: false,
            error: "Failed to fetch game snapshot.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}
export async function eliminatePlayer(
    gameId: string,
    userId: string
): Promise<ActionResponse<{ isAlive: boolean }>> {
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

        let validationError: ActionResponse<{ isAlive: boolean }> | null = null;

        const result = await mutateGameState(gameId, (state) => {
            const now = Date.now();
            const workingState = resolveRuntimeTransitions(state, now);

            if (workingState.meeting?.status === "ACTIVE") {
                validationError = {
                    success: false,
                    error: "Cannot eliminate player during an active meeting.",
                    code: ERROR_CODES.ERR_MEETING_ACTIVE,
                };
                return null;
            }

            if (workingState.status !== "IN_PROGRESS") {
                validationError = {
                    success: false,
                    error: "Cannot eliminate player: game is not in progress.",
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

            // Idempotent: already eliminated - return success without changing state
            if (!player.isAlive) {
                validationError = {
                    success: true,
                    data: { isAlive: false },
                };
                return null;
            }

            const updatedPlayers = [...workingState.players];
            updatedPlayers[playerIndex] = {
                ...updatedPlayers[playerIndex],
                isAlive: false,
                postEliminationBuzzerGrantedAt: now,
            };

            // Check for victory after player elimination
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
        // game:v2:${gameId}:state
        // game:v2:${gameId}:player:${userId}:failed-quests
        const gameKeys = await redis.keys(getGameNamespacePattern(gameId));
        
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

