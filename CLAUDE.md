# Cognisphere LMS — instructions for Claude Code

## Start of every session
1. Read `docs/PROGRESS.md` first. It holds the current state, decisions already made, and the next steps. Do not re-open settled decisions listed there.
2. Check `git status` and `git log --oneline -5` to see what is committed versus in progress.

## End of every session
When the user says "wrap up" (or runs `/wrap-up`), update `docs/PROGRESS.md` following the wrap-up skill. Never leave a session without the file reflecting what changed.

## Project in one paragraph
Learning-management system for a NEBOSH training company. One part-time developer, low load (<100 concurrent users), hard budget of ₹5,000/month. Roles: MASTER (admin), TUTOR, STUDENT. Monorepo: `backend/` (NestJS 11, Prisma 6, Postgres 16) and `frontend/` (Next.js 16, Tailwind 4, shadcn/ui, fully client-side, JWT in localStorage, axios to relative `/api`). Docker Compose with Caddy in front. Deploy target is one AWS Lightsail instance in Mumbai; see `readme.md` Architecture Decisions, `PROD_DEPLOYMENT.md`, `OPERATIONS.md`.

## How to run
- Dev stack: `docker compose -f docker-compose.dev.yml up --build` → app on `http://localhost:8080` (Caddy), backend also on `localhost:5001`. Seed demo data: `docker exec lms-backend-dev npx prisma db seed`.
- Demo logins (dev only): master@cgslms.local / Master@12345, tutor.demo@cgslms.local / Tutor@12345, student.demo@cgslms.local / Student@12345.
- Type checks: `cd backend && npx tsc --noEmit`, `cd frontend && npx tsc --noEmit`. Frontend lint: `cd frontend && npm run lint`. Backend lint is currently broken (old `.eslintrc.json` with ESLint 10).

## Working rules
- Keep it simple: no new services, vendors, or infra layers without discussing. The infra design is settled (see PROGRESS.md).
- Do not commit or push unless asked.
- Prefer editing existing modules over adding new abstractions. Backend follows NestJS module/controller/service/dto layout; frontend keeps API calls in `src/lib/api/*.api.ts` and shared UI in `src/components/shared`.
- Secrets live in `.env` (gitignored). Never print them.
