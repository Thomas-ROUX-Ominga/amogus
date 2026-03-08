import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QuestMemory } from "@/components/game/mini-games/quest-memory";

function getCards() {
    return screen.getAllByTestId(/memory-card-/i);
}

function getCardState(index: number) {
    return getCards()[index].getAttribute("data-state");
}

function getFlippedOrMatchedCount() {
    return getCards().filter((card) => {
        const state = card.getAttribute("data-state");
        return state === "flipped" || state === "matched";
    }).length;
}

function buildPairsByIcon() {
    const pairs = new Map<string, number[]>();
    getCards().forEach((card, index) => {
        const key = card.getAttribute("data-icon-key") || "";
        const list = pairs.get(key) ?? [];
        list.push(index);
        pairs.set(key, list);
    });
    return pairs;
}

async function clickCard(index: number) {
    await act(async () => {
        fireEvent.click(getCards()[index]);
    });
    await act(async () => {
        await Promise.resolve();
    });
}

describe("QuestMemory", () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        let seed = 0;
        vi.spyOn(Math, "random").mockImplementation(() => {
            seed = (seed + 0.271) % 1;
            return seed;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("renders the right number of cards for each duration", () => {
        const { rerender } = render(<QuestMemory duration="short" onSuccess={onSuccess} onError={onError} />);
        expect(getCards()).toHaveLength(8);

        rerender(<QuestMemory duration="medium" onSuccess={onSuccess} onError={onError} />);
        expect(getCards()).toHaveLength(10);

        rerender(<QuestMemory duration="long" onSuccess={onSuccess} onError={onError} />);
        expect(getCards()).toHaveLength(12);
    });

    it("keeps matched cards open", () => {
        render(<QuestMemory duration="short" onSuccess={onSuccess} onError={onError} />);

        const cards = getCards();
        const iconKey = cards[0].getAttribute("data-icon-key");
        const secondIndex = cards.findIndex(
            (card, index) => index !== 0 && card.getAttribute("data-icon-key") === iconKey
        );

        fireEvent.click(cards[0]);
        fireEvent.click(cards[secondIndex]);

        expect(getCardState(0)).toBe("matched");
        expect(getCardState(secondIndex)).toBe("matched");
    });

    it("flips mismatched cards back after 700ms", async () => {
        vi.useFakeTimers();
        render(<QuestMemory duration="short" onSuccess={onSuccess} onError={onError} />);
        const cards = getCards();
        const firstKey = cards[0].getAttribute("data-icon-key");
        const mismatchIndex = cards.findIndex((card, index) => index !== 0 && card.getAttribute("data-icon-key") !== firstKey);

        fireEvent.click(cards[0]);
        fireEvent.click(cards[mismatchIndex]);

        expect(getCardState(0)).toBe("flipped");
        expect(getCardState(mismatchIndex)).toBe("flipped");

        await act(async () => {
            await vi.advanceTimersByTimeAsync(700);
        });

        expect(getCardState(0)).toBe("hidden");
        expect(getCardState(mismatchIndex)).toBe("hidden");
    });

    it("locks interaction during mismatch comparison window", async () => {
        vi.useFakeTimers();
        render(<QuestMemory duration="short" onSuccess={onSuccess} onError={onError} />);
        const cards = getCards();
        const firstKey = cards[0].getAttribute("data-icon-key");
        const mismatchIndex = cards.findIndex((card, index) => index !== 0 && card.getAttribute("data-icon-key") !== firstKey);
        const thirdIndex = cards.findIndex((_, index) => index !== 0 && index !== mismatchIndex);

        fireEvent.click(cards[0]);
        fireEvent.click(cards[mismatchIndex]);
        expect(getFlippedOrMatchedCount()).toBe(2);

        fireEvent.click(cards[thirdIndex]);
        expect(getFlippedOrMatchedCount()).toBe(2);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(700);
        });
    });

    it("never calls onError", () => {
        render(<QuestMemory duration="short" onSuccess={onSuccess} onError={onError} />);
        const cards = getCards();

        fireEvent.click(cards[0]);
        fireEvent.click(cards[1]);

        expect(onError).not.toHaveBeenCalled();
    });

    it("calls onSuccess only once when all pairs are found", async () => {
        render(<QuestMemory duration="short" onSuccess={onSuccess} onError={onError} />);
        const pairs = buildPairsByIcon();

        for (const [, indexes] of pairs) {
            await clickCard(indexes[0]);
            await clickCard(indexes[1]);
        }

        await act(async () => {
            await Promise.resolve();
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
        await clickCard(0);
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });
});
