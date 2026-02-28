import { getQuestGamesByDuration } from "@/lib/constants/quest-pool";
import { GameState } from "@/types/game";

/**
 * Calculate the total number of quests available in the game
 * This is a shared utility to avoid duplication across components
 */
export function getTotalQuests(gameState?: GameState | null): number {
    if (gameState?.questsPerPlayer) {
        return (gameState.questsPerPlayer.short || 0) + 
               (gameState.questsPerPlayer.medium || 0) + 
               (gameState.questsPerPlayer.long || 0);
    }
    
    return getQuestGamesByDuration("short").length + 
           getQuestGamesByDuration("medium").length + 
           getQuestGamesByDuration("long").length;
}

/**
 * Calculate global progress percentage across all players
 */
export function calculateGlobalProgress(players: Array<{ completedQuests?: string[] }>, gameState?: GameState | null): number {
    if (players.length === 0) return 0;
    
    const totalQuests = getTotalQuests(gameState);
    let totalCompleted = 0;
    
    players.forEach(player => {
        totalCompleted += player.completedQuests?.length || 0;
    });
    
    const totalPossible = players.length * totalQuests;
    return totalPossible > 0 ? (totalCompleted / totalPossible) * 100 : 0;
}

/**
 * Calculate individual player progress percentage
 */
export function calculatePlayerProgress(completedQuests: string[] = [], gameState?: GameState | null): number {
    const totalQuests = getTotalQuests(gameState);
    return totalQuests > 0 ? (completedQuests.length / totalQuests) * 100 : 0;
}
