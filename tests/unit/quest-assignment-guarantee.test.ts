import { describe, it, expect, vi } from 'vitest';
import {
  assignQuestsFromBatch,
  assignQuestsFromLoadedBatch,
  optimizeCrewmateAssignmentsFromLoadedBatch
} from '@/lib/quests/quest-assignment';
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

  it('should minimize overlap to zero for 2 players with 30 quests (10/10/10) when feasible', () => {
    const makeDurationQuests = (duration: 'short' | 'medium' | 'long', prefix: string) => ([
      { id: `${prefix}-mg-1`, type: 'mini-game' as const, duration },
      { id: `${prefix}-mg-2`, type: 'mini-game' as const, duration },
      { id: `${prefix}-mg-3`, type: 'mini-game' as const, duration },
      { id: `${prefix}-mg-4`, type: 'mini-game' as const, duration },
      { id: `${prefix}-tf-1`, type: 'true-false' as const, duration },
      { id: `${prefix}-qcm-1`, type: 'qcm' as const, duration },
      { id: `${prefix}-intrus-1`, type: 'intrus' as const, duration },
      { id: `${prefix}-num-1`, type: 'number-input' as const, duration },
      { id: `${prefix}-single-1`, type: 'single-input' as const, duration },
      { id: `${prefix}-qcm-2`, type: 'qcm' as const, duration },
    ]);

    const batch = {
      id: 'batch-30',
      quests: [
        ...makeDurationQuests('short', 's'),
        ...makeDurationQuests('medium', 'm'),
        ...makeDurationQuests('long', 'l'),
      ],
    };

    const gameState = {
      id: 'game-30',
      status: 'LOBBY',
      players: [
        { id: 'p1', name: 'P1', isAlive: true, role: 'CREWMATE' },
        { id: 'p2', name: 'P2', isAlive: true, role: 'CREWMATE' },
      ],
      createdAt: Date.now(),
      revision: 1,
      updatedAt: Date.now(),
      questsPerPlayer: { short: 4, medium: 3, long: 2 },
    } as GameState;

    const optimized = optimizeCrewmateAssignmentsFromLoadedBatch(gameState, batch, {
      playerIds: ['p1', 'p2'],
      targetPlayerId: 'p1',
      restarts: 64,
    });

    const p1 = optimized.assignmentsByPlayerId.p1 ?? [];
    const p2 = optimized.assignmentsByPlayerId.p2 ?? [];
    const p1Ids = new Set(p1.map((assignment) => assignment.questId));
    const overlap = p2.filter((assignment) => p1Ids.has(assignment.questId));
    const maxCount = (assignments: typeof p1) => {
      const counts = assignments.reduce<Record<string, number>>((acc, assignment) => {
        acc[assignment.questType] = (acc[assignment.questType] ?? 0) + 1;
        return acc;
      }, {});
      return Math.max(...Object.values(counts));
    };

    expect(p1).toHaveLength(9);
    expect(p2).toHaveLength(9);
    expect(overlap).toHaveLength(0);
    expect(maxCount(p1)).toBeLessThanOrEqual(2);
    expect(maxCount(p2)).toBeLessThanOrEqual(2);
  });

  it('should prioritize target-player type diversity before overlap reduction', () => {
    const makeDurationQuests = (duration: 'short' | 'medium' | 'long', prefix: string) => ([
      { id: `${prefix}-mg-1`, type: 'mini-game' as const, duration },
      { id: `${prefix}-mg-2`, type: 'mini-game' as const, duration },
      { id: `${prefix}-tf-1`, type: 'true-false' as const, duration },
      { id: `${prefix}-qcm-1`, type: 'qcm' as const, duration },
      { id: `${prefix}-intrus-1`, type: 'intrus' as const, duration },
      { id: `${prefix}-num-1`, type: 'number-input' as const, duration },
      { id: `${prefix}-single-1`, type: 'single-input' as const, duration },
      { id: `${prefix}-tf-2`, type: 'true-false' as const, duration },
      { id: `${prefix}-qcm-2`, type: 'qcm' as const, duration },
      { id: `${prefix}-mg-3`, type: 'mini-game' as const, duration },
    ]);

    const batch = {
      id: 'batch-diversity-first',
      quests: [
        ...makeDurationQuests('short', 's'),
        ...makeDurationQuests('medium', 'm'),
        ...makeDurationQuests('long', 'l'),
      ],
    };

    const gameState = {
      id: 'game-diversity-first',
      status: 'LOBBY',
      players: [
        { id: 'target', name: 'Target', isAlive: true, role: 'CREWMATE' },
        { id: 'other', name: 'Other', isAlive: true, role: 'CREWMATE' },
      ],
      createdAt: Date.now(),
      revision: 1,
      updatedAt: Date.now(),
      questsPerPlayer: { short: 4, medium: 3, long: 2 },
    } as GameState;

    const optimized = optimizeCrewmateAssignmentsFromLoadedBatch(gameState, batch, {
      playerIds: ['target', 'other'],
      targetPlayerId: 'target',
      restarts: 64,
    });

    const targetAssignments = optimized.assignmentsByPlayerId.target ?? [];
    const targetTypes = new Set(targetAssignments.map((assignment) => assignment.questType));
    expect(targetAssignments).toHaveLength(9);
    expect(targetTypes.size).toBe(6);
  });

  it('should keep overlap at the minimum feasible level under scarcity', () => {
    const batch = {
      id: 'batch-scarcity',
      quests: [
        { id: 's-mg', type: 'mini-game' as const, duration: 'short' as const },
        { id: 's-qcm', type: 'qcm' as const, duration: 'short' as const },
        { id: 'm-mg', type: 'mini-game' as const, duration: 'medium' as const },
        { id: 'l-mg', type: 'mini-game' as const, duration: 'long' as const },
      ],
    };

    const gameState = {
      id: 'game-scarcity',
      status: 'LOBBY',
      players: [
        { id: 'p1', name: 'P1', isAlive: true, role: 'CREWMATE' },
        { id: 'p2', name: 'P2', isAlive: true, role: 'CREWMATE' },
      ],
      createdAt: Date.now(),
      revision: 1,
      updatedAt: Date.now(),
      questsPerPlayer: { short: 2, medium: 0, long: 0 },
    } as GameState;

    const optimized = optimizeCrewmateAssignmentsFromLoadedBatch(gameState, batch, {
      playerIds: ['p1', 'p2'],
      targetPlayerId: 'p1',
      restarts: 64,
    });

    const p1Ids = new Set((optimized.assignmentsByPlayerId.p1 ?? []).map((assignment) => assignment.questId));
    const overlapCount = (optimized.assignmentsByPlayerId.p2 ?? []).filter((assignment) =>
      p1Ids.has(assignment.questId)
    ).length;

    expect(overlapCount).toBe(2);
  });

  it('should rebalance globally on new join without worsening overlap versus sequential assignment', () => {
    const makeDurationQuests = (duration: 'short' | 'medium' | 'long', prefix: string) => ([
      { id: `${prefix}-mg-1`, type: 'mini-game' as const, duration },
      { id: `${prefix}-mg-2`, type: 'mini-game' as const, duration },
      { id: `${prefix}-tf-1`, type: 'true-false' as const, duration },
      { id: `${prefix}-qcm-1`, type: 'qcm' as const, duration },
      { id: `${prefix}-intrus-1`, type: 'intrus' as const, duration },
      { id: `${prefix}-num-1`, type: 'number-input' as const, duration },
      { id: `${prefix}-single-1`, type: 'single-input' as const, duration },
      { id: `${prefix}-tf-2`, type: 'true-false' as const, duration },
      { id: `${prefix}-qcm-2`, type: 'qcm' as const, duration },
      { id: `${prefix}-mg-3`, type: 'mini-game' as const, duration },
    ]);

    const batch = {
      id: 'batch-rebalance',
      quests: [
        ...makeDurationQuests('short', 's'),
        ...makeDurationQuests('medium', 'm'),
        ...makeDurationQuests('long', 'l'),
      ],
    };

    const baseState = {
      id: 'game-rebalance',
      status: 'LOBBY',
      players: [],
      createdAt: Date.now(),
      revision: 1,
      updatedAt: Date.now(),
      questsPerPlayer: { short: 4, medium: 3, long: 2 },
    } as GameState;

    const p1Sequential = assignQuestsFromLoadedBatch(baseState, batch);
    const stateWithP1 = {
      ...baseState,
      players: [{
        id: 'p1',
        name: 'P1',
        isAlive: true,
        role: 'CREWMATE' as const,
        assignedQuests: p1Sequential.map((assignment) => assignment.questId),
      }],
    } as GameState;
    const p2Sequential = assignQuestsFromLoadedBatch(stateWithP1, batch);
    const p1SequentialIds = new Set(p1Sequential.map((assignment) => assignment.questId));
    const sequentialOverlap = p2Sequential.filter((assignment) => p1SequentialIds.has(assignment.questId)).length;

    const globalState = {
      ...baseState,
      players: [
        { id: 'p1', name: 'P1', isAlive: true, role: 'CREWMATE' as const },
        { id: 'p2', name: 'P2', isAlive: true, role: 'CREWMATE' as const },
      ],
    } as GameState;
    const optimized = optimizeCrewmateAssignmentsFromLoadedBatch(globalState, batch, {
      playerIds: ['p1', 'p2'],
      targetPlayerId: 'p1',
      restarts: 64,
    });
    const p1OptimizedIds = new Set((optimized.assignmentsByPlayerId.p1 ?? []).map((assignment) => assignment.questId));
    const globalOverlap = (optimized.assignmentsByPlayerId.p2 ?? []).filter((assignment) =>
      p1OptimizedIds.has(assignment.questId)
    ).length;

    expect(globalOverlap).toBeLessThanOrEqual(sequentialOverlap);
  });
});
