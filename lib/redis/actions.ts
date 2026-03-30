"use server";

import { redis, GAME_TTL_SECONDS } from "@/lib/redis/client";
import {
    GameState,
    ActionResponse,
    PlayerRole,
    ImpostorAssignmentMode,
    MeetingSnapshot,
    MeetingState,
    MeetingView,
    SabotageState,
    ReactorSabotageState,
} from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { getBatchData } from "@/lib/redis/batch-actions";
import { getTotalQuestGamesCount } from "@/lib/constants/quest-pool";
import { generateShortCode } from "@/lib/utils/short-code.server";
import { Quest, BatchSabotages, SabotageType } from "@/types/quest";
import { optimizeCrewmateAssignmentsFromLoadedBatch } from "@/lib/quests/quest-assignment";
import {
    getFailedQuestsKey,
    getGameNamespacePattern,
    getPlayerPresenceKey,
    getGameStateKey,
    getMeetingVoteKey,
} from "@/lib/redis/game-state-keys";

import { verifySession, createPlayerSession, verifyPlayerSession } from "@/lib/redis/auth-utils";
import { getGlobalQuestStats } from "@/lib/utils/quest-calculations";

const MEETING_DURATION_MS = 5 * 60 * 1000;
const REACTOR_SABOTAGE_DURATION_MS = 90 * 1000;
const SABOTAGE_COOLDOWN_MS = 120 * 1000;
const POST_MEETING_GRACE_MS = 60 * 1000;
const MAX_PLAYERS_PER_GAME = 50;
const PLAYER_PRESENCE_TTL_SECONDS = 30;

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

function getPostMeetingGraceRemainingMs(state: GameState, now: number): number {
    const meeting = state.meeting;
    if (!meeting || meeting.status !== "COMPLETED") {
        return 0;
    }

    const endedAt = typeof meeting.endedAt === "number" ? meeting.endedAt : meeting.endsAt;
    if (typeof endedAt !== "number") {
        return 0;
    }

    return Math.max(0, endedAt + POST_MEETING_GRACE_MS - now);
}

function getReactorRemainingMs(reactor: ReactorSabotageState, now: number): number {
    if (typeof reactor.pausedRemainingMs === "number") {
        return Math.max(0, reactor.pausedRemainingMs);
    }

    return Math.max(0, reactor.endsAt - now);
}

function pauseActiveReactorSabotage(state: GameState, now: number): GameState {
    const sabotageState = getNormalizedSabotageState(state);
    if (sabotageState.active !== "REACTOR" || !sabotageState.reactor) {
        return state;
    }

    const reactor = sabotageState.reactor;
    if (typeof reactor.pausedRemainingMs === "number") {
        return state;
    }

    return {
        ...state,
        sabotageState: {
            ...sabotageState,
            reactor: {
                ...reactor,
                pausedAt: now,
                pausedRemainingMs: getReactorRemainingMs(reactor, now),
            },
        },
    };
}

function resumePausedReactorSabotage(state: GameState, now: number): GameState {
    const sabotageState = getNormalizedSabotageState(state);
    if (sabotageState.active !== "REACTOR" || !sabotageState.reactor) {
        return state;
    }

    const reactor = sabotageState.reactor;
    if (typeof reactor.pausedRemainingMs !== "number") {
        return state;
    }

    const resumedReactor: ReactorSabotageState = {
        ...reactor,
        endsAt: now + Math.max(0, reactor.pausedRemainingMs),
    };
    delete resumedReactor.pausedAt;
    delete resumedReactor.pausedRemainingMs;

    return {
        ...state,
        sabotageState: {
            ...sabotageState,
            reactor: resumedReactor,
        },
    };
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
            const randomIndex = Math.min(
                topPlayers.length - 1,
                Math.floor(Math.random() * topPlayers.length)
            );
            eliminatedPlayerId = topPlayers[randomIndex];

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

    let updatedState: GameState = {
        ...state,
        players: updatedPlayers,
        meeting: completedMeeting,
    };
    updatedState = resumePausedReactorSabotage(updatedState, now);

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

    if (state.meeting?.status === "ACTIVE") {
        return state;
    }

    const sabotageState = getNormalizedSabotageState(state);
    if (sabotageState.active !== "REACTOR" || !sabotageState.reactor) {
        return state;
    }

    if (typeof sabotageState.reactor.pausedRemainingMs === "number") {
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

    if (resolved.status === "IN_PROGRESS") {
        const winCheck = checkWinConditions(resolved);
        if (winCheck.finished) {
            return {
                ...resolved,
                status: "FINISHED",
                winner: winCheck.winner,
            };
        }
    }

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
                    postEliminationBuzzerGrantedAt: player.postEliminationBuzzerGrantedAt,
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

async function markPlayerPresenceConnected(gameId: string, userId: string): Promise<void> {
    try {
        await redis.set(
            getPlayerPresenceKey(gameId, userId),
            { userId, touchedAt: Date.now() },
            PLAYER_PRESENCE_TTL_SECONDS
        );
    } catch (error) {
        console.error(`Failed to mark player presence as connected for ${gameId}/${userId}:`, error);
    }
}

async function clearPlayerPresence(gameId: string, userId: string): Promise<void> {
    try {
        await redis.del(getPlayerPresenceKey(gameId, userId));
    } catch (error) {
        console.error(`Failed to clear player presence for ${gameId}/${userId}:`, error);
    }
}

async function isPlayerCurrentlyConnected(gameId: string, userId: string): Promise<boolean> {
    try {
        const exists = await redis.exists(getPlayerPresenceKey(gameId, userId));
        return exists === 1;
    } catch (error) {
        // Security-first fallback: if presence cannot be verified, reject takeover.
        console.error(`Failed to verify player presence for ${gameId}/${userId}:`, error);
        return true;
    }
}

async function isPasswordAuthenticatedPlayer(userId: string): Promise<boolean> {
    try {
        const exists = await redis.exists(`user:${userId}`);
        return exists === 1;
    } catch (error) {
        // Security-first fallback: if lookup fails, prevent account takeover.
        console.error(`Failed to verify protected account marker for player ${userId}:`, error);
        return true;
    }
}

function normalizePlayerAlias(alias: string): string {
    return alias.trim().toLocaleLowerCase();
}

function mergeUniqueStringArrays(current: string[] = [], incoming: string[] = []): string[] {
    return Array.from(new Set([...current, ...incoming]));
}

function reassignMeetingParticipantId(
    meeting: MeetingState,
    previousUserId: string,
    nextUserId: string
): MeetingState {
    const remappedEligibleVoterIds = Array.from(
        new Set(
            meeting.eligibleVoterIds.map((playerId) =>
                playerId === previousUserId ? nextUserId : playerId
            )
        )
    );

    const remappedVoteCounts = Object.entries(meeting.voteCounts).reduce<Record<string, number>>(
        (accumulator, [playerId, votes]) => {
            const remappedPlayerId = playerId === previousUserId ? nextUserId : playerId;
            accumulator[remappedPlayerId] = (accumulator[remappedPlayerId] ?? 0) + Math.max(0, votes ?? 0);
            return accumulator;
        },
        {}
    );

    remappedEligibleVoterIds.forEach((playerId) => {
        if (!(playerId in remappedVoteCounts)) {
            remappedVoteCounts[playerId] = 0;
        }
    });

    return {
        ...meeting,
        startedBy: meeting.startedBy === previousUserId ? nextUserId : meeting.startedBy,
        eligibleVoterIds: remappedEligibleVoterIds,
        totalEligibleVoters: remappedEligibleVoterIds.length,
        voteCounts: remappedVoteCounts,
        eliminatedPlayerId:
            meeting.eliminatedPlayerId === previousUserId
                ? nextUserId
                : meeting.eliminatedPlayerId,
        snapshot: {
            ...meeting.snapshot,
            players: meeting.snapshot.players.map((player) =>
                player.id === previousUserId ? { ...player, id: nextUserId } : player
            ),
        },
    };
}

function reassignPlayerIdentity(
    state: GameState,
    previousUserId: string,
    nextUserId: string
): GameState {
    if (previousUserId === nextUserId) {
        return state;
    }

    const reassignedPlayers = state.players.map((player) =>
        player.id === previousUserId ? { ...player, id: nextUserId } : player
    );

    const currentSabotageState = state.sabotageState;
    const reassignedSabotageState = currentSabotageState
        ? {
              ...currentSabotageState,
              reactor: currentSabotageState.reactor
                  ? {
                        ...currentSabotageState.reactor,
                        scannedUserIds: Array.from(
                            new Set(
                                currentSabotageState.reactor.scannedUserIds.map((scannedUserId) =>
                                    scannedUserId === previousUserId ? nextUserId : scannedUserId
                                )
                            )
                        ),
                    }
                  : null,
          }
        : currentSabotageState;

    return {
        ...state,
        players: reassignedPlayers,
        creatorId: state.creatorId === previousUserId ? nextUserId : state.creatorId,
        meeting: state.meeting
            ? reassignMeetingParticipantId(state.meeting, previousUserId, nextUserId)
            : state.meeting,
        sabotageState: reassignedSabotageState,
    };
}

async function migrateReassignedPlayerData(
    gameId: string,
    previousUserId: string,
    nextUserId: string,
    meeting?: MeetingState
): Promise<void> {
    if (previousUserId === nextUserId) {
        return;
    }

    try {
        const previousFailedQuestsKey = getFailedQuestsKey(gameId, previousUserId);
        const nextFailedQuestsKey = getFailedQuestsKey(gameId, nextUserId);
        const previousFailedQuests = await redis.get<Record<string, string[]>>(previousFailedQuestsKey);

        if (previousFailedQuests) {
            const nextFailedQuests =
                (await redis.get<Record<string, string[]>>(nextFailedQuestsKey)) ?? {};
            const mergedFailedQuests: Record<string, string[]> = { ...nextFailedQuests };

            Object.entries(previousFailedQuests).forEach(([questId, contentIds]) => {
                mergedFailedQuests[questId] = mergeUniqueStringArrays(
                    nextFailedQuests[questId] ?? [],
                    contentIds
                );
            });

            await redis.set(nextFailedQuestsKey, mergedFailedQuests, GAME_TTL_SECONDS);
            await redis.del(previousFailedQuestsKey);
        }

        if (meeting?.status === "ACTIVE") {
            const previousVoteKey = getMeetingVoteKey(gameId, meeting.id, previousUserId);
            const nextVoteKey = getMeetingVoteKey(gameId, meeting.id, nextUserId);
            const previousVoteTarget = await redis.get<string>(previousVoteKey);

            if (previousVoteTarget) {
                await redis.set(nextVoteKey, previousVoteTarget, GAME_TTL_SECONDS);
            }
            await redis.del(previousVoteKey);
        }

        await clearPlayerPresence(gameId, previousUserId);
    } catch (error) {
        console.error(
            `Failed to migrate reassigned player data for game ${gameId} (${previousUserId} -> ${nextUserId}):`,
            error
        );
    }
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

    let initialCheck;
    try {
        initialCheck = await verifyPlayerSession(userId, gameId);
    } catch (error) {
        console.error("Player-session verification crashed:", error);
        return {
            isPlayerSessionValid: false,
            recoveredSession: false,
            recoveryAttempted: false,
            error: "Session verification failed",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
    if (initialCheck.success) {
        return {
            isPlayerSessionValid: true,
            recoveredSession: false,
            recoveryAttempted: false,
        };
    }

    const canRecoverFromSessionError =
        initialCheck.code === ERROR_CODES.ERR_NO_SESSION ||
        initialCheck.code === ERROR_CODES.ERR_INVALID_SESSION;

    if (!canRecoverFromSessionError) {
        return {
            isPlayerSessionValid: false,
            recoveredSession: false,
            recoveryAttempted: false,
            error: initialCheck.error || "Session verification failed",
            code: initialCheck.code || ERROR_CODES.ERR_INVALID_SESSION,
        };
    }

    let sessionResult;
    try {
        sessionResult = await createPlayerSession(userId, gameId);
    } catch (error) {
        console.error("Player-session recreation crashed:", error);
        return {
            isPlayerSessionValid: false,
            recoveredSession: false,
            recoveryAttempted: true,
            error: "Failed to create player session",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
    if (!sessionResult.success) {
        return {
            isPlayerSessionValid: false,
            recoveredSession: false,
            recoveryAttempted: true,
            error: sessionResult.error || "Session verification failed",
            code: sessionResult.code || ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }

    // Cookie writes are committed on response boundaries in Next.js.
    // Re-verifying immediately in the same request can produce false negatives.
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

    await markPlayerPresenceConnected(gameId, normalizedUserId);

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
        if (!playerExists) {
            // Allow non-joined viewers to reach the join flow even when the game already started.
            return {
                success: true,
                data: { isOrganizer: false },
            };
        }

        const playerSession = await verifyAndRecoverPlayerSession(gameId, normalizedUserId, playerExists);
        const hasValidPlayerSession = playerSession.isPlayerSessionValid;

        if (hasValidPlayerSession) {
            await markPlayerPresenceConnected(gameId, normalizedUserId);
            // Player context always gets player-level role visibility, even for organizer accounts.
            return {
                success: true,
                data: {
                    viewerUserId: normalizedUserId,
                    isOrganizer: false,
                },
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

    // 2. Check Crewmate Victory: All impostors eliminated
    const totalImpostors = players.filter((p) => p.role === "IMPOSTOR");
    const aliveImpostors = totalImpostors.filter((p) => p.isAlive);
    if (totalImpostors.length > 0 && aliveImpostors.length === 0) {
        return { finished: true, winner: "CREWMATE" };
    }

    // 3. Check Impostor Victory: As many alive impostors as alive crewmates
    const totalCrewmates = players.filter((p) => p.role === "CREWMATE");
    const aliveCrewmates = totalCrewmates.filter((p) => p.isAlive);

    // Only trigger if there were actually crewmates and at least one living impostor.
    if (
        totalCrewmates.length > 0 &&
        aliveImpostors.length > 0 &&
        aliveImpostors.length >= aliveCrewmates.length
    ) {
        return { finished: true, winner: "IMPOSTOR" };
    }

    return { finished: false };
}

function getAutoImpostorCount(playerCount: number): number {
    return Math.max(1, Math.ceil(playerCount / 5));
}

function getManualImpostorCount(count?: number): number {
    if (!Number.isInteger(count) || !count) {
        return 1;
    }
    return Math.max(1, Math.min(10, count));
}

function getMinimumPlayersToLaunch(
    mode: ImpostorAssignmentMode | undefined,
    manualImpostorCount?: number
): number {
    // Legacy compatibility still enforces a safe minimum for launch.
    if (mode === undefined) {
        return 3;
    }
    if (mode === "manual") {
        // Ensure crewmates strictly outnumber impostors at launch.
        return getManualImpostorCount(manualImpostorCount) * 2 + 1;
    }
    return 3;
}

function hasCrewmateMajority(playerCount: number, impostorCount: number): boolean {
    const crewmateCount = playerCount - impostorCount;
    return crewmateCount > impostorCount;
}

function assignRolesRandomly(
    players: GameState["players"],
    impostorCount: number
): GameState["players"] {
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    const impostorIds = new Set(
        shuffledPlayers.slice(0, impostorCount).map((player) => player.id)
    );

    return players.map((player) => ({
        ...player,
        role: impostorIds.has(player.id) ? "IMPOSTOR" : "CREWMATE",
    }));
}

function optimizeLobbyBatchQuests(
    state: GameState,
    players: GameState["players"],
    batch: { id: string; quests: Quest[] } | null
): GameState["players"] | null {
    if (!batch || !state.batchId || state.batchId !== batch.id || !state.questsPerPlayer) {
        return players;
    }

    const playerIds = players.map((player) => player.id);
    if (playerIds.length === 0) {
        return players;
    }

    try {
        const optimization = optimizeCrewmateAssignmentsFromLoadedBatch(
            {
                ...state,
                players,
            },
            batch,
            {
                playerIds,
                targetPlayerId: playerIds[0],
                restarts: 64,
            }
        );

        const assignmentsByPlayerId = optimization.assignmentsByPlayerId;
        return players.map((player) => {
            const assignments = assignmentsByPlayerId[player.id];
            if (!assignments || assignments.length === 0) {
                throw new Error(`No optimized assignment generated for player ${player.id}.`);
            }
            return {
                ...player,
                assignedQuests: assignments.map((assignment) => assignment.questId),
            };
        });
    } catch (error) {
        console.error("Quest optimization failed during lobby assignment:", error);
        return null;
    }
}

function optimizeCrewmateBatchQuests(
    state: GameState,
    players: GameState["players"],
    batch: { id: string; quests: Quest[] } | null
): GameState["players"] | null {
    if (!batch || !state.batchId || state.batchId !== batch.id || !state.questsPerPlayer) {
        return players;
    }

    const crewmateIds = players
        .filter((player) => player.role === "CREWMATE")
        .map((player) => player.id);

    if (crewmateIds.length === 0) {
        return players.map((player) =>
            player.role === "IMPOSTOR"
                ? {
                      ...player,
                      assignedQuests: undefined,
                  }
                : player
        );
    }

    try {
        const optimization = optimizeCrewmateAssignmentsFromLoadedBatch(
            {
                ...state,
                players,
            },
            batch,
            {
                playerIds: crewmateIds,
                targetPlayerId: crewmateIds[0],
                restarts: 64,
            }
        );

        const assignmentsByPlayerId = optimization.assignmentsByPlayerId;
        return players.map((player) => {
            if (player.role === "CREWMATE") {
                const assignments = assignmentsByPlayerId[player.id];
                if (!assignments || assignments.length === 0) {
                    throw new Error(`No optimized assignment generated for crewmate ${player.id}.`);
                }
                return {
                    ...player,
                    assignedQuests: assignments.map((assignment) => assignment.questId),
                };
            }

            return {
                ...player,
                assignedQuests: undefined,
            };
        });
    } catch (error) {
        console.error("Quest optimization failed during crewmate assignment:", error);
        return null;
    }
}

function assignMissingCrewmateBatchQuests(
    state: GameState,
    players: GameState["players"],
    batch: { id: string; quests: Quest[] } | null
): GameState["players"] | null {
    if (!batch || !state.batchId || state.batchId !== batch.id || !state.questsPerPlayer) {
        return players;
    }

    const hasCrewmateWithoutAssignments = players.some(
        (player) => player.role === "CREWMATE" && (!player.assignedQuests || player.assignedQuests.length === 0)
    );
    if (!hasCrewmateWithoutAssignments) {
        return players;
    }

    return optimizeCrewmateBatchQuests(state, players, batch);
}

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

            if (player.role !== "IMPOSTOR") {
                validationError = {
                    success: false,
                    error: "Only impostors can trigger sabotage.",
                    code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                };
                return null;
            }

            const postMeetingGraceRemainingMs = getPostMeetingGraceRemainingMs(workingState, now);
            if (postMeetingGraceRemainingMs > 0) {
                validationError = {
                    success: false,
                    error: "Post-meeting grace is active. Sabotage cannot be triggered yet.",
                    code: ERROR_CODES.ERR_SABOTAGE_BLOCKED_BY_POST_MEETING_GRACE,
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
                            remainingMs: getReactorRemainingMs(currentReactor, now),
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
                            remainingMs: getReactorRemainingMs(currentReactor, now),
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
                        remainingMs: repaired ? 0 : getReactorRemainingMs(currentReactor, now),
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
            const lastMeetingStartedAt = workingState.meeting?.startedAt ?? 0;
            const hasPostEliminationBuzzerGrant =
                Boolean(player.postEliminationBuzzerGrantedAt) &&
                (player.postEliminationBuzzerGrantedAt ?? 0) > lastMeetingStartedAt;
            const isEligible = !!player.role && (player.isAlive || hasPostEliminationBuzzerGrant);
            if (!isEligible) {
                validationError = {
                    success: false,
                    error: "You are not allowed to trigger meetings.",
                    code: ERROR_CODES.ERR_MEETING_FORBIDDEN,
                };
                return null;
            }

            const postMeetingGraceRemainingMs = getPostMeetingGraceRemainingMs(workingState, now);
            if (postMeetingGraceRemainingMs > 0 && !hasPostEliminationBuzzerGrant) {
                validationError = {
                    success: false,
                    error: "Post-meeting grace is active. Meeting cannot be triggered yet.",
                    code: ERROR_CODES.ERR_MEETING_BLOCKED_BY_POST_MEETING_GRACE,
                };
                return null;
            }

            if (workingState.sabotageState?.active && !hasPostEliminationBuzzerGrant) {
                validationError = {
                    success: false,
                    error: "A sabotage is active. Meetings cannot be triggered.",
                    code: ERROR_CODES.ERR_MEETING_BLOCKED_BY_SABOTAGE,
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

            // Starting a new meeting clears any post-elimination buzzer grants.
            const updatedPlayers = workingState.players.map((entry, index) => ({
                ...entry,
                postEliminationBuzzerGrantedAt: undefined,
                ...(index === playerIndex ? { meetingBuzzUsedAt: now } : {}),
            }));

            const nextState: GameState = {
                ...workingState,
                players: updatedPlayers,
                meeting,
            };
            return pauseActiveReactorSabotage(nextState, now);
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

            // New behavior: configured games use automatic role assignment only.
            if (workingState.impostorMode !== undefined) {
                validationError = {
                    success: false,
                    error: "Roles are assigned automatically when the game starts.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                };
                return null;
            }

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
                assignedQuests: role === "IMPOSTOR" ? undefined : updatedPlayers[playerIndex].assignedQuests,
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
