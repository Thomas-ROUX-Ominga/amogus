"use server";

import { redis, GAME_TTL_SECONDS } from "@/lib/redis/client";
import { GameState, ActionResponse, MeetingState, MeetingView } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { resolveGameTimerSettings, secondsToMs } from "@/lib/game/timers";
import { getMeetingVoteKey } from "@/lib/redis/game-state-keys";
import {
    readGameState,
    mutateGameState,
    resolveRuntimeTransitions,
    resolveActionAccess,
    sanitizeMeetingViewForViewer,
    buildMeetingViewData,
    buildMeetingSnapshot,
    getEligibleMeetingVoterIds,
    getPostMeetingGraceRemainingMs,
    resolveMeetingState,
    pauseActiveReactorSabotage,
} from "./state-core";

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

            if (player.meetingBuzzUsedAt && !hasPostEliminationBuzzerGrant) {
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
            const meetingDurationMs = secondsToMs(resolveGameTimerSettings(workingState).meetingDurationSeconds);
            const meeting: MeetingState = {
                id: meetingId,
                status: "ACTIVE",
                startedAt: now,
                endsAt: now + meetingDurationMs,
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

