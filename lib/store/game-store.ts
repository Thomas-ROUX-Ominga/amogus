import { create } from "zustand";
import { GameState } from "@/types/game";
import { getGame, joinGame } from "@/lib/redis/actions";

interface GameStore {
    gameState: GameState | null;
    isLoading: boolean;
    error: string | null;
    errorCode: string | null;

    // Actions
    fetchGame: (id: string) => Promise<void>;
    join: (gameId: string, playerName: string, userId: string) => Promise<void>;
    reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
    gameState: null,
    isLoading: false,
    error: null,
    errorCode: null,

    fetchGame: async (id: string) => {
        set({ isLoading: true, error: null, errorCode: null });
        const response = await getGame(id);

        if (response.success && response.data) {
            set({ gameState: response.data, isLoading: false });
        } else {
            set({
                error: response.error || "Unknown error",
                errorCode: response.code || null,
                isLoading: false
            });
        }
    },

    join: async (gameId: string, playerName: string, userId: string) => {
        set({ isLoading: true, error: null, errorCode: null });
        const response = await joinGame(gameId, playerName, userId);

        if (response.success && response.data) {
            set({ gameState: response.data, isLoading: false });
        } else {
            set({
                error: response.error || "Unknown error",
                errorCode: response.code || null,
                isLoading: false
            });
        }
    },

    reset: () => set({ gameState: null, isLoading: false, error: null, errorCode: null }),
}));
