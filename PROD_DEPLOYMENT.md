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
| `next dev` + `nodemon` | `next build` standalone + plain `node` |
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
│  (Next.js)   │      (Express)           │
│  port 3000   │      port 5000           │
│  (internal)  │      (internal)          │
│              │         │                │
│              │         ▼                │
│              │     PostgreSQL           │
│              │     port 5432            │
│              │     volume: postgres_data│
│                                         │
│   Docker network: lms_network           │
└─────────────────────────────────────────┘
```

### Containers

| Container | Built from / image | Role |
|-----------|--------------------|------|
| `lms-nginx` | `nginx:1.27-alpine` | Public reverse proxy |
| `lms-frontend` | `frontend/Dockerfile.prod` | Optimized Next.js app |
| `lms-backend` | `backend/Dockerfile.prod` | Express API |
| `lms-postgres` | `postgres:16-alpine` | Database |

### Ports

| Port | Exposed to internet? | Purpose |
|------|----------------------|---------|
| `NGINX_PORT` → container `80` | **Yes** | Users access the app here |
| Frontend `3000` | No (`expose` only) | Nginx → Next.js |
| Backend `5000` | No (`expose` only) | Nginx → Express |
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

Frontend code uses relative paths:

```text
fetch('/api/courses')
```

Browser sends the request to the same host as the page:

```text
http://YOUR_VPS/api/courses
  → Nginx location /api/
  → http://backend:5000/api/courses
  → Express → PostgreSQL
  → JSON response back to browser
```

### C. Backend talks to the database

```text
Express (backend/src/config/env.js)
  uses DB_HOST=postgres, DB_NAME, DB_USER, DB_PASSWORD
  → backend/src/models/db.js (pg Pool)
  → Docker service name "postgres" on lms_network
```

The React frontend never connects to PostgreSQL.

### D. Important hostnames

| Name | Meaning |
|------|---------|
| `frontend`, `backend`, `postgres` | Docker DNS names inside `lms_network` |
| `localhost` on the VPS | The VPS host itself, not other containers |
| Browser URL | Public IP or domain + Nginx port |

In production, Nginx is the router for `/` and `/api`.  
Do not rely on Next.js development rewrites on the VPS.

### E. Full request example (students list)

```text
1. Browser GET  /
2. Nginx        → frontend:3000
3. Next.js      → HTML + JS
4. Browser GET  /api/students
5. Nginx        → backend:5000/api/students
6. Express      route → controller → service
7. PostgreSQL   query via pg Pool
8. JSON         → Nginx → Browser → UI
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

You do **not** need to install Node.js, Nginx, or PostgreSQL on the host OS.  
Docker runs them inside containers.

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
JWT_SECRET=<long-random-secret>
NGINX_PORT=80
```

Keep:

```env
DB_HOST=postgres
```

`postgres` is the Docker Compose service name. Do not change it to `localhost` inside containers.

Do **not** commit `.env` to Git.

### Step 4 — Start the production stack

```bash
docker compose up -d --build
```

This will:

1. Build frontend and backend production images
2. Pull Nginx and PostgreSQL images
3. Create the Docker network and Postgres volume
4. Start all four containers in the background

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

From your laptop:

```text
http://YOUR_VPS_IP
# or
http://YOUR_VPS_IP:8080
```

### Step 6 — Domain and HTTPS (recommended)

1. Point your domain A record to the VPS IP
2. Terminate TLS with Hostinger SSL, Certbot, or a reverse proxy in front of this stack
3. Application code does not need to change

---

## 6. Production Dockerfiles

### Frontend (`frontend/Dockerfile.prod`)

1. Install dependencies (`npm ci`)
2. Run `next build` with standalone output
3. Run `node server.js` on port 3000

No source bind mounts. The built app is inside the image.

### Backend (`backend/Dockerfile.prod`)

1. Install production dependencies only
2. Copy `src/`
3. Run `node src/server.js`

No nodemon in production.

### PostgreSQL

- On first start with an empty volume, runs SQL in `postgres/init/`
- Data persists in Docker volume `postgres_data`

---

## 7. Day-2 Operations

| Task | Command |
|------|---------|
| Stop stack | `docker compose down` |
| Start without rebuild | `docker compose up -d` |
| Deploy new code | `git pull` then `docker compose up -d --build` |
| View logs | `docker compose logs -f` |
| Backend logs only | `docker compose logs -f backend` |
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
| `BACKEND_PORT` | Express listen port inside Docker |
| `POSTGRES_PORT` | Host port mapped to Postgres |
| `POSTGRES_DB` | Database name created by Postgres |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `DB_HOST` | Must be `postgres` in Docker |
| `DB_PORT` | Usually `5432` |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Used by Express (mapped from Postgres vars in Compose) |
| `JWT_SECRET` | Secret for auth token generation |

---

## 9. Production Checklist

- [ ] Docker Engine and Docker Compose installed
- [ ] Git installed
- [ ] Repository cloned on the VPS
- [ ] `.env` created with strong secrets
- [ ] `docker compose up -d --build` succeeds
- [ ] `/api/health` responds through Nginx
- [ ] Firewall allows SSH and web ports only
- [ ] PostgreSQL is not publicly open if avoidable
- [ ] Domain and HTTPS configured for real traffic
- [ ] Backup plan for Postgres volume / VPS snapshots

---

## 10. Mental Model

**Users talk only to Nginx.  
Nginx talks to Next.js and Express.  
Express talks to PostgreSQL.  
Everything runs as Docker containers on one Ubuntu VPS.**

No application code changes are required between local production Compose and Hostinger deployment.  
Clone the repo, set `.env`, then run:

```bash
docker compose up -d --build
```
