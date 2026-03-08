import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QuestRings } from "@/components/game/mini-games/quest-rings";

describe("QuestRings", () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("renders ring counts by duration (3/4/5)", () => {
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
        const { rerender } = render(<QuestRings duration="short" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getAllByTestId(/ring-row-/i)).toHaveLength(3);

        rerender(<QuestRings duration="medium" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getAllByTestId(/ring-row-/i)).toHaveLength(4);

        rerender(<QuestRings duration="long" onSuccess={onSuccess} onError={onError} />);
        expect(screen.getAllByTestId(/ring-row-/i)).toHaveLength(5);
        randomSpy.mockRestore();
    });

    it("enforces sequential order (only current stop button enabled)", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        render(<QuestRings duration="short" onSuccess={onSuccess} onError={onError} />);

        expect(screen.getByTestId("ring-row-0")).toContainElement(screen.getByTestId("ring-stop-0"));
        expect(screen.getByTestId("ring-row-1")).toContainElement(screen.getByTestId("ring-stop-1"));
        expect(screen.getByTestId("ring-row-2")).toContainElement(screen.getByTestId("ring-stop-2"));

        expect(screen.getByTestId("ring-stop-0")).not.toBeDisabled();
        expect(screen.getByTestId("ring-stop-1")).toBeDisabled();
        expect(screen.getByTestId("ring-stop-2")).toBeDisabled();
    });

    it("calls onSuccess after all rings are aligned in order", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0); // Angle starts at 0, immediate success when stopped
        render(<QuestRings duration="short" onSuccess={onSuccess} onError={onError} />);

        fireEvent.click(screen.getByTestId("ring-stop-0"));
        expect(screen.getByTestId("ring-stop-1")).not.toBeDisabled();

        fireEvent.click(screen.getByTestId("ring-stop-1"));
        expect(screen.getByTestId("ring-stop-2")).not.toBeDisabled();

        fireEvent.click(screen.getByTestId("ring-stop-2"));

        await act(async () => {
            await Promise.resolve();
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it("calls onError on wrong timing and resets to ring 1", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.5); // Starts far from indicator
        render(<QuestRings duration="short" onSuccess={onSuccess} onError={onError} />);

        fireEvent.click(screen.getByTestId("ring-stop-0"));
        expect(onError).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/MISSION/i)).toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
        });

        expect(screen.getByText(/Anneau : 1\/3/i)).toBeInTheDocument();
        expect(screen.getByTestId("ring-stop-0")).not.toBeDisabled();
    });
});
