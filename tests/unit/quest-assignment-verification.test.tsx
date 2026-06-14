import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactNode } from "react";
import QuestPage from "@/app/game/[id]/quest/page";
import { useGameStore } from "@/lib/store/game-store";
import { AuthProvider } from "@/hooks/use-auth";
import { ERROR_CODES } from "@/lib/constants/error-codes";

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
            },
        },
    }),
    AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

const baseStoreState = {
    gameState: null,
    isLoading: false,
    error: null,
    currentQuest: null,
    fetchGame: vi.fn(),
    setCurrentQuest: vi.fn(),
    loadFailedQuests: vi.fn(),
};

function renderQuestPage(searchParams: { duration?: string | string[]; questId?: string | string[] } = { duration: "short" }) {
    return render(
        <AuthProvider>
            <QuestPage />
        </AuthProvider>
    );
}

describe("Quest Assignment Verification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSearchParams = new URLSearchParams("duration=short");
        Object.defineProperty(navigator, "vibrate", {
            value: vi.fn(),
            writable: true,
            configurable: true,
        });
    });

    it("should show error when quest is NOT assigned to player in a batch game", () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            gameState: {
                id: "game-123",
                status: "IN_PROGRESS",
                batchId: "batch-456",
                players: [{ id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true, assignedQuests: ["q1", "q2"] }],
                createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
            },
            currentQuest: {
                id: "q3", // Not in assignedQuests
                type: "true-false",
                duration: "short",
            },
        } as ReturnType<typeof useGameStore>);

        renderQuestPage();

        expect(screen.getByText("QUÊTE NON ASSIGNÉE")).toBeTruthy();
        expect(screen.getByText(new RegExp(ERROR_CODES.ERR_QUEST_NOT_ASSIGNED))).toBeTruthy();
    });

    it("should allow access when quest IS assigned to player in a batch game", () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            gameState: {
                id: "game-123",
                status: "IN_PROGRESS",
                batchId: "batch-456",
                players: [{ id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true, assignedQuests: ["q1", "q2"] }],
                createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
            },
            currentQuest: {
                id: "q1", // Is in assignedQuests
                type: "true-false",
                duration: "short",
            },
        } as ReturnType<typeof useGameStore>);

        renderQuestPage();

        // Should NOT show the error view
        expect(screen.queryByText("QUÊTE NON ASSIGNÉE")).toBeNull();
    });

    it("should allow access when game is NOT from a batch", () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            gameState: {
                id: "game-123",
                status: "IN_PROGRESS",
                batchId: undefined, // No batch
                players: [{ id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true, assignedQuests: [] }],
                createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
            },
            currentQuest: {
                id: "q_random",
                type: "true-false",
                duration: "short",
            },
        } as ReturnType<typeof useGameStore>);

        renderQuestPage();

        expect(screen.queryByText("QUÊTE NON ASSIGNÉE")).toBeNull();
    });

    it("should restrict IMPOSTORS to their fake assigned quests when scanning", () => {
        vi.mocked(useGameStore).mockReturnValue({
            ...baseStoreState,
            gameState: {
                id: "game-123",
                status: "IN_PROGRESS",
                batchId: "batch-456",
                players: [{ id: "user-1", name: "Alice", role: "IMPOSTOR", isAlive: true, assignedQuests: ["fake1", "fake2"] }],
                createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
            },
            currentQuest: {
                id: "real_quest_id", // Scanning something not in fake list
                type: "true-false",
                duration: "short",
            },
        } as ReturnType<typeof useGameStore>);

        renderQuestPage();

        expect(screen.getByText("QUÊTE NON ASSIGNÉE")).toBeTruthy();
    });
});
