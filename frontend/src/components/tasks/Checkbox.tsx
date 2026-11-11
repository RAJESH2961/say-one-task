import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-primary",
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}
