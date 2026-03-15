import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GlobalTopHeader } from "@/components/common/global-top-header";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
let mockPathname = "/game/ABC123";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => mockPathname,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    authState: {
      isLoading: false,
      isAuthenticated: false,
      isAnonymous: true,
      session: {
        sessionType: "anonymous",
        userId: "u-1",
        username: "Player One",
        isAuthenticated: false,
      },
    },
    refreshAuth: vi.fn(),
    clearAnonymousSession: vi.fn(),
  }),
}));

vi.mock("@/lib/redis/auth-actions", () => ({
  clearSession: vi.fn(),
  disconnectPlayer: vi.fn(),
}));

describe("GlobalTopHeader rules modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/game/ABC123";
  });

  it("does not render on hidden routes", () => {
    mockPathname = "/";
    render(<GlobalTopHeader />);

    expect(screen.queryByRole("button", { name: "Règles" })).not.toBeInTheDocument();
  });

  it("renders scroll button when header is visible", () => {
    render(<GlobalTopHeader />);

    expect(screen.getByRole("button", { name: "Règles" })).toBeInTheDocument();
  });

  it("opens rules popup on click and shows document content", () => {
    render(<GlobalTopHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Règles" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Règles du jeu AMOGUS")).toBeInTheDocument();
    expect(screen.getByText(/Préparation/i)).toBeInTheDocument();
  });

  it("closes popup with close button", () => {
    render(<GlobalTopHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Règles" }));
    fireEvent.click(screen.getByRole("button", { name: "Fermer les règles" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes popup with escape key", () => {
    render(<GlobalTopHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Règles" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes popup when clicking on overlay", () => {
    render(<GlobalTopHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Règles" }));
    fireEvent.mouseDown(screen.getByTestId("rules-overlay"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
