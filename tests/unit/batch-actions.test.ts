/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis client before any imports
vi.mock('@/lib/redis/client', () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  },
}));

import { createBatch, getAllBatches, deleteBatch } from '@/lib/redis/batch-actions';
import { BatchCreateInput } from '@/types/quest';
import { redis } from '@/lib/redis/client';

describe('Batch Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBatch', () => {
    it('should create a batch successfully', async () => {
      (redis.set as any).mockResolvedValue('OK');

      const input: BatchCreateInput = { totalQuests: 30 };
      const result = await createBatch(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(redis.set).toHaveBeenCalledWith(
        `batch:${result.data?.id}`,
        expect.objectContaining({
          id: expect.any(String),
          questCount: 30,
          quests: expect.any(Array),
          createdAt: expect.any(String),
        })
      );
    });

    it('should handle Redis errors', async () => {
      (redis.set as any).mockRejectedValue(new Error('Redis connection failed'));

      const input: BatchCreateInput = { totalQuests: 30 };
      const result = await createBatch(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create batch');
      expect(result.code).toBe('ERR_SIGNAL_LOST');
    });
  });

  describe('getAllBatches', () => {
    it('should retrieve all batches successfully', async () => {
      const mockBatches = [
        {
          id: 'batch-1',
          questCount: 30,
          quests: [],
          createdAt: '2026-02-15T10:00:00.000Z',
        },
        {
          id: 'batch-2',
          questCount: 25,
          quests: [],
          createdAt: '2026-02-15T11:00:00.000Z',
        },
      ];

      (redis.keys as any).mockResolvedValue(['batch:batch-1', 'batch:batch-2']);
      (redis.get as any)
        .mockResolvedValueOnce(mockBatches[0])
        .mockResolvedValueOnce(mockBatches[1]);

      const result = await getAllBatches();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      // Note: batches are sorted by creation date (newest first)
      expect(result.data?.[0].id).toBe('batch-2'); // newer
      expect(result.data?.[1].id).toBe('batch-1'); // older
    });

    it('should handle empty batch list', async () => {
      (redis.keys as any).mockResolvedValue([]);

      const result = await getAllBatches();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle Redis errors', async () => {
      (redis.keys as any).mockRejectedValue(new Error('Redis connection failed'));

      const result = await getAllBatches();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to retrieve batches');
      expect(result.code).toBe('ERR_SIGNAL_LOST');
    });
  });

  describe('deleteBatch', () => {
    it('should delete a batch successfully', async () => {
      const mockBatch = {
        id: 'batch-123',
        questCount: 30,
        quests: [],
        createdAt: '2026-02-15T10:00:00.000Z',
      };
      
      (redis.get as any).mockResolvedValue(mockBatch);
      (redis.keys as any).mockResolvedValue([]); // No active games
      (redis.del as any).mockResolvedValue(1);

      const result = await deleteBatch('batch-123');

      expect(result.success).toBe(true);
      expect(redis.keys).toHaveBeenCalledWith('game:*');
      expect(redis.get).toHaveBeenCalledWith('batch:batch-123');
      expect(redis.del).toHaveBeenCalledWith('batch:batch-123');
    });

    it('should fail if batch is in use by a game', async () => {
      const mockBatch = { id: 'batch-123' };
      const mockGame = { batchId: 'batch-123' };
      
      (redis.get as any)
        .mockResolvedValueOnce(mockBatch) // first call for batch check
        .mockResolvedValueOnce(mockGame);  // second call for game check
      (redis.keys as any).mockResolvedValue(['game:123']);

      const result = await deleteBatch('batch-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Batch is in use by an active game');
    });

    it('should handle non-existent batch', async () => {
      (redis.get as any).mockResolvedValue(null);

      const result = await deleteBatch('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Batch not found');
      expect(result.code).toBe('ERR_NOT_FOUND');
    });

    it('should handle Redis errors', async () => {
      (redis.get as any).mockRejectedValue(new Error('Redis connection failed'));

      const result = await deleteBatch('batch-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to delete batch');
      expect(result.code).toBe('ERR_SIGNAL_LOST');
    });
  });
});
