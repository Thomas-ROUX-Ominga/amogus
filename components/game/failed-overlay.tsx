'use client';

import { useEffect } from 'react';
import { m } from 'framer-motion';
import { useTranslations } from "next-intl";

interface FailedOverlayProps {
  onAutoExit?: () => void;
  reducedMotion?: boolean;
  duration?: number;
}

export function FailedOverlay({ 
  onAutoExit, 
  reducedMotion = false, 
  duration = 2000
}: FailedOverlayProps) {
  const t = useTranslations();
  useEffect(() => {
    // Haptic feedback pattern for failure
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch {
        // Ignore vibration errors
      }
    }
  }, []);

  // Auto-dismiss after specified duration with background action
  useEffect(() => {
    if (duration > 0 && onAutoExit) {
      const redirectTimer = setTimeout(() => {
        onAutoExit();
      }, duration - 500); // Trigger action slightly before overlay fully unmounts

      return () => clearTimeout(redirectTimer);
    }
  }, [duration, onAutoExit]);

  const containerVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  };

  const glitchVariants = {
    animate: {
      x: [0, -2, 2, -1, 1, 0, -3, 3],
      y: [0, 1, -1, 2, -2, 0, 1, -1],
      filter: [
        "hue-rotate(0deg)",
        "hue-rotate(20deg)",
        "hue-rotate(-20deg)",
        "hue-rotate(0deg)",
        "blur(1px)",
        "blur(0px)",
      ],
      transition: {
        duration: 0.3,
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
          textShadow: [
            "2px 2px 0px rgba(255,0,0,0.8)",
            "-2px -2px 0px rgba(0,0,0,0.8)",
            "2px -2px 0px rgba(255,0,0,0.8)",
            "0 0 10px rgba(255,0,0,0.5)"
          ]
        },
        transition: { 
          duration: 0.5,
          textShadow: {
            repeat: Infinity,
            duration: 0.1
          }
        }
      };

  return (
    <m.div
      {...containerVariants}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm p-4 bg-red-900/40`}
    >
      <m.div
        {...textVariants}
        animate={reducedMotion ? textVariants.animate : { ...textVariants.animate, ...glitchVariants.animate }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-6xl font-orbitron font-bold tracking-wider text-[#DA3633]">
          {t("game.overlays.mission")}
          <br />
          {t("game.overlays.failed")}
        </h1>
      </m.div>

      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.2, 0] }}
        transition={{ duration: 0.1, repeat: Infinity }}
        className="absolute inset-0 pointer-events-none bg-white/5 mix-blend-overlay"
      />
    </m.div>
  );
}
