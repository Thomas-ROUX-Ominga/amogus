import { Quest, QuestGame, QuestType, QuestDuration } from "@/types/quest";
import { getQuestGamesByDuration } from "@/lib/constants/quest-pool";
import { getQuestMetadata, getPlayerFailedQuests, getGame } from "@/lib/redis/actions";

export interface QuestContentResult {
    content: QuestGame;
    contentId: string;
    isRotation: boolean; // true if this is a rotation due to previous failure
}

/**
 * Dynamic Content Mapper for Story 8.2
 * Implements content selection with rotation logic for failed quests
 */
export class DynamicContentMapper {
    /**
     * Get dynamic quest content based on questId and player failure history
     * @param questId - The quest ID from QR scan or assignment
     * @param gameId - Current game ID for tracking failed quests
     * @param userId - Current user ID for personalization
     * @returns QuestContentResult with selected content and metadata
     */
    static async getQuestContent(
        questId: string,
        gameId: string,
        userId: string
    ): Promise<QuestContentResult | null> {
        try {
            // Story 9.1: Early role check to prevent content loading for impostors
            const gameResponse = await getGame(gameId);
            if (gameResponse.success && gameResponse.data) {
                const currentPlayer = gameResponse.data.players.find(p => p.id === userId);
                const isImpostor = currentPlayer?.role === "IMPOSTOR";
                
                if (isImpostor) {
                    // Don't load any content for impostors - Story 9.1
                    return null;
                }
            }

            // Step 1: Get quest metadata (Format/Type) from Redis
            const metadataResponse = await getQuestMetadata(questId, gameId);
            if (!metadataResponse.success || !metadataResponse.data) {
                console.error(`Failed to get metadata for quest ${questId}:`, metadataResponse.error);
                return null;
            }

            const questMeta = metadataResponse.data;

            // Step 2: Get player's failed quest history
            const failedQuestsResponse = await getPlayerFailedQuests(gameId, userId);
            if (!failedQuestsResponse.success) {
                console.error(`Failed to get failed quests for user ${userId}:`, failedQuestsResponse.error);
                // CRITICAL: Don't continue without failed quest data as this violates idempotency
                // Return null to force the caller to handle the error properly
                return null;
            }

            const failedQuests = failedQuestsResponse.data ?? {};
            const failedContentIds = failedQuests[questId] ?? [];

            // Step 3: Select content with rotation logic
            const contentResult = this.selectContentWithRotation(
                questMeta.type,
                questMeta.duration,
                failedContentIds
            );

            if (!contentResult) {
                console.error(`No content available for quest ${questId} with type ${questMeta.type} and duration ${questMeta.duration}`);
                return null;
            }

            return {
                ...contentResult,
                isRotation: failedContentIds.length > 0 && !failedContentIds.includes(contentResult.contentId)
            };

        } catch (error) {
            console.error(`Error in getQuestContent for quest ${questId}:`, error);
            return null;
        }
    }

    /**
     * Select content from pool with rotation logic
     * @param type - Quest type (true-false, qcm, etc.)
     * @param duration - Quest duration (short, medium, long)
     * @param excludedContentIds - Content IDs to exclude (previously failed)
     * @returns Selected content or null if no content available
     */
    private static selectContentWithRotation(
        type: QuestType,
        duration: QuestDuration,
        excludedContentIds: string[]
    ): { content: QuestGame; contentId: string } | null {
        // Get all content matching the duration first (more efficient)
        const allContent = getQuestGamesByDuration(duration);
        
        // Create exclusion set for O(1) lookup
        const exclusionSet = new Set(excludedContentIds);
        
        // Filter content by type and exclusion in single pass
        const filteredContent = allContent.filter(content => 
            content.type === type && !exclusionSet.has(content.id)
        );

        let availableGames = filteredContent;
        
        // If no content available after exclusion, fall back to allowing any content
        if (filteredContent.length === 0) {
            const fallbackContent = allContent.filter(content => content.type === type);
            if (fallbackContent.length === 0) {
                return null;
            }
            availableGames = fallbackContent;
        }
        
        // Use cryptographically secure random selection
        const randomIndex = this.getCryptoRandomIndex(availableGames.length);
        const selectedContent = availableGames[randomIndex];
        
        return {
            content: selectedContent,
            contentId: selectedContent.id
        };
    }

    /**
     * Generate cryptographically secure random index
     * @param max - Maximum value (exclusive)
     * @returns Random integer between 0 and max-1
     */
    private static getCryptoRandomIndex(max: number): number {
        if (max <= 0) return 0;
        
        // Use crypto.getRandomValues for better randomness if available
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const randomValues = new Uint32Array(1);
            crypto.getRandomValues(randomValues);
            return randomValues[0] % max;
        }
        
        // Fallback to Math.random() for environments without crypto.getRandomValues
        return Math.floor(Math.random() * max);
    }

    /**
     * Check if a player has failed a specific quest
     * @param gameId - Current game ID
     * @param userId - Current user ID
     * @param questId - Quest ID to check
     * @returns True if player has failed this quest before
     */
    static async hasPlayerFailedQuest(
        gameId: string,
        userId: string,
        questId: string
    ): Promise<boolean> {
        try {
            const failedQuestsResponse = await getPlayerFailedQuests(gameId, userId);
            if (!failedQuestsResponse.success) {
                return false;
            }

            const failedQuests = failedQuestsResponse.data ?? {};
            const failedContentIds = failedQuests[questId] ?? [];
            
            return failedContentIds.length > 0;
        } catch (error) {
            console.error(`Error checking failed quest status for ${questId}:`, error);
            return false;
        }
    }

    /**
     * Get the count of failed attempts for a specific quest
     * @param gameId - Current game ID
     * @param userId - Current user ID
     * @param questId - Quest ID to check
     * @returns Number of failed attempts
     */
    static async getFailedAttemptCount(
        gameId: string,
        userId: string,
        questId: string
    ): Promise<number> {
        try {
            const failedQuestsResponse = await getPlayerFailedQuests(gameId, userId);
            if (!failedQuestsResponse.success) {
                return 0;
            }

            const failedQuests = failedQuestsResponse.data ?? {};
            const failedContentIds = failedQuests[questId] ?? [];
            
            return failedContentIds.length;
        } catch (error) {
            console.error(`Error getting failed attempt count for ${questId}:`, error);
            return 0;
        }
    }
}
