import { formatDuration, formatHour, PRIORITY_LABEL, toISODate } from "@/lib/format";
import type {
  AnalyticsSummary,
  DistractionAnalytics,
  FocusHoursAnalytics,
  Insight,
  MonthlyAnalytics,
  TaskAnalytics,
  TaskPriority,
  WeeklyAnalytics,
} from "@/types/api";

export interface ReportData {
  summary: AnalyticsSummary;
  daily: WeeklyAnalytics;
  weekly: WeeklyAnalytics;
  monthly: MonthlyAnalytics;
  hours: FocusHoursAnalytics;
  distractions: DistractionAnalytics;
  tasks: TaskAnalytics;
  insights: Insight[];
}

const PRIMARY: [number, number, number] = [37, 99, 235]; // blue-600
const MUTED: [number, number, number] = [100, 116, 139]; // slate-500

export async function generateAnalyticsReport(data: ReportData, days: number): Promise<void> {
  // Loaded on demand so jspdf stays out of the initial route chunk.
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 0;

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8).setTextColor(...MUTED);
      doc.text(`FocusFlow · generated ${new Date().toLocaleString()}`, margin, doc.internal.pageSize.getHeight() - 24);
      doc.text(`Page ${i} of ${pages}`, W - margin, doc.internal.pageSize.getHeight() - 24, { align: "right" });
    }
  };

  // ------------------------------------------------------------- header
  doc.setFillColor(...PRIMARY).rect(0, 0, W, 72, "F");
  doc.setTextColor(255, 255, 255).setFontSize(20).setFont("helvetica", "bold");
  doc.text("FocusFlow — Productivity Report", margin, 34);
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text(`Generated ${new Date().toLocaleString()} · timezone ${data.summary.timezone}`, margin, 54);
  y = 100;

  const section = (title: string) => {
    if (y > 720) { doc.addPage(); y = 60; }
    doc.setTextColor(17, 24, 39).setFontSize(13).setFont("helvetica", "bold");
    doc.text(title, margin, y);
    y += 8;
  };

  // ------------------------------------------------------------- key metrics
  const s = data.summary;
  section("Key metrics");
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Metric", "Value", "Metric", "Value"]],
    body: [
      ["Total Pomodoros", String(s.total_pomodoros), "Total focus time", formatDuration(s.total_focus_seconds)],
      [`Focus (last ${days}d)`, formatDuration(data.daily.total_focus_seconds), `Pomodoros (last ${days}d)`, String(data.daily.total_pomodoros)],
      ["Average session", formatDuration(s.average_session_seconds), "Interrupted sessions", String(s.interrupted_sessions)],
      ["Current streak", `${s.current_streak_days} day${s.current_streak_days === 1 ? "" : "s"}`, "Longest streak", `${s.longest_streak_days} days`],
      ["Task completion", `${s.task_completion_rate}% (${s.completed_tasks}/${s.total_tasks})`, "Most productive hour", formatHour(s.most_productive_hour)],
      ["Avg. productivity rating", s.average_productivity_rating ? `${s.average_productivity_rating.toFixed(1)}/5` : "—", "Distractions logged", String(s.total_distractions)],
    ],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: PRIMARY },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28;

  // ------------------------------------------------------------- daily breakdown
  section(`Daily breakdown (last ${days} days)`);
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Date", "Focus time", "Pomodoros", "Interrupted", "Distractions"]],
    body: data.daily.series.map((p) => [
      new Date(`${p.date}T00:00`).toLocaleDateString([], { month: "short", day: "numeric" }),
      formatDuration(p.focus_seconds),
      String(p.pomodoros),
      String(p.interrupted),
      String(p.distractions),
    ]),
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: PRIMARY },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28;

  // ------------------------------------------------------------- focus hours + tasks
  section("Focus by hour of day");
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Hour", "Focus time", "Pomodoros"]],
    body: data.hours.series.filter((h) => h.focus_seconds > 0).map((h) => [
      formatHour(h.hour), formatDuration(h.focus_seconds), String(h.pomodoros),
    ]),
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: PRIMARY },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28;

  section("Tasks");
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Priority", "Completed / Total", "Completion"]],
    body: data.tasks.by_priority.map((b) => [
      PRIORITY_LABEL[b.key as TaskPriority] ?? b.key,
      `${b.completed} / ${b.total}`,
      `${b.total ? Math.round((b.completed / b.total) * 100) : 0}%`,
    ]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: PRIMARY },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28;

  // ------------------------------------------------------------- distractions + insights
  if (data.distractions.by_category.length) {
    section(`Distractions (last ${data.distractions.days} days)`);
    autoTable(doc, {
      startY: y + 8,
      margin: { left: margin, right: margin },
      head: [["Category", "Count"]],
      body: data.distractions.by_category.map((c) => [c.name, String(c.count)]),
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: PRIMARY },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28;
  }

  if (data.insights.length) {
    section("Insights");
    doc.setFontSize(9.5).setFont("helvetica", "normal").setTextColor(51, 65, 85);
    for (const ins of data.insights) {
      const lines = doc.splitTextToSize(`• ${ins.title}: ${ins.message}`, W - margin * 2);
      if (y + lines.length * 12 > 780) { doc.addPage(); y = 60; }
      doc.text(lines, margin, y + 10);
      y += lines.length * 12 + 4;
    }
  }

  footer();
  doc.save(`focusflow-report-${toISODate()}.pdf`);
}
