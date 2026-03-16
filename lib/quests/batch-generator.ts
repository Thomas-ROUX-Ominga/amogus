import { Batch, BatchCreateInput, BatchSabotages, Quest, QuestDuration, QuestType } from '@/types/quest';

// Classic quest types — deterministic rotation for maximum fairness.
const AVAILABLE_QUEST_TYPES: QuestType[] = ['true-false', 'qcm', 'single-input', 'number-input', 'intrus'];
const DURATIONS: QuestDuration[] = ['short', 'medium', 'long'];

function distributeQuests(totalCount: number): { short: number; medium: number; long: number } {
  const baseCount = Math.floor(totalCount / 3);
  const remainder = totalCount % 3;

  return {
    short: baseCount + (remainder > 0 ? 1 : 0),
    medium: baseCount + (remainder > 1 ? 1 : 0),
    long: baseCount,
  };
}

function createQuest(duration: QuestDuration, type: QuestType): Quest {
  return {
    id: globalThis.crypto.randomUUID(),
    type,
    duration,
  };
}

export function generateBatch(input: BatchCreateInput): Batch {
  const { totalQuests, name } = input;

  // Validate input
  if (!Number.isInteger(totalQuests) || totalQuests < 1) {
    throw new Error('Total quests must be at least 1');
  }

  // Deterministic duration split: short, medium, long.
  const distribution = distributeQuests(totalQuests);
  const quests: Quest[] = [];

  DURATIONS.forEach((duration) => {
    const totalForDuration = distribution[duration];
    const miniGameCount = Math.floor(totalForDuration / 3);
    const classicCount = totalForDuration - miniGameCount;

    // First, add mini-games (1/3 target by duration, rounded down).
    for (let i = 0; i < miniGameCount; i++) {
      quests.push(createQuest(duration, 'mini-game'));
    }

    // Then add classic quests with deterministic type rotation for equitable spread.
    for (let i = 0; i < classicCount; i++) {
      const classicType = AVAILABLE_QUEST_TYPES[i % AVAILABLE_QUEST_TYPES.length];
      quests.push(createQuest(duration, classicType));
    }
  });

  const sabotages: BatchSabotages = {
    communications: {
      qrId: globalThis.crypto.randomUUID(),
      location: "",
    },
    lights: {
      qrId: globalThis.crypto.randomUUID(),
      location: "",
    },
    reactor: [
      { qrId: globalThis.crypto.randomUUID(), location: "" },
      { qrId: globalThis.crypto.randomUUID(), location: "" },
    ],
  };


  return {
    id: globalThis.crypto.randomUUID(),
    name: name?.trim() || undefined,
    questCount: totalQuests,
    quests,
    sabotages,
    createdAt: new Date().toISOString(),
  };
}
