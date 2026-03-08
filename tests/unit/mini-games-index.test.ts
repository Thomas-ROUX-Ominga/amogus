import { describe, it, expect } from "vitest";
import { AVAILABLE_MINI_GAMES } from "@/lib/mini-games";

describe("mini-games registry", () => {
    it("keeps mini-bac and simon available while adding wires", () => {
        expect(AVAILABLE_MINI_GAMES).toContain("mini-bac");
        expect(AVAILABLE_MINI_GAMES).toContain("simon");
        expect(AVAILABLE_MINI_GAMES).toContain("wires");
    });
});
