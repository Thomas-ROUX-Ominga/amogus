import { Quest, Batch } from "@/types/quest";
import { getBatchData } from "@/lib/redis/batch-actions";
import { GameState } from "@/types/game";

export interface QuestAssignment {
  questId: string;
  questType: string;
  duration: 'short' | 'medium' | 'long';
}

type QuestDuration = Quest["duration"];

const DURATION_ORDER: QuestDuration[] = ["short", "medium", "long"];

function getQuestUsage(usageByQuestId: Record<string, number>, questId: string): number {
  return usageByQuestId[questId] ?? 0;
}

function pickRandomItem<T>(items: T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pickLeastUsedQuest(candidates: Quest[], usageByQuestId: Record<string, number>): Quest {
  const minUsage = candidates.reduce(
    (currentMin, quest) => Math.min(currentMin, getQuestUsage(usageByQuestId, quest.id)),
    Number.POSITIVE_INFINITY
  );
  const leastUsed = candidates.filter((quest) => getQuestUsage(usageByQuestId, quest.id) === minUsage);
  return pickRandomItem(leastUsed);
}

function buildQuestUsageMap(players: GameState["players"] | undefined, batchQuests: Quest[]): Record<string, number> {
  const usageByQuestId: Record<string, number> = {};
  const questById = new Map(batchQuests.map((quest) => [quest.id, quest]));
  const existingPlayers = Array.isArray(players) ? players : [];

  for (const player of existingPlayers) {
    if (!player.assignedQuests) {
      continue;
    }

    for (const assignedQuestId of player.assignedQuests) {
      if (!questById.has(assignedQuestId)) {
        continue;
      }
      usageByQuestId[assignedQuestId] = (usageByQuestId[assignedQuestId] ?? 0) + 1;
    }
  }

  return usageByQuestId;
}

function selectQuestByTypePriority(
  candidates: Quest[],
  seenTypes: Set<string>,
  usageByQuestId: Record<string, number>
): Quest {
  if (candidates.length === 0) {
    throw new Error("No quest candidates available for slot selection.");
  }

  const candidatesByType = candidates.reduce<Record<string, Quest[]>>((acc, quest) => {
    if (!acc[quest.type]) {
      acc[quest.type] = [];
    }
    acc[quest.type].push(quest);
    return acc;
  }, {});

  const typeEntries = Object.entries(candidatesByType);
  let bestTypeUsage = Number.POSITIVE_INFINITY;
  for (const [, typeCandidates] of typeEntries) {
    const minUsageForType = typeCandidates.reduce(
      (currentMin, quest) => Math.min(currentMin, getQuestUsage(usageByQuestId, quest.id)),
      Number.POSITIVE_INFINITY
    );
    bestTypeUsage = Math.min(bestTypeUsage, minUsageForType);
  }

  const bestUsageTypes = typeEntries.filter(([, typeCandidates]) => {
    const minUsageForType = typeCandidates.reduce(
      (currentMin, quest) => Math.min(currentMin, getQuestUsage(usageByQuestId, quest.id)),
      Number.POSITIVE_INFINITY
    );
    return minUsageForType === bestTypeUsage;
  });

  const unseenBestUsageTypes = bestUsageTypes.filter(([type]) => !seenTypes.has(type));
  const eligibleTypes = unseenBestUsageTypes.length > 0 ? unseenBestUsageTypes : bestUsageTypes;
  const [selectedType, selectedTypeCandidates] = pickRandomItem(eligibleTypes);

  const selectedQuest = pickLeastUsedQuest(selectedTypeCandidates, usageByQuestId);
  if (selectedQuest.type !== selectedType) {
    throw new Error("Quest type selection mismatch during assignment.");
  }

  return selectedQuest;
}

export function assignQuestsFromLoadedBatch(
  gameState: GameState,
  batch: Pick<Batch, "id" | "quests">
): QuestAssignment[] {
  if (!gameState.questsPerPlayer) {
    return [];
  }

  const distribution = gameState.questsPerPlayer;
  const totalRequested = distribution.short + distribution.medium + distribution.long;
  if (totalRequested <= 0) {
    return [];
  }

  const questsByDuration: Record<QuestDuration, Quest[]> = {
    short: batch.quests.filter((q) => q.duration === "short"),
    medium: batch.quests.filter((q) => q.duration === "medium"),
    long: batch.quests.filter((q) => q.duration === "long"),
  };

  for (const duration of DURATION_ORDER) {
    if (distribution[duration] > questsByDuration[duration].length) {
      throw new Error(
        `Insufficient ${duration} quests available. Requested ${distribution[duration]}, but only ${questsByDuration[duration].length} found in batch.`
      );
    }
  }

  // Build usage frequency from players already assigned in this game.
  const baseUsageByQuestId = buildQuestUsageMap(gameState.players, batch.quests);
  const usageByQuestId: Record<string, number> = { ...baseUsageByQuestId };

  // Guarantee at least one mini-game per player whenever quests are assigned.
  const miniGamesByDuration: Record<QuestDuration, Quest[]> = {
    short: questsByDuration.short.filter((q) => q.type === "mini-game"),
    medium: questsByDuration.medium.filter((q) => q.type === "mini-game"),
    long: questsByDuration.long.filter((q) => q.type === "mini-game"),
  };
  const eligibleMiniDurations = DURATION_ORDER.filter(
    (duration) => distribution[duration] > 0 && miniGamesByDuration[duration].length > 0
  );
  if (eligibleMiniDurations.length === 0) {
    throw new Error("No mini-game available for the configured quest distribution.");
  }

  const selectedByDuration: Record<QuestDuration, Quest[]> = {
    short: [],
    medium: [],
    long: [],
  };
  const selectedIds = new Set<string>();
  const seenTypes = new Set<string>();

  const forcedMiniDuration = pickRandomItem(eligibleMiniDurations);
  const forcedMiniGame = pickLeastUsedQuest(miniGamesByDuration[forcedMiniDuration], usageByQuestId);
  selectedByDuration[forcedMiniDuration].push(forcedMiniGame);
  selectedIds.add(forcedMiniGame.id);
  seenTypes.add(forcedMiniGame.type);
  usageByQuestId[forcedMiniGame.id] = getQuestUsage(usageByQuestId, forcedMiniGame.id) + 1;

  const remainingByDuration: Record<QuestDuration, number> = {
    short: distribution.short,
    medium: distribution.medium,
    long: distribution.long,
  };
  remainingByDuration[forcedMiniDuration] -= 1;

  const remainingSlots: QuestDuration[] = [];
  for (const duration of DURATION_ORDER) {
    for (let i = 0; i < remainingByDuration[duration]; i += 1) {
      remainingSlots.push(duration);
    }
  }

  for (const duration of shuffleArray(remainingSlots)) {
    const availableCandidates = questsByDuration[duration].filter((quest) => !selectedIds.has(quest.id));
    if (availableCandidates.length === 0) {
      throw new Error(
        `Insufficient ${duration} quests available after balancing. Requested ${distribution[duration]}, but only ${selectedByDuration[duration].length} could be selected.`
      );
    }

    const chosenQuest = selectQuestByTypePriority(availableCandidates, seenTypes, usageByQuestId);
    selectedByDuration[duration].push(chosenQuest);
    selectedIds.add(chosenQuest.id);
    seenTypes.add(chosenQuest.type);
    usageByQuestId[chosenQuest.id] = getQuestUsage(usageByQuestId, chosenQuest.id) + 1;
  }

  for (const duration of DURATION_ORDER) {
    if (selectedByDuration[duration].length !== distribution[duration]) {
      throw new Error(
        `Insufficient ${duration} quests available after balancing. Requested ${distribution[duration]}, but only ${selectedByDuration[duration].length} could be selected.`
      );
    }
  }

  return [
    ...selectedByDuration.short.map((quest) => ({
      questId: quest.id,
      questType: quest.type,
      duration: "short" as const
    })),
    ...selectedByDuration.medium.map((quest) => ({
      questId: quest.id,
      questType: quest.type,
      duration: "medium" as const
    })),
    ...selectedByDuration.long.map((quest) => ({
      questId: quest.id,
      questType: quest.type,
      duration: "long" as const
    }))
  ];
}

/**
 * Assign quests to a player based on the game's quest configuration
 * @param gameState - Current game state with quest configuration
 * @returns Array of assigned quest IDs
 */
export async function assignQuestsFromBatch(gameState: GameState): Promise<QuestAssignment[]> {
  // If no batchId or no quest configuration, return empty array
  if (!gameState.batchId || !gameState.questsPerPlayer) {
    return [];
  }

  try {
    // Get batch data using internal helper (no session check required)
    const batchResponse = await getBatchData(gameState.batchId);
    if (!batchResponse.success || !batchResponse.data) {
      console.error(`Failed to load batch ${gameState.batchId}:`, batchResponse.error);
      return [];
    }

    return assignQuestsFromLoadedBatch(gameState, batchResponse.data);
  } catch (error) {
    console.error(`[CRITICAL] Error assigning quests from batch ${gameState.batchId}:`, error);
    return [];
  }
}
