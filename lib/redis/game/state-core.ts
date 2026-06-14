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
import { SKIP_VOTE_ID } from "@/lib/constants/meeting";
import { Quest } from "@/types/quest";
import { optimizeCrewmateAssignmentsFromLoadedBatch } from "@/lib/quests/quest-assignment";
import { resolveGameTimerSettings, secondsToMs } from "@/lib/game/timers";
import {
    getFailedQuestsKey,
    getPlayerPresenceKey,
    getGameStateKey,
    getMeetingVoteKey,
} from "@/lib/redis/game-state-keys";
import { verifySession, createPlayerSession, verifyPlayerSession } from "@/lib/redis/auth-utils";
import { getGlobalQuestStats } from "@/lib/utils/quest-calculations";

export const MAX_PLAYERS_PER_GAME = 50;
export const PLAYER_PRESENCE_TTL_SECONDS = 30;

export function isWatchConflictError(error: unknown): boolean {
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

export function normalizeLegacyPlayerRole(role: unknown): PlayerRole | undefined {
    if (role === "CREWMATE" || role === "IMPOSTOR") {
        return role;
    }

    // Legacy compatibility: older game states may still contain ADMIN.
    return undefined;
}

export function normalizeGameState(state: GameState): GameState {
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

export function withGameStateRevision(currentState: GameState, nextState: GameState): GameState {
    if (areGameStatesEquivalent(currentState, nextState)) {
        return currentState;
    }

    return {
        ...nextState,
        revision: currentState.revision + 1,
        updatedAt: Date.now(),
    };
}

export function areGameStatesEquivalent(left: GameState, right: GameState): boolean {
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

export async function readGameState(gameId: string): Promise<GameState | null> {
    const state = await redis.get<GameState>(getGameStateKey(gameId));
    return state ? normalizeGameState(state) : null;
}

export async function mutateGameState(
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

export function getDefaultSabotageState(): SabotageState {
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

export function getNormalizedSabotageState(state: GameState): SabotageState {
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

export function getEligibleMeetingVoterIds(state: GameState): string[] {
    return state.players
        .filter((player) => player.isAlive && !!player.role)
        .map((player) => player.id);
}

export function buildMeetingSnapshot(state: GameState, capturedAt: number): MeetingSnapshot {
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

export function sumVoteCounts(voteCounts: Record<string, number>, eligibleVoterIds: string[]): number {
    return eligibleVoterIds.reduce((sum, playerId) => {
        const count = voteCounts[playerId] ?? 0;
        return sum + (count > 0 ? count : 0);
    }, 0);
}

export function getPostMeetingGraceRemainingMs(state: GameState, now: number): number {
    const meeting = state.meeting;
    if (!meeting || meeting.status !== "COMPLETED") {
        return 0;
    }

    const endedAt = typeof meeting.endedAt === "number" ? meeting.endedAt : meeting.endsAt;
    if (typeof endedAt !== "number") {
        return 0;
    }

    const timerSettings = resolveGameTimerSettings(state);
    const postMeetingGraceMs = secondsToMs(timerSettings.postMeetingGraceSeconds);
    return Math.max(0, endedAt + postMeetingGraceMs - now);
}

export function getReactorRemainingMs(reactor: ReactorSabotageState, now: number): number {
    if (typeof reactor.pausedRemainingMs === "number") {
        return Math.max(0, reactor.pausedRemainingMs);
    }

    return Math.max(0, reactor.endsAt - now);
}

export function pauseActiveReactorSabotage(state: GameState, now: number): GameState {
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

export function resumePausedReactorSabotage(state: GameState, now: number): GameState {
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

export function resolveMeetingState(
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
    const skipVotes = Math.max(0, meeting.voteCounts[SKIP_VOTE_ID] ?? 0);
    normalizedVoteCounts[SKIP_VOTE_ID] = skipVotes;

    const totalVotes = sumVoteCounts(normalizedVoteCounts, meeting.eligibleVoterIds) + skipVotes;

    let eliminatedPlayerId: string | undefined;
    let eliminatedPlayerName: string | undefined;
    let updatedPlayers = state.players;

    if (totalVotes > 0) {
        const ranked = meeting.eligibleVoterIds
            .map((playerId) => ({ playerId, votes: normalizedVoteCounts[playerId] ?? 0 }))
            .sort((a, b) => b.votes - a.votes);

        const maxVotes = ranked[0]?.votes ?? 0;
        if (maxVotes > 0 && skipVotes < maxVotes) {
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

export function resolveMeetingIfExpired(state: GameState, now: number): GameState {
    if (!state.meeting || state.meeting.status !== "ACTIVE") {
        return state;
    }
    if (now < state.meeting.endsAt) {
        return state;
    }
    // Use the scheduled end timestamp instead of "now" so timeout completion
    // remains stable across repeated reads/refreshes.
    return resolveMeetingState(state, "TIMEOUT", state.meeting.endsAt);
}

export function resolveSabotageIfExpired(state: GameState, now: number): GameState {
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

export function resolveRuntimeTransitions(state: GameState, now: number): GameState {
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

export async function buildMeetingViewData(gameId: string, userId: string, state: GameState): Promise<MeetingView> {
    const meeting = state.meeting ?? null;
    if (!meeting || meeting.status !== "ACTIVE" || !meeting.eligibleVoterIds.includes(userId)) {
        return {
            meeting,
            myVoteTargetId: null,
        };
    }

    const voteKey = getMeetingVoteKey(gameId, meeting.id, userId);
    const myVoteTargetId = await redis.get<string>(voteKey);
    const isValidTarget = myVoteTargetId
        ? myVoteTargetId === SKIP_VOTE_ID || meeting.eligibleVoterIds.includes(myVoteTargetId)
        : false;

    return {
        meeting,
        myVoteTargetId: isValidTarget ? myVoteTargetId : null,
    };
}

export interface ViewerScope {
    viewerUserId?: string;
    isOrganizer: boolean;
}

export interface PlayerSessionResolution {
    isPlayerSessionValid: boolean;
    recoveredSession: boolean;
    recoveryAttempted: boolean;
    error?: string;
    code?: string;
}

export interface ActionAccessScope {
    gameState: GameState;
    viewerUserId: string;
    isOrganizer: boolean;
    isPlayerSessionValid: boolean;
    recoveredSession: boolean;
}

export function canViewerSeeRole(
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

export function sanitizeMeetingSnapshotForViewer(
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

export function sanitizeMeetingStateForViewer(
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

export function sanitizeMeetingViewForViewer(
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

export function sanitizeGameStateForViewer(state: GameState, scope: ViewerScope): GameState {
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

export async function markPlayerPresenceConnected(gameId: string, userId: string): Promise<void> {
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

export async function clearPlayerPresence(gameId: string, userId: string): Promise<void> {
    try {
        await redis.del(getPlayerPresenceKey(gameId, userId));
    } catch (error) {
        console.error(`Failed to clear player presence for ${gameId}/${userId}:`, error);
    }
}

export async function isPlayerCurrentlyConnected(gameId: string, userId: string): Promise<boolean> {
    try {
        const exists = await redis.exists(getPlayerPresenceKey(gameId, userId));
        return exists === 1;
    } catch (error) {
        // Security-first fallback: if presence cannot be verified, reject takeover.
        console.error(`Failed to verify player presence for ${gameId}/${userId}:`, error);
        return true;
    }
}

export async function isPasswordAuthenticatedPlayer(userId: string): Promise<boolean> {
    try {
        const exists = await redis.exists(`user:${userId}`);
        return exists === 1;
    } catch (error) {
        // Security-first fallback: if lookup fails, prevent account takeover.
        console.error(`Failed to verify protected account marker for player ${userId}:`, error);
        return true;
    }
}

export function normalizePlayerAlias(alias: string): string {
    return alias.trim().toLocaleLowerCase();
}

export function mergeUniqueStringArrays(current: string[] = [], incoming: string[] = []): string[] {
    return Array.from(new Set([...current, ...incoming]));
}

export function reassignMeetingParticipantId(
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

export function reassignPlayerIdentity(
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

export async function migrateReassignedPlayerData(
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

export async function verifyAndRecoverPlayerSession(
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

export async function resolveActionAccess(
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

export async function resolveViewerScopeForGame(
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
export function checkWinConditions(state: GameState): { finished: boolean; winner?: PlayerRole } {
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

export function getAutoImpostorCount(playerCount: number): number {
    return Math.max(1, Math.ceil(playerCount / 5));
}

export function getManualImpostorCount(count?: number): number {
    if (!Number.isInteger(count) || !count) {
        return 1;
    }
    return Math.max(1, Math.min(10, count));
}

export function getMinimumPlayersToLaunch(
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

export function hasCrewmateMajority(playerCount: number, impostorCount: number): boolean {
    const crewmateCount = playerCount - impostorCount;
    return crewmateCount > impostorCount;
}

export function shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function assignRolesRandomly(
    players: GameState["players"],
    impostorCount: number
): GameState["players"] {
    const shuffledPlayers = shuffleArray(players);
    const impostorIds = new Set(
        shuffledPlayers.slice(0, impostorCount).map((player) => player.id)
    );

    return players.map((player) => ({
        ...player,
        role: impostorIds.has(player.id) ? "IMPOSTOR" : "CREWMATE",
    }));
}

export function optimizeLobbyBatchQuests(
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

export function optimizeCrewmateBatchQuests(
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

export function assignMissingCrewmateBatchQuests(
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

