import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis/client", () => ({
    GAME_TTL_SECONDS: 86400,
    redis: {
        set: vi.fn(),
        get: vi.fn(),
        del: vi.fn(),
        keys: vi.fn(),
        atomicUpdate: vi.fn(),
    },
}));

vi.mock("@/lib/redis/auth-utils", () => ({
    verifySession: vi.fn().mockResolvedValue({
        success: true,
        data: { userId: "admin", username: "admin" },
    }),
    createPlayerSession: vi.fn().mockResolvedValue({ success: true }),
    verifyPlayerSession: vi.fn().mockResolvedValue({ success: true }),
}));

import { redis } from "@/lib/redis/client";
import { verifyPlayerSession } from "@/lib/redis/auth-utils";
import { refreshGame, scanSabotage, triggerSabotage } from "@/lib/redis/actions";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { GameState } from "@/types/game";

function mockAtomicUpdate(state: GameState) {
    vi.mocked(redis.get).mockResolvedValueOnce(state);
    vi.mocked(redis.atomicUpdate).mockImplementationOnce(async (_key, updater) => {
        const result = updater(state);
        return (result ?? state) as GameState;
    });
}

describe("Sabotage actions", () => {
    const baseState: GameState = {
        id: "game-1",
        status: "IN_PROGRESS",
        createdAt: Date.now(),
       revision: 1,
       updatedAt: Date.now(),
        players: [
            { id: "imp-1", name: "Impostor", role: "IMPOSTOR", isAlive: true },
            { id: "crew-1", name: "Crewmate", role: "CREWMATE", isAlive: true },
            { id: "crew-2", name: "Crewmate2", role: "CREWMATE", isAlive: true },
        ],
        sabotages: {
            communications: { qrId: "comms-qr", location: "Hall" },
            lights: { qrId: "lights-qr", location: "Electrical" },
            reactor: [
                { qrId: "reactor-a", location: "Garage" },
                { qrId: "reactor-b", location: "Kitchen" },
            ],
        },
        sabotageState: {
            active: null,
            reactor: null,
            cooldowns: {
                communicationsAvailableAt: 0,
                lightsAvailableAt: 0,
                reactorAvailableAt: 0,
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(verifyPlayerSession).mockResolvedValue({ success: true });
    });

    it("returns handled=false when scanned QR is not a sabotage QR", async () => {
        mockAtomicUpdate(baseState);

        const result = await scanSabotage("game-1", "imp-1", "quest-qr");

        expect(result.success).toBe(true);
        expect(result.data?.handled).toBe(false);
    });

    it("allows alive impostor to activate communications sabotage via trigger action", async () => {
        mockAtomicUpdate(baseState);

        const result = await triggerSabotage("game-1", "imp-1", "COMMUNICATIONS");

        expect(result.success).toBe(true);
        expect(result.data?.event).toBe("COMMUNICATIONS_ACTIVATED");
        expect(result.data?.gameState?.sabotageState?.active).toBe("COMMUNICATIONS");
    });

    it("allows alive impostor to activate lights sabotage via trigger action", async () => {
        mockAtomicUpdate(baseState);

        const result = await triggerSabotage("game-1", "imp-1", "LIGHTS");

        expect(result.success).toBe(true);
        expect(result.data?.event).toBe("LIGHTS_ACTIVATED");
        expect(result.data?.gameState?.sabotageState?.active).toBe("LIGHTS");
    });

    it("blocks sabotage trigger during post-meeting grace window", async () => {
        const state: GameState = {
            ...baseState,
            meeting: {
                id: "meeting-prev",
                status: "COMPLETED",
                startedAt: Date.now() - 45_000,
                endsAt: Date.now() - 10_000,
                startedBy: "imp-1",
                snapshot: {
                    capturedAt: Date.now() - 45_000,
                    progress: { completed: 0, total: 3, percentage: 0 },
                    players: [
                        { id: "imp-1", name: "Impostor", role: "IMPOSTOR", isAlive: true },
                        { id: "crew-1", name: "Crewmate", role: "CREWMATE", isAlive: true },
                        { id: "crew-2", name: "Crewmate2", role: "CREWMATE", isAlive: true },
                    ],
                },
                eligibleVoterIds: ["imp-1", "crew-1", "crew-2"],
                voteCounts: { "imp-1": 0, "crew-1": 0, "crew-2": 0 },
                totalEligibleVoters: 3,
                totalVotes: 0,
                endReason: "TIMEOUT",
                endedAt: Date.now() - 10_000,
            },
        };
        mockAtomicUpdate(state);

        const result = await triggerSabotage("game-1", "imp-1", "COMMUNICATIONS");

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_SABOTAGE_BLOCKED_BY_POST_MEETING_GRACE);
    });

    it("allows sabotage trigger once post-meeting grace window is over", async () => {
        const state: GameState = {
            ...baseState,
            meeting: {
                id: "meeting-prev",
                status: "COMPLETED",
                startedAt: Date.now() - 120_000,
                endsAt: Date.now() - 61_000,
                startedBy: "imp-1",
                snapshot: {
                    capturedAt: Date.now() - 120_000,
                    progress: { completed: 0, total: 3, percentage: 0 },
                    players: [
                        { id: "imp-1", name: "Impostor", role: "IMPOSTOR", isAlive: true },
                        { id: "crew-1", name: "Crewmate", role: "CREWMATE", isAlive: true },
                        { id: "crew-2", name: "Crewmate2", role: "CREWMATE", isAlive: true },
                    ],
                },
                eligibleVoterIds: ["imp-1", "crew-1", "crew-2"],
                voteCounts: { "imp-1": 0, "crew-1": 0, "crew-2": 0 },
                totalEligibleVoters: 3,
                totalVotes: 0,
                endReason: "TIMEOUT",
                endedAt: Date.now() - 61_000,
            },
        };
        mockAtomicUpdate(state);

        const result = await triggerSabotage("game-1", "imp-1", "COMMUNICATIONS");

        expect(result.success).toBe(true);
        expect(result.data?.event).toBe("COMMUNICATIONS_ACTIVATED");
    });

    it("uses custom timer settings for grace, sabotage duration and cooldown", async () => {
        const now = Date.now();
        const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

        const customTimersState: GameState = {
            ...baseState,
            timerSettings: {
                meetingDurationSeconds: 300,
                postMeetingGraceSeconds: 5,
                sabotageDurationSeconds: 25,
                sabotageCooldownSeconds: 40,
            },
            meeting: {
                id: "meeting-custom",
                status: "COMPLETED",
                startedAt: now - 30_000,
                endsAt: now - 10_000,
                startedBy: "imp-1",
                snapshot: {
                    capturedAt: now - 30_000,
                    progress: { completed: 0, total: 3, percentage: 0 },
                    players: [
                        { id: "imp-1", name: "Impostor", role: "IMPOSTOR", isAlive: true },
                        { id: "crew-1", name: "Crewmate", role: "CREWMATE", isAlive: true },
                        { id: "crew-2", name: "Crewmate2", role: "CREWMATE", isAlive: true },
                    ],
                },
                eligibleVoterIds: ["imp-1", "crew-1", "crew-2"],
                voteCounts: { "imp-1": 0, "crew-1": 0, "crew-2": 0 },
                totalEligibleVoters: 3,
                totalVotes: 0,
                endReason: "TIMEOUT",
                endedAt: now - 10_000,
            },
        };

        mockAtomicUpdate(customTimersState);
        const commsResult = await triggerSabotage("game-1", "imp-1", "COMMUNICATIONS");
        expect(commsResult.success).toBe(true);
        expect(commsResult.data?.event).toBe("COMMUNICATIONS_ACTIVATED");

        const reactorTriggerState: GameState = {
            ...baseState,
            timerSettings: customTimersState.timerSettings,
        };
        mockAtomicUpdate(reactorTriggerState);
        const reactorResult = await triggerSabotage("game-1", "imp-1", "REACTOR");
        expect(reactorResult.success).toBe(true);
        expect(reactorResult.data?.reactorProgress?.remainingMs).toBe(25_000);
        expect(reactorResult.data?.gameState?.sabotageState?.reactor?.endsAt).toBe(now + 25_000);

        const commsActiveState: GameState = {
            ...baseState,
            timerSettings: customTimersState.timerSettings,
            sabotageState: {
                ...baseState.sabotageState!,
                active: "COMMUNICATIONS",
            },
        };
        mockAtomicUpdate(commsActiveState);
        const repairResult = await scanSabotage("game-1", "crew-1", "comms-qr");
        expect(repairResult.success).toBe(true);
        expect(repairResult.data?.gameState?.sabotageState?.cooldowns.communicationsAvailableAt).toBe(now + 40_000);

        dateNowSpy.mockRestore();
    });

    it("allows alive crewmate to repair communications when active", async () => {
        const state: GameState = {
            ...baseState,
            sabotageState: {
                ...baseState.sabotageState!,
                active: "COMMUNICATIONS",
            },
        };
        mockAtomicUpdate(state);

        const result = await scanSabotage("game-1", "crew-1", "comms-qr");

        expect(result.success).toBe(true);
        expect(result.data?.event).toBe("COMMUNICATIONS_REPAIRED");
        expect(result.data?.gameState?.sabotageState?.active).toBeNull();
        expect(
            (result.data?.gameState?.sabotageState?.cooldowns.communicationsAvailableAt ?? 0) > Date.now(),
        ).toBe(true);
    });

    it("allows alive impostor to repair communications when active", async () => {
        const state: GameState = {
            ...baseState,
            sabotageState: {
                ...baseState.sabotageState!,
                active: "COMMUNICATIONS",
            },
        };
        mockAtomicUpdate(state);

        const result = await scanSabotage("game-1", "imp-1", "comms-qr");

        expect(result.success).toBe(true);
        expect(result.data?.event).toBe("COMMUNICATIONS_REPAIRED");
        expect(result.data?.gameState?.sabotageState?.active).toBeNull();
    });

    it("prevents triggering reactor while another sabotage is active", async () => {
        const state: GameState = {
            ...baseState,
            sabotageState: {
                ...baseState.sabotageState!,
                active: "COMMUNICATIONS",
            },
        };
        mockAtomicUpdate(state);

        const result = await triggerSabotage("game-1", "imp-1", "REACTOR");

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_SABOTAGE_ALREADY_ACTIVE);
    });

    it("prevents same crewmate from validating both reactor QR codes", async () => {
        const state: GameState = {
            ...baseState,
            sabotageState: {
                ...baseState.sabotageState!,
                active: "REACTOR",
                reactor: {
                    startedAt: Date.now() - 5000,
                    endsAt: Date.now() + 60000,
                    scannedByQrId: ["reactor-a"],
                    scannedUserIds: ["crew-1"],
                },
            },
        };
        mockAtomicUpdate(state);

        const result = await scanSabotage("game-1", "crew-1", "reactor-b");

        expect(result.success).toBe(true);
        expect(result.data?.handled).toBe(true);
        expect(result.data?.event).toBe("REACTOR_DISTINCT_CREWMATE_REQUIRED");
    });

    it("finishes game with impostor win when reactor timer expires", async () => {
        const expiredState: GameState = {
            ...baseState,
            sabotageState: {
                ...baseState.sabotageState!,
                active: "REACTOR",
                reactor: {
                    startedAt: Date.now() - 120000,
                    endsAt: Date.now() - 1000,
                    scannedByQrId: [],
                    scannedUserIds: [],
                },
            },
        };
        vi.mocked(redis.get).mockResolvedValueOnce(expiredState);
        mockAtomicUpdate(expiredState);

        const result = await refreshGame("game-1");

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe("FINISHED");
        expect(result.data?.winner).toBe("IMPOSTOR");
    });

    it("falls back to latest state when refresh hits watch contention", async () => {
        const watchError = Object.assign(
            new Error("One (or more) of the watched keys has been changed"),
            { name: "WatchError" }
        );

        vi.mocked(redis.atomicUpdate).mockRejectedValueOnce(watchError);
        vi.mocked(redis.get).mockResolvedValueOnce(baseState);

        const result = await refreshGame("game-1");

        expect(result.success).toBe(true);
        expect(result.data).toEqual(baseState);
        expect(redis.get).toHaveBeenCalledWith("game:v2:game-1:state");
    });
});
