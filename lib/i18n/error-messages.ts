import { ERROR_CODES } from "@/lib/constants/error-codes";

const ERROR_CODE_TO_MESSAGE_KEY: Partial<Record<string, string>> = {
  [ERROR_CODES.GAME_NOT_FOUND]: "errors.codes.GAME_NOT_FOUND",
  [ERROR_CODES.ERR_SIGNAL_LOST]: "errors.codes.ERR_SIGNAL_LOST",
  [ERROR_CODES.ERR_FULL_CAPACITY]: "errors.codes.ERR_FULL_CAPACITY",
  [ERROR_CODES.ERR_INVALID_ALIAS]: "errors.codes.ERR_INVALID_ALIAS",
  [ERROR_CODES.ERR_INVALID_SIGNATURE]: "errors.codes.ERR_INVALID_SIGNATURE",
  [ERROR_CODES.ERR_INVALID_STATE]: "errors.codes.ERR_INVALID_STATE",
  [ERROR_CODES.ERR_NO_PLAYERS]: "errors.codes.ERR_NO_PLAYERS",
  [ERROR_CODES.ERR_INVALID_ROLE]: "errors.codes.ERR_INVALID_ROLE",
  [ERROR_CODES.ERR_INVALID_DURATION]: "errors.codes.ERR_INVALID_DURATION",
  [ERROR_CODES.ERR_NO_QUESTS]: "errors.codes.ERR_NO_QUESTS",
  [ERROR_CODES.ERR_QUEST_LOAD_FAILED]: "errors.codes.ERR_QUEST_LOAD_FAILED",
  [ERROR_CODES.ERR_QUEST_COMPLETE_FAILED]: "errors.codes.ERR_QUEST_COMPLETE_FAILED",
  [ERROR_CODES.ERR_QUEST_NOT_ASSIGNED]: "errors.codes.ERR_QUEST_NOT_ASSIGNED",
  [ERROR_CODES.ERR_INVALID_INPUT]: "errors.codes.ERR_INVALID_INPUT",
  [ERROR_CODES.ERR_SERVER_CONFIG]: "errors.codes.ERR_SERVER_CONFIG",
  [ERROR_CODES.ERR_INVALID_CREDENTIALS]: "errors.codes.ERR_INVALID_CREDENTIALS",
  [ERROR_CODES.ERR_NO_SESSION]: "errors.codes.ERR_NO_SESSION",
  [ERROR_CODES.ERR_INVALID_SESSION]: "errors.codes.ERR_INVALID_SESSION",
  [ERROR_CODES.ERR_NOT_FOUND]: "errors.codes.ERR_NOT_FOUND",
  [ERROR_CODES.ERR_UNAUTHORIZED]: "errors.codes.ERR_UNAUTHORIZED",
  [ERROR_CODES.ERR_MEETING_ACTIVE]: "errors.codes.ERR_MEETING_ACTIVE",
  [ERROR_CODES.ERR_MEETING_NOT_ACTIVE]: "errors.codes.ERR_MEETING_NOT_ACTIVE",
  [ERROR_CODES.ERR_MEETING_ALREADY_USED]: "errors.codes.ERR_MEETING_ALREADY_USED",
  [ERROR_CODES.ERR_MEETING_VOTE_INVALID]: "errors.codes.ERR_MEETING_VOTE_INVALID",
  [ERROR_CODES.ERR_MEETING_FORBIDDEN]: "errors.codes.ERR_MEETING_FORBIDDEN",
};

type TranslationFn = (key: string) => string;

export function getLocalizedErrorMessage(input: {
  t: TranslationFn;
  code?: string | null;
  fallback?: string | null;
  defaultKey?: string;
}): string {
  const { t, code, fallback, defaultKey = "errors.genericMessage" } = input;

  const translationKey = code ? ERROR_CODE_TO_MESSAGE_KEY[code] : undefined;
  if (translationKey) {
    return t(translationKey);
  }

  if (fallback && fallback.trim()) {
    return fallback;
  }

  return t(defaultKey);
}
