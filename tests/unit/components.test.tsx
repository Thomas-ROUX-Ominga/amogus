import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PulseButton } from "@/components/effects/pulse-button";

describe("PulseButton", () => {
    it("should render children correctly", () => {
        render(<PulseButton>Test Button </PulseButton>);
        expect(screen.getByText("Test Button")).toBeDefined();
    });

    it("should show loading state", () => {
        render(<PulseButton isLoading={ true} > Test Button </PulseButton>);
        expect(screen.getByText("INITIALIZING...")).toBeDefined();
    });

    it("should call onClick when clicked", () => {
        const handleClick = vi.fn();
        render(<PulseButton onClick={ handleClick } > Click Me </PulseButton>);
        screen.getByRole("button").click();
        expect(handleClick).toHaveBeenCalled();
    });
});
