"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { createBatch } from "@/lib/redis/batch-actions";
import { getLocalizedErrorMessage } from "@/lib/i18n/error-messages";
import { NumberStepperInput } from "@/components/common/number-stepper-input";
import { BatchCreateInput } from "@/types/quest";

interface BatchFormProps {
  onBatchCreated?: () => void;
}

export function BatchForm({ onBatchCreated }: BatchFormProps) {
  const t = useTranslations();
  const defaultZoneName = t("admin.batchForm.defaultZoneName");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoneName, setZoneName] = useState(defaultZoneName);
  const [totalQuests, setTotalQuests] = useState(1);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const questCount = totalQuests;
      const normalizedName = zoneName.trim();
      
      if (isNaN(questCount) || questCount < 1) {
        setError(t("admin.batchForm.errors.questRange"));
        return;
      }

      if (!normalizedName) {
        setError(t("admin.batchForm.errors.zoneNameRequired"));
        return;
      }

      const input: BatchCreateInput = {
        totalQuests: questCount,
        name: normalizedName,
      };
      const result = await createBatch(input);

      if (!result.success) {
        setError(
          getLocalizedErrorMessage({
            t,
            code: result.code,
            fallback: result.error,
          }),
        );
        return;
      }

      // Reset form and close dialog
      setZoneName(defaultZoneName);
      setTotalQuests(1);
      setIsOpen(false);
      onBatchCreated?.();
    } catch {
      setError(
        getLocalizedErrorMessage({
          t,
          code: "ERR_SIGNAL_LOST",
          fallback: t("game.join.errors.unexpected"),
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      setZoneName(defaultZoneName);
      setTotalQuests(1);
      setError("");
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full sm:w-auto justify-center flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black py-3 px-6 rounded-sm transition-all relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        <span className="relative flex items-center gap-2 tracking-[0.3em] uppercase text-sm">
          <Plus size={16} />
          {t("admin.batchForm.createButton")}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-black border border-primary/30 rounded-sm p-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-black uppercase tracking-[0.2em] text-primary font-orbitron">
            {t("admin.batchForm.title")}
          </h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            {t("admin.batchForm.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="space-y-2">
            <label htmlFor="zone-name" className="text-[10px] uppercase tracking-widest text-primary/70">
              {t("admin.batchForm.zoneNameLabel")}
            </label>
            <input
              id="zone-name"
              type="text"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value.slice(0, 60))}
              className="w-full h-12 bg-black/80 border border-primary/30 p-3 font-mono text-sm tracking-wider text-foreground placeholder:text-primary/20 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/35 transition-all rounded-sm uppercase"
              placeholder={t("admin.batchForm.zoneNamePlaceholder")}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-primary/70">
              {t("admin.batchForm.totalQuestsLabel")}
            </label>
            <NumberStepperInput
              value={totalQuests}
              min={1}
              onChange={setTotalQuests}
              disabled={isSubmitting}
              incrementAriaLabel={t("admin.batchForm.increaseTotalQuestsAria")}
              decrementAriaLabel={t("admin.batchForm.decreaseTotalQuestsAria")}
            />
            <p className="text-[8px] text-muted-foreground uppercase tracking-widest">
              {t("admin.batchForm.totalQuestsHint")}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 p-3 text-[10px] text-destructive uppercase tracking-widest text-center">
              [ERROR] {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 bg-black/80 border border-primary/30 hover:border-primary/50 text-primary font-black py-3 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("admin.batchForm.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-black py-3 rounded-sm transition-all relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative tracking-[0.3em] uppercase text-sm">
                {isSubmitting
                  ? t("admin.batchForm.creating")
                  : t("admin.batchForm.createBatch")}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
