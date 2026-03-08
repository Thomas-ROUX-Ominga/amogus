import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QuestPad } from "@/components/game/mini-games/quest-pad";

vi.mock("framer-motion", async () => {
    const actual = await vi.importActual("framer-motion");
    return {
        ...actual,
        useReducedMotion: () => true,
    };
});

describe("QuestPad", () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        let i = 0;
        vi.spyOn(Math, "random").mockImplementation(() => {
            const value = (i % 9) / 9;
            i++;
            return value;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("renders left screen and 3x3 pad", () => {
        render(<QuestPad duration="short" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByTestId("pad-screen-cell-0")).toBeInTheDocument();
        expect(screen.getAllByTestId(/pad-key-/i)).toHaveLength(9);
    });

    it("uses sequence lengths 3/4/5 by duration", () => {
        const { rerender } = render(<QuestPad duration="short" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Série : 1 \/ 3/i)).toBeInTheDocument();

        rerender(<QuestPad duration="medium" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Série : 1 \/ 4/i)).toBeInTheDocument();

        rerender(<QuestPad duration="long" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText(/Série : 1 \/ 5/i)).toBeInTheDocument();
    });

    it("prevents input while playback is running", async () => {
        render(<QuestPad duration="short" onSuccess={onSuccess} onError={onError} />);

        fireEvent.click(screen.getByText(/GO/i));
        expect(screen.getByText(/OBSERVEZ/i)).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByTestId("pad-key-0"));
        });

        expect(onError).not.toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it("calls onSuccess when full sequence is correctly entered", async () => {
        render(<QuestPad duration="short" onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByText(/GO/i));

        const sequence = [0, 1, 2];

        for (let stage = 1; stage <= 3; stage++) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(PLAYBACK_TIME(stage));
            });
            expect(screen.getByText(/À VOUS/i)).toBeInTheDocument();

            for (let step = 0; step < stage; step++) {
                fireEvent.click(screen.getByTestId(`pad-key-${sequence[step]}`));
                await act(async () => {
                    vi.advanceTimersByTime(150);
                });
            }

            if (stage < 3) {
                await act(async () => {
                    vi.advanceTimersByTime(500);
                });
            }
        }

        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("calls onError on wrong press, shows overlay, then resets to step 1", async () => {
        render(<QuestPad duration="short" onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByText(/GO/i));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1200);
        });

        fireEvent.click(screen.getByTestId("pad-key-1")); // Wrong key, expected 0
        expect(onError).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/MISSION/i)).toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
        });

        expect(screen.getByText(/Série : 1 \/ 3/i)).toBeInTheDocument();
        expect(screen.getByText(/GO/i)).toBeInTheDocument();
    });
});

function PLAYBACK_TIME(stage: number) {
    return 500 + stage * (350 + 180) + 100;
}
