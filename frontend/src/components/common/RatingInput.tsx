import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS = ["Very poor", "Poor", "Okay", "Good", "Excellent"];

export function RatingInput({
  value,
  onChange,
  size = "md",
  readOnly,
}: {
  value: number | null | undefined;
  onChange?: (v: number | null) => void;
  size?: "sm" | "md";
  readOnly?: boolean;
}) {
  const iconSize = size === "sm" ? "size-3.5" : "size-6";
  return (
    <div className="flex items-center gap-1" role={readOnly ? "img" : "radiogroup"} aria-label={`Productivity rating ${value ?? 0} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (value ?? 0) >= n;
        const star = (
          <Star className={cn(iconSize, active ? "fill-primary text-primary" : "text-muted-foreground/40")} />
        );
        return readOnly ? (
          <span key={n}>{star}</span>
        ) : (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            title={LABELS[n - 1]}
            onClick={() => onChange?.(value === n ? null : n)}
            className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}
