import { Quest } from "@/types/quest";
import { getBatchData } from "@/lib/redis/batch-actions";
import { GameState } from "@/types/game";

export interface QuestAssignment {
  questId: string;
  questType: string;
  duration: 'short' | 'medium' | 'long';
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

    const batch = batchResponse.data;
    const distribution = gameState.questsPerPlayer;
    
    // Group batch quests by duration
    const shortQuests = batch.quests.filter(q => q.duration === 'short');
    const mediumQuests = batch.quests.filter(q => q.duration === 'medium');
    const longQuests = batch.quests.filter(q => q.duration === 'long');

    // Identify mini-games in the batch to ensure at least one is assigned
    const miniGames = batch.quests.filter(q => q.type === 'mini-game');
    let forcedMiniGame: Quest | null = null;
    
    if (miniGames.length > 0) {
      // Pick one random mini-game to guarantee for this player
      forcedMiniGame = miniGames[Math.floor(Math.random() * miniGames.length)];
    }

    // Helper to select random quests using Fisher-Yates shuffle
    const selectRandomQuests = (quests: Quest[], count: number, durationName: 'short' | 'medium' | 'long', forced?: Quest | null): Quest[] => {
      if (count <= 0) return [];
      
      if (count > quests.length) {
        throw new Error(`Insufficient ${durationName} quests available. Requested ${count}, but only ${quests.length} found in batch.`);
      }

      let pool = [...quests];
      const selected: Quest[] = [];

      // If we have a forced quest for this duration, include it first
      if (forced && forced.duration === durationName) {
        selected.push(forced);
        pool = pool.filter(q => q.id !== forced.id);
      }

      // Shuffle the remaining pool
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      // Fill remaining slots
      const remainingCount = count - selected.length;
      selected.push(...pool.slice(0, remainingCount));

      return selected;
    };

    // Select quests according to distribution, forcing the mini-game if applicable
    const selectedShort = selectRandomQuests(shortQuests, distribution.short, 'short', forcedMiniGame);
    const selectedMedium = selectRandomQuests(mediumQuests, distribution.medium, 'medium', forcedMiniGame);
    const selectedLong = selectRandomQuests(longQuests, distribution.long, 'long', forcedMiniGame);

    // Convert to quest assignments
    const assignments: QuestAssignment[] = [
      ...selectedShort.map(quest => ({
        questId: quest.id,
        questType: quest.type,
        duration: 'short' as const
      })),
      ...selectedMedium.map(quest => ({
        questId: quest.id,
        questType: quest.type,
        duration: 'medium' as const
      })),
      ...selectedLong.map(quest => ({
        questId: quest.id,
        questType: quest.type,
        duration: 'long' as const
      }))
    ];


    return assignments;
  } catch (error) {
    console.error(`[CRITICAL] Error assigning quests from batch ${gameState.batchId}:`, error);
    return [];
  }
}
