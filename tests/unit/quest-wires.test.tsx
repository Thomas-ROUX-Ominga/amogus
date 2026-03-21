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

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getLayout(total: number, width = 1000, height = 600) {
    const nodeWidth = clamp(width * 0.22, 112, 180);
    const nodeHeight = clamp(height * 0.13, 44, 56);
    const horizontalPadding = clamp(width * 0.03, 12, 28);
    const verticalPadding = clamp(height * 0.08, 18, 36);

    const minCenter = verticalPadding + nodeHeight / 2;
    const maxCenter = height - verticalPadding - nodeHeight / 2;

    const rowCenters = total <= 1
        ? [(minCenter + maxCenter) / 2]
        : Array.from({ length: total }, (_, index) => minCenter + ((maxCenter - minCenter) / (total - 1)) * index);

    return {
        nodeWidth,
        rightX: Math.max(horizontalPadding, width - horizontalPadding - nodeWidth),
        rowCenters,
    };
}

function mockBoardRect(board: HTMLElement, width = 1000, height = 600) {
    return vi.spyOn(board, "getBoundingClientRect").mockImplementation(() => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: height,
        right: width,
        width,
        height,
        toJSON: () => ({}),
    }) as DOMRect);
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

        fireEvent.pointerDown(firstLeft, { pointerId: 1, clientX: 60, clientY: 60 });
        fireEvent.pointerMove(board, { pointerId: 1, clientX: 340, clientY: 180 });

        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    it("calls onError when a wrong wire is connected on release", () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const board = screen.getByTestId("wires-board");
        mockBoardRect(board);

        const leftButtons = getLeftButtons();
        const rightButtons = getRightButtons();
        const total = leftButtons.length;

        const leftColor = leftButtons[0].getAttribute("data-wire-color");
        const wrongRightIndex = rightButtons.findIndex((button) => button.getAttribute("data-wire-color") !== leftColor);
        expect(wrongRightIndex).toBeGreaterThanOrEqual(0);

        const layout = getLayout(total);

        fireEvent.pointerDown(leftButtons[0], {
            pointerId: 2,
            clientX: 80,
            clientY: layout.rowCenters[0],
        });

        fireEvent.pointerUp(rightButtons[wrongRightIndex], {
            pointerId: 2,
            clientX: layout.rightX + 10,
            clientY: layout.rowCenters[wrongRightIndex],
        });

        expect(onError).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/MISSION/i)).toBeInTheDocument();
    });

    it("shows failed overlay then regenerates a new wire layout", async () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const board = screen.getByTestId("wires-board");
        mockBoardRect(board);

        const before = getSignature();
        const leftButtons = getLeftButtons();
        const rightButtons = getRightButtons();
        const total = leftButtons.length;

        const leftColor = leftButtons[0].getAttribute("data-wire-color");
        const wrongRightIndex = rightButtons.findIndex((button) => button.getAttribute("data-wire-color") !== leftColor);

        const layout = getLayout(total);

        fireEvent.pointerDown(leftButtons[0], {
            pointerId: 3,
            clientX: 80,
            clientY: layout.rowCenters[0],
        });

        fireEvent.pointerUp(rightButtons[wrongRightIndex], {
            pointerId: 3,
            clientX: layout.rightX + 8,
            clientY: layout.rowCenters[wrongRightIndex],
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
        });

        const after = getSignature();
        expect(after).not.toEqual(before);
    });

    it("calls onSuccess when all matching wires are connected using tap fallback", () => {
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

            fireEvent.click(leftButtons[leftIndex]);
            fireEvent.click(rightButtons[rightIndex]);

            usedRightIndexes.add(rightIndex);
        }

        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it("supports touch-style drop by releasing on board near right connector", () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const board = screen.getByTestId("wires-board");
        mockBoardRect(board);

        const leftButtons = getLeftButtons();
        const rightButtons = getRightButtons();
        const total = leftButtons.length;

        const leftColor = leftButtons[0].getAttribute("data-wire-color");
        const rightIndex = rightButtons.findIndex((button) => button.getAttribute("data-wire-color") === leftColor);
        expect(rightIndex).toBeGreaterThanOrEqual(0);

        const layout = getLayout(total);

        fireEvent.pointerDown(leftButtons[0], {
            pointerId: 4,
            clientX: 60,
            clientY: layout.rowCenters[0],
        });

        fireEvent.pointerUp(board, {
            pointerId: 4,
            clientX: layout.rightX + 14,
            clientY: layout.rowCenters[rightIndex],
        });

        expect(onError).not.toHaveBeenCalled();
        expect(getLeftButtons()[0]).toBeDisabled();
    });

    it("does not connect when drop is released away from the right drop zone", () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const board = screen.getByTestId("wires-board");
        mockBoardRect(board);

        const leftButtons = getLeftButtons();
        const total = leftButtons.length;
        const layout = getLayout(total);

        fireEvent.pointerDown(leftButtons[0], {
            pointerId: 5,
            clientX: 60,
            clientY: layout.rowCenters[0],
        });

        fireEvent.pointerUp(board, {
            pointerId: 5,
            clientX: layout.rightX - 120,
            clientY: (layout.rowCenters[0] + layout.rowCenters[1]) / 2 + 2,
        });

        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(getLeftButtons()[0]).not.toBeDisabled();
    });

    it("cancels an ongoing drag on pointer cancel", () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const board = screen.getByTestId("wires-board");
        mockBoardRect(board);

        const leftButtons = getLeftButtons();
        const rightButtons = getRightButtons();
        const total = leftButtons.length;

        const leftColor = leftButtons[0].getAttribute("data-wire-color");
        const rightIndex = rightButtons.findIndex((button) => button.getAttribute("data-wire-color") === leftColor);
        expect(rightIndex).toBeGreaterThanOrEqual(0);
        const layout = getLayout(total);

        fireEvent.pointerDown(leftButtons[0], {
            pointerId: 6,
            clientX: 60,
            clientY: layout.rowCenters[0],
        });

        fireEvent.pointerCancel(board, { pointerId: 6 });

        fireEvent.pointerUp(board, {
            pointerId: 6,
            clientX: layout.rightX + 12,
            clientY: layout.rowCenters[rightIndex],
        });

        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(getLeftButtons()[0]).not.toBeDisabled();
    });

    it("recomputes connector layout when board size changes", () => {
        render(<QuestWires duration="short" onSuccess={onSuccess} onError={onError} />);

        const board = screen.getByTestId("wires-board");

        let width = 1000;
        let height = 600;
        const boardRectSpy = vi.spyOn(board, "getBoundingClientRect").mockImplementation(() => ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            bottom: height,
            right: width,
            width,
            height,
            toJSON: () => ({}),
        }) as DOMRect);

        const leftButtons = getLeftButtons();
        const rightButtons = getRightButtons();

        const leftColor = leftButtons[0].getAttribute("data-wire-color");
        const rightIndex = rightButtons.findIndex((button) => button.getAttribute("data-wire-color") === leftColor);
        expect(rightIndex).toBeGreaterThanOrEqual(0);

        fireEvent.click(leftButtons[0]);
        fireEvent.click(rightButtons[rightIndex]);

        act(() => {
            vi.runOnlyPendingTimers();
        });

        const firstLeftButton = getLeftButtons()[0];
        const firstWidth = Number.parseFloat(firstLeftButton.style.width);
        expect(firstWidth).toBeGreaterThan(0);
        expect(firstLeftButton).toBeDisabled();

        width = 360;
        height = 640;

        act(() => {
            fireEvent(window, new window.Event("resize"));
        });

        const resizedLeftButton = getLeftButtons()[0];
        const resizedWidth = Number.parseFloat(resizedLeftButton.style.width);
        expect(resizedWidth).toBeGreaterThan(0);
        expect(resizedWidth).toBeLessThan(firstWidth);

        // Connection should remain intact after layout recomputation.
        expect(resizedLeftButton).toBeDisabled();

        boardRectSpy.mockRestore();
    });
});
