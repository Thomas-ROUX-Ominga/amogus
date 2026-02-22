"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface UseCameraScannerOptions {
    gameId?: string;
}

export interface UseCameraScannerReturn {
    isOpen: boolean;
    isLoading: boolean;
    openScanner: () => void;
    closeScanner: () => void;
    handleScan: (questId: string) => Promise<void>;
}

export function useCameraScanner({ gameId }: UseCameraScannerOptions = {}): UseCameraScannerReturn {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const openScanner = useCallback(() => {
        setIsOpen(true);
    }, []);

    const closeScanner = useCallback(() => {
        setIsOpen(false);
        setIsLoading(false);
    }, []);

    const handleScan = useCallback(async (questId: string) => {
        if (!gameId) {
            console.error('No gameId provided for navigation');
            return;
        }

        setIsLoading(true);
        
        try {
            // Vibrate for feedback
            try {
                if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                    navigator.vibrate([50, 30, 50]);
                }
            } catch {
                // Ignore haptic failures silently
            }

            // Navigate to quest route with detected quest ID
            const questUrl = `/game/${gameId}/quest?questId=${questId}`;
            await router.push(questUrl);
        } catch (error) {
            console.error('Navigation error:', error);
            // Fallback: try to navigate without quest ID
            try {
                await router.push(`/game/${gameId}/quest`);
            } catch (fallbackError) {
                console.error('Fallback navigation error:', fallbackError);
            }
        } finally {
            setIsLoading(false);
            closeScanner();
        }
    }, [gameId, router, closeScanner]);

    return {
        isOpen,
        isLoading,
        openScanner,
        closeScanner,
        handleScan,
    };
}
