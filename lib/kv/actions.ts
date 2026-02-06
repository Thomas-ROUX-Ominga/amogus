"use server";

import { v4 as uuidv4 } from "uuid";
import { kv } from "./client";
import { GameState, ActionResponse } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";

export async function createGame(): Promise<ActionResponse<string>> {
    try {
        const gameId = uuidv4();
        const initialState: GameState = {
            id: gameId,
            status: "LOBBY",
            players: [],
            createdAt: Date.now(),
        };

        // Store game state in Redis
        await kv.set(`game:${gameId}:state`, initialState);

        return {
            success: true,
            data: gameId,
        };
    } catch (error) {
        console.error("Failed to create game:", error);
        return {
            success: false,
            error: "Failed to create game. Please try again.",
        };
    }
}

export async function getGame(id: string): Promise<ActionResponse<GameState>> {
    try {
        const state = await kv.get<GameState>(`game:${id}:state`);

        if (!state) {
            return {
                success: false,
                error: "Game module not found or decommissioned.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        return {
            success: true,
            data: state,
        };
    } catch (error) {
        console.error("Failed to fetch game:", error);
        return {
            success: false,
            error: "Failed to establish link with game module.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

export async function joinGame(
    gameId: string,
    playerName: string,
    userId: string
): Promise<ActionResponse<GameState>> {
    // 1. Strict Server-Side Validation
    const sanitizedName = playerName.trim().slice(0, 20);
    if (!sanitizedName) {
        return { success: false, error: "Identification failed: Empty alias.", code: ERROR_CODES.ERR_INVALID_ALIAS };
    }

    // Basic ID format validation (allow UUID or simple non-empty strings for flexibility)
    if (!userId || userId.length < 5) {
        return { success: false, error: "Identification failed: Invalid crew signature.", code: ERROR_CODES.ERR_INVALID_SIGNATURE };
    }

    try {
        const stateKey = `game:${gameId}:state`;
        const state = await kv.get<GameState>(stateKey);

        if (!state) {
            return {
                success: false,
                error: "Game session not found.",
                code: ERROR_CODES.GAME_NOT_FOUND,
            };
        }

        // 2. Concurrency check (Check for existing player again before mutation)
        const existingPlayer = state.players.find((p) => p.id === userId);
        if (existingPlayer) {
            return {
                success: true,
                data: state,
            };
        }

        // 3. Prevent overflow
        if (state.players.length >= 10) {
            return { success: false, error: "Cockpit at maximum capacity.", code: ERROR_CODES.ERR_FULL_CAPACITY };
        }

        // Add new player
        const newPlayer = {
            id: userId,
            name: sanitizedName,
            isAlive: true,
        };

        const updatedState: GameState = {
            ...state,
            players: [...state.players, newPlayer],
        };

        await kv.set(stateKey, updatedState);

        return {
            success: true,
            data: updatedState,
        };
    } catch (error) {
        console.error("Failed to join game:", error);
        return {
            success: false,
            error: "Signal lost while trying to join cockpit.",
            code: ERROR_CODES.ERR_SIGNAL_LOST,
        };
    }
}

