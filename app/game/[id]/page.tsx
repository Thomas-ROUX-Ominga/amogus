"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/game-store";
import { MoveLeft } from "lucide-react";

export default function LobbyPage() {
    const { id } = useParams();
    const router = useRouter();
    const { gameState, isLoading, error, fetchGame } = useGameStore();

    useEffect(() => {
        if (id) {
            fetchGame(id as string);
        }
    }, [id, fetchGame]);

    if (isLoading) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-primary/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm animate-pulse">
                    <div className="text-primary text-center tracking-[0.2em] uppercase">
                        Establishing Uplink...
                    </div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-destructive/20 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm">
                    <div className="text-destructive font-black text-xl uppercase tracking-tighter">
                        Critical Error: System Failure
                    </div>
                    <div className="p-4 bg-destructive/5 border-l-4 border-destructive text-muted-foreground text-sm italic">
                        {error}
                    </div>
                    <button
                        onClick={() => router.push("/")}
                        className="flex items-center gap-2 text-xs text-primary hover:underline uppercase tracking-widest pt-4"
                    >
                        <MoveLeft size={14} /> Back to Terminal Home
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
            <div className="max-w-2xl w-full border-2 border-primary/20 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                    <h1 className="text-xl font-bold uppercase tracking-widest text-primary">
                        Lobby Module
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] text-primary">LIVE_CONNECTION</span>
                    </div>
                </div>

                <div className="space-y-4 py-8">
                    <div className="bg-primary/5 p-6 border border-primary/10 rounded-sm">
                        <label className="text-[10px] text-primary/50 uppercase block mb-1">
                            Game Identifier
                        </label>
                        <div className="text-xl md:text-2xl font-black tracking-tight text-foreground break-all">
                            {gameState?.id}
                        </div>
                    </div>

                    <div className="p-4 border-l-4 border-primary/30 bg-primary/5 text-sm text-muted-foreground italic">
                        Waiting for more players to join the cockpit... (Status: {gameState?.status})
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <div className="text-[10px] text-muted-foreground uppercase">
                        ID_VERIFIED // SESSION_ACTIVE
                    </div>
                </div>
            </div>
        </main>
    );
}
