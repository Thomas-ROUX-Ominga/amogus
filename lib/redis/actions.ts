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
import { Quest, BatchSabotages } from "@/types/quest";
import { assignQuestsFromBatch } from "@/lib/quests/quest-assignment";

import { verifySession, createPlayerSession, verifyPlayerSession } from "./auth-utils";
import { getGlobalQuestStats } from "@/lib/utils/quest-calculations";

const MEETING_DURATION_MS = 5 * 60 * 1000;
const REACTOR_SABOTAGE_DURATION_MS = 90 * 1000;
const SABOTAGE_COOLDOWN_MS = 120 * 1000;

function getDefaultSabotageState(): SabotageState {
    return {
        active: null,
        reactor: null,
        cooldowns: {
            communicationsAvailableAt: 0,
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
            reactorAvailableAt: current.cooldowns?.reactorAvailableAt ?? 0,
        },
    };
}

function createMeetingVoteKey(gameId: string, meetingId: string, voterId: string): string {
    return `game:${gameId}:meeting:${meetingId}:vote:${voterId}`;
}

function getEligibleMeetingVoterIds(state: GameState): string[] {
    return state.players
        .filter((player) => player.isAlive && !!player.role && player.role !== "ADMIN")
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
            const topPlayers = ranked.filter((entry) => entry.votes === maxVotes).map((entry) => entry.playerId);
            const selectedIndex = Math.floor(Math.random() * topPlayers.length);
            eliminatedPlayerId = topPlayers[selectedIndex];

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

async function buildMeetingViewData(gameId: string, userId: string, state: GameState): Promise<MeetingView> {
    const meeting = state.meeting ?? null;
    if (!meeting || meeting.status !== "ACTIVE" || !meeting.eligibleVoterIds.includes(userId)) {
        return {
            meeting,
            myVoteTargetId: null,
        };
    }

    const voteKey = createMeetingVoteKey(gameId, meeting.id, userId);
    const myVoteTargetId = await redis.get<string>(voteKey);
    const isValidTarget = myVoteTargetId ? meeting.eligibleVoterIds.includes(myVoteTargetId) : false;

    return {
        meeting,
        myVoteTargetId: isValidTarget ? myVoteTargetId : null,
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
            batchSabotages = batchResponse.data.sabotages;
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
            sabotages: batchSabotages,
            sabotageState: getDefaultSabotageState(),
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
            code: ERROR_CODES.ERR_SIGNAL_LOST,
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

            const now = Date.now();
            let workingState = resolveMeetingIfExpired(state, now);
            workingState = resolveSabotageIfExpired(workingState, now);

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
        const stateKey = `game:${gameId}:state`;
        let validationError: ActionResponse<GameState> | null = null;

        const result = await redis.atomicUpdate<GameState>(stateKey, (state) => {
            if (!state) {
                validationError = {
                    success: false,
                    error: "Game module not found or decommissioned.",
                    code: ERROR_CODES.GAME_NOT_FOUND,
                };
                return null;
            }

            const now = Date.now();
            let workingState = resolveMeetingIfExpired(state, now);
            workingState = resolveSabotageIfExpired(workingState, now);
            return workingState;
        }, GAME_TTL_SECONDS);

        if (validationError) {
            return validationError;
        }

        return {
            success: true,
            data: result!,
        };
    } catch (error) {
        console.error("Failed to refresh game:", error);
        return {
            success: false,
            error: "Failed to refresh game data.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export interface ScanSabotageResult {
    handled: boolean;
    event?:
        | "COMMUNICATIONS_ACTIVATED"
        | "COMMUNICATIONS_REPAIRED"
        | "REACTOR_ACTIVATED"
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
        const sessionCheck = await verifyPlayerSession(userId, gameId);
        if (!sessionCheck.success) {
            return {
                success: false,
                error: sessionCheck.error || "Session verification failed",
                code: sessionCheck.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }

        const stateKey = `game:${gameId}:state`;
        let validationError: ActionResponse<ScanSabotageResult> | null = null;
        let scanResult: ScanSabotageResult | null = null;
        const now = Date.now();

        const result = await redis.atomicUpdate<GameState>(stateKey, (state) => {
            if (!state) {
                validationError = {
                    success: false,
                    error: "Game session not found.",
                    code: ERROR_CODES.GAME_NOT_FOUND,
                };
                return null;
            }

            let workingState = resolveMeetingIfExpired(state, now);
            workingState = resolveSabotageIfExpired(workingState, now);

            const sabotages = workingState.sabotages;
            const isCommsQr = sabotages?.communications.qrId === qrId;
            const reactorIndex = sabotages?.reactor.findIndex((entry) => entry.qrId === qrId) ?? -1;
            const isReactorQr = reactorIndex >= 0;
            const isSabotageQr = isCommsQr || isReactorQr;

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

            if (!player.isAlive || player.role === "ADMIN" || !player.role) {
                validationError = {
                    success: false,
                    error: "You are not allowed to use sabotage systems.",
                    code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                    data: { handled: true },
                };
                return null;
            }

            const sabotageState = getNormalizedSabotageState(workingState);

            if (isCommsQr) {
                if (player.role === "IMPOSTOR") {
                    if (sabotageState.active) {
                        validationError = {
                            success: false,
                            error: "A sabotage is already active.",
                            code: ERROR_CODES.ERR_SABOTAGE_ALREADY_ACTIVE,
                            data: { handled: true },
                        };
                        return null;
                    }

                    if (now < sabotageState.cooldowns.communicationsAvailableAt) {
                        validationError = {
                            success: false,
                            error: "Communications sabotage is on cooldown.",
                            code: ERROR_CODES.ERR_SABOTAGE_COOLDOWN,
                            data: { handled: true },
                        };
                        return null;
                    }

                    const updatedState: GameState = {
                        ...workingState,
                        sabotageState: {
                            ...sabotageState,
                            active: "COMMUNICATIONS",
                        },
                    };

                    scanResult = {
                        handled: true,
                        event: "COMMUNICATIONS_ACTIVATED",
                        gameState: updatedState,
                    };
                    return updatedState;
                }

                if (player.role === "CREWMATE") {
                    if (sabotageState.active !== "COMMUNICATIONS") {
                        validationError = {
                            success: false,
                            error: "Communications sabotage is not active.",
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
                                communicationsAvailableAt: now + SABOTAGE_COOLDOWN_MS,
                            },
                        },
                    };

                    scanResult = {
                        handled: true,
                        event: "COMMUNICATIONS_REPAIRED",
                        gameState: updatedState,
                    };
                    return updatedState;
                }

                validationError = {
                    success: false,
                    error: "You are not allowed to use communications sabotage.",
                    code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                    data: { handled: true },
                };
                return null;
            }

            if (isReactorQr) {
                if (player.role === "IMPOSTOR") {
                    if (sabotageState.active) {
                        validationError = {
                            success: false,
                            error: "A sabotage is already active.",
                            code: ERROR_CODES.ERR_SABOTAGE_ALREADY_ACTIVE,
                            data: { handled: true },
                        };
                        return null;
                    }

                    if (now < sabotageState.cooldowns.reactorAvailableAt) {
                        validationError = {
                            success: false,
                            error: "Reactor sabotage is on cooldown.",
                            code: ERROR_CODES.ERR_SABOTAGE_COOLDOWN,
                            data: { handled: true },
                        };
                        return null;
                    }

                    const updatedState: GameState = {
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
                    };

                    scanResult = {
                        handled: true,
                        event: "REACTOR_ACTIVATED",
                        reactorProgress: {
                            scanned: 0,
                            total: 2,
                            remainingMs: REACTOR_SABOTAGE_DURATION_MS,
                        },
                        gameState: updatedState,
                    };
                    return updatedState;
                }

                if (player.role === "CREWMATE") {
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
                    success: false,
                    error: "You are not allowed to use reactor sabotage.",
                    code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                    data: { handled: true },
                };
                return null;
            }

            validationError = {
                success: true,
                data: { handled: false },
            };
            return null;
        }, GAME_TTL_SECONDS);

        if (validationError) {
            return validationError;
        }

        return {
            success: true,
            data: scanResult ?? { handled: false, gameState: result ?? undefined },
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
        const sessionCheck = await verifyPlayerSession(userId, gameId);
        if (!sessionCheck.success) {
            return {
                success: false,
                error: sessionCheck.error || "Session verification failed",
                code: sessionCheck.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }

        const stateKey = `game:${gameId}:state`;
        let validationError: ActionResponse<MeetingView> | null = null;

        const state = await redis.atomicUpdate<GameState>(stateKey, (currentState) => {
            if (!currentState) {
                validationError = {
                    success: false,
                    error: "Game session not found.",
                    code: ERROR_CODES.GAME_NOT_FOUND,
                };
                return null;
            }

            const now = Date.now();
            let workingState = resolveMeetingIfExpired(currentState, now);
            workingState = resolveSabotageIfExpired(workingState, now);
            return workingState;
        }, GAME_TTL_SECONDS);

        if (validationError) {
            return validationError;
        }

        const data = await buildMeetingViewData(gameId, userId, state!);
        return {
            success: true,
            data,
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
        const sessionCheck = await verifyPlayerSession(userId, gameId);
        if (!sessionCheck.success) {
            return {
                success: false,
                error: sessionCheck.error || "Session verification failed",
                code: sessionCheck.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }

        const stateKey = `game:${gameId}:state`;
        let validationError: ActionResponse<MeetingView> | null = null;
        const now = Date.now();

        const result = await redis.atomicUpdate<GameState>(stateKey, (state) => {
            if (!state) {
                validationError = {
                    success: false,
                    error: "Game session not found.",
                    code: ERROR_CODES.GAME_NOT_FOUND,
                };
                return null;
            }

            let workingState = resolveMeetingIfExpired(state, now);
            workingState = resolveSabotageIfExpired(workingState, now);

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
            const isEligible = player.isAlive && player.role && player.role !== "ADMIN";
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
        }, GAME_TTL_SECONDS);

        if (validationError) {
            return validationError;
        }

        const data = await buildMeetingViewData(gameId, userId, result!);
        return {
            success: true,
            data,
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
        const sessionCheck = await verifyPlayerSession(userId, gameId);
        if (!sessionCheck.success) {
            return {
                success: false,
                error: sessionCheck.error || "Session verification failed",
                code: sessionCheck.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }

        const preloadedState = await redis.get<GameState>(`game:${gameId}:state`);
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

        const voteKey = createMeetingVoteKey(gameId, activeMeetingId, userId);
        const previousVote = await redis.get<string>(voteKey);

        const stateKey = `game:${gameId}:state`;
        let validationError: ActionResponse<MeetingView> | null = null;

        const result = await redis.atomicUpdate<GameState>(stateKey, (state) => {
            if (!state) {
                validationError = {
                    success: false,
                    error: "Game session not found.",
                    code: ERROR_CODES.GAME_NOT_FOUND,
                };
                return null;
            }

            const now = Date.now();
            let workingState = resolveMeetingIfExpired(state, now);
            workingState = resolveSabotageIfExpired(workingState, now);
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
        }, GAME_TTL_SECONDS);

        if (validationError) {
            return validationError;
        }

        await redis.set(voteKey, targetId, GAME_TTL_SECONDS);
        const data = await buildMeetingViewData(gameId, userId, result!);
        return {
            success: true,
            data,
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
        const sessionCheck = await verifyPlayerSession(userId, gameId);
        if (!sessionCheck.success) {
            return {
                success: false,
                error: sessionCheck.error || "Session verification failed",
                code: sessionCheck.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }

        const preloadedState = await redis.get<GameState>(`game:${gameId}:state`);
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

        const voteKey = createMeetingVoteKey(gameId, activeMeetingId, userId);
        const previousVote = await redis.get<string>(voteKey);

        const stateKey = `game:${gameId}:state`;
        let validationError: ActionResponse<MeetingView> | null = null;

        const result = await redis.atomicUpdate<GameState>(stateKey, (state) => {
            if (!state) {
                validationError = {
                    success: false,
                    error: "Game session not found.",
                    code: ERROR_CODES.GAME_NOT_FOUND,
                };
                return null;
            }

            const now = Date.now();
            let workingState = resolveMeetingIfExpired(state, now);
            workingState = resolveSabotageIfExpired(workingState, now);
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
        }, GAME_TTL_SECONDS);

        if (validationError) {
            return validationError;
        }

        await redis.del(voteKey);
        const data = await buildMeetingViewData(gameId, userId, result!);
        return {
            success: true,
            data,
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

            const now = Date.now();
            let workingState = resolveMeetingIfExpired(state, now);
            workingState = resolveSabotageIfExpired(workingState, now);

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

            const now = Date.now();
            let workingState = resolveMeetingIfExpired(state, now);
            workingState = resolveSabotageIfExpired(workingState, now);

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
