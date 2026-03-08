import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestRenderer } from "@/components/game/quest-renderer";
import { QuestGame, QuestType } from "@/types/quest";
import { getRandomMiniGame } from "@/lib/mini-games";

vi.mock("@/lib/mini-games", async () => {
    const actual = await vi.importActual<typeof import("@/lib/mini-games")>("@/lib/mini-games");
    return {
        ...actual,
        getRandomMiniGame: vi.fn(() => "wires"),
    };
});

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/store/game-store", () => ({
    useGameStore: () => ({ clearQuest: vi.fn() }),
}));

const baseTrueFalseQuest: Extract<QuestGame, { type: "true-false" }> = {
    id: "s1",
    type: "true-false",
    duration: "short",
    title: "Test TF",
    instruction: "Is this true?",
    data: {
        choices: [
            { id: "true", label: "VRAI" },
            { id: "false", label: "FAUX" },
        ],
        answerIds: ["true"],
    }
};

const baseQCMQuest: Extract<QuestGame, { type: "qcm" }> = {
    id: "s2",
    type: "qcm",
    duration: "short",
    title: "Test QCM",
    instruction: "Pick one",
    data: {
        mode: "single",
        choices: [
            { id: "a", label: "Option A" },
            { id: "b", label: "Option B" },
            { id: "c", label: "Option C" },
            { id: "d", label: "Option D" },
        ],
        answerIds: ["c"],
    }
};

const baseMiniGameQuest: Extract<QuestGame, { type: "mini-game" }> = {
    id: "mg1",
    type: "mini-game",
    duration: "short",
    title: "Mini-jeu",
    instruction: "Relie les fils",
    data: {},
};

describe("QuestRenderer", () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const mockGetRandomMiniGame = vi.mocked(getRandomMiniGame);

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRandomMiniGame.mockReturnValue("wires");
    });

    it("should render QuestTrueFalse for true-false type", () => {
        render(<QuestRenderer quest={baseTrueFalseQuest} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByLabelText("Répondre VRAI")).toBeTruthy();
        expect(screen.getByLabelText("Répondre FAUX")).toBeTruthy();
    });

    it("should render QuestQCM for qcm type", () => {
        render(<QuestRenderer quest={baseQCMQuest} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText("Option A")).toBeTruthy();
        expect(screen.getByText("Option B")).toBeTruthy();
        expect(screen.getByText("Option C")).toBeTruthy();
        expect(screen.getByText("Option D")).toBeTruthy();
    });

    it("should show error for unsupported quest type", () => {
        const unsupported = { ...baseTrueFalseQuest, type: "unsupported-type" } as unknown as QuestGame;
        render(<QuestRenderer quest={unsupported} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Type de quête non supporté/)).toBeTruthy();
    });

    it("should show 'Retour au Game Home' link for unsupported type", () => {
        const unsupported = { ...baseTrueFalseQuest, type: "another-unsupported-type" } as unknown as QuestGame;
        render(<QuestRenderer quest={unsupported} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        const link = screen.getByText("Retour au Game Home");
        expect(link).toBeTruthy();
        expect(link.closest("a")?.getAttribute("href")).toBe("/game/g1");
    });

    it("should show error when quest has no data field", () => {
        const noData = { ...baseTrueFalseQuest, data: undefined } as unknown as QuestGame;
        render(<QuestRenderer quest={noData} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Données de quête invalides/)).toBeTruthy();
    });

    it("should render QuestWires when random mini-game is wires", () => {
        render(<QuestRenderer quest={baseMiniGameQuest} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Reliez les fils de la même couleur/i)).toBeTruthy();
        expect(screen.getByText(/Fils reliés : 0\/4/i)).toBeTruthy();
    });

    it("should render QuestGauges when random mini-game is gauges", () => {
        mockGetRandomMiniGame.mockReturnValue("gauges");
        render(<QuestRenderer quest={baseMiniGameQuest} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Alignez les curseurs sur chaque trait/i)).toBeTruthy();
        expect(screen.getByText(/Jauges alignées : 0\/4/i)).toBeTruthy();
    });

    it("should render QuestPad when random mini-game is pad", () => {
        mockGetRandomMiniGame.mockReturnValue("pad");
        render(<QuestRenderer quest={baseMiniGameQuest} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Mémorisez la séquence affichée sur l'écran de gauche/i)).toBeTruthy();
        expect(screen.getByText(/Série : 1 \/ 3/i)).toBeTruthy();
    });

    it("should render QuestMemory when random mini-game is memory", () => {
        mockGetRandomMiniGame.mockReturnValue("memory");
        render(<QuestRenderer quest={baseMiniGameQuest} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Trouvez les paires d'icônes/i)).toBeTruthy();
        expect(screen.getByText(/Paires trouvées : 0\/4/i)).toBeTruthy();
    });

    it("should render QuestRings when random mini-game is rings", () => {
        mockGetRandomMiniGame.mockReturnValue("rings");
        render(<QuestRenderer quest={baseMiniGameQuest} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Alignez les bagues dans l'ordre/i)).toBeTruthy();
        expect(screen.getByText(/Anneau : 1\/3/i)).toBeTruthy();
    });

    it("should show 'Retour au Game Home' link for malformed quest", () => {
        const malformed = { ...baseTrueFalseQuest, data: undefined } as unknown as QuestGame;
        render(<QuestRenderer quest={malformed} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        const link = screen.getByText("Retour au Game Home");
        expect(link.closest("a")?.getAttribute("href")).toBe("/game/g1");
    });
});
