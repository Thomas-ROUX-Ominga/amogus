import { create } from "zustand";
import React from "react";
import { GameState, PlayerRole } from "@/types/game";
import { Quest, QuestContentResult } from "@/types/quest";
import { getGame, joinGame, startGame, selectRole, completeQuest, refreshGame, addFailedQuest, getPlayerFailedQuests } from "@/lib/redis/actions";
import { getQuestGamesByDuration } from "@/lib/constants/quest-pool";
import { DynamicContentMapper } from "@/lib/quests/dynamic-content-mapper";
import useSWR from "swr";

function getTotalQuests(): number {
    return getQuestGamesByDuration("short").length + getQuestGamesByDuration("medium").length + getQuestGamesByDuration("long").length;
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
    
    // Story 8.2: Dynamic Content Mapper state
    currentQuestContent: QuestContentResult | null;
    failedQuests: Record<string, string[]>;
    isFailedQuestsLoading: boolean;

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
    
    // Story 8.2: Dynamic Content Mapper actions
    loadDynamicQuestContent: (questId: string, gameId: string, userId: string) => Promise<void>;
    recordFailedQuest: (gameId: string, userId: string, questId: string, contentId: string) => Promise<boolean>;
    loadFailedQuests: (gameId: string, userId: string) => Promise<void>;
    clearQuestContent: () => void;
}

// Real-time polling hook for lobby updates
export function useRealTimeGamePolling(gameId: string, userId?: string, enabled = true) {
    const { refreshGameData } = useGameStore();
    const previousPlayerIds = React.useRef<Set<string>>(new Set());
    
    const fetcher = async () => {
        if (!gameId) return null;
        
        await refreshGameData(gameId, userId);
        const currentState = useGameStore.getState().gameState;
        
        if (!currentState) return null;
        
        // Detect new players by comparing with previous state
        const currentPlayerIds = new Set(currentState.players.map(p => p.id));
        const newPlayerIds = Array.from(currentPlayerIds).filter(id => !previousPlayerIds.current.has(id));
        const newPlayers = currentState.players.filter(p => newPlayerIds.includes(p.id));
        
        // Update previous player IDs for next comparison
        previousPlayerIds.current = currentPlayerIds;
        
        return {
            ...currentState,
            newPlayers,
            playerCount: currentState.players.length,
            isGameInProgress: currentState.status === 'IN_PROGRESS'
        };
    };

    const {
        data,
        error,
        isLoading,
        mutate
    } = useSWR(
        enabled && gameId ? `game:${gameId}:poll` : null,
        fetcher,
        {
            refreshInterval: 2000, // 2-second polling
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            errorRetryCount: 3,
            errorRetryInterval: 1000,
        }
    );

    // Cleanup previous player IDs when hook unmounts or gameId changes
    React.useEffect(() => {
        if (!enabled || !gameId) {
            previousPlayerIds.current.clear();
        }
    }, [gameId, enabled]);

    return {
        gameState: data,
        error,
        isLoading,
        mutate,
        isConnected: !error && !isLoading,
        playerCount: data?.players.length ?? 0,
        isGameInProgress: data?.status === 'IN_PROGRESS',
        newPlayers: data?.newPlayers ?? []
    };
}

export const useGameStore = create<GameStore>((set, get) => ({
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
    
    // Story 8.2: Dynamic Content Mapper state
    currentQuestContent: null,
    failedQuests: {},
    isFailedQuestsLoading: false,

    fetchGame: async (id: string, userId?: string) => {
        set({ isLoading: true, error: null, errorCode: null });
        const response = await getGame(id);

        if (response.success && response.data) {
            const updates: Partial<GameStore> = { gameState: response.data, isLoading: false };

            if (userId) {
                const player = response.data.players.find((p) => p.id === userId);
                updates.questsCompleted = player?.completedQuests?.length ?? 0;
                updates.questsTotal = response.data.questsTotal ?? getTotalQuests();
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
                    updates.questsTotal = response.data.questsTotal ?? getTotalQuests();
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
        questAnswered: false,
        currentQuestContent: null,
        failedQuests: {},
        isFailedQuestsLoading: false,
    }),

    // Story 8.2: Dynamic Content Mapper actions
    loadDynamicQuestContent: async (questId: string, gameId: string, userId: string) => {
        // Story 9.1: Skip content loading for impostors
        const currentState = get();
        const currentPlayer = currentState.gameState?.players.find(p => p.id === userId);
        const isImpostor = currentPlayer?.role === "IMPOSTOR";
        
        if (isImpostor) {
            // Don't load any content for impostors
            set({ currentQuestContent: null });
            return;
        }

        try {
            const contentResult = await DynamicContentMapper.getQuestContent(questId, gameId, userId);
            if (contentResult) {
                set({ currentQuestContent: contentResult });
            } else {
                set({ currentQuestContent: null });
            }
        } catch (error) {
            console.error("Failed to load dynamic quest content:", error);
            set({ currentQuestContent: null });
        }
    },

    recordFailedQuest: async (gameId: string, userId: string, questId: string, contentId: string) => {
        try {
            const response = await addFailedQuest(gameId, userId, questId, contentId);
            if (response.success) {
                // Refresh failed quests after recording
                await get().loadFailedQuests(gameId, userId);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Failed to record failed quest:", error);
            return false;
        }
    },

    loadFailedQuests: async (gameId: string, userId: string) => {
        set({ isFailedQuestsLoading: true });
        try {
            const response = await getPlayerFailedQuests(gameId, userId);
            if (response.success) {
                set({ 
                    failedQuests: response.data ?? {}, 
                    isFailedQuestsLoading: false 
                });
            } else {
                set({ 
                    failedQuests: {}, 
                    isFailedQuestsLoading: false 
                });
            }
        } catch (error) {
            console.error("Failed to load failed quests:", error);
            set({ 
                failedQuests: {}, 
                isFailedQuestsLoading: false 
            });
        }
    },

    clearQuestContent: () => set({ 
        currentQuestContent: null,
        currentQuest: null, 
        questAnswered: false 
    }),
}));
