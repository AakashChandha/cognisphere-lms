# Production Deployment Guide

This document describes how to deploy the Cognisphere LMS stack to an Ubuntu VPS (for example Hostinger) using the production Docker Compose setup.

Production uses **`docker-compose.yml`** only.
Do **not** use `docker-compose.dev.yml` on the VPS.

---

## 1. What Production Means

| Development | Production |
|-------------|------------|
| `docker-compose.dev.yml` | `docker-compose.yml` |
| Source bind mounts + hot reload | Code baked into Docker images |
| `next dev` + Nest `start:dev` watch mode | `next build` standalone + compiled Nest (`node dist/main.js`) |
| Extra ports for debugging | Public traffic through Nginx |
| Fast local iteration | Stable, restartable, VPS-ready |

Public entry point in production: **Nginx** → frontend or API.

---

## 2. Architecture

```text
Internet users
      │
      ▼
┌─────────────────────────────────────────┐
│  Ubuntu VPS (Hostinger)                 │
│                                         │
│   Port NGINX_PORT (e.g. 80 or 8080)     │
│              │                          │
│              ▼                          │
│         ┌─────────┐                     │
│         │  Nginx  │  ← public entry     │
│         └────┬────┘                     │
│       /      │      /api                │
│      ▼       │         ▼                │
│  Frontend    │      Backend             │
│  (Next.js)   │      (NestJS)            │
│  port 3000   │      port 5000           │
│  (internal)  │      (internal)          │
│              │         │                │
│              │         ▼                │
│              │     PostgreSQL           │
│              │     port 5432            │
│              │     volume: postgres_data│
│                                         │
│   One-off `migrate` job runs Prisma     │
│   migrations + seed before `backend`    │
│   starts accepting traffic.             │
│                                         │
│   Docker network: lms_network           │
└─────────────────────────────────────────┘
```

### Containers

| Container | Built from / image | Role |
|-----------|--------------------|------|
| `lms-nginx` | `nginx:1.27-alpine` | Public reverse proxy |
| `lms-frontend` | `frontend/Dockerfile.prod` | Optimized Next.js standalone app |
| `lms-backend` | `backend/Dockerfile.prod` | NestJS REST API |
| `lms-migrate` | `backend/Dockerfile.prod` (`deps` stage) | One-off: `prisma migrate deploy` + `prisma db seed`, then exits |
| `lms-postgres` | `postgres:16-alpine` | Database |

### Ports

| Port | Exposed to internet? | Purpose |
|------|----------------------|---------|
| `NGINX_PORT` → container `80` | **Yes** | Users access the app here |
| Frontend `3000` | No (`expose` only) | Nginx → Next.js |
| Backend `5000` | No (`expose` only) | Nginx → NestJS |
| Postgres `5432` | Mapped via `POSTGRES_PORT` | Prefer firewalling in real prod |

For a hardened production VPS, restrict or remove public access to PostgreSQL so only containers can reach it.

---

## 3. How Communication Works

### A. User opens the website

```text
Browser → http://YOUR_VPS_IP:8080/   (or :80 / https://your-domain)
       → Nginx location /
       → http://frontend:3000
       → Next.js returns HTML/JS
```

### B. UI calls the API

Frontend code calls relative paths through its typed API client (`src/lib/api/*`):

```text
GET /api/student/courses
```

Browser sends the request to the same host as the page:

```text
http://YOUR_VPS/api/student/courses
  → Nginx location /api/
  → http://backend:5000/api/student/courses
  → NestJS controller → service → Prisma → PostgreSQL
  → JSON response back to browser
```

### C. Backend talks to the database

```text
NestJS (backend/src/config, backend/src/prisma)
  reads DATABASE_URL from the environment (validated at boot with Joi)
  → PrismaService (PrismaClient)
  → Docker service name "postgres" on lms_network
```

The Next.js frontend never connects to PostgreSQL directly.

### D. Important hostnames

| Name | Meaning |
|------|---------|
| `frontend`, `backend`, `postgres` | Docker DNS names inside `lms_network` |
| `localhost` on the VPS | The VPS host itself, not other containers |
| Browser URL | Public IP or domain + Nginx port |

In production, Nginx is the router for `/` and `/api`.
Do not rely on Next.js development rewrites on the VPS (they still exist as a fallback via `INTERNAL_API_URL`, but Nginx is the intended path for real traffic).

### E. Full request example (student's course list)

```text
1. Browser GET  /
2. Nginx        → frontend:3000
3. Next.js      → HTML + JS (client hydrates, reads JWT from localStorage)
4. Browser GET  /api/student/courses  (Authorization: Bearer <accessToken>)
5. Nginx        → backend:5000/api/student/courses
6. NestJS       JwtAuthGuard → RolesGuard → controller → service
7. PostgreSQL   query via Prisma
8. JSON         → Nginx → Browser → UI (React Query cache)
```

### F. Startup order

```text
postgres (healthy)
   → migrate (prisma migrate deploy && prisma db seed, then exits)
      → backend (waits for migrate to complete successfully)
         → frontend
            → nginx
```

---

## 4. Prerequisites on the VPS

### Required

1. Ubuntu VPS (20.04 / 22.04 / 24.04 recommended)
2. SSH access (root or sudo user)
3. Docker Engine
4. Docker Compose plugin
5. Git
6. Firewall rules:
   - `22` for SSH
   - `80` / `443` for HTTP/HTTPS (recommended with a domain)
   - or `8080` if you keep `NGINX_PORT=8080` for testing

### Optional but recommended

- Domain name pointed to the VPS IP
- TLS certificate (Let's Encrypt / Hostinger SSL)
- VPS snapshots or database backups

### Install Docker on Ubuntu (typical)

```bash
sudo apt update
sudo apt install -y ca-certificates curl git

# Install Docker Engine + Compose using the official Docker Ubuntu docs:
# https://docs.docker.com/engine/install/ubuntu/

sudo usermod -aG docker $USER
# Log out and back in, then verify:

docker --version
docker compose version
```

You do **not** need to install Node.js, Nginx, or PostgreSQL on the host OS. Docker runs them inside containers.

### Suggested VPS size for this project

| Stage | Suggestion |
|-------|------------|
| Initial / low traffic | 1 vCPU, 4 GB RAM, 50 GB NVMe |
| Growth / more users | 2 vCPU, 8 GB RAM, 100 GB NVMe |

---

## 5. Deployment Steps

### Step 1 — Prepare the VPS

- Create the VPS and connect over SSH
- Install Docker, Docker Compose, and Git
- Open firewall ports for SSH and HTTP(S)/8080

### Step 2 — Clone the repository

```bash
git clone <your-repository-url>
cd cognisphere-lms
```

### Step 3 — Create production environment file

```bash
cp .env.example .env
nano .env
```

Set strong values for at least:

```env
POSTGRES_PASSWORD=<strong-password>
JWT_ACCESS_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
MASTER_SEED_EMAIL=<real-admin-email>
MASTER_SEED_PASSWORD=<strong-password>
NGINX_PORT=80
```

Keep `DATABASE_URL` pointed at the `postgres` Docker Compose service name — do not change it to `localhost` inside containers.

`DATABASE_URL` must use the **same** username/password as `POSTGRES_USER` / `POSTGRES_PASSWORD`. If the password contains special characters (`@`, `#`, `%`, `/`, `:`, `?`), URL-encode them in `DATABASE_URL` (for example `@` → `%40`). Avoid `#` in `.env` values — everything after `#` is treated as a comment.

Do **not** commit `.env` to Git.

### Step 4 — Start the production stack

```bash
docker compose up -d --build
```

This will:

1. Build frontend and backend production images
2. Pull Nginx and PostgreSQL images
3. Create the Docker network and Postgres volume
4. Run the `migrate` job (Prisma migrations + seed) and wait for it to finish
5. Start the backend, frontend, and nginx containers in the background

The `migrate` job seeds the roles table and creates the Master account from `MASTER_SEED_EMAIL` / `MASTER_SEED_PASSWORD` **only if those accounts do not already exist** — it is safe to re-run `docker compose up -d --build` on subsequent deploys.

#### If `migrate` exits with code 1

Inspect the real error first:

```bash
docker compose logs migrate
docker compose run --rm migrate
```

Common causes:

| Symptom | Fix |
|---------|-----|
| `Can't reach database server at localhost` | Set `DATABASE_URL` host to `postgres` (Compose service name), not `localhost` |
| `Authentication failed` / `password authentication failed` | Make `DATABASE_URL` credentials match `POSTGRES_USER` / `POSTGRES_PASSWORD` exactly; URL-encode special characters |
| `P1001` / connection refused briefly | Postgres was not healthy yet — re-run `docker compose up -d` |
| OpenSSL / query engine errors | Rebuild after pulling the latest `backend/Dockerfile.prod` (installs `openssl` on Alpine) |

After fixing `.env` or code:

```bash
docker compose up -d --build
```

### Step 5 — Verify

```bash
docker compose ps
docker compose logs -f
curl http://localhost/api/health
```

If `NGINX_PORT=8080`:

```bash
curl http://localhost:8080/api/health
```

Swagger API docs:

```text
http://YOUR_VPS_IP:8080/api/docs
```

From your laptop:

```text
http://YOUR_VPS_IP
# or
http://YOUR_VPS_IP:8080
```

Log in with the Master account created from your `.env` values.

### Step 6 — Domain and HTTPS (recommended)

1. Point your domain A record to the VPS IP
2. Terminate TLS with Hostinger SSL, Certbot, or a reverse proxy in front of this stack
3. Application code does not need to change

---

## 6. Production Dockerfiles

### Frontend (`frontend/Dockerfile.prod`)

Multi-stage build:

1. `deps` — install dependencies (`npm ci`)
2. `builder` — run `next build` with `output: "standalone"` (see `next.config.ts`)
3. `runner` — copy only `public/`, `.next/standalone`, and `.next/static`, then run `node server.js` as a non-root user on port 3000

No source bind mounts. The built app is inside the image.

### Backend (`backend/Dockerfile.prod`)

Multi-stage build:

1. `deps` — install all dependencies and run `prisma generate`
2. `builder` — copy source and run `nest build` (outputs `dist/`)
3. `runner` — install production dependencies only, copy the generated Prisma client, `dist/`, and `prisma/`, then run `node dist/main.js` on port 5000

The `migrate` service in `docker-compose.yml` reuses the `deps` stage (which has the full `prisma` CLI and schema) purely to run `prisma migrate deploy && prisma db seed` before the API starts.

### PostgreSQL

- Data persists in the named Docker volume `postgres_data`
- Schema is managed entirely through Prisma migrations (`backend/prisma/migrations`), applied by the `migrate` service — there is no manual SQL init step

---

## 7. Day-2 Operations

| Task | Command |
|------|---------|
| Stop stack | `docker compose down` |
| Start without rebuild | `docker compose up -d` |
| Deploy new code | `git pull` then `docker compose up -d --build` |
| View logs | `docker compose logs -f` |
| Backend logs only | `docker compose logs -f backend` |
| Re-run migrations/seed manually | `docker compose run --rm migrate` |
| Reset database (destroys data) | `docker compose down -v` then `docker compose up -d --build` |

### Connect to PostgreSQL from the VPS

```bash
docker compose exec postgres psql -U lms_user -d lms_db
```

Use credentials from `.env` if you changed them.

---

## 8. Environment Variables Reference

| Variable | Purpose |
|----------|---------|
| `NGINX_PORT` | Host port mapped to Nginx |
| `FRONTEND_PORT` | Next.js listen port inside Docker |
| `BACKEND_PORT` | NestJS listen port inside Docker |
| `POSTGRES_PORT` | Host port mapped to Postgres |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Database credentials |
| `DATABASE_URL` | Full Prisma connection string (host must be `postgres` in Docker) |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN` | Access token signing secret + TTL |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Refresh token signing secret + TTL |
| `CORS_ORIGINS` | Comma-separated allowed browser origins, or `*` |
| `STORAGE_DRIVER` | `local` today; will support `s3` without code changes |
| `STORAGE_LOCAL_ROOT` | Filesystem path for uploaded course files |
| `MAX_FILE_SIZE_BYTES` | Upload size limit enforced by the backend |
| `THROTTLE_TTL_SECONDS` / `THROTTLE_LIMIT` | Rate limiting window and request cap |
| `MASTER_SEED_EMAIL` / `MASTER_SEED_PASSWORD` | Master admin account created by the seed script |

---

## 9. Production Checklist

- [ ] Docker Engine and Docker Compose installed
- [ ] Git installed
- [ ] Repository cloned on the VPS
- [ ] `.env` created with strong secrets
- [ ] `docker compose up -d --build` succeeds and `migrate` exits with code 0
- [ ] `/api/health` responds through Nginx
- [ ] `/api/docs` (Swagger) is reachable and shows every module
- [ ] Firewall allows SSH and web ports only
- [ ] PostgreSQL is not publicly open if avoidable
- [ ] Domain and HTTPS configured for real traffic
- [ ] Backup plan for Postgres volume / VPS snapshots

---

## 10. Mental Model

**Users talk only to Nginx.
Nginx talks to Next.js and NestJS.
NestJS talks to PostgreSQL through Prisma.
Everything runs as Docker containers on one Ubuntu VPS.**

No application code changes are required between local production Compose and Hostinger deployment. Clone the repo, set `.env`, then run:

```bash
docker compose up -d --build
```
