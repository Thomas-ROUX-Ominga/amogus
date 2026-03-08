"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { QuestDuration } from "@/types/quest";
import { FailedOverlay } from "@/components/game/failed-overlay";
import { RINGS_COUNT_BY_DURATION, RINGS_TOLERANCE_DEG } from "@/lib/mini-games";

interface RingState {
    id: string;
    angle: number;
    speed: number; // deg/sec
    colorHex: string;
    completed: boolean;
}

const RING_COLORS = [
    { hex: "#facc15" },
    { hex: "#3b82f6" },
    { hex: "#67e8f9" },
    { hex: "#ec4899" },
    { hex: "#f97316" },
] as const;

const INDICATOR_ANGLE = 0;
const INDICATOR_SWEEP_DEG = 36; // 1/10th of the ring
const RING_SIZE = 68;
const RING_CENTER = RING_SIZE / 2;
const RUNNER_RADIUS = 30;
const RING_STROKE_WIDTH = 7;

function angleDistance(a: number, b: number) {
    const diff = Math.abs(((a - b + 540) % 360) - 180);
    return diff;
}

function angleToCartesian(angleDeg: number, radius: number) {
    const theta = (angleDeg * Math.PI) / 180;
    return {
        x: RING_CENTER + Math.cos(theta) * radius,
        y: RING_CENTER + Math.sin(theta) * radius,
    };
}

function describeArc(
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number
) {
    const startTheta = (endAngle * Math.PI) / 180;
    const endTheta = (startAngle * Math.PI) / 180;
    const start = {
        x: cx + Math.cos(startTheta) * radius,
        y: cy + Math.sin(startTheta) * radius,
    };
    const end = {
        x: cx + Math.cos(endTheta) * radius,
        y: cy + Math.sin(endTheta) * radius,
    };
    const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function createRings(duration: QuestDuration): RingState[] {
    const count = RINGS_COUNT_BY_DURATION[duration];
    return Array.from({ length: count }, (_, index) => ({
        id: `ring-${index}`,
        angle: Math.floor(Math.random() * 360),
        speed: 120 + Math.random() * 70,
        colorHex: RING_COLORS[index].hex,
        completed: false,
    }));
}

interface QuestRingsProps {
    duration: QuestDuration;
    onSuccess: () => void;
    onError: () => void;
}

export function QuestRings({ duration, onSuccess, onError }: QuestRingsProps) {
    const totalRings = RINGS_COUNT_BY_DURATION[duration];
    const [rings, setRings] = useState<RingState[]>(() => createRings(duration));
    const [currentRingIndex, setCurrentRingIndex] = useState(0);
    const [showFailed, setShowFailed] = useState(false);
    const [completed, setCompleted] = useState(false);
    const lastTsRef = useRef<number | null>(null);

    useEffect(() => {
        setRings(createRings(duration));
        setCurrentRingIndex(0);
        setShowFailed(false);
        setCompleted(false);
        lastTsRef.current = null;
    }, [duration]);

    useEffect(() => {
        if (showFailed || completed || currentRingIndex >= totalRings) return;

        let rafId = 0;
        const tick = (ts: number) => {
            const prevTs = lastTsRef.current ?? ts;
            const deltaSec = (ts - prevTs) / 1000;
            lastTsRef.current = ts;

            setRings((prev) =>
                prev.map((ring, index) =>
                    index === currentRingIndex
                        ? { ...ring, angle: (ring.angle + ring.speed * deltaSec) % 360 }
                        : ring
                )
            );
            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(rafId);
    }, [currentRingIndex, showFailed, completed, totalRings]);

    const handleFailReset = useCallback(() => {
        setShowFailed(false);
        setRings(createRings(duration));
        setCurrentRingIndex(0);
        setCompleted(false);
        lastTsRef.current = null;
    }, [duration]);

    const handleStop = useCallback(
        (index: number) => {
            if (index !== currentRingIndex || showFailed || completed) return;

            const ring = rings[index];
            if (!ring) return;
            const aligned = angleDistance(ring.angle, INDICATOR_ANGLE) <= RINGS_TOLERANCE_DEG;

            if (!aligned) {
                onError();
                setShowFailed(true);
                return;
            }

            setRings((prev) =>
                prev.map((entry, i) => (i === index ? { ...entry, completed: true } : entry))
            );

            const nextIndex = index + 1;
            if (nextIndex >= totalRings) {
                setCompleted(true);
                onSuccess();
            } else {
                setCurrentRingIndex(nextIndex);
            }
        },
        [currentRingIndex, showFailed, completed, rings, totalRings, onError, onSuccess]
    );

    const activeDisplayIndex = Math.min(currentRingIndex + 1, totalRings);

    const ringIndexes = useMemo(() => Array.from({ length: totalRings }, (_, i) => i), [totalRings]);

    return (
        <div className="space-y-4">
            <div className="text-center space-y-1">
                <p className="font-rajdhani text-sm uppercase tracking-[0.2em] text-primary/70">
                    Alignez les bagues dans l&apos;ordre
                </p>
                <p className="font-rajdhani text-xs text-foreground/70" aria-live="polite">
                    Anneau : {activeDisplayIndex}/{totalRings}
                </p>
            </div>

            <div className="border border-primary/20 bg-black/40 backdrop-blur-sm p-3">
                <div className="relative border border-primary/20 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(244,114,182,0.1),transparent_35%),linear-gradient(155deg,#05070d,#090f1a_55%,#03060c)] p-3 sm:p-4 overflow-hidden">
                    <div className="max-w-[520px] mx-auto space-y-2.5">
                        {ringIndexes.map((index) => {
                            const ring = rings[index];
                            if (!ring) return null;
                            const isActive = index === currentRingIndex && !showFailed && !completed;
                            const runnerPosition = angleToCartesian(ring.angle, RUNNER_RADIUS);
                            const indicatorStart = INDICATOR_ANGLE - INDICATOR_SWEEP_DEG / 2;
                            const indicatorEnd = INDICATOR_ANGLE + INDICATOR_SWEEP_DEG / 2;
                            const indicatorArc = describeArc(
                                RING_CENTER,
                                RING_CENTER,
                                RUNNER_RADIUS,
                                indicatorStart,
                                indicatorEnd
                            );

                            return (
                                <div
                                    key={ring.id}
                                    className="grid grid-cols-[1fr_auto] items-center gap-3 min-h-[74px]"
                                    data-testid={`ring-row-${index}`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="relative w-[68px] h-[68px] shrink-0">
                                            <div
                                                className={`absolute inset-0 rounded-full border-[7px] ${
                                                    ring.completed ? "border-[#2DA44E]" : "border-white/0"
                                                }`}
                                                style={{
                                                    borderColor: ring.completed ? "#2DA44E" : ring.colorHex,
                                                    boxShadow: ring.completed
                                                        ? "0 0 14px rgba(45,164,78,0.55)"
                                                        : `0 0 10px ${ring.colorHex}55`,
                                                }}
                                            />
                                            <div className="absolute inset-[8px] rounded-full border border-primary/20 bg-gradient-to-b from-zinc-300 to-zinc-500" />
                                            <div className="absolute inset-0 flex items-center justify-center text-3xl font-light font-[family-name:var(--font-jetbrains-mono)] text-zinc-900/90">
                                                {index + 1}
                                            </div>
                                            <svg
                                                className="absolute inset-0 z-20 pointer-events-none"
                                                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                                                aria-hidden="true"
                                            >
                                                <path
                                                    d={indicatorArc}
                                                    fill="none"
                                                    stroke="rgba(255,255,255,0.9)"
                                                    strokeWidth={RING_STROKE_WIDTH}
                                                    strokeLinecap="round"
                                                />
                                            </svg>

                                            <div
                                                className="absolute w-[10px] h-[10px] rounded-full border border-black/60 bg-zinc-950 z-30"
                                                style={{
                                                    left: `${runnerPosition.x}px`,
                                                    top: `${runnerPosition.y}px`,
                                                    transform: "translate(-50%, -50%)",
                                                    boxShadow: `0 0 5px ${ring.colorHex}`,
                                                }}
                                                data-testid={`ring-runner-${index}`}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleStop(index)}
                                        disabled={!isActive}
                                        data-testid={`ring-stop-${index}`}
                                        aria-label={`Stop anneau ${index + 1}`}
                                        className={`w-24 min-h-[36px] border text-xs uppercase tracking-widest font-rajdhani transition-colors ${
                                            isActive
                                                ? "border-primary/70 bg-primary/20 text-primary hover:bg-primary/25 shadow-[0_0_10px_rgba(56,189,248,0.2)]"
                                                : "border-primary/25 bg-black/25 text-foreground/35 cursor-not-allowed"
                                        }`}
                                    >
                                        STOP
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showFailed && (
                    <FailedOverlay onAutoExit={handleFailReset} reducedMotion={false} duration={2000} />
                )}
            </AnimatePresence>
        </div>
    );
}
