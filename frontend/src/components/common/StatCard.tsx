import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  loading?: boolean;
  accent?: "blue" | "green" | "violet" | "cyan";
  children?: ReactNode;
}

const ACCENTS = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

export function StatCard({ label, value, hint, icon: Icon, loading, accent = "blue", children }: StatCardProps) {
  return (
    <Card className="gap-0 p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="tabular mt-1.5 truncate text-2xl font-semibold tracking-tight">{value}</p>
          )}
        </div>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", ACCENTS[accent])}>
          <Icon className="size-5" />
        </div>
      </div>
      {hint && !loading && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </Card>
  );
}
