"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/game-store";
import { useLocalUser } from "@/hooks/use-local-user";
import { MoveLeft } from "lucide-react";
import { JoinForm } from "@/components/game/join-form";

export default function LobbyPage() {
    const { id } = useParams();
    const router = useRouter();
    const { gameState, isLoading, error, fetchGame } = useGameStore();
    const { userId } = useLocalUser();

    useEffect(() => {
        if (id) {
            fetchGame(id as string);
        }
    }, [id, fetchGame]);

    // Check if the current user is already in the player list
    const isJoined = gameState?.players.some((p) => p.id === userId);

    if (isLoading || !userId) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-primary/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm animate-pulse">
                    <div className="text-primary text-center tracking-[0.2em] uppercase text-sm">
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
            <div className="max-w-2xl w-full border-2 border-primary/20 p-8 md:p-12 space-y-6 bg-black/50 backdrop-blur-sm shadow-[0_0_50px_rgba(var(--primary),0.05)]">
                <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                    <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                        {isJoined ? "Cockpit Terminal" : "Inbound Entry"}
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full animate-pulse ${isJoined ? 'bg-primary' : 'bg-yellow-500'}`} />
                        <span className="text-[10px] text-primary/80 tracking-widest">
                            {isJoined ? "SESSION_ACTIVE" : "PENDING_AUTH"}
                        </span>
                    </div>
                </div>

                <div className="space-y-4 py-8 min-h-[300px] flex items-center justify-center">
                    {!isJoined ? (
                        <JoinForm gameId={id as string} userId={userId} />
                    ) : (
                        <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-primary/5 p-6 border border-primary/10 rounded-sm">
                                <label className="text-[8px] text-primary/50 uppercase block mb-1 tracking-widest">
                                    Game Identifier
                                </label>
                                <div className="text-xl md:text-2xl font-black tracking-tight text-foreground break-all">
                                    {gameState?.id}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[8px] text-primary/50 uppercase block tracking-widest">
                                    Manifest: Crew Members ({gameState?.players.length})
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {gameState?.players.map((player) => (
                                        <div
                                            key={player.id}
                                            className={`p-3 border text-xs tracking-widest uppercase flex items-center justify-between ${player.id === userId
                                                ? 'border-primary bg-primary/10 text-primary font-bold'
                                                : 'border-white/10 bg-white/5 text-muted-foreground'
                                                }`}
                                        >
                                            <span>{player.name}</span>
                                            {player.id === userId && (
                                                <span className="text-[8px] opacity-50 px-2 py-0.5 border border-primary/50">YOU</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 border-l-4 border-primary/30 bg-primary/5 text-xs text-muted-foreground italic tracking-wide">
                                System ready. Waiting for commander to launch the mission...
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-4 flex justify-between items-center opacity-40">
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest">
                        SEC_ENC: AES-256-BMAD
                    </div>
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest">
                        EST_PING: 14MS
                    </div>
                </div>
            </div>
        </main>
    );
}
