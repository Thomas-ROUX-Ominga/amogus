"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { QuestDuration } from "@/types/quest";
import {
    GAUGE_ALIGNMENT_TOLERANCE_PERCENT,
    GAUGES_COUNT_BY_DURATION,
} from "@/lib/mini-games";

interface GaugeState {
    id: string;
    label: string;
    colorClass: string;
    target: number;
    value: number;
}

const GAUGE_LABELS = ["CO2", "NUTRI", "RAD", "WATER", "TEMP", "PH"] as const;
const GAUGE_COLORS = [
    "from-yellow-300 to-yellow-500",
    "from-green-300 to-green-500",
    "from-red-300 to-red-500",
    "from-blue-300 to-blue-500",
    "from-cyan-300 to-cyan-500",
    "from-purple-300 to-purple-500",
] as const;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function createGauges(duration: QuestDuration): GaugeState[] {
    const count = GAUGES_COUNT_BY_DURATION[duration];

    return Array.from({ length: count }, (_, index) => ({
        id: `gauge-${index}`,
        label: GAUGE_LABELS[index],
        colorClass: GAUGE_COLORS[index],
        target: Math.round(15 + Math.random() * 70),
        value: 0,
    }));
}

interface QuestGaugesProps {
    duration: QuestDuration;
    onSuccess: () => void;
    onError: () => void;
}

export function QuestGauges({ duration, onSuccess, onError }: QuestGaugesProps) {
    // No failure state for this mini-game.
    void onError;

    const [gauges, setGauges] = useState<GaugeState[]>(() => createGauges(duration));
    const [activeGaugeIndex, setActiveGaugeIndex] = useState<number | null>(null);
    const [isCompleted, setIsCompleted] = useState(false);
    const boardRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setGauges(createGauges(duration));
        setActiveGaugeIndex(null);
        setIsCompleted(false);
    }, [duration]);

    const alignedCount = useMemo(
        () =>
            gauges.filter(
                (gauge) => Math.abs(gauge.value - gauge.target) <= GAUGE_ALIGNMENT_TOLERANCE_PERCENT
            ).length,
        [gauges]
    );

    const updateGaugeFromPointer = useCallback((index: number, clientY: number) => {
        const track = boardRef.current?.querySelector<HTMLElement>(`[data-track-index="${index}"]`);
        if (!track) return;

        const rect = track.getBoundingClientRect();
        if (!rect.height) return;

        const ratioFromBottom = (rect.bottom - clientY) / rect.height;
        const nextValue = clamp(Math.round(ratioFromBottom * 100), 0, 100);

        setGauges((prev) =>
            prev.map((gauge, gaugeIndex) =>
                gaugeIndex === index ? { ...gauge, value: nextValue } : gauge
            )
        );
    }, []);

    const handlePointerDown = useCallback(
        (index: number, event: PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            setActiveGaugeIndex(index);
            updateGaugeFromPointer(index, event.clientY);
        },
        [updateGaugeFromPointer]
    );

    const handleBoardPointerMove = useCallback(
        (event: PointerEvent<HTMLDivElement>) => {
            if (activeGaugeIndex === null || isCompleted) return;
            updateGaugeFromPointer(activeGaugeIndex, event.clientY);
        },
        [activeGaugeIndex, isCompleted, updateGaugeFromPointer]
    );

    const handleBoardPointerUp = useCallback(() => {
        setActiveGaugeIndex(null);
    }, []);

    useEffect(() => {
        if (!isCompleted && gauges.length > 0 && alignedCount === gauges.length) {
            setIsCompleted(true);
            onSuccess();
        }
    }, [isCompleted, gauges.length, alignedCount, onSuccess]);

    return (
        <div className="space-y-4">
            <div className="text-center space-y-1">
                <p className="font-rajdhani text-sm uppercase tracking-[0.2em] text-primary/70">
                    Alignez les curseurs sur chaque trait
                </p>
                <p className="font-rajdhani text-xs text-foreground/70" aria-live="polite">
                    Jauges alignées : {alignedCount}/{gauges.length}
                </p>
            </div>

            <div
                ref={boardRef}
                className="relative border border-slate-500/40 bg-[linear-gradient(145deg,#1b2230,#121824_52%,#0e141f)] p-3 sm:p-4 touch-none select-none overflow-hidden"
                onPointerMove={handleBoardPointerMove}
                onPointerUp={handleBoardPointerUp}
                onPointerLeave={handleBoardPointerUp}
                data-testid="gauges-board"
            >
                <div
                    className="grid gap-2 sm:gap-3"
                    style={{ gridTemplateColumns: `repeat(${gauges.length}, minmax(0, 1fr))` }}
                >
                    {gauges.map((gauge, index) => {
                        const isAligned =
                            Math.abs(gauge.value - gauge.target) <= GAUGE_ALIGNMENT_TOLERANCE_PERCENT;
                        const isNear =
                            Math.abs(gauge.value - gauge.target) <= GAUGE_ALIGNMENT_TOLERANCE_PERCENT * 3;

                        return (
                            <div
                                key={gauge.id}
                                className={`border bg-slate-700/25 p-1.5 sm:p-2 ${
                                    isAligned
                                        ? "border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                                        : "border-slate-300/25"
                                }`}
                                data-testid="gauge-unit"
                            >
                                <div
                                    className="relative h-40 sm:h-44 w-full border border-slate-300/25 bg-slate-200/10 overflow-hidden"
                                    data-track-index={index}
                                    data-testid={`gauge-track-${index}`}
                                    onPointerDown={(event) => handlePointerDown(index, event)}
                                >
                                    <div
                                        className={`absolute inset-x-2 bottom-0 bg-gradient-to-t ${gauge.colorClass} transition-[height] duration-75`}
                                        style={{ height: `${gauge.value}%` }}
                                        data-testid={`gauge-fill-${index}`}
                                    />

                                    <div
                                        className="absolute inset-x-0 h-[3px] bg-white/95 border-y border-slate-800/20"
                                        style={{ bottom: `${gauge.target}%` }}
                                        data-target={gauge.target}
                                        aria-hidden="true"
                                    />

                                    <div
                                        className={`absolute left-1/2 -translate-x-1/2 w-[86%] h-4 border border-slate-900/45 bg-gradient-to-b from-slate-200 to-slate-500 ${
                                            isNear ? "ring-2 ring-white/60" : ""
                                        }`}
                                        style={{ bottom: `${clamp(gauge.value - 2, 0, 98)}%` }}
                                        onPointerDown={(event) => handlePointerDown(index, event)}
                                        data-testid={`gauge-handle-${index}`}
                                    >
                                        <div className="absolute inset-x-2 top-1/2 h-[2px] -translate-y-1/2 bg-slate-700/70" />
                                    </div>
                                </div>

                                <div className="mt-1.5 border border-slate-300/25 bg-slate-900/45 text-center text-[10px] font-bold tracking-wide font-[family-name:var(--font-jetbrains-mono)] text-slate-100">
                                    {gauge.label}
                                </div>

                                <div className="sr-only" aria-live="polite">
                                    Jauge {index + 1}, niveau actuel {gauge.value} pourcent.
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
