"use client";

import { useRef, useState } from "react";
import { Shield, Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { LiveDashboard } from "@/components/admin/LiveDashboard";

interface DashboardPageProps {
  searchParams: { gameId?: string };
}

export default function DashboardPage({ searchParams }: DashboardPageProps) {
  const t = useTranslations();
  const gameInputRef = useRef<HTMLInputElement>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(
    searchParams.gameId || null
  );

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-primary/20 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded border border-primary/30 flex items-center justify-center bg-primary/10">
              <Shield className="text-primary w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
                {t("admin.dashboard.title")}
              </h1>
              <p className="text-[10px] text-primary/50 tracking-widest mt-1">
                {t("admin.dashboard.subtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Game Selection */}
        {!selectedGameId ? (
          <div className="border-2 border-primary/20 p-8 bg-black/50 backdrop-blur-sm">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded border border-primary/30 flex items-center justify-center bg-primary/10 mx-auto">
                <Activity className="text-primary w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-primary">
                {t("admin.dashboard.selectSessionTitle")}
              </h2>
              <p className="text-sm text-primary/70">
                {t("admin.dashboard.selectSessionDescription")}
              </p>
              <div className="max-w-md mx-auto">
                <input
                  ref={gameInputRef}
                  type="text"
                  placeholder={t("admin.dashboard.selectSessionPlaceholder")}
                  className="w-full px-4 py-3 bg-black/50 border border-primary/30 text-primary placeholder:text-primary/30 font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      const value = (e.target as HTMLInputElement).value.trim();
                      if (value) {
                        setSelectedGameId(value);
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const value = gameInputRef.current?.value.trim();
                    if (value) {
                      setSelectedGameId(value);
                    }
                  }}
                  className="w-full mt-3 px-4 py-3 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 transition-all font-mono text-sm uppercase tracking-widest"
                >
                  {t("admin.dashboard.monitorGame")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <LiveDashboard
            gameId={selectedGameId}
            onGameChange={() => setSelectedGameId(null)}
          />
        )}
      </div>
    </div>
  );
}
