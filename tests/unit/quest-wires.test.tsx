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

const COLOR_HEX_BY_ID: Record<string, string> = {
    red: "#ef4444",
    cyan: "#06b6d4",
    amber: "#f59e0b",
    green: "#22c55e",
    purple: "#a855f7",
    white: "#f8fafc",
};

function getRowY(index: number, total: number) {
    const topY = 84;
    const bottomY = 516;
    if (total <= 1) return (topY + bottomY) / 2;
    const gap = (bottomY - topY) / (total - 1);
    return topY + index * gap;
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

    it("supports touch-style drop by releasing on board near right connector", () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const board = screen.getByTestId("wires-board");
        vi.spyOn(board, "getBoundingClientRect").mockReturnValue({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            bottom: 600,
            right: 1000,
            width: 1000,
            height: 600,
            toJSON: () => ({}),
        });

        const leftButtons = getLeftButtons();
        const rightButtons = getRightButtons();
        const leftColor = leftButtons[0].getAttribute("data-wire-color");
        const rightIndex = rightButtons.findIndex((button) => button.getAttribute("data-wire-color") === leftColor);

        expect(rightIndex).toBeGreaterThanOrEqual(0);

        fireEvent.pointerDown(leftButtons[0], { clientX: 140, clientY: 84 });
        fireEvent.pointerUp(board, {
            clientX: 900,
            clientY: getRowY(rightIndex, rightButtons.length),
        });

        expect(onError).not.toHaveBeenCalled();
        expect(getLeftButtons()[0]).toBeDisabled();
    });

    it("never uses more than 6 distinct colors across rounds", async () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const allSeen = new Set<string>();

        for (let round = 0; round < 10; round++) {
            const leftButtons = getLeftButtons();
            const rightButtons = getRightButtons();
            for (const button of [...leftButtons, ...rightButtons]) {
                const color = button.getAttribute("data-wire-color");
                if (color) allSeen.add(color);
            }

            const leftColor = leftButtons[0].getAttribute("data-wire-color");
            const wrongRight = rightButtons.find((button) => button.getAttribute("data-wire-color") !== leftColor);
            expect(wrongRight).toBeDefined();

            fireEvent.pointerDown(leftButtons[0], { clientX: 30, clientY: 30 });
            fireEvent.pointerUp(wrongRight!, { clientX: 540, clientY: 140 });

            await act(async () => {
                await vi.advanceTimersByTimeAsync(2100);
            });
        }

        expect(allSeen.size).toBeLessThanOrEqual(6);
    });

    it("uses exactly 6 distinct colors on long duration", () => {
        render(<QuestWires duration="long" onSuccess={onSuccess} onError={onError} />);

        const leftColors = new Set(getLeftButtons().map((button) => button.getAttribute("data-wire-color")));
        const rightColors = new Set(getRightButtons().map((button) => button.getAttribute("data-wire-color")));

        expect(leftColors.size).toBe(6);
        expect(rightColors.size).toBe(6);
    });

    it("draws connected lines from measured copper connector centers, not fallback anchors", () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const board = screen.getByTestId("wires-board");
        vi.spyOn(board, "getBoundingClientRect").mockReturnValue({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            bottom: 600,
            right: 1000,
            width: 1000,
            height: 600,
            toJSON: () => ({}),
        });

        const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
        const connectorRectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
            const element = this as HTMLElement;
            const connectorSide = element.dataset.connectorAnchor;
            const rawIndex = element.dataset.anchorIndex;
            if (!connectorSide || rawIndex === undefined) {
                return originalGetBoundingClientRect.call(element);
            }

            const index = Number(rawIndex);
            const centerY = 100 + index * 60;
            const centerX = connectorSide === "left" ? 130 : 870;
            return {
                x: centerX - 10,
                y: centerY - 10,
                top: centerY - 10,
                left: centerX - 10,
                bottom: centerY + 10,
                right: centerX + 10,
                width: 20,
                height: 20,
                toJSON: () => ({}),
            };
        });

        const leftButtons = getLeftButtons();
        const rightButtons = getRightButtons();
        const leftColor = leftButtons[0].getAttribute("data-wire-color");
        const rightIndex = rightButtons.findIndex((button) => button.getAttribute("data-wire-color") === leftColor);
        expect(leftColor).toBeTruthy();
        expect(rightIndex).toBeGreaterThanOrEqual(0);

        fireEvent.pointerDown(leftButtons[0], { clientX: 130, clientY: 100 });
        fireEvent.pointerUp(rightButtons[rightIndex], { clientX: 870, clientY: 100 + rightIndex * 60 });

        const expectedStrokeColor = COLOR_HEX_BY_ID[leftColor!];
        const colorLine = Array.from(board.querySelectorAll("line")).find((line) =>
            line.getAttribute("stroke") === expectedStrokeColor && line.getAttribute("stroke-width") === "13"
        );

        expect(colorLine).toBeTruthy();
        expect(Number(colorLine!.getAttribute("x1"))).toBeCloseTo(130, 3);
        expect(Number(colorLine!.getAttribute("y1"))).toBeCloseTo(100, 3);
        expect(Number(colorLine!.getAttribute("x2"))).toBeCloseTo(870, 3);
        expect(Number(colorLine!.getAttribute("y2"))).toBeCloseTo(100 + rightIndex * 60, 3);
        expect(Number(colorLine!.getAttribute("x1"))).not.toBeCloseTo(140, 3);
        expect(Number(colorLine!.getAttribute("x2"))).not.toBeCloseTo(860, 3);

        connectorRectSpy.mockRestore();
    });
});
