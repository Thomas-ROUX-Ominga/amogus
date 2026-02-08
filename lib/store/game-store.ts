import { create } from "zustand";
import { GameState, PlayerRole } from "@/types/game";
import { Quest } from "@/types/quest";
import { getGame, joinGame, startGame, selectRole } from "@/lib/redis/actions";

interface GameStore {
    gameState: GameState | null;
    isLoading: boolean;
    isLaunching: boolean;
    isSelectingRole: boolean;
    error: string | null;
    errorCode: string | null;
    launchError: string | null;
    roleError: string | null;
    selectedRole: PlayerRole | null;
    questsCompleted: number;
    questsTotal: number;
    currentQuest: Quest | null;

    // Actions
    fetchGame: (id: string) => Promise<void>;
    join: (gameId: string, playerName: string, userId: string) => Promise<void>;
    launch: (gameId: string) => Promise<boolean>;
    chooseRole: (gameId: string, userId: string, role: PlayerRole) => Promise<boolean>;
    setCurrentQuest: (quest: Quest) => void;
    clearQuest: () => void;
    reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
    gameState: null,
    isLoading: false,
    isLaunching: false,
    isSelectingRole: false,
    error: null,
    errorCode: null,
    launchError: null,
    roleError: null,
    selectedRole: null,
    questsCompleted: 0,
    questsTotal: 0,
    currentQuest: null,

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

    launch: async (gameId: string) => {
        set({ isLaunching: true, launchError: null });
        const response = await startGame(gameId);

        if (response.success && response.data) {
            set({ gameState: response.data, isLaunching: false, launchError: null });
            return true;
        } else {
            set({
                launchError: response.error || "Unknown error",
                isLaunching: false
            });
            return false;
        }
    },

    chooseRole: async (gameId: string, userId: string, role: PlayerRole) => {
        set({ isSelectingRole: true, roleError: null });
        const response = await selectRole(gameId, userId, role);

        if (response.success && response.data) {
            // Fetch fresh game state after role selection to ensure full sync
            const gameResponse = await getGame(gameId);
            
            if (gameResponse.success && gameResponse.data) {
                set({
                    selectedRole: response.data.role,
                    isSelectingRole: false,
                    roleError: null,
                    gameState: gameResponse.data,
                });
            } else {
                // Fallback: update locally if fetch fails
                set((state) => {
                    const updatedPlayers = state.gameState?.players.map((p) =>
                        p.id === userId ? { ...p, role: response.data!.role } : p
                    );
                    return {
                        selectedRole: response.data!.role,
                        isSelectingRole: false,
                        roleError: null,
                        gameState: state.gameState
                            ? { ...state.gameState, players: updatedPlayers ?? state.gameState.players }
                            : null,
                    };
                });
            }
            return true;
        } else {
            set({
                roleError: response.error || "Unknown error",
                isSelectingRole: false
            });
            return false;
        }
    },

    setCurrentQuest: (quest: Quest) => set({ currentQuest: quest }),

    clearQuest: () => set({ currentQuest: null }),

    reset: () => set({ 
        gameState: null, 
        isLoading: false, 
        isLaunching: false, 
        isSelectingRole: false,
        error: null, 
        errorCode: null, 
        launchError: null,
        roleError: null,
        selectedRole: null,
        questsCompleted: 0,
        questsTotal: 0,
        currentQuest: null
    }),
}));
