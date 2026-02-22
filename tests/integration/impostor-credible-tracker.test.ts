import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, renderHook, act } from '@testing-library/react';
import { GameHome } from '@/components/game/game-home';
import { GameState, Player, PlayerRole } from '@/types/game';
import { Quest, QuestType, QuestDuration } from '@/types/quest';
import { useGameStore } from '@/lib/store/game-store';

// Mock dependencies
vi.mock('@/lib/redis/batch-actions', () => ({
  getBatch: vi.fn(),
}));

vi.mock('@/hooks/use-camera-scanner', () => ({
  useCameraScanner: () => ({
    isOpen: false,
    isLoading: false,
    openScanner: vi.fn(),
    closeScanner: vi.fn(),
    handleScan: vi.fn(),
  }),
}));

describe('Impostor Credible Tracker Integration', () => {
  let mockGameState: GameState;
  let mockImpostorPlayer: Player;
  let mockBatchQuests: Quest[];

  beforeEach(async () => {
    // Reset store before each test
    const { reset } = useGameStore.getState();
    reset();

    // Mock game state
    mockGameState = {
      id: 'test-game',
      status: 'IN_PROGRESS',
      players: [],
      createdAt: Date.now(),
      batchId: 'test-batch',
      questsTotal: 3,
      questsPerPlayer: { short: 1, medium: 1, long: 1 },
    };

    // Mock impostor player
    mockImpostorPlayer = {
      id: 'impostor-1',
      name: 'Test Impostor',
      role: 'IMPOSTOR' as PlayerRole,
      completedQuests: [],
      isAlive: true,
    };

    // Mock batch quests
    mockBatchQuests = [
      { id: 'quest1', type: 'qcm' as QuestType, duration: 'short' as QuestDuration },
      { id: 'quest2', type: 'true-false' as QuestType, duration: 'medium' as QuestDuration },
      { id: 'quest3', type: 'form' as QuestType, duration: 'long' as QuestDuration },
    ];

    // Mock getBatch to return our test data
    const { getBatch } = await import('@/lib/redis/batch-actions');
    vi.mocked(getBatch).mockResolvedValue({
      success: true,
      data: {
        id: 'test-batch',
        questCount: 3,
        quests: mockBatchQuests,
        createdAt: new Date().toISOString(),
      },
    });
  });

  it('should initialize and display fake quest list for impostors', async () => {
    render(
      React.createElement(GameHome, {
        gameState: mockGameState,
        currentPlayer: mockImpostorPlayer,
        userId: 'impostor-1',
      })
    );

    // Wait for quest initialization
    await waitFor(() => {
      expect(screen.getByText('Progression des quêtes')).toBeInTheDocument();
    });

    // Should show quest list items
    await waitFor(() => {
      expect(screen.getByText('Quête 1')).toBeInTheDocument();
      expect(screen.getByText('Quête 2')).toBeInTheDocument();
      expect(screen.getByText('Quête 3')).toBeInTheDocument();
    });

    // Should show progress
    expect(screen.getByText('0/3 quêtes accomplies')).toBeInTheDocument();
    
    // Should NOT show location labels initially (they're set during scanning)
    expect(screen.queryByText('📍 Salle des machines')).not.toBeInTheDocument();
    expect(screen.queryByText('📍 Pont de commandement')).not.toBeInTheDocument();
    expect(screen.queryByText('📍 Secteur médical')).not.toBeInTheDocument();
  });

  it('should show visual parity with crewmate display', async () => {
    render(
      React.createElement(GameHome, {
        gameState: mockGameState,
        currentPlayer: mockImpostorPlayer,
        userId: 'impostor-1',
      })
    );

    await waitFor(() => {
      // Should have same structure as crewmate view
      const progressSection = screen.getByText('Progression des quêtes');
      expect(progressSection).toBeInTheDocument();
      
      // Should have progress bar
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '3');
    });
  });

  it('should update progress when impostor scans QR codes', async () => {
    const { result } = renderHook(() => useGameStore());
    
    render(
      React.createElement(GameHome, {
        gameState: mockGameState,
        currentPlayer: mockImpostorPlayer,
        userId: 'impostor-1',
      })
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByText('0/3 quêtes accomplies')).toBeInTheDocument();
    });

    // Simulate quest completion
    act(() => {
      result.current.completeImpostorQuest('quest1');
    });

    // Should update progress
    await waitFor(() => {
      expect(screen.getByText('1/3 quêtes accomplies')).toBeInTheDocument();
    });

    // Should show completed checkmark
    const questItems = screen.getAllByText(/Quête \d+/);
    expect(questItems[0]).toBeInTheDocument(); // First quest should now be completed
  });

  it('should not affect crewmate gameplay', async () => {
    const mockCrewmatePlayer: Player = {
      ...mockImpostorPlayer,
      role: 'CREWMATE' as PlayerRole,
    };

    render(
      React.createElement(GameHome, {
        gameState: mockGameState,
        currentPlayer: mockCrewmatePlayer,
        userId: 'crewmate-1',
      })
    );

    await waitFor(() => {
      expect(screen.getByText('Progression des quêtes')).toBeInTheDocument();
    });

    // Should show normal crewmate progress (no quest list)
    // When questsTotal is 0, crewmates see "En attente de missions..."
    expect(screen.getByText('En attente de missions...')).toBeInTheDocument();
    
    // Should NOT show quest list items for crewmates
    expect(screen.queryByText('Quête 1')).not.toBeInTheDocument();
    expect(screen.queryByText('📍 Salle des machines')).not.toBeInTheDocument();
  });
});
