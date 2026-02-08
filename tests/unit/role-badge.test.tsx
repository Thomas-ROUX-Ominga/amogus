import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleBadge } from "@/components/game/role-badge";

describe("RoleBadge", () => {
    it("should render Crewmate role with green color", () => {
        render(<RoleBadge role="CREWMATE" />);
        expect(screen.getByText("Crewmate")).toBeTruthy();
        expect(screen.getByText("Votre rôle")).toBeTruthy();
    });

    it("should render Impostor role with red color", () => {
        render(<RoleBadge role="IMPOSTOR" />);
        expect(screen.getByText("Imposteur")).toBeTruthy();
        expect(screen.getByText("Votre rôle")).toBeTruthy();
    });

    it("should render Crewmate icon with correct color in full variant", () => {
        render(<RoleBadge role="CREWMATE" variant="full" />);
        const roleText = screen.getByText("Crewmate");
        expect(roleText.style.color).toBe("rgb(45, 164, 78)");
    });

    it("should render Impostor icon with correct color in full variant", () => {
        render(<RoleBadge role="IMPOSTOR" variant="full" />);
        const roleText = screen.getByText("Imposteur");
        expect(roleText.style.color).toBe("rgb(218, 54, 51)");
    });

    it("should render compact variant with smaller text", () => {
        render(<RoleBadge role="CREWMATE" variant="compact" />);
        const roleText = screen.getByText("Crewmate");
        expect(roleText.className).toContain("text-xs");
    });

    it("should render full variant by default", () => {
        render(<RoleBadge role="CREWMATE" />);
        const roleText = screen.getByText("Crewmate");
        expect(roleText.className).toContain("text-3xl");
    });

    it("should use Orbitron font for role name", () => {
        render(<RoleBadge role="CREWMATE" />);
        const roleText = screen.getByText("Crewmate");
        expect(roleText.className).toContain("font-orbitron");
    });

    it("should use Rajdhani font for label in full variant", () => {
        render(<RoleBadge role="CREWMATE" variant="full" />);
        const label = screen.getByText("Votre rôle");
        expect(label.className).toContain("font-rajdhani");
    });
});
