import { describe, it, expect, vi } from "vitest";
import { ALL_MINI_GAMES, AVAILABLE_MINI_GAMES, DISABLED_MINI_GAMES, getRandomMiniGame } from "@/lib/mini-games";

describe("mini-games registry", () => {
    it("keeps mini-bac known but disabled", () => {
        expect(ALL_MINI_GAMES).toContain("mini-bac");
        expect(DISABLED_MINI_GAMES).toContain("mini-bac");
        expect(AVAILABLE_MINI_GAMES).not.toContain("mini-bac");
    });

    it("keeps the remaining mini-games available", () => {
        expect(AVAILABLE_MINI_GAMES).toContain("simon");
        expect(AVAILABLE_MINI_GAMES).toContain("wires");
        expect(AVAILABLE_MINI_GAMES).toContain("gauges");
        expect(AVAILABLE_MINI_GAMES).toContain("pad");
        expect(AVAILABLE_MINI_GAMES).toContain("memory");
        expect(AVAILABLE_MINI_GAMES).toContain("rings");
    });

    it("never draws mini-bac as the random mini-game", () => {
        for (let i = 0; i < AVAILABLE_MINI_GAMES.length; i += 1) {
            vi.spyOn(Math, "random").mockReturnValue(i / AVAILABLE_MINI_GAMES.length);
            expect(getRandomMiniGame()).not.toBe("mini-bac");
            vi.restoreAllMocks();
        }
    });
});
