# FocusFlow

FocusFlow is a full-stack productivity and focused-work management application. It combines a
reliable Pomodoro timer, task management, focus-session tracking, a distraction journal and
database-driven productivity analytics in a clean, responsive SaaS dashboard.

---

## Features

- **Dashboard** – today's focus time, completed Pomodoros, tasks completed, productivity streak,
  weekly focus chart, today's tasks, recent sessions and a quick-start timer.
- **Focus Timer** – large circular countdown with Focus / Short break / Long break modes, start,
  pause, resume and reset, task selection, sound notifications and a session-completion dialog.
- **Reliable timer engine** – timestamp-based countdown (not `setInterval` decrementing), active
  state persisted in PostgreSQL, refresh recovery, cross-tab synchronisation (BroadcastChannel +
  Web Locks) and duplicate-completion protection enforced by a partial unique index.
- **Tasks** – create / edit / delete, estimated vs completed Pomodoros, priority (low / medium /
  high), categories (Work / Study / Personal + custom), start date, Kanban board with
  drag-and-drop, list view, search, sorting and filters.
- **Analytics** – daily / weekly / monthly focus time, completed Pomodoros, average session
  length, best focus hours, task completion rate, productivity trends and distraction frequency —
  all aggregated in PostgreSQL, never hardcoded.
- **Focus Insights** – deterministic rule-based insights (most productive hour, weekly Pomodoros,
  most common distraction, average rating). No external LLM required.
- **AI Coach** – optional LLM-powered coaching insights generated from your analytics via the
  Groq API (set `GROQ_API_KEY`; disabled cleanly without it).
- **PDF reports** – one-click export of the analytics report (metrics, daily breakdown, focus
  hours, tasks, distractions, insights) from the Analytics page.
- **Distraction Journal** – log distractions during focus sessions, categorize them, add notes
  and a 1–5 productivity rating, and browse history.
- **Focus History** – paginated session log with notes and reflections.
- **Settings** – timer durations, long-break interval, sound on/off + volume, theme
  (light / dark / system), auto-start breaks, timezone and daily Pomodoro goal.
- **Security** – JWT auth (bcrypt passwords), per-user data isolation, rate limiting, CORS via
  environment variables, safe error responses.
- **Logging** – structured JSON logs (`app.log`, `error.log`, `access.log`), UUID request IDs on
  every request and error, `ConcurrentRotatingFileHandler` rotation (10 MB × 10 backups),
  stack traces for unexpected errors, and redaction of passwords / tokens / emails.

## Demo account

The seed script creates a ready-made account with ~140 focus sessions, tasks and distractions so
every screen shows real data:

| | |
|---|---|
| **Email** | `demo@focusflow.dev` |
| **Password** | `Demo1234!` |

Sign in at `http://localhost:5173/login` after starting the app (see below), or register a fresh
account at `/register`.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Radix), Zustand, React Router 7, Axios, Recharts, Lucide, Sonner |
| Backend | Python 3.13, FastAPI, SQLAlchemy 2, Pydantic 2, psycopg 3, PyJWT, bcrypt, slowapi (rate limiting), concurrent-log-handler |
| Database | PostgreSQL 15+ |
| Serving | Uvicorn (dev), nginx static hosting + API proxy (production) |

## Architecture

```
Browser (React SPA, port 5173 dev / 80 prod)
        │  /api/v1/*  (Vite proxy in dev, nginx proxy in prod)
        ▼
FastAPI app (port 8000)
  middleware ── request-id + access log, CORS, rate limit
  api/v1 ────── auth · tasks · sessions · distractions · categories · settings · analytics
  services ──── business logic (timer state machine, analytics, insights)
  repositories ─ SQL queries only
  models ─────── SQLAlchemy tables
        ▼
PostgreSQL  (users, tasks, focus_sessions, distractions, categories, user_settings)
```

Design rules: endpoints handle HTTP only, services own business logic, repositories own SQL,
schemas validate at the boundary, and the database enforces invariants (FKs, unique indexes,
one-active-session partial index).

## Database structure

| Table | Purpose | Notable constraints |
|---|---|---|
| `users` | accounts | unique email, bcrypt hash |
| `user_settings` | per-user preferences (1:1) | FK → users, CASCADE |
| `categories` | system (`user_id NULL`) + user-defined task/distraction categories | unique (kind, lower(name)) partial indexes |
| `tasks` | work items | FK → users, categories; status/priority enums |
| `focus_sessions` | Pomodoro & break records | FK → users, tasks; **partial unique index**: one running/paused session per user |
| `distractions` | interruption log + rating | FK → users, sessions, categories |

All timestamps are stored in UTC; analytics convert to the user's timezone via `AT TIME ZONE`.

## Project structure

```
focusflow/
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── components/        # ui/ (shadcn), timer, tasks, charts, layout, common
│   │   ├── pages/             # Dashboard, Timer, Tasks, Analytics, History, Journal, Settings, Auth
│   │   ├── stores/            # Zustand: auth, timer, settings, categories
│   │   ├── hooks/  lib/  services/  types/
│   │   ├── App.tsx  main.tsx  index.css
│   │   └── vite-env.d.ts
│   ├── Dockerfile  nginx.conf  vite.config.ts  package.json  .env.example
│
├── backend/                   # FastAPI service
│   ├── app/
│   │   ├── api/v1/endpoints/  # route handlers
│   │   ├── core/              # config, logging, security, exceptions, rate limit
│   │   ├── middleware/        # request ID + access logging
│   │   ├── db/                # engine, session, transaction helper
│   │   ├── models/            # SQLAlchemy tables + enums
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── repositories/      # SQL access layer
│   │   ├── services/          # business logic
│   │   └── main.py            # app factory
│   ├── scripts/
│   │   ├── init_db.py         # create schema + seed system categories (idempotent)
│   │   ├── seed_demo.py       # demo account with realistic history
│   │   └── start.sh           # container entrypoint
│   ├── logs/                  # app.log · error.log · access.log (rotated)
│   ├── Dockerfile  requirements.txt  .env.example
│
├── docker-compose.yml         # Postgres + backend + frontend stack
└── .gitignore
```

## Prerequisites

- Python 3.12+ and a virtualenv
- Node.js 20+ and npm
- PostgreSQL 15+ running locally (or use Docker Compose, which includes it)

## Local setup

### 1. Database

```bash
psql -h localhost -U postgres <<'SQL'
CREATE USER focusflow WITH PASSWORD 'pick-a-password';
CREATE DATABASE focusflow OWNER focusflow;
SQL
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env: set DATABASE_URL and SECRET_KEY
#   python -c "import secrets; print(secrets.token_urlsafe(48))"

python -m scripts.init_db      # create tables + seed categories (idempotent)
python -m scripts.seed_demo    # optional: demo@focusflow.dev / Demo1234! with history

uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local     # defaults are fine for local dev
npm run dev                    # http://localhost:5173
```

The Vite dev server proxies `/api`, `/health` and `/ready` to `http://localhost:8000`
(`VITE_DEV_PROXY_TARGET`), so no CORS configuration is needed locally.

### 4. Sign in

Open http://localhost:5173/login and use `demo@focusflow.dev` / `Demo1234!`.

## Environment variables

### Backend (`backend/.env` — see `.env.example` for all options)

| Variable | Default | Description |
|---|---|---|
| `ENVIRONMENT` | `development` | `development` / `production` (controls log level & error detail) |
| `DATABASE_URL` | — | `postgresql+psycopg://user:pass@host:5432/focusflow` |
| `SECRET_KEY` | — | JWT signing secret, ≥ 32 chars |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | token lifetime (7 days) |
| `CORS_ORIGINS` | `http://localhost:5173` | comma-separated allowed origins |
| `LOG_DIR` | `logs` | log directory |
| `LOG_MAX_BYTES` / `LOG_BACKUP_COUNT` | `10485760` / `10` | rotation: 10 MB × 10 backups |
| `LOG_TO_CONSOLE` / `LOG_JSON_CONSOLE` | `true` / `true` | console output for container platforms |
| `LOG_HEALTH_CHECKS` | `false` | include /health + /ready in access log |
| `RATE_LIMIT_*` | `300/min`, `10/min` (auth), `15/min` (AI) | slowapi limits; use `redis://` URI for multi-instance |
| `GROQ_API_KEY` | *(empty)* | Groq API key for the AI coach — get one at console.groq.com/keys |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq chat model |
| `AI_TIMEOUT_SECONDS` | `30` | Groq request timeout |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | *(empty)* | API base URL; empty = same-origin (dev proxy / nginx) |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:8000` | dev-server proxy target |

## Database schema management

`python -m scripts.init_db` creates all tables from the SQLAlchemy models and seeds the built-in
categories. It is idempotent — safe to run on every start (the Docker entrypoint does exactly
this).

Note: Alembic migrations were removed in favour of `create_all` bootstrapping. If you change a
model on an existing database, apply the SQL `ALTER TABLE` yourself or drop and recreate.

## API documentation

- Interactive Swagger UI: **http://localhost:8000/docs**
- ReDoc: http://localhost:8000/redoc
- Health: `GET /health` · Readiness (incl. DB check): `GET /ready`

All endpoints are under `/api/v1` and (except auth) require `Authorization: Bearer <token>`:

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` |
| Tasks | `POST /tasks` · `GET /tasks` · `GET/PUT/DELETE /tasks/{id}` · `PATCH /tasks/{id}/status` |
| Sessions | `POST /sessions/start` · `GET /sessions/active` · `GET /sessions/history` · `POST /sessions/{id}/pause|resume|complete|interrupt` · `PATCH /sessions/{id}` |
| Distractions | `POST /distractions` · `GET /distractions` · `DELETE /distractions/{id}` |
| Categories | `GET/POST /categories` · `DELETE /categories/{id}` |
| Settings | `GET /settings` · `PUT /settings` |
| Analytics | `GET /analytics/summary|weekly|monthly|focus-hours|distractions|tasks|insights` |
| AI | `GET /ai/coach` — Groq-powered insights (`available:false` when no key configured) |

Every response includes an `X-Request-ID` header; errors return a consistent
`{"error": {"code", "message", "request_id"}}` body without internal stack traces.

## Logging

Logs are written to `backend/logs/` (a persistent volume in Docker):

| File | Contents |
|---|---|
| `app.log` | startup/shutdown, service operations, business events |
| `error.log` | unhandled exceptions and DB errors with full stack traces |
| `access.log` | one JSON line per request: method, path, status, duration, request ID, user ID |

All files are JSON-formatted, rotate at 10 MB with 10 backups via
`ConcurrentRotatingFileHandler` (safe for multi-worker deployments), and redact passwords,
tokens and email addresses. Logging failures never break a request.

## Deployment

### Docker Compose (everything, one command)

```bash
cp backend/.env.example backend/.env   # set SECRET_KEY
export POSTGRES_PASSWORD='pick-a-password'
docker compose up --build
```

- App: **http://localhost:8080** (nginx serves the SPA and proxies `/api`, `/health`, `/ready`)
- API: http://localhost:8000 (docs at `/docs`)
- Postgres data and backend logs are kept in named volumes (`pgdata`, `backend-logs`).

### Manual / PaaS

- **Backend**: `backend/Dockerfile` — non-root user, runs `init_db` then
  `uvicorn --workers $WEB_CONCURRENCY` (`scripts/start.sh`), healthcheck on `/health`,
  JSON console logging enabled by default for platform log collection.
- **Frontend**: `frontend/Dockerfile` — multi-stage build → nginx; `BACKEND_URL` env var is
  templated into `nginx.conf` at container start.
- Set `ENVIRONMENT=production`, a strong `SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS` and
  `FORWARDED_ALLOW_IPS` appropriately.

## Useful commands

```bash
# Backend
uvicorn app.main:app --reload            # dev server
python -m scripts.init_db                # (re)create schema + seed categories
python -m scripts.seed_demo --days 45    # demo data for a longer period

# Frontend
npm run dev        # dev server
npm run build      # typecheck + production build to dist/
npm run lint       # tsc typecheck only
npm run preview    # serve the production build locally
```

## AI coach (Groq)

1. Create a key at https://console.groq.com/keys
2. Add it to `backend/.env`:

   ```bash
   GROQ_API_KEY=gsk_your_key_here
   ```

3. Restart the backend (`--reload` does not watch `.env`), then open **Analytics → AI coach**
   and click **Generate insights**.

Only aggregated statistics (totals, streaks, distraction category counts) are sent to Groq —
never your email, name or session notes. When the key is unset the endpoint returns
`available: false` and the UI shows a setup hint instead of an error.

## Known limitations

- Refreshing tokens requires re-login (no refresh-token rotation yet).
- Rate limiting uses in-memory storage; configure `RATE_LIMIT_STORAGE_URI=redis://…` for
  multi-instance deployments.
- Timer cross-tab coordination uses Web Locks where available and falls back to
  BroadcastChannel ordering — duplicate completions are rejected server-side regardless.
- Schema changes are managed by `scripts/init_db.py` (`create_all`), not versioned migrations.
