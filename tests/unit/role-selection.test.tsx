import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RoleSelection } from "@/components/game/role-selection";
import { useGameStore } from "@/lib/store/game-store";
import { useLocalUser } from "@/hooks/use-local-user";

vi.mock("@/lib/store/game-store");
vi.mock("@/hooks/use-local-user");

describe("RoleSelection Component", () => {
    const mockChooseRole = vi.fn();
    const mockOnRoleSelected = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        
        vi.mocked(useGameStore).mockReturnValue({
            chooseRole: mockChooseRole,
            isSelectingRole: false,
            roleError: null,
            gameState: null,
            isLoading: false,
            isLaunching: false,
            error: null,
            errorCode: null,
            launchError: null,
            selectedRole: null,
            questsCompleted: 0,
            questsTotal: 0,
            fetchGame: vi.fn(),
            join: vi.fn(),
            launch: vi.fn(),
            reset: vi.fn(),
        });

        vi.mocked(useLocalUser).mockReturnValue({
            userId: "test-user-123",
        });

        Object.defineProperty(navigator, 'vibrate', {
            value: vi.fn(),
            writable: true,
            configurable: true,
        });
    });

    it("should render role selection title", () => {
        render(<RoleSelection gameId="game-123" />);
        expect(screen.getByText(/Choisissez votre rôle/i)).toBeTruthy();
    });

    it("should render both Crewmate and Impostor buttons", () => {
        render(<RoleSelection gameId="game-123" />);
        expect(screen.getByText(/Crew/i)).toBeTruthy();
        expect(screen.getByText(/Imp/i)).toBeTruthy();
    });

    it("should call chooseRole with CREWMATE when Crewmate button is clicked", async () => {
        mockChooseRole.mockResolvedValue(true);
        
        render(<RoleSelection gameId="game-123" onRoleSelected={mockOnRoleSelected} />);
        
        const crewmateButton = screen.getByText(/Crew/i).closest("button");
        fireEvent.click(crewmateButton!);

        await waitFor(() => {
            expect(mockChooseRole).toHaveBeenCalledWith("game-123", "test-user-123", "CREWMATE");
        });
    });

    it("should call chooseRole with IMPOSTOR when Impostor button is clicked", async () => {
        mockChooseRole.mockResolvedValue(true);
        
        render(<RoleSelection gameId="game-123" onRoleSelected={mockOnRoleSelected} />);
        
        const impostorButton = screen.getByText(/Imp/i).closest("button");
        fireEvent.click(impostorButton!);

        await waitFor(() => {
            expect(mockChooseRole).toHaveBeenCalledWith("game-123", "test-user-123", "IMPOSTOR");
        });
    });

    it("should trigger haptic feedback on role selection", async () => {
        mockChooseRole.mockResolvedValue(true);
        const vibrateMock = vi.fn();
        Object.defineProperty(navigator, 'vibrate', {
            value: vibrateMock,
            writable: true,
        });
        
        render(<RoleSelection gameId="game-123" />);
        
        const crewmateButton = screen.getByText(/Crew/i).closest("button");
        fireEvent.click(crewmateButton!);

        await waitFor(() => {
            expect(vibrateMock).toHaveBeenCalledWith(50);
        });
    });

    it("should call onRoleSelected callback after successful selection", async () => {
        mockChooseRole.mockResolvedValue(true);
        
        render(<RoleSelection gameId="game-123" onRoleSelected={mockOnRoleSelected} />);
        
        const crewmateButton = screen.getByText(/Crew/i).closest("button");
        fireEvent.click(crewmateButton!);

        await waitFor(() => {
            expect(mockOnRoleSelected).toHaveBeenCalled();
        });
    });

    it("should not call onRoleSelected if selection fails", async () => {
        mockChooseRole.mockResolvedValue(false);
        
        render(<RoleSelection gameId="game-123" onRoleSelected={mockOnRoleSelected} />);
        
        const crewmateButton = screen.getByText(/Crew/i).closest("button");
        fireEvent.click(crewmateButton!);

        await waitFor(() => {
            expect(mockChooseRole).toHaveBeenCalled();
        });
        
        expect(mockOnRoleSelected).not.toHaveBeenCalled();
    });

    it("should disable buttons when isSelectingRole is true", () => {
        vi.mocked(useGameStore).mockReturnValue({
            chooseRole: mockChooseRole,
            isSelectingRole: true,
            roleError: null,
            gameState: null,
            isLoading: false,
            isLaunching: false,
            error: null,
            errorCode: null,
            launchError: null,
            selectedRole: null,
            questsCompleted: 0,
            questsTotal: 0,
            fetchGame: vi.fn(),
            join: vi.fn(),
            launch: vi.fn(),
            reset: vi.fn(),
        });

        render(<RoleSelection gameId="game-123" />);
        
        const crewmateButton = screen.getByText(/Crew/i).closest("button");
        const impostorButton = screen.getByText(/Imp/i).closest("button");

        expect(crewmateButton?.hasAttribute("disabled")).toBe(true);
        expect(impostorButton?.hasAttribute("disabled")).toBe(true);
    });

    it("should display loading state when isSelectingRole is true", () => {
        vi.mocked(useGameStore).mockReturnValue({
            chooseRole: mockChooseRole,
            isSelectingRole: true,
            roleError: null,
            gameState: null,
            isLoading: false,
            isLaunching: false,
            error: null,
            errorCode: null,
            launchError: null,
            selectedRole: null,
            questsCompleted: 0,
            questsTotal: 0,
            fetchGame: vi.fn(),
            join: vi.fn(),
            launch: vi.fn(),
            reset: vi.fn(),
        });

        render(<RoleSelection gameId="game-123" />);
        
        expect(screen.getByText(/Attribution du rôle en cours/i)).toBeTruthy();
    });

    it("should display error message when roleError is present", () => {
        const errorMessage = "Cannot select role: game is not in progress.";
        vi.mocked(useGameStore).mockReturnValue({
            chooseRole: mockChooseRole,
            isSelectingRole: false,
            roleError: errorMessage,
            gameState: null,
            isLoading: false,
            isLaunching: false,
            error: null,
            errorCode: null,
            launchError: null,
            selectedRole: null,
            questsCompleted: 0,
            questsTotal: 0,
            fetchGame: vi.fn(),
            join: vi.fn(),
            launch: vi.fn(),
            reset: vi.fn(),
        });

        render(<RoleSelection gameId="game-123" />);
        
        expect(screen.getByText(errorMessage)).toBeTruthy();
    });

    it("should have minimum 44px touch targets for buttons", () => {
        render(<RoleSelection gameId="game-123" />);
        
        const crewmateButton = screen.getByText(/Crew/i).closest("button");
        const impostorButton = screen.getByText(/Imp/i).closest("button");

        expect(crewmateButton?.style.minWidth).toBe('44px');
        expect(crewmateButton?.style.minHeight).toBe('120px');
        expect(impostorButton?.style.minWidth).toBe('44px');
        expect(impostorButton?.style.minHeight).toBe('120px');
    });
});
