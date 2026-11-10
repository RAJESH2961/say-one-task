import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TimerRingProps {
  progress: number; // 0..1 elapsed fraction
  size?: number;
  stroke?: number;
  tone?: "focus" | "short_break" | "long_break";
  paused?: boolean;
  children?: ReactNode;
}

const TONE: Record<NonNullable<TimerRingProps["tone"]>, string> = {
  focus: "text-primary",
  short_break: "text-cyan-500",
  long_break: "text-violet-500",
};

/** Large circular countdown. Remaining time is drawn as the coloured arc. */
export function TimerRing({ progress, size = 320, stroke = 12, tone = "focus", paused, children }: TimerRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const remaining = 1 - Math.min(1, Math.max(0, progress));
  return (
    <div className="relative mx-auto aspect-square w-full" style={{ maxWidth: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" role="presentation">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - remaining)}
          className={cn(TONE[tone], "transition-[stroke-dashoffset] duration-300 ease-linear", paused && "opacity-50")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
