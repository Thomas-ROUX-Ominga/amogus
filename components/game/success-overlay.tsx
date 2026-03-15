'use client';

import { useEffect } from 'react';
import { m } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslations } from "next-intl";

interface SuccessOverlayProps {
  onManualExit: () => void;
  onAutoExit?: () => void;
  reducedMotion?: boolean;
  isImpostor?: boolean;
  duration?: number;
  allowManualExit?: boolean;
}

export function SuccessOverlay({ 
  onManualExit, 
  onAutoExit, 
  reducedMotion = false, 
  isImpostor = false, 
  duration = 2000,
  allowManualExit = true
}: SuccessOverlayProps) {
  const t = useTranslations();
  useEffect(() => {
    // Haptic feedback pattern
    // Crewmate: [50, 50, 50, 50, 200]
    // Impostor: [50, 30, 100, 30, 250, 50, 150] (Glitchy)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        const pattern = isImpostor 
          ? [50, 30, 100, 30, 250, 50, 150]
          : [50, 50, 50, 50, 200];
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibration errors
      }
    }
  }, [isImpostor]);

  // Auto-dismiss after specified duration with background redirect
  useEffect(() => {
    if (duration > 0 && onAutoExit) {
      // Start background redirect at 1500ms to complete by 2000ms overlay duration
      const redirectTimer = setTimeout(() => {
        if (onAutoExit) {
          onAutoExit();
        }
      }, duration - 500); // Start 500ms before overlay ends

      return () => clearTimeout(redirectTimer);
    }
  }, [duration, onAutoExit]);

  const containerVariants = reducedMotion 
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

  const glitchVariants = {
    animate: {
      x: [0, -2, 2, -1, 1, 0],
      y: [0, 1, -1, 2, -2, 0],
      filter: [
        "hue-rotate(0deg)",
        "hue-rotate(50deg)",
        "hue-rotate(-50deg)",
        "hue-rotate(0deg)",
      ],
      transition: {
        duration: 0.2,
        repeat: Infinity,
        repeatType: "mirror" as const,
      }
    }
  };

  const textVariants = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { 
        initial: { scale: 0.8, opacity: 0 },
        animate: { 
          scale: 1, 
          opacity: 1,
          textShadow: isImpostor
            ? [
                "2px 2px 0px rgba(255,0,0,0.8)",
                "-2px -2px 0px rgba(0,0,0,0.8)",
                "2px -2px 0px rgba(255,0,0,0.8)",
                "0 0 10px rgba(255,0,0,0.5)"
              ]
            : [
                "0 0 10px rgba(0,255,0,0.5)",
                "2px 2px 0px rgba(255,0,255,0.5)",
                "-2px -2px 0px rgba(0,255,255,0.5)",
                "0 0 10px rgba(0,255,0,0.5)"
              ]
        },
        transition: { 
          duration: 0.5,
          textShadow: {
            repeat: Infinity,
            duration: isImpostor ? 0.1 : 0.2
          }
        }
      };

  return (
    <m.div
      {...containerVariants}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm p-4 ${
        isImpostor ? 'bg-red-900/40' : 'bg-black/90'
      }`}
    >
      <m.div
        {...textVariants}
        animate={isImpostor ? { ...textVariants.animate, ...glitchVariants.animate } : textVariants.animate}
        className="text-center mb-12"
      >
        <h1 className={`text-4xl md:text-6xl font-orbitron font-bold tracking-wider ${
          isImpostor ? 'text-[#DA3633]' : 'text-green-500'
        }`}>
          {t("game.overlays.mission")}
          <br />
          {t("game.overlays.accomplished")}
        </h1>
      </m.div>

      <m.div
        initial={reducedMotion ? { opacity: 0 } : { y: 50, opacity: 0 }}
        animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {allowManualExit && (
          <button 
            onClick={onManualExit}
            className={`flex items-center gap-2 px-6 py-3 border-2 rounded font-rajdhani font-bold uppercase tracking-wider transition-colors ${
              isImpostor 
                ? 'border-[#DA3633]/50 text-[#DA3633] hover:bg-[#DA3633]/10' 
                : 'border-green-500/50 text-green-500 hover:bg-green-500/10'
            }`}
          >
            <X size={18} />
            {t("game.overlays.returnToCockpit")}
          </button>
        )}
      </m.div>

      {isImpostor && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.2, 0] }}
          transition={{ duration: 0.1, repeat: Infinity }}
          className="absolute inset-0 pointer-events-none bg-white/5 mix-blend-overlay"
        />
      )}
    </m.div>
  );
}
