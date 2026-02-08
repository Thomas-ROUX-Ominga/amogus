import { describe, it, expect } from "vitest";
import { getQuestsByDuration, getRandomQuest, isValidDuration } from "@/lib/constants/quest-pool";

describe("quest-pool", () => {
    describe("getQuestsByDuration", () => {
        it("should return quests for 'short' duration", () => {
            const quests = getQuestsByDuration("short");
            expect(quests.length).toBeGreaterThanOrEqual(2);
            quests.forEach((q) => expect(q.duration).toBe("short"));
        });

        it("should return quests for 'medium' duration", () => {
            const quests = getQuestsByDuration("medium");
            expect(quests.length).toBeGreaterThanOrEqual(2);
            quests.forEach((q) => expect(q.duration).toBe("medium"));
        });

        it("should return quests for 'long' duration", () => {
            const quests = getQuestsByDuration("long");
            expect(quests.length).toBeGreaterThanOrEqual(2);
            quests.forEach((q) => expect(q.duration).toBe("long"));
        });

        it("should return typed Quest objects with required fields", () => {
            const quests = getQuestsByDuration("short");
            quests.forEach((q) => {
                expect(q).toHaveProperty("id");
                expect(q).toHaveProperty("type");
                expect(q).toHaveProperty("duration");
                expect(q).toHaveProperty("title");
                expect(q).toHaveProperty("instruction");
            });
        });

        it("should include both true-false and qcm quest types across all pools", () => {
            const allQuests = [
                ...getQuestsByDuration("short"),
                ...getQuestsByDuration("medium"),
                ...getQuestsByDuration("long"),
            ];
            const types = new Set(allQuests.map((q) => q.type));
            expect(types.has("true-false")).toBe(true);
            expect(types.has("qcm")).toBe(true);
        });
    });

    describe("getRandomQuest", () => {
        it("should return a quest for valid duration", () => {
            const quest = getRandomQuest("short");
            expect(quest).not.toBeNull();
            expect(quest!.duration).toBe("short");
        });

        it("should return a quest with all required fields", () => {
            const quest = getRandomQuest("medium");
            expect(quest).not.toBeNull();
            expect(quest!.id).toBeTruthy();
            expect(quest!.title).toBeTruthy();
            expect(quest!.instruction).toBeTruthy();
            expect(quest!.type).toBeTruthy();
        });
    });

    describe("empty quest pool handling", () => {
        it("should return empty array for an unknown duration key via nullish coalescing", () => {
            // getQuestsByDuration uses `?? []` — any key not in the pool returns []
            const quests = getQuestsByDuration("nonexistent" as import("@/types/quest").QuestDuration);
            expect(quests).toEqual([]);
        });

        it("should return null from getRandomQuest for an unknown duration key", () => {
            // Exercises the null return path: empty array → length 0 → return null
            const quest = getRandomQuest("nonexistent" as import("@/types/quest").QuestDuration);
            expect(quest).toBeNull();
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
