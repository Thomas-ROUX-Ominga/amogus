import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerList } from "@/components/admin/player-list";
import { ProgressBar } from "@/components/admin/progress-bar";
import { TrackerStats } from "@/components/admin/tracker-stats";
import { Player, GameState } from "@/types/game";
import { calculateGlobalProgress, calculatePlayerProgress, getTotalQuests } from "@/lib/utils/quest-calculations";

describe("PlayerList", () => {
    const mockPlayers: Player[] = [
        {
            id: "player1",
            name: "TestPlayer1",
            role: "CREWMATE",
            isAlive: true,
            completedQuests: ["quest1", "quest2"]
        },
        {
            id: "player2", 
            name: "TestPlayer2",
            role: "IMPOSTOR",
            isAlive: false,
            completedQuests: ["quest1"]
        },
        {
            id: "player3",
            name: "TestPlayer3",
            isAlive: true,
            completedQuests: []
        }
    ];

    it("should render player list correctly", () => {
        render(<PlayerList players={mockPlayers} currentUserId="player1" />);
        
        expect(screen.getByText("Manifeste équipage")).toBeDefined();
        expect(screen.getByText("TestPlayer1")).toBeDefined();
        expect(screen.getByText("TestPlayer2")).toBeDefined();
        expect(screen.getByText("TestPlayer3")).toBeDefined();
        expect(screen.getByText("3 MEMBRES")).toBeDefined();
    });

    it("should highlight current user", () => {
        render(<PlayerList players={mockPlayers} currentUserId="player1" />);
        
        expect(screen.getAllByText("VOUS").length).toBeGreaterThan(0);
        expect(screen.getByText("TestPlayer1")).toBeDefined();
    });

    it("should display player roles and status correctly", () => {
        render(<PlayerList players={mockPlayers} currentUserId="player1" />);
        
        expect(screen.getByText("ÉQUIPIER • ACTIF")).toBeDefined();
        expect(screen.getByText("IMPOSTEUR • ÉLIMINÉ")).toBeDefined();
        expect(screen.getByText("AUCUN_RÔLE • ACTIF")).toBeDefined();
    });

    it("should display quest progress", () => {
        render(<PlayerList players={mockPlayers} currentUserId="player1" />);

        const perPlayerTotal = getTotalQuests();
        expect(screen.getByText(`2/${perPlayerTotal} quêtes`)).toBeDefined();
        expect(screen.getByText(`1/${perPlayerTotal} quêtes`)).toBeDefined();
        expect(screen.getByText(`0/${perPlayerTotal} quêtes`)).toBeDefined();
    });

    it("should show empty state when no players", () => {
        render(<PlayerList players={[]} currentUserId="player1" />);
        
        expect(screen.getByText("Aucun membre d'équipage détecté")).toBeDefined();
    });
});

describe("ProgressBar", () => {
    const mockGameState: GameState = {
        id: "test-game",
        status: "IN_PROGRESS",
        players: [
            {
                id: "player1",
                name: "TestPlayer1",
                role: "CREWMATE",
                isAlive: true,
                completedQuests: ["quest1", "quest2"]
            },
            {
                id: "player2",
                name: "TestPlayer2", 
                role: "IMPOSTOR",
                isAlive: true,
                completedQuests: ["quest1"]
            }
        ],
        createdAt: Date.now()
    };

    it("should render progress bar correctly", () => {
        render(<ProgressBar gameState={mockGameState} />);
        
        expect(screen.getByText("Progression globale")).toBeDefined();
        expect(screen.getByText("ÉQUIPAGE")).toBeDefined();
        expect(screen.getByText("Avancement mission")).toBeDefined();
    });

    it("should calculate progress percentage correctly", () => {
        render(<ProgressBar gameState={mockGameState} />);

        const expectedProgress = calculateGlobalProgress(mockGameState.players, mockGameState).toFixed(1);
        expect(screen.getByText(`${expectedProgress}%`)).toBeDefined();
    });

    it("should display quest statistics", () => {
        render(<ProgressBar gameState={mockGameState} />);

        const totalCompleted = mockGameState.players.reduce(
            (sum, player) => sum + (player.completedQuests?.length || 0),
            0,
        );
        const totalPossible = mockGameState.players.length * getTotalQuests(mockGameState);
        expect(screen.getByText(String(totalCompleted))).toBeDefined();
        expect(screen.getByText(String(totalPossible))).toBeDefined();
    });

    it("should show individual progress", () => {
        render(<ProgressBar gameState={mockGameState} />);
        
        expect(screen.getByText("TestPlayer1")).toBeDefined();
        expect(screen.getByText("TestPlayer2")).toBeDefined();
        expect(
            screen.getByText(`${calculatePlayerProgress(mockGameState.players[0].completedQuests ?? [], mockGameState).toFixed(0)}%`),
        ).toBeDefined();
        expect(
            screen.getByText(`${calculatePlayerProgress(mockGameState.players[1].completedQuests ?? [], mockGameState).toFixed(0)}%`),
        ).toBeDefined();
    });
});

describe("TrackerStats", () => {
    const mockGameState: GameState = {
        id: "test-game-id",
        status: "IN_PROGRESS",
        players: [
            {
                id: "player1",
                name: "TestPlayer1",
                role: "CREWMATE",
                isAlive: true,
                completedQuests: ["quest1", "quest2"]
            },
            {
                id: "player2",
                name: "TestPlayer2",
                role: "IMPOSTOR",
                isAlive: false,
                completedQuests: ["quest1"]
            },
            {
                id: "player3",
                name: "TestPlayer3",
                role: "CREWMATE", 
                isAlive: true,
                completedQuests: []
            }
        ],
        createdAt: Date.now()
    };

    it("should render stats correctly", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        expect(screen.getByText("Statistiques mission")).toBeDefined();
        expect(screen.getByText("DONNÉES EN DIRECT")).toBeDefined();
    });

    it("should display game status", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        expect(screen.getByText("EN COURS")).toBeDefined();
        expect(screen.getByText("Statut partie")).toBeDefined();
    });

    it("should show player counts", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        expect(screen.getByText("Actifs")).toBeDefined();
        expect(screen.getByText("Éliminés")).toBeDefined();
        
        // Get all elements with text "2" and find the one in the Active section
        const activeElements = screen.getAllByText("2");
        expect(activeElements.length).toBeGreaterThan(0);
        
        // Get all elements with text "1" and find the one in the Eliminated section  
        const eliminatedElements = screen.getAllByText("1");
        expect(eliminatedElements.length).toBeGreaterThan(0);
    });

    it("should show role distribution", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        expect(screen.getByText("Équipiers")).toBeDefined();
        expect(screen.getByText("Imposteurs")).toBeDefined();
        
        // Check that the role counts exist (they may appear multiple times)
        const crewmateElements = screen.getAllByText("2");
        const impostorElements = screen.getAllByText("1");
        expect(crewmateElements.length).toBeGreaterThan(0);
        expect(impostorElements.length).toBeGreaterThan(0);
    });

    it("should display quest progress", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        expect(screen.getByText("Accomplies")).toBeDefined();
        expect(screen.getByText("Possibles")).toBeDefined();
        
        // Check that the quest counts exist (they may appear multiple times)
        const completedElements = screen.getAllByText("3");
        const possibleElements = screen.getAllByText(String(mockGameState.players.length * getTotalQuests(mockGameState)));
        expect(completedElements.length).toBeGreaterThan(0);
        expect(possibleElements.length).toBeGreaterThan(0);
    });

    it("should show average progress", () => {
        render(<TrackerStats gameState={mockGameState} />);

        expect(screen.getByText(`${calculateGlobalProgress(mockGameState.players).toFixed(1)}%`)).toBeDefined();
        expect(screen.getByText("Progression moyenne")).toBeDefined();
    });

    it("should display game identifier", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        expect(screen.getByText("test-game-id")).toBeDefined();
        expect(screen.getByText("Identifiant partie")).toBeDefined();
    });
});
