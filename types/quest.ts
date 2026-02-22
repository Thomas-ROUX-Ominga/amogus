export type QuestType = "true-false" | "qcm" | "form" | "single-input" | "number-input";

export type QuestDuration = "short" | "medium" | "long";

// Quest metadata assigned to players
export interface Quest {
    id: string;
    type: QuestType;
    duration: QuestDuration;
    location?: string;
}

// QuestGame - actual game content with questions and answers
export interface QuestOption {
    label: string;
    value: string;
}

export interface QuestGame {
    id: string;
    type: QuestType;
    duration: QuestDuration;
    title: string;
    instruction: string;
    options?: QuestOption[];
    answer?: string;
    // Add other fields as needed for different game types
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

// Story 8.2: Dynamic Content Mapper types
export interface PlayerState {
    // This would be extended from existing player state in game.ts
    // Adding failed quest tracking capability
    failedQuests?: {
        [questId: string]: string[]; // Array of content IDs that were failed
    };
}

export interface QuestContentResult {
    content: QuestGame;
    contentId: string;
    isRotation: boolean; // true if this is a rotation due to previous failure
}
