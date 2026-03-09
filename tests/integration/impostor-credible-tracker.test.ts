import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { GameHome } from "@/components/game/game-home";
import { GameState, Player } from "@/types/game";
import { useGameStore } from "@/lib/store/game-store";

vi.mock("@/hooks/use-camera-scanner", () => ({
    useCameraScanner: () => ({
        isOpen: false,
        isLoading: false,
        openScanner: vi.fn(),
        closeScanner: vi.fn(),
        handleScan: vi.fn(),
    }),
}));

vi.mock("@/lib/redis/actions", () => ({
    scanSabotage: vi.fn().mockResolvedValue({ success: true, data: { handled: false } }),
}));

describe("Impostor Sabotage Panel Integration", () => {
    let mockGameState: GameState;
    let mockImpostorPlayer: Player;

    beforeEach(() => {
        const { reset } = useGameStore.getState();
        reset();

        mockGameState = {
            id: "test-game",
            status: "IN_PROGRESS",
            players: [
                { id: "impostor-1", name: "Alpha", role: "IMPOSTOR", isAlive: true },
                { id: "impostor-2", name: "Bravo", role: "IMPOSTOR", isAlive: true },
                { id: "crew-1", name: "Charlie", role: "CREWMATE", isAlive: true },
            ],
            createdAt: Date.now(),
            questsTotal: 3,
            questsPerPlayer: { short: 1, medium: 1, long: 1 },
            sabotages: {
                communications: { qrId: "comms-qr", location: "Hall" },
                reactor: [
                    { qrId: "reactor-a", location: "Garage" },
                    { qrId: "reactor-b", location: "Kitchen" },
                ],
            },
            sabotageState: {
                active: null,
                reactor: null,
                cooldowns: {
                    communicationsAvailableAt: 0,
                    reactorAvailableAt: 0,
                },
            },
        };

        mockImpostorPlayer = {
            id: "impostor-1",
            name: "Alpha",
            role: "IMPOSTOR",
            completedQuests: [],
            isAlive: true,
        };

        useGameStore.setState({
            gameState: mockGameState,
            questsCompleted: 0,
            questsTotal: 3,
        });
    });

    it("displays impostor teammates and sabotage locations", () => {
        render(
            React.createElement(GameHome, {
                gameState: mockGameState,
                currentPlayer: mockImpostorPlayer,
                userId: "impostor-1",
            }),
        );

        expect(screen.getByText("Panneau sabotage imposteur")).toBeInTheDocument();
        expect(screen.getByText("Bravo")).toBeInTheDocument();
        expect(screen.getByText("Hall")).toBeInTheDocument();
        expect(screen.getByText("Garage")).toBeInTheDocument();
        expect(screen.getByText("Kitchen")).toBeInTheDocument();
    });

    it("shows reactor progress state when reactor sabotage is active", () => {
        mockGameState.sabotageState = {
            active: "REACTOR",
            reactor: {
                startedAt: Date.now() - 5000,
                endsAt: Date.now() + 60000,
                scannedByQrId: ["reactor-a"],
                scannedUserIds: ["crew-1"],
            },
            cooldowns: {
                communicationsAvailableAt: 0,
                reactorAvailableAt: 0,
            },
        };

        render(
            React.createElement(GameHome, {
                gameState: mockGameState,
                currentPlayer: mockImpostorPlayer,
                userId: "impostor-1",
            }),
        );

        expect(screen.getAllByText("Réacteur 1/2").length).toBeGreaterThan(0);
    });
});
