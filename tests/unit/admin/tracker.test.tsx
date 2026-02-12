import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerList } from "@/components/admin/player-list";
import { ProgressBar } from "@/components/admin/progress-bar";
import { TrackerStats } from "@/components/admin/tracker-stats";
import { Player, GameState } from "@/types/game";

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
        
        expect(screen.getByText("Crew Manifest")).toBeDefined();
        expect(screen.getByText("TestPlayer1")).toBeDefined();
        expect(screen.getByText("TestPlayer2")).toBeDefined();
        expect(screen.getByText("TestPlayer3")).toBeDefined();
        expect(screen.getByText("3 MEMBERS")).toBeDefined();
    });

    it("should highlight current user", () => {
        render(<PlayerList players={mockPlayers} currentUserId="player1" />);
        
        expect(screen.getByText("YOU")).toBeDefined();
        expect(screen.getByText("TestPlayer1")).toBeDefined();
    });

    it("should display player roles and status correctly", () => {
        render(<PlayerList players={mockPlayers} currentUserId="player1" />);
        
        expect(screen.getByText("CREWMATE • ACTIVE")).toBeDefined();
        expect(screen.getByText("IMPOSTOR • ELIMINATED")).toBeDefined();
        expect(screen.getByText("NO_ROLE • ACTIVE")).toBeDefined();
    });

    it("should display quest progress", () => {
        render(<PlayerList players={mockPlayers} currentUserId="player1" />);
        
        expect(screen.getByText("2/9")).toBeDefined();
        expect(screen.getByText("1/9")).toBeDefined();
        expect(screen.getByText("0/9")).toBeDefined();
    });

    it("should show empty state when no players", () => {
        render(<PlayerList players={[]} currentUserId="player1" />);
        
        expect(screen.getByText("No crew members detected")).toBeDefined();
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
        
        expect(screen.getByText("Global Progress")).toBeDefined();
        expect(screen.getByText("CREW WIDE")).toBeDefined();
        expect(screen.getByText("Mission Completion")).toBeDefined();
    });

    it("should calculate progress percentage correctly", () => {
        render(<ProgressBar gameState={mockGameState} />);
        
        // 3 completed quests out of 18 possible (2 players * 9 quests each) = 16.7%
        expect(screen.getByText("16.7%")).toBeDefined();
    });

    it("should display quest statistics", () => {
        render(<ProgressBar gameState={mockGameState} />);
        
        expect(screen.getByText("3")).toBeDefined(); // Total completed
        expect(screen.getByText("18")).toBeDefined(); // Total possible
    });

    it("should show individual progress", () => {
        render(<ProgressBar gameState={mockGameState} />);
        
        expect(screen.getByText("TestPlayer1")).toBeDefined();
        expect(screen.getByText("TestPlayer2")).toBeDefined();
        expect(screen.getByText("22%")).toBeDefined(); // Player 1: 2/9 = 22.2% rounded
        expect(screen.getByText("11%")).toBeDefined(); // Player 2: 1/9 = 11.1% rounded
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
        
        expect(screen.getByText("Mission Stats")).toBeDefined();
        expect(screen.getByText("LIVE DATA")).toBeDefined();
    });

    it("should display game status", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        expect(screen.getByText("IN_PROGRESS")).toBeDefined();
        expect(screen.getByText("Game Status")).toBeDefined();
    });

    it("should show player counts", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        expect(screen.getByText("Active")).toBeDefined();
        expect(screen.getByText("Eliminated")).toBeDefined();
        
        // Get all elements with text "2" and find the one in the Active section
        const activeElements = screen.getAllByText("2");
        expect(activeElements.length).toBeGreaterThan(0);
        
        // Get all elements with text "1" and find the one in the Eliminated section  
        const eliminatedElements = screen.getAllByText("1");
        expect(eliminatedElements.length).toBeGreaterThan(0);
    });

    it("should show role distribution", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        expect(screen.getByText("Crewmates")).toBeDefined();
        expect(screen.getByText("Impostors")).toBeDefined();
        
        // Check that the role counts exist (they may appear multiple times)
        const crewmateElements = screen.getAllByText("2");
        const impostorElements = screen.getAllByText("1");
        expect(crewmateElements.length).toBeGreaterThan(0);
        expect(impostorElements.length).toBeGreaterThan(0);
    });

    it("should display quest progress", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        expect(screen.getByText("Completed")).toBeDefined();
        expect(screen.getByText("Possible")).toBeDefined();
        
        // Check that the quest counts exist (they may appear multiple times)
        const completedElements = screen.getAllByText("3");
        const possibleElements = screen.getAllByText("27");
        expect(completedElements.length).toBeGreaterThan(0);
        expect(possibleElements.length).toBeGreaterThan(0);
    });

    it("should show average progress", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        // 3 completed out of 27 possible = 11.1% average
        expect(screen.getByText("11.1%")).toBeDefined();
        expect(screen.getByText("Average Progress")).toBeDefined();
    });

    it("should display game identifier", () => {
        render(<TrackerStats gameState={mockGameState} />);
        
        expect(screen.getByText("test-game-id")).toBeDefined();
        expect(screen.getByText("Game Identifier")).toBeDefined();
    });
});
