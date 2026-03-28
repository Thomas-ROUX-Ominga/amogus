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

function getClassicTypeCountsForBatch(batch: ReturnType<typeof generateBatch>) {
  const classics = batch.quests.filter((q) => q.type !== "mini-game");
  return getClassicTypeCounts(classics);
}

function getClassicDistributionGap(typeCounts: Record<string, number>) {
  const counts = Object.values(typeCounts);
  if (counts.length === 0) return 0;
  return Math.max(...counts) - Math.min(...counts);
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

    it("should distribute classic quest types as evenly as possible globally", () => {
      const input: BatchCreateInput = { totalQuests: 30 };
      const batch = generateBatch(input);
      const typeCounts = getClassicTypeCountsForBatch(batch);
      const counts = Object.values(typeCounts);

      expect(counts.reduce((sum, count) => sum + count, 0)).toBe(21);
      expect(Object.keys(typeCounts)).toHaveLength(5);
      expect(getClassicDistributionGap(typeCounts)).toBeLessThanOrEqual(1);
    });

    it("should remain deterministic in quest type/duration sequence", () => {
      const input: BatchCreateInput = { totalQuests: 31 };
      const batchA = generateBatch(input);
      const batchB = generateBatch(input);

      const signatureA = batchA.quests.map((q) => `${q.duration}:${q.type}`);
      const signatureB = batchB.quests.map((q) => `${q.duration}:${q.type}`);
      expect(signatureA).toEqual(signatureB);
    });

    it("should vary deterministic classic rotation with different names while staying balanced", () => {
      const batchA = generateBatch({ totalQuests: 30, name: "A" });
      const batchB = generateBatch({ totalQuests: 30, name: "B" });

      const signatureA = batchA.quests.map((q) => `${q.duration}:${q.type}`);
      const signatureB = batchB.quests.map((q) => `${q.duration}:${q.type}`);

      expect(signatureA).not.toEqual(signatureB);
      expect(getClassicDistributionGap(getClassicTypeCountsForBatch(batchA))).toBeLessThanOrEqual(1);
      expect(getClassicDistributionGap(getClassicTypeCountsForBatch(batchB))).toBeLessThanOrEqual(1);
    });

    it("should keep 10-quest batches diversified with 4/3/3 durations and 1 mini-game per duration", () => {
      const batch = generateBatch({ totalQuests: 10 });

      const shortSummary = getDurationSummary(batch, "short");
      const mediumSummary = getDurationSummary(batch, "medium");
      const longSummary = getDurationSummary(batch, "long");

      expect(shortSummary.durationQuests).toHaveLength(4);
      expect(mediumSummary.durationQuests).toHaveLength(3);
      expect(longSummary.durationQuests).toHaveLength(3);

      expect(shortSummary.miniGames).toHaveLength(1);
      expect(mediumSummary.miniGames).toHaveLength(1);
      expect(longSummary.miniGames).toHaveLength(1);

      const classicTypeCounts = getClassicTypeCountsForBatch(batch);
      const repeatedTypes = Object.values(classicTypeCounts).filter((count) => count > 1);
      const totalClassicCount = Object.values(classicTypeCounts).reduce((sum, count) => sum + count, 0);

      expect(totalClassicCount).toBe(7);
      expect(Object.keys(classicTypeCounts)).toHaveLength(5);
      expect(repeatedTypes).toHaveLength(2);
      expect(Math.max(...Object.values(classicTypeCounts))).toBe(2);
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
