import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameStore } from '@/lib/store/game-store';
import { PlayerRole } from '@/types/game';
import { Quest, QuestType, QuestDuration } from '@/types/quest';

// Mock redis actions
vi.mock('@/lib/redis/actions', () => ({
  getGame: vi.fn(),
  completeQuest: vi.fn(),
}));

describe('Impostor Quest Tracker', () => {
  beforeEach(() => {
    // Reset store before each test
    const { reset } = useGameStore.getState();
    reset();
  });

  describe('Fake Quest Assignment Generation', () => {
    it('should generate fake quest assignments for impostors', () => {
      const { result } = renderHook(() => useGameStore());
      
      const mockBatchQuests: Quest[] = [
        { id: 'quest1', type: 'qcm' as QuestType, duration: 'short' as QuestDuration, location: 'Salle des machines' },
        { id: 'quest2', type: 'true-false' as QuestType, duration: 'medium' as QuestDuration, location: 'Pont de commandement' },
        { id: 'quest3', type: 'form' as QuestType, duration: 'long' as QuestDuration, location: 'Secteur médical' },
      ];

      act(() => {
        const fakeAssignments = result.current.generateImpostorQuestAssignments(mockBatchQuests, {
          short: 1,
          medium: 1,
          long: 1
        });
        
        result.current.initializeImpostorQuests(fakeAssignments);
      });

      expect(result.current.impostorQuests).toHaveLength(3);
      expect(result.current.impostorQuests[0]).toHaveProperty('location');
      expect(result.current.impostorQuests[0]).toHaveProperty('completed');
      expect(result.current.impostorQuests[0].completed).toBe(false);
    });

    it('should match crewmate quest distribution', () => {
      const { result } = renderHook(() => useGameStore());
      
      const mockBatchQuests: Quest[] = [
        { id: 'quest1', type: 'qcm' as QuestType, duration: 'short' as QuestDuration, location: 'Salle des machines' },
        { id: 'quest2', type: 'true-false' as QuestType, duration: 'short' as QuestDuration, location: 'Soute cargo' },
        { id: 'quest3', type: 'form' as QuestType, duration: 'medium' as QuestDuration, location: 'Pont de commandement' },
        { id: 'quest4', type: 'single-input' as QuestType, duration: 'long' as QuestDuration, location: 'Secteur médical' },
      ];

      const distribution = { short: 2, medium: 1, long: 1 };
      
      act(() => {
        const fakeAssignments = result.current.generateImpostorQuestAssignments(mockBatchQuests, distribution);
        result.current.initializeImpostorQuests(fakeAssignments);
      });

      const shortQuests = result.current.impostorQuests.filter(q => q.duration === 'short');
      const mediumQuests = result.current.impostorQuests.filter(q => q.duration === 'medium');
      const longQuests = result.current.impostorQuests.filter(q => q.duration === 'long');

      expect(shortQuests).toHaveLength(2);
      expect(mediumQuests).toHaveLength(1);
      expect(longQuests).toHaveLength(1);
    });
  });

  describe('Progress Tracking', () => {
    it('should track impostor progress locally', () => {
      const { result } = renderHook(() => useGameStore());

      act(() => {
        result.current.initializeImpostorQuests([
          { id: 'quest1', type: 'qcm' as QuestType, duration: 'short' as QuestDuration, location: 'Salle des machines', completed: false },
          { id: 'quest2', type: 'true-false' as QuestType, duration: 'medium' as QuestDuration, location: 'Pont de commandement', completed: false },
        ]);
      });

      expect(result.current.impostorQuests).toHaveLength(2);
      expect(result.current.getImpostorQuestData().completed).toBe(0);

      act(() => {
        result.current.completeImpostorQuest('quest1');
      });

      expect(result.current.getImpostorQuestData().completed).toBe(1);
      expect(result.current.impostorQuests[0].completed).toBe(true);
    });

    it('should calculate progress percentage correctly', () => {
      const { result } = renderHook(() => useGameStore());

      act(() => {
        result.current.initializeImpostorQuests([
          { id: 'quest1', type: 'qcm' as QuestType, duration: 'short' as QuestDuration, location: 'Salle des machines', completed: false },
          { id: 'quest2', type: 'true-false' as QuestType, duration: 'medium' as QuestDuration, location: 'Pont de commandement', completed: false },
          { id: 'quest3', type: 'form' as QuestType, duration: 'long' as QuestDuration, location: 'Secteur médical', completed: false },
        ]);
      });

      expect(result.current.getImpostorProgress()).toBe(0);

      act(() => {
        result.current.completeImpostorQuest('quest1');
      });

      expect(result.current.getImpostorProgress()).toBe(33); // 1/3 = 33.33%

      act(() => {
        result.current.completeImpostorQuest('quest2');
      });

      expect(result.current.getImpostorProgress()).toBe(67); // 2/3 = 66.67%
    });
  });

  describe('Visual Parity', () => {
    it('should provide quest data for impostor display', () => {
      const { result } = renderHook(() => useGameStore());

      const mockQuests = [
        { id: 'quest1', type: 'qcm' as QuestType, duration: 'short' as QuestDuration, location: 'Salle des machines', completed: false },
        { id: 'quest2', type: 'true-false' as QuestType, duration: 'medium' as QuestDuration, location: 'Pont de commandement', completed: true },
      ];

      act(() => {
        result.current.initializeImpostorQuests(mockQuests);
      });

      const questData = result.current.getImpostorQuestData();
      
      expect(questData.quests).toEqual(mockQuests);
      expect(questData.completed).toBe(1);
      expect(questData.total).toBe(2);
      expect(questData.percentage).toBe(50);
    });
  });
});
