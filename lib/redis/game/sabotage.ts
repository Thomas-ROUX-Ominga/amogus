"use server";

import { GameState, ActionResponse, PlayerRole, ReactorSabotageState } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { BatchSabotages, SabotageType } from "@/types/quest";
import { resolveGameTimerSettings, secondsToMs } from "@/lib/game/timers";
import {
    mutateGameState,
    resolveRuntimeTransitions,
    resolveActionAccess,
    sanitizeGameStateForViewer,
    getNormalizedSabotageState,
    getPostMeetingGraceRemainingMs,
    getReactorRemainingMs,
} from "./state-core";

export interface TriggerSabotageResult {
    event?: "COMMUNICATIONS_ACTIVATED" | "LIGHTS_ACTIVATED" | "REACTOR_ACTIVATED";
    reactorProgress?: {
        scanned: number;
        total: number;
        remainingMs: number;
    };
    gameState?: GameState;
}
export async function triggerSabotage(
    gameId: string,
    userId: string,
    type: SabotageType
): Promise<ActionResponse<TriggerSabotageResult>> {
    try {
        const accessScope = await resolveActionAccess(gameId, userId);
        if (!accessScope.success || !accessScope.data) {
            return {
                success: false,
                error: accessScope.error || "Session verification failed",
                code: accessScope.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }
        userId = accessScope.data.viewerUserId;

        let validationError: ActionResponse<TriggerSabotageResult> | null = null;
        const now = Date.now();

        const updatedState = await mutateGameState(gameId, (state) => {
            const workingState = resolveRuntimeTransitions(state, now);

            if (workingState.status !== "IN_PROGRESS") {
                validationError = {
                    success: false,
                    error: "Cannot trigger sabotage: game is not in progress.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                };
                return null;
            }

            const player = workingState.players.find((entry) => entry.id === userId);
            if (!player) {
                validationError = {
                    success: false,
                    error: "Player not found in game.",
                    code: ERROR_CODES.ERR_INVALID_SIGNATURE,
                };
                return null;
            }

            if (player.role !== "IMPOSTOR") {
                validationError = {
                    success: false,
                    error: "Only impostors can trigger sabotage.",
                    code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                };
                return null;
            }

            const postMeetingGraceRemainingMs = getPostMeetingGraceRemainingMs(workingState, now);
            if (postMeetingGraceRemainingMs > 0) {
                validationError = {
                    success: false,
                    error: "Post-meeting grace is active. Sabotage cannot be triggered yet.",
                    code: ERROR_CODES.ERR_SABOTAGE_BLOCKED_BY_POST_MEETING_GRACE,
                };
                return null;
            }

            const sabotageState = getNormalizedSabotageState(workingState);
            const timerSettings = resolveGameTimerSettings(workingState);
            const sabotageDurationMs = secondsToMs(timerSettings.sabotageDurationSeconds);
            if (sabotageState.active) {
                validationError = {
                    success: false,
                    error: "A sabotage is already active.",
                    code: ERROR_CODES.ERR_SABOTAGE_ALREADY_ACTIVE,
                };
                return null;
            }

            const sabotageConfig = workingState.sabotages;
            const hasLightsQr = Boolean(
                (workingState.sabotages as (Partial<BatchSabotages> & { lights?: { qrId: string } }) | undefined)
                    ?.lights?.qrId
            );
            if (!sabotageConfig || (type === "LIGHTS" && !hasLightsQr)) {
                validationError = {
                    success: false,
                    error: "This sabotage is not configured for this game.",
                    code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                };
                return null;
            }

            const cooldownMap = {
                COMMUNICATIONS: sabotageState.cooldowns.communicationsAvailableAt,
                LIGHTS: sabotageState.cooldowns.lightsAvailableAt,
                REACTOR: sabotageState.cooldowns.reactorAvailableAt,
            } as const;
            if (now < cooldownMap[type]) {
                validationError = {
                    success: false,
                    error: "Sabotage is on cooldown.",
                    code: ERROR_CODES.ERR_SABOTAGE_COOLDOWN,
                };
                return null;
            }

            const updatedState: GameState =
                type === "REACTOR"
                    ? {
                          ...workingState,
                          sabotageState: {
                              ...sabotageState,
                              active: "REACTOR",
                              reactor: {
                                  startedAt: now,
                                  endsAt: now + sabotageDurationMs,
                                  scannedByQrId: [],
                                  scannedUserIds: [],
                              },
                          },
                      }
                    : {
                          ...workingState,
                          sabotageState: {
                              ...sabotageState,
                              active: type,
                              reactor: null,
                          },
                      };

            return updatedState;
        });

        if (validationError) {
            return validationError;
        }

        if (!updatedState) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        const sanitizedState = sanitizeGameStateForViewer(updatedState, {
            viewerUserId: userId,
            isOrganizer: false,
        });

        return {
            success: true,
            data: {
                event:
                    type === "COMMUNICATIONS"
                        ? "COMMUNICATIONS_ACTIVATED"
                        : type === "LIGHTS"
                        ? "LIGHTS_ACTIVATED"
                        : "REACTOR_ACTIVATED",
                reactorProgress:
                    type === "REACTOR"
                        ? {
                              scanned: 0,
                              total: 2,
                              remainingMs: secondsToMs(
                                  resolveGameTimerSettings(updatedState).sabotageDurationSeconds
                              ),
                          }
                        : undefined,
                gameState: sanitizedState,
            },
        };
    } catch (error) {
        console.error("Failed to trigger sabotage:", error);
        return {
            success: false,
            error: "Failed to trigger sabotage.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}
export interface ScanSabotageResult {
    handled: boolean;
    event?:
        | "COMMUNICATIONS_REPAIRED"
        | "LIGHTS_REPAIRED"
        | "REACTOR_PROGRESS"
        | "REACTOR_REPAIRED"
        | "REACTOR_ALREADY_SCANNED"
        | "REACTOR_DISTINCT_CREWMATE_REQUIRED";
    reactorProgress?: {
        scanned: number;
        total: number;
        remainingMs: number;
    };
    gameState?: GameState;
}
export async function scanSabotage(
    gameId: string,
    userId: string,
    qrId: string
): Promise<ActionResponse<ScanSabotageResult>> {
    try {
        const accessScope = await resolveActionAccess(gameId, userId);
        if (!accessScope.success || !accessScope.data) {
            return {
                success: false,
                error: accessScope.error || "Session verification failed",
                code: accessScope.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }
        userId = accessScope.data.viewerUserId;

        let validationError: ActionResponse<ScanSabotageResult> | null = null;
        let scanResult: ScanSabotageResult | null = null;
        const now = Date.now();

        const result = await mutateGameState(gameId, (state) => {
            const workingState = resolveRuntimeTransitions(state, now);

            const sabotages = workingState.sabotages;
            const isCommsQr = sabotages?.communications.qrId === qrId;
            const isLightsQr = (
                workingState.sabotages as (Partial<BatchSabotages> & { lights?: { qrId: string } }) | undefined
            )?.lights?.qrId === qrId;
            const reactorIndex = sabotages?.reactor.findIndex((entry) => entry.qrId === qrId) ?? -1;
            const isReactorQr = reactorIndex >= 0;
            const isSabotageQr = isCommsQr || isLightsQr || isReactorQr;

            if (!isSabotageQr) {
                validationError = {
                    success: true,
                    data: { handled: false },
                };
                return null;
            }

            if (workingState.status !== "IN_PROGRESS") {
                validationError = {
                    success: false,
                    error: "Cannot scan sabotage: game is not in progress.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                    data: { handled: true },
                };
                return null;
            }

            const player = workingState.players.find((entry) => entry.id === userId);
            if (!player) {
                validationError = {
                    success: false,
                    error: "Player not found in game.",
                    code: ERROR_CODES.ERR_INVALID_SIGNATURE,
                    data: { handled: true },
                };
                return null;
            }

            if (!player.isAlive || !player.role) {
                validationError = {
                    success: false,
                    error: "You are not allowed to use sabotage systems.",
                    code: ERROR_CODES.ERR_SABOTAGE_FORBIDDEN,
                    data: { handled: true },
                };
                return null;
            }

            const sabotageState = getNormalizedSabotageState(workingState);
            const timerSettings = resolveGameTimerSettings(workingState);
            const sabotageCooldownMs = secondsToMs(timerSettings.sabotageCooldownSeconds);

            if (isCommsQr || isLightsQr) {
                const type: SabotageType = isCommsQr ? "COMMUNICATIONS" : "LIGHTS";
                if (sabotageState.active !== type) {
                    validationError = {
                        success: false,
                        error: `${type} sabotage is not active.`,
                        code: ERROR_CODES.ERR_SABOTAGE_NOT_ACTIVE,
                        data: { handled: true },
                    };
                    return null;
                }

                const updatedState: GameState = {
                    ...workingState,
                    sabotageState: {
                        ...sabotageState,
                        active: null,
                        cooldowns: {
                            ...sabotageState.cooldowns,
                            communicationsAvailableAt: isCommsQr
                                ? now + sabotageCooldownMs
                                : sabotageState.cooldowns.communicationsAvailableAt,
                            lightsAvailableAt: isLightsQr
                                ? now + sabotageCooldownMs
                                : sabotageState.cooldowns.lightsAvailableAt,
                        },
                    },
                };

                scanResult = {
                    handled: true,
                    event: isCommsQr ? "COMMUNICATIONS_REPAIRED" : "LIGHTS_REPAIRED",
                    gameState: updatedState,
                };
                return updatedState;
            }

            if (isReactorQr) {
                if (sabotageState.active !== "REACTOR" || !sabotageState.reactor) {
                    validationError = {
                        success: false,
                        error: "Reactor sabotage is not active.",
                        code: ERROR_CODES.ERR_SABOTAGE_NOT_ACTIVE,
                        data: { handled: true },
                    };
                    return null;
                }

                const currentReactor = sabotageState.reactor as ReactorSabotageState;
                if (currentReactor.scannedByQrId.includes(qrId)) {
                    scanResult = {
                        handled: true,
                        event: "REACTOR_ALREADY_SCANNED",
                        reactorProgress: {
                            scanned: currentReactor.scannedByQrId.length,
                            total: 2,
                            remainingMs: getReactorRemainingMs(currentReactor, now),
                        },
                        gameState: workingState,
                    };
                    return workingState;
                }

                if (currentReactor.scannedUserIds.includes(userId)) {
                    scanResult = {
                        handled: true,
                        event: "REACTOR_DISTINCT_CREWMATE_REQUIRED",
                        reactorProgress: {
                            scanned: currentReactor.scannedByQrId.length,
                            total: 2,
                            remainingMs: getReactorRemainingMs(currentReactor, now),
                        },
                        gameState: workingState,
                    };
                    return workingState;
                }

                const scannedByQrId = [...currentReactor.scannedByQrId, qrId];
                const scannedUserIds = [...currentReactor.scannedUserIds, userId];
                // BatchSabotages.reactor is typed as [SabotageLocation, SabotageLocation] — always exactly 2 stations
                const repaired = scannedByQrId.length >= 2;

                const updatedState: GameState = {
                    ...workingState,
                    sabotageState: {
                        ...sabotageState,
                        active: repaired ? null : "REACTOR",
                        reactor: repaired
                            ? null
                            : {
                                  ...currentReactor,
                                  scannedByQrId,
                                  scannedUserIds,
                              },
                        cooldowns: {
                            ...sabotageState.cooldowns,
                            reactorAvailableAt: repaired
                                ? now + sabotageCooldownMs
                                : sabotageState.cooldowns.reactorAvailableAt,
                        },
                    },
                };

                scanResult = {
                    handled: true,
                    event: repaired ? "REACTOR_REPAIRED" : "REACTOR_PROGRESS",
                    reactorProgress: {
                        scanned: scannedByQrId.length,
                        total: 2,
                        remainingMs: repaired ? 0 : getReactorRemainingMs(currentReactor, now),
                    },
                    gameState: updatedState,
                };
                return updatedState;
            }

            validationError = {
                success: true,
                data: { handled: false },
            };
            return null;
        });

        if (validationError) {
            return validationError;
        }

        if (!result) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        const fallbackState = sanitizeGameStateForViewer(result, {
            viewerUserId: userId,
            isOrganizer: false,
        });

        const resolvedScanResult = scanResult as ScanSabotageResult | null;

        let sanitizedScanState: GameState | undefined;
        if (resolvedScanResult && resolvedScanResult.gameState) {
            sanitizedScanState = sanitizeGameStateForViewer(resolvedScanResult.gameState, {
                viewerUserId: userId,
                isOrganizer: false,
            });
        }

        if (!resolvedScanResult) {
            return {
                success: true,
                data: { handled: false, gameState: fallbackState },
            };
        }

        return {
            success: true,
            data: {
                handled: resolvedScanResult.handled,
                event: resolvedScanResult.event,
                reactorProgress: resolvedScanResult.reactorProgress,
                gameState: sanitizedScanState,
            },
        };
    } catch (error) {
        console.error("Failed to scan sabotage:", error);
        return {
            success: false,
            error: "Failed to process sabotage scan.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}
export async function selectRole(
    gameId: string,
    userId: string,
    role: PlayerRole
): Promise<ActionResponse<{ role: PlayerRole }>> {
    // Validate role value
    if (role !== "CREWMATE" && role !== "IMPOSTOR") {
        return {
            success: false,
            error: "Invalid role selection.",
            code: ERROR_CODES.ERR_INVALID_ROLE,
        };
    }

    try {
        const accessScope = await resolveActionAccess(gameId, userId);
        if (!accessScope.success || !accessScope.data) {
            return {
                success: false,
                error: accessScope.error || "Session verification failed",
                code: accessScope.code || ERROR_CODES.ERR_INVALID_SESSION,
            };
        }
        userId = accessScope.data.viewerUserId;

        let validationError: ActionResponse<{ role: PlayerRole }> | null = null;

        const updatedState = await mutateGameState(gameId, (state) => {
            const now = Date.now();
            const workingState = resolveRuntimeTransitions(state, now);

            // New behavior: configured games use automatic role assignment only.
            if (workingState.impostorMode !== undefined) {
                validationError = {
                    success: false,
                    error: "Roles are assigned automatically when the game starts.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                };
                return null;
            }

            if (workingState.status !== "IN_PROGRESS") {
                validationError = {
                    success: false,
                    error: "Cannot select role: game is not in progress.",
                    code: ERROR_CODES.ERR_INVALID_STATE,
                };
                return null;
            }

            const playerIndex = workingState.players.findIndex((p) => p.id === userId);
            if (playerIndex === -1) {
                validationError = {
                    success: false,
                    error: "Player not found in game.",
                    code: ERROR_CODES.ERR_INVALID_SIGNATURE,
                };
                return null;
            }

            const updatedPlayers = [...workingState.players];
            updatedPlayers[playerIndex] = {
                ...updatedPlayers[playerIndex],
                role,
                assignedQuests: role === "IMPOSTOR" ? undefined : updatedPlayers[playerIndex].assignedQuests,
            };

            return {
                ...workingState,
                players: updatedPlayers,
            };
        });

        if (validationError) {
            return validationError;
        }

        if (!updatedState) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        return {
            success: true,
            data: { role },
        };
    } catch (error) {
        console.error("Failed to select role:", error);
        return {
            success: false,
            error: "Signal lost while assigning role.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

