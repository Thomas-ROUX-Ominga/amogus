import { test } from 'vitest';
import { getQuestGamesByDuration } from './lib/constants/quest-pool';

test('debug', () => {
  const games = getQuestGamesByDuration('short');
  console.log('games typeof:', typeof games);
  console.log('games is array?', Array.isArray(games));
  console.log('games object keys:', Object.keys(games || {}));
});
