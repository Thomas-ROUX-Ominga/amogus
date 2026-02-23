"use client";

interface SimpleProgressBarProps {
  progress: number;
  variant?: "default" | "green" | "yellow" | "red";
}

export function SimpleProgressBar({ progress, variant = "default" }: SimpleProgressBarProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case "green":
        return "bg-green-400 from-green-400 to-green-400/80";
      case "yellow":
        return "bg-yellow-400 from-yellow-400 to-yellow-400/80";
      case "red":
        return "bg-red-400 from-red-400 to-red-400/80";
      default:
        return "bg-gradient-to-r from-primary to-primary/80";
    }
  };

  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all duration-500 ease-out relative ${getVariantClasses()}`}
        style={{ width: `${Math.min(progress, 100)}%` }}
      >
        <div className="absolute inset-0 bg-white/20 animate-pulse" />
      </div>
    </div>
  );
}
