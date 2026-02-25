import { Quest } from "@/types/quest";
import { getBatch } from "@/lib/redis/batch-actions";
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
    // Get batch data
    const batchResponse = await getBatch(gameState.batchId);
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

    // Helper to select random quests
    const selectRandomQuests = (quests: Quest[], count: number): Quest[] => {
      const shuffled = [...quests].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(count, quests.length));
    };

    // Select quests according to distribution
    const selectedShort = selectRandomQuests(shortQuests, distribution.short);
    const selectedMedium = selectRandomQuests(mediumQuests, distribution.medium);
    const selectedLong = selectRandomQuests(longQuests, distribution.long);

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
