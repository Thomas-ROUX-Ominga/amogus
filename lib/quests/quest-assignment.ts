import { Quest, Batch } from "@/types/quest";
import { getBatchData } from "@/lib/redis/batch-actions";
import { GameState } from "@/types/game";

export interface QuestAssignment {
  questId: string;
  questType: string;
  duration: 'short' | 'medium' | 'long';
}

type QuestDuration = Quest["duration"];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickLeastUsedQuest(candidates: Quest[], usageByQuestId: Record<string, number>): Quest {
  const minUsage = candidates.reduce(
    (currentMin, quest) => Math.min(currentMin, usageByQuestId[quest.id] ?? 0),
    Number.POSITIVE_INFINITY
  );

  const leastUsed = candidates.filter((quest) => (usageByQuestId[quest.id] ?? 0) === minUsage);
  return pickRandom(leastUsed);
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

function selectBalancedQuests(
  quests: Quest[],
  count: number,
  durationName: QuestDuration,
  usageByQuestId: Record<string, number>,
  forcedQuest?: Quest | null
): Quest[] {
  if (count <= 0) return [];

  if (count > quests.length) {
    throw new Error(`Insufficient ${durationName} quests available. Requested ${count}, but only ${quests.length} found in batch.`);
  }

  const selected: Quest[] = [];
  const selectedIds = new Set<string>();

  if (forcedQuest && forcedQuest.duration === durationName) {
    selected.push(forcedQuest);
    selectedIds.add(forcedQuest.id);
  }

  while (selected.length < count) {
    const candidates = quests.filter((quest) => !selectedIds.has(quest.id));
    if (candidates.length === 0) {
      break;
    }

    const chosenQuest = pickLeastUsedQuest(candidates, usageByQuestId);
    selected.push(chosenQuest);
    selectedIds.add(chosenQuest.id);
  }

  if (selected.length < count) {
    throw new Error(`Insufficient ${durationName} quests available after balancing. Requested ${count}, but only ${selected.length} could be selected.`);
  }

  return selected;
}

export function assignQuestsFromLoadedBatch(
  gameState: GameState,
  batch: Pick<Batch, "id" | "quests">
): QuestAssignment[] {
  if (!gameState.questsPerPlayer) {
    return [];
  }

  const distribution = gameState.questsPerPlayer;

  // Group batch quests by duration
  const shortQuests = batch.quests.filter((q) => q.duration === "short");
  const mediumQuests = batch.quests.filter((q) => q.duration === "medium");
  const longQuests = batch.quests.filter((q) => q.duration === "long");

  // Build usage frequency from players already assigned in this game.
  const usageByQuestId = buildQuestUsageMap(gameState.players, batch.quests);

  // Keep mini-game guarantee, but pick the least-used eligible mini-game first.
  const miniGameCandidates = batch.quests.filter(
    (q) => q.type === "mini-game" && distribution[q.duration] > 0
  );
  const forcedMiniGame = miniGameCandidates.length > 0
    ? pickLeastUsedQuest(miniGameCandidates, usageByQuestId)
    : null;

  const selectedShort = selectBalancedQuests(shortQuests, distribution.short, "short", usageByQuestId, forcedMiniGame);
  const selectedMedium = selectBalancedQuests(mediumQuests, distribution.medium, "medium", usageByQuestId, forcedMiniGame);
  const selectedLong = selectBalancedQuests(longQuests, distribution.long, "long", usageByQuestId, forcedMiniGame);

  return [
    ...selectedShort.map((quest) => ({
      questId: quest.id,
      questType: quest.type,
      duration: "short" as const
    })),
    ...selectedMedium.map((quest) => ({
      questId: quest.id,
      questType: quest.type,
      duration: "medium" as const
    })),
    ...selectedLong.map((quest) => ({
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
