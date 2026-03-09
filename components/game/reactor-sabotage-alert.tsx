"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { GameState } from "@/types/game";

interface ReactorSabotageAlertProps {
    gameState: GameState;
}

function formatRemaining(ms: number): string {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ReactorSabotageAlert({ gameState }: ReactorSabotageAlertProps) {
    const t = useTranslations();
    const [now, setNow] = useState(Date.now());
    const reactorState = gameState.sabotageState?.active === "REACTOR"
        ? gameState.sabotageState?.reactor
        : null;

    useEffect(() => {
        if (!reactorState) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [reactorState?.endsAt]);

    if (!reactorState) return null;

    const scanned = reactorState.scannedByQrId.length;
    const remainingMs = Math.max(0, reactorState.endsAt - now);

    return (
        <div className="border-2 border-red-500/50 bg-red-950/40 p-4 animate-pulse">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-red-200">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-xs font-orbitron uppercase tracking-[0.2em]">
                        {t("game.sabotage.reactorAlertTitle")}
                    </span>
                </div>
                <span className="text-lg font-black text-red-100 font-orbitron">
                    {formatRemaining(remainingMs)}
                </span>
            </div>
            <div className="mt-2 text-sm text-red-100 font-rajdhani uppercase tracking-widest">
                {t("game.sabotage.reactorProgress", { scanned, total: 2 })}
            </div>
        </div>
    );
}
