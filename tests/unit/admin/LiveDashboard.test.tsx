import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { LiveDashboard } from "@/components/admin/LiveDashboard";
import { GameState } from "@/types/game";
import { DashboardData } from "@/app/(organizer)/dashboard/actions";
import useSWR from "swr";

// Mock SWR
vi.mock("swr", () => ({
  default: vi.fn(),
}));

// Mock getDashboardData function
vi.mock("@/app/(organizer)/dashboard/actions", () => ({
  getDashboardData: vi.fn(),
}));

describe("LiveDashboard", () => {
  const mockGameState: GameState = {
    id: "TEST123",
    status: "IN_PROGRESS",
    players: [
      {
        id: "player1",
        name: "Omi",
        isAlive: true,
        completedQuests: ["quest1", "quest2"],
        role: "CREWMATE",
      },
      {
        id: "player2",
        name: "TestPlayer",
        isAlive: true,
        completedQuests: ["quest1"],
        role: "IMPOSTOR",
      },
    ],
    createdAt: Date.now(),
    questsPerPlayer: {
      short: 1,
      medium: 1,
      long: 1,
    },
  };

  const mockStats = {
    totalQuestsAssigned: 6,
    totalQuestsCompleted: 3,
    progressByFormat: {
      short: { assigned: 2, completed: 1 },
      medium: { assigned: 2, completed: 1 },
      long: { assigned: 2, completed: 1 },
    },
    playerProgress: [
      {
        id: "player1",
        name: "Omi",
        completed: 2,
        assigned: 3,
        percentage: 66.6,
        isAlive: true,
        role: "CREWMATE",
      },
      {
        id: "player2",
        name: "TestPlayer",
        completed: 1,
        assigned: 3,
        percentage: 33.3,
        isAlive: true,
        role: "IMPOSTOR",
      },
    ],
  };

  const mockDashboardData = {
    gameState: mockGameState,
    stats: mockStats,
  };

  const mockOnGameChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders game information correctly", () => {
    vi.mocked(useSWR).mockReturnValue({
      data: mockDashboardData as DashboardData,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<LiveDashboard gameId="TEST123" onGameChange={mockOnGameChange} />);

    expect(screen.getByText("Partie: TEST123")).toBeInTheDocument();
    expect(screen.getByText("Omi")).toBeInTheDocument();
    expect(screen.getByText("TestPlayer")).toBeInTheDocument();
    expect(screen.getByText("IN_PROGRESS")).toBeInTheDocument();
  });

  it("displays overall progress correctly", () => {
    vi.mocked(useSWR).mockReturnValue({
      data: mockDashboardData as DashboardData,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<LiveDashboard gameId="TEST123" onGameChange={mockOnGameChange} />);

    // 3 quests completed total (2 by Omi, 1 by TestPlayer)
    // 6 quests assigned total (3 per player * 2 players)
    expect(screen.getByText("3 / 6")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(useSWR).mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<LiveDashboard gameId="TEST123" onGameChange={mockOnGameChange} />);

    expect(screen.getByText("Chargement des données de partie...")).toBeInTheDocument();
  });

  it("shows error state", () => {
    vi.mocked(useSWR).mockReturnValue({
      data: null,
      error: new Error("Game not found"),
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<LiveDashboard gameId="TEST123" onGameChange={mockOnGameChange} />);

    expect(screen.getByText("Impossible de charger les données de partie")).toBeInTheDocument();
    expect(screen.getByText("Game not found")).toBeInTheDocument();
  });
});
