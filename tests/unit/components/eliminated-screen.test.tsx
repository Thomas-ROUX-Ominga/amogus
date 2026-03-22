import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EliminatedScreen } from '@/components/game/eliminated-screen';

describe('EliminatedScreen', () => {
  const defaultProps = {
    playerName: 'TestPlayer',
    playerRole: 'CREWMATE',
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders awaiting-meeting state by default', () => {
    render(<EliminatedScreen {...defaultProps} />);

    expect(screen.getByText('VOUS ÊTES MORT')).toBeInTheDocument();
    expect(screen.getByText('EN ATTENTE DU MEETING')).toBeInTheDocument();
    expect(screen.getByText('• Restez assis en silence tant que le meeting n\'est pas terminé.')).toBeInTheDocument();
  });

  it('shows player name in awaiting state', () => {
    render(<EliminatedScreen {...defaultProps} />);

    expect(screen.getByText('Joueur: TestPlayer')).toBeInTheDocument();
  });

  it('does not render return-home link anymore', () => {
    render(<EliminatedScreen {...defaultProps} />);

    expect(screen.queryByText("Retour à l'accueil")).not.toBeInTheDocument();
  });

  it('renders ghost-info popup for crewmate', () => {
    render(<EliminatedScreen {...defaultProps} phase="ghost-info" />);

    expect(screen.getByText('MODE FANTÔME ACTIVÉ')).toBeInTheDocument();
    expect(screen.getByText('Fantôme crewmate')).toBeInTheDocument();
    expect(screen.getByText('Vous pouvez terminer vos quêtes en silence, mais vous ne pouvez plus stopper les sabotages.')).toBeInTheDocument();
  });

  it('renders ghost-info popup for impostor', () => {
    render(<EliminatedScreen {...defaultProps} playerRole="IMPOSTOR" phase="ghost-info" />);

    expect(screen.getByText('Fantôme imposteur')).toBeInTheDocument();
    expect(screen.getByText('Vous pouvez toujours déclencher des sabotages en silence.')).toBeInTheDocument();
  });

  it('calls onDismiss when close button is clicked', () => {
    render(<EliminatedScreen {...defaultProps} />);

    const closeButton = screen.getByLabelText('Fermer');
    fireEvent.click(closeButton);

    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('works without onDismiss callback', () => {
    const propsWithoutCallback = { ...defaultProps };
    // @ts-expect-error - testing optional prop
    delete propsWithoutCallback.onDismiss;

    render(<EliminatedScreen {...propsWithoutCallback} />);

    expect(screen.queryByLabelText('Fermer')).not.toBeInTheDocument();
    expect(screen.getByText('VOUS ÊTES MORT')).toBeInTheDocument();
  });
});
