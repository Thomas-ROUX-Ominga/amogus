export type { CreateGameInput } from "./game/lifecycle";
export {
    createGame,
    getGame,
    startGame,
    joinGame,
    refreshGame,
    getGameSnapshot,
    eliminatePlayer,
    deleteGame,
} from "./game/lifecycle";

export {
    completeQuest,
    getQuestMetadata,
    getPlayerFailedQuests,
    addFailedQuest,
    getGameQuests,
} from "./game/quests";

export type { TriggerSabotageResult, ScanSabotageResult } from "./game/sabotage";
export {
    triggerSabotage,
    scanSabotage,
    selectRole,
} from "./game/sabotage";

export {
    getMeetingView,
    triggerMeeting,
    castMeetingVote,
    cancelMeetingVote,
} from "./game/meetings";
