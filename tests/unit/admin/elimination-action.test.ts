import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eliminatePlayer } from '@/app/admin/dashboard/actions';
import { verifySession } from '@/lib/redis/auth-utils';
import { getGame, eliminatePlayer as eliminatePlayerAction } from '@/lib/redis/actions';

// Mock the dependencies
vi.mock('@/lib/redis/auth-utils');
vi.mock('@/lib/redis/actions');

const mockVerifySession = vi.mocked(verifySession);
const mockGetGame = vi.mocked(getGame);
const mockEliminatePlayerAction = vi.mocked(eliminatePlayerAction);

describe('Admin Elimination Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully eliminates a player when admin is authorized', async () => {
    // Mock admin session
    mockVerifySession.mockResolvedValue({
      success: true,
      data: { userId: 'admin-123', username: 'admin', role: 'organizer' }
    });

    // Mock game data where admin is creator
    mockGetGame.mockResolvedValue({
      success: true,
      data: {
        id: 'game-123',
        creatorId: 'admin-123',
        status: 'IN_PROGRESS',
        createdAt: Date.now(),
        players: [
          { id: 'player-1', name: 'Player1', isAlive: true },
          { id: 'player-2', name: 'Player2', isAlive: true }
        ]
      }
    });

    // Mock successful elimination
    mockEliminatePlayerAction.mockResolvedValue({
      success: true,
      data: { isAlive: false }
    });

    const result = await eliminatePlayer('game-123', 'player-1');

    expect(result.success).toBe(true);
    expect(mockVerifySession).toHaveBeenCalled();
    expect(mockGetGame).toHaveBeenCalledWith('game-123');
    expect(mockEliminatePlayerAction).toHaveBeenCalledWith('game-123', 'player-1');
  });

  it('fails when admin is not authenticated', async () => {
    mockVerifySession.mockResolvedValue({
      success: false,
      error: 'Unauthorized'
    });

    const result = await eliminatePlayer('game-123', 'player-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized: Admin access required');
    expect(mockGetGame).not.toHaveBeenCalled();
    expect(mockEliminatePlayerAction).not.toHaveBeenCalled();
  });

  it('fails when game is not found', async () => {
    mockVerifySession.mockResolvedValue({
      success: true,
      data: { userId: 'admin-123', username: 'admin', role: 'organizer' }
    });

    mockGetGame.mockResolvedValue({
      success: false,
      error: 'Game not found'
    });

    const result = await eliminatePlayer('game-123', 'player-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Game not found');
    expect(mockEliminatePlayerAction).not.toHaveBeenCalled();
  });

  it('fails when admin is not the game creator', async () => {
    mockVerifySession.mockResolvedValue({
      success: true,
      data: { userId: 'admin-456', username: 'admin', role: 'organizer' }
    });

    mockGetGame.mockResolvedValue({
      success: true,
      data: {
        id: 'game-123',
        creatorId: 'admin-123', // Different creator
        status: 'IN_PROGRESS',
        createdAt: Date.now(),
        players: []
      }
    });

    const result = await eliminatePlayer('game-123', 'player-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized: Only game creator can eliminate players');
    expect(mockEliminatePlayerAction).not.toHaveBeenCalled();
  });

  it('fails when elimination action fails', async () => {
    mockVerifySession.mockResolvedValue({
      success: true,
      data: { userId: 'admin-123', username: 'admin', role: 'organizer' }
    });

    mockGetGame.mockResolvedValue({
      success: true,
      data: {
        id: 'game-123',
        creatorId: 'admin-123',
        status: 'IN_PROGRESS',
        createdAt: Date.now(),
        players: []
      }
    });

    mockEliminatePlayerAction.mockResolvedValue({
      success: false,
      error: 'Player not found'
    });

    const result = await eliminatePlayer('game-123', 'player-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Player not found');
  });

  it('handles unexpected errors gracefully', async () => {
    mockVerifySession.mockRejectedValue(new Error('Database connection failed'));

    const result = await eliminatePlayer('game-123', 'player-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to eliminate player');
  });
});
