import { describe, it, expect } from 'vitest';
import { generateBatch } from '@/lib/quests/batch-generator';
import { BatchCreateInput, QuestType } from '@/types/quest';

describe('Batch Generator', () => {
  describe('generateBatch', () => {
    it('should always contain exactly 3 mini-game quests (one per duration)', () => {
      const input: BatchCreateInput = { totalQuests: 30 };
      const batch = generateBatch(input);

      const miniGames = batch.quests.filter(q => q.type === 'mini-game');
      expect(miniGames).toHaveLength(3);
      
      const durations = miniGames.map(mg => mg.duration);
      expect(durations).toContain('short');
      expect(durations).toContain('medium');
      expect(durations).toContain('long');
    });

    it('should generate default sabotage QR entries', () => {
      const input: BatchCreateInput = { totalQuests: 10 };
      const batch = generateBatch(input);

      expect(batch.sabotages).toBeDefined();
      expect(batch.sabotages?.communications.qrId).toBeTruthy();
      expect(batch.sabotages?.lights.qrId).toBeTruthy();
      expect(batch.sabotages?.reactor).toHaveLength(2);
      expect(batch.sabotages?.reactor[0].qrId).toBeTruthy();
      expect(batch.sabotages?.reactor[1].qrId).toBeTruthy();
    });

    it('should generate exact count with 3 mini-games + 27 classic quests for 30', () => {
      const input: BatchCreateInput = { totalQuests: 30 };
      const batch = generateBatch(input);

      expect(batch.quests).toHaveLength(30);
      expect(batch.questCount).toBe(30);

      const classicQuests = batch.quests.filter(q => q.type !== 'mini-game');
      expect(classicQuests).toHaveLength(27);

      const shortQuests = classicQuests.filter(q => q.duration === 'short');
      const mediumQuests = classicQuests.filter(q => q.duration === 'medium');
      const longQuests = classicQuests.filter(q => q.duration === 'long');

      // 27 classic quests: 9 short, 9 medium, 9 long
      expect(shortQuests).toHaveLength(9);
      expect(mediumQuests).toHaveLength(9);
      expect(longQuests).toHaveLength(9);
    });

    it('should handle odd numbers with proper rounding', () => {
      const input: BatchCreateInput = { totalQuests: 31 };
      const batch = generateBatch(input);

      expect(batch.quests).toHaveLength(31);

      const classicQuests = batch.quests.filter(q => q.type !== 'mini-game');
      expect(classicQuests).toHaveLength(28); // 31 - 3 mini-games

      const shortQuests = classicQuests.filter(q => q.duration === 'short');
      const mediumQuests = classicQuests.filter(q => q.duration === 'medium');
      const longQuests = classicQuests.filter(q => q.duration === 'long');

      // 28 classic quests: 10 short, 9 medium, 9 long
      expect(shortQuests).toHaveLength(10);
      expect(mediumQuests).toHaveLength(9);
      expect(longQuests).toHaveLength(9);
    });


    it('should assign valid quest types to all classic quests', () => {
      const input: BatchCreateInput = { totalQuests: 15 };
      const batch = generateBatch(input);

      const validClassicTypes: QuestType[] = ['true-false', 'qcm', 'single-input', 'number-input', 'intrus'];

      batch.quests.filter(q => q.type !== 'mini-game').forEach(quest => {
        expect(validClassicTypes).toContain(quest.type);
      });
    });

    it('should assign a valid duration to the mini-game quest', () => {
      const input: BatchCreateInput = { totalQuests: 10 };
      const batch = generateBatch(input);

      const miniGame = batch.quests.find(q => q.type === 'mini-game');
      expect(['short', 'medium', 'long']).toContain(miniGame?.duration);
    });

    it('should generate unique IDs for batch and all quests', () => {
      const input: BatchCreateInput = { totalQuests: 10 };
      const batch = generateBatch(input);

      expect(batch.id).toBeDefined();
      expect(batch.id).toMatch(/^[0-9a-f-]+$/);

      const questIds = batch.quests.map(q => q.id);
      const uniqueQuestIds = new Set(questIds);

      expect(uniqueQuestIds.size).toBe(10);
      expect(questIds.every(id => id.match(/^[0-9a-f-]+$/))).toBe(true);
    });

    it('should create quests with required structure', () => {
      const input: BatchCreateInput = { totalQuests: 5 };
      const batch = generateBatch(input);

      batch.quests.forEach(quest => {
        expect(quest).toHaveProperty('id');
        expect(quest).toHaveProperty('type');
        expect(quest).toHaveProperty('duration');

        expect(typeof quest.id).toBe('string');
        expect(quest.id.length).toBeGreaterThan(0);
      });
    });

    it('should set createdAt timestamp', () => {
      const input: BatchCreateInput = { totalQuests: 5 };
      const batch = generateBatch(input);

      expect(batch.createdAt).toBeDefined();
      expect(new Date(batch.createdAt)).toBeInstanceOf(Date);
    });
  });
});
