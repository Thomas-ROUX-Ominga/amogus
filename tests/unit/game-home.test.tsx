import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameHome } from "@/components/game/game-home";
import { useGameStore } from "@/lib/store/game-store";
import { GameState, Player } from "@/types/game";

vi.mock("@/lib/store/game-store");
vi.mock("next/navigation", () => ({
    useRouter: vi.fn(),
}));

const mockGameState: GameState = {
    id: "game-123",
    status: "IN_PROGRESS",
    players: [
        { id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true },
        { id: "user-2", name: "Bob", role: "IMPOSTOR", isAlive: true },
    ],
    createdAt: Date.now(),
};

const crewmatePlayer: Player = { id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true };
const impostorPlayer: Player = { id: "user-2", name: "Bob", role: "IMPOSTOR", isAlive: true };

describe("GameHome", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useGameStore).mockReturnValue({
            questsCompleted: 0,
            questsTotal: 0,
            currentQuest: null,
            gameState: null,
            isLoading: false,
            isLaunching: false,
            isSelectingRole: false,
            error: null,
            errorCode: null,
            launchError: null,
            roleError: null,
            selectedRole: null,
            chooseRole: vi.fn(),
            fetchGame: vi.fn(),
            join: vi.fn(),
            launch: vi.fn(),
            setCurrentQuest: vi.fn(),
            clearQuest: vi.fn(),
            reset: vi.fn(),
        });
    });

    it("should render Game Cockpit title", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("Game Cockpit")).toBeTruthy();
    });

    it("should render ACTIVE status indicator", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("ACTIVE")).toBeTruthy();
    });

    it("should render role badge for Crewmate", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getAllByText(/Crew/i).length).toBeGreaterThan(0);
    });

    it("should render role badge for Impostor", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={impostorPlayer} userId="user-2" />);
        expect(screen.getAllByText(/Imp/i).length).toBeGreaterThan(0);
    });

    it("should render player list with all players", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("Alice")).toBeTruthy();
        expect(screen.getByText("Bob")).toBeTruthy();
    });

    it("should show player count in player list header", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText(/Joueurs connectés \(2\)/)).toBeTruthy();
    });

    it("should highlight current player with YOU badge", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("YOU")).toBeTruthy();
    });

    it("should render SCAN button", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("SCANNER")).toBeTruthy();
    });

    it("should render SCAN button as enabled button", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        const button = screen.getByRole("button", { name: /Scanner/i });
        expect(button).toBeTruthy();
        expect(button).not.toBeDisabled();
    });

    it("should not show 'Bientôt disponible' on SCAN button", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.queryByText("Bientôt disponible")).toBeNull();
    });

    it("should render quest progress for Crewmate", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("Progression des quêtes")).toBeTruthy();
    });

    it("should render quest progress for Impostor", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={impostorPlayer} userId="user-2" />);
        expect(screen.getByText("Progression des quêtes")).toBeTruthy();
    });

    it("should render 'Retour à l'accueil' link", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText(/Retour à l'accueil/)).toBeTruthy();
    });

    it("should have a link to home page", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        const link = screen.getByText(/Retour à l'accueil/).closest("a");
        expect(link?.getAttribute("href")).toBe("/");
    });

    it("should render footer with role info", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("Role: CREWMATE")).toBeTruthy();
        expect(screen.getByText("Status: READY")).toBeTruthy();
    });

    it("should render screen reader text for game status", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("Game is active")).toBeTruthy();
    });
});
