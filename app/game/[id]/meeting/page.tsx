"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { Skull } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useGameStore } from "@/lib/store/game-store";
import { ErrorView } from "@/components/game/error-view";

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
        <span className="flex items-center gap-1 text-red-300">
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
    const { id } = useParams();
    const gameId = id as string;
    const { authState } = useAuth();
    const userId = authState.session?.userId;
    const {
        fetchGame,
        refreshGameData,
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
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!gameId || !userId) return;
        fetchGame(gameId, userId);
        fetchMeetingView(gameId, userId);
    }, [gameId, userId, fetchGame, fetchMeetingView]);

    useSWR(
        userId ? `meeting:${gameId}:${userId}` : null,
        async () => {
            if (!userId) return null;
            await Promise.all([fetchMeetingView(gameId, userId), refreshGameData(gameId, userId)]);
            return useGameStore.getState().meetingView;
        },
        {
            refreshInterval: 1000,
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
        }
    );

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    if (!userId || isMeetingLoading) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <div className="max-w-3xl w-full border-2 border-primary/20 p-12 space-y-6 bg-black/50 backdrop-blur-sm animate-pulse">
                    <div className="text-primary text-center tracking-[0.2em] uppercase text-sm font-orbitron">
                        Chargement de la salle de meeting...
                    </div>
                </div>
            </main>
        );
    }

    if (meetingError && meetingErrorCode !== "ERR_MEETING_NOT_ACTIVE") {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                <ErrorView
                    title="SIGNAL MEETING INTERROMPU"
                    message={meetingError}
                    code={meetingErrorCode || "ERR_SIGNAL_LOST"}
                    onRetry={() => {
                        if (userId) fetchMeetingView(gameId, userId);
                    }}
                />
            </main>
        );
    }

    const meeting = meetingView?.meeting ?? gameState?.meeting ?? null;
    const snapshot = meeting?.snapshot;
    const active = meeting?.status === "ACTIVE";
    const completed = meeting?.status === "COMPLETED";
    const remainingMs = active && meeting ? Math.max(0, meeting.endsAt - now) : 0;
    const timerLabel = formatRemaining(remainingMs);
    const myVoteTargetId = meetingView?.myVoteTargetId ?? null;
    const isEligibleVoter = !!(active && userId && meeting?.eligibleVoterIds.includes(userId));

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
                  return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
              });

    const myVoteName = playersForMeetingList.find((target) => target.id === myVoteTargetId)?.name ?? null;

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
            <div className="max-w-4xl w-full border-2 border-primary/20 p-6 md:p-8 space-y-6 bg-black/50 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-primary/20 pb-4">
                    <h1 className="text-lg md:text-xl font-bold uppercase tracking-[0.3em] text-primary font-orbitron">
                        Salle du Meeting
                    </h1>
                    <div className="text-right">
                        <div className={`text-2xl font-black ${active ? "text-red-300" : "text-primary/70"}`}>
                            {timerLabel}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-primary/60">
                            Timer
                        </div>
                    </div>
                </div>

                {!meeting && (
                    <div className="p-4 border border-primary/20 bg-black/30 text-center space-y-2">
                        <div className="text-sm uppercase tracking-widest text-primary/80">Aucun meeting en cours</div>
                        <p className="text-xs text-muted-foreground font-rajdhani">
                            Attendez un buzz pour lancer un meeting et figer les données.
                        </p>
                    </div>
                )}

                {completed && meeting && (
                    <div className="p-4 border border-primary/30 bg-primary/10 space-y-2">
                        <div className="text-xs uppercase tracking-widest text-primary font-orbitron">
                            Meeting terminé
                        </div>
                        <p className="text-sm text-muted-foreground font-rajdhani">
                            {meeting.eliminatedPlayerName
                                ? `${meeting.eliminatedPlayerName} a été éliminé.`
                                : "Aucune élimination (aucun vote)."}
                        </p>
                    </div>
                )}

                {snapshot && (
                    <>
                        <div className="p-4 border border-primary/20 bg-black/30 space-y-3">
                            <div className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani">
                                Progression de l'équipage (snapshot)
                            </div>
                            <div className="w-full h-2 bg-white/10 overflow-hidden">
                                <div
                                    className="h-full bg-[#2DA44E] transition-all duration-500"
                                    style={{ width: `${snapshot.progress.percentage}%` }}
                                />
                            </div>
                            <div className="text-sm text-muted-foreground font-rajdhani tracking-wide">
                                {snapshot.progress.completed}/{snapshot.progress.total} quêtes accomplies
                            </div>
                        </div>

                        <div className="p-4 border border-primary/20 bg-black/30 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-primary/60 uppercase tracking-widest font-rajdhani">
                                    Joueurs et vote (snapshot)
                                </div>
                                {meeting && (
                                    <div className="text-[10px] text-primary/60 uppercase tracking-widest">
                                        Votes {meeting.totalVotes}/{meeting.totalEligibleVoters}
                                    </div>
                                )}
                            </div>

                            {!isEligibleVoter && active && (
                                <p className="text-xs text-muted-foreground font-rajdhani">
                                    Vous n&apos;êtes pas éligible au vote pendant ce meeting.
                                </p>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {playersForMeetingList.map((player) => {
                                    const selected = myVoteTargetId === player.id;
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
                                                    ? "border-red-400 bg-red-500/20 text-red-100"
                                                    : disabled
                                                    ? "border-white/10 bg-white/5 text-muted-foreground/60"
                                                    : "border-white/10 bg-white/5 text-muted-foreground hover:border-primary/40"
                                            } disabled:cursor-not-allowed`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate">{player.name}</span>
                                                {!player.isAlive ? (
                                                    <span className="text-red-400">MORT</span>
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
                                        {myVoteName ? `Votre vote: ${myVoteName}` : "Vous n'avez pas encore voté."}
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
                                            Annuler mon vote
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                <div className="pt-2 flex items-center justify-between gap-2">
                    <Link
                        href={`/game/${gameId}`}
                        className="px-4 py-2 border border-primary/40 text-primary text-xs uppercase tracking-widest hover:bg-primary/10 transition-colors"
                    >
                        Retour cockpit
                    </Link>
                    <Link
                        href="/"
                        className="px-4 py-2 border border-white/20 text-muted-foreground text-xs uppercase tracking-widest hover:bg-white/5 transition-colors"
                    >
                        Accueil
                    </Link>
                </div>
            </div>
        </main>
    );
}
