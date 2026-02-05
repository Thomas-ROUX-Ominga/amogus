import { create } from "zustand";
import { GameState, Player } from "@/types/game";
import { getGame } from "@/lib/kv/actions";

interface GameStore {
    gameState: GameState | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchGame: (id: string) => Promise<void>;
    reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
    gameState: null,
    isLoading: false,
    error: null,

    fetchGame: async (id: string) => {
        set({ isLoading: true, error: null });
        const response = await getGame(id);

        if (response.success && response.data) {
            set({ gameState: response.data, isLoading: false });
        } else {
            set({ error: response.error || "Unknown error", isLoading: false });
        }
    },

    reset: () => set({ gameState: null, isLoading: false, error: null }),
}));
