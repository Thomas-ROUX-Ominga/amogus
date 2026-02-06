"use server";

import { v4 as uuidv4 } from "uuid";
import { kv } from "./client";
import { GameState, ActionResponse } from "@/types/game";

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
                code: "GAME_NOT_FOUND",
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
            code: "ERR_SIGNAL_LOST",
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
        return { success: false, error: "Identification failed: Empty alias." };
    }

    // UUID v4 regex validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
        return { success: false, error: "Identification failed: Invalid crew signature." };
    }

    try {
        const stateKey = `game:${gameId}:state`;
        const state = await kv.get<GameState>(stateKey);

        if (!state) {
            return {
                success: false,
                error: "Game session not found.",
                code: "GAME_NOT_FOUND",
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
            return { success: false, error: "Cockpit at maximum capacity." };
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
            code: "ERR_SIGNAL_LOST",
        };
    }
}

