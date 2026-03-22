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

let latestQuestProgressProps: {
    deadAwaitingMeeting?: boolean;
    role: "CREWMATE" | "IMPOSTOR";
    communicationsSabotaged?: boolean;
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
    QuestProgress: (props: { role: "CREWMATE" | "IMPOSTOR"; communicationsSabotaged?: boolean; deadAwaitingMeeting?: boolean }) => {
        latestQuestProgressProps = props;
        return (
            <div>
                <span>{props.role === "IMPOSTOR" ? "Panneau sabotage imposteur" : "Progression des quêtes"}</span>
                {props.communicationsSabotaged ? <span>COMMUNICATIONS SABOTÉES</span> : null}
                {props.deadAwaitingMeeting ? <span data-testid="quest-disabled">QUEST_DISABLED</span> : null}
            </div>
        );
    },
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

const crewmatePlayer: Player = { id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true };
const impostorPlayer: Player = { id: "user-2", name: "Bob", role: "IMPOSTOR", isAlive: true };

describe("GameHome", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        latestCameraScannerProps = null;
        latestQuestProgressProps = null;

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
            triggerMeetingAction: vi.fn(async () => true),
        } as unknown as ReturnType<typeof useGameStore>);
    });

    it("renders cockpit and enabled scanner for alive crewmate", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);

        expect(screen.getByText("Cockpit de partie")).toBeTruthy();
        expect(screen.getByRole("button", { name: /Scanner/i })).not.toBeDisabled();
        expect(screen.getByText("Progression des quêtes")).toBeTruthy();
    });

    it("hides scanner for impostor", () => {
        render(<GameHome gameState={mockGameState} currentPlayer={impostorPlayer} userId="user-2" />);
        expect(screen.queryByText("SCANNER")).toBeNull();
        expect(screen.getByText("Panneau sabotage imposteur")).toBeTruthy();
    });

    it("disables crewmate buzzer during communications sabotage", () => {
        const sabotagedState: GameState = {
            ...mockGameState,
            sabotageState: {
                active: "COMMUNICATIONS",
                reactor: null,
                cooldowns: { communicationsAvailableAt: 0, lightsAvailableAt: 0, reactorAvailableAt: 0 },
            },
        };

        render(<GameHome gameState={sabotagedState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByRole("button", { name: /buzzer/i })).toBeDisabled();
        expect(screen.getByText("COMMUNICATIONS SABOTÉES")).toBeTruthy();
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

    it("hides scanner when all quests are completed", () => {
        vi.mocked(useGameStore).mockReturnValue({
            questsCompleted: 5,
            questsTotal: 5,
            refreshGameData: vi.fn(),
            triggerMeetingAction: vi.fn(async () => true),
        } as Partial<ReturnType<typeof useGameStore>>);

        render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.queryByText("SCANNER")).toBeNull();
    });

    it("shows elimination button for crewmate only", () => {
        const { rerender } = render(<GameHome gameState={mockGameState} currentPlayer={crewmatePlayer} userId="user-1" />);
        expect(screen.getByText("Signaler mon élimination")).toBeTruthy();

        rerender(<GameHome gameState={mockGameState} currentPlayer={impostorPlayer} userId="user-2" />);
        expect(screen.queryByText("Signaler mon élimination")).toBeNull();
    });

    it("keeps buzzer available during post-elimination meeting window", () => {
        const deadWithBuzzerWindow: Player = {
            ...crewmatePlayer,
            isAlive: false,
            postEliminationBuzzerGrantedAt: Date.now(),
        };

        render(<GameHome gameState={mockGameState} currentPlayer={deadWithBuzzerWindow} userId="user-1" />);
        expect(screen.getByRole("button", { name: /buzzer/i })).not.toBeDisabled();
    });

    it("renders awaiting-death state with disabled scanner and quests", () => {
        const storageMock: Record<string, string> = {};
        vi.stubGlobal("sessionStorage", {
            getItem: (key: string) => storageMock[key] || null,
            setItem: (key: string, value: string) => {
                storageMock[key] = value;
            },
        });

        const deadAwaiting: Player = {
            ...crewmatePlayer,
            isAlive: false,
            postEliminationBuzzerGrantedAt: Date.now(),
        };

        render(<GameHome gameState={mockGameState} currentPlayer={deadAwaiting} userId="user-1" />);

        expect(screen.getByText(/Vous êtes mort\. Restez assis/i)).toBeTruthy();
        expect(screen.getByRole("button", { name: /Scanner inactif/i })).toBeDisabled();
        expect(screen.getByTestId("quest-disabled")).toBeTruthy();
        expect(latestQuestProgressProps?.deadAwaitingMeeting).toBe(true);

        vi.unstubAllGlobals();
    });

    it("shows ghost popup only after a completed meeting", () => {
        const storageMock: Record<string, string> = {};
        vi.stubGlobal("sessionStorage", {
            getItem: (key: string) => storageMock[key] || null,
            setItem: (key: string, value: string) => {
                storageMock[key] = value;
            },
        });

        const meetingCompletedState: GameState = {
            ...mockGameState,
            meeting: {
                id: "meeting-1",
                status: "COMPLETED",
                startedAt: Date.now() - 60_000,
                endsAt: Date.now() - 10_000,
                startedBy: "user-3",
                snapshot: {
                    capturedAt: Date.now() - 60_000,
                    progress: { completed: 0, total: 4, percentage: 0 },
                    players: [
                        { id: "user-1", name: "Alice", role: "CREWMATE", isAlive: false },
                        { id: "user-2", name: "Bob", role: "IMPOSTOR", isAlive: true },
                    ],
                },
                eligibleVoterIds: ["user-2"],
                voteCounts: { "user-2": 0 },
                totalEligibleVoters: 1,
                totalVotes: 0,
                endReason: "TIMEOUT",
                endedAt: Date.now() - 10_000,
            },
        };
        const deadGhost: Player = { ...crewmatePlayer, isAlive: false };

        render(<GameHome gameState={meetingCompletedState} currentPlayer={deadGhost} userId="user-1" />);

        expect(screen.getByText("MODE FANTÔME ACTIVÉ")).toBeTruthy();
        expect(screen.getByText("Fantôme crewmate")).toBeTruthy();
        expect(screen.getByText(/Fantôme: restez muet/i)).toBeTruthy();

        vi.unstubAllGlobals();
    });
});
