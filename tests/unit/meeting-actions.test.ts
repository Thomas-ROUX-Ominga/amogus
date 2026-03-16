import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameState } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";

vi.mock("@/lib/redis/client", () => {
    const memory = new Map<string, unknown>();

    const clone = <T>(value: T): T => structuredClone(value);

    return {
        GAME_TTL_SECONDS: 86400,
        redis: {
            get: vi.fn(async <T>(key: string): Promise<T | null> => {
                if (!memory.has(key)) return null;
                return clone(memory.get(key) as T);
            }),
            set: vi.fn(async (key: string, value: unknown) => {
                memory.set(key, clone(value));
                return "OK";
            }),
            del: vi.fn(async (key: string) => {
                const existed = memory.delete(key);
                return existed ? 1 : 0;
            }),
            keys: vi.fn(async () => []),
            exists: vi.fn(async (key: string) => (memory.has(key) ? 1 : 0)),
            atomicUpdate: vi.fn(async <T>(key: string, updater: (current: T | null) => T | null) => {
                const current = memory.has(key) ? clone(memory.get(key) as T) : null;
                const updated = updater(current);
                if (updated === null) {
                    return current;
                }
                memory.set(key, clone(updated));
                return clone(updated);
            }),
        },
        __resetRedisMock: () => memory.clear(),
    };
});

vi.mock("@/lib/redis/auth-utils", () => ({
    verifyPlayerSession: vi.fn(async () => ({ success: true })),
    verifySession: vi.fn(async () => ({
        success: true,
        data: { userId: "admin", username: "admin", role: "organizer" },
    })),
    createPlayerSession: vi.fn(async () => ({ success: true })),
}));

import { redis } from "@/lib/redis/client";
import { createPlayerSession, verifyPlayerSession, verifySession } from "@/lib/redis/auth-utils";
import { triggerMeeting, castMeetingVote, getMeetingView, cancelMeetingVote } from "@/lib/redis/actions";
import * as redisClientModule from "@/lib/redis/client";

const gameId = "game-meeting";
const stateKey = `game:v2:${gameId}:state`;

const baseGameState = (): GameState => ({
    id: gameId,
    status: "IN_PROGRESS",
    createdAt: Date.now(),
   revision: 1,
   updatedAt: Date.now(),
    players: [
        { id: "admin", name: "Admin", isAlive: true },
        { id: "u1", name: "Alice", role: "CREWMATE", isAlive: true, completedQuests: [] },
        { id: "u2", name: "Bob", role: "IMPOSTOR", isAlive: true, completedQuests: [] },
        { id: "u3", name: "Chloe", role: "CREWMATE", isAlive: true, completedQuests: [] },
    ],
});

describe("meeting actions", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.mocked(verifySession).mockResolvedValue({
            success: true,
            data: { userId: "admin", username: "admin", role: "organizer" },
        });
        vi.mocked(verifyPlayerSession).mockResolvedValue({ success: true });
        vi.mocked(createPlayerSession).mockResolvedValue({ success: true });
        (redisClientModule as unknown as { __resetRedisMock: () => void }).__resetRedisMock();
        await redis.set(stateKey, baseGameState());
    });

    it("auto-recovers organizer player-session to open meeting view", async () => {
        vi.mocked(verifyPlayerSession)
            .mockResolvedValueOnce({ success: false, error: "No player session found", code: "ERR_NO_SESSION" })
            .mockResolvedValueOnce({ success: true });

        const result = await getMeetingView(gameId, "admin");

        expect(result.success).toBe(true);
        expect(createPlayerSession).toHaveBeenCalledWith("admin", gameId);
    });

    it("auto-recovers missing player-session and allows meeting vote", async () => {
        vi.mocked(verifySession).mockResolvedValue({
            success: false,
            error: "No session",
            code: "ERR_NO_SESSION",
        });
        vi.mocked(verifyPlayerSession)
            .mockResolvedValueOnce({ success: false, error: "No player session found", code: "ERR_NO_SESSION" })
            .mockResolvedValueOnce({ success: true })
            .mockResolvedValue({ success: true });

        const meeting = await triggerMeeting(gameId, "u1");
        expect(meeting.success).toBe(true);

        const vote = await castMeetingVote(gameId, "u1", "u2");
        expect(vote.success).toBe(true);
        expect(createPlayerSession).toHaveBeenCalledWith("u1", gameId);
    });

    it("starts a meeting and consumes caller buzzer", async () => {
        const result = await triggerMeeting(gameId, "u1");

        expect(result.success).toBe(true);
        expect(result.data?.meeting?.status).toBe("ACTIVE");
        expect(result.data?.meeting?.totalEligibleVoters).toBe(3);

        const state = await redis.get<GameState>(stateKey);
        const caller = state?.players.find((player) => player.id === "u1");
        expect(caller?.meetingBuzzUsedAt).toBeTypeOf("number");
        expect(state?.meeting?.voteCounts).toEqual({
            u1: 0,
            u2: 0,
            u3: 0,
        });
    });

    it("blocks crewmate buzzer when communications sabotage is active", async () => {
        const state = await redis.get<GameState>(stateKey);
        await redis.set(stateKey, {
            ...state!,
            sabotageState: {
                active: "COMMUNICATIONS",
                reactor: null,
                cooldowns: {
                    communicationsAvailableAt: 0,
                    lightsAvailableAt: 0,
                    reactorAvailableAt: 0,
                },
            },
        });

        const result = await triggerMeeting(gameId, "u1");
        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_SABOTAGE_COMMUNICATIONS_ACTIVE);
    });

    it("allows a just-eliminated player to trigger buzzer until the next meeting", async () => {
        const now = Date.now();
        await redis.set(stateKey, {
            id: gameId,
            status: "IN_PROGRESS",
            createdAt: now,
            revision: 1,
            updatedAt: now,
            players: [
                { id: "admin", name: "Admin", isAlive: true },
                {
                    id: "u1",
                    name: "Alice",
                    role: "CREWMATE",
                    isAlive: false,
                    postEliminationBuzzerGrantedAt: now,
                },
                { id: "u2", name: "Bob", role: "IMPOSTOR", isAlive: true, completedQuests: [] },
                { id: "u3", name: "Chloe", role: "CREWMATE", isAlive: true, completedQuests: [] },
                { id: "u4", name: "Dina", role: "CREWMATE", isAlive: true, completedQuests: [] },
            ],
        });

        const result = await triggerMeeting(gameId, "u1");
        expect(result.success).toBe(true);
        expect(result.data?.meeting?.status).toBe("ACTIVE");
    });

    it("removes post-elimination buzzer access after a meeting has started", async () => {
        const grantAt = Date.now() - 10_000;
        const meetingStartedAt = Date.now() - 5_000;
        await redis.set(stateKey, {
            id: gameId,
            status: "IN_PROGRESS",
            createdAt: grantAt - 60_000,
            revision: 1,
            updatedAt: grantAt - 60_000,
            players: [
                { id: "admin", name: "Admin", isAlive: true },
                {
                    id: "u1",
                    name: "Alice",
                    role: "CREWMATE",
                    isAlive: false,
                    postEliminationBuzzerGrantedAt: grantAt,
                },
                { id: "u2", name: "Bob", role: "IMPOSTOR", isAlive: true, completedQuests: [] },
                { id: "u3", name: "Chloe", role: "CREWMATE", isAlive: true, completedQuests: [] },
                { id: "u4", name: "Dina", role: "CREWMATE", isAlive: true, completedQuests: [] },
            ],
            meeting: {
                id: "meeting-prev",
                status: "COMPLETED",
                startedAt: meetingStartedAt,
                endsAt: meetingStartedAt + 90_000,
                startedBy: "u2",
                snapshot: {
                    capturedAt: meetingStartedAt,
                    progress: { completed: 0, total: 3, percentage: 0 },
                    players: [
                        { id: "u1", name: "Alice", role: "CREWMATE", isAlive: true },
                        { id: "u2", name: "Bob", role: "IMPOSTOR", isAlive: true },
                        { id: "u3", name: "Chloe", role: "CREWMATE", isAlive: true },
                        { id: "u4", name: "Dina", role: "CREWMATE", isAlive: true },
                    ],
                },
                eligibleVoterIds: ["u2", "u3", "u4"],
                voteCounts: { u2: 0, u3: 0, u4: 0 },
                totalEligibleVoters: 3,
                totalVotes: 0,
                endReason: "TIMEOUT",
                endedAt: meetingStartedAt + 90_000,
            },
        });

        const result = await triggerMeeting(gameId, "u1");
        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_MEETING_FORBIDDEN);
    });

    it("rejects self-vote", async () => {
        await triggerMeeting(gameId, "u1");

        const result = await castMeetingVote(gameId, "u1", "u1");

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_MEETING_VOTE_INVALID);
    });

    it("resolves meeting when all eligible voters voted", async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
        await triggerMeeting(gameId, "u1");

        const firstVote = await castMeetingVote(gameId, "u1", "u2");
        expect(firstVote.success).toBe(true);
        expect(firstVote.data?.meeting?.status).toBe("ACTIVE");
        expect(firstVote.data?.myVoteTargetId).toBe("u2");

        const secondVote = await castMeetingVote(gameId, "u2", "u1");
        expect(secondVote.success).toBe(true);
        expect(secondVote.data?.meeting?.status).toBe("ACTIVE");

        const finalVote = await castMeetingVote(gameId, "u3", "u1");
        expect(finalVote.success).toBe(true);
        expect(finalVote.data?.meeting?.status).toBe("COMPLETED");
        expect(finalVote.data?.meeting?.endReason).toBe("ALL_VOTED");
        expect(
            Object.prototype.hasOwnProperty.call(finalVote.data?.meeting ?? {}, "votesByPlayer")
        ).toBe(false);

        const state = await redis.get<GameState>(stateKey);
        const eliminated = state?.players.find((player) => player.id === "u1");
        expect(eliminated?.isAlive).toBe(false);
        randomSpy.mockRestore();
    });

    it("breaks tie by randomly eliminating one of the top-voted players", async () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);
        await triggerMeeting(gameId, "u1");

        await castMeetingVote(gameId, "u1", "u2");
        await castMeetingVote(gameId, "u2", "u3");
        const finalVote = await castMeetingVote(gameId, "u3", "u1");

        expect(finalVote.success).toBe(true);
        expect(finalVote.data?.meeting?.status).toBe("COMPLETED");

        const state = await redis.get<GameState>(stateKey);
        const u1 = state?.players.find((player) => player.id === "u1");
        const u2 = state?.players.find((player) => player.id === "u2");
        const u3 = state?.players.find((player) => player.id === "u3");

        expect(u1?.isAlive).toBe(true);
        expect(u2?.isAlive).toBe(true);
        expect(u3?.isAlive).toBe(false);
        randomSpy.mockRestore();
    });

    it("can cancel a vote before meeting end", async () => {
        await triggerMeeting(gameId, "u1");
        await castMeetingVote(gameId, "u1", "u2");

        const canceled = await cancelMeetingVote(gameId, "u1");
        expect(canceled.success).toBe(true);
        expect(canceled.data?.myVoteTargetId).toBeNull();

        const state = await redis.get<GameState>(stateKey);
        expect(state?.meeting?.totalVotes).toBe(0);
        expect(state?.meeting?.voteCounts.u2).toBe(0);
    });

    it("resolves timed-out meeting with no elimination when there are no votes", async () => {
        await triggerMeeting(gameId, "u1");
        const state = await redis.get<GameState>(stateKey);
        await redis.set(stateKey, {
            ...state!,
            meeting: {
                ...state!.meeting!,
                endsAt: Date.now() - 1000,
            },
        });

        const view = await getMeetingView(gameId, "u1");
        expect(view.success).toBe(true);
        expect(view.data?.meeting?.status).toBe("COMPLETED");
        expect(view.data?.meeting?.endReason).toBe("TIMEOUT");
        expect(view.data?.meeting?.eliminatedPlayerId).toBeUndefined();
    });

    it("ends the game with CREWMATE victory when the last impostor is eliminated in meeting", async () => {
        const now = Date.now();
        await redis.set(stateKey, {
            id: gameId,
            status: "IN_PROGRESS",
            createdAt: now,
            revision: 1,
            updatedAt: now,
            players: [
                { id: "admin", name: "Admin", isAlive: true },
                { id: "u1", name: "Alice", role: "CREWMATE", isAlive: true, completedQuests: [] },
                { id: "u2", name: "Bob", role: "IMPOSTOR", isAlive: true, completedQuests: [] },
                { id: "u3", name: "Chloe", role: "CREWMATE", isAlive: true, completedQuests: [] },
            ],
        });

        const meeting = await triggerMeeting(gameId, "u1");
        expect(meeting.success).toBe(true);

        await castMeetingVote(gameId, "u1", "u2");
        await castMeetingVote(gameId, "u3", "u2");
        const finalVote = await castMeetingVote(gameId, "u2", "u1");
        expect(finalVote.success).toBe(true);

        const state = await redis.get<GameState>(stateKey);
        expect(state?.status).toBe("FINISHED");
        expect(state?.winner).toBe("CREWMATE");
        expect(state?.players.find((player) => player.id === "u2")?.isAlive).toBe(false);
    });
});
