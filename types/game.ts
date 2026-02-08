export type GameStatus = "LOBBY" | "IN_PROGRESS" | "FINISHED";

export type PlayerRole = "CREWMATE" | "IMPOSTOR";

export interface Player {
    id: string;
    name: string;
    role?: PlayerRole;
    isAlive: boolean;
}

export interface GameState {
    id: string;
    status: GameStatus;
    players: Player[];
    createdAt: number;
}

export interface ActionResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
}
