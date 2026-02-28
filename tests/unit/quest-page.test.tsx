import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ReactNode } from "react";
import QuestPage from "@/app/game/[id]/quest/page";
import { useGameStore } from "@/lib/store/game-store";
import { AuthProvider } from "@/hooks/use-auth";

const mockFetchGame = vi.fn();
const mockSetCurrentQuest = vi.fn();

vi.mock("@/lib/store/game-store");

let mockSearchParams = new URLSearchParams("duration=short");
vi.mock("next/navigation", () => ({
    useParams: () => ({ id: "game-123" }),
    useSearchParams: () => mockSearchParams,
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/use-local-user", () => ({
    useLocalUser: () => ({ userId: "user-1" }),
}));

vi.mock("@/hooks/use-auth", () => ({
    useAuth: () => ({
        authState: {
            session: {
                userId: "user-1",
                username: "Alice",
                isAuthenticated: false,
                sessionType: "anonymous",
            },
            isLoading: false,
            isAuthenticated: false,
            isAnonymous: true,
        },
        refreshAuth: vi.fn(),
        setAnonymousSession: vi.fn(),
        clearAnonymousSession: vi.fn(),
    }),
    AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

const baseStoreState = {
    gameState: null,
    isLoading: false,
    isLaunching: false,
    isSelectingRole: false,
    isCompletingQuest: false,
    error: null,
    errorCode: null,
    launchError: null,
    roleError: null,
    completionError: null,
    selectedRole: null,
    questsCompleted: 0,
    questsTotal: 0,
    currentQuest: null,
    questAnswered: false,
    // Story 8.2: Add new state properties
    currentQuestContent: null,
    failedQuests: {},
    isFailedQuestsLoading: false,
    fetchGame: mockFetchGame,
    join: vi.fn(),
    launch: vi.fn(),
    chooseRole: vi.fn(),
    completeQuestAction: vi.fn().mockResolvedValue(true),
    setCurrentQuest: mockSetCurrentQuest,
    setQuestAnswered: vi.fn(),
    clearQuest: vi.fn(),
    reset: vi.fn(),
    // Story 8.2: Add new actions
    loadDynamicQuestContent: vi.fn(),
    recordFailedQuest: vi.fn().mockResolvedValue(true),
    loadFailedQuests: vi.fn(),
    clearQuestContent: vi.fn(),
};

describe("QuestPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSearchParams = new URLSearchParams("duration=short");
        Object.defineProperty(navigator, "vibrate", {
            value: vi.fn(),
            writable: true,
            configurable: true,
        });
    });

    it("should show loading state when isLoading is true", () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            isLoading: true,
        });
        render(
            <AuthProvider>
                <QuestPage />
            </AuthProvider>
        );
        expect(screen.getByText(/Chargement de la quête/)).toBeTruthy();
    });

    it("should show error when game fetch fails", () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            error: "Game not found",
            errorCode: "GAME_NOT_FOUND",
        });
        render(
            <AuthProvider>
                <QuestPage />
            </AuthProvider>
        );
        expect(screen.getByText("SESSION INTROUVABLE")).toBeTruthy();
    });

    it("should show error for invalid duration param", () => {
        mockSearchParams = new URLSearchParams("duration=invalid");
        vi.mocked(useGameStore).mockReturnValue(baseStoreState);
        render(
            <AuthProvider>
                <QuestPage />
            </AuthProvider>
        );
        expect(screen.getByText("DURÉE INVALIDE")).toBeTruthy();
    });

    it("should show error for missing duration param", () => {
        mockSearchParams = new URLSearchParams("");
        vi.mocked(useGameStore).mockReturnValue(baseStoreState);
        render(
            <AuthProvider>
                <QuestPage />
            </AuthProvider>
        );
        expect(screen.getByText("DURÉE INVALIDE")).toBeTruthy();
    });

    it("should show error when game is not IN_PROGRESS", () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            gameState: {
                id: "game-123",
                status: "LOBBY",
                players: [{ id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true }],
                createdAt: Date.now(),
            },
        });
        render(
            <AuthProvider>
                <QuestPage />
            </AuthProvider>
        );
        expect(screen.getByText("MISSION INACTIVE")).toBeTruthy();
    });

    it("should show error when player is not in game", () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            gameState: {
                id: "game-123",
                status: "IN_PROGRESS",
                players: [{ id: "other-user", name: "Bob", role: "CREWMATE", isAlive: true }],
                createdAt: Date.now(),
            },
        });
        render(
            <AuthProvider>
                <QuestPage />
            </AuthProvider>
        );
        expect(screen.getByText("ACCÈS REFUSÉ")).toBeTruthy();
    });

    it("should show error when player has no role", () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            gameState: {
                id: "game-123",
                status: "IN_PROGRESS",
                players: [{ id: "user-1", name: "Alice", isAlive: true }],
                createdAt: Date.now(),
            },
        });
        render(
            <AuthProvider>
                <QuestPage />
            </AuthProvider>
        );
        expect(screen.getByText("RÔLE NON ASSIGNÉ")).toBeTruthy();
    });

    it("should render quest view when quest is loaded", async () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            gameState: {
                id: "game-123",
                status: "IN_PROGRESS",
                players: [{ id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true }],
                createdAt: Date.now(),
            },
            currentQuest: {
                id: "s1",
                type: "true-false",
                duration: "short",
                location: "Module de survie",
            },
        });
        render(
            <AuthProvider>
                <QuestPage />
            </AuthProvider>
        );
        
        // Wait for the quest content to load (async operation)
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        
        // Check for any quest content (title and instruction from QuestGame)
        expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
        expect(screen.getByText(/Vrai ou Faux \?$/)).toBeTruthy();
        expect(screen.getByLabelText("Répondre VRAI")).toBeTruthy();
        expect(screen.getByLabelText("Répondre FAUX")).toBeTruthy();
    });

    it("should call fetchGame on mount", () => {
        vi.mocked(useGameStore).mockReturnValue(baseStoreState);
        render(
            <AuthProvider>
                <QuestPage />
            </AuthProvider>
        );
        expect(mockFetchGame).toHaveBeenCalledWith("game-123", "user-1");
    });

    it("should show already-completed guard when quest is in player's completedQuests", () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            gameState: {
                id: "game-123",
                status: "IN_PROGRESS",
                players: [{ id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true, completedQuests: ["s1"] }],
                createdAt: Date.now(),
            },
            currentQuest: {
                id: "s1",
                type: "true-false",
                duration: "short",
                title: "Test Quest",
                instruction: "Test instruction",
            },
        });
        render(
            <AuthProvider>
                <QuestPage />
            </AuthProvider>
        );
        expect(screen.getByText("QUÊTE DÉJÀ ACCOMPLIE")).toBeTruthy();
        expect(screen.getByText("RETOUR AU COCKPIT")).toBeTruthy();
    });

    it("should set a simulated quest and not a real one if player is an IMPOSTOR", () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            gameState: {
                id: "game-123",
                status: "IN_PROGRESS",
                players: [{ id: "user-1", name: "Alice", role: "IMPOSTOR", isAlive: true }],
                createdAt: Date.now(),
            },
        });
        render(
            <AuthProvider>
                <QuestPage />
            </AuthProvider>
        );
        
        // It should call setCurrentQuest with a simulated quest object
        expect(mockSetCurrentQuest).toHaveBeenCalledWith(expect.objectContaining({
            id: "impostor-sim",
        }));
    });
});
