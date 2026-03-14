"use server";

import { redis, GAME_TTL_SECONDS } from "./client";
import {
    GameState,
    ActionResponse,
    PlayerRole,
    MeetingSnapshot,
    MeetingState,
    MeetingView,
    SabotageState,
    ReactorSabotageState,
} from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { getBatchData } from "./batch-actions";
import { getTotalQuestGamesCount } from "@/lib/constants/quest-pool";
import { generateShortCode } from "@/lib/utils/short-code.server";
import { Quest, BatchSabotages, SabotageType } from "@/types/quest";
import { assignQuestsFromLoadedBatch } from "@/lib/quests/quest-assignment";
import {
    getFailedQuestsKey,
    getGameNamespacePattern,
    getGameStateKey,
    getMeetingVoteKey,
} from "./game-state-keys";

import { verifySession, createPlayerSession, verifyPlayerSession } from "./auth-utils";
import { getGlobalQuestStats } from "@/lib/utils/quest-calculations";

const MEETING_DURATION_MS = 5 * 60 * 1000;
const REACTOR_SABOTAGE_DURATION_MS = 90 * 1000;
const SABOTAGE_COOLDOWN_MS = 120 * 1000;

function isWatchConflictError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }

    const candidate = error as { name?: unknown; message?: unknown };
    if (candidate.name === "WatchError") {
        return true;
    }

    if (typeof candidate.message !== "string") {
        return false;
    }

    const message = candidate.message.toLowerCase();
    return message.includes("watched keys") && message.includes("changed");
}

function normalizeLegacyPlayerRole(role: unknown): PlayerRole | undefined {
    if (role === "CREWMATE" || role === "IMPOSTOR") {
        return role;
    }

    // Legacy compatibility: older game states may still contain ADMIN.
    return undefined;
}

function normalizeGameState(state: GameState): GameState {
    return {
        ...state,
        players: Array.isArray(state.players)
            ? state.players.map((player) => ({
                  ...player,
                  role: normalizeLegacyPlayerRole((player as { role?: unknown }).role),
              }))
            : [],
        revision: typeof state.revision === "number" ? state.revision : 0,
        updatedAt: typeof state.updatedAt === "number" ? state.updatedAt : state.createdAt,
    };
}

function withGameStateRevision(currentState: GameState, nextState: GameState): GameState {
    if (areGameStatesEquivalent(currentState, nextState)) {
        return currentState;
    }

    return {
        ...nextState,
        revision: currentState.revision + 1,
        updatedAt: Date.now(),
    };
}

function areGameStatesEquivalent(left: GameState, right: GameState): boolean {
    const currentWithoutMeta = {
        ...left,
        revision: 0,
        updatedAt: 0,
    };
    const nextWithoutMeta = {
        ...right,
        revision: 0,
        updatedAt: 0,
    };

    return JSON.stringify(currentWithoutMeta) === JSON.stringify(nextWithoutMeta);
}

async function readGameState(gameId: string): Promise<GameState | null> {
    const state = await redis.get<GameState>(getGameStateKey(gameId));
    return state ? normalizeGameState(state) : null;
}

async function mutateGameState(
    gameId: string,
    updater: (state: GameState) => GameState | null
): Promise<GameState | null> {
    const stateKey = getGameStateKey(gameId);
    const result = await redis.atomicUpdate<GameState>(stateKey, (state) => {
        if (!state) {
            return null;
        }

        const normalizedState = normalizeGameState(state);
        const nextState = updater(normalizedState);
        if (!nextState) {
            return null;
        }

        const normalizedNext = normalizeGameState(nextState);
        return withGameStateRevision(normalizedState, normalizedNext);
    }, GAME_TTL_SECONDS);

    return result ? normalizeGameState(result) : null;
}

function getDefaultSabotageState(): SabotageState {
    return {
        active: null,
        reactor: null,
        cooldowns: {
            communicationsAvailableAt: 0,
            lightsAvailableAt: 0,
            reactorAvailableAt: 0,
        },
    };
}

function getNormalizedSabotageState(state: GameState): SabotageState {
    const current = state.sabotageState;
    if (!current) return getDefaultSabotageState();

    return {
        active: current.active ?? null,
        reactor: current.reactor ?? null,
        cooldowns: {
            communicationsAvailableAt: current.cooldowns?.communicationsAvailableAt ?? 0,
            lightsAvailableAt: current.cooldowns?.lightsAvailableAt ?? 0,
            reactorAvailableAt: current.cooldowns?.reactorAvailableAt ?? 0,
        },
    };
}

function getEligibleMeetingVoterIds(state: GameState): string[] {
    return state.players
        .filter((player) => player.isAlive && !!player.role)
        .map((player) => player.id);
}

function buildMeetingSnapshot(state: GameState, capturedAt: number): MeetingSnapshot {
    const progress = getGlobalQuestStats(state.players, state);

    return {
        capturedAt,
        progress,
        players: state.players.map((player) => ({
            id: player.id,
            name: player.name,
            role: player.role,
            isAlive: player.isAlive,
        })),
    };
}

function sumVoteCounts(voteCounts: Record<string, number>, eligibleVoterIds: string[]): number {
    return eligibleVoterIds.reduce((sum, playerId) => {
        const count = voteCounts[playerId] ?? 0;
        return sum + (count > 0 ? count : 0);
    }, 0);
}

function resolveMeetingState(
    state: GameState,
    reason: "ALL_VOTED" | "TIMEOUT",
    now: number
): GameState {
    const meeting = state.meeting;
    if (!meeting || meeting.status !== "ACTIVE") {
        return state;
    }

    const normalizedVoteCounts: Record<string, number> = {};
    meeting.eligibleVoterIds.forEach((playerId) => {
        normalizedVoteCounts[playerId] = Math.max(0, meeting.voteCounts[playerId] ?? 0);
    });

    const totalVotes = sumVoteCounts(normalizedVoteCounts, meeting.eligibleVoterIds);

    let eliminatedPlayerId: string | undefined;
    let eliminatedPlayerName: string | undefined;
    let updatedPlayers = state.players;

    if (totalVotes > 0) {
        const ranked = meeting.eligibleVoterIds
            .map((playerId) => ({ playerId, votes: normalizedVoteCounts[playerId] ?? 0 }))
            .sort((a, b) => b.votes - a.votes);

        const maxVotes = ranked[0]?.votes ?? 0;
        if (maxVotes > 0) {
            const topPlayers = ranked
                .filter((entry) => entry.votes === maxVotes)
                .map((entry) => entry.playerId)
                .sort((left, right) => left.localeCompare(right));
            eliminatedPlayerId = topPlayers[0];

            const targetPlayer = state.players.find((player) => player.id === eliminatedPlayerId);
            if (targetPlayer) {
                eliminatedPlayerName = targetPlayer.name;
                updatedPlayers = state.players.map((player) =>
                    player.id === eliminatedPlayerId ? { ...player, isAlive: false } : player
                );
            } else {
                eliminatedPlayerId = undefined;
            }
        }
    }

    const finalSnapshot = buildMeetingSnapshot(
        {
            ...state,
            players: updatedPlayers,
        },
        now
    );

    const completedMeeting: MeetingState = {
        ...meeting,
        status: "COMPLETED",
        snapshot: finalSnapshot,
        voteCounts: normalizedVoteCounts,
        totalVotes,
        eliminatedPlayerId,
        eliminatedPlayerName,
        endReason: reason,
        endedAt: now,
    };

    const updatedState: GameState = {
        ...state,
        players: updatedPlayers,
        meeting: completedMeeting,
    };

    if (eliminatedPlayerId) {
        const winCheck = checkWinConditions(updatedState);
        if (winCheck.finished) {
            return {
                ...updatedState,
                status: "FINISHED",
                winner: winCheck.winner,
            };
        }
    }

    return updatedState;
}

function resolveMeetingIfExpired(state: GameState, now: number): GameState {
    if (!state.meeting || state.meeting.status !== "ACTIVE") {
        return state;
    }
    if (now < state.meeting.endsAt) {
        return state;
    }
    return resolveMeetingState(state, "TIMEOUT", now);
}

function resolveSabotageIfExpired(state: GameState, now: number): GameState {
    if (state.status !== "IN_PROGRESS") {
        return state;
    }

    const sabotageState = getNormalizedSabotageState(state);
    if (sabotageState.active !== "REACTOR" || !sabotageState.reactor) {
        return state;
    }

    if (now < sabotageState.reactor.endsAt) {
        return state;
    }

    return {
        ...state,
        status: "FINISHED",
        winner: "IMPOSTOR",
        sabotageState: {
            ...sabotageState,
            active: null,
            reactor: null,
        },
    };
}

function resolveRuntimeTransitions(state: GameState, now: number): GameState {
    let resolved = resolveMeetingIfExpired(state, now);
    resolved = resolveSabotageIfExpired(resolved, now);
    return resolved;
}

async function buildMeetingViewData(gameId: string, userId: string, state: GameState): Promise<MeetingView> {
    const meeting = state.meeting ?? null;
    if (!meeting || meeting.status !== "ACTIVE" || !meeting.eligibleVoterIds.includes(userId)) {
        return {
            meeting,
            myVoteTargetId: null,
        };
    }

    const voteKey = getMeetingVoteKey(gameId, meeting.id, userId);
    const myVoteTargetId = await redis.get<string>(voteKey);
    const isValidTarget = myVoteTargetId ? meeting.eligibleVoterIds.includes(myVoteTargetId) : false;

    return {
        meeting,
        myVoteTargetId: isValidTarget ? myVoteTargetId : null,
    };
}

interface ViewerScope {
    viewerUserId?: string;
    isOrganizer: boolean;
}

interface PlayerSessionResolution {
    isPlayerSessionValid: boolean;
    recoveredSession: boolean;
    recoveryAttempted: boolean;
    error?: string;
    code?: string;
}

interface ActionAccessScope {
    gameState: GameState;
    viewerUserId: string;
    isOrganizer: boolean;
    isPlayerSessionValid: boolean;
    recoveredSession: boolean;
}

function canViewerSeeRole(
    targetRole: PlayerRole | undefined,
    targetPlayerId: string,
    viewerUserId: string | undefined,
    viewerRole: PlayerRole | undefined,
    isOrganizer: boolean,
    revealAllRoles: boolean
): boolean {
    if (!targetRole) return false;
    if (isOrganizer) return true;
    if (!viewerUserId) return false;
    if (revealAllRoles) return true;
    if (targetPlayerId === viewerUserId) return true;
    if (viewerRole === "IMPOSTOR" && targetRole === "IMPOSTOR") {
        return true;
    }
    return false;
}

function sanitizeMeetingSnapshotForViewer(
    snapshot: MeetingSnapshot,
    viewerUserId: string | undefined,
    viewerRole: PlayerRole | undefined,
    isOrganizer: boolean,
    revealAllRoles: boolean
): MeetingSnapshot {
    return {
        ...snapshot,
        players: snapshot.players.map((player) => {
            const canSeeRole = canViewerSeeRole(
                player.role,
                player.id,
                viewerUserId,
                viewerRole,
                isOrganizer,
                revealAllRoles
            );

            return {
                id: player.id,
                name: player.name,
                isAlive: player.isAlive,
                role: canSeeRole ? player.role : undefined,
            };
        }),
    };
}

function sanitizeMeetingStateForViewer(
    meeting: MeetingState,
    viewerUserId: string | undefined,
    viewerRole: PlayerRole | undefined,
    isOrganizer: boolean,
    revealAllRoles: boolean
): MeetingState {
    return {
        ...meeting,
        snapshot: sanitizeMeetingSnapshotForViewer(
            meeting.snapshot,
            viewerUserId,
            viewerRole,
            isOrganizer,
            revealAllRoles
        ),
    };
}

function sanitizeMeetingViewForViewer(
    meetingView: MeetingView,
    state: GameState,
    scope: ViewerScope
): MeetingView {
    const meeting = meetingView.meeting;
    if (!meeting || scope.isOrganizer) {
        return meetingView;
    }

    const viewerRole = scope.viewerUserId
        ? state.players.find((player) => player.id === scope.viewerUserId)?.role
        : undefined;
    const revealAllRoles = Boolean(scope.viewerUserId) && state.status === "FINISHED";

    return {
        ...meetingView,
        meeting: sanitizeMeetingStateForViewer(
            meeting,
            scope.viewerUserId,
            viewerRole,
            scope.isOrganizer,
            revealAllRoles
        ),
    };
}

function sanitizeGameStateForViewer(state: GameState, scope: ViewerScope): GameState {
    if (scope.isOrganizer) {
        return state;
    }

    const viewerRole = scope.viewerUserId
        ? state.players.find((player) => player.id === scope.viewerUserId)?.role
        : undefined;
    const revealAllRoles = Boolean(scope.viewerUserId) && state.status === "FINISHED";

    return {
        ...state,
        players: state.players.map((player) => {
            const isSelf = scope.viewerUserId === player.id;
            const canSeeRole = canViewerSeeRole(
                player.role,
                player.id,
                scope.viewerUserId,
                viewerRole,
                scope.isOrganizer,
                revealAllRoles
            );

            const sanitizedPlayer = {
                id: player.id,
                name: player.name,
                isAlive: player.isAlive,
                role: canSeeRole ? player.role : undefined,
            };

            if (isSelf) {
                return {
                    ...sanitizedPlayer,
                    completedQuests: player.completedQuests ? [...player.completedQuests] : undefined,
                    lastQuestCompleted: player.lastQuestCompleted,
                    assignedQuests: player.assignedQuests ? [...player.assignedQuests] : undefined,
                    meetingBuzzUsedAt: player.meetingBuzzUsedAt,
                };
            }

            return sanitizedPlayer;
        }),
        meeting: state.meeting
            ? sanitizeMeetingStateForViewer(
                  state.meeting,
                  scope.viewerUserId,
                  viewerRole,
                  scope.isOrganizer,
                  revealAllRoles
              )
            : state.meeting,
    };
}

async function verifyAndRecoverPlayerSession(
    gameId: string,
    userId: string,
    playerExists: boolean
): Promise<PlayerSessionResolution> {
    // Auto-heal missing player cookie once when the user is already known in this game.
    if (!playerExists) {
        return {
            isPlayerSessionValid: false,
            recoveredSession: false,
            recoveryAttempted: false,
            error: "Player not found in game.",
            code: ERROR_CODES.ERR_INVALID_SIGNATURE,
        };
    }

    const initialCheck = await verifyPlayerSession(userId, gameId);
    if (initialCheck.success) {
        return {
            isPlayerSessionValid: true,
            recoveredSession: false,
            recoveryAttempted: false,
        };
    }

    if (initialCheck.code !== ERROR_CODES.ERR_NO_SESSION) {
        return {
            isPlayerSessionValid: false,
            recoveredSession: false,
            recoveryAttempted: false,
            error: initialCheck.error || "Session verification failed",
            code: initialCheck.code || ERROR_CODES.ERR_INVALID_SESSION,
        };
    }

    const sessionResult = await createPlayerSession(userId, gameId);
    if (!sessionResult.success) {
        return {
            isPlayerSessionValid: false,
            recoveredSession: false,
            recoveryAttempted: true,
            error: sessionResult.error || "Session verification failed",
            code: sessionResult.code || ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }

    const recoveredCheck = await verifyPlayerSession(userId, gameId);
    if (!recoveredCheck.success) {
        return {
            isPlayerSessionValid: false,
            recoveredSession: false,
            recoveryAttempted: true,
            error: recoveredCheck.error || "Session verification failed",
            code: recoveredCheck.code || ERROR_CODES.ERR_INVALID_SESSION,
        };
    }

    console.warn(`[session] recovered player-session game=${gameId} user=${userId}`);
    return {
        isPlayerSessionValid: true,
        recoveredSession: true,
        recoveryAttempted: true,
    };
}

async function resolveActionAccess(
    gameId: string,
    userId: string
): Promise<ActionResponse<ActionAccessScope>> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
        return {
            success: false,
            error: "Player not found in game.",
            code: ERROR_CODES.ERR_INVALID_SIGNATURE,
        };
    }

    const state = await readGameState(gameId);
    if (!state) {
        return {
            success: false,
            error: "Game session not found.",
            code: ERROR_CODES.GAME_NOT_FOUND,
        };
    }

    const playerExists = state.players.some((player) => player.id === normalizedUserId);
    const organizerSession = await verifySession();
    const playerSession = await verifyAndRecoverPlayerSession(gameId, normalizedUserId, playerExists);

    if (!playerSession.isPlayerSessionValid) {
        return {
            success: false,
            error: playerSession.error || "Session verification failed",
            code: playerSession.code || ERROR_CODES.ERR_INVALID_SESSION,
        };
    }

    return {
        success: true,
        data: {
            gameState: state,
            viewerUserId: normalizedUserId,
            isOrganizer: organizerSession.success,
            isPlayerSessionValid: true,
            recoveredSession: playerSession.recoveredSession,
        },
    };
}

async function resolveViewerScopeForGame(
    gameId: string,
    state: GameState,
    userId?: string
): Promise<ActionResponse<ViewerScope>> {
    const normalizedUserId = userId?.trim();
    const organizerSession = await verifySession();
    if (normalizedUserId) {
        const playerExists = state.players.some((player) => player.id === normalizedUserId);
        const playerSession = await verifyAndRecoverPlayerSession(gameId, normalizedUserId, playerExists);
        const hasValidPlayerSession = playerSession.isPlayerSessionValid;

        if (playerExists && hasValidPlayerSession) {
            // Player context always gets player-level role visibility, even for organizer accounts.
            return {
                success: true,
                data: {
                    viewerUserId: normalizedUserId,
                    isOrganizer: false,
                },
            };
        }

        if (state.status === "LOBBY") {
            return {
                success: true,
                data: { isOrganizer: false },
            };
        }

        if (playerSession.recoveryAttempted) {
            return {
                success: false,
                error: playerSession.error || "Player session verification failed.",
                code: playerSession.code || ERROR_CODES.ERR_SIGNAL_LOST,
            };
        }

        return {
            success: false,
            error: "Player session verification failed.",
            code: ERROR_CODES.ERR_INVALID_SIGNATURE,
        };
    }

    if (organizerSession.success) {
        return {
            success: true,
            data: {
                isOrganizer: true,
            },
        };
    }

    if (state.status === "LOBBY") {
        return {
            success: true,
            data: { isOrganizer: false },
        };
    }

    return {
        success: false,
        error: "Player session verification failed.",
        code: ERROR_CODES.ERR_INVALID_SIGNATURE,
    };
}

/**
 * Utility to check if any win conditions are met
 */
function checkWinConditions(state: GameState): { finished: boolean; winner?: PlayerRole } {
    const players = state.players;
    
    // 1. Check Crewmate Victory: All assigned quests completed
    const stats = getGlobalQuestStats(players, state);
    if (stats.total > 0 && stats.completed >= stats.total) {
        return { finished: true, winner: "CREWMATE" };
    }

    // 2. Check Impostor Victory: All Crewmates eliminated
    const aliveCrewmates = players.filter(p => p.role === "CREWMATE" && p.isAlive);
    const totalCrewmates = players.filter(p => p.role === "CREWMATE");
    
    // Only trigger if there were actually crewmates and they are all dead
    if (totalCrewmates.length > 0 && aliveCrewmates.length === 0) {
        return { finished: true, winner: "IMPOSTOR" };
    }

    return { finished: false };
}

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

        let questsTotal = getTotalQuestGamesCount(); // Default total from pool
        let batchSabotages: BatchSabotages | undefined;
        if (batchId) {
            const batchResponse = await getBatchData(batchId);
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
            sabotages: batchSabotages,
            sabotageState: getDefaultSabotageState(),
        };

        // Store game state in Redis with 24h TTL using short code key pattern
        await redis.set(getGameStateKey(shortCode), initialState, GAME_TTL_SECONDS);

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

        const viewerScope = await resolveViewerScopeForGame(id, state, userId);
        if (!viewerScope.success || !viewerScope.data) {
            return {
                success: false,
                error: viewerScope.error ?? "Access denied.",
                code: viewerScope.code ?? ERROR_CODES.ERR_INVALID_SIGNATURE,
            };
        }

        return {
            success: true,
            data: sanitizeGameStateForViewer(state, viewerScope.data),
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

        if (!preloadedState) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        // Story 11.3: Game Settings from Batch - preload batch once, then assign inside atomic update
        let assignmentBatch: { id: string; quests: Quest[] } | null = null;
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

        let validationError: ActionResponse<GameState> | null = null;
        const updatedState = await mutateGameState(gameId, (state) => {
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

            if (normalizedState.players.length >= 10) {
                validationError = {
                    success: false,
                    error: "Cockpit at maximum capacity.",
                    code: ERROR_CODES.ERR_FULL_CAPACITY,
                };
                return null;
            }

            let assignedQuestIds: string[] | undefined = undefined;
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
                try {
                    const assignedQuests = assignQuestsFromLoadedBatch(normalizedState, assignmentBatch);
                    if (assignedQuests.length === 0) {
                        validationError = {
                            success: false,
                            error: "Failed to assign quests from mission batch.",
                            code: ERROR_CODES.ERR_SIGNAL_LOST,
                        };
                        return null;
                    }
                    assignedQuestIds = assignedQuests.map((assignment) => assignment.questId);
                } catch (error) {
                    console.error("Quest assignment failed during joinGame mutation:", error);
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
                assignedQuests: assignedQuestIds,
            };

            const candidateState: GameState = {
                ...normalizedState,
                players: [...normalizedState.players, newPlayer],
            };

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

        // Secure the player's identity moving forward
        const sessionResult = await createPlayerSession(userId, gameId);
        if (!sessionResult.success) {
            console.error("Failed to establish secure session:", sessionResult.error);
        }

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

export async function refreshGame(
    gameId: string,
    userId?: string
): Promise<ActionResponse<GameState>> {
    try {
        const state = await readGameState(gameId);
        if (!state) {
            return {
                success: false,
                error: "Game module not found or decommissioned.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

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
        const state = await readGameState(gameId);
        if (!state) {
            return {
                success: false,
                error: "Game module not found or decommissioned.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        // Snapshot reads are intentionally non-mutating to avoid write contention
        // under multi-client SSE polling.
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

export interface TriggerSabotageResult {
    event?: "COMMUNICATIONS_ACTIVATED" | "LIGHTS_ACTIVATED" | "REACTOR_ACTIVATED";
    reactorProgress?: {
        scanned: number;
        total: number;
        remainingMs: number;
    };
    gameState?: GameState;
}

export async function triggerSabotage(
    gameId: string,
    userId: string,
    type: SabotageType
): Promise<ActionResponse<TriggerSabotageResult>> {
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

        let validationError: ActionResponse<TriggerSabotageResult> | null = null;
        const now = Date.now();

        const updatedState = await mutateGameState(gameId, (state) => {
            const workingState = resolveRuntimeTransitions(state, now);

            if (workingState.status !== "IN_PROGRESS") {
                validationError = {
                    success: false,
                    error: "Cannot trigger sabotage: game is not in progress.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                };
                return null;
            }

            const player = workingState.players.find((entry) => entry.id === userId);
            if (!player) {
                validationError = {
                    success: false,
                    error: "Player not found in game.",
                    code: ERROR_CODES.ERR_INVALID_SIGNATURE,
                };
                return null;
            }

            if (!player.isAlive || player.role !== "IMPOSTOR") {
                validationError = {
                    success: false,
                    error: "Only alive impostors can trigger sabotage.",
                    code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                };
                return null;
            }

            const sabotageState = getNormalizedSabotageState(workingState);
            if (sabotageState.active) {
                validationError = {
                    success: false,
                    error: "A sabotage is already active.",
                    code: ERROR_CODES.ERR_SABOTAGE_ALREADY_ACTIVE,
                };
                return null;
            }

            const sabotageConfig = workingState.sabotages;
            const hasLightsQr = Boolean(
                (workingState.sabotages as (Partial<BatchSabotages> & { lights?: { qrId: string } }) | undefined)
                    ?.lights?.qrId
            );
            if (!sabotageConfig || (type === "LIGHTS" && !hasLightsQr)) {
                validationError = {
                    success: false,
                    error: "This sabotage is not configured for this game.",
                    code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                };
                return null;
            }

            const cooldownMap = {
                COMMUNICATIONS: sabotageState.cooldowns.communicationsAvailableAt,
                LIGHTS: sabotageState.cooldowns.lightsAvailableAt,
                REACTOR: sabotageState.cooldowns.reactorAvailableAt,
            } as const;
            if (now < cooldownMap[type]) {
                validationError = {
                    success: false,
                    error: "Sabotage is on cooldown.",
                    code: ERROR_CODES.ERR_SABOTAGE_COOLDOWN,
                };
                return null;
            }

            const updatedState: GameState =
                type === "REACTOR"
                    ? {
                          ...workingState,
                          sabotageState: {
                              ...sabotageState,
                              active: "REACTOR",
                              reactor: {
                                  startedAt: now,
                                  endsAt: now + REACTOR_SABOTAGE_DURATION_MS,
                                  scannedByQrId: [],
                                  scannedUserIds: [],
                              },
                          },
                      }
                    : {
                          ...workingState,
                          sabotageState: {
                              ...sabotageState,
                              active: type,
                              reactor: null,
                          },
                      };

            return updatedState;
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

        const sanitizedState = sanitizeGameStateForViewer(updatedState, {
            viewerUserId: userId,
            isOrganizer: false,
        });

        return {
            success: true,
            data: {
                event:
                    type === "COMMUNICATIONS"
                        ? "COMMUNICATIONS_ACTIVATED"
                        : type === "LIGHTS"
                        ? "LIGHTS_ACTIVATED"
                        : "REACTOR_ACTIVATED",
                reactorProgress:
                    type === "REACTOR"
                        ? {
                              scanned: 0,
                              total: 2,
                              remainingMs: REACTOR_SABOTAGE_DURATION_MS,
                          }
                        : undefined,
                gameState: sanitizedState,
            },
        };
    } catch (error) {
        console.error("Failed to trigger sabotage:", error);
        return {
            success: false,
            error: "Failed to trigger sabotage.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export interface ScanSabotageResult {
    handled: boolean;
    event?:
        | "COMMUNICATIONS_REPAIRED"
        | "LIGHTS_REPAIRED"
        | "REACTOR_PROGRESS"
        | "REACTOR_REPAIRED"
        | "REACTOR_ALREADY_SCANNED"
        | "REACTOR_DISTINCT_CREWMATE_REQUIRED";
    reactorProgress?: {
        scanned: number;
        total: number;
        remainingMs: number;
    };
    gameState?: GameState;
}

export async function scanSabotage(
    gameId: string,
    userId: string,
    qrId: string
): Promise<ActionResponse<ScanSabotageResult>> {
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

        let validationError: ActionResponse<ScanSabotageResult> | null = null;
        let scanResult: ScanSabotageResult | null = null;
        const now = Date.now();

        const result = await mutateGameState(gameId, (state) => {
            const workingState = resolveRuntimeTransitions(state, now);

            const sabotages = workingState.sabotages;
            const isCommsQr = sabotages?.communications.qrId === qrId;
            const isLightsQr = (
                workingState.sabotages as (Partial<BatchSabotages> & { lights?: { qrId: string } }) | undefined
            )?.lights?.qrId === qrId;
            const reactorIndex = sabotages?.reactor.findIndex((entry) => entry.qrId === qrId) ?? -1;
            const isReactorQr = reactorIndex >= 0;
            const isSabotageQr = isCommsQr || isLightsQr || isReactorQr;

            if (!isSabotageQr) {
                validationError = {
                    success: true,
                    data: { handled: false },
                };
                return null;
            }

            if (workingState.status !== "IN_PROGRESS") {
                validationError = {
                    success: false,
                    error: "Cannot scan sabotage: game is not in progress.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                    data: { handled: true },
                };
                return null;
            }

            const player = workingState.players.find((entry) => entry.id === userId);
            if (!player) {
                validationError = {
                    success: false,
                    error: "Player not found in game.",
                    code: ERROR_CODES.ERR_INVALID_SIGNATURE,
                    data: { handled: true },
                };
                return null;
            }

            if (!player.isAlive || !player.role) {
                validationError = {
                    success: false,
                    error: "You are not allowed to use sabotage systems.",
                    code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                    data: { handled: true },
                };
                return null;
            }

            const sabotageState = getNormalizedSabotageState(workingState);

            if (isCommsQr || isLightsQr) {
                if (player.role !== "CREWMATE") {
                    validationError = {
                        success: false,
                        error: "Only crewmates can repair this sabotage.",
                        code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                        data: { handled: true },
                    };
                    return null;
                }

                const type: SabotageType = isCommsQr ? "COMMUNICATIONS" : "LIGHTS";
                if (sabotageState.active !== type) {
                    validationError = {
                        success: false,
                        error: `${type} sabotage is not active.`,
                        code: ERROR_CODES.ERR_SABOTAGE_NOT_ACTIVE,
                        data: { handled: true },
                    };
                    return null;
                }

                const updatedState: GameState = {
                    ...workingState,
                    sabotageState: {
                        ...sabotageState,
                        active: null,
                        cooldowns: {
                            ...sabotageState.cooldowns,
                            communicationsAvailableAt: isCommsQr
                                ? now + SABOTAGE_COOLDOWN_MS
                                : sabotageState.cooldowns.communicationsAvailableAt,
                            lightsAvailableAt: isLightsQr
                                ? now + SABOTAGE_COOLDOWN_MS
                                : sabotageState.cooldowns.lightsAvailableAt,
                        },
                    },
                };

                scanResult = {
                    handled: true,
                    event: isCommsQr ? "COMMUNICATIONS_REPAIRED" : "LIGHTS_REPAIRED",
                    gameState: updatedState,
                };
                return updatedState;
            }

            if (isReactorQr) {
                if (player.role !== "CREWMATE") {
                    validationError = {
                        success: false,
                        error: "Only crewmates can repair reactor sabotage.",
                        code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                        data: { handled: true },
                    };
                    return null;
                }

                if (sabotageState.active !== "REACTOR" || !sabotageState.reactor) {
                    validationError = {
                        success: false,
                        error: "Reactor sabotage is not active.",
                        code: ERROR_CODES.ERR_SABOTAGE_NOT_ACTIVE,
                        data: { handled: true },
                    };
                    return null;
                }

                const currentReactor = sabotageState.reactor as ReactorSabotageState;
                if (currentReactor.scannedByQrId.includes(qrId)) {
                    scanResult = {
                        handled: true,
                        event: "REACTOR_ALREADY_SCANNED",
                        reactorProgress: {
                            scanned: currentReactor.scannedByQrId.length,
                            total: 2,
                            remainingMs: Math.max(0, currentReactor.endsAt - now),
                        },
                        gameState: workingState,
                    };
                    return workingState;
                }

                if (currentReactor.scannedUserIds.includes(userId)) {
                    scanResult = {
                        handled: true,
                        event: "REACTOR_DISTINCT_CREWMATE_REQUIRED",
                        reactorProgress: {
                            scanned: currentReactor.scannedByQrId.length,
                            total: 2,
                            remainingMs: Math.max(0, currentReactor.endsAt - now),
                        },
                        gameState: workingState,
                    };
                    return workingState;
                }

                const scannedByQrId = [...currentReactor.scannedByQrId, qrId];
                const scannedUserIds = [...currentReactor.scannedUserIds, userId];
                const repaired = scannedByQrId.length >= 2;

                const updatedState: GameState = {
                    ...workingState,
                    sabotageState: {
                        ...sabotageState,
                        active: repaired ? null : "REACTOR",
                        reactor: repaired
                            ? null
                            : {
                                  ...currentReactor,
                                  scannedByQrId,
                                  scannedUserIds,
                              },
                        cooldowns: {
                            ...sabotageState.cooldowns,
                            reactorAvailableAt: repaired
                                ? now + SABOTAGE_COOLDOWN_MS
                                : sabotageState.cooldowns.reactorAvailableAt,
                        },
                    },
                };

                scanResult = {
                    handled: true,
                    event: repaired ? "REACTOR_REPAIRED" : "REACTOR_PROGRESS",
                    reactorProgress: {
                        scanned: scannedByQrId.length,
                        total: 2,
                        remainingMs: repaired ? 0 : Math.max(0, currentReactor.endsAt - now),
                    },
                    gameState: updatedState,
                };
                return updatedState;
            }

            validationError = {
                success: true,
                data: { handled: false },
            };
            return null;
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

        const fallbackState = sanitizeGameStateForViewer(result, {
            viewerUserId: userId,
            isOrganizer: false,
        });

        const resolvedScanResult = scanResult as ScanSabotageResult | null;

        let sanitizedScanState: GameState | undefined;
        if (resolvedScanResult && resolvedScanResult.gameState) {
            sanitizedScanState = sanitizeGameStateForViewer(resolvedScanResult.gameState, {
                viewerUserId: userId,
                isOrganizer: false,
            });
        }

        if (!resolvedScanResult) {
            return {
                success: true,
                data: { handled: false, gameState: fallbackState },
            };
        }

        return {
            success: true,
            data: {
                handled: resolvedScanResult.handled,
                event: resolvedScanResult.event,
                reactorProgress: resolvedScanResult.reactorProgress,
                gameState: sanitizedScanState,
            },
        };
    } catch (error) {
        console.error("Failed to scan sabotage:", error);
        return {
            success: false,
            error: "Failed to process sabotage scan.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export async function getMeetingView(
    gameId: string,
    userId: string
): Promise<ActionResponse<MeetingView>> {
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

        const state = await mutateGameState(gameId, (currentState) => {
            const now = Date.now();
            return resolveRuntimeTransitions(currentState, now);
        });

        if (!state) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        const data = await buildMeetingViewData(gameId, userId, state);
        return {
            success: true,
            data: sanitizeMeetingViewForViewer(data, state, {
                viewerUserId: userId,
                isOrganizer: false,
            }),
        };
    } catch (error) {
        console.error("Failed to fetch meeting view:", error);
        return {
            success: false,
            error: "Failed to fetch meeting state.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export async function triggerMeeting(
    gameId: string,
    userId: string
): Promise<ActionResponse<MeetingView>> {
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

        let validationError: ActionResponse<MeetingView> | null = null;
        const now = Date.now();

        const result = await mutateGameState(gameId, (state) => {
            const workingState = resolveRuntimeTransitions(state, now);

            if (workingState.status !== "IN_PROGRESS") {
                validationError = {
                    success: false,
                    error: "Cannot trigger meeting: game is not in progress.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                };
                return null;
            }

            if (workingState.meeting?.status === "ACTIVE") {
                validationError = {
                    success: false,
                    error: "A meeting is already active.",
                    code: ERROR_CODES.ERR_MEETING_ACTIVE,
                };
                return null;
            }

            const playerIndex = workingState.players.findIndex((player) => player.id === userId);
            if (playerIndex === -1) {
                validationError = {
                    success: false,
                    error: "Player not found in game.",
                    code: ERROR_CODES.ERR_INVALID_SIGNATURE,
                };
                return null;
            }

            const player = workingState.players[playerIndex];
            const isEligible = player.isAlive && !!player.role;
            if (!isEligible) {
                validationError = {
                    success: false,
                    error: "You are not allowed to trigger meetings.",
                    code: ERROR_CODES.ERR_MEETING_FORBIDDEN,
                };
                return null;
            }

            if (player.role === "CREWMATE" && workingState.sabotageState?.active === "COMMUNICATIONS") {
                validationError = {
                    success: false,
                    error: "Communications sabotage is active. Crewmates cannot trigger meetings.",
                    code: ERROR_CODES.ERR_SABOTAGE_COMMUNICATIONS_ACTIVE,
                };
                return null;
            }

            if (player.meetingBuzzUsedAt) {
                validationError = {
                    success: false,
                    error: "You already used your buzzer in this game.",
                    code: ERROR_CODES.ERR_MEETING_ALREADY_USED,
                };
                return null;
            }

            const eligibleVoterIds = getEligibleMeetingVoterIds(workingState);
            if (eligibleVoterIds.length < 2) {
                validationError = {
                    success: false,
                    error: "Not enough eligible players to start a meeting.",
                    code: ERROR_CODES.ERR_MEETING_FORBIDDEN,
                };
                return null;
            }

            const voteCounts: Record<string, number> = {};
            eligibleVoterIds.forEach((playerId) => {
                voteCounts[playerId] = 0;
            });

            const meetingId = `${now}-${Math.floor(Math.random() * 1_000_000)}`;
            const meeting: MeetingState = {
                id: meetingId,
                status: "ACTIVE",
                startedAt: now,
                endsAt: now + MEETING_DURATION_MS,
                startedBy: userId,
                snapshot: buildMeetingSnapshot(workingState, now),
                eligibleVoterIds,
                voteCounts,
                totalEligibleVoters: eligibleVoterIds.length,
                totalVotes: 0,
            };

            const updatedPlayers = [...workingState.players];
            updatedPlayers[playerIndex] = {
                ...updatedPlayers[playerIndex],
                meetingBuzzUsedAt: now,
            };

            return {
                ...workingState,
                players: updatedPlayers,
                meeting,
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

        const data = await buildMeetingViewData(gameId, userId, result);
        return {
            success: true,
            data: sanitizeMeetingViewForViewer(data, result, {
                viewerUserId: userId,
                isOrganizer: false,
            }),
        };
    } catch (error) {
        console.error("Failed to trigger meeting:", error);
        return {
            success: false,
            error: "Failed to trigger meeting.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export async function castMeetingVote(
    gameId: string,
    userId: string,
    targetId: string
): Promise<ActionResponse<MeetingView>> {
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

        const preloadedState = await readGameState(gameId);
        if (!preloadedState) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        const activeMeetingId = preloadedState.meeting?.status === "ACTIVE" ? preloadedState.meeting.id : null;
        if (!activeMeetingId) {
            return {
                success: false,
                error: "No active meeting.",
                code: ERROR_CODES.ERR_MEETING_NOT_ACTIVE,
            };
        }

        const voteKey = getMeetingVoteKey(gameId, activeMeetingId, userId);
        const previousVote = await redis.get<string>(voteKey);

        let validationError: ActionResponse<MeetingView> | null = null;

        const result = await mutateGameState(gameId, (state) => {
            const now = Date.now();
            const workingState = resolveRuntimeTransitions(state, now);
            const meeting = workingState.meeting;

            if (!meeting || meeting.status !== "ACTIVE") {
                validationError = {
                    success: false,
                    error: "No active meeting.",
                    code: ERROR_CODES.ERR_MEETING_NOT_ACTIVE,
                };
                return null;
            }

            if (meeting.id !== activeMeetingId) {
                validationError = {
                    success: false,
                    error: "Meeting changed. Please retry your vote.",
                    code: ERROR_CODES.ERR_MEETING_NOT_ACTIVE,
                };
                return null;
            }

            if (!meeting.eligibleVoterIds.includes(userId)) {
                validationError = {
                    success: false,
                    error: "You are not eligible to vote.",
                    code: ERROR_CODES.ERR_MEETING_FORBIDDEN,
                };
                return null;
            }

            if (!meeting.eligibleVoterIds.includes(targetId)) {
                validationError = {
                    success: false,
                    error: "Invalid vote target.",
                    code: ERROR_CODES.ERR_MEETING_VOTE_INVALID,
                };
                return null;
            }

            if (targetId === userId) {
                validationError = {
                    success: false,
                    error: "Self-vote is not allowed.",
                    code: ERROR_CODES.ERR_MEETING_VOTE_INVALID,
                };
                return null;
            }

            const voteCounts: Record<string, number> = { ...meeting.voteCounts };
            let totalVotes = meeting.totalVotes;
            const hasPreviousVote = !!previousVote && meeting.eligibleVoterIds.includes(previousVote);

            if (hasPreviousVote && previousVote === targetId) {
                return workingState;
            }

            if (hasPreviousVote && previousVote) {
                voteCounts[previousVote] = Math.max(0, (voteCounts[previousVote] ?? 0) - 1);
                totalVotes = Math.max(0, totalVotes - 1);
            }

            voteCounts[targetId] = (voteCounts[targetId] ?? 0) + 1;
            totalVotes += 1;

            const updatedMeeting: MeetingState = {
                ...meeting,
                voteCounts,
                totalVotes,
            };

            const updatedState: GameState = {
                ...workingState,
                meeting: updatedMeeting,
            };

            if (totalVotes >= updatedMeeting.totalEligibleVoters) {
                return resolveMeetingState(updatedState, "ALL_VOTED", now);
            }

            return updatedState;
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

        await redis.set(voteKey, targetId, GAME_TTL_SECONDS);
        const data = await buildMeetingViewData(gameId, userId, result);
        return {
            success: true,
            data: sanitizeMeetingViewForViewer(data, result, {
                viewerUserId: userId,
                isOrganizer: false,
            }),
        };
    } catch (error) {
        console.error("Failed to cast meeting vote:", error);
        return {
            success: false,
            error: "Failed to cast vote.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export async function cancelMeetingVote(
    gameId: string,
    userId: string
): Promise<ActionResponse<MeetingView>> {
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

        const preloadedState = await readGameState(gameId);
        if (!preloadedState) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        const activeMeetingId = preloadedState.meeting?.status === "ACTIVE" ? preloadedState.meeting.id : null;
        if (!activeMeetingId) {
            return {
                success: false,
                error: "No active meeting.",
                code: ERROR_CODES.ERR_MEETING_NOT_ACTIVE,
            };
        }

        const voteKey = getMeetingVoteKey(gameId, activeMeetingId, userId);
        const previousVote = await redis.get<string>(voteKey);

        let validationError: ActionResponse<MeetingView> | null = null;

        const result = await mutateGameState(gameId, (state) => {
            const now = Date.now();
            const workingState = resolveRuntimeTransitions(state, now);
            const meeting = workingState.meeting;

            if (!meeting || meeting.status !== "ACTIVE") {
                validationError = {
                    success: false,
                    error: "No active meeting.",
                    code: ERROR_CODES.ERR_MEETING_NOT_ACTIVE,
                };
                return null;
            }

            if (meeting.id !== activeMeetingId) {
                validationError = {
                    success: false,
                    error: "Meeting changed. Please retry.",
                    code: ERROR_CODES.ERR_MEETING_NOT_ACTIVE,
                };
                return null;
            }

            if (!meeting.eligibleVoterIds.includes(userId)) {
                validationError = {
                    success: false,
                    error: "You are not eligible to vote.",
                    code: ERROR_CODES.ERR_MEETING_FORBIDDEN,
                };
                return null;
            }

            if (!previousVote || !meeting.eligibleVoterIds.includes(previousVote)) {
                return workingState;
            }

            const voteCounts: Record<string, number> = { ...meeting.voteCounts };
            voteCounts[previousVote] = Math.max(0, (voteCounts[previousVote] ?? 0) - 1);

            const updatedMeeting: MeetingState = {
                ...meeting,
                voteCounts,
                totalVotes: Math.max(0, meeting.totalVotes - 1),
            };

            return {
                ...workingState,
                meeting: updatedMeeting,
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

        await redis.del(voteKey);
        const data = await buildMeetingViewData(gameId, userId, result);
        return {
            success: true,
            data: sanitizeMeetingViewForViewer(data, result, {
                viewerUserId: userId,
                isOrganizer: false,
            }),
        };
    } catch (error) {
        console.error("Failed to cancel meeting vote:", error);
        return {
            success: false,
            error: "Failed to cancel vote.",
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
        const accessScope = await resolveActionAccess(gameId, userId);
        if (!accessScope.success || !accessScope.data) {
            return {
                success: false,
                error: accessScope.error || "Session verification failed",
                code: accessScope.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }
        userId = accessScope.data.viewerUserId;

        let validationError: ActionResponse<{ role: PlayerRole }> | null = null;

        const updatedState = await mutateGameState(gameId, (state) => {
            const now = Date.now();
            const workingState = resolveRuntimeTransitions(state, now);

            if (workingState.status !== "IN_PROGRESS") {
                validationError = {
                    success: false,
                    error: "Cannot select role: game is not in progress.",
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

            const updatedPlayers = [...workingState.players];
            updatedPlayers[playerIndex] = {
                ...updatedPlayers[playerIndex],
                role,
            };

            return {
                ...workingState,
                players: updatedPlayers,
            };
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
