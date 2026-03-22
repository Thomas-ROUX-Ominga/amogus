import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestProgress } from "@/components/game/quest-progress";

const mockUseGameStore = vi.hoisted(() => vi.fn());

vi.mock("@/lib/store/game-store", () => ({
    useGameStore: mockUseGameStore,
}));

vi.mock("@/lib/redis/actions", () => ({
    triggerSabotage: vi.fn(),
}));

describe("QuestProgress", () => {
    const DOCUMENT_POSITION_FOLLOWING = 4;

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseGameStore.mockReturnValue({
            gameQuests: [],
            fetchGameQuests: vi.fn(),
            isGameQuestsLoading: false,
            gameState: {
                id: "game-1",
                status: "IN_PROGRESS",
                createdAt: Date.now(),
                revision: 1,
                updatedAt: Date.now(),
                players: [],
                sabotageState: {
                    active: null,
                    reactor: null,
                    cooldowns: {
                        communicationsAvailableAt: 0,
                        lightsAvailableAt: 0,
                        reactorAvailableAt: 0,
                    },
                },
            },
        });
    });

    it("renders crewmate progress title", () => {
        render(<QuestProgress role="CREWMATE" completed={0} total={0} />);
        expect(screen.getByText("Progression des quêtes")).toBeTruthy();
    });

    it("renders sabotage panel for impostor with locations", () => {
        mockUseGameStore.mockReturnValue({
            gameQuests: [],
            fetchGameQuests: vi.fn(),
            isGameQuestsLoading: false,
            gameState: {
                id: "game-1",
                status: "IN_PROGRESS",
                createdAt: Date.now(),
                revision: 1,
                updatedAt: Date.now(),
                players: [
                    { id: "i1", name: "Alpha", role: "IMPOSTOR", isAlive: true },
                    { id: "i2", name: "Bravo", role: "IMPOSTOR", isAlive: true },
                ],
                sabotages: {
                    communications: { qrId: "comms-1", location: "Salon" },
                    lights: { qrId: "lights-1", location: "Électrique" },
                    reactor: [
                        { qrId: "reactor-a", location: "Garage" },
                        { qrId: "reactor-b", location: "Cuisine" },
                    ],
                },
                sabotageState: {
                    active: "REACTOR",
                    reactor: {
                        startedAt: Date.now(),
                        endsAt: Date.now() + 60000,
                        scannedByQrId: ["reactor-a"],
                        scannedUserIds: ["crew-1"],
                    },
                    cooldowns: {
                        communicationsAvailableAt: 0,
                        lightsAvailableAt: 0,
                        reactorAvailableAt: 0,
                    },
                },
            },
        });

        render(
            <QuestProgress
                role="IMPOSTOR"
                completed={0}
                total={0}
                currentPlayerId="i1"
            />,
        );

        expect(screen.getByText("Panneau sabotage imposteur")).toBeTruthy();
        expect(screen.getByText("Bravo")).toBeTruthy();
        expect(screen.getByText("Salon")).toBeTruthy();
        expect(screen.getByText("Électrique")).toBeTruthy();
        expect(screen.getByText(/Garage/)).toBeTruthy();
        expect(screen.getAllByText("Réacteur 1/2").length).toBeGreaterThan(0);
    });

    it("hides crewmate quest list during lights sabotage", () => {
        render(
            <QuestProgress
                role="CREWMATE"
                completed={1}
                total={3}
                lightsSabotaged
            />,
        );

        expect(screen.getByText("LUMIÈRES SABOTÉES")).toBeTruthy();
    });

    it("renders progress bar with correct attributes for crewmates", () => {
        render(<QuestProgress role="CREWMATE" completed={2} total={4} />);
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.getAttribute("aria-valuenow")).toBe("2");
        expect(progressBar.getAttribute("aria-valuemax")).toBe("4");
    });

    it("places completed assigned quests at the end of the list", async () => {
        mockUseGameStore.mockReturnValue({
            gameQuests: [
                { id: "q1", type: "qcm", duration: "short", location: "Pont" },
                { id: "q2", type: "qcm", duration: "short", location: "Cuisine" },
                { id: "q3", type: "qcm", duration: "short", location: "Moteur" },
            ],
            fetchGameQuests: vi.fn(),
            isGameQuestsLoading: false,
            gameState: {
                id: "game-1",
                status: "IN_PROGRESS",
                createdAt: Date.now(),
                revision: 1,
                updatedAt: Date.now(),
                players: [],
                sabotageState: {
                    active: null,
                    reactor: null,
                    cooldowns: {
                        communicationsAvailableAt: 0,
                        lightsAvailableAt: 0,
                        reactorAvailableAt: 0,
                    },
                },
            },
        });

        render(
            <QuestProgress
                role="CREWMATE"
                completed={1}
                total={3}
                batchId="batch-1"
                assignedQuests={["q1", "q2", "q3"]}
                completedQuests={["q2"]}
            />,
        );

        const pontNode = await screen.findByText("Pont");
        const moteurNode = screen.getByText("Moteur");
        const cuisineNode = screen.getByText("Cuisine");

        expect(
            Boolean(
                pontNode.compareDocumentPosition(cuisineNode) &
                    DOCUMENT_POSITION_FOLLOWING,
            ),
        ).toBe(true);
        expect(
            Boolean(
                moteurNode.compareDocumentPosition(cuisineNode) &
                    DOCUMENT_POSITION_FOLLOWING,
            ),
        ).toBe(true);
    });
});
