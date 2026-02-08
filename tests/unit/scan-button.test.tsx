import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScanButton } from "@/components/game/scan-button";

describe("ScanButton", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, "vibrate", {
            value: vi.fn(),
            writable: true,
            configurable: true,
        });
    });

    it("should render disabled state by default", () => {
        render(<ScanButton />);
        const button = screen.getByRole("button");
        expect(button.hasAttribute("disabled")).toBe(true);
    });

    it("should show 'SCANNER' text", () => {
        render(<ScanButton />);
        expect(screen.getByText("SCANNER")).toBeTruthy();
    });

    it("should show 'Bientôt disponible' when disabled", () => {
        render(<ScanButton disabled={true} />);
        expect(screen.getByText("Bientôt disponible")).toBeTruthy();
    });

    it("should not show 'Bientôt disponible' when enabled", () => {
        render(<ScanButton disabled={false} />);
        expect(screen.queryByText("Bientôt disponible")).toBeNull();
    });

    it("should trigger haptic feedback on click", () => {
        const vibrateMock = vi.fn();
        Object.defineProperty(navigator, "vibrate", {
            value: vibrateMock,
            writable: true,
            configurable: true,
        });

        render(<ScanButton disabled={false} />);
        const button = screen.getByRole("button");
        fireEvent.click(button);

        expect(vibrateMock).toHaveBeenCalledWith([50]);
    });

    it("should call onClick handler when clicked", () => {
        const handleClick = vi.fn();
        render(<ScanButton disabled={false} onClick={handleClick} />);
        const button = screen.getByRole("button");
        fireEvent.click(button);

        expect(handleClick).toHaveBeenCalled();
    });

    it("should have minimum 120px height", () => {
        render(<ScanButton />);
        const button = screen.getByRole("button");
        expect(button.className).toContain("min-h-[120px]");
    });

    it("should have correct aria-label when disabled", () => {
        render(<ScanButton disabled={true} />);
        const button = screen.getByRole("button");
        expect(button.getAttribute("aria-label")).toBe("Scanner — Bientôt disponible");
    });

    it("should have correct aria-label when enabled", () => {
        render(<ScanButton disabled={false} />);
        const button = screen.getByRole("button");
        expect(button.getAttribute("aria-label")).toBe("Scanner");
    });

    it("should use Orbitron font for button text", () => {
        render(<ScanButton />);
        const button = screen.getByRole("button");
        expect(button.className).toContain("font-orbitron");
    });
});
