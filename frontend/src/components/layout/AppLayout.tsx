import { Suspense, useEffect, useState } from "react";
import { LoadingState } from "@/components/common/States";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  CheckSquare,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Timer,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TimerEngine } from "@/components/timer/TimerEngine";
import { MiniTimer } from "@/components/timer/MiniTimer";
import { SessionCompleteDialog } from "@/components/timer/SessionCompleteDialog";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useCategoriesStore } from "@/stores/categories";
import { useSettingsStore } from "@/stores/settings";
import { useTimerStore } from "@/stores/timer";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/timer", label: "Focus Timer", icon: Timer },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/history", label: "Focus History", icon: History },
  { to: "/journal", label: "Distraction Journal", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Timer className="size-4.5" />
      </div>
      <span className="text-lg font-semibold tracking-tight">FocusFlow</span>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )
          }
        >
          <Icon className="size-4.5 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function ThemeToggle() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      disabled={!settings}
      onClick={() => void update({ theme: isDark ? "light" : "dark" })}
    >
      {isDark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </Button>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const initials = (user?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium md:inline">{user?.full_name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user?.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <NavLink to="/settings">
            <Settings className="size-4" /> Settings
          </NavLink>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout} variant="destructive">
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const loadSettings = useSettingsStore((s) => s.load);
  const loadCategories = useCategoriesStore((s) => s.load);
  const timerError = useTimerStore((s) => s.error);
  useSettingsStore((s) => s.settings?.theme); // re-render on theme change (ThemeToggle icon)

  useEffect(() => {
    void loadSettings().catch(() => undefined);
    void loadCategories().catch(() => undefined);
  }, [loadSettings, loadCategories]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-svh bg-background">
      <TimerEngine />
      <SessionCompleteDialog />

      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
        <Logo />
        <div className="mt-8 flex-1 overflow-y-auto">
          <NavItems />
        </div>
        <MiniTimer variant="sidebar" />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col px-3 py-5">
            <Logo />
            <div className="mt-8 flex-1">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
            <MiniTimer variant="sidebar" />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <div className="lg:hidden">
            <span className="font-semibold">FocusFlow</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <MiniTimer variant="header" />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        {timerError && (
          <div className="border-b border-destructive/20 bg-destructive/5 px-6 py-2 text-xs text-destructive">
            Timer sync problem: {timerError}
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div key={location.pathname} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
            <Suspense fallback={<LoadingState className="min-h-[40vh]" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
