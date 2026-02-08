import { Quest, QuestDuration, QuestPool } from "@/types/quest";
import questData from "./quests.json";

const questPool: QuestPool = questData as QuestPool;

export function getQuestsByDuration(duration: QuestDuration): Quest[] {
    return questPool[duration] ?? [];
}

export function getRandomQuest(duration: QuestDuration): Quest | null {
    const quests = getQuestsByDuration(duration);
    if (quests.length === 0) return null;
    const index = Math.floor(Math.random() * quests.length);
    return quests[index];
}

export function isValidDuration(value: string | null): value is QuestDuration {
    return value === "short" || value === "medium" || value === "long";
}
