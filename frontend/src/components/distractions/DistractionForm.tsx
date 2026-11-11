import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toApiError } from "@/lib/api";
import { distractionsApi } from "@/services";
import { useCategoriesStore } from "@/stores/categories";
import type { Distraction } from "@/types/api";

const NONE = "none";

/** Reusable form for logging a distraction (used in the journal and from the running timer). */
export function DistractionForm({
  sessionId,
  onCreated,
  autoFocus,
  compact,
}: {
  sessionId?: number | null;
  onCreated?: (d: Distraction) => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const allCategories = useCategoriesStore((s) => s.categories);
  const categories = useMemo(() => allCategories.filter((c) => c.kind === "distraction"), [allCategories]);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NONE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Describe what distracted you");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await distractionsApi.create({
        description: description.trim(),
        category_id: categoryId === NONE ? null : Number(categoryId),
        session_id: sessionId ?? null,
      });
      toast.success("Distraction logged");
      setDescription("");
      onCreated?.(created);
    } catch (err) {
      const apiErr = toApiError(err);
      setError(apiErr.fieldErrors.description ?? apiErr.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className={compact ? "space-y-3" : "grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end"}>
      <div className="space-y-1.5">
        <Label htmlFor="distraction-desc">What distracted you?</Label>
        <Input
          id="distraction-desc"
          value={description}
          maxLength={500}
          autoFocus={autoFocus}
          placeholder="e.g. Checked Twitter notifications"
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={!!error}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Uncategorized</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={submitting} className={compact ? "w-full" : ""}>
        {submitting && <Loader2 className="size-4 animate-spin" />} Log distraction
      </Button>
      {error && <p className="text-sm text-destructive md:col-span-3">{error}</p>}
    </form>
  );
}
