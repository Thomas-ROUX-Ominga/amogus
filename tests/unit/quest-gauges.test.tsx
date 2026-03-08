import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuestGauges } from "@/components/game/mini-games/quest-gauges";

function getTracks() {
    return screen.getAllByTestId(/gauge-track-/i);
}

describe("QuestGauges", () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Math, "random").mockImplementation(() => 0.25);
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
            () =>
                ({
                    x: 0,
                    y: 0,
                    left: 0,
                    top: 0,
                    right: 100,
                    bottom: 300,
                    width: 100,
                    height: 300,
                    toJSON: () => ({}),
                }) as DOMRect
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders the right number of gauges for each duration", () => {
        const { rerender } = render(<QuestGauges duration="short" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getAllByTestId("gauge-unit")).toHaveLength(4);

        rerender(<QuestGauges duration="medium" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getAllByTestId("gauge-unit")).toHaveLength(5);

        rerender(<QuestGauges duration="long" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getAllByTestId("gauge-unit")).toHaveLength(6);
    });

    it("updates a gauge value on vertical drag", () => {
        render(<QuestGauges duration="short" onSuccess={onSuccess} onError={onError} />);
        const board = screen.getByTestId("gauges-board");
        const firstTrack = screen.getByTestId("gauge-track-0");
        const firstFill = screen.getByTestId("gauge-fill-0");
        const before = firstFill.getAttribute("style") || "";

        fireEvent.pointerDown(firstTrack, { clientY: 250 });
        fireEvent.pointerMove(board, { clientY: 120 });
        fireEvent.pointerUp(board);

        const after = firstFill.getAttribute("style") || "";
        expect(after).not.toEqual(before);
    });

    it("never calls onError", async () => {
        render(<QuestGauges duration="short" onSuccess={onSuccess} onError={onError} />);
        const board = screen.getByTestId("gauges-board");

        for (const track of getTracks()) {
            fireEvent.pointerDown(track, { clientY: 230 });
            fireEvent.pointerMove(board, { clientY: 200 });
            fireEvent.pointerUp(board);
        }

        await waitFor(() => {
            expect(onError).not.toHaveBeenCalled();
        });
    });

    it("calls onSuccess when all gauges are aligned within ±1%", async () => {
        render(<QuestGauges duration="short" onSuccess={onSuccess} onError={onError} />);
        const board = screen.getByTestId("gauges-board");
        const tracks = getTracks();

        for (let index = 0; index < tracks.length; index++) {
            const targetLine = tracks[index].querySelector<HTMLElement>("[data-target]");
            const target = Number(targetLine?.getAttribute("data-target"));
            const targetY = 300 - target * 3;

            fireEvent.pointerDown(tracks[index], { clientY: targetY });
            fireEvent.pointerMove(board, { clientY: targetY });
            fireEvent.pointerUp(board);
        }

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledTimes(1);
        });
    });

    it("calls onSuccess only once", async () => {
        render(<QuestGauges duration="short" onSuccess={onSuccess} onError={onError} />);
        const board = screen.getByTestId("gauges-board");
        const tracks = getTracks();

        for (let index = 0; index < tracks.length; index++) {
            const targetLine = tracks[index].querySelector<HTMLElement>("[data-target]");
            const target = Number(targetLine?.getAttribute("data-target"));
            const targetY = 300 - target * 3;

            fireEvent.pointerDown(tracks[index], { clientY: targetY });
            fireEvent.pointerMove(board, { clientY: targetY });
            fireEvent.pointerUp(board);
        }

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledTimes(1);
        });

        await act(async () => {
            fireEvent.pointerMove(board, { clientY: 180 });
            fireEvent.pointerUp(board);
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
    });
});
