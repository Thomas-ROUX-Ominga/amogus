export type QuestType = "true-false" | "qcm" | "form" | "single-input";

export type QuestDuration = "short" | "medium" | "long";

export interface QuestOption {
    label: string;
    value: string;
}

export interface Quest {
    id: string;
    type: QuestType;
    duration: QuestDuration;
    title: string;
    instruction: string;
    options?: QuestOption[];
    answer?: string;
}

export interface QuestPool {
    short: Quest[];
    medium: Quest[];
    long: Quest[];
}

// Batch types for Story 6.2
export interface Batch {
    id: string;
    questCount: number;
    quests: Quest[];
    createdAt: string;
}

export interface BatchCreateInput {
    totalQuests: number;
}

export interface BatchListItem {
    id: string;
    questCount: number;
    createdAt: string;
}
