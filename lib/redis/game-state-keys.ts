export const GAME_STATE_NAMESPACE = "game:v2";

export function getGameStateKey(gameId: string): string {
    return `${GAME_STATE_NAMESPACE}:${gameId}:state`;
}

export function getGameStatePattern(): string {
    return `${GAME_STATE_NAMESPACE}:*:state`;
}

export function getGameNamespacePattern(gameId: string): string {
    return `${GAME_STATE_NAMESPACE}:${gameId}:*`;
}

export function getMeetingVoteKey(gameId: string, meetingId: string, voterId: string): string {
    return `${GAME_STATE_NAMESPACE}:${gameId}:meeting:${meetingId}:vote:${voterId}`;
}

export function getFailedQuestsKey(gameId: string, userId: string): string {
    return `${GAME_STATE_NAMESPACE}:${gameId}:player:${userId}:failed-quests`;
}

export function parseGameIdFromStateKey(key: string): string | null {
    const prefix = `${GAME_STATE_NAMESPACE}:`;
    const suffix = ":state";

    if (!key.startsWith(prefix) || !key.endsWith(suffix)) {
        return null;
    }

    return key.slice(prefix.length, key.length - suffix.length);
}
