import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuccessOverlay } from '@/components/game/success-overlay';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: React.ComponentProps<'h1'>) => <h1 {...props}>{children}</h1>,
    button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('SuccessOverlay', () => {
  const mockOnManualExit = vi.fn();
  const mockVibrate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
    });
  });

  it('renders correctly with title and button', () => {
    render(<SuccessOverlay onManualExit={mockOnManualExit} />);
    
    // Use a function matcher to handle the <br /> break
    expect(screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'h1' && 
             content.includes('MISSION') && 
             content.includes('ACCOMPLIE');
    })).toBeDefined();
    
    expect(screen.getByText('Retour au Cockpit')).toBeDefined();
  });

  it('triggers haptic feedback on mount', () => {
    render(<SuccessOverlay onManualExit={mockOnManualExit} />);
    
    expect(mockVibrate).toHaveBeenCalledWith([50, 50, 50, 50, 200]);
  });

  it('calls onManualExit when button is clicked', () => {
    render(<SuccessOverlay onManualExit={mockOnManualExit} />);
    
    const button = screen.getByText('Retour au Cockpit');
    fireEvent.click(button);
    
    expect(mockOnManualExit).toHaveBeenCalledTimes(1);
  });

  it('renders with red color and glitchy vibration for impostors', () => {
    render(<SuccessOverlay onManualExit={mockOnManualExit} isImpostor={true} />);
    
    // Check for red color class on h1
    const heading = screen.getByRole('heading', { name: /MISSION/i });
    expect(heading.className).toContain('text-[#DA3633]');
    
    // Check for glitchy vibration pattern
    expect(mockVibrate).toHaveBeenCalledWith([50, 30, 100, 30, 250, 50, 150]);
  });
});
