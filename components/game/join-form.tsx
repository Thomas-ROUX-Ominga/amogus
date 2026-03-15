"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { UserPlus, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { useRouter } from "next/navigation";

interface JoinFormProps {
    gameId: string;
    userId: string;
}

export function JoinForm({ gameId, userId }: JoinFormProps) {
    const t = useTranslations();
    const router = useRouter();
    const [pseudo, setPseudo] = useState("");
    const [hasEditedPseudo, setHasEditedPseudo] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [hasAutoJoinAttempted, setHasAutoJoinAttempted] = useState(false);
    const { join, isJoining, isLoading, gameState, error, errorCode } = useGameStore();
    const { setAnonymousSession, authState } = useAuth();
    const sessionUsername = authState.session?.username?.trim() || "";
    const resolvedPseudo = (pseudo.trim() || sessionUsername).slice(0, 20).trim();
    const shouldShowLoginAction = errorCode === ERROR_CODES.ERR_LOGIN_REQUIRED_FOR_AUTH_PLAYER;
    const loginRedirect = `/game/${gameId}`;
    const hasLoadedGameSnapshot = !isLoading && gameState?.id === gameId;
    const isAlreadyMember = Boolean(
        gameState?.id === gameId && gameState.players.some((player) => player.id === userId),
    );

    useEffect(() => {
        if (!hasEditedPseudo && !pseudo.trim() && sessionUsername) {
            setPseudo(sessionUsername.slice(0, 20));
        }
    }, [hasEditedPseudo, sessionUsername, pseudo]);

    useEffect(() => {
        const canAutoJoin =
            !hasEditedPseudo &&
            !hasAutoJoinAttempted &&
            !isJoining &&
            !isSuccess &&
            hasLoadedGameSnapshot &&
            !isAlreadyMember &&
            Boolean(sessionUsername) &&
            Boolean(resolvedPseudo) &&
            Boolean(gameId) &&
            Boolean(userId);

        if (!canAutoJoin) return;

        const autoJoin = async () => {
            setHasAutoJoinAttempted(true);
            await join(gameId, resolvedPseudo, userId);

            if (!useGameStore.getState().error) {
                setIsSuccess(true);
                setAnonymousSession(resolvedPseudo, gameId);
            }
        };

        void autoJoin();
    }, [
        gameId,
        gameState?.id,
        hasAutoJoinAttempted,
        hasLoadedGameSnapshot,
        hasEditedPseudo,
        isAlreadyMember,
        isLoading,
        isJoining,
        isSuccess,
        join,
        resolvedPseudo,
        sessionUsername,
        setAnonymousSession,
        userId,
    ]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resolvedPseudo || isJoining || isSuccess) return;
        
        await join(gameId, resolvedPseudo, userId);
        
        // If there's an error in the store, we don't treat it as success
        // Note: we check the CURRENT store state after await
        if (!useGameStore.getState().error) {
            setIsSuccess(true);
            // Sync the anonymous session with the pseudo and gameId
            setAnonymousSession(resolvedPseudo, gameId);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full border-2 border-primary/30 flex items-center justify-center bg-primary/5 animate-pulse">
                    <Terminal className="text-primary w-8 h-8" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
                        {t("game.join.identifyYourself")}
                    </h2>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed px-4">
                        {t("game.join.subtitle")}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary/0 rounded-sm opacity-20 group-focus-within:opacity-100 transition duration-500 blur-sm"></div>
                    <input
                        type="text"
                        value={pseudo}
                        onChange={(e) => {
                            setHasEditedPseudo(true);
                            setPseudo(e.target.value.slice(0, 20));
                        }}
                        placeholder={t("game.join.placeholder")}
                        autoFocus
                        className="relative w-full bg-black/80 border border-primary/30 p-4 font-mono text-center text-xl tracking-widest text-foreground placeholder:text-primary/20 focus:outline-none focus:border-primary transition-all rounded-sm uppercase"
                    />
                </div>

                {error && (
                    <div className="bg-destructive/10 border border-destructive/20 p-3 text-[10px] text-destructive uppercase tracking-widest text-center animate-shake space-y-3">
                        <div>[ERROR] {getLocalizedErrorMessage({ t, code: errorCode, fallback: error })}</div>
                        {shouldShowLoginAction && (
                            <button
                                type="button"
                                onClick={() => {
                                    const params = new URLSearchParams({ redirect: loginRedirect });
                                    router.push(`/login?${params.toString()}`);
                                }}
                                className="px-4 py-2 border border-destructive/40 hover:bg-destructive/10 transition-colors text-[10px] tracking-[0.2em] uppercase"
                            >
                                {t("home.signIn")}
                            </button>
                        )}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={!resolvedPseudo || isJoining || isSuccess}
                    className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-black py-4 rounded-sm transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <span className="relative flex items-center gap-2 tracking-[0.3em] uppercase text-sm">
                        {isJoining || isSuccess ? t("game.join.establishing") : t("game.join.join")}
                        {!(isJoining || isSuccess) && <UserPlus size={18} />}
                    </span>
                </button>
            </form>

            <div className="pt-8 border-t border-primary/10 flex justify-between items-center opacity-30">
                <div className="text-[8px] font-mono tracking-tighter uppercase">
                    {t("game.join.authType")}
                </div>
                <div className="text-[8px] font-mono tracking-tighter uppercase">
                    {t("game.join.securityLevel")}
                </div>
            </div>
        </div>
    );
}
