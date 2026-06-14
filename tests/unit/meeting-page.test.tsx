import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MeetingPage from "@/app/game/[id]/meeting/page-client";
import { GameState } from "@/types/game";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "game-1" }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    authState: {
      session: { userId: "u1" },
    },
  }),
}));

const mockUseGameStore = vi.hoisted(() => vi.fn());

vi.mock("@/lib/store/game-store", () => ({
  useGameStore: mockUseGameStore,
  useRealTimeGamePolling: vi.fn(() => ({
    isConnected: true,
  })),
}));

vi.mock("@/components/game/reactor-sabotage-alert", () => ({
  ReactorSabotageAlert: () => null,
}));
vi.mock("@/components/game/game-over-screen", () => ({
  GameOverScreen: () => null,
}));

describe("MeetingPage", () => {
  it("highlights the found dead player row when meeting was triggered from their phone", () => {
    const now = Date.now();
    const gameState: GameState = {
      id: "game-1",
      status: "IN_PROGRESS",
      createdAt: now - 100000,
      revision: 1,
      updatedAt: now,
      players: [
        { id: "u1", name: "Reporter", role: "CREWMATE", isAlive: true },
        { id: "u2", name: "Alex", role: "CREWMATE", isAlive: false },
        { id: "u3", name: "Imp", role: "IMPOSTOR", isAlive: true },
      ],
      meeting: {
        id: "meeting-1",
        status: "ACTIVE",
        startedAt: now - 20_000,
        endsAt: now + 60_000,
        startedBy: "u2",
        snapshot: {
          capturedAt: now - 20_000,
          progress: {
            completed: 1,
            total: 6,
            percentage: 16,
          },
          players: [
            { id: "u1", name: "Reporter", role: "CREWMATE", isAlive: true },
            { id: "u2", name: "Alex", role: "CREWMATE", isAlive: false },
            { id: "u3", name: "Imp", role: "IMPOSTOR", isAlive: true },
          ],
        },
        eligibleVoterIds: ["u1", "u3"],
        voteCounts: {
          u1: 0,
          u3: 0,
        },
        totalEligibleVoters: 2,
        totalVotes: 0,
      },
    };

    mockUseGameStore.mockReturnValue({
      fetchGame: vi.fn(),
      gameState,
      meetingView: { meeting: gameState.meeting, myVoteTargetId: null },
      fetchMeetingView: vi.fn(),
      castMeetingVoteAction: vi.fn(),
      cancelMeetingVoteAction: vi.fn(),
      isMeetingVoting: false,
      isMeetingLoading: false,
      meetingError: null,
      meetingErrorCode: null,
    });

    render(<MeetingPage />);

    expect(screen.queryByText("Corps trouvé")).not.toBeInTheDocument();
    const foundBodyPlayerButton = screen.getByRole("button", { name: /Alex/i });
    expect(foundBodyPlayerButton.className).toContain("border-role-impostor/80");
    expect(screen.getByText(/CORPS/)).toBeInTheDocument();
  });

  it("shows a completion modal with eliminated player and cockpit primary CTA", () => {
    const now = Date.now();
    const gameState: GameState = {
      id: "game-1",
      status: "IN_PROGRESS",
      createdAt: now - 100000,
      revision: 1,
      updatedAt: now,
      players: [
        { id: "u1", name: "Reporter", role: "CREWMATE", isAlive: true },
        { id: "u2", name: "Alex", role: "CREWMATE", isAlive: false },
        { id: "u3", name: "Imp", role: "IMPOSTOR", isAlive: false },
      ],
      meeting: {
        id: "meeting-1",
        status: "COMPLETED",
        startedAt: now - 95_000,
        endsAt: now - 5_000,
        startedBy: "u2",
        snapshot: {
          capturedAt: now - 95_000,
          progress: {
            completed: 2,
            total: 6,
            percentage: 33,
          },
          players: [
            { id: "u1", name: "Reporter", role: "CREWMATE", isAlive: true },
            { id: "u2", name: "Alex", role: "CREWMATE", isAlive: false },
            { id: "u3", name: "Imp", role: "IMPOSTOR", isAlive: true },
          ],
        },
        eligibleVoterIds: ["u1"],
        voteCounts: {
          u1: 0,
        },
        totalEligibleVoters: 1,
        totalVotes: 1,
        eliminatedPlayerId: "u3",
        eliminatedPlayerName: "Imp",
        endReason: "ALL_VOTED",
        endedAt: now - 5_000,
      },
    };

    mockUseGameStore.mockReturnValue({
      fetchGame: vi.fn(),
      gameState,
      meetingView: { meeting: gameState.meeting, myVoteTargetId: null },
      fetchMeetingView: vi.fn(),
      castMeetingVoteAction: vi.fn(),
      cancelMeetingVoteAction: vi.fn(),
      isMeetingVoting: false,
      isMeetingLoading: false,
      meetingError: null,
      meetingErrorCode: null,
    });

    render(<MeetingPage />);

    expect(screen.getByRole("heading", { name: /Meeting terminé/i })).toBeInTheDocument();
    expect(screen.getByText("Imp a été éliminé.")).toBeInTheDocument();

    const returnLink = screen.getByRole("link", { name: /Retour cockpit/i });
    expect(returnLink).toHaveAttribute("href", "/game/game-1");
    expect(returnLink.className).toContain("bg-primary");
  });
});
