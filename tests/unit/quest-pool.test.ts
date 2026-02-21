import { describe, it, expect } from "vitest";
import { getQuestGamesByDuration, getRandomQuestGame, getQuestGameById, isValidDuration, getTotalQuestGamesCount } from "@/lib/constants/quest-pool";
import { QuestDuration, QuestType } from "@/types/quest";

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
            const game = getQuestGameById("s1");
            expect(game).not.toBeNull();
            expect(game!.id).toBe("s1");
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

    describe("quest game data model — options and answer fields", () => {
        it("should have options array on all quest games", () => {
            const allGames = [
                ...getQuestGamesByDuration("short"),
                ...getQuestGamesByDuration("medium"),
                ...getQuestGamesByDuration("long"),
            ];
            allGames.forEach((g) => {
                expect(g.options).toBeDefined();
                expect(Array.isArray(g.options)).toBe(true);
                expect(g.options!.length).toBeGreaterThanOrEqual(2);
            });
        });

        it("should have answer field on all quest games", () => {
            const allGames = [
                ...getQuestGamesByDuration("short"),
                ...getQuestGamesByDuration("medium"),
                ...getQuestGamesByDuration("long"),
            ];
            allGames.forEach((g) => {
                expect(g.answer).toBeDefined();
                expect(typeof g.answer).toBe("string");
                expect(g.answer!.length).toBeGreaterThan(0);
            });
        });

        it("should have options with label and value on all quest games", () => {
            const allGames = [
                ...getQuestGamesByDuration("short"),
                ...getQuestGamesByDuration("medium"),
                ...getQuestGamesByDuration("long"),
            ];
            allGames.forEach((g) => {
                g.options!.forEach((opt) => {
                    expect(opt).toHaveProperty("label");
                    expect(opt).toHaveProperty("value");
                    expect(typeof opt.label).toBe("string");
                    expect(typeof opt.value).toBe("string");
                });
            });
        });

        it("should have answer matching one of the option values", () => {
            const allGames = [
                ...getQuestGamesByDuration("short"),
                ...getQuestGamesByDuration("medium"),
                ...getQuestGamesByDuration("long"),
            ];
            allGames.forEach((g) => {
                const optionValues = g.options!.map((o) => o.value);
                expect(optionValues).toContain(g.answer);
            });
        });

        it("should have exactly 2 options for true-false quest games", () => {
            const allGames = [
                ...getQuestGamesByDuration("short"),
                ...getQuestGamesByDuration("medium"),
                ...getQuestGamesByDuration("long"),
            ];
            allGames.filter((g) => g.type === "true-false").forEach((g) => {
                expect(g.options!.length).toBe(2);
                const values = g.options!.map((o) => o.value);
                expect(values).toContain("true");
                expect(values).toContain("false");
            });
        });

        it("should have 4 options for qcm quest games", () => {
            const allGames = [
                ...getQuestGamesByDuration("short"),
                ...getQuestGamesByDuration("medium"),
                ...getQuestGamesByDuration("long"),
            ];
            allGames.filter((g) => g.type === "qcm").forEach((g) => {
                expect(g.options!.length).toBe(4);
            });
        });
    });

    describe("getTotalQuestGamesCount", () => {
        it("should return total count of all quest games", () => {
            const count = getTotalQuestGamesCount();
            expect(count).toBeGreaterThan(0);
            expect(count).toBe(9); // 3 games each for short, medium, long
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
