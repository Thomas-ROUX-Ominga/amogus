"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

interface GameRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RulesSection {
  key:
    | "preparation"
    | "lobby"
    | "gameplay"
    | "crewmates"
    | "impostors"
    | "meetings"
    | "victory";
  listKeys: string[];
}

const RULES_SECTIONS: RulesSection[] = [
  {
    key: "preparation",
    listKeys: ["line1", "line2", "line3", "line4"],
  },
  {
    key: "lobby",
    listKeys: ["line1", "line2"],
  },
  {
    key: "gameplay",
    listKeys: ["line1", "line2", "line3", "line4", "line5", "line6"],
  },
  {
    key: "crewmates",
    listKeys: [
      "line1",
      "line2",
      "line3",
      "line4",
      "line5",
      "line6",
      "line7",
    ],
  },
  {
    key: "impostors",
    listKeys: ["line1", "line2", "line3", "line4", "line5", "line6", "line7"],
  },
  {
    key: "meetings",
    listKeys: ["line1", "line2", "line3", "line4"],
  },
  {
    key: "victory",
    listKeys: ["line1", "line2", "line3"],
  },
];

export function GameRulesModal({ isOpen, onClose }: GameRulesModalProps) {
  const t = useTranslations();
  const translateDynamic = (key: string) => t(key as never);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-tooltip)] bg-black/80 backdrop-blur-md p-2 sm:p-4"
      data-testid="rules-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-rules-title"
        className="mx-auto flex h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col border border-primary/30 bg-[#0B0F14]/95 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-center justify-between border-b border-primary/20 px-4 py-3 sm:px-6 sm:py-4">
          <h2
            id="game-rules-title"
            className="font-orbitron text-sm font-black uppercase tracking-[0.16em] text-primary sm:text-base"
          >
            {t("common.rules.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 border border-primary/35 bg-black/60 text-primary hover:bg-primary/10 transition-colors inline-flex items-center justify-center"
            aria-label={t("common.rules.close")}
            title={t("common.rules.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <article className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <p className="mb-6 border border-primary/20 bg-primary/5 px-3 py-2 font-rajdhani text-sm leading-relaxed text-foreground/90 sm:text-base">
            {t("common.rules.intro")}
          </p>

          <div className="space-y-6">
            {RULES_SECTIONS.map((section, index) => (
              <section
                key={section.key}
                className="border border-primary/20 bg-black/40 px-4 py-4 sm:px-5 sm:py-5"
              >
                <h3 className="mb-3 font-orbitron text-xs font-bold uppercase tracking-[0.18em] text-primary sm:text-sm">
                  {index + 1}. {translateDynamic(`common.rules.sections.${section.key}.title`)}
                </h3>
                <ul className="space-y-2">
                  {section.listKeys.map((listKey) => (
                    <li
                      key={listKey}
                      className="font-rajdhani text-sm leading-relaxed text-foreground/90 sm:text-base"
                    >
                      {translateDynamic(`common.rules.sections.${section.key}.${listKey}`)}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>,
    document.body,
  );
}
