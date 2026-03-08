import { describe, it, expect } from "vitest";
import { AVAILABLE_MINI_GAMES } from "@/lib/mini-games";

describe("mini-games registry", () => {
    it("keeps all mini-games available while adding rings", () => {
        expect(AVAILABLE_MINI_GAMES).toContain("mini-bac");
        expect(AVAILABLE_MINI_GAMES).toContain("simon");
        expect(AVAILABLE_MINI_GAMES).toContain("wires");
        expect(AVAILABLE_MINI_GAMES).toContain("gauges");
        expect(AVAILABLE_MINI_GAMES).toContain("pad");
        expect(AVAILABLE_MINI_GAMES).toContain("memory");
        expect(AVAILABLE_MINI_GAMES).toContain("rings");
    });
});
