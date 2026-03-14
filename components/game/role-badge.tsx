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
        color: "#2DA44E",
        labelKey: "game.roleBadge.crewmate",
        Icon: Users,
    },
    IMPOSTOR: {
        color: "#DA3633",
        labelKey: "game.roleBadge.impostor",
        Icon: Shield,
    },
} as const;

export function RoleBadge({ role, variant = "full" }: RoleBadgeProps) {
    const t = useTranslations();
    const config = ROLE_CONFIG[role];
    const { Icon, color, labelKey } = config;

    if (variant === "compact") {
        return (
            <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color }} />
                <span
                    className="text-xs font-bold uppercase tracking-wider font-orbitron"
                    style={{ color }}
                >
                    {t(labelKey)}
                </span>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center gap-4 p-8 border border-primary/20 bg-primary/5">
            <Icon className="w-16 h-16" style={{ color }} />
            <div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-rajdhani">
                    {t("game.roleBadge.yourRole")}
                </div>
                <div
                    className="text-3xl font-black uppercase tracking-wider font-orbitron"
                    style={{ color }}
                >
                    {t(labelKey)}
                </div>
            </div>
        </div>
    );
}
