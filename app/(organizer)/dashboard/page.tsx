"use client";

import { useState } from "react";
import { Shield, Activity } from "lucide-react";
import { LiveDashboard } from "@/components/admin/LiveDashboard";

interface DashboardPageProps {
  searchParams: { gameId?: string };
}

export default function DashboardPage({ searchParams }: DashboardPageProps) {
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
                Live Dashboard
              </h1>
              <p className="text-[10px] text-primary/50 tracking-widest mt-1">
                Real-time mission control and crew progress tracking
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
                Select Game Session
              </h2>
              <p className="text-sm text-primary/70">
                Enter a game code to monitor live progress and crew statistics
              </p>
              <div className="max-w-md mx-auto">
                <input
                  type="text"
                  placeholder="Enter game code (e.g., ABC123)"
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
                    const input = document.querySelector(
                      "input[placeholder='Enter game code (e.g., ABC123)']"
                    ) as HTMLInputElement;
                    const value = input?.value.trim();
                    if (value) {
                      setSelectedGameId(value);
                    }
                  }}
                  className="w-full mt-3 px-4 py-3 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 transition-all font-mono text-sm uppercase tracking-widest"
                >
                  Monitor Game
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
