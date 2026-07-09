# CGS LMS

A production-style Learning Management System scaffold that runs locally with Docker and can be copied to an Ubuntu VPS with minimal changes.

## Architecture

Browser traffic enters through Nginx only.

- `nginx` serves as the public reverse proxy.
- `/` is forwarded to the React frontend container.
- `/api` is forwarded to the Express backend container.
- The backend is the only application service that connects to PostgreSQL.
- PostgreSQL stores data in a named Docker volume so data survives rebuilds.

## Containers

- `frontend`: builds the React + Vite app and serves the static bundle.
- `backend`: runs the Node.js + Express API.
- `postgres`: runs PostgreSQL and initializes schema/seed data on first volume creation.
- `nginx`: exposes the single browser-facing HTTP port and proxies traffic internally.

All containers join the `lms_network` Docker network.

## Folder Structure

```text
lms/
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   ├── Dockerfile
│   └── package.json
├── postgres/
│   └── init/
├── nginx/
│   └── default.conf.template
├── docker-compose.yml
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

## Start

```bash
docker compose up --build
```

Open:

```text
http://localhost:8080
```

If you change `NGINX_PORT`, use that port instead.

## Stop

```bash
docker compose down
```

## Rebuild

```bash
docker compose up --build
```

For a detached VPS-style run:

```bash
docker compose up -d --build
```

## Reset the Database

This removes the PostgreSQL Docker volume and reruns SQL initialization scripts on next startup:

```bash
docker compose down -v
docker compose up --build
```

## Connect to PostgreSQL

From the host machine:

```bash
psql -h localhost -p 5432 -U lms_user -d lms_db
```

Or from inside the PostgreSQL container:

```bash
docker compose exec postgres psql -U lms_user -d lms_db
```

Use values from `.env` if you changed them.

## View Logs

All services:

```bash
docker compose logs -f
```

Single service:

```bash
docker compose logs -f backend
docker compose logs -f frontend
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

## Future Ubuntu VPS Deployment

On the VPS:

```bash
git clone <repository>
cd lms
cp .env.example .env
docker compose up -d --build
```

Before production use, set strong values in `.env` and place the VPS firewall/reverse proxy/DNS configuration around the exposed Nginx port.
