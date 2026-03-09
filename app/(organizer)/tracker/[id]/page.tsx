"use client";

import { useEffect, useState } from "react";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { useParams } from "next/navigation";
import { useGameStore } from "@/lib/store/game-store";
import { useAuth } from "@/hooks/use-auth";
import { useLocale, useTranslations } from "next-intl";
import { ErrorView } from "@/components/game/error-view";
import { PlayerList } from "@/components/admin/player-list";
import { ProgressBar } from "@/components/admin/progress-bar";
import { TrackerStats } from "@/components/admin/tracker-stats";
import { RefreshButton } from "@/components/admin/refresh-button";
import { AdminErrorBoundary } from "@/components/admin/error-boundary";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";

export default function AdminTrackerPage() {
    const t = useTranslations();
    const locale = useLocale();
    const { id } = useParams();
    const { gameState, isLoading, error, errorCode, fetchGame } = useGameStore();
    const { authState } = useAuth();
    const userId = authState.session?.userId;
    const [lastSyncTime] = useState<number | null>(null);

    const statusLabelMap: Record<string, string> = {
        LOBBY: t("common.status.lobby"),
        IN_PROGRESS: t("common.status.inProgress"),
        FINISHED: t("common.status.finished"),
    };

    useEffect(() => {
        if (id) {
            fetchGame(id as string);
        }
    }, [id, fetchGame]);

    if (isLoading || !userId) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-primary/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm animate-pulse">
                    <div className="text-primary text-center tracking-[0.2em] uppercase text-sm font-orbitron">
                        {t("admin.tracker.loadingUplink")}
                    </div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <ErrorView
                    title={
                        errorCode === ERROR_CODES.GAME_NOT_FOUND
                            ? t("game.lobby.sessionDecommissioned")
                            : t("admin.tracker.adminSignalInterrupted")
                    }
                    message={getLocalizedErrorMessage({
                        t,
                        code: errorCode || undefined,
                        fallback: error,
                    })}
                    code={errorCode || "ERR_ADMIN_SIG"}
                    onRetry={() => {
                        if (id) fetchGame(id as string);
                    }}
                />
            </main>
        );
    }

    // Admin access control: only game creator can access tracker
    if (gameState && gameState.creatorId && gameState.creatorId !== userId) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <ErrorView
                    title={t("admin.tracker.accessDenied")}
                    message={t("admin.tracker.accessDeniedMessage")}
                    code="ERR_ADMIN_ACCESS"
                    onRetry={() => {
                        window.location.href = `/game/${id}`;
                    }}
                />
            </main>
        );
    }

    if (!gameState) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-2xl w-full border-2 border-destructive/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm">
                    <div className="text-destructive text-center tracking-[0.2em] uppercase text-sm font-orbitron">
                        {t("admin.tracker.gameDataNotFound")}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <AdminErrorBoundary gameId={id as string}>
            <main className="flex min-h-screen flex-col bg-background text-foreground font-mono p-4">
            <div className="max-w-6xl w-full mx-auto space-y-6">
                {/* Header */}
                <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm shadow-[0_0_50px_rgba(var(--primary),0.05)]">
                    <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                        <div className="flex items-center gap-4">
                            <Link 
                                href={`/game/${id}`}
                                className="p-2 border border-primary/20 hover:border-primary/40 transition-colors flex items-center gap-2 text-primary/80 hover:text-primary"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="text-xs uppercase tracking-widest">{t("admin.tracker.return")}</span>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                                    {t("admin.tracker.title")}
                                </h1>
                                <div className="text-[10px] text-primary/50 tracking-widest mt-1">
                                    {t("admin.tracker.gameLabel", { gameId: gameState.id })}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <RefreshButton gameId={id as string} />
                            <span className={`w-2 h-2 rounded-full animate-pulse ${
                                gameState.status === "IN_PROGRESS" ? 'bg-green-500' : 
                                gameState.status === "LOBBY" ? 'bg-yellow-500' : 
                                'bg-red-500'
                            }`} />
                            <span className="text-[10px] text-primary/80 tracking-widest">
                                {statusLabelMap[gameState.status] || gameState.status}
                            </span>
                        </div>
                    </div>
                    {lastSyncTime && (
                        <div className="text-[8px] text-primary/40 tracking-widest text-right">
                            {t("admin.dashboard.refresh")}: {new Date(lastSyncTime).toLocaleTimeString(locale, {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                            })}
                        </div>
                    )}
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Player List */}
                    <div className="lg:col-span-2">
                        <PlayerList players={gameState.players} currentUserId={userId} />
                    </div>

                    {/* Stats Sidebar */}
                    <div className="space-y-6">
                        <TrackerStats gameState={gameState} />
                        <ProgressBar gameState={gameState} />
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-primary/10 pt-4 flex justify-between items-center opacity-40">
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest">
                        {t("admin.tracker.footerTerminal")}
                    </div>
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest">
                        {t("admin.tracker.footerEncryption")}
                    </div>
                </div>
            </div>
        </main>
        </AdminErrorBoundary>
    );
}
