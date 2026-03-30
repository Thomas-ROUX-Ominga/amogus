import { GameState, GameTimerSettings } from "@/types/game";

export const DEFAULT_GAME_TIMER_SETTINGS: GameTimerSettings = {
    meetingDurationSeconds: 5 * 60,
    postMeetingGraceSeconds: 60,
    sabotageDurationSeconds: 90,
    sabotageCooldownSeconds: 120,
};

const MIN_TIMER_SECONDS = 0;
const MAX_TIMER_SECONDS = 60 * 60;

function normalizeTimerSeconds(value: number | undefined, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return fallback;
    }

    const normalized = Math.floor(value);
    if (normalized < MIN_TIMER_SECONDS) return MIN_TIMER_SECONDS;
    if (normalized > MAX_TIMER_SECONDS) return MAX_TIMER_SECONDS;
    return normalized;
}

export function normalizeGameTimerSettings(
    input?: Partial<GameTimerSettings> | null
): GameTimerSettings {
    return {
        meetingDurationSeconds: normalizeTimerSeconds(
            input?.meetingDurationSeconds,
            DEFAULT_GAME_TIMER_SETTINGS.meetingDurationSeconds
        ),
        postMeetingGraceSeconds: normalizeTimerSeconds(
            input?.postMeetingGraceSeconds,
            DEFAULT_GAME_TIMER_SETTINGS.postMeetingGraceSeconds
        ),
        sabotageDurationSeconds: normalizeTimerSeconds(
            input?.sabotageDurationSeconds,
            DEFAULT_GAME_TIMER_SETTINGS.sabotageDurationSeconds
        ),
        sabotageCooldownSeconds: normalizeTimerSeconds(
            input?.sabotageCooldownSeconds,
            DEFAULT_GAME_TIMER_SETTINGS.sabotageCooldownSeconds
        ),
    };
}

export function resolveGameTimerSettings(
    gameState?: Pick<GameState, "timerSettings"> | null
): GameTimerSettings {
    return normalizeGameTimerSettings(gameState?.timerSettings);
}

export function hasCustomGameTimerSettings(settings: GameTimerSettings): boolean {
    return (
        settings.meetingDurationSeconds !== DEFAULT_GAME_TIMER_SETTINGS.meetingDurationSeconds ||
        settings.postMeetingGraceSeconds !== DEFAULT_GAME_TIMER_SETTINGS.postMeetingGraceSeconds ||
        settings.sabotageDurationSeconds !== DEFAULT_GAME_TIMER_SETTINGS.sabotageDurationSeconds ||
        settings.sabotageCooldownSeconds !== DEFAULT_GAME_TIMER_SETTINGS.sabotageCooldownSeconds
    );
}

export function secondsToMs(seconds: number): number {
    return Math.max(0, Math.floor(seconds) * 1000);
}
