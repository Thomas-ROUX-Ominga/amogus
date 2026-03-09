import { Batch, BatchCreateInput, BatchSabotages, Quest, QuestDuration, QuestType } from '@/types/quest';

// Classic quest types — mini-game is never randomly assigned here
const AVAILABLE_QUEST_TYPES: QuestType[] = ['true-false', 'qcm', 'single-input', 'number-input', 'intrus'];

function getRandomQuestType(): QuestType {
  const randomIndex = Math.floor(Math.random() * AVAILABLE_QUEST_TYPES.length);
  return AVAILABLE_QUEST_TYPES[randomIndex];
}

function distributeQuests(totalCount: number): { short: number; medium: number; long: number } {
  const baseCount = Math.floor(totalCount / 3);
  const remainder = totalCount % 3;

  return {
    short: baseCount + (remainder > 0 ? 1 : 0),
    medium: baseCount + (remainder > 1 ? 1 : 0),
    long: baseCount,
  };
}

function createQuest(duration: QuestDuration): Quest {
  const type = getRandomQuestType();

  return {
    id: globalThis.crypto.randomUUID(),
    type,
    duration,
  };
}

export function generateBatch(input: BatchCreateInput): Batch {
  const { totalQuests } = input;

  // Validate input
  if (totalQuests < 3 || totalQuests > 100) {
    throw new Error('Total quests must be between 3 and 100');
  }

  // Reserve 3 slots for mini-games (one for each duration), distribute the rest as classic quests
  const miniGameDurations: QuestDuration[] = ['short', 'medium', 'long'];
  const classicCount = totalQuests - miniGameDurations.length;
  
  if (classicCount < 0) {
    throw new Error('Total quests must be at least 3 to include all mini-game durations');
  }

  const distribution = distributeQuests(classicCount);
  const quests: Quest[] = [];

  // Generate classic quests for each duration
  for (let i = 0; i < distribution.short; i++) {
    quests.push(createQuest('short'));
  }
  for (let i = 0; i < distribution.medium; i++) {
    quests.push(createQuest('medium'));
  }
  for (let i = 0; i < distribution.long; i++) {
    quests.push(createQuest('long'));
  }

  // Shuffle classic quests
  for (let i = quests.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [quests[i], quests[j]] = [quests[j], quests[i]];
  }

  // Insert one mini-game for each duration at random positions
  miniGameDurations.forEach(duration => {
    const miniGame = {
      id: globalThis.crypto.randomUUID(),
      type: 'mini-game' as QuestType,
      duration,
    };
    const insertAt = Math.floor(Math.random() * (quests.length + 1));
    quests.splice(insertAt, 0, miniGame);
  });

  const sabotages: BatchSabotages = {
    communications: {
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
    questCount: totalQuests,
    quests,
    sabotages,
    createdAt: new Date().toISOString(),
  };
}
