# CGS LMS

A production-grade Learning Management System built with **NestJS + Prisma + PostgreSQL** on the backend and **Next.js (App Router) + Tailwind CSS + shadcn/ui** on the frontend. The stack runs locally with Docker and deploys to an Ubuntu VPS using the same repository, with no application code changes.

## Architecture

Browser traffic enters through Nginx only.

- `nginx` is the single public entry point.
- `/` is proxied to the Next.js frontend container.
- `/api` is proxied to the NestJS backend container.
- The backend is the only application service that connects to PostgreSQL.
- The REST API is kept separate from the frontend so future clients (mobile apps, etc.) can reuse it.
- PostgreSQL stores data in a named Docker volume so data survives container rebuilds.

```text
Browser -> Nginx -> Next.js (frontend)
                 -> NestJS (backend) -> PostgreSQL
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
- The **storage layer** is abstracted behind a `StorageService` interface. Today it's backed by the local filesystem (`LocalStorageService`); swapping in an S3-backed implementation later requires no changes to controllers or services.

Every endpoint is automatically documented in **Swagger** at `/api/docs`, including request/response models, validation rules, and auth requirements.

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
| **Student** | Dashboard, browse enrolled/published courses, view lessons, download course materials, view announcements, manage profile & password |
| **Tutor** | Dashboard, full course CRUD (draft → publish → archive), lesson & file management, enroll/unenroll students, post announcements, manage profile |
| **Master** | System-wide dashboard, manage all users (create/edit/enable/disable/reset password/delete), view all tutors/students/courses, manage announcements, view audit logs, manage profile |

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
├── nginx/
│   └── default.conf.template
├── docker-compose.yml         # Production stack
├── docker-compose.dev.yml     # Development stack (hot reload)
├── .env.example
├── .gitignore
├── PROD_DEPLOYMENT.md         # VPS deployment guide
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

Use port `8080` (Nginx) as the main browser entry point. It proxies `/` to Next.js and `/api` to NestJS.

You can also open the frontend directly at `http://localhost:3000`. Next.js dev rewrites proxy `/api/*` to the backend container automatically.

The backend runs `prisma migrate deploy` automatically on container start, so the schema is always up to date. To seed demo data (roles + a Master/Tutor/Student account + a sample course), run once after the stack is up:

```bash
docker exec lms-backend-dev npx prisma db seed
```

Seeded accounts (see `backend/prisma/seed.ts` and `MASTER_SEED_EMAIL`/`MASTER_SEED_PASSWORD` in `.env`):

| Role | Email | Password |
|------|-------|----------|
| Master | `master@cgslms.local` (from `.env`) | from `.env` |
| Tutor | `tutor.demo@cgslms.local` | `Tutor@12345` |
| Student | `student.demo@cgslms.local` | `Student@12345` |

Swagger docs are available at `http://localhost:8080/api/docs` (or `http://localhost:5000/api/docs` directly against the backend).

### Frontend Only

```bash
docker compose -f docker-compose.dev.yml up frontend
```

Useful when working on UI. The frontend is exposed at `http://localhost:3000` and proxies `/api` to the backend via Next.js rewrites. The backend container must be running for API calls to succeed.

### Backend Only

```bash
docker compose -f docker-compose.dev.yml up backend
```

Useful when working on API endpoints. The backend is exposed directly at `http://localhost:5000`, with Swagger at `http://localhost:5000/api/docs`.

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
- the Nginx template

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

Start the production stack:

```bash
docker compose up -d --build
```

Open:

```text
http://localhost:8080
```

Production containers:

- **frontend** — multi-stage build, Next.js standalone output, no bind mounts
- **backend** — production dependencies only, no watch mode, no bind mounts
- **migrate** — one-off job that runs `prisma migrate deploy` + `prisma db seed`, then exits; `backend` waits for it to succeed before starting
- **postgres** — persistent named volume
- **nginx** — reverse proxy for frontend and `/api`

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

Production:

```bash
docker compose down -v
docker compose up -d --build
```

(The `migrate` service seeds automatically in production; no manual step needed.)

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
docker compose logs -f nginx
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
| Student | `/api/student/dashboard`, `/api/student/courses`, `/api/student/lessons/:id`, `/api/student/files`, `/api/student/profile` |
| Tutor | `/api/tutor/dashboard`, `/api/tutor/courses`, `/api/tutor/lessons/:id`, `/api/tutor/files`, `/api/tutor/students`, `/api/tutor/profile` |
| Master | `/api/master/dashboard`, `/api/master/users`, `/api/master/tutors`, `/api/master/students`, `/api/master/courses`, `/api/master/auditlogs`, `/api/master/roles`, `/api/master/profile` |
| Announcements | `GET/POST/PATCH/DELETE /api/announcements` (visibility and permissions vary by role) |
| Health | `GET /api/health` (unchanged, unauthenticated) |

Example login request:

```json
{
  "email": "master@cgslms.local",
  "password": "Master@12345"
}
```

## Ubuntu VPS Deployment

For the full production architecture, VPS prerequisites, communication flow, and deployment steps, see:

**[PROD_DEPLOYMENT.md](./PROD_DEPLOYMENT.md)**

Quick start on the VPS:

```bash
git clone <repository>
cd cognisphere-lms
cp .env.example .env
# Edit .env with production secrets
docker compose up -d --build
```

No application code changes are required. Set strong values in `.env` and configure firewall, DNS, and TLS in front of the Nginx port before real production traffic.


MASTER_SEED_EMAIL=master@cgslms.local
MASTER_SEED_PASSWORD=master123

student.demo@cgslms.local
Student@12345

tutor.demo@cgslms.local
Tutor@12345

http://43.204.58.194/