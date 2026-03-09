import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EliminationButton } from '@/components/game/elimination-button';

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
    value: vi.fn(),
    writable: true,
});

describe('EliminationButton', () => {
    const mockOnEliminate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders button in default state', () => {
        render(<EliminationButton onEliminate={mockOnEliminate} />);
        
        const button = screen.getByRole('button', { name: /signaler l'élimination/i });
        expect(button).toBeInTheDocument();
        expect(button).not.toBeDisabled();
        expect(screen.getByText('Signaler mon élimination')).toBeInTheDocument();
    });

    it('shows loading state when eliminating', () => {
        render(<EliminationButton onEliminate={mockOnEliminate} isEliminating={true} />);
        
        const button = screen.getByRole('button', { name: /signalement d'élimination/i });
        expect(button).toBeDisabled();
        expect(screen.getByText('SIGNALEMENT...')).toBeInTheDocument();
    });

    it('is disabled when disabled prop is true', () => {
        render(<EliminationButton onEliminate={mockOnEliminate} disabled={true} />);
        
        const button = screen.getByRole('button', { name: /déjà éliminé/i });
        expect(button).toBeDisabled();
    });

    it('opens confirmation dialog when clicked', async () => {
        render(<EliminationButton onEliminate={mockOnEliminate} />);
        
        const button = screen.getByRole('button', { name: /signaler l'élimination/i });
        fireEvent.click(button);
        
        // The dialog should appear immediately after click
        expect(screen.getByText('Signaler l\'élimination')).toBeInTheDocument();
        expect(screen.getByText(/Confirmez-vous le signalement de votre élimination/i)).toBeInTheDocument();
    });

    it('calls onEliminate when confirmation is confirmed', async () => {
        const mockPromise = Promise.resolve();
        mockOnEliminate.mockReturnValue(mockPromise);
        
        render(<EliminationButton onEliminate={mockOnEliminate} />);
        
        const button = screen.getByRole('button', { name: /signaler l'élimination/i });
        fireEvent.click(button);
        
        // The dialog should appear immediately
        expect(screen.getByText('Signaler l\'élimination')).toBeInTheDocument();
        
        // Get the confirm button from the dialog
        const confirmButtons = screen.getAllByRole('button', { name: /signaler mon élimination/i });
        expect(confirmButtons.length).toBeGreaterThan(0);
        const confirmButton = confirmButtons[0];
        fireEvent.click(confirmButton);
        
        expect(mockOnEliminate).toHaveBeenCalledTimes(1);
    });

    it('closes dialog when cancelled', async () => {
        render(<EliminationButton onEliminate={mockOnEliminate} />);
        
        const button = screen.getByRole('button', { name: /signaler l'élimination/i });
        fireEvent.click(button);
        
        // The dialog should appear immediately
        expect(screen.getByText('Signaler l\'élimination')).toBeInTheDocument();
        
        const cancelButton = screen.getByRole('button', { name: /annuler/i });
        fireEvent.click(cancelButton);
        
        // The dialog should disappear immediately, leaving only the button
        // Check that the dialog title is gone (only the button text remains)
        expect(screen.queryByText('Signaler l\'élimination', { selector: 'h2' })).not.toBeInTheDocument();
        
        expect(mockOnEliminate).not.toHaveBeenCalled();
    });

    it('provides haptic feedback when clicked', () => {
        render(<EliminationButton onEliminate={mockOnEliminate} />);
        
        const button = screen.getByRole('button', { name: /signaler l'élimination/i });
        fireEvent.click(button);
        
        expect(navigator.vibrate).toHaveBeenCalledWith([50]);
    });

    it('provides error haptic feedback when disabled', () => {
        render(<EliminationButton onEliminate={mockOnEliminate} disabled={true} />);
        
        const button = screen.getByRole('button', { name: /déjà éliminé/i });
        // Target the wrapper div which captures mouse events for disabled buttons
        fireEvent.mouseDown(button.parentElement!);
        
        expect(navigator.vibrate).toHaveBeenCalledWith([200]);
    });

    it('provides error haptic feedback when eliminating', () => {
        render(<EliminationButton onEliminate={mockOnEliminate} isEliminating={true} />);
        
        const button = screen.getByRole('button', { name: /signalement d'élimination/i });
        // Target the wrapper div which captures mouse events for disabled buttons
        fireEvent.mouseDown(button.parentElement!);
        
        expect(navigator.vibrate).toHaveBeenCalledWith([200]);
    });
});
