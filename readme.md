# CGS LMS

A production-style Learning Management System with separate development and production Docker workflows. The stack runs locally with Docker and deploys to an Ubuntu VPS with the same repository and no application code changes.

## Architecture

Browser traffic enters through Nginx only.

- `nginx` is the single public entry point.
- `/` is proxied to the Next.js frontend container.
- `/api` is proxied to the Express backend container.
- The backend is the only application service that connects to PostgreSQL.
- The Express API is kept separate so future mobile applications can reuse it.
- PostgreSQL stores data in a named Docker volume so data survives container rebuilds.

```text
Browser -> Nginx -> Next.js (frontend)
                 -> Express (backend) -> PostgreSQL
```

## Why Two Compose Files?

| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Local development with hot reload and bind mounts |
| `docker-compose.yml` | Production deployment with optimized images and no bind mounts |

**Development** optimizes for fast feedback:

- Frontend runs `next dev` with file watching.
- Backend runs `nodemon` and restarts on file changes.
- Source code is bind-mounted into containers.
- Named volumes protect `node_modules` and `.next` from being overwritten by host mounts.

**Production** optimizes for stability and performance:

- Frontend is built with `next build` and served via the Next.js standalone server.
- Backend runs plain `node` with production dependencies only.
- No source bind mounts; images contain the built application.
- Containers use `restart: unless-stopped` for VPS uptime.

## Project Structure

```text
lms/
├── frontend/
│   ├── app/                 # Next.js App Router
│   ├── lib/                 # API client
│   ├── public/
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   ├── nodemon.json
│   └── package.json
├── postgres/
│   └── init/
├── nginx/
│   └── default.conf.template
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .gitignore
└── README.md
```

## Environment

Create local settings from the example file:

```bash
cp .env.example .env
```

Update secrets before deploying to a real VPS:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- public port values if needed

The committed `.env.example` documents required variables. The local `.env` is ignored by Git.

## Development

Start the full development stack:

```bash
docker compose -f docker-compose.dev.yml up
```

Open:

```text
http://localhost:8080
```

Use port `8080` (Nginx) as the main browser entry point. It proxies `/` to Next.js and `/api` to Express.

You can also open the frontend directly at `http://localhost:3000`. Next.js dev rewrites proxy `/api/*` to the backend container automatically.

### Frontend Only

```bash
docker compose -f docker-compose.dev.yml up frontend
```

Useful when working on UI. The frontend is exposed at `http://localhost:3000` and proxies `/api` to the backend via Next.js rewrites. The backend container must be running for API calls to succeed.

### Backend Only

```bash
docker compose -f docker-compose.dev.yml up backend
```

Useful when working on API endpoints. The backend is exposed directly at `http://localhost:5000`.

### How Hot Reload Works

Development containers install dependencies during the image build, then mount your source code at runtime.

**Frontend volumes:**

- `./frontend:/app` — live source code
- `frontend_node_modules:/app/node_modules` — prevents the bind mount from hiding installed packages
- `frontend_next_cache:/app/.next` — keeps the Next.js build cache inside Docker

Saving any React or Next.js file triggers the Next.js dev server to rebuild and refresh the browser.

**Backend volumes:**

- `./backend/src:/app/src` — live API source
- `backend_node_modules:/app/node_modules` — protects installed packages

Saving any backend file triggers `nodemon` to restart Express automatically.

On Windows and macOS, `WATCHPACK_POLLING` and `CHOKIDAR_USEPOLLING` are enabled so Docker Desktop file watching works reliably.

### When `docker compose up` Is Enough

Use `docker compose -f docker-compose.dev.yml up` when you only changed:

- application source code (`frontend/app`, `frontend/lib`, `backend/src`)
- environment values in `.env`
- Nginx template or SQL init scripts

No rebuild is required because source is bind-mounted or config is mounted directly.

### When `docker build` Is Required

Rebuild development images when dependencies or Docker build inputs change:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Rebuild when you change:

- `package.json` or `package-lock.json`
- `Dockerfile.dev`
- `nodemon.json`

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
- **backend** — production dependencies only, no nodemon, no bind mounts
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
docker compose -f docker-compose.dev.yml up
```

Production:

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
docker compose logs -f nginx
```

## API Endpoints

- `GET /api/health`
- `POST /api/login`
- `GET /api/courses`
- `GET /api/students`

Example dummy login body:

```json
{
  "email": "admin@lms.local",
  "password": "password"
}
```

## Ubuntu VPS Deployment

On the VPS:

```bash
git clone <repository>
cd lms
cp .env.example .env
# Edit .env with production secrets
docker compose up -d --build
```

No application code changes are required. Set strong values in `.env` and configure firewall, DNS, and TLS in front of the Nginx port before real production traffic.
