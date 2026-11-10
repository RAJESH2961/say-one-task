import { useEffect, useState } from "react";
import { CheckCircle2, Coffee, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { RatingInput } from "@/components/common/RatingInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api";
import { formatDuration, SESSION_TYPE_LABEL } from "@/lib/format";
import { sessionsApi } from "@/services";
import { useTimerStore } from "@/stores/timer";

/** Shown in the tab that completed a session: reflection (notes + rating) and next-step shortcut. */
export function SessionCompleteDialog() {
  const completion = useTimerStore((s) => s.completion);
  const dismiss = useTimerStore((s) => s.dismissCompletion);
  const start = useTimerStore((s) => s.start);
  const activeSession = useTimerStore((s) => s.session);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes("");
    setRating(null);
  }, [completion?.session.id]);

  if (!completion) return null;
  const { session, task, cycle } = completion;
  const wasFocus = session.session_type === "focus";
  const next = cycle.next_session_type;

  const saveReflection = async () => {
    if (!notes.trim() && rating === null) return true;
    setSaving(true);
    try {
      await sessionsApi.updateReflection(session.id, { notes: notes.trim() || null, productivity_rating: rating });
      toast.success("Reflection saved");
      return true;
    } catch (err) {
      toast.error(toApiError(err).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const close = async (startNext: boolean) => {
    if (!(await saveReflection())) return;
    dismiss();
    if (startNext && !activeSession) await start(next);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && void close(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            {wasFocus ? <CheckCircle2 className="size-7" /> : <Coffee className="size-7" />}
          </div>
          <DialogTitle className="text-xl">{wasFocus ? "Focus session complete!" : "Break finished"}</DialogTitle>
          <DialogDescription>
            {wasFocus
              ? `You focused for ${formatDuration(session.actual_duration_seconds ?? session.planned_duration_seconds)}. ${cycle.completed_focus_today} Pomodoro${cycle.completed_focus_today === 1 ? "" : "s"} today.`
              : "Ready to get back into flow?"}
          </DialogDescription>
        </DialogHeader>

        {task && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Target className="size-4 text-primary" />
              <span className="truncate">{task.title}</span>
              <span className="tabular ml-auto text-xs text-muted-foreground">
                {task.completed_pomodoros}/{task.estimated_pomodoros}
              </span>
            </div>
            <Progress value={task.progress_percent} className="mt-2 h-1.5" />
          </div>
        )}

        {wasFocus && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>How productive was this session?</Label>
              <RatingInput value={rating} onChange={setRating} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-notes">Session notes (optional)</Label>
              <Textarea
                id="session-notes"
                rows={3}
                maxLength={2000}
                placeholder="What did you accomplish? What got in the way?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => void close(false)} disabled={saving}>
            {wasFocus ? "Save & close" : "Close"}
          </Button>
          {!activeSession && (
            <Button onClick={() => void close(true)} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Start {SESSION_TYPE_LABEL[next].toLowerCase()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
