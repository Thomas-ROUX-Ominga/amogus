import { describe, it, expect } from 'vitest';
import { generateBatch } from '@/lib/quests/batch-generator';
import { BatchCreateInput, QuestType } from '@/types/quest';

describe('Batch Generator', () => {
  describe('generateBatch', () => {
    it('should generate exact 1/3 split for divisible numbers', () => {
      const input: BatchCreateInput = { totalQuests: 30 };
      const batch = generateBatch(input);

      expect(batch.quests).toHaveLength(30);
      expect(batch.questCount).toBe(30);
      
      const shortQuests = batch.quests.filter(q => q.duration === 'short');
      const mediumQuests = batch.quests.filter(q => q.duration === 'medium');
      const longQuests = batch.quests.filter(q => q.duration === 'long');

      expect(shortQuests).toHaveLength(10);
      expect(mediumQuests).toHaveLength(10);
      expect(longQuests).toHaveLength(10);
    });

    it('should handle odd numbers with proper rounding', () => {
      const input: BatchCreateInput = { totalQuests: 31 };
      const batch = generateBatch(input);

      expect(batch.quests).toHaveLength(31);
      
      const shortQuests = batch.quests.filter(q => q.duration === 'short');
      const mediumQuests = batch.quests.filter(q => q.duration === 'medium');
      const longQuests = batch.quests.filter(q => q.duration === 'long');

      // Should distribute the extra quest to one of the durations
      expect(shortQuests.length + mediumQuests.length + longQuests.length).toBe(31);
      expect(Math.abs(shortQuests.length - mediumQuests.length)).toBeLessThanOrEqual(1);
      expect(Math.abs(mediumQuests.length - longQuests.length)).toBeLessThanOrEqual(1);
    });

    it('should assign valid quest types to all quests', () => {
      const input: BatchCreateInput = { totalQuests: 15 };
      const batch = generateBatch(input);

      const validTypes: QuestType[] = ['true-false', 'qcm', 'form', 'single-input'];
      
      batch.quests.forEach(quest => {
        expect(validTypes).toContain(quest.type);
      });
    });

    it('should generate unique IDs for batch and all quests', () => {
      const input: BatchCreateInput = { totalQuests: 10 };
      const batch = generateBatch(input);

      expect(batch.id).toBeDefined();
      expect(batch.id).toMatch(/^[0-9a-f-]+$/); // UUID format
      
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
        expect(quest).toHaveProperty('title');
        expect(quest).toHaveProperty('instruction');
        
        expect(typeof quest.id).toBe('string');
        expect(typeof quest.title).toBe('string');
        expect(typeof quest.instruction).toBe('string');
        
        expect(quest.id.length).toBeGreaterThan(0);
        expect(quest.title.length).toBeGreaterThan(0);
        expect(quest.instruction.length).toBeGreaterThan(0);
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
