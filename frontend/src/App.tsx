import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingState } from "@/components/common/States";
import { AuthPage } from "@/pages/AuthPage";
import { useAuthStore } from "@/stores/auth";
import { useCategoriesStore } from "@/stores/categories";
import { applyTheme, cachedTheme, useSettingsStore } from "@/stores/settings";
import { useTimerStore } from "@/stores/timer";

// Route-level code splitting keeps the initial bundle small (charts load only when needed).
const page = <K extends string>(loader: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));
const DashboardPage = page(() => import("@/pages/DashboardPage"), "DashboardPage");
const TimerPage = page(() => import("@/pages/TimerPage"), "TimerPage");
const TasksPage = page(() => import("@/pages/TasksPage"), "TasksPage");
const AnalyticsPage = page(() => import("@/pages/AnalyticsPage"), "AnalyticsPage");
const HistoryPage = page(() => import("@/pages/HistoryPage"), "HistoryPage");
const JournalPage = page(() => import("@/pages/JournalPage"), "JournalPage");
const SettingsPage = page(() => import("@/pages/SettingsPage"), "SettingsPage");
const NotFoundPage = page(() => import("@/pages/NotFoundPage"), "NotFoundPage");

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <Navigate to="/" replace /> : <>{children}</>;
}

/** Clear user-scoped client state whenever the user signs out (or the token is rejected). */
function useResetOnLogout() {
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    if (!token) {
      useTimerStore.getState().reset();
      useSettingsStore.getState().reset();
      useCategoriesStore.setState({ categories: [], loaded: false });
    }
  }, [token]);
}

export default function App() {
  useResetOnLogout();
  const theme = useSettingsStore((s) => s.settings?.theme);

  useEffect(() => {
    applyTheme(theme ?? cachedTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => (theme ?? cachedTheme()) === "system" && applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <TooltipProvider delayDuration={300}>
      <BrowserRouter>
        <Suspense fallback={<LoadingState className="min-h-[50vh]" />}>
        <Routes>
          <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="timer" element={<TimerPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="journal" element={<JournalPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors closeButton theme={theme ?? cachedTheme()} />
    </TooltipProvider>
  );
}
