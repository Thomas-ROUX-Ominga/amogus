"use client";

import { motion } from "framer-motion";
import { Shield } from "lucide-react";

export function RoleSelection() {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full space-y-6 text-center"
        >
            <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full border-2 border-primary/30 flex items-center justify-center bg-primary/5 animate-pulse">
                    <Shield className="text-primary w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
                    Role Assignment
                </h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed px-4">
                    Mission launched. Awaiting role distribution protocol...
                </p>
            </div>

            <div className="p-6 border border-primary/20 bg-primary/5">
                <div className="text-xs text-primary/60 uppercase tracking-widest animate-pulse">
                    Initializing role selection module...
                </div>
            </div>

            <div className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">
                Module: ROLE_SELECT // Status: PENDING_IMPL
            </div>
        </motion.div>
    );
}
