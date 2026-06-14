"use client";

import { Shield, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { PlayerRole } from "@/types/game";

interface RoleBadgeProps {
    role: PlayerRole;
    variant?: "compact" | "full";
}

const ROLE_CONFIG = {
    CREWMATE: {
        colorClass: "text-role-crewmate",
        borderClass: "border-role-crewmate/20",
        bgClass: "bg-role-crewmate/5",
        labelKey: "game.roleBadge.crewmate",
        Icon: Users,
    },
    IMPOSTOR: {
        colorClass: "text-role-impostor",
        borderClass: "border-role-impostor/20",
        bgClass: "bg-role-impostor/5",
        labelKey: "game.roleBadge.impostor",
        Icon: Shield,
    },
} as const;

export function RoleBadge({ role, variant = "full" }: RoleBadgeProps) {
    const t = useTranslations();
    const config = ROLE_CONFIG[role];
    const { Icon, colorClass, borderClass, bgClass, labelKey } = config;

    if (variant === "compact") {
        return (
            <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${colorClass}`} />
                <span className={`text-xs font-bold uppercase tracking-wider font-orbitron ${colorClass}`}>
                    {t(labelKey)}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex items-center justify-center gap-4 p-8 border ${borderClass} ${bgClass}`}>
            <Icon className={`w-16 h-16 ${colorClass}`} />
            <div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-rajdhani">
                    {t("game.roleBadge.yourRole")}
                </div>
                <div className={`text-3xl font-black uppercase tracking-wider font-orbitron ${colorClass}`}>
                    {t(labelKey)}
                </div>
            </div>
        </div>
    );
}
