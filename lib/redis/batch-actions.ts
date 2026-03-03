"use server";

import { redis } from "./client";
import { ActionResponse } from "@/types/game";
import { Batch, BatchCreateInput, BatchListItem } from "@/types/quest";
import { generateBatch } from "@/lib/quests/batch-generator";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { verifyAdminSession } from "@/lib/redis/auth-utils";

export async function createBatch(input: BatchCreateInput): Promise<ActionResponse<Batch>> {
  try {
    // Verify admin session
    const session = await verifyAdminSession();
    if (!session.success) {
      return {
        success: false,
        error: "Unauthorized",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      };
    }

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
    // Verify admin session
    const session = await verifyAdminSession();
    if (!session.success) {
      return {
        success: false,
        error: "Unauthorized",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      };
    }

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

import { deleteGame } from "./actions";

export async function deleteBatch(batchId: string): Promise<ActionResponse<void>> {
  try {
    // Verify admin session
    const session = await verifyAdminSession();
    if (!session.success) {
      return {
        success: false,
        error: "Unauthorized",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      };
    }

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

    // Stop and delete any active games using this batch
    const gameKeys = await redis.keys("game:*:state");
    for (const key of gameKeys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const game = await redis.get<any>(key);
      if (game?.batchId === batchId) {
        // Extract gameId from key (game:ID:state)
        const gameId = key.split(":")[1];
        if (gameId) {
            await deleteGame(gameId);
        }
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

export async function getBatchData(batchId: string): Promise<ActionResponse<Batch>> {
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
    console.error("Error getting batch data:", error);
    return {
      success: false,
      error: "Failed to get batch data",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function getBatch(batchId: string): Promise<ActionResponse<Batch>> {
  try {
    // Verify admin session for public action
    const session = await verifyAdminSession();
    if (!session.success) {
      return {
        success: false,
        error: "Unauthorized",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      };
    }

    return getBatchData(batchId);
  } catch (error) {
    console.error("Error in getBatch action:", error);
    return {
      success: false,
      error: "Failed to get batch",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function updateQuestsLocations(
  batchId: string,
  locations: Record<string, string>
): Promise<ActionResponse<Batch>> {
  try {
    // Verify admin session
    const session = await verifyAdminSession();
    if (!session.success) {
      return {
        success: false,
        error: "Unauthorized",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      };
    }

    // Validate input
    if (!batchId?.trim()) {
      return {
        success: false,
        error: "Batch ID is required",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    if (!locations || typeof locations !== 'object') {
      return {
        success: false,
        error: "Valid locations object is required",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    const batchKey = `batch:${batchId}`;
    
    // Get existing batch
    const batch = await redis.get<Batch>(batchKey);
    
    if (!batch) {
      return {
        success: false,
        error: "Batch not found",
        code: ERROR_CODES.ERR_NOT_FOUND,
      };
    }

    // Update quest locations atomically
    const updatedQuests = batch.quests.map(quest => ({
      ...quest,
      location: locations[quest.id] || quest.location,
    }));

    const updatedBatch: Batch = {
      ...batch,
      quests: updatedQuests,
    };

    // Save updated batch
    await redis.set(batchKey, updatedBatch);

    return {
      success: true,
      data: updatedBatch,
    };
  } catch (error) {
    console.error("Error updating quest locations:", error);
    return {
      success: false,
      error: "Failed to update quest locations",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

