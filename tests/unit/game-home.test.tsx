import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameHome } from "@/components/game/game-home";
import { useGameStore } from "@/lib/store/game-store";
import { GameState, Player } from "@/types/game";

vi.mock("@/lib/store/game-store");
vi.mock("next/navigation", () => ({
    useRouter: vi.fn(),
}));
vi.mock("@/lib/redis/batch-actions", () => ({
    getBatch: vi.fn().mockResolvedValue({ success: true, data: { quests: [] } }),
}));
vi.mock("@/hooks/use-camera-scanner", () => ({
    useCameraScanner: vi.fn().mockReturnValue({
        isOpen: false,
        openScanner: vi.fn(),
        closeScanner: vi.fn(),
        handleScan: vi.fn(),
    }),
}));

const mockGameState: GameState = {
    id: "game-123",
    status: "IN_PROGRESS",
    players: [
        { id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true },
        { id: "user-2", name: "Bob", role: "IMPOSTOR", isAlive: true },
    ],
    createdAt: Date.now(),
    creatorId: "user-999",
};

const hostGameState: GameState = {
    ...mockGameState,
    creatorId: "user-1",
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
            impostorQuestsInitialized: false,
            isEliminating: false,
            eliminationError: null,
            getImpostorQuestData: vi.fn().mockReturnValue({ quests: [], completed: 0, total: 0, percentage: 0 }),
            initializeImpostorQuests: vi.fn(),
            generateImpostorQuestAssignments: vi.fn(),
            completeImpostorQuest: vi.fn(),
            setImpostorQuestLocation: vi.fn(),
            eliminatePlayerAction: vi.fn(),
            chooseRole: vi.fn(),
            fetchGame: vi.fn(),
            join: vi.fn(),
            launch: vi.fn(),
            setCurrentQuest: vi.fn(),
            clearQuest: vi.fn(),
            reset: vi.fn(),
        } as unknown as ReturnType<typeof useGameStore>);
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
        render(<GameHome gameState={hostGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("Alice")).toBeTruthy();
        expect(screen.getByText("Bob")).toBeTruthy();
    });

    it("should show player count in player list header", () => {
        render(<GameHome gameState={hostGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText(/Joueurs connectés \(2\)/)).toBeTruthy();
    });

    it("should highlight current player with YOU badge", () => {
        render(<GameHome gameState={hostGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
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

    it("should hide SCAN button for Crewmate when all quests are completed", () => {
        vi.mocked(useGameStore).mockReturnValue({
            questsCompleted: 5,
            questsTotal: 5,
            getImpostorQuestData: vi.fn().mockReturnValue({ quests: [], completed: 0, total: 0, percentage: 0 }),
        } as Partial<ReturnType<typeof useGameStore>>);

        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.queryByText("SCANNER")).toBeNull();
    });

    it("should hide SCAN button for Impostor when all fake quests are completed", () => {
        vi.mocked(useGameStore).mockReturnValue({
            questsCompleted: 0,
            questsTotal: 0,
            impostorQuestsInitialized: true,
            getImpostorQuestData: vi.fn().mockReturnValue({ quests: [], completed: 3, total: 3, percentage: 100 }),
        } as Partial<ReturnType<typeof useGameStore>>);

        render(<GameHome gameState={mockGameState} currentPlayer={impostorPlayer} userId="user-2" />);
        expect(screen.queryByText("SCANNER")).toBeNull();
    });

    it("should show 'MORT' status when player is dead", () => {
        const deadPlayer: Player = { ...crewmatePlayer, isAlive: false };
        render(<GameHome gameState={mockGameState} currentPlayer={deadPlayer} userId="user-1" />);
        expect(screen.getByText("MORT")).toBeTruthy();
    });

    it("should disable elimination button when player is dead", () => {
        const deadPlayer: Player = { ...crewmatePlayer, isAlive: false };
        render(<GameHome gameState={mockGameState} currentPlayer={deadPlayer} userId="user-1" />);
        const button = screen.getByRole("button", { name: /Already eliminated/i });
        expect(button).toBeDisabled();
    });

    it("should show 'ELIMINÉ' status in footer when player is dead", () => {
        const deadPlayer: Player = { ...crewmatePlayer, isAlive: false };
        render(<GameHome gameState={mockGameState} currentPlayer={deadPlayer} userId="user-1" />);
        expect(screen.getByText("Status: ELIMINÉ")).toBeTruthy();
    });

    it("should not show 'MORT' overlay if already dismissed in sessionStorage", () => {
        const deadPlayer: Player = { ...crewmatePlayer, isAlive: false };
        const storageKey = `elimination-dismissed-${mockGameState.id}-${deadPlayer.id}`;
        
        // Mock sessionStorage
        const storageMock: Record<string, string> = {};
        storageMock[storageKey] = "true";
        vi.stubGlobal("sessionStorage", {
            getItem: (key: string) => storageMock[key] || null,
            setItem: (key: string, value: string) => { storageMock[key] = value; },
        });

        render(<GameHome gameState={mockGameState} currentPlayer={deadPlayer} userId="user-1" />);
        
        // Overlay should not be visible, but cockpit should be
        expect(screen.getByText("Game Cockpit")).toBeTruthy();
        expect(screen.queryByText("Continuer")).toBeNull();
        
        vi.unstubAllGlobals();
    });
});
