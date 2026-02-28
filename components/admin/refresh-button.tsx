"use client";

import { useState, useCallback } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { useAuth } from "@/hooks/use-auth";
import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  gameId: string;
}

// Simple haptic feedback implementation
const triggerHaptic = () => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(50); // Short vibration for feedback
  }
};

export function RefreshButton({ gameId }: RefreshButtonProps) {
  const { refreshGameData, isRefreshing } = useGameStore();
  const { authState } = useAuth();
  const userId = authState.session?.userId;
  const [isLocalRefreshing, setIsLocalRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  const handleRefresh = useCallback(async () => {
    if (!userId || isLocalRefreshing || isRefreshing) return;

    // Debounce: prevent multiple clicks within 2 seconds
    const now = Date.now();
    if (now - lastRefreshTime < 2000) return;

    setIsLocalRefreshing(true);
    setLastRefreshTime(now);
    
    // Trigger haptic feedback on refresh start
    triggerHaptic();
    
    try {
      await refreshGameData(gameId, userId);
      // Success haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 50, 50]); // Triple vibration for success
      }
    } catch {
      // Error haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]); // Double long vibration for error
      }
    } finally {
      setIsLocalRefreshing(false);
    }
  }, [userId, isLocalRefreshing, isRefreshing, lastRefreshTime, refreshGameData, gameId]);

  const isDisabled = !userId || isRefreshing || isLocalRefreshing;

  return (
    <button
      data-testid="refresh-button"
      onClick={handleRefresh}
      disabled={isDisabled}
      aria-busy={isRefreshing || isLocalRefreshing}
      className={`
        flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-widest
        border border-primary/20 transition-all duration-200
        ${isDisabled 
          ? 'bg-primary/5 text-primary/30 cursor-not-allowed' 
          : 'bg-primary/10 text-primary/80 hover:bg-primary/20 hover:border-primary/40 hover:text-primary'
        }
      `}
    >
      <RefreshCw className={`w-3 h-3 ${isRefreshing || isLocalRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing || isLocalRefreshing ? 'Actualisation...' : 'Actualiser'}
    </button>
  );
}
