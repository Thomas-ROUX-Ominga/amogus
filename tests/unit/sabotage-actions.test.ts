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
        mockAtomicUpdate(expiredState);

        const result = await refreshGame("game-1");

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe("FINISHED");
        expect(result.data?.winner).toBe("IMPOSTOR");
    });
});
