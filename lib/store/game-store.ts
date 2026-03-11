import { create } from "zustand";
import React from "react";
import { GameState, MeetingView, PlayerRole } from "@/types/game";
import { Quest, QuestContentResult } from "@/types/quest";
import {
    getGame,
    joinGame,
    startGame,
    selectRole,
    completeQuest,
    refreshGame,
    addFailedQuest,
    getPlayerFailedQuests,
    eliminatePlayer,
    getGameQuests,
    triggerMeeting,
    getMeetingView,
    castMeetingVote,
    cancelMeetingVote,
} from "@/lib/redis/actions";
import { getTotalQuests } from "@/lib/utils/quest-calculations";
import { DynamicContentMapper } from "@/lib/quests/dynamic-content-mapper";

export type SyncStatus = "connected" | "reconnecting" | "degraded";

const SYNC_SSE_RECONNECT_DELAY_MS = 1500;
const SYNC_FALLBACK_POLL_INTERVAL_MS = 2000;
const SYNC_FAILURES_FOR_DEGRADED = 3;

interface SnapshotApiResponse {
    success: boolean;
    data?: GameState;
    error?: string;
    code?: string;
}

interface HookStateEventPayload {
    gameState?: GameState;
    revision?: number;
    updatedAt?: number;
}

interface HookErrorEventPayload {
    error?: string;
    code?: string;
}

function shouldApplyIncomingGameState(current: GameState | null, incoming: GameState): boolean {
    if (!current || current.id !== incoming.id) {
        return true;
    }

    if (incoming.revision > current.revision) {
        return true;
    }

    if (incoming.revision === current.revision) {
        return incoming.updatedAt >= current.updatedAt;
    }

    return false;
}

function getQuestStatsForUser(gameState: GameState, userId?: string): Pick<GameStore, "questsCompleted" | "questsTotal"> {
    if (!userId) {
        return {
            questsCompleted: 0,
            questsTotal: getTotalQuests(gameState),
        };
    }

    const player = gameState.players.find((entry) => entry.id === userId);
    return {
        questsCompleted: player?.completedQuests?.length ?? 0,
        questsTotal: player?.assignedQuests?.length ?? getTotalQuests(gameState),
    };
}

interface GameStore {
    gameState: GameState | null;
    isLoading: boolean;
    isJoining: boolean;
    isLaunching: boolean;
    isSelectingRole: boolean;
    isCompletingQuest: boolean;
    isRefreshing: boolean;
    syncStatus: SyncStatus;
    consecutiveSyncFailures: number;
    fatalError: string | null;
    fatalErrorCode: string | null;
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
    
    // Store all quests for the current game
    gameQuests: Quest[];
    isGameQuestsLoading: boolean;

    // Story 9.2: Impostor Credible Tracker state
    impostorQuests: Array<Quest & { completed: boolean; location?: string }>;
    impostorQuestsInitialized: boolean;

    // Story 10.2: Self-Elimination Flow state
    isEliminating: boolean;
    eliminationError: string | null;
    eliminationErrorCode: string | null;

    // Meeting state
    meetingView: MeetingView | null;
    isMeetingLoading: boolean;
    isTriggeringMeeting: boolean;
    isMeetingVoting: boolean;
    meetingError: string | null;
    meetingErrorCode: string | null;

    // Actions
    fetchGame: (id: string, userId?: string) => Promise<void>;
    fetchGameQuests: (gameId: string) => Promise<void>;
    refreshGameData: (id: string, userId?: string) => Promise<void>;
    applyRealtimeState: (state: GameState, userId?: string) => void;
    setSyncStatus: (status: SyncStatus) => void;
    recordSyncFailure: () => void;
    resetSyncFailures: () => void;
    setFatalError: (error: string | null, code?: string | null) => void;
    clearFatalError: () => void;
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
    
    // Story 9.2: Impostor Credible Tracker actions
    initializeImpostorQuests: (quests: Array<Quest & { completed: boolean; location?: string }>) => void;
    completeImpostorQuest: (questId: string) => void;
    setImpostorQuestLocation: (questId: string, location: string) => void;
    getImpostorProgress: () => number;
    getImpostorQuestData: () => { quests: Array<Quest & { completed: boolean; location?: string }>; completed: number; total: number; percentage: number; };
    generateImpostorQuestAssignments: (batchQuests: Quest[], distribution: { short: number; medium: number; long: number }) => Array<Quest & { completed: boolean; location?: string }>;
    
    // Story 10.2: Self-Elimination Flow actions
    eliminatePlayerAction: (gameId: string, userId: string) => Promise<boolean>;

    // Meeting actions
    fetchMeetingView: (gameId: string, userId: string) => Promise<void>;
    triggerMeetingAction: (gameId: string, userId: string) => Promise<boolean>;
    castMeetingVoteAction: (gameId: string, userId: string, targetId: string) => Promise<boolean>;
    cancelMeetingVoteAction: (gameId: string, userId: string) => Promise<boolean>;
}

function parseStateEventPayload(raw: string): HookStateEventPayload | null {
    try {
        const parsed = JSON.parse(raw) as HookStateEventPayload;
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        return parsed;
    } catch (error) {
        console.error("Failed to parse state SSE payload:", error);
        return null;
    }
}

function parseErrorEventPayload(raw: string): HookErrorEventPayload | null {
    try {
        const parsed = JSON.parse(raw) as HookErrorEventPayload;
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function isFatalSyncCode(code?: string): boolean {
    return code === "GAME_NOT_FOUND" || code === "ERR_INVALID_SIGNATURE";
}

// Real-time sync hook (SSE + polling fallback)
export function useRealTimeGamePolling(gameId: string, userId?: string, enabled = true) {
    const {
        gameState: gameStateFromStore,
        syncStatus,
        fatalError,
        applyRealtimeState,
        refreshGameData,
        setSyncStatus,
        recordSyncFailure,
        resetSyncFailures,
        setFatalError,
        clearFatalError,
    } = useGameStore();

    const [isLoading, setIsLoading] = React.useState<boolean>(Boolean(enabled && gameId));
    const [syncError, setSyncError] = React.useState<Error | null>(null);
    const [newPlayers, setNewPlayers] = React.useState<GameState["players"]>([]);
    const previousPlayerIds = React.useRef<Set<string>>(new Set());

    const currentPlayer = gameStateFromStore?.players.find((player) => player.id === userId);
    const isEliminated = currentPlayer ? !currentPlayer.isAlive : false;
    const shouldStopPolling = isEliminated && currentPlayer?.role === "IMPOSTOR";
    const isGameFinished = gameStateFromStore?.status === "FINISHED" && gameStateFromStore?.id === gameId;

    React.useEffect(() => {
        if (!gameStateFromStore || gameStateFromStore.id !== gameId) {
            setNewPlayers([]);
            return;
        }

        const currentPlayerIds = new Set(gameStateFromStore.players.map((player) => player.id));
        const freshlyJoined = gameStateFromStore.players.filter(
            (player) => !previousPlayerIds.current.has(player.id)
        );
        previousPlayerIds.current = currentPlayerIds;
        setNewPlayers(freshlyJoined);
    }, [gameStateFromStore, gameId]);

    React.useEffect(() => {
        if (!enabled || !gameId) {
            previousPlayerIds.current.clear();
            setNewPlayers([]);
            setIsLoading(false);
            setSyncError(null);
            return;
        }

        if (!userId) {
            previousPlayerIds.current.clear();
            setNewPlayers([]);
            setIsLoading(false);
            setSyncError(null);
            return;
        }

        if (shouldStopPolling || isGameFinished) {
            setIsLoading(false);
            setSyncError(null);
            return;
        }

        let disposed = false;
        let eventSource: globalThis.EventSource | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let fallbackTimer: ReturnType<typeof setInterval> | null = null;

        const closeEventSource = () => {
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
        };

        const clearReconnectTimer = () => {
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };

        const stopFallbackPolling = () => {
            if (fallbackTimer) {
                clearInterval(fallbackTimer);
                fallbackTimer = null;
            }
        };

        const fetchSnapshot = async (markAsDegraded = false): Promise<boolean> => {
            if (!userId) {
                return false;
            }

            try {
                const response = await fetch(
                    `/api/game/${gameId}/snapshot?userId=${encodeURIComponent(userId)}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );
                const payload = (await response.json()) as SnapshotApiResponse;

                if (!response.ok || !payload.success || !payload.data) {
                    const code = payload.code ?? "ERR_SIGNAL_LOST";
                    const errorMessage = payload.error ?? "Failed to fetch game snapshot.";
                    if (isFatalSyncCode(code)) {
                        setFatalError(errorMessage, code);
                    }
                    throw new Error(errorMessage);
                }

                applyRealtimeState(payload.data, userId);
                resetSyncFailures();
                setSyncStatus(markAsDegraded ? "degraded" : "connected");
                setIsLoading(false);
                setSyncError(null);
                clearFatalError();
                return true;
            } catch (error) {
                console.error("Snapshot fallback failed:", error);
                setSyncError(error as Error);
                recordSyncFailure();
                return false;
            }
        };

        const startFallbackPolling = () => {
            if (fallbackTimer) return;
            fallbackTimer = setInterval(() => {
                void fetchSnapshot(true).then((ok) => {
                    if (!ok && !disposed) {
                        const { consecutiveSyncFailures } = useGameStore.getState();
                        setSyncStatus(
                            consecutiveSyncFailures >= SYNC_FAILURES_FOR_DEGRADED
                                ? "degraded"
                                : "reconnecting"
                        );
                    }
                });
            }, SYNC_FALLBACK_POLL_INTERVAL_MS);
        };

        const scheduleReconnect = () => {
            if (disposed || reconnectTimer) return;
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                if (!disposed) {
                    connectSse();
                }
            }, SYNC_SSE_RECONNECT_DELAY_MS);
        };

        const handleStateEvent = (event: globalThis.MessageEvent<string>) => {
            const payload = parseStateEventPayload(event.data);
            if (!payload?.gameState) {
                return;
            }

            applyRealtimeState(payload.gameState, userId);
            resetSyncFailures();
            setSyncStatus("connected");
            setIsLoading(false);
            setSyncError(null);
            clearFatalError();
            stopFallbackPolling();
        };

        const connectSse = () => {
            if (!userId || disposed) {
                return;
            }

            setSyncStatus("reconnecting");
            closeEventSource();

            try {
                eventSource = new globalThis.EventSource(
                    `/api/game/${gameId}/events?userId=${encodeURIComponent(userId)}`
                );
            } catch (error) {
                console.error("Failed to initialize SSE:", error);
                setSyncError(error as Error);
                startFallbackPolling();
                scheduleReconnect();
                return;
            }

            eventSource.addEventListener("open", () => {
                if (disposed) return;
                setSyncStatus("connected");
                resetSyncFailures();
                setIsLoading(false);
                setSyncError(null);
                stopFallbackPolling();
            });

            eventSource.addEventListener("snapshot", (event) =>
                handleStateEvent(event as globalThis.MessageEvent<string>)
            );
            eventSource.addEventListener("state", (event) =>
                handleStateEvent(event as globalThis.MessageEvent<string>)
            );
            eventSource.addEventListener("heartbeat", () => {
                if (disposed) return;
                if (useGameStore.getState().syncStatus !== "connected") {
                    setSyncStatus("connected");
                }
            });

            eventSource.addEventListener("error", (event) => {
                if (disposed) return;

                const withData = event as unknown as globalThis.MessageEvent<string>;
                const payload = withData.data ? parseErrorEventPayload(withData.data) : null;
                if (payload?.code && isFatalSyncCode(payload.code)) {
                    setFatalError(payload.error ?? "Game sync failed.", payload.code);
                }

                setSyncError(
                    new Error(payload?.error ?? "Connection lost. Attempting to reconnect...")
                );
                recordSyncFailure();
                setSyncStatus("reconnecting");
                startFallbackPolling();

                if (!eventSource || eventSource.readyState === globalThis.EventSource.CLOSED) {
                    closeEventSource();
                    scheduleReconnect();
                }
            });
        };

        setIsLoading(true);
        clearFatalError();
        void fetchSnapshot(false);
        connectSse();

        const handleOnline = () => {
            if (disposed) return;
            setSyncStatus("reconnecting");
            void refreshGameData(gameId, userId);
            connectSse();
        };

        window.addEventListener("online", handleOnline);

        return () => {
            disposed = true;
            window.removeEventListener("online", handleOnline);
            clearReconnectTimer();
            stopFallbackPolling();
            closeEventSource();
        };
    }, [
        enabled,
        gameId,
        userId,
        shouldStopPolling,
        isGameFinished,
        applyRealtimeState,
        refreshGameData,
        setSyncStatus,
        recordSyncFailure,
        resetSyncFailures,
        setFatalError,
        clearFatalError,
    ]);

    React.useEffect(() => {
        if (fatalError) {
            setIsLoading(false);
        }
    }, [fatalError]);

    const effectiveGameState =
        enabled && gameId && gameStateFromStore?.id === gameId ? gameStateFromStore : null;

    return {
        gameState: effectiveGameState,
        error: syncError,
        isLoading,
        mutate: async () => {
            if (!gameId || !userId) return;
            await refreshGameData(gameId, userId);
        },
        isConnected: syncStatus === "connected",
        syncStatus,
        playerCount: effectiveGameState?.players.length ?? 0,
        isGameInProgress: effectiveGameState?.status === "IN_PROGRESS",
        isGameFinished: effectiveGameState?.status === "FINISHED",
        newPlayers: effectiveGameState ? newPlayers : [],
    };
}

export const useGameStore = create<GameStore>((set, get) => ({
    gameState: null,
    isLoading: false,
    isJoining: false,
    isLaunching: false,
    isSelectingRole: false,
    isCompletingQuest: false,
    isRefreshing: false,
    syncStatus: "reconnecting",
    consecutiveSyncFailures: 0,
    fatalError: null,
    fatalErrorCode: null,
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

    gameQuests: [],
    isGameQuestsLoading: false,

    // Story 9.2: Impostor Credible Tracker state
    impostorQuests: [],
    impostorQuestsInitialized: false,

    // Story 10.2: Self-Elimination Flow state
    isEliminating: false,
    eliminationError: null,
    eliminationErrorCode: null,

    // Meeting state
    meetingView: null,
    isMeetingLoading: false,
    isTriggeringMeeting: false,
    isMeetingVoting: false,
    meetingError: null,
    meetingErrorCode: null,

    applyRealtimeState: (incomingState: GameState, userId?: string) => {
        set((state) => {
            if (!shouldApplyIncomingGameState(state.gameState, incomingState)) {
                return {};
            }

            return {
                gameState: incomingState,
                ...getQuestStatsForUser(incomingState, userId),
            };
        });
    },

    setSyncStatus: (status: SyncStatus) => {
        set({ syncStatus: status });
    },

    recordSyncFailure: () => {
        set((state) => {
            const nextFailures = state.consecutiveSyncFailures + 1;
            return {
                consecutiveSyncFailures: nextFailures,
                syncStatus: nextFailures >= SYNC_FAILURES_FOR_DEGRADED ? "degraded" : "reconnecting",
            };
        });
    },

    resetSyncFailures: () => {
        set({ consecutiveSyncFailures: 0, syncStatus: "connected" });
    },

    setFatalError: (fatalError: string | null, fatalErrorCode: string | null = null) => {
        set({
            fatalError,
            fatalErrorCode,
        });
    },

    clearFatalError: () => {
        set({
            fatalError: null,
            fatalErrorCode: null,
        });
    },

    fetchGame: async (id: string, userId?: string) => {
        set({
            isLoading: true,
            error: null,
            errorCode: null,
            fatalError: null,
            fatalErrorCode: null,
        });
        const response = await getGame(id);

        if (response.success && response.data) {
            get().applyRealtimeState(response.data, userId);
            set({
                isLoading: false,
                syncStatus: "connected",
                consecutiveSyncFailures: 0,
            });
        } else {
            set({
                error: response.error || "Unknown error",
                errorCode: response.code || null,
                fatalError: response.error || "Unknown error",
                fatalErrorCode: response.code || null,
                isLoading: false
            });
        }
    },

    fetchGameQuests: async (gameId: string) => {
        set({ isGameQuestsLoading: true });
        const response = await getGameQuests(gameId);

        if (response.success && response.data) {
            set({ gameQuests: response.data, isGameQuestsLoading: false });
        } else {
            console.error("Failed to fetch game quests:", response.error);
            set({ gameQuests: [], isGameQuestsLoading: false });
        }
    },

    refreshGameData: async (id: string, userId?: string) => {
        set({ isRefreshing: true });
        const response = await refreshGame(id);

        if (response.success && response.data) {
            get().applyRealtimeState(response.data, userId);
            set({
                isRefreshing: false,
                syncStatus: "connected",
                consecutiveSyncFailures: 0,
            });
        } else {
            set((state) => {
                const nextFailures = state.consecutiveSyncFailures + 1;
                return {
                    isRefreshing: false,
                    consecutiveSyncFailures: nextFailures,
                    syncStatus:
                        nextFailures >= SYNC_FAILURES_FOR_DEGRADED ? "degraded" : "reconnecting",
                };
            });
        }
    },

    fetchMeetingView: async (gameId: string, userId: string) => {
        set((state) => ({
            isMeetingLoading: !state.meetingView,
            meetingError: null,
            meetingErrorCode: null,
        }));
        const response = await getMeetingView(gameId, userId);

        if (response.success && response.data) {
            set(() => ({
                isMeetingLoading: false,
                meetingView: response.data!,
                meetingError: null,
                meetingErrorCode: null,
            }));
            return;
        }

        set({
            isMeetingLoading: false,
            meetingError: response.error || "Unknown error",
            meetingErrorCode: response.code || null,
        });
    },

    triggerMeetingAction: async (gameId: string, userId: string) => {
        set({ isTriggeringMeeting: true, meetingError: null, meetingErrorCode: null });
        const response = await triggerMeeting(gameId, userId);

        if (response.success && response.data) {
            set(() => ({
                isTriggeringMeeting: false,
                meetingView: response.data!,
                meetingError: null,
                meetingErrorCode: null,
            }));
            return true;
        }

        set({
            isTriggeringMeeting: false,
            meetingError: response.error || "Unknown error",
            meetingErrorCode: response.code || null,
        });
        return false;
    },

    castMeetingVoteAction: async (gameId: string, userId: string, targetId: string) => {
        set({ isMeetingVoting: true, meetingError: null, meetingErrorCode: null });
        const response = await castMeetingVote(gameId, userId, targetId);

        if (response.success && response.data) {
            set(() => ({
                isMeetingVoting: false,
                meetingView: response.data!,
                meetingError: null,
                meetingErrorCode: null,
            }));
            return true;
        }

        set({
            isMeetingVoting: false,
            meetingError: response.error || "Unknown error",
            meetingErrorCode: response.code || null,
        });
        return false;
    },

    cancelMeetingVoteAction: async (gameId: string, userId: string) => {
        set({ isMeetingVoting: true, meetingError: null, meetingErrorCode: null });
        const response = await cancelMeetingVote(gameId, userId);

        if (response.success && response.data) {
            set(() => ({
                isMeetingVoting: false,
                meetingView: response.data!,
                meetingError: null,
                meetingErrorCode: null,
            }));
            return true;
        }

        set({
            isMeetingVoting: false,
            meetingError: response.error || "Unknown error",
            meetingErrorCode: response.code || null,
        });
        return false;
    },

    join: async (gameId: string, playerName: string, userId: string) => {
        set({ isJoining: true, error: null, errorCode: null });
        const response = await joinGame(gameId, playerName, userId);

        if (response.success && response.data) {
            get().applyRealtimeState(response.data, userId);
            set({ isJoining: false });
        } else {
            set({
                error: response.error || "Unknown error",
                errorCode: response.code || null,
                isJoining: false
            });
        }
    },

    launch: async (gameId: string) => {
        set({ isLaunching: true, launchError: null });
        const response = await startGame(gameId);

        if (response.success && response.data) {
            get().applyRealtimeState(response.data);
            set({ isLaunching: false, launchError: null });
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
                get().applyRealtimeState(gameResponse.data, userId);
                set({
                    selectedRole: response.data.role,
                    isSelectingRole: false,
                    roleError: null,
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

    setCurrentQuest: (quest: Quest) =>
        set((state) => ({
            currentQuest: quest,
            currentQuestContent:
                state.currentQuestContent?.questId === quest.id ? state.currentQuestContent : null,
        })),

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

    clearQuest: () => set({
        currentQuest: null,
        currentQuestContent: null,
        questAnswered: false,
        isCompletingQuest: false,
        completionError: null,
        completionErrorCode: null,
    }),

    setQuestAnswered: (answered: boolean) => set({ questAnswered: answered }),

    reset: () => set({ 
        gameState: null, 
        isLoading: false, 
        isJoining: false,
        isLaunching: false, 
        isSelectingRole: false,
        isCompletingQuest: false,
        isRefreshing: false,
        syncStatus: "reconnecting",
        consecutiveSyncFailures: 0,
        fatalError: null,
        fatalErrorCode: null,
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
        impostorQuests: [],
        impostorQuestsInitialized: false,
        isEliminating: false,
        eliminationError: null,
        eliminationErrorCode: null,
        meetingView: null,
        isMeetingLoading: false,
        isTriggeringMeeting: false,
        isMeetingVoting: false,
        meetingError: null,
        meetingErrorCode: null,
        gameQuests: [],
        isGameQuestsLoading: false,
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
            set((state) => {
                const activeQuestId = state.currentQuest?.id;
                if (activeQuestId && activeQuestId !== questId) {
                    return {};
                }

                if (!contentResult || contentResult.questId !== questId) {
                    return { currentQuestContent: null };
                }

                return { currentQuestContent: contentResult };
            });
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

    // Story 9.2: Impostor Credible Tracker actions
    initializeImpostorQuests: (quests: Array<Quest & { completed: boolean; location?: string }>) => {
        set({ 
            impostorQuests: quests,
            impostorQuestsInitialized: true 
        });
    },

    completeImpostorQuest: (questId: string) => {
        set((state) => ({
            impostorQuests: state.impostorQuests.map((quest) =>
                quest.id === questId ? { ...quest, completed: true } : quest
            )
        }));
    },

    setImpostorQuestLocation: (questId: string, location: string) => {
        set((state) => ({
            impostorQuests: state.impostorQuests.map((quest) =>
                quest.id === questId ? { ...quest, location } : quest
            )
        }));
    },

    getImpostorProgress: () => {
        const { impostorQuests } = get();
        if (impostorQuests.length === 0) return 0;
        const completed = impostorQuests.filter(q => q.completed).length;
        return Math.round((completed / impostorQuests.length) * 100);
    },

    getImpostorQuestData: () => {
        const { impostorQuests } = get();
        const completed = impostorQuests.filter(q => q.completed).length;
        const total = impostorQuests.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        return {
            quests: impostorQuests,
            completed,
            total,
            percentage
        };
    },

    generateImpostorQuestAssignments: (batchQuests: Quest[], distribution: { short: number; medium: number; long: number }) => {
        const assignments: Array<Quest & { completed: boolean; location?: string }> = [];

        const shortQuests = batchQuests.filter(q => q.duration === 'short');
        const mediumQuests = batchQuests.filter(q => q.duration === 'medium');
        const longQuests = batchQuests.filter(q => q.duration === 'long');

        // Helper to select random quests and assign locations
        const selectRandomQuests = (quests: Quest[], count: number) => {
            const shuffled = [...quests].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, Math.min(count, quests.length));
        };

        // Select quests from each duration
        const selectedShort = selectRandomQuests(shortQuests, distribution.short);
        const selectedMedium = selectRandomQuests(mediumQuests, distribution.medium);
        const selectedLong = selectRandomQuests(longQuests, distribution.long);

        // Create assignments - location will be set when scanning
        [...selectedShort, ...selectedMedium, ...selectedLong].forEach((quest) => {
            assignments.push({
                ...quest,
                location: undefined, // Will be set when QR code is scanned
                completed: false
            });
        });

        return assignments;
    },

    // Story 10.2: Self-Elimination Flow actions
    eliminatePlayerAction: async (gameId: string, userId: string) => {
        set({ isEliminating: true, eliminationError: null, eliminationErrorCode: null });
        const response = await eliminatePlayer(gameId, userId);

        if (response.success && response.data) {
            // Refresh game state to get updated player data
            const gameResponse = await getGame(gameId);
            
            if (gameResponse.success && gameResponse.data) {
                get().applyRealtimeState(gameResponse.data, userId);
                set({
                    isEliminating: false,
                    eliminationError: null,
                    eliminationErrorCode: null,
                });
            } else {
                // Fallback: update locally if fetch fails
                set((state) => {
                    const updatedPlayers = state.gameState?.players.map((p) =>
                        p.id === userId ? { ...p, isAlive: response.data!.isAlive } : p
                    );
                    return {
                        isEliminating: false,
                        eliminationError: null,
                        eliminationErrorCode: null,
                        gameState: state.gameState
                            ? { ...state.gameState, players: updatedPlayers ?? state.gameState.players }
                            : null,
                    };
                });
            }
            return true;
        } else {
            set({
                eliminationError: response.error || "Unknown error",
                eliminationErrorCode: response.code || null,
                isEliminating: false,
            });
            return false;
        }
    },
}));
