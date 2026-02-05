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
        };
    }
}
