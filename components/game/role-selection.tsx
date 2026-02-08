"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Shield, Users } from "lucide-react";
import { useGameStore } from "@/lib/store/game-store";
import { useLocalUser } from "@/hooks/use-local-user";
import { PlayerRole } from "@/types/game";

interface RoleSelectionProps {
    gameId: string;
    onRoleSelected?: () => void;
}

export function RoleSelection({ gameId, onRoleSelected }: RoleSelectionProps) {
    const { chooseRole, isSelectingRole, roleError } = useGameStore();
    const { userId } = useLocalUser();
    const lastAttemptedRole = useRef<PlayerRole | null>(null);

    const handleRoleSelect = async (role: PlayerRole) => {
        if (!userId) return;
        lastAttemptedRole.current = role;

        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        const success = await chooseRole(gameId, userId, role);
        if (success && onRoleSelected) {
            onRoleSelected();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md mx-auto space-y-8 px-4"
        >
            <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full border-2 border-[#58A6FF]/30 flex items-center justify-center bg-[#58A6FF]/5 animate-pulse">
                    <Shield className="text-[#58A6FF] w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-[0.2em] text-[#58A6FF] font-orbitron">
                    Choisissez votre rôle
                </h2>
                <p className="text-xs text-[#8B949E] uppercase tracking-widest leading-relaxed font-rajdhani">
                    Sélectionnez votre rôle pour accéder au cockpit
                </p>
            </div>

            <div className="space-y-4">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleRoleSelect("CREWMATE")}
                    disabled={isSelectingRole}
                    className="w-full min-h-[120px] p-6 border-2 border-[#2DA44E] bg-[#2DA44E]/10 hover:bg-[#2DA44E]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex flex-col items-center justify-center gap-3 group"
                    style={{ minWidth: '44px', minHeight: '120px' }}
                >
                    <Users className="w-12 h-12 text-[#2DA44E] group-hover:scale-110 transition-transform" />
                    <div className="text-center">
                        <div className="text-2xl font-black uppercase tracking-wider text-[#2DA44E] font-rajdhani">
                            Crewmate
                        </div>
                        <div className="text-xs text-[#2DA44E]/70 uppercase tracking-widest mt-1 font-rajdhani">
                            Membre d&apos;équipage
                        </div>
                    </div>
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleRoleSelect("IMPOSTOR")}
                    disabled={isSelectingRole}
                    className="w-full min-h-[120px] p-6 border-2 border-[#DA3633] bg-[#DA3633]/10 hover:bg-[#DA3633]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex flex-col items-center justify-center gap-3 group"
                    style={{ minWidth: '44px', minHeight: '120px' }}
                >
                    <Shield className="w-12 h-12 text-[#DA3633] group-hover:scale-110 transition-transform" />
                    <div className="text-center">
                        <div className="text-2xl font-black uppercase tracking-wider text-[#DA3633] font-rajdhani">
                            Imposteur
                        </div>
                        <div className="text-xs text-[#DA3633]/70 uppercase tracking-widest mt-1 font-rajdhani">
                            Agent infiltré
                        </div>
                    </div>
                </motion.button>
            </div>

            {isSelectingRole && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 border border-[#58A6FF]/20 bg-[#58A6FF]/5 text-center"
                >
                    <div className="text-xs text-[#58A6FF] uppercase tracking-widest animate-pulse font-rajdhani">
                        Attribution du rôle en cours...
                    </div>
                </motion.div>
            )}

            {roleError && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 border border-[#DA3633]/50 bg-[#DA3633]/10"
                >
                    <div className="text-sm text-[#DA3633] font-rajdhani">
                        {roleError}
                    </div>
                    <button
                        onClick={() => {
                            useGameStore.setState({ roleError: null });
                            if (lastAttemptedRole.current) {
                                handleRoleSelect(lastAttemptedRole.current);
                            }
                        }}
                        className="mt-2 text-xs text-[#DA3633]/70 uppercase tracking-widest hover:text-[#DA3633] transition-colors font-rajdhani"
                    >
                        Réessayer
                    </button>
                </motion.div>
            )}

            <div className="text-[8px] text-[#8B949E]/40 uppercase tracking-widest text-center font-rajdhani">
                Module: ROLE_SELECT // Status: ACTIVE
            </div>
        </motion.div>
    );
}
