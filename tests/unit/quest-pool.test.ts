import { describe, it, expect } from "vitest";
import { getQuestGamesByDuration, getRandomQuestGame, getQuestGameById, isValidDuration, getTotalQuestGamesCount } from "@/lib/constants/quest-pool";
import { QuestDuration, QuestType, QuestGame } from "@/types/quest";

describe("quest-pool", () => {
    describe("getQuestGamesByDuration", () => {
        it("should return quest games for 'short' duration", () => {
            const games = getQuestGamesByDuration("short");
            expect(games.length).toBeGreaterThanOrEqual(2);
            games.forEach((g) => expect(g.duration).toBe("short"));
        });

        it("should return quest games for 'medium' duration", () => {
            const games = getQuestGamesByDuration("medium");
            expect(games.length).toBeGreaterThanOrEqual(2);
            games.forEach((g) => expect(g.duration).toBe("medium"));
        });

        it("should return quest games for 'long' duration", () => {
            const games = getQuestGamesByDuration("long");
            expect(games.length).toBeGreaterThanOrEqual(2);
            games.forEach((g) => expect(g.duration).toBe("long"));
        });

        it("should return typed QuestGame objects with required fields", () => {
            const games = getQuestGamesByDuration("short");
            games.forEach((g) => {
                expect(g).toHaveProperty("id");
                expect(g).toHaveProperty("type");
                expect(g).toHaveProperty("duration");
                expect(g).toHaveProperty("title");
                expect(g).toHaveProperty("instruction");
            });
        });

        it("should include both true-false and qcm quest types across all pools", () => {
            const allGames = [
                ...getQuestGamesByDuration("short"),
                ...getQuestGamesByDuration("medium"),
                ...getQuestGamesByDuration("long"),
            ];
            const types = new Set(allGames.map((g) => g.type));
            expect(types.has("true-false")).toBe(true);
            expect(types.has("qcm")).toBe(true);
        });
    });

    describe("getRandomQuestGame", () => {
        it("should return a quest game for valid type and duration", () => {
            const game = getRandomQuestGame("true-false", "short");
            expect(game).not.toBeNull();
            expect(game!.duration).toBe("short");
            expect(game!.type).toBe("true-false");
        });

        it("should return a quest game with all required fields", () => {
            const game = getRandomQuestGame("qcm", "medium");
            expect(game).not.toBeNull();
            expect(game!.id).toBeTruthy();
            expect(game!.title).toBeTruthy();
            expect(game!.instruction).toBeTruthy();
            expect(game!.type).toBeTruthy();
            expect(game!.duration).toBeTruthy();
        });

        it("should return null for type with no matching games", () => {
            const game = getRandomQuestGame("form" as QuestType, "short");
            expect(game).toBeNull();
        });
    });

    describe("getQuestGameById", () => {
        it("should return a quest game for valid ID", () => {
            const validId = getQuestGamesByDuration("short")[0].id;
            const game = getQuestGameById(validId);
            expect(game).not.toBeNull();
            expect(game!.id).toBe(validId);
        });

        it("should return undefined for invalid ID", () => {
            const game = getQuestGameById("invalid-id");
            expect(game).toBeUndefined();
        });
    });

    describe("empty quest game pool handling", () => {
        it("should return empty array for an unknown duration key via nullish coalescing", () => {
            const games = getQuestGamesByDuration("nonexistent" as QuestDuration);
            expect(games).toEqual([]);
        });

        it("should return null from getRandomQuestGame for an unknown duration key", () => {
            const game = getRandomQuestGame("true-false", "nonexistent" as QuestDuration);
            expect(game).toBeNull();
        });
    });

    describe("quest game data model — data fields", () => {
        it("should have data object on all quest games", () => {
            const allGames = [
                ...getQuestGamesByDuration("short"),
                ...getQuestGamesByDuration("medium"),
                ...getQuestGamesByDuration("long"),
            ];
            allGames.forEach((g) => {
                expect(g.data).toBeDefined();
            });
        });

        it("should have choices and answerIds for true-false, qcm and intrus", () => {
            const allGames = [
                ...getQuestGamesByDuration("short"),
                ...getQuestGamesByDuration("medium"),
                ...getQuestGamesByDuration("long"),
            ];
            allGames.filter(g => ["true-false", "qcm", "intrus"].includes(g.type)).forEach((g) => {
                const quest = g as Extract<QuestGame, { type: "true-false" | "qcm" | "intrus" }>;
                expect(quest.data.choices).toBeDefined();
                expect(Array.isArray(quest.data.choices)).toBe(true);
                expect(quest.data.choices.length).toBeGreaterThanOrEqual(2);
                expect(quest.data.answerIds).toBeDefined();
                expect(Array.isArray(quest.data.answerIds)).toBe(true);
            });
        });

        it("should have exactly 2 choices for true-false quest games", () => {
            const allGames = [
                ...getQuestGamesByDuration("short"),
                ...getQuestGamesByDuration("medium"),
                ...getQuestGamesByDuration("long"),
            ];
            allGames.filter((g) => g.type === "true-false").forEach((g) => {
                const quest = g as Extract<QuestGame, { type: "true-false" }>;
                expect(quest.data.choices.length).toBe(2);
                const values = quest.data.choices.map((o) => o.id);
                expect(values).toContain("true");
                expect(values).toContain("false");
            });
        });

        it("should have 4 choices for qcm quest games", () => {
            const allGames = [
                ...getQuestGamesByDuration("short"),
                ...getQuestGamesByDuration("medium"),
                ...getQuestGamesByDuration("long"),
            ];
            allGames.filter((g) => g.type === "qcm").forEach((g) => {
                const quest = g as Extract<QuestGame, { type: "qcm" }>;
                expect(quest.data.choices.length).toBe(4);
            });
        });
    });

    describe("getTotalQuestGamesCount", () => {
        it("should return total count of all quest games", () => {
            const count = getTotalQuestGamesCount();
            const expectedCount =
                getQuestGamesByDuration("short").length +
                getQuestGamesByDuration("medium").length +
                getQuestGamesByDuration("long").length;
            expect(count).toBeGreaterThan(0);
            expect(count).toBe(expectedCount);
        });
    });

    describe("isValidDuration", () => {
        it("should return true for 'short'", () => {
            expect(isValidDuration("short")).toBe(true);
        });

        it("should return true for 'medium'", () => {
            expect(isValidDuration("medium")).toBe(true);
        });

        it("should return true for 'long'", () => {
            expect(isValidDuration("long")).toBe(true);
        });

        it("should return false for null", () => {
            expect(isValidDuration(null)).toBe(false);
        });

        it("should return false for empty string", () => {
            expect(isValidDuration("")).toBe(false);
        });

        it("should return false for invalid value", () => {
            expect(isValidDuration("extra-long")).toBe(false);
        });

        it("should return false for uppercase values", () => {
            expect(isValidDuration("SHORT")).toBe(false);
        });
    });
});
