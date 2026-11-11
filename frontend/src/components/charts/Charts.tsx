import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDuration, formatHour } from "@/lib/format";
import type { DailyPoint, HourPoint } from "@/types/api";

const AXIS = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false } as const;
const GRID = <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />;

type TooltipItem = { name?: string | number; value?: unknown; color?: string };
interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly TooltipItem[];
  label?: unknown;
  render: (label: string, payload: readonly TooltipItem[]) => React.ReactNode;
}

function ChartTooltip({ active, payload, label, render }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {render(String(label ?? ""), payload)}
    </div>
  );
}

const shortDay = (iso: string) => new Date(`${iso}T00:00`).toLocaleDateString([], { weekday: "short" });
const shortDate = (iso: string) => new Date(`${iso}T00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
const longDate = (iso: string) => new Date(`${iso}T00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

export function DailyFocusChart({ data, height = 260, variant = "bar" }: { data: DailyPoint[]; height?: number; variant?: "bar" | "area" }) {
  const rows = data.map((d) => ({ ...d, minutes: Math.round(d.focus_seconds / 60) }));
  const tickFmt = rows.length <= 7 ? shortDay : shortDate;
  const tooltip = (
    <Tooltip
      cursor={{ fill: "var(--muted)", opacity: 0.5 }}
      content={(props) => (
        <ChartTooltip
          active={props.active} payload={props.payload as readonly TooltipItem[] | undefined} label={props.label}
          render={(label) => {
            const p = rows.find((r) => r.date === label);
            return (
              <>
                <p className="mb-1 font-medium">{longDate(label)}</p>
                <p>Focus: {formatDuration(p?.focus_seconds ?? 0)}</p>
                <p>Pomodoros: {p?.pomodoros ?? 0}</p>
                {!!p?.interrupted && <p className="text-muted-foreground">Interrupted: {p.interrupted}</p>}
              </>
            );
          }}
        />
      )}
    />
  );
  return (
    <ResponsiveContainer width="100%" height={height}>
      {variant === "bar" ? (
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          {GRID}
          <XAxis dataKey="date" tickFormatter={tickFmt} {...AXIS} minTickGap={8} />
          <YAxis {...AXIS} allowDecimals={false} unit="m" />
          {tooltip}
          <Bar dataKey="minutes" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      ) : (
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {GRID}
          <XAxis dataKey="date" tickFormatter={tickFmt} {...AXIS} minTickGap={16} />
          <YAxis {...AXIS} allowDecimals={false} unit="m" />
          {tooltip}
          <Area type="monotone" dataKey="minutes" stroke="var(--chart-1)" strokeWidth={2} fill="url(#focusFill)" />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

export function HourlyChart({ data, best, height = 240, metric = "focus" }: { data: HourPoint[]; best?: number | null; height?: number; metric?: "focus" | "count" }) {
  const rows = data.map((d) => ({ ...d, value: metric === "focus" ? Math.round(d.focus_seconds / 60) : d.pomodoros }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="hour" tickFormatter={(h: number) => (h % 3 === 0 ? formatHour(h) : "")} {...AXIS} interval={0} />
        <YAxis {...AXIS} allowDecimals={false} unit={metric === "focus" ? "m" : ""} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={(props) => (
            <ChartTooltip
              active={props.active} payload={props.payload as readonly TooltipItem[] | undefined} label={props.label}
              render={(label, payload) => (
                <>
                  <p className="mb-1 font-medium">{formatHour(Number(label))}</p>
                  <p>{metric === "focus" ? `Focus: ${payload[0]?.value} min` : `Distractions: ${payload[0]?.value}`}</p>
                </>
              )}
            />
          )}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {rows.map((r) => (
            <Cell key={r.hour} fill={r.hour === best ? "var(--chart-1)" : metric === "focus" ? "color-mix(in oklch, var(--chart-1) 45%, transparent)" : "var(--chart-4)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({ data, height = 240, unit = "", color = "var(--chart-1)", formatter }: { data: { label: string; value: number }[]; height?: number; unit?: string; color?: string; formatter?: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} allowDecimals={false} unit={unit} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={(props) => (
            <ChartTooltip active={props.active} payload={props.payload as readonly TooltipItem[] | undefined} label={props.label} render={(label, payload) => (
              <>
                <p className="mb-1 font-medium">{label}</p>
                <p>{formatter ? formatter(Number(payload[0]?.value)) : `${payload[0]?.value}${unit}`}</p>
              </>
            )} />
          )}
        />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 220 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          content={(props) => (
            <ChartTooltip active={props.active} payload={props.payload as readonly TooltipItem[] | undefined} label={props.label} render={(_, payload) => (
              <p><span className="font-medium">{payload[0]?.name}</span>: {String(payload[0]?.value)}</p>
            )} />
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
