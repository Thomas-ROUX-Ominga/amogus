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

    it("disables impostor sabotage actions during post-meeting grace", () => {
        vi.useFakeTimers();
        const now = new Date("2026-03-22T12:00:00.000Z").getTime();
        vi.setSystemTime(now);
        try {
            mockUseGameStore.mockReturnValue({
                gameQuests: [],
                fetchGameQuests: vi.fn(),
                isGameQuestsLoading: false,
                gameState: {
                    id: "game-1",
                    status: "IN_PROGRESS",
                    createdAt: now - 300_000,
                    revision: 1,
                    updatedAt: now - 300_000,
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
                        active: null,
                        reactor: null,
                        cooldowns: {
                            communicationsAvailableAt: 0,
                            lightsAvailableAt: 0,
                            reactorAvailableAt: 0,
                        },
                    },
                    meeting: {
                        id: "meeting-prev",
                        status: "COMPLETED",
                        startedAt: now - 30_000,
                        endsAt: now - 10_000,
                        startedBy: "i2",
                        snapshot: {
                            capturedAt: now - 30_000,
                            progress: { completed: 0, total: 2, percentage: 0 },
                            players: [
                                { id: "i1", name: "Alpha", role: "IMPOSTOR", isAlive: true },
                                { id: "i2", name: "Bravo", role: "IMPOSTOR", isAlive: true },
                            ],
                        },
                        eligibleVoterIds: ["i1", "i2"],
                        voteCounts: { i1: 0, i2: 0 },
                        totalEligibleVoters: 2,
                        totalVotes: 0,
                        endReason: "TIMEOUT",
                        endedAt: now - 10_000,
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

            expect(screen.getByText(/Grâce post-meeting active/i)).toBeTruthy();
            screen.getAllByRole("button").forEach((button) => {
                expect(button).toBeDisabled();
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it("re-enables impostor sabotage actions after post-meeting grace", () => {
        vi.useFakeTimers();
        const now = new Date("2026-03-22T12:00:00.000Z").getTime();
        vi.setSystemTime(now);
        try {
            mockUseGameStore.mockReturnValue({
                gameQuests: [],
                fetchGameQuests: vi.fn(),
                isGameQuestsLoading: false,
                gameState: {
                    id: "game-1",
                    status: "IN_PROGRESS",
                    createdAt: now - 300_000,
                    revision: 1,
                    updatedAt: now - 300_000,
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
                        active: null,
                        reactor: null,
                        cooldowns: {
                            communicationsAvailableAt: 0,
                            lightsAvailableAt: 0,
                            reactorAvailableAt: 0,
                        },
                    },
                    meeting: {
                        id: "meeting-prev",
                        status: "COMPLETED",
                        startedAt: now - 200_000,
                        endsAt: now - 61_000,
                        startedBy: "i2",
                        snapshot: {
                            capturedAt: now - 200_000,
                            progress: { completed: 0, total: 2, percentage: 0 },
                            players: [
                                { id: "i1", name: "Alpha", role: "IMPOSTOR", isAlive: true },
                                { id: "i2", name: "Bravo", role: "IMPOSTOR", isAlive: true },
                            ],
                        },
                        eligibleVoterIds: ["i1", "i2"],
                        voteCounts: { i1: 0, i2: 0 },
                        totalEligibleVoters: 2,
                        totalVotes: 0,
                        endReason: "TIMEOUT",
                        endedAt: now - 61_000,
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

            expect(screen.queryByText(/Grâce post-meeting active/i)).toBeNull();
            expect(screen.getAllByRole("button", { name: /Déclencher/i }).length).toBeGreaterThan(0);
            screen.getAllByRole("button", { name: /Déclencher/i }).forEach((button) => {
                expect(button).not.toBeDisabled();
            });
        } finally {
            vi.useRealTimers();
        }
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
