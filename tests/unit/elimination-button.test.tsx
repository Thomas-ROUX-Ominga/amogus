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
        
        const button = screen.getByRole('button', { name: /signal elimination/i });
        expect(button).toBeInTheDocument();
        expect(button).not.toBeDisabled();
        expect(screen.getByText('SIGNAL ELIMINATION')).toBeInTheDocument();
    });

    it('shows loading state when eliminating', () => {
        render(<EliminationButton onEliminate={mockOnEliminate} isEliminating={true} />);
        
        const button = screen.getByRole('button', { name: /signaling elimination/i });
        expect(button).toBeDisabled();
        expect(screen.getByText('SIGNALING...')).toBeInTheDocument();
    });

    it('is disabled when disabled prop is true', () => {
        render(<EliminationButton onEliminate={mockOnEliminate} disabled={true} />);
        
        const button = screen.getByRole('button', { name: /signal elimination/i });
        expect(button).toBeDisabled();
    });

    it('opens confirmation dialog when clicked', async () => {
        render(<EliminationButton onEliminate={mockOnEliminate} />);
        
        const button = screen.getByRole('button', { name: /signal elimination/i });
        fireEvent.click(button);
        
        // The dialog should appear immediately after click
        expect(screen.getAllByText('Signal Elimination')).toHaveLength(2); // Button + Dialog title
        expect(screen.getByText(/Are you sure you want to signal that you have been eliminated?/)).toBeInTheDocument();
    });

    it('calls onEliminate when confirmation is confirmed', async () => {
        const mockPromise = Promise.resolve();
        mockOnEliminate.mockReturnValue(mockPromise);
        
        render(<EliminationButton onEliminate={mockOnEliminate} />);
        
        const button = screen.getByRole('button', { name: /signal elimination/i });
        fireEvent.click(button);
        
        // The dialog should appear immediately
        expect(screen.getAllByText('Signal Elimination')).toHaveLength(2); // Button + Dialog title
        
        // Get the confirm button from the dialog (the second button with this text)
        const confirmButtons = screen.getAllByRole('button', { name: /signal elimination/i });
        const confirmButton = confirmButtons[1]; // The dialog button
        fireEvent.click(confirmButton);
        
        expect(mockOnEliminate).toHaveBeenCalledTimes(1);
    });

    it('closes dialog when cancelled', async () => {
        render(<EliminationButton onEliminate={mockOnEliminate} />);
        
        const button = screen.getByRole('button', { name: /signal elimination/i });
        fireEvent.click(button);
        
        // The dialog should appear immediately
        expect(screen.getAllByText('Signal Elimination')).toHaveLength(2); // Button + Dialog title
        
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);
        
        // The dialog should disappear immediately, leaving only the button
        // Check that the dialog title is gone (only the button text remains)
        expect(screen.queryByText('Signal Elimination', { selector: 'h2' })).not.toBeInTheDocument();
        
        expect(mockOnEliminate).not.toHaveBeenCalled();
    });

    it('provides haptic feedback when clicked', () => {
        render(<EliminationButton onEliminate={mockOnEliminate} />);
        
        const button = screen.getByRole('button', { name: /signal elimination/i });
        fireEvent.click(button);
        
        expect(navigator.vibrate).toHaveBeenCalledWith([50]);
    });

    it('provides error haptic feedback when disabled', () => {
        render(<EliminationButton onEliminate={mockOnEliminate} disabled={true} />);
        
        const button = screen.getByRole('button', { name: /signal elimination/i });
        // Target the wrapper div which captures mouse events for disabled buttons
        fireEvent.mouseDown(button.parentElement!);
        
        expect(navigator.vibrate).toHaveBeenCalledWith([200]);
    });

    it('provides error haptic feedback when eliminating', () => {
        render(<EliminationButton onEliminate={mockOnEliminate} isEliminating={true} />);
        
        const button = screen.getByRole('button', { name: /signaling elimination/i });
        // Target the wrapper div which captures mouse events for disabled buttons
        fireEvent.mouseDown(button.parentElement!);
        
        expect(navigator.vibrate).toHaveBeenCalledWith([200]);
    });
});
