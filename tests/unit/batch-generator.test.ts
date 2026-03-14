import { describe, it, expect } from "vitest";
import { generateBatch } from "@/lib/quests/batch-generator";
import { BatchCreateInput, QuestType } from "@/types/quest";

function getDurationSummary(batch: ReturnType<typeof generateBatch>, duration: "short" | "medium" | "long") {
  const durationQuests = batch.quests.filter((q) => q.duration === duration);
  const miniGames = durationQuests.filter((q) => q.type === "mini-game");
  const classics = durationQuests.filter((q) => q.type !== "mini-game");
  return { durationQuests, miniGames, classics };
}

function getClassicTypeCounts(classics: Array<{ type: QuestType }>) {
  return classics.reduce<Record<string, number>>((acc, quest) => {
    acc[quest.type] = (acc[quest.type] ?? 0) + 1;
    return acc;
  }, {});
}

describe("Batch Generator", () => {
  describe("generateBatch", () => {
    it("should accept a single quest batch", () => {
      const input: BatchCreateInput = { totalQuests: 1 };
      const batch = generateBatch(input);

      expect(batch.questCount).toBe(1);
      expect(batch.quests).toHaveLength(1);
      expect(batch.quests[0].duration).toBe("short");
    });

    it("should split quests evenly by duration when possible", () => {
      const input: BatchCreateInput = { totalQuests: 30 };
      const batch = generateBatch(input);

      expect(batch.questCount).toBe(30);
      expect(batch.quests).toHaveLength(30);

      expect(getDurationSummary(batch, "short").durationQuests).toHaveLength(10);
      expect(getDurationSummary(batch, "medium").durationQuests).toHaveLength(10);
      expect(getDurationSummary(batch, "long").durationQuests).toHaveLength(10);
    });

    it("should enforce 1/3 mini-games (rounded down) per duration", () => {
      const input: BatchCreateInput = { totalQuests: 30 };
      const batch = generateBatch(input);

      const shortSummary = getDurationSummary(batch, "short");
      const mediumSummary = getDurationSummary(batch, "medium");
      const longSummary = getDurationSummary(batch, "long");

      expect(shortSummary.miniGames).toHaveLength(3);
      expect(mediumSummary.miniGames).toHaveLength(3);
      expect(longSummary.miniGames).toHaveLength(3);

      expect(shortSummary.classics).toHaveLength(7);
      expect(mediumSummary.classics).toHaveLength(7);
      expect(longSummary.classics).toHaveLength(7);
    });

    it("should distribute classic quest types as evenly as possible per duration", () => {
      const input: BatchCreateInput = { totalQuests: 30 };
      const batch = generateBatch(input);

      const expectedCounts = {
        "true-false": 2,
        qcm: 2,
        "single-input": 1,
        "number-input": 1,
        intrus: 1,
      };

      (["short", "medium", "long"] as const).forEach((duration) => {
        const { classics } = getDurationSummary(batch, duration);
        const typeCounts = getClassicTypeCounts(classics);

        expect(typeCounts["true-false"]).toBe(expectedCounts["true-false"]);
        expect(typeCounts.qcm).toBe(expectedCounts.qcm);
        expect(typeCounts["single-input"]).toBe(expectedCounts["single-input"]);
        expect(typeCounts["number-input"]).toBe(expectedCounts["number-input"]);
        expect(typeCounts.intrus).toBe(expectedCounts.intrus);
      });
    });

    it("should remain deterministic in quest type/duration sequence", () => {
      const input: BatchCreateInput = { totalQuests: 31 };
      const batchA = generateBatch(input);
      const batchB = generateBatch(input);

      const signatureA = batchA.quests.map((q) => `${q.duration}:${q.type}`);
      const signatureB = batchB.quests.map((q) => `${q.duration}:${q.type}`);
      expect(signatureA).toEqual(signatureB);
    });

    it("should generate default sabotage QR entries", () => {
      const input: BatchCreateInput = { totalQuests: 10 };
      const batch = generateBatch(input);

      expect(batch.sabotages).toBeDefined();
      expect(batch.sabotages?.communications.qrId).toBeTruthy();
      expect(batch.sabotages?.lights.qrId).toBeTruthy();
      expect(batch.sabotages?.reactor).toHaveLength(2);
      expect(batch.sabotages?.reactor[0].qrId).toBeTruthy();
      expect(batch.sabotages?.reactor[1].qrId).toBeTruthy();
    });

    it("should generate unique IDs for batch and all quests", () => {
      const input: BatchCreateInput = { totalQuests: 10 };
      const batch = generateBatch(input);

      expect(batch.id).toBeDefined();
      expect(batch.id).toMatch(/^[0-9a-f-]+$/);

      const questIds = batch.quests.map((q) => q.id);
      const uniqueQuestIds = new Set(questIds);
      expect(uniqueQuestIds.size).toBe(10);
      expect(questIds.every((id) => id.match(/^[0-9a-f-]+$/))).toBe(true);
    });

    it("should create quests with required structure", () => {
      const input: BatchCreateInput = { totalQuests: 5 };
      const batch = generateBatch(input);

      batch.quests.forEach((quest) => {
        expect(quest).toHaveProperty("id");
        expect(quest).toHaveProperty("type");
        expect(quest).toHaveProperty("duration");
        expect(typeof quest.id).toBe("string");
        expect(quest.id.length).toBeGreaterThan(0);
      });
    });

    it("should set createdAt timestamp", () => {
      const input: BatchCreateInput = { totalQuests: 5 };
      const batch = generateBatch(input);

      expect(batch.createdAt).toBeDefined();
      expect(new Date(batch.createdAt)).toBeInstanceOf(Date);
    });
  });
});
