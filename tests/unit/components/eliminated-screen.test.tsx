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
    const overlay = screen.getByText('VOUS AVEZ ÉTÉ ÉLIMINÉ').closest('div');
    expect(overlay).toBeInTheDocument();
    
    // Check for prominent eliminated header
    expect(screen.getByText('ÉLIMINÉ')).toBeInTheDocument();
    expect(screen.getByText('VOUS AVEZ ÉTÉ ÉLIMINÉ')).toBeInTheDocument();
  });

  it('displays player name and Ghost Mode status', () => {
    render(<EliminatedScreen {...defaultProps} />);
    
    expect(screen.getByText('Joueur: TestPlayer')).toBeInTheDocument();
    expect(screen.getByText('Statut: ÉLIMINÉ - MODE FANTÔME ACTIF')).toBeInTheDocument();
  });

  it('shows Ghost Mode capabilities for Crewmates', () => {
    render(<EliminatedScreen {...defaultProps} playerRole="CREWMATE" />);
    
    expect(screen.getByText('• Vous pouvez continuer à scanner des QR codes')).toBeInTheDocument();
    expect(screen.getByText('• Terminez vos quêtes restantes assignées')).toBeInTheDocument();
    expect(screen.getByText("• Aidez votre équipage à finir la mission depuis l'au-delà")).toBeInTheDocument();
  });

  it('renders correctly for Impostors without Ghost Mode info', () => {
    render(<EliminatedScreen {...defaultProps} playerRole="IMPOSTOR" />);
    
    expect(screen.getByText('MISSION TERMINÉE')).toBeInTheDocument();
    expect(screen.getByText('VOUS AVEZ ÉTÉ DÉSACTIVÉ')).toBeInTheDocument();
    expect(screen.getByText("Votre mission de sabotage a échoué. L'équipage vous a neutralisé.")).toBeInTheDocument();
    
    // Should NOT show Ghost Mode info
    expect(screen.queryByText('• Vous pouvez continuer à scanner des QR codes')).not.toBeInTheDocument();
    expect(screen.queryByText('Statut: ÉLIMINÉ - MODE FANTÔME ACTIF')).not.toBeInTheDocument();
    expect(screen.getByText('En attente de fin de partie ou retour au lobby.')).toBeInTheDocument();
  });

  it('has proper visual styling for Ghost Mode', () => {
    render(<EliminatedScreen {...defaultProps} />);
    
    // Check for blue Ghost Mode styling
    const ghostModeElement = screen.getByText('Statut: ÉLIMINÉ - MODE FANTÔME ACTIF');
    expect(ghostModeElement).toHaveClass('text-blue-300');
  });

  it('calls onDismiss when close button is clicked', () => {
    render(<EliminatedScreen {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('Fermer');
    fireEvent.click(closeButton);
    
    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders return to lobby link', () => {
    render(<EliminatedScreen {...defaultProps} />);
    
    const returnLink = screen.getByText('Retour à l\'accueil');
    expect(returnLink).toBeInTheDocument();
    expect(returnLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('works without player name', () => {
    const propsWithoutName = { ...defaultProps };
    // @ts-expect-error - Testing optional prop
    delete propsWithoutName.playerName;
    
    render(<EliminatedScreen {...propsWithoutName} />);
    
    expect(screen.queryByText(/^Joueur:/)).not.toBeInTheDocument();
    expect(screen.getByText('ÉLIMINÉ')).toBeInTheDocument();
  });

  it('works without onDismiss callback', () => {
    const propsWithoutCallback = { ...defaultProps };
    // @ts-expect-error - Testing optional prop
    delete propsWithoutCallback.onDismiss;
    
    render(<EliminatedScreen {...propsWithoutCallback} />);
    
    expect(screen.queryByLabelText('Fermer')).not.toBeInTheDocument();
    expect(screen.getByText('ÉLIMINÉ')).toBeInTheDocument();
  });
});
