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
        <div className="border-2 border-role-impostor/50 bg-role-impostor/10 p-3 sm:p-4 animate-pulse">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-role-impostor/80">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-xs font-orbitron uppercase tracking-[0.2em]">
                        {t("game.sabotage.reactorAlertTitle")}
                    </span>
                </div>
                <span
                    className="text-base sm:text-lg font-black text-role-impostor font-orbitron"
                    aria-live="assertive"
                    aria-atomic="true"
                >
                    {formatRemaining(remainingMs)}
                </span>
            </div>
            <div className="mt-1.5 text-xs sm:text-sm text-role-impostor/90 font-rajdhani uppercase tracking-widest">
                {t("game.sabotage.reactorProgress", {
                    scanned: String(scanned),
                    total: String(2),
                })}
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {reactorLocations.map((reactorLocation) => {
                    const StatusIcon = reactorLocation.isDisarmed ? CheckCircle2 : CircleAlert;
                    const statusLabel = reactorLocation.isDisarmed
                        ? t("game.sabotage.reactorLocationDisarmed")
                        : t("game.sabotage.reactorLocationPending");

                    return (
                        <div
                            key={reactorLocation.label}
                            className={`flex min-h-10 items-center justify-between gap-2 border px-2.5 py-1.5 font-rajdhani uppercase tracking-[0.12em] ${
                                reactorLocation.isDisarmed
                                    ? "border-role-crewmate/50 bg-role-crewmate/10 text-role-crewmate"
                                    : "border-role-impostor/35 bg-role-impostor/10 text-role-impostor/90"
                            }`}
                        >
                            <div className="flex min-w-0 items-baseline gap-2">
                                <span className="shrink-0 text-[10px] font-bold">
                                    {reactorLocation.label}
                                </span>
                                <span className="truncate text-xs text-current/85">
                                    {reactorLocation.location}
                                </span>
                            </div>
                            <div
                                aria-label={statusLabel}
                                title={statusLabel}
                                className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 border px-1.5 min-[430px]:px-2 py-1 text-[10px] font-bold ${
                                    reactorLocation.isDisarmed
                                        ? "border-role-crewmate/50 bg-role-crewmate/10"
                                        : "border-role-impostor/40 bg-role-impostor/10"
                                }`}
                            >
                                <StatusIcon className="h-3.5 w-3.5" />
                                <span className="sr-only min-[430px]:not-sr-only">
                                    {statusLabel}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
