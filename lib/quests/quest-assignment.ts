import { Quest, Batch } from "@/types/quest";
import { getBatchData } from "@/lib/redis/batch-actions";
import { GameState } from "@/types/game";

export interface QuestAssignment {
  questId: string;
  questType: string;
  duration: "short" | "medium" | "long";
}

export interface CrewmateQuestOptimizationOptions {
  playerIds?: string[];
  targetPlayerId?: string;
  restarts?: number;
}

export interface CrewmateQuestOptimizationResult {
  assignmentsByPlayerId: Record<string, QuestAssignment[]>;
  targetPlayerId?: string;
}

type QuestDuration = Quest["duration"];
type Score = readonly [number, number, number, number];

const DURATION_ORDER: QuestDuration[] = ["short", "medium", "long"];
const DEFAULT_RESTARTS = 64;
const QUEST_TYPE_COUNT = 6;

function getQuestUsage(usageByQuestId: Record<string, number>, questId: string): number {
  return usageByQuestId[questId] ?? 0;
}

function pickRandomItem<T>(items: T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function pickLeastUsedQuest(candidates: Quest[], usageByQuestId: Record<string, number>): Quest {
  const minUsage = candidates.reduce(
    (currentMin, quest) => Math.min(currentMin, getQuestUsage(usageByQuestId, quest.id)),
    Number.POSITIVE_INFINITY
  );
  const leastUsed = candidates.filter((quest) => getQuestUsage(usageByQuestId, quest.id) === minUsage);
  return pickRandomItem(leastUsed);
}

function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function compareScore(left: Score, right: Score): number {
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] === right[i]) continue;
    return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function getTypeRepetitionCap(totalRequested: number): number {
  if (totalRequested <= QUEST_TYPE_COUNT * 2) {
    return 2;
  }
  return Math.max(2, Math.ceil(totalRequested / QUEST_TYPE_COUNT));
}

function getCandidatesRespectingTypeCap(
  candidates: Quest[],
  typeCounts: Record<string, number>,
  typeRepetitionCap: number
): Quest[] {
  const eligible = candidates.filter((quest) => (typeCounts[quest.type] ?? 0) < typeRepetitionCap);
  return eligible.length > 0 ? eligible : candidates;
}

function toQuestAssignments(quests: Quest[]): QuestAssignment[] {
  const byDuration: Record<QuestDuration, Quest[]> = { short: [], medium: [], long: [] };
  quests.forEach((quest) => {
    byDuration[quest.duration].push(quest);
  });

  return [
    ...byDuration.short.map((quest) => ({ questId: quest.id, questType: quest.type, duration: "short" as const })),
    ...byDuration.medium.map((quest) => ({ questId: quest.id, questType: quest.type, duration: "medium" as const })),
    ...byDuration.long.map((quest) => ({ questId: quest.id, questType: quest.type, duration: "long" as const })),
  ];
}

function buildQuestsByDuration(quests: Quest[]): Record<QuestDuration, Quest[]> {
  return {
    short: quests.filter((q) => q.duration === "short"),
    medium: quests.filter((q) => q.duration === "medium"),
    long: quests.filter((q) => q.duration === "long"),
  };
}

function buildMiniGamesByDuration(questsByDuration: Record<QuestDuration, Quest[]>): Record<QuestDuration, Quest[]> {
  return {
    short: questsByDuration.short.filter((q) => q.type === "mini-game"),
    medium: questsByDuration.medium.filter((q) => q.type === "mini-game"),
    long: questsByDuration.long.filter((q) => q.type === "mini-game"),
  };
}

function validateDistribution(
  gameState: GameState,
  questsByDuration: Record<QuestDuration, Quest[]>
): { short: number; medium: number; long: number } {
  if (!gameState.questsPerPlayer) {
    throw new Error("Missing questsPerPlayer configuration.");
  }

  const distribution = gameState.questsPerPlayer;
  const totalRequested = distribution.short + distribution.medium + distribution.long;
  if (totalRequested <= 0) {
    throw new Error("Invalid distribution: at least one quest is required.");
  }

  for (const duration of DURATION_ORDER) {
    if (distribution[duration] > questsByDuration[duration].length) {
      throw new Error(
        `Insufficient ${duration} quests available. Requested ${distribution[duration]}, but only ${questsByDuration[duration].length} found in batch.`
      );
    }
  }

  return distribution;
}

function buildQuestUsageMap(
  players: GameState["players"] | undefined,
  batchQuests: Quest[],
  excludedPlayerIds: Set<string> = new Set()
): Record<string, number> {
  const usageByQuestId: Record<string, number> = {};
  const questById = new Set(batchQuests.map((quest) => quest.id));
  const existingPlayers = Array.isArray(players) ? players : [];

  for (const player of existingPlayers) {
    if (excludedPlayerIds.has(player.id) || !player.assignedQuests) {
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

function getOverlapWithCurrentAssignments(
  questId: string,
  currentAssignmentsByPlayerId: Map<string, Set<string>>
): number {
  let overlap = 0;
  currentAssignmentsByPlayerId.forEach((assignedIds) => {
    if (assignedIds.has(questId)) {
      overlap += 1;
    }
  });
  return overlap;
}

function pickBestQuestForSlot(
  candidates: Quest[],
  seenTypes: Set<string>,
  usageByQuestId: Record<string, number>,
  currentAssignmentsByPlayerId: Map<string, Set<string>>,
  isTargetPlayer: boolean
): Quest {
  if (candidates.length === 0) {
    throw new Error("No quest candidates available for slot selection.");
  }

  let bestQuest = candidates[0];
  let bestScore: Score | null = null;

  for (const candidate of candidates) {
    const addsNewType = seenTypes.has(candidate.type) ? 0 : 1;
    const overlapPenalty = getOverlapWithCurrentAssignments(candidate.id, currentAssignmentsByPlayerId);
    const usagePenalty = getQuestUsage(usageByQuestId, candidate.id);

    const score: Score = isTargetPlayer
      ? [addsNewType, -overlapPenalty, -usagePenalty, Math.random()]
      : [-overlapPenalty, addsNewType, -usagePenalty, Math.random()];

    if (!bestScore || compareScore(score, bestScore) > 0) {
      bestQuest = candidate;
      bestScore = score;
    }
  }

  return bestQuest;
}

function selectQuestByTypePriority(
  candidates: Quest[],
  seenTypes: Set<string>,
  usageByQuestId: Record<string, number>,
  typeCounts: Record<string, number>,
  typeRepetitionCap: number
): Quest {
  if (candidates.length === 0) {
    throw new Error("No quest candidates available for slot selection.");
  }

  const cappedCandidates = getCandidatesRespectingTypeCap(candidates, typeCounts, typeRepetitionCap);
  const candidatesByType = cappedCandidates.reduce<Record<string, Quest[]>>((acc, quest) => {
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
  const [, selectedTypeCandidates] = pickRandomItem(eligibleTypes);

  return pickLeastUsedQuest(selectedTypeCandidates, usageByQuestId);
}

function assignSinglePlayerFromLoadedBatchLegacy(
  gameState: GameState,
  batch: Pick<Batch, "id" | "quests">
): QuestAssignment[] {
  const questsByDuration = buildQuestsByDuration(batch.quests);
  const distribution = validateDistribution(gameState, questsByDuration);
  const usageByQuestId = buildQuestUsageMap(gameState.players, batch.quests);
  const miniGamesByDuration = buildMiniGamesByDuration(questsByDuration);
  const totalRequested = distribution.short + distribution.medium + distribution.long;
  const typeRepetitionCap = getTypeRepetitionCap(totalRequested);
  const typeCounts: Record<string, number> = {};

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
  const miniCandidates = getCandidatesRespectingTypeCap(
    miniGamesByDuration[forcedMiniDuration],
    typeCounts,
    typeRepetitionCap
  );
  const forcedMiniGame = pickLeastUsedQuest(miniCandidates, usageByQuestId);
  selectedByDuration[forcedMiniDuration].push(forcedMiniGame);
  selectedIds.add(forcedMiniGame.id);
  seenTypes.add(forcedMiniGame.type);
  typeCounts[forcedMiniGame.type] = (typeCounts[forcedMiniGame.type] ?? 0) + 1;
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

    const chosenQuest = selectQuestByTypePriority(
      availableCandidates,
      seenTypes,
      usageByQuestId,
      typeCounts,
      typeRepetitionCap
    );
    selectedByDuration[duration].push(chosenQuest);
    selectedIds.add(chosenQuest.id);
    seenTypes.add(chosenQuest.type);
    typeCounts[chosenQuest.type] = (typeCounts[chosenQuest.type] ?? 0) + 1;
    usageByQuestId[chosenQuest.id] = getQuestUsage(usageByQuestId, chosenQuest.id) + 1;
  }

  for (const duration of DURATION_ORDER) {
    if (selectedByDuration[duration].length !== distribution[duration]) {
      throw new Error(
        `Insufficient ${duration} quests available after balancing. Requested ${distribution[duration]}, but only ${selectedByDuration[duration].length} could be selected.`
      );
    }
  }

  return toQuestAssignments([
    ...selectedByDuration.short,
    ...selectedByDuration.medium,
    ...selectedByDuration.long,
  ]);
}

function assignQuestsForOnePlayer(params: {
  distribution: { short: number; medium: number; long: number };
  questsByDuration: Record<QuestDuration, Quest[]>;
  miniGamesByDuration: Record<QuestDuration, Quest[]>;
  usageByQuestId: Record<string, number>;
  currentAssignmentsByPlayerId: Map<string, Set<string>>;
  isTargetPlayer: boolean;
}): Quest[] {
  const { distribution, questsByDuration, miniGamesByDuration, usageByQuestId, currentAssignmentsByPlayerId, isTargetPlayer } = params;
  const selectedByDuration: Record<QuestDuration, Quest[]> = { short: [], medium: [], long: [] };
  const selectedIds = new Set<string>();
  const seenTypes = new Set<string>();
  const typeCounts: Record<string, number> = {};
  const totalRequested = distribution.short + distribution.medium + distribution.long;
  const typeRepetitionCap = getTypeRepetitionCap(totalRequested);

  const eligibleMiniDurations = DURATION_ORDER.filter(
    (duration) => distribution[duration] > 0 && miniGamesByDuration[duration].length > 0
  );
  if (eligibleMiniDurations.length === 0) {
    throw new Error("No mini-game available for the configured quest distribution.");
  }

  const forcedMiniDuration = pickRandomItem(eligibleMiniDurations);
  const miniCandidates = miniGamesByDuration[forcedMiniDuration];
  const cappedMiniCandidates = getCandidatesRespectingTypeCap(miniCandidates, typeCounts, typeRepetitionCap);
  const forcedMiniGame = pickBestQuestForSlot(
    cappedMiniCandidates,
    seenTypes,
    usageByQuestId,
    currentAssignmentsByPlayerId,
    isTargetPlayer
  );

  selectedByDuration[forcedMiniDuration].push(forcedMiniGame);
  selectedIds.add(forcedMiniGame.id);
  seenTypes.add(forcedMiniGame.type);
  typeCounts[forcedMiniGame.type] = (typeCounts[forcedMiniGame.type] ?? 0) + 1;
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

    const cappedCandidates = getCandidatesRespectingTypeCap(availableCandidates, typeCounts, typeRepetitionCap);
    const chosenQuest = pickBestQuestForSlot(
      cappedCandidates,
      seenTypes,
      usageByQuestId,
      currentAssignmentsByPlayerId,
      isTargetPlayer
    );
    selectedByDuration[duration].push(chosenQuest);
    selectedIds.add(chosenQuest.id);
    seenTypes.add(chosenQuest.type);
    typeCounts[chosenQuest.type] = (typeCounts[chosenQuest.type] ?? 0) + 1;
    usageByQuestId[chosenQuest.id] = getQuestUsage(usageByQuestId, chosenQuest.id) + 1;
  }

  for (const duration of DURATION_ORDER) {
    if (selectedByDuration[duration].length !== distribution[duration]) {
      throw new Error(
        `Insufficient ${duration} quests available after balancing. Requested ${distribution[duration]}, but only ${selectedByDuration[duration].length} could be selected.`
      );
    }
  }

  return [...selectedByDuration.short, ...selectedByDuration.medium, ...selectedByDuration.long];
}

function buildAssignmentScore(params: {
  targetPlayerId: string;
  playerOrder: string[];
  assignmentsByPlayerId: Map<string, Quest[]>;
  baselineUsageByQuestId: Record<string, number>;
}): Score {
  const { targetPlayerId, playerOrder, assignmentsByPlayerId, baselineUsageByQuestId } = params;

  const targetAssignments = assignmentsByPlayerId.get(targetPlayerId) ?? [];
  const targetDiversity = new Set(targetAssignments.map((quest) => quest.type)).size;

  const usageWithinSolution: Record<string, number> = {};
  assignmentsByPlayerId.forEach((quests) => {
    quests.forEach((quest) => {
      usageWithinSolution[quest.id] = (usageWithinSolution[quest.id] ?? 0) + 1;
    });
  });
  const overlapDuplicates = Object.values(usageWithinSolution).reduce(
    (sum, count) => sum + Math.max(0, count - 1),
    0
  );

  const otherPlayerIds = playerOrder.filter((playerId) => playerId !== targetPlayerId);
  const otherDiversitySum = otherPlayerIds.reduce((sum, playerId) => {
    const assignments = assignmentsByPlayerId.get(playerId) ?? [];
    return sum + new Set(assignments.map((quest) => quest.type)).size;
  }, 0);

  const allUsage = { ...baselineUsageByQuestId };
  Object.entries(usageWithinSolution).forEach(([questId, count]) => {
    allUsage[questId] = (allUsage[questId] ?? 0) + count;
  });
  const concentrationScore = Object.values(allUsage).reduce((sum, count) => sum + count * count, 0);

  return [targetDiversity, -overlapDuplicates, otherDiversitySum, -concentrationScore];
}

export function optimizeCrewmateAssignmentsFromLoadedBatch(
  gameState: GameState,
  batch: Pick<Batch, "id" | "quests">,
  options: CrewmateQuestOptimizationOptions = {}
): CrewmateQuestOptimizationResult {
  if (!gameState.questsPerPlayer) {
    return { assignmentsByPlayerId: {}, targetPlayerId: options.targetPlayerId };
  }

  const playerIds = (options.playerIds ?? gameState.players?.map((player) => player.id) ?? []).filter(Boolean);
  if (playerIds.length === 0) {
    return { assignmentsByPlayerId: {}, targetPlayerId: options.targetPlayerId };
  }

  const questsByDuration = buildQuestsByDuration(batch.quests);
  const distribution = validateDistribution(gameState, questsByDuration);
  const miniGamesByDuration = buildMiniGamesByDuration(questsByDuration);
  const restarts = Math.max(1, options.restarts ?? DEFAULT_RESTARTS);

  const targetPlayerId =
    (options.targetPlayerId && playerIds.includes(options.targetPlayerId))
      ? options.targetPlayerId
      : playerIds[0];
  if (!targetPlayerId) {
    return { assignmentsByPlayerId: {} };
  }

  const optimizedPlayerIdSet = new Set(playerIds);
  const baselineUsageByQuestId = buildQuestUsageMap(gameState.players, batch.quests, optimizedPlayerIdSet);

  let bestAssignments = new Map<string, Quest[]>();
  let bestScore: Score | null = null;

  for (let restart = 0; restart < restarts; restart += 1) {
    const usageByQuestId: Record<string, number> = { ...baselineUsageByQuestId };
    const assignmentsByPlayerId = new Map<string, Quest[]>();
    const assignmentIdSetByPlayerId = new Map<string, Set<string>>();

    const orderedPlayers = [targetPlayerId, ...shuffleArray(playerIds.filter((playerId) => playerId !== targetPlayerId))];

    for (const playerId of orderedPlayers) {
      const assignments = assignQuestsForOnePlayer({
        distribution,
        questsByDuration,
        miniGamesByDuration,
        usageByQuestId,
        currentAssignmentsByPlayerId: assignmentIdSetByPlayerId,
        isTargetPlayer: playerId === targetPlayerId,
      });

      assignmentsByPlayerId.set(playerId, assignments);
      assignmentIdSetByPlayerId.set(playerId, new Set(assignments.map((quest) => quest.id)));
    }

    const score = buildAssignmentScore({
      targetPlayerId,
      playerOrder: orderedPlayers,
      assignmentsByPlayerId,
      baselineUsageByQuestId,
    });
    if (!bestScore || compareScore(score, bestScore) > 0) {
      bestScore = score;
      bestAssignments = assignmentsByPlayerId;
    }
  }

  const serializedAssignments: Record<string, QuestAssignment[]> = {};
  bestAssignments.forEach((quests, playerId) => {
    serializedAssignments[playerId] = toQuestAssignments(quests);
  });

  return {
    assignmentsByPlayerId: serializedAssignments,
    targetPlayerId,
  };
}

export function assignQuestsFromLoadedBatch(
  gameState: GameState,
  batch: Pick<Batch, "id" | "quests">
): QuestAssignment[] {
  if (!gameState.questsPerPlayer) {
    return [];
  }

  return assignSinglePlayerFromLoadedBatchLegacy(gameState, batch);
}

/**
 * Assign quests to a player based on the game's quest configuration
 * @param gameState - Current game state with quest configuration
 * @returns Array of assigned quest IDs
 */
export async function assignQuestsFromBatch(gameState: GameState): Promise<QuestAssignment[]> {
  if (!gameState.batchId || !gameState.questsPerPlayer) {
    return [];
  }

  try {
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
