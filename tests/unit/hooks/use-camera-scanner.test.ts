import { renderHook, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { useCameraScanner } from '@/hooks/use-camera-scanner';

// Mock Next.js router
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(),
}));

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
    value: vi.fn(),
    writable: true,
});

describe('useCameraScanner', () => {
    const mockPush = vi.fn();
    
    beforeEach(() => {
        vi.clearAllMocks();
        (useRouter as unknown as { mockReturnValue: (value: { push: Mock }) => void }).mockReturnValue({
            push: mockPush,
        });
    });

    it('should initialize with closed scanner', () => {
        const { result } = renderHook(() => useCameraScanner());
        
        expect(result.current.isOpen).toBe(false);
        expect(result.current.isLoading).toBe(false);
    });

    it('should open scanner when openScanner is called', () => {
        const { result } = renderHook(() => useCameraScanner());
        
        act(() => {
            result.current.openScanner();
        });
        
        expect(result.current.isOpen).toBe(true);
    });

    it('should close scanner when closeScanner is called', () => {
        const { result } = renderHook(() => useCameraScanner());
        
        act(() => {
            result.current.openScanner();
        });
        expect(result.current.isOpen).toBe(true);
        
        act(() => {
            result.current.closeScanner();
        });
        expect(result.current.isOpen).toBe(false);
        expect(result.current.isLoading).toBe(false);
    });

    it('should navigate to quest route when QR code is scanned', async () => {
        const gameId = 'test-game-123';
        const questId = 'quest-456';
        const { result } = renderHook(() => useCameraScanner({ gameId }));
        
        act(() => {
            result.current.openScanner();
        });
        
        await act(async () => {
            await result.current.handleScan(questId);
        });
        
        expect(mockPush).toHaveBeenCalledWith(`/game/${gameId}/quest?questId=${questId}`);
        expect(result.current.isOpen).toBe(false);
        expect(result.current.isLoading).toBe(false);
    });

    it('should handle navigation without gameId gracefully', async () => {
        const questId = 'quest-456';
        const { result } = renderHook(() => useCameraScanner());
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        await act(async () => {
            await result.current.handleScan(questId);
        });
        
        expect(consoleSpy).toHaveBeenCalledWith('No gameId provided for navigation');
        expect(mockPush).not.toHaveBeenCalled();
        
        consoleSpy.mockRestore();
    });

    it('should provide haptic feedback on successful scan', async () => {
        const gameId = 'test-game-123';
        const questId = 'quest-456';
        const { result } = renderHook(() => useCameraScanner({ gameId }));
        
        await act(async () => {
            await result.current.handleScan(questId);
        });
        
        expect(navigator.vibrate).toHaveBeenCalledWith([50, 30, 50]);
    });

    it('should handle navigation errors gracefully', async () => {
        const gameId = 'test-game-123';
        const questId = 'quest-456';
        const { result } = renderHook(() => useCameraScanner({ gameId }));
        
        const error = new Error('Navigation failed');
        mockPush.mockRejectedValueOnce(error);
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        await act(async () => {
            await result.current.handleScan(questId);
        });
        
        expect(consoleSpy).toHaveBeenCalledWith('Navigation error:', error);
        expect(result.current.isOpen).toBe(false);
        
        consoleSpy.mockRestore();
    });

    it('should try fallback navigation on error', async () => {
        const gameId = 'test-game-123';
        const questId = 'quest-456';
        const { result } = renderHook(() => useCameraScanner({ gameId }));
        
        // First call fails, second succeeds
        mockPush
            .mockRejectedValueOnce(new Error('Navigation failed'))
            .mockResolvedValueOnce(undefined);
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        await act(async () => {
            await result.current.handleScan(questId);
        });
        
        expect(mockPush).toHaveBeenNthCalledWith(1, `/game/${gameId}/quest?questId=${questId}`);
        expect(mockPush).toHaveBeenNthCalledWith(2, `/game/${gameId}/quest`);
        
        consoleSpy.mockRestore();
    });

    it('should deduplicate repeated scan callbacks', async () => {
        const gameId = 'test-game-123';
        const questId = 'quest-456';
        const { result } = renderHook(() => useCameraScanner({ gameId }));

        await act(async () => {
            await Promise.all([
                result.current.handleScan(questId),
                result.current.handleScan(questId),
            ]);
        });

        expect(mockPush).toHaveBeenCalledTimes(1);
        expect(mockPush).toHaveBeenCalledWith(`/game/${gameId}/quest?questId=${questId}`);
    });
});
