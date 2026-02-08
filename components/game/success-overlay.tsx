'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface SuccessOverlayProps {
  onManualExit: () => void;
  reducedMotion?: boolean;
}

export function SuccessOverlay({ onManualExit, reducedMotion = false }: SuccessOverlayProps) {
  useEffect(() => {
    // Haptic feedback pattern: [50, 50, 50, 50, 200]
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([50, 50, 50, 50, 200]);
      } catch {
        // Ignore vibration errors
      }
    }
  }, []);

  const containerVariants = reducedMotion 
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

  const textVariants = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { 
        initial: { scale: 0.8, opacity: 0 },
        animate: { 
          scale: 1, 
          opacity: 1,
          textShadow: [
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
            duration: 0.2
          }
        }
      };

  return (
    <motion.div
      {...containerVariants}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4"
    >
      <motion.div
        {...textVariants}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-6xl font-orbitron font-bold text-green-500 tracking-wider">
          MISSION
          <br />
          ACCOMPLIE
        </h1>
      </motion.div>

      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { y: 50, opacity: 0 }}
        animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <button 
          onClick={onManualExit}
          className="flex items-center gap-2 px-6 py-3 border-2 border-green-500/50 text-green-500 hover:bg-green-500/10 rounded font-rajdhani font-bold uppercase tracking-wider transition-colors"
        >
          <X size={18} />
          Retour au Cockpit
        </button>
      </motion.div>
    </motion.div>
  );
}
