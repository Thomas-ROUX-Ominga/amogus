import { Batch, BatchCreateInput, Quest, QuestDuration, QuestType } from '@/types/quest';

// Extension registry - available quest types in the system
const AVAILABLE_QUEST_TYPES: QuestType[] = ['true-false', 'qcm', 'form', 'single-input'];

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
  
  const distribution = distributeQuests(totalQuests);
  const quests: Quest[] = [];
  
  // Generate quests for each duration
  for (let i = 0; i < distribution.short; i++) {
    quests.push(createQuest('short'));
  }
  
  for (let i = 0; i < distribution.medium; i++) {
    quests.push(createQuest('medium'));
  }
  
  for (let i = 0; i < distribution.long; i++) {
    quests.push(createQuest('long'));
  }
  
  // Shuffle quests to mix durations
  for (let i = quests.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [quests[i], quests[j]] = [quests[j], quests[i]];
  }
  
  return {
    id: globalThis.crypto.randomUUID(),
    questCount: totalQuests,
    quests,
    createdAt: new Date().toISOString(),
  };
}
