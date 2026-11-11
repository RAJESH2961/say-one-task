import { Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/types/api";

const TONE = {
  positive: { icon: TrendingUp, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  neutral: { icon: Sparkles, cls: "bg-primary/10 text-primary" },
  suggestion: { icon: Lightbulb, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
};

export function InsightList({ insights, limit }: { insights: Insight[]; limit?: number }) {
  return (
    <ul className="space-y-3">
      {insights.slice(0, limit).map((i) => {
        const { icon: Icon, cls } = TONE[i.tone] ?? TONE.neutral;
        return (
          <li key={i.kind} className="flex gap-3">
            <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", cls)}>
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{i.title}</p>
              <p className="text-sm text-muted-foreground">{i.message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
