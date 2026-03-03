import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestRenderer } from "@/components/game/quest-renderer";
import { QuestGame } from "@/types/quest";

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

describe("QuestRenderer", () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
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
        const unsupported = { ...baseTrueFalseQuest, type: "unsupported-type" } as any;
        render(<QuestRenderer quest={unsupported} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Type de quête non supporté/)).toBeTruthy();
    });

    it("should show 'Retour au Game Home' link for unsupported type", () => {
        const unsupported = { ...baseTrueFalseQuest, type: "another-unsupported-type" } as any;
        render(<QuestRenderer quest={unsupported} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        const link = screen.getByText("Retour au Game Home");
        expect(link).toBeTruthy();
        expect(link.closest("a")?.getAttribute("href")).toBe("/game/g1");
    });

    it("should show error when quest has no data field", () => {
        const noData = { ...baseTrueFalseQuest, data: undefined } as any;
        render(<QuestRenderer quest={noData} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Données de quête invalides/)).toBeTruthy();
    });

    it("should show 'Retour au Game Home' link for malformed quest", () => {
        const malformed = { ...baseTrueFalseQuest, data: undefined } as any;
        render(<QuestRenderer quest={malformed} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        const link = screen.getByText("Retour au Game Home");
        expect(link.closest("a")?.getAttribute("href")).toBe("/game/g1");
    });
});
