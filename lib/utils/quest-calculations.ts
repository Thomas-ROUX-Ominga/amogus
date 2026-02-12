import { getQuestsByDuration } from "@/lib/constants/quest-pool";

/**
 * Calculate the total number of quests available in the game
 * This is a shared utility to avoid duplication across components
 */
export function getTotalQuests(): number {
    return getQuestsByDuration("short").length + 
           getQuestsByDuration("medium").length + 
           getQuestsByDuration("long").length;
}

/**
 * Calculate global progress percentage across all players
 */
export function calculateGlobalProgress(players: Array<{ completedQuests?: string[] }>): number {
    if (players.length === 0) return 0;
    
    const totalQuests = getTotalQuests();
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
export function calculatePlayerProgress(completedQuests: string[] = []): number {
    const totalQuests = getTotalQuests();
    return totalQuests > 0 ? (completedQuests.length / totalQuests) * 100 : 0;
}
