# CGS LMS

A Learning Management System for a NEBOSH training company, built with **NestJS + Prisma + PostgreSQL** on the backend and **Next.js (App Router) + Tailwind CSS + shadcn/ui** on the frontend. Tutors publish courses with lessons and material (PDF, PPTX, MP4 video); students view them in the browser. The stack runs locally with Docker and deploys to a single AWS Lightsail instance from the same repository.

| Document | Purpose |
|----------|---------|
| [PROD_DEPLOYMENT.md](./PROD_DEPLOYMENT.md) | First-time production setup on Lightsail (about an hour, once) |
| [OPERATIONS.md](./OPERATIONS.md) | Day-to-day maintenance: deploy, roll back, restore, alerts |
| [Infrastructure plan](https://claude.ai/artifact/X3XfYcgDESCEnzcBe1ia97) | The decision write-up with budget, alternatives and rollout phases |

## Architecture Decisions

These are settled. Re-open one only if its stated reason stops being true.

| Decision | Choice | Reason |
|----------|--------|--------|
| Hosting | **One AWS Lightsail instance**, Mumbai, 4 GB RAM / 2 vCPU / 80 GB, Ubuntu 24.04 | Fixed ~$24/month, INR billing with GST invoice, users in India, one console for instance + firewall + bucket + snapshots + alarms. Load is low and there is one part-time maintainer, so one machine is the simplest thing that works. 4 GB (not 2 GB) because `next build` needs ~2 GB on its own. |
| Runtime | **Docker Compose**, the same `docker-compose.yml` as the local production run | Nothing to learn twice; the server runs exactly what you tested on your laptop. |
| Public entry / TLS | **Caddy** (replaces nginx) | Caddy obtains and renews the Let's Encrypt certificate by itself. No certbot, no renewal cron, nothing to expire. Ten-line config in `caddy/Caddyfile`. It is deliberately *not* health-gated on the backend so the site stays up while the API restarts. |
| Database | **PostgreSQL 16 in a container**, named volume, not reachable from the internet | A managed database costs another $15/month and its benefit (backups) is covered by the nightly dump below. Upgrade path exists if zero-ops DB is ever wanted. |
| Uploaded files, including video | **Local Docker volume**, streamed by NestJS with HTTP Range support via short-lived signed URLs | The instance plan includes 2 TB/month of transfer; a Lightsail bucket includes only 250 GB and charges ~₹10/GB beyond, which video would blow through. Node streams files without buffering, so serving video costs almost no CPU/RAM. Under 40 GB of material fits the 80 GB disk; a Lightsail block-storage disk can be attached later without changing the app. No server-side transcoding: tutors upload ready-to-play MP4 (H.264/AAC). |
| Backups | **Nightly `pg_dump` + file sync to a Lightsail bucket** (30 days) and **daily Lightsail snapshots** (7 kept) | Two independent safety nets for ~₹600/month: granular restore from the bucket, whole-machine restore from a snapshot. `scripts/backup.sh`, `scripts/restore-db.sh`. |
| Deploys | **SSH + `scripts/deploy.sh`** | One command. Builds on the box (sequentially, to fit in memory), runs migrations, restarts, checks health. GitHub Actions push-to-deploy is a documented later option, not a requirement. |
| Monitoring | **UptimeRobot** (free) on `/api/health` plus a backup heartbeat, and a **Lightsail status-check alarm** | Catches the site being down, the nightly backup silently failing, the disk passing 85%, and the VM dying. No log shipping, no metrics stack. |
| Environments | **Local dev + production.** No staging server | One developer, low load; the local prod-compose run is the staging step. A second instance can be added if stakeholders ever need previews. |
| Not chosen | Managed Postgres, Vercel/Render/Neon split, Hetzner/DigitalOcean, Kubernetes/ECS, object storage for video | Either more cost, more vendors and dashboards, no India region, or complexity far beyond one node. Object storage, if ever needed for video, should be Cloudflare R2 (zero egress), not a Lightsail bucket. |

Estimated running cost: about **₹3,300/month** including GST (instance ₹2,550, bucket ₹320, snapshots ₹265, domain ≈ ₹150), against a ₹5,000 cap.

## Architecture

Browser traffic enters through Caddy only.

- `caddy` is the single public entry point and terminates HTTPS in production.
- `/` is proxied to the Next.js frontend container.
- `/api` is proxied to the NestJS backend container.
- The backend is the only application service that connects to PostgreSQL.
- The REST API is kept separate from the frontend so future clients (mobile apps, etc.) can reuse it.
- PostgreSQL stores data in a named Docker volume so data survives container rebuilds.
- Uploaded course material lives in the `backend_storage` volume and is streamed by the backend.

```text
Browser -> Caddy -> Next.js (frontend)
                 -> NestJS (backend) -> PostgreSQL
                                     -> backend_storage volume (PDF / PPTX / MP4)
```

### Backend — Clean Architecture

The API is organized as feature modules, each following the same layered structure:

```text
Controller  ->  Service  ->  Prisma (repository layer)
   |              |
  DTOs        Domain logic
```

- **Controllers** only handle HTTP concerns (routing, status codes, Swagger metadata) and delegate to services.
- **Services** contain all business logic and are the only layer that talks to Prisma.
- **DTOs** (`class-validator` / `class-transformer`) validate every request body and shape every response — database models are never exposed directly.
- **Guards** (`JwtAuthGuard`, `RolesGuard`) enforce authentication and role-based authorization globally; routes opt out with `@Public()` or restrict further with `@Roles(...)`.
- A global **exception filter** normalizes every error into the same response envelope, and a global **response interceptor** wraps every success response the same way.
- **Winston** provides centralized, structured logging; **Joi** validates all environment variables at boot so misconfiguration fails fast.
- The **storage layer** is abstracted behind a `StorageService` interface, backed by the local filesystem (`LocalStorageService`). Uploads are streamed to disk by Multer (never buffered in memory) and moved into place, so multi-hundred-MB videos are fine.
- **In-browser playback** (video, PDF) uses short-lived signed URLs: the role-scoped `…/files/:id/stream-url` endpoints check enrollment/ownership and return `/api/files/stream/:id?token=…`, which `<video>`/`<iframe>` open directly. The stream route honours HTTP Range requests so seeking works.

Every endpoint is automatically documented in **Swagger** at `/api/docs` in development (disabled in production).

### Frontend — Feature-based structure

```text
src/
├── app/                  # Next.js App Router pages, grouped by role (student/tutor/master)
├── components/
│   ├── ui/               # shadcn/ui primitives (Button, Input, Dialog, Table, ...)
│   ├── shared/            # Reusable app components (DataTable, PageHeader, StatCard, ...)
│   ├── layout/           # App shell, sidebar, topbar, theme toggle
│   ├── auth/             # Route guards (RequireRole)
│   ├── profile/          # Profile + change-password forms (shared across roles)
│   ├── announcements/    # Shared announcement form dialog
│   ├── tutor/            # Tutor-only composite components (lesson/file/student managers)
│   └── master/           # Master-only composite components (user form, reset password)
├── lib/
│   ├── api/              # Typed Axios API clients, one file per backend module
│   ├── auth/             # Token storage + AuthContext
│   └── constants/        # Roles, navigation config
├── hooks/                # Reusable hooks (pagination/search state)
└── types/                # Shared TypeScript types matching backend DTOs
```

- **Authentication** uses JWT access + refresh tokens stored in `localStorage`, with automatic silent refresh on `401` via an Axios interceptor.
- **Route protection** is enforced client-side per role via `RequireRole`, which also renders the shared `AppShell` (sidebar + topbar) for authenticated layouts.
- **React Query** handles all server-state (fetching, caching, invalidation); **React Hook Form + Zod** handle all form state and validation.
- Every list page follows the same pattern: `SearchInput` + filters + `DataTable`/cards + `PaginationControls`, with consistent loading (`Skeleton`), empty (`EmptyState`), and error (`ErrorState`) states.
- Light/dark theme is provided by `next-themes` and toggled from the topbar.

## User Roles

| Role | Highlights |
|------|------------|
| **Student** | "Continue learning" dashboard, enrolled courses with progress, lesson pages (video/slides/PDF inline + Markdown notes, Previous/Next, mark complete), view-only materials in the browser (PDF, PPTX, MP4; **no downloads**), announcements, profile & password |
| **Tutor** | Dashboard with "needs your attention", course authoring (draft → publish → unpublish/archive, publish checklist), lessons with Markdown notes and drag-and-drop ordering, uploads up to 2 GB attached to a lesson or the whole course, enrol/remove students, announcements, profile |
| **Master** | Everything a tutor can do, on any course (create, edit, lessons, files, enrolments, publish; a course can be created unassigned or for a chosen tutor), plus: system-wide dashboard, people management (create with a temporary password that must be changed at first sign-in, edit, enable/disable, reset password, delete), reassign a course to another tutor, deactivate a course with a reason (students lose access, the tutor sees it read-only) and reactivate it, announcements, audit logs, profile |

Product rules worth knowing (decided with the business, see `docs/PROGRESS.md`):

- Students can never download source material; everything is viewed in the browser. Only PDF, PPTX and MP4/WebM uploads are accepted for that reason.
- Lesson completion is tracked per student but lessons are never locked (non-sequential).
- Accounts are created by an administrator only. The temporary password forces a password change at first sign-in.
- Courses and files are company material. Deleting a tutor keeps their courses as "unassigned" until an administrator reassigns them; it never deletes content.
- An administrator cannot disable or delete their own account, and the last active administrator cannot be removed.
- Students only ever see published courses. A deactivated course is hidden from students and read-only for its tutor until an administrator reactivates it (it returns as a draft).

## Project Structure

```text
cognisphere-lms/
├── frontend/
│   ├── src/                 # Next.js App Router source (see above)
│   ├── public/
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   ├── next.config.ts       # API rewrites to the backend
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── common/           # Guards, filters, interceptors, decorators, DTOs, utils
│   │   ├── config/            # Env validation, typed config, logger setup
│   │   ├── prisma/            # PrismaService/PrismaModule
│   │   └── modules/           # One folder per feature module (see below)
│   ├── prisma/
│   │   ├── schema.prisma      # Full normalized database schema
│   │   └── seed.ts            # Seeds roles + demo Master/Tutor/Student accounts
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   └── package.json
├── caddy/
│   └── Caddyfile              # Reverse proxy + automatic HTTPS (dev and prod)
├── scripts/
│   ├── server-setup.sh        # One-time Lightsail instance preparation
│   ├── deploy.sh              # The only deploy command
│   ├── backup.sh              # Nightly pg_dump + upload sync to the bucket (cron)
│   └── restore-db.sh          # Restore a dump
├── docker-compose.yml         # Production stack
├── docker-compose.dev.yml     # Development stack (hot reload)
├── .env.example
├── .gitignore
├── PROD_DEPLOYMENT.md         # First-time production setup
├── OPERATIONS.md              # Day-to-day maintenance runbook
└── README.md
```

### Backend modules

`auth`, `users`, `roles`, `students`, `tutors`, `courses`, `lessons`, `course-files`, `announcements`, `dashboard`, `profile`, `audit-logs`, `storage`, `health`.

## Environment

Create local settings from the example file:

```bash
cp .env.example .env
```

Update secrets before deploying to a real VPS:

- `POSTGRES_PASSWORD`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `MASTER_SEED_PASSWORD`
- public port values if needed

The committed `.env.example` documents every required variable. The local `.env` is ignored by Git.

## Development

Start the full development stack:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Open:

```text
http://localhost:8080
```

Use port `8080` (Caddy, configurable via `PROXY_PORT`) as the main browser entry point. It proxies `/` to Next.js and `/api` to NestJS.

You can also open the frontend directly at `http://localhost:3000`. Next.js dev rewrites proxy `/api/*` to the backend container automatically.

The backend runs `prisma migrate deploy` automatically on container start, so the schema is always up to date. To seed demo data (roles + a Master/Tutor/Student account + a sample course), run once after the stack is up:

```bash
docker exec lms-backend-dev npx prisma db seed
```

Seeded accounts (see `backend/prisma/seed.ts` and `MASTER_SEED_EMAIL`/`MASTER_SEED_PASSWORD` in `.env`). The demo tutor and student are **development only**: the seed skips them when `NODE_ENV=production`, so they never exist on the public site.

| Role | Email | Password |
|------|-------|----------|
| Master | `master@cgslms.local` (from `.env`) | from `.env` |
| Tutor | `tutor.demo@cgslms.local` | `Tutor@12345` |
| Student | `student.demo@cgslms.local` | `Student@12345` |

Swagger docs are available at `http://localhost:8080/api/docs` (or `http://localhost:5001/api/docs` directly against the backend; the host port is `BACKEND_HOST_PORT` because macOS AirPlay Receiver occupies 5000).

### Frontend Only

```bash
docker compose -f docker-compose.dev.yml up frontend
```

Useful when working on UI. The frontend is exposed at `http://localhost:3000` and proxies `/api` to the backend via Next.js rewrites. The backend container must be running for API calls to succeed.

### Backend Only

```bash
docker compose -f docker-compose.dev.yml up backend
```

Useful when working on API endpoints. The backend is exposed directly at `http://localhost:5001` (`BACKEND_HOST_PORT`), with Swagger at `http://localhost:5001/api/docs`.

### How Hot Reload Works

Development containers install dependencies during the image build, then mount your source code at runtime.

**Frontend volumes:**

- `./frontend:/app` — live source code
- `frontend_node_modules:/app/node_modules` — prevents the bind mount from hiding installed packages
- `frontend_next_cache:/app/.next` — keeps the Next.js build cache inside Docker

**Backend volumes:**

- `./backend/src:/app/src` — live API source
- `./backend/prisma:/app/prisma` — live schema/migrations/seed
- `backend_node_modules:/app/node_modules` — protects installed packages
- `backend_storage_dev:/app/storage` — persists locally-uploaded course files

Saving any source file triggers the relevant dev server (`next dev` or Nest's `start:dev` watch mode) to rebuild and restart automatically.

On Windows and macOS, `WATCHPACK_POLLING` and `CHOKIDAR_USEPOLLING` are enabled so Docker Desktop file watching works reliably.

### When `docker compose up` Is Enough

Use `docker compose -f docker-compose.dev.yml up` when you only changed:

- application source code (`frontend/src`, `backend/src`, `backend/prisma`)
- environment values in `.env`
- the Caddyfile

No rebuild is required because source is bind-mounted or config is mounted directly.

### When `docker build` Is Required

Rebuild development images when dependencies or Docker build inputs change:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Rebuild when you change:

- `package.json` or `package-lock.json`
- `Dockerfile.dev`

### Database changes (Prisma migrations)

After editing `backend/prisma/schema.prisma`, generate a new migration from inside the backend container (or locally with the same `DATABASE_URL`):

```bash
docker exec lms-backend-dev npx prisma migrate dev --name <migration-name>
```

## Production

Run the production stack locally (this doubles as the staging check before a real deploy):

```bash
docker compose up -d --build
```

Open:

```text
http://localhost
```

With `SITE_ADDRESS` empty Caddy serves plain HTTP on port 80. On the server `SITE_ADDRESS=lms.yourdomain.com` makes it serve HTTPS with an automatic certificate. See `PROD_DEPLOYMENT.md`.

Production containers:

- **frontend** — multi-stage build, Next.js standalone output, no bind mounts
- **backend** — production dependencies only, runs as the unprivileged `node` user, no bind mounts
- **migrate** — one-off job that runs `prisma migrate deploy` + `prisma db seed` (roles + master only), then exits; `backend` waits for it to succeed before starting
- **postgres** — persistent named volume, not published on the host
- **caddy** — reverse proxy + automatic HTTPS; certificates persist in the `caddy_data` volume

### When `docker compose up` Is Enough

In production, `docker compose up -d` without `--build` is enough only when:

- images already exist
- no code or dependency changes were made
- only restarting stopped containers

### When `docker build` Is Required

Always rebuild production images after code or dependency changes:

```bash
docker compose up -d --build
```

Or build a single service:

```bash
docker compose build frontend
docker compose up -d frontend
```

## Stop

Development:

```bash
docker compose -f docker-compose.dev.yml down
```

Production:

```bash
docker compose down
```

## Reset the Database

Development:

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up --build
docker exec lms-backend-dev npx prisma db seed
```

Production (local run only; **never on the server**, it also deletes uploads and TLS certificates):

```bash
docker compose down -v
docker compose up -d --build
```

## Connect to PostgreSQL

From the host machine:

```bash
psql -h localhost -p 5432 -U lms_user -d lms_db
```

From inside the PostgreSQL container:

```bash
docker compose exec postgres psql -U lms_user -d lms_db
```

Use values from `.env` if you changed them.

## View Logs

Development:

```bash
docker compose -f docker-compose.dev.yml logs -f
docker compose -f docker-compose.dev.yml logs -f frontend
docker compose -f docker-compose.dev.yml logs -f backend
```

Production:

```bash
docker compose logs -f
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f caddy
```

## API Overview

All responses share a consistent envelope:

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": { },
  "errors": null,
  "pagination": null
}
```

Key endpoint groups (see Swagger at `/api/docs` for the complete, always-up-to-date reference):

| Group | Base path |
|-------|-----------|
| Authentication | `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `POST /api/auth/change-password`, `GET /api/auth/me` |
| Student | `/api/student/dashboard`, `/api/student/courses` (with `progress`), `/api/student/lessons/:id`, `POST/DELETE /api/student/lessons/:id/complete`, `/api/student/files`, `/api/student/files/:id/stream-url`, `/api/student/profile` |
| Files | `GET /api/files/stream/:id?token=…` — token-authenticated streaming for `<video>` / `<iframe>` (supports Range) |
| Tutor | `/api/tutor/dashboard`, `/api/tutor/courses` (`/publish`, `/unpublish`, `/archive`), `/api/tutor/courses/:id/lessons/reorder`, `/api/tutor/lessons/:id`, `/api/tutor/files` (`PATCH /:id` attaches to a lesson), `/api/tutor/students`, `/api/tutor/profile` |
| Master | All `/api/tutor/courses*`, `/api/tutor/lessons*`, `/api/tutor/files*` and `/api/tutor/students/directory` routes (ownership bypassed), plus `/api/master/dashboard`, `/api/master/users`, `/api/master/tutors`, `/api/master/students`, `/api/master/courses` (`?unassigned=true`, `/:id/lessons`, `/:id/files`, `/:id/students`, `PATCH /:id/tutor`, `POST /:id/deactivate`, `POST /:id/reactivate`), `/api/master/files/:id/stream-url`, `/api/master/auditlogs`, `/api/master/roles`, `/api/master/profile` |
| Announcements | `GET/POST/PATCH/DELETE /api/announcements` (visibility and permissions vary by role) |
| Health | `GET /api/health` (unchanged, unauthenticated) |

Example login request:

```json
{
  "email": "master@cgslms.local",
  "password": "Master@12345"
}
```

## Production

First-time setup on Lightsail: **[PROD_DEPLOYMENT.md](./PROD_DEPLOYMENT.md)**. Everything after that: **[OPERATIONS.md](./OPERATIONS.md)**.

Deploying a change, once the server exists:

```bash
ssh lms 'cd /opt/lms && sudo scripts/deploy.sh'
```
