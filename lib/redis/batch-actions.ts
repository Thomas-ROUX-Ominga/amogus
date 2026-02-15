"use server";

import { redis } from "./client";
import { ActionResponse } from "@/types/game";
import { Batch, BatchCreateInput, BatchListItem } from "@/types/quest";
import { generateBatch } from "@/lib/quests/batch-generator";
import { ERROR_CODES } from "@/lib/constants/error-codes";

export async function createBatch(input: BatchCreateInput): Promise<ActionResponse<Batch>> {
  try {
    // Validate input
    if (!input?.totalQuests || typeof input.totalQuests !== 'number') {
      return {
        success: false,
        error: "Valid quest count is required",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    if (input.totalQuests < 3 || input.totalQuests > 100) {
      return {
        success: false,
        error: "Total quests must be between 3 and 100",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    // Generate batch
    const batch = generateBatch(input);
    
    // Store in Redis
    const batchKey = `batch:${batch.id}`;
    await redis.set(batchKey, batch);

    return {
      success: true,
      data: batch,
    };
  } catch (error) {
    console.error("Error creating batch:", error);
    return {
      success: false,
      error: "Failed to create batch",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function getAllBatches(): Promise<ActionResponse<BatchListItem[]>> {
  try {
    // Get all batch keys
    const batchKeys = await redis.keys("batch:*");
    
    if (!batchKeys || batchKeys.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // Retrieve all batches
    const batchPromises = batchKeys.map(async (key: string) => {
      const batch = await redis.get<Batch>(key);
      return batch;
    });

    const batches = await Promise.all(batchPromises);
    
    // Filter out null results and convert to list items
    const batchListItems: BatchListItem[] = batches
      .filter((batch): batch is Batch => batch !== null)
      .map((batch: Batch) => ({
        id: batch.id,
        questCount: batch.questCount,
        createdAt: batch.createdAt,
      }))
      .sort((a: BatchListItem, b: BatchListItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      success: true,
      data: batchListItems,
    };
  } catch (error) {
    console.error("Error retrieving batches:", error);
    return {
      success: false,
      error: "Failed to retrieve batches",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function deleteBatch(batchId: string): Promise<ActionResponse<void>> {
  try {
    // Validate input
    if (!batchId?.trim()) {
      return {
        success: false,
        error: "Batch ID is required",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    const batchKey = `batch:${batchId}`;
    
    // Check if batch exists
    const batch = await redis.get<Batch>(batchKey);
    if (!batch) {
      return {
        success: false,
        error: "Batch not found",
        code: ERROR_CODES.ERR_NOT_FOUND,
      };
    }

    // Check if batch is referenced by any active games
    const gameKeys = await redis.keys("game:*");
    for (const key of gameKeys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const game = await redis.get<any>(key);
      if (game?.batchId === batchId) {
        return {
          success: false,
          error: "Batch is in use by an active game",
          code: ERROR_CODES.ERR_INVALID_STATE,
        };
      }
    }

    // Delete the batch
    const result = await redis.del(batchKey);
    
    if (result === 0) {
      return {
        success: false,
        error: "Batch not found",
        code: ERROR_CODES.ERR_NOT_FOUND,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting batch:", error);
    return {
      success: false,
      error: "Failed to delete batch",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function getBatch(batchId: string): Promise<ActionResponse<Batch>> {
  try {
    if (!batchId?.trim()) {
      return {
        success: false,
        error: "Batch ID is required",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    const batchKey = `batch:${batchId}`;
    const batch = await redis.get<Batch>(batchKey);
    
    if (!batch) {
      return {
        success: false,
        error: "Batch not found",
        code: ERROR_CODES.ERR_NOT_FOUND,
      };
    }

    return {
      success: true,
      data: batch,
    };
  } catch (error) {
    console.error("Error getting batch:", error);
    return {
      success: false,
      error: "Failed to get batch",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}
