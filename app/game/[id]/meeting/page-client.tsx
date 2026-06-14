"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Skull } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { useGameStore, useRealTimeGamePolling } from "@/lib/store/game-store";
import { ErrorView } from "@/components/game/error-view";
import { ReactorSabotageAlert } from "@/components/game/reactor-sabotage-alert";
import { GameOverScreen } from "@/components/game/game-over-screen";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";

function formatRemaining(ms: number): string {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function VoteSkulls({ votes, id }: { votes: number; id: string }) {
    const skullCount = Math.min(votes, 6);
    const extraSkulls = votes > 6 ? votes - 6 : 0;

    return (
        <span className="flex items-center gap-1 text-role-impostor/70">
            {skullCount > 0 ? (
                Array.from({ length: skullCount }).map((_, index) => (
                    <Skull key={`${id}-skull-${index}`} className="w-3 h-3" />
                ))
            ) : (
                <span className="text-primary/40">0</span>
            )}
            {extraSkulls > 0 && <span className="text-[10px]">+{extraSkulls}</span>}
        </span>
    );
}

export default function MeetingPage() {
    const t = useTranslations();
    const locale = useLocale();
    const { id } = useParams();
    const gameId = id as string;
    const { authState } = useAuth();
    const userId = authState.session?.userId;
    const {
        fetchGame,
        gameState,
        meetingView,
        fetchMeetingView,
        castMeetingVoteAction,
        cancelMeetingVoteAction,
        isMeetingVoting,
        isMeetingLoading,
        meetingError,
        meetingErrorCode,
    } = useGameStore();
    const [now, setNow] = useState(() => Date.now());

    useRealTimeGamePolling(gameId, userId ?? undefined, Boolean(userId));

    useEffect(() => {
        if (!gameId || !userId) return;
        fetchGame(gameId, userId);
        fetchMeetingView(gameId, userId);
    }, [gameId, userId, fetchGame, fetchMeetingView]);

    useEffect(() => {
        if (!gameId || !userId) return;
        const activeMeetingId = gameState?.meeting?.status === "ACTIVE" ? gameState.meeting.id : null;
        if (activeMeetingId && meetingView?.meeting?.id !== activeMeetingId) {
            fetchMeetingView(gameId, userId);
        }
    }, [gameId, userId, gameState?.meeting?.id, gameState?.meeting?.status, meetingView?.meeting?.id, fetchMeetingView]);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    if (!userId || isMeetingLoading) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-3xl w-full border-2 border-primary/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm animate-pulse">
                    <div className="text-primary text-center tracking-[0.2em] uppercase text-sm font-orbitron">
                        {t("game.meeting.loadingRoom")}
                    </div>
                </div>
            </main>
        );
    }

    if (meetingError && meetingErrorCode !== "ERR_MEETING_NOT_ACTIVE") {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <ErrorView
                    title={t("game.meeting.interruptedTitle")}
                    message={getLocalizedErrorMessage({
                        t,
                        code: meetingErrorCode || undefined,
                        fallback: meetingError,
                    })}
                    code={meetingErrorCode || "ERR_SIGNAL_LOST"}
                    onRetry={() => {
                        if (userId) fetchMeetingView(gameId, userId);
                    }}
                />
            </main>
        );
    }

    const meeting = gameState?.meeting ?? meetingView?.meeting ?? null;
    const snapshot = meeting?.snapshot;
    const currentPlayerRole =
        gameState?.players.find((player) => player.id === userId)?.role ??
        snapshot?.players.find((player) => player.id === userId)?.role;
    const isGameOver = gameState?.status === "FINISHED" && Boolean(gameState?.winner);
    const shouldShowGameOver = Boolean(isGameOver && gameState?.winner && currentPlayerRole);
    const active = meeting?.status === "ACTIVE";
    const completed = meeting?.status === "COMPLETED";
    const remainingMs = active && meeting ? Math.max(0, meeting.endsAt - now) : 0;
    const timerLabel = formatRemaining(remainingMs);
    const myVoteTargetId = meetingView?.myVoteTargetId ?? null;
    const isEligibleVoter = !!(active && userId && meeting?.eligibleVoterIds.includes(userId));
    const bodyFoundTagLabel = t("game.meeting.bodyFoundTitle").toUpperCase();
    const foundBodyPlayer =
        meeting && snapshot
            ? snapshot.players.find((player) => player.id === meeting.startedBy && !player.isAlive) ?? null
            : null;

    const playersForMeetingList = !meeting || !snapshot
        ? []
        : snapshot.players
              .map((player) => ({
                  ...player,
                  votes: meeting.eligibleVoterIds.includes(player.id) ? meeting.voteCounts[player.id] ?? 0 : 0,
                  votable: meeting.eligibleVoterIds.includes(player.id),
              }))
              .sort((a, b) => {
                  if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
                  return a.name.localeCompare(b.name, locale, { sensitivity: "base" });
              });

    const myVoteName = playersForMeetingList.find((target) => target.id === myVoteTargetId)?.name ?? null;

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
            {shouldShowGameOver && gameState?.winner && currentPlayerRole && (
                <GameOverScreen
                    winner={gameState.winner}
                    userRole={currentPlayerRole}
                    gameId={gameId}
                />
            )}
            <div className="max-w-4xl w-full border-2 border-primary/20 p-6 md:p-8 space-y-6 bg-black/50 backdrop-blur-sm">
                {gameState && <ReactorSabotageAlert gameState={gameState} />}

                <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                    <h1 className="text-lg md:text-xl font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                        {t("game.meeting.roomTitle")}
                    </h1>
                    <div className="text-right">
                        <div className={`text-2xl font-black ${active ? "text-role-impostor/70" : "text-primary/70"}`}>
                            {timerLabel}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-primary/60">
                            {t("game.meeting.timer")}
                        </div>
                    </div>
                </div>

                {!meeting && (
                    <div className="p-4 border border-primary/20 bg-black/30 text-center space-y-2">
                        <div className="text-sm uppercase tracking-widest text-primary/80">{t("game.meeting.noMeetingTitle")}</div>
                        <p className="text-xs text-muted-foreground font-rajdhani">
                            {t("game.meeting.noMeetingDescription")}
                        </p>
                    </div>
                )}
                {snapshot && (
                    <>
                        <div className="pt-2 space-y-3 border-t border-primary/10">
                            <div className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani">
                                {t("game.meeting.crewProgressSnapshot")}
                            </div>
                            <div className="w-full h-2 bg-white/10 overflow-hidden">
                                <div
                                    className="h-full bg-role-crewmate transition-all duration-500"
                                    style={{ width: `${snapshot.progress.percentage}%` }}
                                />
                            </div>
                            <div className="text-sm text-muted-foreground font-rajdhani tracking-wide">
                                {t("game.meeting.questsCompleted", {
                                    completed: String(snapshot.progress.completed),
                                    total: String(snapshot.progress.total),
                                })}
                            </div>
                        </div>

                        <div className="pt-2 space-y-3 border-t border-primary/10">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani">
                                    {t("game.meeting.playersAndVotesSnapshot")}
                                </div>
                                {meeting && (
                                    <div className="text-[10px] text-primary/60 uppercase tracking-widest">
                                        {t("game.meeting.votesCount", {
                                            votes: String(meeting.totalVotes),
                                            eligible: String(meeting.totalEligibleVoters),
                                        })}
                                    </div>
                                )}
                            </div>

                            {!isEligibleVoter && active && (
                                <p className="text-xs text-muted-foreground font-rajdhani">
                                    {t("game.meeting.notEligible")}
                                </p>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {playersForMeetingList.map((player) => {
                                    const selected = myVoteTargetId === player.id;
                                    const foundBody = foundBodyPlayer?.id === player.id;
                                    const disabled =
                                        !active ||
                                        !isEligibleVoter ||
                                        !player.isAlive ||
                                        !player.votable ||
                                        player.id === userId ||
                                        isMeetingVoting;

                                    return (
                                        <button
                                            key={player.id}
                                            type="button"
                                            onClick={() => {
                                                if (!userId || disabled) return;
                                                castMeetingVoteAction(gameId, userId, player.id);
                                            }}
                                            disabled={disabled}
                                            className={`p-3 border text-left text-xs uppercase tracking-widest transition-colors ${
                                                selected
                                                    ? "border-role-impostor/60 bg-role-impostor/15 text-role-impostor/90"
                                                    : foundBody
                                                    ? "border-role-impostor/80 bg-[linear-gradient(135deg,rgba(127,29,29,0.4)_0%,rgba(69,10,10,0.45)_55%,rgba(15,23,42,0.72)_100%)] text-role-impostor/90 shadow-[0_0_18px_rgba(248,113,113,0.2)]"
                                                    : disabled
                                                    ? "border-white/10 bg-white/5 text-muted-foreground/60"
                                                    : "border-white/10 bg-white/5 text-muted-foreground hover:border-primary/40"
                                            } disabled:cursor-not-allowed`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0 flex items-center gap-2">
                                                    <span className="truncate">{player.name}</span>
                                                    {foundBody && (
                                                        <span className="inline-flex shrink-0 items-center gap-1 border border-role-impostor/60 bg-role-impostor/20 px-1.5 py-0.5 text-[9px] font-orbitron tracking-[0.14em] text-role-impostor">
                                                            <Skull className="w-3 h-3" />
                                                            {bodyFoundTagLabel}
                                                        </span>
                                                    )}
                                                </div>
                                                {!player.isAlive ? (
                                                    <span className={foundBody ? "text-role-impostor/80 font-bold" : "text-role-impostor"}>
                                                        {t("game.meeting.dead")}
                                                    </span>
                                                ) : (
                                                    <VoteSkulls votes={player.votes} id={player.id} />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {active && isEligibleVoter && (
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs text-muted-foreground font-rajdhani">
                                        {myVoteName
                                            ? t("game.meeting.yourVote", { playerName: myVoteName })
                                            : t("game.meeting.noVoteYet")}
                                    </div>
                                    {myVoteTargetId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!userId) return;
                                                cancelMeetingVoteAction(gameId, userId);
                                            }}
                                            disabled={isMeetingVoting}
                                            className="px-3 py-1.5 border border-primary/40 text-primary text-xs uppercase tracking-widest hover:bg-primary/10 transition-colors disabled:opacity-50"
                                        >
                                            {t("game.actions.cancelVote")}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {!active && !completed && (
                    <div className="pt-2">
                        <Link
                            href={`/game/${gameId}`}
                            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors uppercase tracking-widest font-rajdhani touch-manipulation min-h-[44px]"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {t("game.meeting.returnCockpit")}
                        </Link>
                    </div>
                )}
            </div>

            {completed && meeting && !shouldShowGameOver && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="max-w-md w-full border border-primary/30 bg-black p-6 space-y-4 shadow-xl">
                        <h2 className="text-lg font-bold uppercase tracking-wider text-primary font-orbitron">
                            {t("game.meeting.completedTitle")}
                        </h2>
                        <p className="text-sm text-muted-foreground font-rajdhani">
                            {meeting.eliminatedPlayerName
                                ? t("game.meeting.eliminatedPlayer", { playerName: meeting.eliminatedPlayerName })
                                : t("game.meeting.noElimination")}
                        </p>
                        <div className="flex justify-end">
                            <Link
                                href={`/game/${gameId}`}
                                className="inline-flex min-h-[44px] items-center justify-center px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors uppercase tracking-widest font-rajdhani"
                            >
                                {t("game.meeting.returnCockpit")}
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
