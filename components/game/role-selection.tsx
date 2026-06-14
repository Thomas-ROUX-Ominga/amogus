"use client";

import { useRef } from "react";
import { m } from "framer-motion";
import { Shield, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGameStore } from "@/lib/store/game-store";
import { useAuth } from "@/hooks/use-auth";
import { PlayerRole } from "@/types/game";

interface RoleSelectionProps {
    gameId: string;
    onRoleSelected?: () => void;
}

export function RoleSelection({ gameId, onRoleSelected }: RoleSelectionProps) {
    const t = useTranslations();
    const { chooseRole, isSelectingRole, roleError } = useGameStore();
    const { authState } = useAuth();
    const userId = authState.session?.userId;
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
        <m.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md mx-auto space-y-8 px-4"
        >
            <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full border-2 border-primary/30 flex items-center justify-center bg-primary/5 animate-pulse">
                    <Shield className="text-primary w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
                    {t("game.roleSelection.title")}
                </h2>
                <p className="text-xs text-muted-foreground uppercase tracking-widest leading-relaxed font-rajdhani">
                    {t("game.roleSelection.subtitle")}
                </p>
            </div>

            <div className="space-y-4">
                <m.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleRoleSelect("CREWMATE")}
                    disabled={isSelectingRole}
                    className="w-full min-h-[120px] p-6 border-2 border-role-crewmate bg-role-crewmate/10 hover:bg-role-crewmate/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex flex-col items-center justify-center gap-3 group"
                >
                    <Users className="w-12 h-12 text-role-crewmate group-hover:scale-110 transition-transform" />
                    <div className="text-center">
                        <div className="text-2xl font-black uppercase tracking-wider text-role-crewmate font-rajdhani">
                            {t("game.roleSelection.crewmate")}
                        </div>
                        <div className="text-xs text-role-crewmate/70 uppercase tracking-widest mt-1 font-rajdhani">
                            {t("game.roleSelection.crewmateDescription")}
                        </div>
                    </div>
                </m.button>

                <m.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleRoleSelect("IMPOSTOR")}
                    disabled={isSelectingRole}
                    className="w-full min-h-[120px] p-6 border-2 border-role-impostor bg-role-impostor/10 hover:bg-role-impostor/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex flex-col items-center justify-center gap-3 group"
                >
                    <Shield className="w-12 h-12 text-role-impostor group-hover:scale-110 transition-transform" />
                    <div className="text-center">
                        <div className="text-2xl font-black uppercase tracking-wider text-role-impostor font-rajdhani">
                            {t("game.roleSelection.impostor")}
                        </div>
                        <div className="text-xs text-role-impostor/70 uppercase tracking-widest mt-1 font-rajdhani">
                            {t("game.roleSelection.impostorDescription")}
                        </div>
                    </div>
                </m.button>
            </div>

            {isSelectingRole && (
                <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 border border-primary/20 bg-primary/5 text-center"
                >
                    <div className="text-xs text-primary uppercase tracking-widest animate-pulse font-rajdhani">
                        {t("game.roleSelection.assigning")}
                    </div>
                </m.div>
            )}

            {roleError && (
                <m.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 border border-role-impostor/50 bg-role-impostor/10"
                >
                    <div className="text-sm text-role-impostor font-rajdhani">
                        {roleError}
                    </div>
                    <button
                        onClick={() => {
                            useGameStore.setState({ roleError: null });
                            if (lastAttemptedRole.current) {
                                handleRoleSelect(lastAttemptedRole.current);
                            }
                        }}
                        className="mt-2 text-xs text-role-impostor/70 uppercase tracking-widest hover:text-role-impostor transition-colors font-rajdhani"
                    >
                        {t("game.roleSelection.retry")}
                    </button>
                </m.div>
            )}

            <div className="text-[8px] text-muted-foreground/40 uppercase tracking-widest text-center font-rajdhani">
                {t("game.roleSelection.moduleStatus")}
            </div>
        </m.div>
    );
}
