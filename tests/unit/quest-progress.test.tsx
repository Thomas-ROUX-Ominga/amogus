import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestProgress } from "@/components/game/quest-progress";

describe("QuestProgress", () => {
    it("should render for Crewmate role", () => {
        render(<QuestProgress role="CREWMATE" completed={0} total={0} />);
        expect(screen.getByText("Progression des quêtes")).toBeTruthy();
    });

    it("should not render for Impostor role", () => {
        const { container } = render(<QuestProgress role="IMPOSTOR" completed={0} total={0} />);
        expect(container.innerHTML).toBe("");
    });

    it("should show placeholder text when total is 0", () => {
        render(<QuestProgress role="CREWMATE" completed={0} total={0} />);
        expect(screen.getByText("En attente de missions...")).toBeTruthy();
    });

    it("should show quest count when total > 0", () => {
        render(<QuestProgress role="CREWMATE" completed={3} total={5} />);
        expect(screen.getByText("3/5 quêtes accomplies")).toBeTruthy();
    });

    it("should render progress bar with correct aria attributes", () => {
        render(<QuestProgress role="CREWMATE" completed={2} total={4} />);
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.getAttribute("aria-valuenow")).toBe("2");
        expect(progressBar.getAttribute("aria-valuemin")).toBe("0");
        expect(progressBar.getAttribute("aria-valuemax")).toBe("4");
    });

    it("should render progress bar at 0% width when no quests completed", () => {
        render(<QuestProgress role="CREWMATE" completed={0} total={5} />);
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.style.width).toBe("0%");
    });

    it("should render progress bar at 60% width for 3/5 quests", () => {
        render(<QuestProgress role="CREWMATE" completed={3} total={5} />);
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.style.width).toBe("60%");
    });

    it("should use Rajdhani font for labels", () => {
        render(<QuestProgress role="CREWMATE" completed={0} total={0} />);
        const label = screen.getByText("Progression des quêtes");
        expect(label.className).toContain("font-rajdhani");
    });
});
