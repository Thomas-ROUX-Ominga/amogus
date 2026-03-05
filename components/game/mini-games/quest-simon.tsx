"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { QuestDuration } from "@/types/quest";
import { SIMON_SEQUENCE_LENGTH } from "@/lib/mini-games";
import { FailedOverlay } from "@/components/game/failed-overlay";

type SimonColor = "red" | "green" | "yellow" | "blue";
const COLORS: SimonColor[] = ["red", "green", "yellow", "blue"];

const COLOR_MAP: Record<SimonColor, { bg: string; active: string; shadow: string }> = {
    red: { bg: "bg-red-800", active: "bg-red-500", shadow: "shadow-[0_4px_0_0_#450a0a]" },
    green: { bg: "bg-green-800", active: "bg-green-500", shadow: "shadow-[0_4px_0_0_#052e16]" },
    yellow: { bg: "bg-yellow-700", active: "bg-yellow-400", shadow: "shadow-[0_4px_0_0_#422006]" },
    blue: { bg: "bg-blue-800", active: "bg-blue-500", shadow: "shadow-[0_4px_0_0_#172554]" },
};

interface QuestSimonProps {
    duration: QuestDuration;
    onSuccess: () => void;
    onError: () => void;
}

export function QuestSimon({ duration, onSuccess, onError }: QuestSimonProps) {
    const targetLength = SIMON_SEQUENCE_LENGTH[duration];
    
    const [fullSequence, setFullSequence] = useState<SimonColor[]>([]);
    const [currentStep, setCurrentStep] = useState(1); 
    const [userInputs, setUserInputs] = useState<SimonColor[]>([]);
    const [activeColor, setActiveColor] = useState<SimonColor | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showFailed, setShowFailed] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    
    // Generate a fresh sequence of targetLength
    const generateSequence = useCallback(() => {
        const seq: SimonColor[] = [];
        for (let i = 0; i < targetLength; i++) {
            seq.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
        }
        return seq;
    }, [targetLength]);

    // Initialize game
    useEffect(() => {
        setFullSequence(generateSequence());
        setCurrentStep(1);
    }, [generateSequence]);

    // Handle sequence playback
    const playSequence = useCallback(async () => {
        setIsPlaying(true);
        setUserInputs([]);
        
        // Brief pause before starting
        await new Promise(resolve => setTimeout(resolve, 500));
        
        for (let i = 0; i < currentStep; i++) {
            const color = fullSequence[i];
            setActiveColor(color);
            await new Promise(resolve => setTimeout(resolve, 400)); // Slightly slower playback for clarity
            setActiveColor(null);
            await new Promise(resolve => setTimeout(resolve, 200)); 
        }
        
        setIsPlaying(false);
    }, [fullSequence, currentStep]);

    // Play whenever we move to a new stage
    useEffect(() => {
        if (hasStarted && fullSequence.length > 0 && !showFailed) {
            playSequence();
        }
    }, [currentStep, fullSequence, showFailed, playSequence, hasStarted]);

    const handleStart = useCallback(() => {
        setHasStarted(true);
    }, []);

    const handleColorClick = useCallback((color: SimonColor) => {
        if (!hasStarted || isPlaying || showFailed) return;
        
        setActiveColor(color);
        setTimeout(() => setActiveColor(null), 150);
        
        const nextInputs = [...userInputs, color];
        setUserInputs(nextInputs);
        
        const stepIndex = nextInputs.length - 1;
        if (color !== fullSequence[stepIndex]) {
            setShowFailed(true);
            onError();
            return;
        }
        
        if (nextInputs.length === currentStep) {
            if (currentStep === targetLength) {
                onSuccess();
            } else {
                setTimeout(() => {
                    setCurrentStep(prev => prev + 1);
                }, 500);
            }
        }
    }, [isPlaying, showFailed, userInputs, fullSequence, currentStep, targetLength, onError, onSuccess, hasStarted]);

    const handleRetry = useCallback(() => {
        setShowFailed(false);
        setHasStarted(false); // Reset start state on retry to let player re-read
        setFullSequence(generateSequence());
        setCurrentStep(1);
        setUserInputs([]);
    }, [generateSequence]);

    return (
        <div className="flex flex-col items-center gap-8 py-4">
            {/* Status display */}
            <div className="text-center space-y-2">
                <p className="font-rajdhani text-sm uppercase tracking-[0.2em] text-primary/60">
                    Séquence : {currentStep} / {targetLength}
                </p>
                <h2 className="text-2xl font-bold font-orbitron text-primary tracking-wider min-h-[32px]">
                    {!hasStarted ? " " : (isPlaying ? "OBSERVEZ" : "À VOUS")}
                </h2>
            </div>

            {/* Simon Pads Container */}
            <div className="relative max-w-[300px] w-full aspect-square">
                <div className="grid grid-cols-2 gap-4 w-full h-full">
                    {COLORS.map((color) => {
                        const isActive = activeColor === color;
                        const config = COLOR_MAP[color];
                        
                        return (
                            <motion.button
                                key={color}
                                whileTap={{ scale: 0.95, y: 2 }}
                                onClick={() => handleColorClick(color)}
                                disabled={!hasStarted || isPlaying || showFailed}
                                className={`
                                    relative aspect-square rounded-2xl transition-all duration-150
                                    ${config.bg}
                                    ${config.shadow}
                                    ${isActive 
                                        ? `${config.active} brightness-150 scale-[1.02] shadow-none translate-y-1 z-10 opaciy-100` 
                                        : "opacity-40"
                                    }
                                    border-4 border-black/30
                                    flex items-center justify-center
                                `}
                                aria-label={`Bouton ${color}`}
                            >
                                {isActive && (
                                    <div className="absolute inset-0 rounded-2xl bg-white/30 animate-pulse blur-sm" />
                                )}
                            </motion.button>
                        );
                    })}
                </div>

                {/* Start Overlay Button */}
                <AnimatePresence>
                    {!hasStarted && (
                        <motion.button
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            onClick={handleStart}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-black/80 border-2 border-primary text-primary font-orbitron font-bold text-xl flex items-center justify-center z-20 shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)] active:scale-95 transition-transform"
                        >
                            GO
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            <p className="font-rajdhani text-xs text-foreground/50 text-center max-w-[240px] min-h-[32px]">
                {!hasStarted 
                    ? "Mémorisez la suite de couleurs et reproduisez-la sans faire d'erreur."
                    : (isPlaying 
                        ? "Mémorisez l'enchaînement des couleurs qui s'allument."
                        : "Reproduisez la séquence en cliquant sur les carrés.")
                }
            </p>


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
