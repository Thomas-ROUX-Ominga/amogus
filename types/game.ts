import type { BatchSabotages, SabotageType } from "./quest";

export type GameStatus = "LOBBY" | "IN_PROGRESS" | "FINISHED";

export type PlayerRole = "CREWMATE" | "IMPOSTOR" | "ADMIN";

export type MeetingStatus = "ACTIVE" | "COMPLETED";
export type MeetingEndReason = "ALL_VOTED" | "TIMEOUT";

export interface MeetingSnapshotPlayer {
    id: string;
    name: string;
    role?: PlayerRole;
    isAlive: boolean;
}

export interface MeetingSnapshot {
    capturedAt: number;
    progress: {
        completed: number;
        total: number;
        percentage: number;
    };
    players: MeetingSnapshotPlayer[];
}

export interface MeetingState {
    id: string;
    status: MeetingStatus;
    startedAt: number;
    endsAt: number;
    startedBy: string;
    snapshot: MeetingSnapshot;
    eligibleVoterIds: string[];
    voteCounts: Record<string, number>;
    totalEligibleVoters: number;
    totalVotes: number;
    eliminatedPlayerId?: string;
    eliminatedPlayerName?: string;
    endReason?: MeetingEndReason;
    endedAt?: number;
}

export interface MeetingView {
    meeting: MeetingState | null;
    myVoteTargetId: string | null;
}

export interface ReactorSabotageState {
    startedAt: number;
    endsAt: number;
    scannedByQrId: string[];
    scannedUserIds: string[];
}

export interface SabotageCooldownState {
    communicationsAvailableAt: number;
    lightsAvailableAt: number;
    reactorAvailableAt: number;
}

export interface SabotageState {
    active: SabotageType | null;
    reactor: ReactorSabotageState | null;
    cooldowns: SabotageCooldownState;
}

export interface Player {
    id: string;
    name: string;
    role?: PlayerRole;
    isAlive: boolean;
    completedQuests?: string[];
    lastQuestCompleted?: number; // Timestamp of last completed quest
    assignedQuests?: string[]; // Story 11.3: Quests assigned to this player from batch
    meetingBuzzUsedAt?: number; // Timestamp when player used their one-time buzzer
}

export interface GameState {
    id: string;
    status: GameStatus;
    players: Player[];
    createdAt: number;
    revision: number;
    updatedAt: number;
    creatorId?: string; // First player to join is considered the organizer
    batchId?: string; // Linked batch for quest data
    questsTotal?: number; // Total number of quests in this game (from batch or pool)
    questsPerPlayer?: {
        short: number;
        medium: number;
        long: number;
    }; // Quest distribution configuration
    winner?: PlayerRole; // Victory condition result
    meeting?: MeetingState;
    sabotages?: BatchSabotages;
    sabotageState?: SabotageState;
}

export interface ActionResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
}
