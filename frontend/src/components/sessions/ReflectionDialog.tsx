import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RatingInput } from "@/components/common/RatingInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api";
import { SESSION_TYPE_LABEL } from "@/lib/format";
import { sessionsApi } from "@/services";
import type { FocusSession } from "@/types/api";

/** Edit notes and productivity rating of a finished session. */
export function ReflectionDialog({
  session,
  onOpenChange,
  onSaved,
}: {
  session: FocusSession | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (s: FocusSession) => void;
}) {
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(session?.notes ?? "");
    setRating(session?.productivity_rating ?? null);
  }, [session]);

  const save = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const updated = await sessionsApi.updateReflection(session.id, { notes: notes.trim() || null, productivity_rating: rating });
      onSaved(updated);
      toast.success("Session updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!session} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Session notes</DialogTitle>
          <DialogDescription>
            {session && `${SESSION_TYPE_LABEL[session.session_type]} · ${new Date(session.started_at).toLocaleString()}`}
            {session?.task && ` · ${session.task.title}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Productivity rating</Label>
            <RatingInput value={rating} onChange={setRating} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reflection-notes">Notes</Label>
            <Textarea id="reflection-notes" rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What went well? What would you change?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
