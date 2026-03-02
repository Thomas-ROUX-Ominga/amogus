"use client";

import { QuestGame } from "@/types/quest";
import { QuestTrueFalse } from "@/components/game/quest-true-false";
import { QuestQCM } from "@/components/game/quest-qcm";
import { QuestSingleInput } from "@/components/game/quest-single-input";
import { QuestNumberInput } from "@/components/game/quest-number-input";
import { QuestForm } from "@/components/game/quest-form";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface QuestRendererProps {
    quest: QuestGame;
    gameId: string;
    onSuccess: () => void;
    onError: () => void;
}

export function QuestRenderer({ quest, gameId, onSuccess, onError }: QuestRendererProps) {
    // Validate quest has required fields
    const needsOptions = quest.type === "true-false" || quest.type === "qcm";
    if ((needsOptions && (!quest.options || quest.options.length === 0)) || !quest.answer) {
        return (
            <div className="p-6 border border-destructive/30 bg-destructive/5 backdrop-blur-sm text-center space-y-4">
                <AlertTriangle className="w-8 h-8 text-destructive mx-auto" aria-hidden="true" />
                <p className="text-sm text-destructive/80 font-rajdhani">
                    Données de quête invalides. Options ou réponse manquantes.
                </p>
                <Link
                    href={`/game/${gameId}`}
                    className="inline-block min-h-[44px] leading-[44px] px-6 border border-primary/30 text-primary/70 font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/10 transition-colors touch-manipulation"
                >
                    Retour au Game Home
                </Link>
            </div>
        );
    }

    switch (quest.type) {
        case "true-false":
            return <QuestTrueFalse quest={quest} onSuccess={onSuccess} onError={onError} />;
        case "qcm":
            return <QuestQCM quest={quest} onSuccess={onSuccess} onError={onError} />;
        case "single-input":
            return <QuestSingleInput quest={quest} onSuccess={onSuccess} onError={onError} />;
        case "number-input":
            return <QuestNumberInput quest={quest} onSuccess={onSuccess} onError={onError} />;
        case "form":
            return <QuestForm quest={quest} onSuccess={onSuccess} onError={onError} />;
        default:
            return (
                <div className="p-6 border border-destructive/30 bg-destructive/5 backdrop-blur-sm text-center space-y-4">
                    <AlertTriangle className="w-8 h-8 text-destructive mx-auto" aria-hidden="true" />
                    <p className="text-sm text-destructive/80 font-rajdhani">
                        Type de quête non supporté : {quest.type}
                    </p>
                    <Link
                        href={`/game/${gameId}`}
                        className="inline-block min-h-[44px] leading-[44px] px-6 border border-primary/30 text-primary/70 font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/10 transition-colors touch-manipulation"
                    >
                        Retour au Game Home
                    </Link>
                </div>
            );
    }
}
