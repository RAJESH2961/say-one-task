import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, CheckSquare, Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

const FEATURES = [
  { icon: Timer, title: "Reliable Pomodoro timer", text: "Server-backed sessions that survive refreshes and multiple tabs." },
  { icon: CheckSquare, title: "Task management", text: "Kanban and list views with Pomodoro estimates and progress." },
  { icon: BarChart3, title: "Productivity analytics", text: "Insights from your real focus history and distractions." },
];

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const isRegister = mode === "register";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      if (isRegister) await register(fullName.trim(), email.trim(), password);
      else await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (err) {
      const apiErr = toApiError(err);
      setFieldErrors(apiErr.fieldErrors);
      setError(apiErr.code === "validation_error" ? "Please fix the highlighted fields." : apiErr.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5 text-lg font-semibold">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
            <Timer className="size-5" />
          </div>
          FocusFlow
        </div>
        <div className="relative space-y-8">
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">Do deep work, one focused session at a time.</h2>
          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-4.5" />
                </div>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-primary-foreground/75">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-sm text-primary-foreground/60">© {new Date().getFullYear()} FocusFlow</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-sm border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <Timer className="size-5" />
            </div>
            <CardTitle className="text-2xl">{isRegister ? "Create your account" : "Welcome back"}</CardTitle>
            <CardDescription>
              {isRegister ? "Start tracking focused work in seconds." : "Sign in to continue your focus streak."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" noValidate>
              {isRegister && (
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={!!fieldErrors.full_name} />
                  {fieldErrors.full_name && <p className="text-xs text-destructive">{fieldErrors.full_name}</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldErrors.email} />
                {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!fieldErrors.password}
                />
                {fieldErrors.password ? (
                  <p className="text-xs text-destructive">{fieldErrors.password}</p>
                ) : (
                  isRegister && <p className="text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
                )}
              </div>
              {error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {isRegister ? "Create account" : "Sign in"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isRegister ? "Already have an account? " : "New to FocusFlow? "}
              <Link to={isRegister ? "/login" : "/register"} className="font-medium text-primary hover:underline">
                {isRegister ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
