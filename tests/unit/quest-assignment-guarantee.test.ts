import { describe, it, expect, vi } from 'vitest';
import { assignQuestsFromBatch } from '@/lib/quests/quest-assignment';
import { GameState } from '@/types/game';
import { Quest } from '@/types/quest';
import * as batchActions from '@/lib/redis/batch-actions';

vi.mock('@/lib/redis/batch-actions');

describe('Quest Assignment Verification', () => {
  it('should guarantee at least one mini-game is assigned to the player', async () => {
    const mockBatch = {
      id: 'batch-1',
      questCount: 30,
      createdAt: new Date().toISOString(),
      quests: [
        // 1 mini-game per duration as per new batch generator
        { id: 'mg-short', type: 'mini-game', duration: 'short' },
        { id: 'mg-med', type: 'mini-game', duration: 'medium' },
        { id: 'mg-long', type: 'mini-game', duration: 'long' },
        // Fill with classic quests
        ...Array.from({ length: 9 }, (_, i) => ({ id: `s-${i}`, type: 'qcm', duration: 'short' })),
        ...Array.from({ length: 9 }, (_, i) => ({ id: `m-${i}`, type: 'qcm', duration: 'medium' })),
        ...Array.from({ length: 9 }, (_, i) => ({ id: `l-${i}`, type: 'qcm', duration: 'long' })),
      ]
    };

    vi.mocked(batchActions.getBatchData).mockResolvedValue({
      success: true,
      data: mockBatch as { id: string; questCount: number; createdAt: string; quests: Array<{ id: string; type: 'qcm' | 'mini-game'; duration: 'short' | 'medium' | 'long' }> }
    });

    const gameState: Partial<GameState> = {
      batchId: 'batch-1',
      questsPerPlayer: { short: 3, medium: 3, long: 3 }
    };

    // Run multiple times to check randomness/guarantee
    for (let i = 0; i < 20; i++) {
      const assignments = await assignQuestsFromBatch(gameState as GameState);
      const hasMiniGame = assignments.some(a => a.questType === 'mini-game');
      expect(hasMiniGame).toBe(true);
    }
  });

  it('should handle batches with no mini-games gracefully (fallback to normal assignment)', async () => {
    const mockBatch = {
      id: 'batch-no-mg',
      questCount: 10,
      createdAt: new Date().toISOString(),
      quests: Array.from({ length: 10 }, (_, i) => ({ id: `q-${i}`, type: 'qcm', duration: 'short' }))
    };

    vi.mocked(batchActions.getBatchData).mockResolvedValue({
      success: true,
      data: mockBatch as { id: string; questCount: number; createdAt: string; quests: Array<{ id: string; type: 'qcm' | 'mini-game'; duration: 'short' | 'medium' | 'long' }> }
    });

    const gameState: Partial<GameState> = {
      batchId: 'batch-no-mg',
      questsPerPlayer: { short: 3, medium: 0, long: 0 }
    };

    const assignments = await assignQuestsFromBatch(gameState as GameState);
    expect(assignments).toHaveLength(3);
    expect(assignments.every(a => a.questType === 'qcm')).toBe(true);
  });

  it('should prioritize least-used quests to spread assignments across players', async () => {
    const mockBatch = {
      id: 'batch-balanced',
      questCount: 6,
      createdAt: new Date().toISOString(),
      quests: [
        { id: 's-1', type: 'qcm', duration: 'short' },
        { id: 's-2', type: 'qcm', duration: 'short' },
        { id: 'm-1', type: 'qcm', duration: 'medium' },
        { id: 'm-2', type: 'qcm', duration: 'medium' },
        { id: 'l-1', type: 'qcm', duration: 'long' },
        { id: 'l-2', type: 'qcm', duration: 'long' },
      ],
    };

    vi.mocked(batchActions.getBatchData).mockResolvedValue({
      success: true,
      data: mockBatch as { id: string; questCount: number; createdAt: string; quests: Array<{ id: string; type: 'qcm' | 'mini-game'; duration: 'short' | 'medium' | 'long' }> },
    });

    const gameState: Partial<GameState> = {
      batchId: 'batch-balanced',
      questsPerPlayer: { short: 1, medium: 1, long: 1 },
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          isAlive: true,
          assignedQuests: ['s-1', 'm-1', 'l-1'],
        },
      ],
    };

    const assignments = await assignQuestsFromBatch(gameState as GameState);
    const assignedIds = assignments.map((assignment) => assignment.questId);

    expect(assignedIds).toContain('s-2');
    expect(assignedIds).toContain('m-2');
    expect(assignedIds).toContain('l-2');
    expect(assignedIds).not.toContain('s-1');
    expect(assignedIds).not.toContain('m-1');
    expect(assignedIds).not.toContain('l-1');
  });
});
