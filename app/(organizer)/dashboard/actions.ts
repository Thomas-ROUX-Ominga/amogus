"use server";

import { getGame, getQuestMetadata, eliminatePlayer as eliminatePlayerAction } from "@/lib/redis/actions";
import { ActionResponse, GameState } from "@/types/game";
import { verifySession } from "@/lib/redis/auth-utils";
import { ERROR_CODES } from "@/lib/constants/error-codes";

export interface DashboardStats {
  totalQuestsAssigned: number;
  totalQuestsCompleted: number;
  progressByFormat: {
    short: { assigned: number; completed: number };
    medium: { assigned: number; completed: number };
    long: { assigned: number; completed: number };
  };
  playerProgress: Array<{
    id: string;
    name: string;
    completed: number;
    assigned: number;
    percentage: number;
    isAlive: boolean;
    role?: string;
  }>;
}

export interface DashboardData {
  gameState: GameState;
  stats: DashboardStats;
}

export async function getDashboardData(gameId: string): Promise<ActionResponse<DashboardData>> {
  const gameResponse = await getGame(gameId);
  if (!gameResponse.success || !gameResponse.data) {
    return {
      success: false,
      error: gameResponse.error,
      code: gameResponse.code ?? ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }

  const state = gameResponse.data;
  const questsPerPlayer = state.questsPerPlayer || { short: 1, medium: 1, long: 1 };
  const totalQuestsPerPlayer = questsPerPlayer.short + questsPerPlayer.medium + questsPerPlayer.long;

  let totalAssigned = 0;
  let totalCompleted = 0;
  const formatStats = {
    short: { assigned: 0, completed: 0 },
    medium: { assigned: 0, completed: 0 },
    long: { assigned: 0, completed: 0 },
  };

  const allCompletedQuests = new Set<string>();
  state.players.forEach(p => {
    (p.completedQuests || []).forEach(q => allCompletedQuests.add(q));
  });

  const questFormats: Record<string, "short" | "medium" | "long"> = {};
  await Promise.all(
    Array.from(allCompletedQuests).map(async (questId) => {
      const meta = await getQuestMetadata(questId, gameId);
      if (meta.success && meta.data) {
        questFormats[questId] = meta.data.duration;
      }
    })
  );

  const playerProgress = state.players.map(player => {
    const completedList = player.completedQuests || [];
    const completed = completedList.length;
    const assigned = totalQuestsPerPlayer;
    const percentage = assigned > 0 ? (completed / assigned) * 100 : 0;

    totalAssigned += assigned;
    totalCompleted += completed;

    formatStats.short.assigned += questsPerPlayer.short;
    formatStats.medium.assigned += questsPerPlayer.medium;
    formatStats.long.assigned += questsPerPlayer.long;

    completedList.forEach(qId => {
      const format = questFormats[qId];
      if (format) {
        formatStats[format].completed += 1;
      }
    });

    return {
      id: player.id,
      name: player.name,
      completed,
      assigned,
      percentage,
      isAlive: player.isAlive,
      role: player.role,
    };
  });

  return {
    success: true,
    data: {
      gameState: state,
      stats: {
        totalQuestsAssigned: totalAssigned,
        totalQuestsCompleted: totalCompleted,
        progressByFormat: formatStats,
        playerProgress,
      },
    },
  };
}

export async function eliminatePlayer(gameId: string, playerId: string): Promise<ActionResponse<void>> {
  try {
    // Verify admin session
    const session = await verifySession();
    if (!session.success) {
      return {
        success: false,
        error: "Unauthorized: Admin access required",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      };
    }

    // Verify the game exists and admin is the creator
    const gameResponse = await getGame(gameId);
    if (!gameResponse.success || !gameResponse.data) {
      return {
        success: false,
        error: "Game not found",
        code: ERROR_CODES.GAME_NOT_FOUND,
      };
    }

    const game = gameResponse.data;
    if (game.creatorId !== session.data!.userId) {
      return {
        success: false,
        error: "Unauthorized: Only game creator can eliminate players",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      };
    }

    // Call the existing eliminatePlayer action
    const result = await eliminatePlayerAction(gameId, playerId);
    if (!result.success) {
      return {
        success: false,
        error: result.error,
        code: result.code ?? ERROR_CODES.ERR_SIGNAL_LOST,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to eliminate player:", error);
    return {
      success: false,
      error: "Failed to eliminate player",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}
