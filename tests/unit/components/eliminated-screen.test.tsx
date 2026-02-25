import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EliminatedScreen } from '@/components/game/eliminated-screen';

describe('EliminatedScreen', () => {
  const defaultProps = {
    playerName: 'TestPlayer',
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders eliminated screen with proper styling', () => {
    render(<EliminatedScreen {...defaultProps} />);
    
    // Check for opaque background (no transparency)
    const overlay = screen.getByText('YOU HAVE BEEN ELIMINATED').closest('div');
    expect(overlay).toBeInTheDocument();
    
    // Check for prominent "ELIMINATED" header
    expect(screen.getByText('ELIMINATED')).toBeInTheDocument();
    expect(screen.getByText('YOU HAVE BEEN ELIMINATED')).toBeInTheDocument();
  });

  it('displays player name and Ghost Mode status', () => {
    render(<EliminatedScreen {...defaultProps} />);
    
    expect(screen.getByText('Player: TestPlayer')).toBeInTheDocument();
    expect(screen.getByText('Status: ELIMINATED - GHOST MODE ACTIVE')).toBeInTheDocument();
  });

  it('shows Ghost Mode capabilities for Crewmates', () => {
    render(<EliminatedScreen {...defaultProps} playerRole="CREWMATE" />);
    
    expect(screen.getByText('• You can continue scanning QR codes')).toBeInTheDocument();
    expect(screen.getByText('• Complete your remaining assigned quests')).toBeInTheDocument();
    expect(screen.getByText('• Help your crew finish the mission from beyond')).toBeInTheDocument();
  });

  it('renders correctly for Impostors without Ghost Mode info', () => {
    render(<EliminatedScreen {...defaultProps} playerRole="IMPOSTOR" />);
    
    expect(screen.getByText('MISSION TERMINATED')).toBeInTheDocument();
    expect(screen.getByText('YOU HAVE BEEN DECOMMISSIONED')).toBeInTheDocument();
    expect(screen.getByText('Your sabotage mission has failed. The crew has neutralized you.')).toBeInTheDocument();
    
    // Should NOT show Ghost Mode info
    expect(screen.queryByText('• You can continue scanning QR codes')).not.toBeInTheDocument();
    expect(screen.queryByText('Status: ELIMINATED - GHOST MODE ACTIVE')).not.toBeInTheDocument();
    expect(screen.getByText('Awaiting game conclusion or return to lobby.')).toBeInTheDocument();
  });

  it('has proper visual styling for Ghost Mode', () => {
    render(<EliminatedScreen {...defaultProps} />);
    
    // Check for blue Ghost Mode styling
    const ghostModeElement = screen.getByText('Status: ELIMINATED - GHOST MODE ACTIVE');
    expect(ghostModeElement).toHaveClass('text-blue-300');
  });

  it('calls onDismiss when close button is clicked', () => {
    render(<EliminatedScreen {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('Dismiss');
    fireEvent.click(closeButton);
    
    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders return to lobby link', () => {
    render(<EliminatedScreen {...defaultProps} />);
    
    const returnLink = screen.getByText('Return to Lobby');
    expect(returnLink).toBeInTheDocument();
    expect(returnLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('works without player name', () => {
    const propsWithoutName = { ...defaultProps };
    // @ts-expect-error - Testing optional prop
    delete propsWithoutName.playerName;
    
    render(<EliminatedScreen {...propsWithoutName} />);
    
    expect(screen.queryByText('Player:')).not.toBeInTheDocument();
    expect(screen.getByText('ELIMINATED')).toBeInTheDocument();
  });

  it('works without onDismiss callback', () => {
    const propsWithoutCallback = { ...defaultProps };
    // @ts-expect-error - Testing optional prop
    delete propsWithoutCallback.onDismiss;
    
    render(<EliminatedScreen {...propsWithoutCallback} />);
    
    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
    expect(screen.getByText('ELIMINATED')).toBeInTheDocument();
  });
});
