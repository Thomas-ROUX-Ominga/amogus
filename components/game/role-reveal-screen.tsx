"use client";

import { useEffect } from "react";
import { m, useReducedMotion } from "framer-motion";
import { ShieldAlert, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { PlayerRole } from "@/types/game";

interface RoleRevealScreenProps {
  role: PlayerRole;
  onComplete: () => void;
}

const ROLE_CONFIG = {
  CREWMATE: {
    color: "#2DA44E",
    glow: "0 0 55px rgba(45,164,78,0.55)",
    Icon: Users,
    labelKey: "game.roleBadge.crewmate",
    subtitleKey: "game.roleReveal.crewmateSubtitle",
  },
  IMPOSTOR: {
    color: "#DA3633",
    glow: "0 0 65px rgba(218,54,51,0.65)",
    Icon: ShieldAlert,
    labelKey: "game.roleBadge.impostor",
    subtitleKey: "game.roleReveal.impostorSubtitle",
  },
} as const;

export function RoleRevealScreen({ role, onComplete }: RoleRevealScreenProps) {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();
  const config = ROLE_CONFIG[role];
  const { Icon, color, glow, labelKey, subtitleKey } = config;

  useEffect(() => {
    const timeout = globalThis.setTimeout(onComplete, 2400);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(role === "IMPOSTOR" ? [120, 60, 120] : [60, 40, 60]);
      }
    } catch {
      // no-op
    }

    return () => globalThis.clearTimeout(timeout);
  }, [onComplete, role]);

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black">
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.9, 1] }}
        transition={{ duration: 0.85, times: [0, 0.35, 0.7, 1] }}
        className="absolute inset-0"
        style={{
          background:
            role === "IMPOSTOR"
              ? "radial-gradient(circle at center, rgba(218,54,51,0.2) 0%, rgba(0,0,0,0.96) 72%)"
              : "radial-gradient(circle at center, rgba(45,164,78,0.22) 0%, rgba(0,0,0,0.96) 72%)",
        }}
      />

      <div className="absolute inset-0 pointer-events-none opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[length:100%_4px]" />

      {!prefersReducedMotion && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <m.div
            className="absolute left-0 right-0 h-[28vh]"
            style={{
              background: `linear-gradient(to top, transparent 0%, ${color}00 20%, ${color}22 45%, ${color}80 50%, ${color}22 55%, ${color}00 80%, transparent 100%)`,
              filter: "blur(1.5px)",
            }}
            initial={{ y: "110%" }}
            animate={{ y: ["110%", "-130%"] }}
            transition={{ duration: 1.45, repeat: 1, ease: "linear" }}
          />
          <m.div
            className="absolute left-0 right-0 h-px"
            style={{ background: color, boxShadow: `0 0 16px ${color}` }}
            initial={{ y: "100%" }}
            animate={{ y: ["100%", "-10%"] }}
            transition={{ duration: 1.45, repeat: 1, ease: "linear" }}
          />
        </div>
      )}

      <m.div
        initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.9, y: prefersReducedMotion ? 0 : 10 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0.15 : 0.55 }}
        className="relative z-10 w-full max-w-3xl px-4 sm:px-5 text-center"
      >
        <m.div
          animate={prefersReducedMotion ? {} : { opacity: [1, 0.78, 1, 0.88, 1] }}
          transition={{ duration: 1.1, repeat: Infinity }}
          className="relative inline-flex items-center justify-center w-40 h-40 sm:w-48 sm:h-48 border-4 rounded-full mb-8"
          style={{ borderColor: color, boxShadow: glow, backgroundColor: `${color}14` }}
        >
          <div className="absolute inset-[12px] rounded-full border" style={{ borderColor: `${color}55` }} />
          <Icon className="w-20 h-20 sm:w-24 sm:h-24" style={{ color }} />
        </m.div>

        <div className="mb-3 px-2 text-xs uppercase tracking-wider text-muted-foreground font-rajdhani">
          {t("game.roleReveal.assigned")}
        </div>

        <m.h1
          animate={prefersReducedMotion ? {} : { opacity: [1, 0.76, 1] }}
          transition={{ duration: 0.75, repeat: Infinity }}
          className="mx-auto max-w-[92vw] text-[clamp(1.9rem,11.5vw,4.5rem)] leading-[0.95] font-black uppercase tracking-[0.06em] sm:tracking-[0.18em] font-orbitron break-words"
          style={{ color, textShadow: glow }}
        >
          {t(labelKey)}
        </m.h1>

        <p className="mt-4 px-2 text-xs sm:text-sm uppercase tracking-wider text-foreground/80 font-rajdhani">
          {t(subtitleKey)}
        </p>

        <div className={`mt-8 px-2 text-xs uppercase tracking-wider text-foreground/65 ${prefersReducedMotion ? "" : "animate-pulse"}`}>
          {t("game.roleReveal.enteringCockpit")}
        </div>
      </m.div>
    </div>
  );
}
