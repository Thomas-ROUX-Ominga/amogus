export type QuestType = "true-false" | "qcm" | "single-input" | "number-input" | "intrus" | "mini-game";

export type QuestDuration = "short" | "medium" | "long";

// Quest metadata assigned to players
export interface Quest {
    id: string;
    type: QuestType;
    duration: QuestDuration;
    location?: string;
}

// QuestGame - actual game content with questions and answers
export interface Choice {
    id: string;
    label: string;
}

export interface QuestGameBase {
    id: string;
    duration: QuestDuration;
    title: string;
    instruction: string;
}

export type QuestGame = 
    | (QuestGameBase & { type: "true-false"; data: { choices: Choice[]; answerIds: string[] } })
    | (QuestGameBase & { type: "qcm"; data: { mode: "single" | "multiple"; choices: Choice[]; answerIds: string[] } })
    | (QuestGameBase & { type: "single-input"; data: { placeholder: string; validation: { trim: boolean; case: string }; answer: string } })
    | (QuestGameBase & { type: "number-input"; data: { placeholder: string; validation: { kind: string; min: number; max: number }; answer: number } })
    | (QuestGameBase & { type: "intrus"; data: { choices: Choice[]; answerIds: string[] } })
    | (QuestGameBase & { type: "mini-game"; data: any });

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
