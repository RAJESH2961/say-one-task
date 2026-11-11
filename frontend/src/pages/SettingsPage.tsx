import { useEffect, useMemo, useState } from "react";
import { Bell, Loader2, Monitor, Moon, Palette, Play, Sun, Timer, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toApiError, type ApiError } from "@/lib/api";
import { playChime, unlockAudio } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import type { SettingsUpdate, ThemePreference, UserSettings } from "@/types/api";

type Draft = Omit<UserSettings, "updated_at">;

const NUMBER_FIELDS: { key: keyof Draft; label: string; min: number; max: number; unit: string; hint?: string }[] = [
  { key: "focus_duration_minutes", label: "Focus duration", min: 1, max: 180, unit: "min" },
  { key: "short_break_minutes", label: "Short break", min: 1, max: 60, unit: "min" },
  { key: "long_break_minutes", label: "Long break", min: 1, max: 120, unit: "min" },
  { key: "long_break_interval", label: "Long break interval", min: 1, max: 12, unit: "sessions", hint: "Focus sessions before a long break" },
  { key: "daily_goal_pomodoros", label: "Daily goal", min: 1, max: 48, unit: "Pomodoros" },
];

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function timezones(current: string): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    return Array.from(new Set(["UTC", current, ...list]));
  } catch {
    return ["UTC", current];
  }
}

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);
  const update = useSettingsStore((s) => s.update);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!settings) load().catch((e) => setLoadError(toApiError(e)));
  }, [settings, load]);
  useEffect(() => {
    if (settings) {
      const { updated_at: _ignored, ...rest } = settings;
      void _ignored;
      setDraft(rest);
    }
  }, [settings]);

  const tzList = useMemo(() => timezones(draft?.timezone ?? "UTC"), [draft?.timezone]);
  const dirty = useMemo(() => {
    if (!settings || !draft) return {} as SettingsUpdate;
    return Object.fromEntries(Object.entries(draft).filter(([k, v]) => settings[k as keyof UserSettings] !== v)) as SettingsUpdate;
  }, [settings, draft]);
  const isDirty = Object.keys(dirty).length > 0;

  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); void load().catch((e) => setLoadError(toApiError(e))); }} />;
  if (!draft) return <LoadingState label="Loading settings…" />;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async () => {
    const clientErrors: Record<string, string> = {};
    for (const f of NUMBER_FIELDS) {
      const v = draft[f.key] as number;
      if (!Number.isInteger(v) || v < f.min || v > f.max) clientErrors[f.key] = `Must be between ${f.min} and ${f.max}`;
    }
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;
    setSaving(true);
    try {
      await update(dirty);
      toast.success("Settings saved");
    } catch (err) {
      const apiErr = toApiError(err);
      setErrors(apiErr.fieldErrors);
      toast.error(apiErr.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Customise your timer, notifications and appearance."
        actions={
          <>
            {isDirty && <Button variant="ghost" onClick={() => settings && setDraft((({ updated_at: _u, ...rest }) => rest)(settings))}>Discard</Button>}
            <Button onClick={save} disabled={!isDirty || saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Save changes
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Timer className="size-4" /> Timer</CardTitle>
            <CardDescription>Durations apply to new sessions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {NUMBER_FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1">
                <div>
                  <Label htmlFor={f.key}>{f.label}</Label>
                  {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={f.key}
                    type="number"
                    min={f.min}
                    max={f.max}
                    className="tabular w-20 text-right"
                    value={Number.isNaN(draft[f.key] as number) ? "" : (draft[f.key] as number)}
                    onChange={(e) => set(f.key, (e.target.value === "" ? NaN : Number(e.target.value)) as never)}
                    aria-invalid={!!errors[f.key]}
                  />
                  <span className="w-20 text-xs text-muted-foreground">{f.unit}</span>
                </div>
                {errors[f.key] && <p className="col-span-2 text-xs text-destructive">{errors[f.key]}</p>}
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="auto_start_breaks" className="flex items-center gap-2"><Play className="size-3.5" /> Auto-start breaks</Label>
                <p className="text-xs text-muted-foreground">Start the break automatically after a focus session.</p>
              </div>
              <Switch id="auto_start_breaks" checked={draft.auto_start_breaks} onCheckedChange={(v) => set("auto_start_breaks", v)} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="auto_start_focus" className="flex items-center gap-2"><Play className="size-3.5" /> Auto-start focus</Label>
                <p className="text-xs text-muted-foreground">Start the next focus session automatically after a break.</p>
              </div>
              <Switch id="auto_start_focus" checked={draft.auto_start_focus} onCheckedChange={(v) => set("auto_start_focus", v)} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Bell className="size-4" /> Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="sound_enabled">Sound notifications</Label>
                  <p className="text-xs text-muted-foreground">Play a chime when a session ends.</p>
                </div>
                <Switch id="sound_enabled" checked={draft.sound_enabled} onCheckedChange={(v) => set("sound_enabled", v)} />
              </div>
              <div className={cn("space-y-3", !draft.sound_enabled && "pointer-events-none opacity-50")}>
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><Volume2 className="size-3.5" /> Volume</Label>
                  <span className="tabular text-xs text-muted-foreground">{draft.sound_volume}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <Slider value={[draft.sound_volume]} min={0} max={100} step={5} onValueChange={([v]) => set("sound_volume", v)} aria-label="Volume" />
                  <Button variant="outline" size="sm" onClick={() => { unlockAudio(); playChime("test", draft.sound_volume); }}>Test</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Palette className="size-4" /> Appearance & region</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Theme</Label>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
                  {THEMES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={draft.theme === value}
                      onClick={() => set("theme", value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors hover:bg-muted",
                        draft.theme === value && "border-primary bg-accent text-accent-foreground",
                      )}
                    >
                      <Icon className="size-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={draft.timezone} onValueChange={(v) => set("timezone", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {tzList.map((tz) => <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Used to group your analytics by day and hour.</p>
                {errors.timezone && <p className="text-xs text-destructive">{errors.timezone}</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
