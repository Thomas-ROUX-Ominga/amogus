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
