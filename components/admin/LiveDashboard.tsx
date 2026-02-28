"use client";

import useSWR from "swr";
import { useState } from "react";
import { ArrowLeft, RefreshCw, Users, Target, TrendingUp, Clock, Skull } from "lucide-react";
import { GameState } from "@/types/game";
import { getDashboardData, DashboardData, eliminatePlayer } from "@/app/(organizer)/dashboard/actions";
import { SimpleProgressBar } from "./simple-progress-bar";

interface LiveDashboardProps {
  gameId: string;
  onGameChange: () => void;
}

const DASHBOARD_REFRESH_INTERVAL = Number(process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL) || 2000;

const fetcher = async (gameId: string): Promise<DashboardData> => {
  const result = await getDashboardData(gameId);
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to fetch game data");
  }
  return result.data;
};

export function LiveDashboard({ gameId, onGameChange }: LiveDashboardProps) {
  const [eliminatingPlayer, setEliminatingPlayer] = useState<string | null>(null);
  
  const {
    data: dashboardData,
    error,
    isLoading,
    mutate,
  } = useSWR(gameId, fetcher, {
    refreshInterval: DASHBOARD_REFRESH_INTERVAL,
    revalidateOnFocus: false,
    errorRetryCount: 3,
  });

  const handleEliminatePlayer = async (playerId: string) => {
    setEliminatingPlayer(playerId);
    try {
      const result = await eliminatePlayer(gameId, playerId);
      if (result.success) {
        // Refresh data to show the updated player status
        mutate();
      } else {
        console.error("Failed to eliminate player:", result.error);
        // TODO: Show error notification to user
      }
    } catch (error) {
      console.error("Error eliminating player:", error);
    } finally {
      setEliminatingPlayer(null);
    }
  };

  if (error) {
    return (
      <div className="border-2 border-red-500/20 p-8 bg-black/50 backdrop-blur-sm">
        <div className="text-center space-y-4">
          <div className="text-red-400 text-sm">Failed to load game data</div>
          <div className="text-red-300 text-xs font-mono">{error.message}</div>
          <button
            onClick={() => mutate()}
            className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors text-xs uppercase tracking-widest"
          >
            Retry
          </button>
          <button
            onClick={onGameChange}
            className="px-4 py-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors text-xs uppercase tracking-widest"
          >
            Select Different Game
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !dashboardData) {
    return (
      <div className="border-2 border-primary/20 p-8 bg-black/50 backdrop-blur-sm">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
          <div className="text-primary text-sm">Loading game data...</div>
        </div>
      </div>
    );
  }

  const { gameState, stats } = dashboardData;
  const overallProgress = stats.totalQuestsAssigned > 0 
    ? (stats.totalQuestsCompleted / stats.totalQuestsAssigned) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header with game info and controls */}
      <div className="flex items-center justify-between border-b border-primary/20 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onGameChange}
            className="p-2 border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-primary font-orbitron">
              Game: {gameState.id}
            </h2>
            <div className="flex items-center gap-4 text-[10px] text-primary/50 tracking-widest mt-1">
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {new Date(gameState.createdAt).toLocaleTimeString()}
              </span>
              <span className="flex items-center gap-1">
                <Users size={10} />
                {gameState.players.length} Players
              </span>
              <span className="px-2 py-1 bg-primary/10 border border-primary/30 rounded text-primary">
                {gameState.status}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest text-primary/70 hover:text-primary border border-primary/30 hover:border-primary/50 transition-all rounded-none"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall Progress */}
        <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary font-orbitron">
              Progression Globale
            </h3>
            <Target className="text-primary/50 w-4 h-4" />
          </div>
          <div className="space-y-3">
            <div className="text-2xl font-black text-primary">
              {stats.totalQuestsCompleted} / {stats.totalQuestsAssigned}
            </div>
            <div className="text-xs text-primary/50 tracking-widest uppercase">
              Quests Completed
            </div>
            <SimpleProgressBar progress={overallProgress} />
            <div className="text-lg font-bold text-primary">
              {overallProgress.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Format Breakdown */}
        <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
              Progress by Format
            </h3>
            <TrendingUp className="text-primary/50 w-4 h-4" />
          </div>
          <div className="space-y-3">
            {/* Short */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-green-400">Short</span>
                <span className="text-green-400/70">
                  {stats.progressByFormat.short.completed} / {stats.progressByFormat.short.assigned}
                </span>
              </div>
              <SimpleProgressBar 
                progress={
                  stats.progressByFormat.short.assigned > 0
                    ? (stats.progressByFormat.short.completed / stats.progressByFormat.short.assigned) * 100
                    : 0
                } 
                variant="green"
              />
            </div>
            {/* Medium */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-yellow-400">Medium</span>
                <span className="text-yellow-400/70">
                  {stats.progressByFormat.medium.completed} / {stats.progressByFormat.medium.assigned}
                </span>
              </div>
              <SimpleProgressBar 
                progress={
                  stats.progressByFormat.medium.assigned > 0
                    ? (stats.progressByFormat.medium.completed / stats.progressByFormat.medium.assigned) * 100
                    : 0
                } 
                variant="yellow"
              />
            </div>
            {/* Long */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-red-400">Long</span>
                <span className="text-red-400/70">
                  {stats.progressByFormat.long.completed} / {stats.progressByFormat.long.assigned}
                </span>
              </div>
              <SimpleProgressBar 
                progress={
                  stats.progressByFormat.long.assigned > 0
                    ? (stats.progressByFormat.long.completed / stats.progressByFormat.long.assigned) * 100
                    : 0
                } 
                variant="red"
              />
            </div>
          </div>
        </div>

        {/* Active Players Summary */}
        <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
              Crew Status
            </h3>
            <Users className="text-primary/50 w-4 h-4" />
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-lg font-bold text-green-400">
                  {stats.playerProgress.filter(p => p.isAlive).length}
                </div>
                <div className="text-[8px] text-green-400/50 tracking-widest uppercase">
                  Active
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-400">
                  {stats.playerProgress.filter(p => !p.isAlive).length}
                </div>
                <div className="text-[8px] text-red-400/50 tracking-widest uppercase">
                  Eliminated
                </div>
              </div>
            </div>
            <div className="text-xs text-primary/50">
              Average Progress:{" "}
              <span className="text-primary font-bold">
                {stats.playerProgress.length > 0
                  ? (stats.playerProgress.reduce((sum, p) => sum + p.percentage, 0) / stats.playerProgress.length).toFixed(1)
                  : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Player Progress */}
      <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
            Individual Progress
          </h3>
          <div className="text-[10px] text-primary/50 tracking-widest">
            LIVE DATA
          </div>
        </div>
        <div className="space-y-3">
          {stats.playerProgress.map((player) => (
            <div
              key={player.id}
              className={`p-4 border transition-all duration-300 ${
                player.isAlive 
                  ? "border-primary/20 bg-black/30" 
                  : "border-red-500/40 bg-red-900/20 shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    player.isAlive ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)] animate-pulse" : "bg-red-500"
                  }`} />
                  <span className={`font-mono text-sm uppercase tracking-wider ${
                    player.isAlive ? "text-primary" : "text-red-400 font-bold"
                  }`}>
                    {player.name}
                  </span>
                  {player.role && (
                    <span className={`text-[8px] px-2 py-1 rounded font-bold tracking-tighter ${
                      player.role === "IMPOSTOR" 
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    }`}>
                      {player.role}
                    </span>
                  )}
                  {!player.isAlive && (
                    <span className="flex items-center gap-1 text-[8px] px-2 py-1 bg-red-500 text-white font-bold rounded animate-in fade-in slide-in-from-left-1">
                      <Skull size={8} />
                      ÉLIMINÉ
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`text-lg font-bold ${player.isAlive ? "text-primary" : "text-red-400"}`}>
                      {player.completed} / {player.assigned}
                    </div>
                    <div className="text-[8px] text-primary/50 tracking-widest uppercase">
                      {player.percentage.toFixed(1)}%
                    </div>
                  </div>
                  {player.isAlive && (
                    <button
                      onClick={() => handleEliminatePlayer(player.id)}
                      disabled={eliminatingPlayer === player.id}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                      title="Eliminate Player"
                    >
                      {eliminatingPlayer === player.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Skull className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <SimpleProgressBar 
                progress={player.percentage} 
                variant={player.isAlive ? "default" : "red"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
