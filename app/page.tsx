"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PulseButton } from "@/components/effects/pulse-button";
import { createGame } from "@/lib/kv/actions";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCreateGame = async () => {
    setIsLoading(true);
    setError(null);
    const response = await createGame();

    if (response.success && response.data) {
      router.push(`/game/${response.data}`);
    } else {
      setError(response.error || "Failed to create game");
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
      <div className="max-w-2xl w-full border-2 border-primary/20 p-8 md:p-12 space-y-8 bg-black/50 backdrop-blur-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter">
              AMOGUS <span className="text-foreground">COCKPIT</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed border-l-2 border-primary/20 pl-4">
            System initialization complete. Waiting for operator command...
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-12 border-y border-primary/10 gap-6">
          <PulseButton onClick={handleCreateGame} isLoading={isLoading}>
            Créer une partie
          </PulseButton>

          {error && (
            <div className="text-[10px] text-destructive uppercase tracking-widest animate-in fade-in slide-in-from-bottom-2">
              Error: {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-[10px] md:text-xs text-muted-foreground uppercase tracking-widest pt-4">
          <div className="flex flex-col gap-1">
            <span className="text-primary/50">Version:</span>
            <span>0.1.0-ALPHA</span>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="text-primary/50">Status:</span>
            <span className="text-primary">Ready</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 left-4 text-[10px] text-muted-foreground/30 font-mono">
        SECURE TERMINAL ACCESS // REDIS_CONNECTED
      </div>
    </main>
  );
}
