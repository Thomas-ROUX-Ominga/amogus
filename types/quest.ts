export type QuestType = "true-false" | "qcm" | "form" | "single-input";

export type QuestDuration = "short" | "medium" | "long";

export interface Quest {
    id: string;
    type: QuestType;
    duration: QuestDuration;
    title: string;
    instruction: string;
}

export interface QuestPool {
    short: Quest[];
    medium: Quest[];
    long: Quest[];
}
