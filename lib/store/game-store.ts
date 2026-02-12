import { create } from "zustand";
import { GameState, PlayerRole } from "@/types/game";
import { Quest } from "@/types/quest";
import { getGame, joinGame, startGame, selectRole, completeQuest, refreshGame } from "@/lib/redis/actions";
import { getQuestsByDuration } from "@/lib/constants/quest-pool";

function getTotalQuests(): number {
    return getQuestsByDuration("short").length + getQuestsByDuration("medium").length + getQuestsByDuration("long").length;
}

interface GameStore {
    gameState: GameState | null;
    isLoading: boolean;
    isLaunching: boolean;
    isSelectingRole: boolean;
    isCompletingQuest: boolean;
    isRefreshing: boolean;
    error: string | null;
    errorCode: string | null;
    launchError: string | null;
    roleError: string | null;
    completionError: string | null;
    completionErrorCode: string | null;
    selectedRole: PlayerRole | null;
    questsCompleted: number;
    questsTotal: number;
    currentQuest: Quest | null;
    questAnswered: boolean;

    // Actions
    fetchGame: (id: string, userId?: string) => Promise<void>;
    refreshGameData: (id: string, userId?: string) => Promise<void>;
    join: (gameId: string, playerName: string, userId: string) => Promise<void>;
    launch: (gameId: string) => Promise<boolean>;
    chooseRole: (gameId: string, userId: string, role: PlayerRole) => Promise<boolean>;
    completeQuestAction: (gameId: string, userId: string, questId: string) => Promise<boolean>;
    setCurrentQuest: (quest: Quest) => void;
    clearQuest: () => void;
    setQuestAnswered: (answered: boolean) => void;
    reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
    gameState: null,
    isLoading: false,
    isLaunching: false,
    isSelectingRole: false,
    isCompletingQuest: false,
    isRefreshing: false,
    error: null,
    errorCode: null,
    launchError: null,
    roleError: null,
    completionError: null,
    completionErrorCode: null,
    selectedRole: null,
    questsCompleted: 0,
    questsTotal: 0,
    currentQuest: null,
    questAnswered: false,

    fetchGame: async (id: string, userId?: string) => {
        set({ isLoading: true, error: null, errorCode: null });
        const response = await getGame(id);

        if (response.success && response.data) {
            const updates: Partial<GameStore> = { gameState: response.data, isLoading: false };

            if (userId) {
                const player = response.data.players.find((p) => p.id === userId);
                updates.questsCompleted = player?.completedQuests?.length ?? 0;
                updates.questsTotal = getTotalQuests();
            }

            set(updates);
        } else {
            set({
                error: response.error || "Unknown error",
                errorCode: response.code || null,
                isLoading: false
            });
        }
    },

    refreshGameData: async (id: string, userId?: string) => {
        set({ isRefreshing: true, error: null, errorCode: null });
        const response = await refreshGame(id);

        if (response.success && response.data) {
            const updates: Partial<GameStore> = { 
                gameState: response.data, 
                isRefreshing: false 
            };

            // Update quest counts for current user if available
            if (userId) {
                const updatedPlayer = response.data.players.find((p) => p.id === userId);
                if (updatedPlayer) {
                    updates.questsCompleted = updatedPlayer.completedQuests?.length ?? 0;
                    updates.questsTotal = getTotalQuests();
                }
            }

            set(updates);
        } else {
            set({
                error: response.error || "Unknown error",
                errorCode: response.code || null,
                isRefreshing: false
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

    completeQuestAction: async (gameId: string, userId: string, questId: string) => {
        set({ isCompletingQuest: true, completionError: null, completionErrorCode: null });
        const response = await completeQuest(gameId, userId, questId);

        if (response.success && response.data) {
            set({
                questsCompleted: response.data.questsCompleted,
                isCompletingQuest: false,
                completionError: null,
                completionErrorCode: null,
            });
            return true;
        } else {
            set({
                completionError: response.error || "Unknown error",
                completionErrorCode: response.code || null,
                isCompletingQuest: false,
            });
            return false;
        }
    },

    clearQuest: () => set({ currentQuest: null, questAnswered: false, isCompletingQuest: false, completionError: null, completionErrorCode: null }),

    setQuestAnswered: (answered: boolean) => set({ questAnswered: answered }),

    reset: () => set({ 
        gameState: null, 
        isLoading: false, 
        isLaunching: false, 
        isSelectingRole: false,
        isCompletingQuest: false,
        error: null, 
        errorCode: null, 
        launchError: null,
        roleError: null,
        completionError: null,
        completionErrorCode: null,
        selectedRole: null,
        questsCompleted: 0,
        questsTotal: 0,
        currentQuest: null,
        questAnswered: false
    }),
}));
