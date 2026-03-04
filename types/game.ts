export type GameStatus = "LOBBY" | "IN_PROGRESS" | "FINISHED";

export type PlayerRole = "CREWMATE" | "IMPOSTOR" | "ADMIN";

export interface Player {
    id: string;
    name: string;
    role?: PlayerRole;
    isAlive: boolean;
    completedQuests?: string[];
    lastQuestCompleted?: number; // Timestamp of last completed quest
    assignedQuests?: string[]; // Story 11.3: Quests assigned to this player from batch
}

export interface GameState {
    id: string;
    status: GameStatus;
    players: Player[];
    createdAt: number;
    creatorId?: string; // First player to join is considered the organizer
    batchId?: string; // Linked batch for quest data
    questsTotal?: number; // Total number of quests in this game (from batch or pool)
    questsPerPlayer?: {
        short: number;
        medium: number;
        long: number;
    }; // Quest distribution configuration
    winner?: PlayerRole; // Victory condition result
}

export interface ActionResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
}
