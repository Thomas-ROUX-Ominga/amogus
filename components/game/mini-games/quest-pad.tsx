"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { QuestDuration } from "@/types/quest";
import { PAD_SEQUENCE_LENGTH } from "@/lib/mini-games";
import { FailedOverlay } from "@/components/game/failed-overlay";

const PAD_SIZE = 9;
const PLAYBACK_PRE_DELAY_MS = 500;
const PLAYBACK_ON_MS = 350;
const PLAYBACK_OFF_MS = 180;
const STEP_TRANSITION_MS = 450;
const PRESS_FEEDBACK_MS = 130;

function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface QuestPadProps {
    duration: QuestDuration;
    onSuccess: () => void;
    onError: () => void;
}

export function QuestPad({ duration, onSuccess, onError }: QuestPadProps) {
    const targetLength = PAD_SEQUENCE_LENGTH[duration];
    const cellIndexes = useMemo(() => Array.from({ length: PAD_SIZE }, (_, i) => i), []);
    const progressIndexes = useMemo(() => Array.from({ length: targetLength }, (_, i) => i), [targetLength]);

    const generateSequence = useCallback((length: number) => {
        const sequence: number[] = [];
        for (let i = 0; i < length; i++) {
            sequence.push(Math.floor(Math.random() * PAD_SIZE));
        }
        return sequence;
    }, []);

    const [fullSequence, setFullSequence] = useState<number[]>(() => generateSequence(targetLength));
    const [currentStep, setCurrentStep] = useState(1);
    const [userInputs, setUserInputs] = useState<number[]>([]);
    const [activeCell, setActiveCell] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showFailed, setShowFailed] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const completedSeriesCount = hasStarted ? Math.max(0, currentStep - 1) : 0;

    const playSequence = useCallback(async () => {
        setIsPlaying(true);
        setUserInputs([]);

        await sleep(PLAYBACK_PRE_DELAY_MS);

        for (let i = 0; i < currentStep; i++) {
            const cell = fullSequence[i];
            setActiveCell(cell);
            await sleep(PLAYBACK_ON_MS);
            setActiveCell(null);
            await sleep(PLAYBACK_OFF_MS);
        }

        setIsPlaying(false);
    }, [currentStep, fullSequence]);

    useEffect(() => {
        if (hasStarted && fullSequence.length > 0 && !showFailed) {
            playSequence();
        }
    }, [hasStarted, fullSequence, showFailed, playSequence, currentStep]);

    const handleStart = useCallback(() => {
        setHasStarted(true);
    }, []);

    const handlePadPress = useCallback(
        (cellIndex: number) => {
            if (!hasStarted || isPlaying || showFailed) return;

            setActiveCell(cellIndex);
            setTimeout(() => {
                setActiveCell((prev) => (prev === cellIndex ? null : prev));
            }, PRESS_FEEDBACK_MS);

            const nextInputs = [...userInputs, cellIndex];
            setUserInputs(nextInputs);

            const stepIndex = nextInputs.length - 1;
            if (cellIndex !== fullSequence[stepIndex]) {
                setShowFailed(true);
                onError();
                return;
            }

            if (nextInputs.length === currentStep) {
                if (currentStep === targetLength) {
                    onSuccess();
                } else {
                    setTimeout(() => {
                        setCurrentStep((prev) => prev + 1);
                    }, STEP_TRANSITION_MS);
                }
            }
        },
        [hasStarted, isPlaying, showFailed, userInputs, fullSequence, currentStep, targetLength, onError, onSuccess]
    );

    const handleRetry = useCallback(() => {
        setShowFailed(false);
        setHasStarted(false);
        setFullSequence(generateSequence(targetLength));
        setCurrentStep(1);
        setUserInputs([]);
        setActiveCell(null);
        setIsPlaying(false);
    }, [generateSequence, targetLength]);

    return (
        <div className="space-y-3 sm:space-y-4">
            <div className="text-center space-y-1">
                <p className="font-rajdhani text-sm uppercase tracking-[0.2em] text-primary/60">
                    Série : {currentStep} / {targetLength}
                </p>
                <h2 className="text-lg sm:text-2xl font-bold font-orbitron text-primary tracking-wider min-h-[30px]">
                    {!hasStarted ? " " : isPlaying ? "OBSERVEZ" : "À VOUS"}
                </h2>
            </div>

            <p className="font-rajdhani text-xs text-foreground/55 text-center max-w-[340px] mx-auto min-h-[28px] sm:min-h-[32px]">
                {!hasStarted
                    ? "Mémorisez la séquence affichée sur l'écran de gauche."
                    : isPlaying
                        ? "Regardez les cases s'allumer une à une."
                        : "Reproduisez la séquence sur le pad 3x3."}
            </p>

            <div
                className="items-start gap-2 sm:gap-4"
                style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}
            >
                <div className="min-w-0 border border-slate-500/45 bg-[linear-gradient(145deg,#82878f,#6f757f_45%,#5e646f)] p-2 sm:p-4">
                    <div className="mb-2 sm:mb-3 flex items-center gap-1 sm:gap-2">
                        {progressIndexes.map((progressId) => (
                            <span
                                key={`left-led-${progressId}`}
                                className={`h-3 w-3 sm:h-4 sm:w-4 rounded-full border border-black/40 ${
                                    progressId < completedSeriesCount
                                        ? "bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.9)]"
                                        : "bg-zinc-900"
                                }`}
                            />
                        ))}
                    </div>

                    <div className="border-2 border-slate-200/60 bg-black aspect-square w-full max-w-[180px] sm:max-w-[220px] mx-auto p-2 sm:p-3">
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 h-full">
                            {cellIndexes.map((cellId) => (
                                <div
                                    key={`screen-cell-${cellId}`}
                                    data-testid={`pad-screen-cell-${cellId}`}
                                    className={`border border-transparent rounded-sm transition-colors ${
                                        activeCell === cellId ? "bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.7)]" : "bg-black"
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="min-w-0 border border-slate-500/45 bg-[linear-gradient(145deg,#8b8f96,#757b84_45%,#646b76)] p-2 sm:p-4">
                    <div className="mb-2 sm:mb-3 flex items-center gap-1 sm:gap-2">
                        {progressIndexes.map((progressId) => (
                            <span
                                key={`right-led-${progressId}`}
                                className={`h-3 w-3 sm:h-4 sm:w-4 rounded-full border border-black/40 ${
                                    progressId < completedSeriesCount
                                        ? "bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.9)]"
                                        : "bg-zinc-900"
                                }`}
                            />
                        ))}
                    </div>

                    <div className="relative w-full max-w-[180px] sm:max-w-[220px] mx-auto">
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                            {cellIndexes.map((cellId) => {
                                const pressed = !isPlaying && activeCell === cellId;
                                return (
                                    <button
                                        key={`pad-key-${cellId}`}
                                        type="button"
                                        onClick={() => handlePadPress(cellId)}
                                        disabled={!hasStarted || isPlaying || showFailed}
                                        data-testid={`pad-key-${cellId}`}
                                        aria-label={`Touche pad ${cellId + 1}`}
                                        className={`aspect-square rounded-md border-2 transition-all ${
                                            pressed
                                                ? "bg-sky-400 border-sky-200/80 shadow-[inset_0_0_10px_rgba(0,0,0,0.45)] translate-y-[1px]"
                                                : "bg-zinc-500 border-zinc-700 hover:bg-zinc-400"
                                        } disabled:opacity-70 disabled:cursor-not-allowed`}
                                    />
                                );
                            })}
                        </div>

                        <AnimatePresence>
                            {!hasStarted && (
                                <button
                                    onClick={handleStart}
                                    className="absolute inset-0 m-auto h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-black/85 border-2 border-primary text-primary font-orbitron font-bold text-base tracking-wider shadow-[0_0_20px_rgba(var(--primary-rgb),0.45)] active:scale-95 transition-transform z-10"
                                >
                                    GO
                                </button>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showFailed && (
                    <FailedOverlay
                        onAutoExit={handleRetry}
                        reducedMotion={false}
                        duration={2000}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
