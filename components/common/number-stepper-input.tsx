import { ChevronDown, ChevronUp } from "lucide-react";

interface NumberStepperInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  incrementAriaLabel: string;
  decrementAriaLabel: string;
}

export function NumberStepperInput({
  id,
  value,
  onChange,
  min = 0,
  max,
  disabled = false,
  className,
  incrementAriaLabel,
  decrementAriaLabel,
}: NumberStepperInputProps) {
  const clamp = (nextValue: number) => {
    const boundedByMin = Math.max(min, nextValue);
    if (typeof max !== "number") return boundedByMin;
    return Math.min(max, boundedByMin);
  };

  const setNextValue = (nextValue: number) => {
    onChange(clamp(nextValue));
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        id={id}
        type="number"
        min={String(min)}
        max={typeof max === "number" ? String(max) : undefined}
        value={value}
        onChange={(e) => setNextValue(parseInt(e.target.value, 10) || min)}
        className="number-input-clean w-full h-10 sm:h-12 bg-gradient-to-b from-black/80 to-black/50 border border-primary/35 hover:border-primary/60 pl-2 pr-12 text-center text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/35 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={disabled}
      />
      <div className="absolute right-0 top-0 bottom-0 w-10 border-l border-primary/20 bg-black/70 flex flex-col">
        <button
          type="button"
          onClick={() => setNextValue(value + 1)}
          disabled={disabled}
          className="flex-1 inline-flex items-center justify-center text-primary/80 hover:text-primary hover:bg-primary/10 transition-colors border-b border-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={incrementAriaLabel}
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          onClick={() => setNextValue(value - 1)}
          disabled={disabled}
          className="flex-1 inline-flex items-center justify-center text-primary/80 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={decrementAriaLabel}
        >
          <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
}
