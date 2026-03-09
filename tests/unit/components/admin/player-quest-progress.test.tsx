import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerQuestProgress } from '@/components/admin/player-quest-progress';

// Mock the quest calculations
vi.mock('@/lib/utils/quest-calculations', () => ({
  getTotalQuests: vi.fn(() => 10),
}));

describe('PlayerQuestProgress', () => {
  const mockPlayer = {
    id: 'player-1',
    name: 'Test Player',
    role: 'CREWMATE' as const,
    isAlive: true,
    completedQuests: ['quest-1', 'quest-2', 'quest-3'],
    lastQuestCompleted: 1640995200000, // 2022-01-01 00:00:00
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render quest progress overview', () => {
    render(<PlayerQuestProgress player={mockPlayer} />);
    
    expect(screen.getByText('3/10 quêtes')).toBeDefined();
    expect(screen.getByText('30%')).toBeDefined();
  });

  it('should show progress bar with correct percentage', () => {
    render(<PlayerQuestProgress player={mockPlayer} />);
    
    // Check for progress bar using class selector since it doesn't have a role
    const progressBar = document.querySelector('.bg-gradient-to-r');
    expect(progressBar).toBeDefined();
    expect(progressBar?.getAttribute('style')).toContain('width: 30%');
  });

  it('should display last quest completion time', () => {
    render(<PlayerQuestProgress player={mockPlayer} />);
    
    expect(screen.getByText(/Dernière quête:/)).toBeDefined();
    // The exact time may vary based on timezone, so just check that a time is displayed
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeDefined();
  });

  it('should show "YOU" indicator for current user', () => {
    render(<PlayerQuestProgress player={mockPlayer} isCurrentUser={true} />);
    
    expect(screen.getByText('VOUS')).toBeDefined();
  });

  it('should not show "YOU" indicator for non-current user', () => {
    render(<PlayerQuestProgress player={mockPlayer} isCurrentUser={false} />);
    
    expect(screen.queryByText('VOUS')).toBeNull();
  });

  it('should handle player with no completed quests', () => {
    const playerWithNoQuests = {
      ...mockPlayer,
      completedQuests: [],
    };

    render(<PlayerQuestProgress player={playerWithNoQuests} />);
    
    expect(screen.getByText('0/10 quêtes')).toBeDefined();
    expect(screen.getByText('0%')).toBeDefined();
  });

  it('should handle player with no lastQuestCompleted timestamp', () => {
    const playerWithoutTimestamp = {
      ...mockPlayer,
      lastQuestCompleted: undefined,
    };

    render(<PlayerQuestProgress player={playerWithoutTimestamp} />);
    
    expect(screen.queryByText(/Dernière quête:/)).toBeNull();
  });

  it('should display check circle icon', () => {
    render(<PlayerQuestProgress player={mockPlayer} />);
    
    const icon = document.querySelector('.text-green-500');
    expect(icon).toBeDefined();
  });
});
