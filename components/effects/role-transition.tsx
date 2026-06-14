"use client";

import { m, AnimatePresence } from "framer-motion";
import { Shield, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { PlayerRole } from "@/types/game";

interface RoleTransitionProps {
    role: PlayerRole;
    gameId: string;
    onComplete: () => void;
}

export function RoleTransition({ role, gameId, onComplete }: RoleTransitionProps) {
    const [phase, setPhase] = useState<"badge" | "scanning" | "fade">("badge");

    const roleColor = role === "CREWMATE" ? "#2DA44E" : "#DA3633";
    const RoleIcon = role === "CREWMATE" ? Users : Shield;
    const roleLabel = role === "CREWMATE" ? "CREWMATE" : "IMPOSTOR";

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (prefersReducedMotion) {
            const timer = setTimeout(() => onComplete(), 300);
            return () => clearTimeout(timer);
        }

        const startAt = Date.now();
        const timer = setInterval(() => {
            const elapsed = Date.now() - startAt;
            const nextPhase = elapsed >= 1500 ? "fade" : elapsed >= 500 ? "scanning" : "badge";

            setPhase((prev) => (prev === nextPhase ? prev : nextPhase));

            if (elapsed >= 2000) {
                clearInterval(timer);
                onComplete();
            }
        }, 50);

        return () => {
            clearInterval(timer);
        };
    }, [gameId, onComplete]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
            <AnimatePresence mode="wait">
                {phase === "badge" && (
                    <m.div
                        key="badge"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.1, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center gap-6"
                    >
                        <m.div
                            initial={{ rotate: 0 }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, ease: "easeInOut" }}
                            className="w-32 h-32 rounded-full border-4 flex items-center justify-center"
                            style={{ 
                                borderColor: roleColor,
                                backgroundColor: `${roleColor}15`,
                                boxShadow: `0 0 30px ${roleColor}40`
                            }}
                        >
                            <RoleIcon className="w-16 h-16" style={{ color: roleColor }} />
                        </m.div>
                        <m.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-3xl font-black uppercase tracking-[0.2em] font-orbitron"
                            style={{ color: roleColor }}
                        >
                            {roleLabel}
                        </m.div>
                    </m.div>
                )}

                {phase === "scanning" && (
                    <m.div
                        key="scanning"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="relative w-full h-full flex items-center justify-center"
                    >
                        <div className="absolute inset-0 overflow-hidden">
                            {[0, 20, 40, 60, 80].map((lineTop, lineIndex) => (
                                <m.div
                                    key={`scan-line-${lineTop}`}
                                    initial={{ y: "-100%" }}
                                    animate={{ y: "200%" }}
                                    transition={{
                                        duration: 1,
                                        delay: lineIndex * 0.1,
                                        repeat: 1,
                                        ease: "linear"
                                    }}
                                    className="absolute left-0 right-0 h-1"
                                    style={{
                                        background: `linear-gradient(to bottom, transparent, ${roleColor}80, transparent)`,
                                        top: `${lineTop}%`
                                    }}
                                />
                            ))}
                        </div>

                        <m.div
                            initial={{ scale: 1 }}
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 1, repeat: 1 }}
                            className="relative z-10 flex flex-col items-center gap-6"
                        >
                            <div 
                                className="w-32 h-32 rounded-full border-4 flex items-center justify-center"
                                style={{ 
                                    borderColor: roleColor,
                                    backgroundColor: `${roleColor}15`,
                                    boxShadow: `0 0 40px ${roleColor}60`
                                }}
                            >
                                <RoleIcon className="w-16 h-16" style={{ color: roleColor }} />
                            </div>
                            <div 
                                className="text-3xl font-black uppercase tracking-[0.2em] font-orbitron"
                                style={{ color: roleColor }}
                            >
                                {roleLabel}
                            </div>
                            <m.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ duration: 1, repeat: 1 }}
                                className="text-xs uppercase tracking-widest font-rajdhani"
                                style={{ color: `${roleColor}80` }}
                            >
                                Scanning... Vérification en cours
                            </m.div>
                        </m.div>
                    </m.div>
                )}

                {phase === "fade" && (
                    <m.div
                        key="fade"
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center gap-6"
                    >
                        <div 
                            className="w-32 h-32 rounded-full border-4 flex items-center justify-center"
                            style={{ 
                                borderColor: roleColor,
                                backgroundColor: `${roleColor}15`
                            }}
                        >
                            <RoleIcon className="w-16 h-16" style={{ color: roleColor }} />
                        </div>
                        <div 
                            className="text-3xl font-black uppercase tracking-[0.2em] font-orbitron"
                            style={{ color: roleColor }}
                        >
                            {roleLabel}
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
}
