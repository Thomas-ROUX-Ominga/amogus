export type GameStatus = "LOBBY" | "IN_PROGRESS" | "FINISHED";

export interface Player {
    id: string;
    name: string;
    role?: "CREWMATE" | "IMPOSTOR";
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
