"use server";

import { redis } from "./client";
import { ActionResponse } from "@/types/game";
import { Batch, BatchCreateInput, BatchListItem, BatchSabotages } from "@/types/quest";
import { generateBatch } from "@/lib/quests/batch-generator";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { verifySession } from "@/lib/redis/auth-utils";
import { getGameStatePattern, parseGameIdFromStateKey } from "@/lib/redis/game-state-keys";
import { deleteGame } from "./actions";

interface GetBatchDataOptions {
  ownerId?: string;
}

export async function createBatch(input: BatchCreateInput): Promise<ActionResponse<Batch>> {
  try {
    const session = await verifySession();
    if (!session.success || !session.data) {
      return {
        success: false,
        error: "Unauthorized",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      };
    }

    // Validate input
    if (typeof input?.totalQuests !== 'number' || Number.isNaN(input.totalQuests)) {
      return {
        success: false,
        error: "Valid quest count is required",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    if (!Number.isInteger(input.totalQuests) || input.totalQuests < 1) {
      return {
        success: false,
        error: "Total quests must be at least 1",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    // Generate batch
    const generatedBatch = generateBatch(input);
    const batch: Batch = {
      ...generatedBatch,
      ownerId: session.data.userId,
    };
    
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
    const session = await verifySession();
    if (!session.success || !session.data) {
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

    const ownerId = session.data.userId;

    // Retrieve all batches
    const batchPromises = batchKeys.map(async (key: string) => {
      const batch = await redis.get<Batch>(key);
      return batch;
    });

    const batches = await Promise.all(batchPromises);
    
    // Filter out null results and convert to list items
    const batchListItems: BatchListItem[] = batches
      .filter((batch): batch is Batch => batch !== null && batch.ownerId === ownerId)
      .map((batch: Batch) => ({
        id: batch.id,
        name: batch.name,
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
    const session = await verifySession();
    if (!session.success || !session.data) {
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

    const batchResponse = await getBatchData(batchId, { ownerId: session.data.userId });
    if (!batchResponse.success || !batchResponse.data) {
      if (batchResponse.code === ERROR_CODES.ERR_NOT_FOUND) {
        return {
          success: false,
          error: "Batch not found",
          code: ERROR_CODES.ERR_NOT_FOUND,
        };
      }
      return {
        success: false,
        error: "Failed to delete batch",
        code: batchResponse.code || ERROR_CODES.ERR_SIGNAL_LOST,
      };
    }
    const batchKey = `batch:${batchId}`;

    // Stop and delete any active games using this batch
    const gameKeys = await redis.keys(getGameStatePattern());
    for (const key of gameKeys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const game = await redis.get<any>(key);
      if (game?.batchId === batchId) {
        // Extract gameId from key (game:v2:ID:state)
        const gameId = parseGameIdFromStateKey(key);
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

export async function getBatchData(
  batchId: string,
  options?: GetBatchDataOptions
): Promise<ActionResponse<Batch>> {
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

    if (options?.ownerId && batch.ownerId !== options.ownerId) {
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
    const session = await verifySession();
    if (!session.success || !session.data) {
      return {
        success: false,
        error: "Unauthorized",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      };
    }

    const batchResponse = await getBatchData(batchId, { ownerId: session.data.userId });
    if (!batchResponse.success) {
      if (batchResponse.code === ERROR_CODES.ERR_NOT_FOUND) {
        return batchResponse;
      }
      return {
        success: false,
        error: "Failed to get batch",
        code: batchResponse.code || ERROR_CODES.ERR_SIGNAL_LOST,
      };
    }

    return batchResponse;
  } catch (error) {
    console.error("Error in getBatch action:", error);
    return {
      success: false,
      error: "Failed to get batch",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function updateBatchName(batchId: string, name: string): Promise<ActionResponse<Batch>> {
  try {
    const session = await verifySession();
    if (!session.success || !session.data) {
      return {
        success: false,
        error: "Unauthorized",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      };
    }

    if (!batchId?.trim()) {
      return {
        success: false,
        error: "Batch ID is required",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    const normalizedName = name?.trim();
    if (!normalizedName) {
      return {
        success: false,
        error: "Batch name is required",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    if (normalizedName.length > 60) {
      return {
        success: false,
        error: "Batch name is too long",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    const batchResponse = await getBatchData(batchId, { ownerId: session.data.userId });
    if (!batchResponse.success || !batchResponse.data) {
      if (batchResponse.code === ERROR_CODES.ERR_NOT_FOUND) {
        return {
          success: false,
          error: "Batch not found",
          code: ERROR_CODES.ERR_NOT_FOUND,
        };
      }
      return {
        success: false,
        error: "Failed to update batch name",
        code: batchResponse.code || ERROR_CODES.ERR_SIGNAL_LOST,
      };
    }
    const batch = batchResponse.data;
    const batchKey = `batch:${batchId}`;

    const updatedBatch: Batch = {
      ...batch,
      name: normalizedName,
    };

    await redis.set(batchKey, updatedBatch);

    return {
      success: true,
      data: updatedBatch,
    };
  } catch (error) {
    console.error("Error updating batch name:", error);
    return {
      success: false,
      error: "Failed to update batch name",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function updateQuestsLocations(
  batchId: string,
  locations: Record<string, string>,
  sabotageLocations?: {
    communications?: string;
    lights?: string;
    reactorA?: string;
    reactorB?: string;
  }
): Promise<ActionResponse<Batch>> {
  try {
    const session = await verifySession();
    if (!session.success || !session.data) {
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

    const batchResponse = await getBatchData(batchId, { ownerId: session.data.userId });
    if (!batchResponse.success || !batchResponse.data) {
      if (batchResponse.code === ERROR_CODES.ERR_NOT_FOUND) {
        return {
          success: false,
          error: "Batch not found",
          code: ERROR_CODES.ERR_NOT_FOUND,
        };
      }
      return {
        success: false,
        error: "Failed to update quest locations",
        code: batchResponse.code || ERROR_CODES.ERR_SIGNAL_LOST,
      };
    }
    const batch = batchResponse.data;
    const batchKey = `batch:${batchId}`;

    // Update quest locations atomically
    const updatedQuests = batch.quests.map(quest => ({
      ...quest,
      location: locations[quest.id] || quest.location,
    }));

    const updatedBatch: Batch = {
      ...batch,
      quests: updatedQuests,
      sabotages: batch.sabotages
        ? {
            communications: {
              ...batch.sabotages.communications,
              location: sabotageLocations?.communications ?? batch.sabotages.communications.location,
            },
            lights: {
              qrId:
                (batch.sabotages as Partial<BatchSabotages>).lights?.qrId ||
                globalThis.crypto.randomUUID(),
              location:
                sabotageLocations?.lights ??
                (batch.sabotages as Partial<BatchSabotages>).lights?.location ??
                "",
            },
            reactor: [
              {
                ...batch.sabotages.reactor[0],
                location: sabotageLocations?.reactorA ?? batch.sabotages.reactor[0].location,
              },
              {
                ...batch.sabotages.reactor[1],
                location: sabotageLocations?.reactorB ?? batch.sabotages.reactor[1].location,
              },
            ],
          }
        : undefined,
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
