import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BuzzerButton } from "@/components/game/buzzer-button";

Object.defineProperty(navigator, "vibrate", {
    value: vi.fn(),
    writable: true,
});

describe("BuzzerButton", () => {
    const onBuzz = vi.fn(async () => {});

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders enabled buzzer state", () => {
        render(<BuzzerButton onBuzz={onBuzz} />);
        expect(screen.getByRole("button", { name: /buzzer/i })).toBeInTheDocument();
    });

    it("calls onBuzz when pressed", async () => {
        render(<BuzzerButton onBuzz={onBuzz} />);
        fireEvent.click(screen.getByRole("button", { name: /buzzer/i }));
        expect(onBuzz).toHaveBeenCalledTimes(1);
    });

    it("supports body-report label in post-elimination mode", () => {
        render(<BuzzerButton onBuzz={onBuzz} defaultLabelKey="game.actions.reportBody" />);
        expect(screen.getByRole("button", { name: /signaler le corps/i })).toBeInTheDocument();
    });

    it("shows used label when buzzer already used", () => {
        render(<BuzzerButton onBuzz={onBuzz} hasUsed disabled />);
        expect(screen.getByRole("button", { name: /buzz utilisé/i })).toBeDisabled();
    });

    it("shows active meeting label when meeting is running", () => {
        render(<BuzzerButton onBuzz={onBuzz} meetingActive disabled />);
        expect(screen.getByRole("button", { name: /meeting actif/i })).toBeDisabled();
    });
});
