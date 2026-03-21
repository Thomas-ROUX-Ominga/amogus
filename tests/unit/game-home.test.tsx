import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { GameHome } from "@/components/game/game-home";
import { useGameStore } from "@/lib/store/game-store";
import { useCameraScanner } from "@/hooks/use-camera-scanner";
import { scanSabotage } from "@/lib/redis/actions";
import { GameState, Player } from "@/types/game";

vi.mock("@/lib/store/game-store");
vi.mock("next/navigation", () => ({
    useRouter: vi.fn(),
}));
vi.mock("@/lib/redis/batch-actions", () => ({
    getBatch: vi.fn().mockResolvedValue({ success: true, data: { quests: [] } }),
}));
vi.mock("@/lib/redis/actions", () => ({
    scanSabotage: vi.fn().mockResolvedValue({ success: true, data: { handled: false } }),
}));
vi.mock("@/hooks/use-camera-scanner", () => ({
    useCameraScanner: vi.fn().mockReturnValue({
        isOpen: false,
        openScanner: vi.fn(),
        closeScanner: vi.fn(),
        handleScan: vi.fn(),
    }),
}));

let latestCameraScannerProps: {
    onScan: (questId: string) => Promise<boolean>;
    statusMessage?: string | null;
} | null = null;

vi.mock("@/components/game/camera-scanner", () => ({
    CameraScanner: (props: { onScan: (questId: string) => Promise<boolean>; statusMessage?: string | null }) => {
        latestCameraScannerProps = props;
        return props.statusMessage ? <span data-testid="camera-scanner-status">{props.statusMessage}</span> : null;
    },
}));
vi.mock("@/components/game/reactor-sabotage-alert", () => ({
    ReactorSabotageAlert: () => null,
}));
vi.mock("@/components/game/quest-progress", () => ({
    QuestProgress: ({
        role,
        communicationsSabotaged,
    }: {
        role: "CREWMATE" | "IMPOSTOR";
        communicationsSabotaged?: boolean;
    }) => (
        <div>
            <span>
                {role === "IMPOSTOR"
                    ? "Panneau sabotage imposteur"
                    : "Progression des quêtes"}
            </span>
            {communicationsSabotaged ? <span>COMMUNICATIONS SABOTÉES</span> : null}
        </div>
    ),
}));

const mockGameState: GameState = {
    id: "game-123",
    status: "IN_PROGRESS",
    players: [
        { id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true },
        { id: "user-2", name: "Bob", role: "IMPOSTOR", isAlive: true },
    ],
    createdAt: Date.now(),
    revision: 1,
    updatedAt: Date.now(),
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
        latestCameraScannerProps = null;
        vi.mocked(useCameraScanner).mockReturnValue({
            isOpen: false,
            openScanner: vi.fn(),
            closeScanner: vi.fn(),
            handleScan: vi.fn(),
        });
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
            isEliminating: false,
            eliminationError: null,
            refreshGameData: vi.fn(),
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

    it("should render cockpit title", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("Cockpit de partie")).toBeTruthy();
    });

    it("should render active status indicator", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("ACTIF")).toBeTruthy();
    });

    it("should render role badge for Crewmate", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getAllByText(/Crew/i).length).toBeGreaterThan(0);
    });

    it("should render role badge for Impostor", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={impostorPlayer} userId="user-2" />);
        expect(screen.getAllByText(/Imp/i).length).toBeGreaterThan(0);
    });

    it("should not render host player list panel anymore", () => {
        render(<GameHome gameState={hostGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.queryByText("Alice")).toBeNull();
        expect(screen.queryByText("Bob")).toBeNull();
        expect(screen.queryByText(/Joueurs connectés/i)).toBeNull();
        expect(screen.queryByText("VOUS")).toBeNull();
    });

    it("should render SCAN button", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("SCANNER")).toBeTruthy();
    });

    it("should render SCAN button for host crewmate", () => {
        render(<GameHome gameState={hostGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
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
        expect(screen.getByText("Panneau sabotage imposteur")).toBeTruthy();
    });

    it("should not render 'Retour à l'accueil' link anymore", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.queryByText(/Retour à l'accueil/)).toBeNull();
    });

    it("should render footer with role info", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("Rôle: CREWMATE")).toBeTruthy();
        expect(screen.getByText("Statut: PRÊT")).toBeTruthy();
    });

    it("should render screen reader text for game status", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("La partie est active")).toBeTruthy();
    });

    it("should disable crewmate buzzer during communications sabotage", () => {
        const sabotagedState: GameState = {
            ...mockGameState,
            sabotageState: {
                active: "COMMUNICATIONS",
                reactor: null,
                cooldowns: { communicationsAvailableAt: 0, lightsAvailableAt: 0, reactorAvailableAt: 0 },
            },
        };

        render(<GameHome gameState={sabotagedState} currentPlayer={crewmatePlayer} userId="user-1" />);
        const buzzerButton = screen.getByRole("button", { name: /buzzer/i });
        expect(buzzerButton).toBeDisabled();
        expect(screen.getByText("COMMUNICATIONS SABOTÉES")).toBeTruthy();
    });

    it("should disable impostor buzzer during reactor sabotage", () => {
        const sabotagedState: GameState = {
            ...mockGameState,
            sabotageState: {
                active: "REACTOR",
                reactor: {
                    startedAt: Date.now(),
                    endsAt: Date.now() + 30_000,
                    scannedByQrId: [],
                    scannedUserIds: [],
                },
                cooldowns: { communicationsAvailableAt: 0, lightsAvailableAt: 0, reactorAvailableAt: 0 },
            },
        };

        render(<GameHome gameState={sabotagedState} currentPlayer={impostorPlayer} userId="user-2" />);
        const buzzerButton = screen.getByRole("button", { name: /buzzer/i });
        expect(buzzerButton).toBeDisabled();
    });

    it("keeps scanner open and shows communications-blocked feedback when lights is scanned during communications sabotage", async () => {
        vi.mocked(useCameraScanner).mockReturnValue({
            isOpen: true,
            openScanner: vi.fn(),
            closeScanner: vi.fn(),
            handleScan: vi.fn(),
        });
        vi.mocked(scanSabotage).mockResolvedValueOnce({
            success: false,
            code: "ERR_SABOTAGE_NOT_ACTIVE",
            error: "LIGHTS sabotage is not active.",
            data: { handled: true },
        });

        const sabotagedState: GameState = {
            ...mockGameState,
            sabotageState: {
                active: "COMMUNICATIONS",
                reactor: null,
                cooldowns: { communicationsAvailableAt: 0, lightsAvailableAt: 0, reactorAvailableAt: 0 },
            },
        };

        render(<GameHome gameState={sabotagedState} currentPlayer={crewmatePlayer} userId="user-1" />);

        await act(async () => {
            const shouldClose = await latestCameraScannerProps?.onScan("lights-qr");
            expect(shouldClose).toBe(false);
        });

        await waitFor(() => {
            expect(screen.getByTestId("camera-scanner-status")).toHaveTextContent(
                "Communications sabotées: impossible de scanner une quête.",
            );
        });
    });

    it("should hide SCAN button for Crewmate when all quests are completed", () => {
        vi.mocked(useGameStore).mockReturnValue({
            questsCompleted: 5,
            questsTotal: 5,
            refreshGameData: vi.fn(),
        } as Partial<ReturnType<typeof useGameStore>>);

        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.queryByText("SCANNER")).toBeNull();
    });

    it("should hide SCAN button for Impostor", () => {
        vi.mocked(useGameStore).mockReturnValue({
            questsCompleted: 0,
            questsTotal: 0,
            refreshGameData: vi.fn(),
        } as Partial<ReturnType<typeof useGameStore>>);

        render(<GameHome gameState={mockGameState} currentPlayer={impostorPlayer} userId="user-2" />);
        expect(screen.queryByText("SCANNER")).toBeNull();
    });

    it("should render elimination button for Crewmate", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("Signaler mon élimination")).toBeTruthy();
    });

    it("should render elimination button for host crewmate", () => {
        render(<GameHome gameState={hostGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("Signaler mon élimination")).toBeTruthy();
    });

    it("should hide elimination button for Impostor", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={impostorPlayer} userId="user-2" />);
        expect(screen.queryByText("Signaler mon élimination")).toBeNull();
    });

    it("should show 'MORT' status when player is dead", () => {
        const deadPlayer: Player = { ...crewmatePlayer, isAlive: false };
        render(<GameHome gameState={mockGameState} currentPlayer={deadPlayer} userId="user-1" />);
        expect(screen.getByText("MORT")).toBeTruthy();
    });

    it("should disable elimination button when player is dead", () => {
        const deadPlayer: Player = { ...crewmatePlayer, isAlive: false };
        render(<GameHome gameState={mockGameState} currentPlayer={deadPlayer} userId="user-1" />);
        const button = screen.getByRole("button", { name: /(Already eliminated|Déjà éliminé)/i });
        expect(button).toBeDisabled();
    });

    it("should allow buzzer for a just-eliminated player until the next meeting", () => {
        const deadWithBuzzerWindow: Player = {
            ...crewmatePlayer,
            isAlive: false,
            postEliminationBuzzerGrantedAt: Date.now(),
        };
        render(<GameHome gameState={mockGameState} currentPlayer={deadWithBuzzerWindow} userId="user-1" />);
        const buzzerButton = screen.getByRole("button", { name: /buzzer/i });
        expect(buzzerButton).not.toBeDisabled();
    });

    it("should show 'ELIMINÉ' status in footer when player is dead", () => {
        const deadPlayer: Player = { ...crewmatePlayer, isAlive: false };
        render(<GameHome gameState={mockGameState} currentPlayer={deadPlayer} userId="user-1" />);
        expect(screen.getByText("Statut: ÉLIMINÉ")).toBeTruthy();
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
        expect(screen.getByText("Cockpit de partie")).toBeTruthy();
        expect(screen.queryByText("Continuer")).toBeNull();
        
        vi.unstubAllGlobals();
    });

    it("should prioritize game over popup over eliminated overlay for dead impostor", () => {
        const deadImpostor: Player = { ...impostorPlayer, isAlive: false };
        const finishedState: GameState = {
            ...mockGameState,
            status: "FINISHED",
            winner: "IMPOSTOR",
        };

        vi.stubGlobal("sessionStorage", {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
        });

        render(<GameHome gameState={finishedState} currentPlayer={deadImpostor} userId="user-2" />);

        expect(screen.getByText("VICTOIRE")).toBeTruthy();
        expect(screen.queryByText("En attente de fin de partie ou retour au lobby.")).toBeNull();

        vi.unstubAllGlobals();
    });
});
