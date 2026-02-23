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

const baseTrueFalseQuest: QuestGame = {
    id: "s1",
    type: "true-false",
    duration: "short",
    title: "Test TF",
    instruction: "Is this true?",
    options: [
        { label: "VRAI", value: "true" },
        { label: "FAUX", value: "false" },
    ],
    answer: "true",
};

const baseQCMQuest: QuestGame = {
    id: "s2",
    type: "qcm",
    duration: "short",
    title: "Test QCM",
    instruction: "Pick one",
    options: [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
        { label: "Option C", value: "c" },
        { label: "Option D", value: "d" },
    ],
    answer: "c",
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
        const unsupported: QuestGame = { ...baseTrueFalseQuest, type: "form" as QuestGame["type"] };
        render(<QuestRenderer quest={unsupported} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Type de quête non supporté/)).toBeTruthy();
    });

    it("should show 'Retour au Game Home' link for unsupported type", () => {
        const unsupported: QuestGame = { ...baseTrueFalseQuest, type: "single-input" as QuestGame["type"] };
        render(<QuestRenderer quest={unsupported} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        const link = screen.getByText("Retour au Game Home");
        expect(link).toBeTruthy();
        expect(link.closest("a")?.getAttribute("href")).toBe("/game/g1");
    });

    it("should show error when quest has no options", () => {
        const noOptions: QuestGame = { ...baseTrueFalseQuest, options: undefined, answer: "true" };
        render(<QuestRenderer quest={noOptions} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Données de quête invalides/)).toBeTruthy();
    });

    it("should show error when quest has empty options array", () => {
        const emptyOptions: QuestGame = { ...baseTrueFalseQuest, options: [], answer: "true" };
        render(<QuestRenderer quest={emptyOptions} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Données de quête invalides/)).toBeTruthy();
    });

    it("should show error when quest has no answer", () => {
        const noAnswer: QuestGame = { ...baseTrueFalseQuest, answer: undefined };
        render(<QuestRenderer quest={noAnswer} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Données de quête invalides/)).toBeTruthy();
    });

    it("should show 'Retour au Game Home' link for malformed quest", () => {
        const malformed: QuestGame = { ...baseTrueFalseQuest, options: undefined };
        render(<QuestRenderer quest={malformed} gameId="g1" onSuccess={onSuccess} onError={onError} />);
        const link = screen.getByText("Retour au Game Home");
        expect(link.closest("a")?.getAttribute("href")).toBe("/game/g1");
    });
});
