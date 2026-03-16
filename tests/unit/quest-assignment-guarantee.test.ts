import { describe, it, expect, vi } from 'vitest';
import { assignQuestsFromBatch, assignQuestsFromLoadedBatch } from '@/lib/quests/quest-assignment';
import { GameState } from '@/types/game';
import * as batchActions from '@/lib/redis/batch-actions';

vi.mock('@/lib/redis/batch-actions');

type TestBatch = {
  id: string;
  quests: Array<{
    id: string;
    type: 'qcm' | 'true-false' | 'intrus' | 'mini-game';
    duration: 'short' | 'medium' | 'long';
  }>;
};

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
    expect(assignments).toEqual([]);
  });

  it('should prioritize globally least-used quests across players while keeping a mini-game', async () => {
    const mockBatch = {
      id: 'batch-diversified',
      questCount: 9,
      createdAt: new Date().toISOString(),
      quests: [
        { id: 's-mg', type: 'mini-game', duration: 'short' },
        { id: 's-used', type: 'qcm', duration: 'short' },
        { id: 's-fresh', type: 'true-false', duration: 'short' },
        { id: 'm-mg', type: 'mini-game', duration: 'medium' },
        { id: 'm-used', type: 'qcm', duration: 'medium' },
        { id: 'm-fresh', type: 'true-false', duration: 'medium' },
        { id: 'l-mg', type: 'mini-game', duration: 'long' },
        { id: 'l-used', type: 'qcm', duration: 'long' },
        { id: 'l-fresh', type: 'true-false', duration: 'long' },
      ],
    };

    vi.mocked(batchActions.getBatchData).mockResolvedValue({
      success: true,
      data: mockBatch as {
        id: string;
        questCount: number;
        createdAt: string;
        quests: Array<{ id: string; type: 'qcm' | 'true-false' | 'mini-game'; duration: 'short' | 'medium' | 'long' }>;
      },
    });

    const gameState: Partial<GameState> = {
      batchId: 'batch-diversified',
      questsPerPlayer: { short: 1, medium: 1, long: 1 },
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          isAlive: true,
          assignedQuests: ['s-used', 'm-used', 'l-used'],
        },
      ],
    };

    const assignments = await assignQuestsFromBatch(gameState as GameState);
    const assignedIds = assignments.map((assignment) => assignment.questId);
    const hasMiniGame = assignments.some((assignment) => assignment.questType === 'mini-game');

    expect(assignedIds).toHaveLength(3);
    expect(assignedIds).not.toContain('s-used');
    expect(assignedIds).not.toContain('m-used');
    expect(assignedIds).not.toContain('l-used');
    expect(hasMiniGame).toBe(true);
  });

  it('should maximize global type diversity for one player before repeating a type when possible', () => {
    const assignments = assignQuestsFromLoadedBatch(
      {
        id: 'game-diversity',
        status: 'LOBBY',
        players: [],
        createdAt: Date.now(),
        revision: 1,
        updatedAt: Date.now(),
        questsPerPlayer: { short: 4, medium: 0, long: 0 },
      } as GameState,
      {
        id: 'batch-diversity',
        quests: [
          { id: 's-mg', type: 'mini-game', duration: 'short' },
          { id: 's-qcm', type: 'qcm', duration: 'short' },
          { id: 's-tf', type: 'true-false', duration: 'short' },
          { id: 's-intrus', type: 'intrus', duration: 'short' },
        ],
      } as TestBatch
    );

    const assignedTypes = assignments.map((assignment) => assignment.questType);
    expect(assignments).toHaveLength(4);
    expect(new Set(assignedTypes).size).toBe(4);
    expect(assignedTypes).toContain('mini-game');
  });

  it('should fallback to type repetition when unique types are exhausted', () => {
    const assignments = assignQuestsFromLoadedBatch(
      {
        id: 'game-fallback',
        status: 'LOBBY',
        players: [],
        createdAt: Date.now(),
        revision: 1,
        updatedAt: Date.now(),
        questsPerPlayer: { short: 4, medium: 0, long: 0 },
      } as GameState,
      {
        id: 'batch-fallback',
        quests: [
          { id: 's-mg', type: 'mini-game', duration: 'short' },
          { id: 's-qcm-a', type: 'qcm', duration: 'short' },
          { id: 's-qcm-b', type: 'qcm', duration: 'short' },
          { id: 's-tf', type: 'true-false', duration: 'short' },
        ],
      } as TestBatch
    );

    const assignedTypes = assignments.map((assignment) => assignment.questType);
    const assignedIds = assignments.map((assignment) => assignment.questId);
    const repeatedTypes = assignedTypes.filter(
      (type, index) => assignedTypes.indexOf(type) !== index
    );

    expect(assignments).toHaveLength(4);
    expect(new Set(assignedIds).size).toBe(4);
    expect(repeatedTypes.length).toBeGreaterThan(0);
  });

  it('should produce different valid assignments with different random values', () => {
    const gameState = {
      id: 'game-random',
      status: 'LOBBY',
      players: [],
      createdAt: Date.now(),
      revision: 1,
      updatedAt: Date.now(),
      questsPerPlayer: { short: 3, medium: 0, long: 0 },
    } as GameState;

    const batch: TestBatch = {
      id: 'batch-random',
      quests: [
        { id: 's-mg-a', type: 'mini-game', duration: 'short' },
        { id: 's-mg-b', type: 'mini-game', duration: 'short' },
        { id: 's-qcm-a', type: 'qcm', duration: 'short' },
        { id: 's-qcm-b', type: 'qcm', duration: 'short' },
        { id: 's-tf-a', type: 'true-false', duration: 'short' },
      ],
    };

    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValue(0);
    const lowRandom = assignQuestsFromLoadedBatch(gameState, batch);

    randomSpy.mockReturnValue(0.99);
    const highRandom = assignQuestsFromLoadedBatch(gameState, batch);
    randomSpy.mockRestore();

    const lowIds = lowRandom.map((assignment) => assignment.questId);
    const highIds = highRandom.map((assignment) => assignment.questId);
    expect(lowIds).not.toEqual(highIds);
    expect(lowRandom.some((assignment) => assignment.questType === 'mini-game')).toBe(true);
    expect(highRandom.some((assignment) => assignment.questType === 'mini-game')).toBe(true);
  });
});
