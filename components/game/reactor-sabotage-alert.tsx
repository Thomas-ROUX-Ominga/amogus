"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
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
    const [now, setNow] = useState(() => Date.now());
    const reactorState = gameState.sabotageState?.active === "REACTOR"
        ? gameState.sabotageState?.reactor
        : null;
    const isPaused = typeof reactorState?.pausedRemainingMs === "number";

    useEffect(() => {
        if (!reactorState || isPaused) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [reactorState?.endsAt, isPaused]);

    if (!reactorState) return null;

    const scanned = reactorState.scannedByQrId.length;
    const remainingMs = isPaused
        ? Math.max(0, reactorState.pausedRemainingMs ?? 0)
        : Math.max(0, reactorState.endsAt - now);
    const reactorLocations = [
        {
            label: t("game.sabotage.locationReactorA"),
            location:
                gameState.sabotages?.reactor[0]?.location?.trim() ||
                t("game.sabotage.locationUnknown"),
            isDisarmed: Boolean(
                gameState.sabotages?.reactor[0]?.qrId &&
                reactorState.scannedByQrId.includes(gameState.sabotages.reactor[0].qrId),
            ),
        },
        {
            label: t("game.sabotage.locationReactorB"),
            location:
                gameState.sabotages?.reactor[1]?.location?.trim() ||
                t("game.sabotage.locationUnknown"),
            isDisarmed: Boolean(
                gameState.sabotages?.reactor[1]?.qrId &&
                reactorState.scannedByQrId.includes(gameState.sabotages.reactor[1].qrId),
            ),
        },
    ];

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
                {t("game.sabotage.reactorProgress", {
                    scanned: String(scanned),
                    total: String(2),
                })}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {reactorLocations.map((reactorLocation) => {
                    const StatusIcon = reactorLocation.isDisarmed ? CheckCircle2 : CircleAlert;
                    const statusLabel = reactorLocation.isDisarmed
                        ? t("game.sabotage.reactorLocationDisarmed")
                        : t("game.sabotage.reactorLocationPending");

                    return (
                        <div
                            key={reactorLocation.label}
                            className={`rounded-md border p-3 font-rajdhani uppercase tracking-widest ${
                                reactorLocation.isDisarmed
                                    ? "border-emerald-400/50 bg-emerald-950/30 text-emerald-100"
                                    : "border-red-300/35 bg-red-950/50 text-red-100"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[11px] font-bold">
                                        {reactorLocation.label}
                                    </div>
                                    <div className="mt-1 text-sm tracking-[0.16em] text-current/90">
                                        {reactorLocation.location}
                                    </div>
                                </div>
                                <div
                                    className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 border px-2 py-1 text-[10px] font-bold ${
                                        reactorLocation.isDisarmed
                                            ? "border-emerald-300/50 bg-emerald-500/15"
                                            : "border-red-200/40 bg-red-500/15"
                                    }`}
                                >
                                    <StatusIcon className="h-3.5 w-3.5" />
                                    <span>{statusLabel}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
