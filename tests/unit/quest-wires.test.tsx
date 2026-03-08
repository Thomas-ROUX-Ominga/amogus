import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QuestWires } from "@/components/game/mini-games/quest-wires";

vi.mock("framer-motion", async () => {
    const actual = await vi.importActual("framer-motion");
    return {
        ...actual,
        useReducedMotion: () => true,
    };
});

function getLeftButtons() {
    return screen.getAllByLabelText(/Fil gauche/i);
}

function getRightButtons() {
    return screen.getAllByLabelText(/Fil droit/i);
}

function getSignature() {
    const left = getLeftButtons().map((button) => button.getAttribute("data-wire-color"));
    const right = getRightButtons().map((button) => button.getAttribute("data-wire-color"));
    return `${left.join(",")}|${right.join(",")}`;
}

describe("QuestWires", () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        let seed = 0;
        vi.spyOn(Math, "random").mockImplementation(() => {
            seed = (seed + 0.137) % 1;
            return seed;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("renders the correct number of wires for each duration", () => {
        const { rerender } = render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);
        expect(getLeftButtons()).toHaveLength(4);
        expect(getRightButtons()).toHaveLength(4);
        expect(screen.getByTestId("wires-texture")).toBeInTheDocument();

        act(() => {
            rerender(<QuestWires duration="medium" onSuccess={onSuccess} onError={onError} />);
        });
        expect(getLeftButtons()).toHaveLength(5);
        expect(getRightButtons()).toHaveLength(5);

        act(() => {
            rerender(<QuestWires duration="long" onSuccess={onSuccess} onError={onError} />);
        });
        expect(getLeftButtons()).toHaveLength(6);
        expect(getRightButtons()).toHaveLength(6);
    });

    it("does not validate a wire before pointer release", () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);
        const board = screen.getByTestId("wires-board");
        const firstLeft = getLeftButtons()[0];

        fireEvent.pointerDown(firstLeft, { clientX: 30, clientY: 30 });
        fireEvent.pointerMove(board, { clientX: 300, clientY: 180 });

        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    it("calls onError when a wrong wire is connected on release", () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const leftButtons = getLeftButtons();
        const rightButtons = getRightButtons();
        const leftColor = leftButtons[0].getAttribute("data-wire-color");
        const wrongRight = rightButtons.find((button) => button.getAttribute("data-wire-color") !== leftColor);

        expect(wrongRight).toBeDefined();
        fireEvent.pointerDown(leftButtons[0], { clientX: 30, clientY: 30 });
        fireEvent.pointerUp(wrongRight!, { clientX: 540, clientY: 140 });

        expect(onError).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/MISSION/i)).toBeInTheDocument();
    });

    it("shows failed overlay then regenerates a new wire layout", async () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const before = getSignature();
        const leftButtons = getLeftButtons();
        const rightButtons = getRightButtons();
        const leftColor = leftButtons[0].getAttribute("data-wire-color");
        const wrongRight = rightButtons.find((button) => button.getAttribute("data-wire-color") !== leftColor);

        fireEvent.pointerDown(leftButtons[0], { clientX: 30, clientY: 30 });
        fireEvent.pointerUp(wrongRight!, { clientX: 540, clientY: 140 });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
        });

        const after = getSignature();
        expect(after).not.toEqual(before);
    });

    it("calls onSuccess when all matching wires are connected", () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const usedRightIndexes = new Set<number>();
        const total = getLeftButtons().length;

        for (let leftIndex = 0; leftIndex < total; leftIndex++) {
            const leftButtons = getLeftButtons();
            const rightButtons = getRightButtons();
            const leftColor = leftButtons[leftIndex].getAttribute("data-wire-color");

            const rightIndex = rightButtons.findIndex((button, index) =>
                !usedRightIndexes.has(index) && button.getAttribute("data-wire-color") === leftColor
            );

            expect(rightIndex).toBeGreaterThanOrEqual(0);

            fireEvent.pointerDown(leftButtons[leftIndex], { clientX: 30, clientY: 30 });
            fireEvent.pointerUp(rightButtons[rightIndex], { clientX: 540, clientY: 140 });
            usedRightIndexes.add(rightIndex);
        }

        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });
});
