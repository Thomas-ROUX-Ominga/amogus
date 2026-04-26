import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReactorSabotageAlert } from "@/components/game/reactor-sabotage-alert";
import type { GameState } from "@/types/game";

function createGameState(overrides: Partial<GameState> = {}): GameState {
    const now = Date.now();

    return {
        id: "game-1",
        status: "IN_PROGRESS",
        createdAt: now - 120_000,
        revision: 1,
        updatedAt: now,
        players: [],
        sabotages: {
            communications: { qrId: "communications-qr", location: "Pont" },
            lights: { qrId: "lights-qr", location: "Électrique" },
            reactor: [
                { qrId: "reactor-a", location: "Garage" },
                { qrId: "reactor-b", location: "Cuisine" },
            ],
        },
        sabotageState: {
            active: "REACTOR",
            reactor: {
                startedAt: now - 30_000,
                endsAt: now + 60_000,
                scannedByQrId: ["reactor-a"],
                scannedUserIds: ["crew-1"],
            },
            cooldowns: {
                communicationsAvailableAt: 0,
                lightsAvailableAt: 0,
                reactorAvailableAt: 0,
            },
        },
        ...overrides,
    };
}

describe("ReactorSabotageAlert", () => {
    it("does not render when reactor sabotage is not active", () => {
        render(
            <ReactorSabotageAlert
                gameState={createGameState({
                    sabotageState: {
                        active: "LIGHTS",
                        reactor: null,
                        cooldowns: {
                            communicationsAvailableAt: 0,
                            lightsAvailableAt: 0,
                            reactorAvailableAt: 0,
                        },
                    },
                })}
            />,
        );

        expect(screen.queryByText("ALERTE RÉACTEUR")).not.toBeInTheDocument();
    });

    it("renders both reactor locations with their disarm status", () => {
        render(<ReactorSabotageAlert gameState={createGameState()} />);

        expect(screen.getByText("Réacteur A")).toBeInTheDocument();
        expect(screen.getByText("Garage")).toBeInTheDocument();
        expect(screen.getByText("Réacteur B")).toBeInTheDocument();
        expect(screen.getByText("Cuisine")).toBeInTheDocument();
        expect(screen.getByText("Désamorcé")).toBeInTheDocument();
        expect(screen.getByText("À désamorcer")).toBeInTheDocument();
    });

    it("uses the unknown location fallback for missing reactor locations", () => {
        render(
            <ReactorSabotageAlert
                gameState={createGameState({
                    sabotages: {
                        communications: { qrId: "communications-qr", location: "Pont" },
                        lights: { qrId: "lights-qr", location: "Électrique" },
                        reactor: [
                            { qrId: "reactor-a", location: "" },
                            { qrId: "reactor-b", location: "Cuisine" },
                        ],
                    },
                })}
            />,
        );

        expect(screen.getByText("Lieu non renseigné")).toBeInTheDocument();
    });
});
