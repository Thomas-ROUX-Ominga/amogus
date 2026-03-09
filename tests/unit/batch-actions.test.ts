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

// Mock auth utils
vi.mock('@/lib/redis/auth-utils', () => ({
  verifyAdminSession: vi.fn(),
  verifySession: vi.fn(),
}));

import { createBatch, getAllBatches, deleteBatch, updateQuestsLocations, getBatch, getBatchData } from '@/lib/redis/batch-actions';
import { BatchCreateInput } from '@/types/quest';
import { redis } from '@/lib/redis/client';
import { verifyAdminSession, verifySession } from '@/lib/redis/auth-utils';

describe('Batch Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset implementations to prevent state leaks
    vi.resetAllMocks();
    // Default to authorized
    (verifyAdminSession as any).mockResolvedValue({ success: true, data: { role: 'admin' } });
    (verifySession as any).mockResolvedValue({ 
      success: true, 
      data: { userId: 'admin-id', username: 'admin' } 
    });
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
    it('should delete a batch and its associated games successfully', async () => {
      const mockBatch = {
        id: 'batch-123',
        questCount: 30,
        quests: [],
        createdAt: '2026-02-15T10:00:00.000Z',
      };
      
      const mockGame = { batchId: 'batch-123' };
      
      // Order of Redis calls in deleteBatch:
      // 1. redis.get(batchKey)
      // 2. redis.keys("game:*:state")
      // 3. redis.get(gameKey) for each found key
      // 4. deleteGame(gameId) is called:
      //    a. verifySession()
      //    b. redis.keys(`game:${gameId}:*`)
      //    c. redis.del(key) for each associated key
      // 5. redis.del(batchKey)

      (redis.get as any)
        .mockResolvedValueOnce(mockBatch) // get batch
        .mockResolvedValueOnce(mockGame);  // get game for key game:GAME1:state
      
      (redis.keys as any)
        .mockResolvedValueOnce(['game:GAME1:state']) // gameKeys search in deleteBatch
        .mockResolvedValueOnce(['game:GAME1:state', 'game:GAME1:player:p1:failed-quests']); // gameKeys search in deleteGame
      
      (redis.del as any).mockResolvedValue(1);

      const result = await deleteBatch('batch-123');

      expect(result.success).toBe(true);
      expect(redis.get).toHaveBeenCalledWith('batch:batch-123');
      expect(redis.keys).toHaveBeenCalledWith('game:*:state');
      expect(redis.keys).toHaveBeenCalledWith('game:GAME1:*');
      expect(redis.del).toHaveBeenCalledWith('batch:batch-123');
      expect(redis.del).toHaveBeenCalledWith('game:GAME1:state');
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

  describe('updateQuestsLocations', () => {
    it('should update quest locations successfully', async () => {
      const mockBatch = {
        id: 'batch-123',
        questCount: 2,
        quests: [
          { id: 'quest-1', type: 'qcm', duration: 'short', location: 'Zone A' },
          { id: 'quest-2', type: 'qcm', duration: 'medium', location: 'Zone B' },
        ],
        createdAt: '2026-02-15T10:00:00.000Z',
      };

      const locations = {
        'quest-1': 'Machine à café',
        'quest-2': 'Salle de réunion',
      };

      (redis.get as any).mockResolvedValue(mockBatch);
      (redis.set as any).mockResolvedValue('OK');

      const result = await updateQuestsLocations('batch-123', locations);

      expect(result.success).toBe(true);
      expect(result.data?.quests[0].location).toBe('Machine à café');
      expect(result.data?.quests[1].location).toBe('Salle de réunion');
      expect(redis.set).toHaveBeenCalledWith(
        'batch:batch-123',
        expect.objectContaining({
          quests: expect.arrayContaining([
            expect.objectContaining({ id: 'quest-1', location: 'Machine à café' }),
            expect.objectContaining({ id: 'quest-2', location: 'Salle de réunion' }),
          ]),
        })
      );
    });

    it('should preserve existing locations when not updated', async () => {
      const mockBatch = {
        id: 'batch-123',
        questCount: 2,
        quests: [
          { id: 'quest-1', type: 'qcm', duration: 'short', location: 'Old Location' },
          { id: 'quest-2', type: 'qcm', duration: 'medium', location: 'Zone B' },
        ],
        createdAt: '2026-02-15T10:00:00.000Z',
      };

      const locations = {
        'quest-2': 'New Location',
      };

      (redis.get as any).mockResolvedValue(mockBatch);
      (redis.set as any).mockResolvedValue('OK');

      const result = await updateQuestsLocations('batch-123', locations);

      expect(result.success).toBe(true);
      expect(result.data?.quests[0].location).toBe('Old Location');
      expect(result.data?.quests[1].location).toBe('New Location');
    });

    it('should update sabotage locations when batch has sabotage config', async () => {
      const mockBatch = {
        id: 'batch-123',
        questCount: 2,
        quests: [
          { id: 'quest-1', type: 'qcm', duration: 'short', location: 'Zone A' },
        ],
        sabotages: {
          communications: { qrId: 'comms-1', location: 'Old Comms' },
          reactor: [
            { qrId: 'reactor-a', location: 'Old A' },
            { qrId: 'reactor-b', location: 'Old B' },
          ],
        },
        createdAt: '2026-02-15T10:00:00.000Z',
      };

      (redis.get as any).mockResolvedValue(mockBatch);
      (redis.set as any).mockResolvedValue('OK');

      const result = await updateQuestsLocations(
        'batch-123',
        { 'quest-1': 'Zone X' },
        {
          communications: 'Salon',
          reactorA: 'Garage',
          reactorB: 'Cuisine',
        },
      );

      expect(result.success).toBe(true);
      expect(result.data?.sabotages?.communications.location).toBe('Salon');
      expect(result.data?.sabotages?.reactor[0].location).toBe('Garage');
      expect(result.data?.sabotages?.reactor[1].location).toBe('Cuisine');
    });

    it('should fail with invalid batch ID', async () => {
      const result = await updateQuestsLocations('', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Batch ID is required');
      expect(result.code).toBe('ERR_INVALID_INPUT');
    });

    it('should fail with invalid locations object', async () => {
      const result = await updateQuestsLocations('batch-123', null as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Valid locations object is required');
      expect(result.code).toBe('ERR_INVALID_INPUT');
    });

    it('should fail when batch not found', async () => {
      (redis.get as any).mockResolvedValue(null);

      const result = await updateQuestsLocations('non-existent', { 'quest-1': 'Location' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Batch not found');
      expect(result.code).toBe('ERR_NOT_FOUND');
    });

    it('should handle Redis errors', async () => {
      (redis.get as any).mockRejectedValue(new Error('Redis connection failed'));

      const result = await updateQuestsLocations('batch-123', { 'quest-1': 'Location' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update quest locations');
      expect(result.code).toBe('ERR_SIGNAL_LOST');
    });
  });

  describe('getBatchData', () => {
    it('should retrieve batch data successfully without session check', async () => {
      const mockBatch = { id: 'batch-123', questCount: 30 };
      (redis.get as any).mockResolvedValue(mockBatch);

      const result = await getBatchData('batch-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBatch);
      expect(redis.get).toHaveBeenCalledWith('batch:batch-123');
      // Should NOT have called verifyAdminSession
      expect(verifyAdminSession).not.toHaveBeenCalled();
    });

    it('should fail with invalid batch ID', async () => {
      const result = await getBatchData('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Batch ID is required');
    });

    it('should handle non-existent batch', async () => {
      (redis.get as any).mockResolvedValue(null);

      const result = await getBatchData('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Batch not found');
    });
  });

  describe('getBatch', () => {
    it('should retrieve batch successfully after session verification', async () => {
      const mockBatch = { id: 'batch-123', questCount: 30 };
      (redis.get as any).mockResolvedValue(mockBatch);
      (verifyAdminSession as any).mockResolvedValue({ success: true, data: { role: 'admin' } });

      const result = await getBatch('batch-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBatch);
      expect(verifyAdminSession).toHaveBeenCalled();
    });

    it('should fail if session verification fails', async () => {
      (verifyAdminSession as any).mockResolvedValue({ success: false, error: 'Unauthorized' });

      const result = await getBatch('batch-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(redis.get).not.toHaveBeenCalled();
    });
  });
});
