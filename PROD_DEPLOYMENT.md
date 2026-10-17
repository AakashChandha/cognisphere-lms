# Production Deployment (first-time setup)

How to stand up the LMS on **one AWS Lightsail instance**. Takes about an hour, once. After this, publishing a change is [DEPLOYMENT.md](./DEPLOYMENT.md) and everything else you do day to day is in [OPERATIONS.md](./OPERATIONS.md). Why the setup looks like this is in the README's *Architecture Decisions*.

```text
Browser ──HTTPS──▶ Caddy ──▶ /api/*  ──▶ NestJS ──▶ Postgres (container)
                          └─▶ /*     ──▶ Next.js      └─▶ uploads volume (PDF, PPTX, MP4)

nightly 02:30   pg_dump + file sync ──▶ Lightsail bucket (30 days kept)
daily           Lightsail snapshot of the whole instance (7 kept)
alerts          UptimeRobot (site + backup heartbeat), Lightsail status alarm
```

Containers on the instance (`docker-compose.yml`):

| Container | Role |
|-----------|------|
| `lms-caddy` | Public entry on 80/443. Gets and renews the Let's Encrypt certificate itself. Routes `/api` to the backend, everything else to the frontend. |
| `lms-frontend` | Next.js standalone build |
| `lms-backend` | NestJS API; streams uploaded files, including video with Range requests |
| `lms-migrate` | Runs once per deploy: Prisma migrations + seed (roles and master account only) |
| `lms-postgres` | PostgreSQL 16, reachable only from other containers |

---

## 0. Before you start

- A domain name you control (any registrar). Below it is called `lms.yourdomain.com`.
- An AWS account (bills in INR with GST for Indian accounts).
- Your SSH public key (`~/.ssh/id_ed25519.pub`; create one with `ssh-keygen -t ed25519` if needed).
- A free [UptimeRobot](https://uptimerobot.com) account.

Monthly cost at the time of writing: instance $24 + bucket $3 + snapshots ≈ $2.5, about ₹3,300 with GST.

## 1. Create the instance

Lightsail console → **Create instance**

| Setting | Value |
|---------|-------|
| Region | Asia Pacific (Mumbai), `ap-south-1` |
| Platform | Linux/Unix |
| Blueprint | **OS only → Ubuntu 24.04 LTS** |
| SSH key | Upload your public key |
| Plan | **4 GB RAM, 2 vCPU, 80 GB SSD** ($24/month) |
| Name | `lms-prod` |

Do not pick a smaller plan: building the frontend needs more memory than 2 GB.

## 2. Static IP and firewall

1. Networking → **Create static IP** → attach to `lms-prod`. Note the address.
2. Instance → Networking → **IPv4 firewall**. Keep exactly these rules and delete anything else:

| Application | Port | Restrict to |
|-------------|------|-------------|
| SSH | 22 | Your IP (optional but recommended) |
| HTTP | 80 | Anywhere |
| HTTPS | 443 | Anywhere |

Nothing else is ever opened. Postgres is not reachable from outside by design.

## 3. DNS

At your registrar (or a Lightsail DNS zone), create:

```text
A    lms.yourdomain.com    →   <static IP>
```

Plain DNS only. Do not put Cloudflare's proxy in front; Caddy needs to answer on port 80 itself to obtain its certificate. Wait until `dig +short lms.yourdomain.com` returns the IP before step 7.

## 4. Backup bucket

1. Lightsail → Storage → **Create bucket** → region Mumbai → plan **100 GB ($3/month)** → name e.g. `cgs-lms-backups`.
2. Bucket → **Resource access** → attach `lms-prod`. The instance can then read and write the bucket without any stored keys.
3. Leave the bucket private (the default).

## 5. GitHub deploy key

The instance pulls the private repository with its own read-only key.

```bash
ssh ubuntu@<static IP>
ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519 -C lms-prod
cat ~/.ssh/id_ed25519.pub
```

GitHub → repository → Settings → Deploy keys → Add → paste the key, **read-only**.

## 6. Prepare the server

Still on the instance:

```bash
sudo git clone git@github.com:<you>/cognisphere-lms.git /home/ubuntu/cognisphere-lms
sudo chown -R ubuntu:ubuntu /home/ubuntu/cognisphere-lms
cd /home/ubuntu/cognisphere-lms
sudo scripts/server-setup.sh
```

The script installs Docker, log rotation, a 2 GB swapfile, automatic security updates (reboot at 04:00 IST if needed), the AWS CLI, and the nightly backup cron job. It is safe to re-run. Log out and back in afterwards so your user can run `docker` without `sudo`.

## 7. Configure and deploy

```bash
cd /home/ubuntu/cognisphere-lms
cp .env.example .env
nano .env
```

Set at least:

```env
SITE_ADDRESS=lms.yourdomain.com
CORS_ORIGINS=https://lms.yourdomain.com
POSTGRES_PASSWORD=<openssl rand -hex 24>
DATABASE_URL=postgresql://lms_user:<same password>@postgres:5432/lms_db
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>   # different from the access secret
MASTER_SEED_EMAIL=<your real admin email>
MASTER_SEED_PASSWORD=<strong password>
BACKUP_BUCKET=cgs-lms-backups
```

**Copy the finished `.env` into your password manager now.** It is the only place these values exist.

Then:

```bash
sudo scripts/deploy.sh
```

First run takes 5 to 10 minutes (image builds). It ends with the container table and a successful health check. Caddy obtains the certificate during the first minute; if `https://lms.yourdomain.com` is not up after two minutes, `docker compose logs caddy` will say why (almost always DNS not propagated yet).

## 8. Verify

- `https://lms.yourdomain.com` loads with a padlock; `http://` redirects to `https://`.
- `https://lms.yourdomain.com/api/health` returns `"status":"ok"`.
- `https://lms.yourdomain.com/api/docs` returns 404 (Swagger is off in production).
- Log in with `MASTER_SEED_EMAIL`. Create a tutor and a student. Make sure `tutor.demo@cgslms.local` does **not** exist (Master → Users).
- As the tutor, upload a PDF and an MP4; as the student, open both. The video should start within seconds and seeking should work.
- On the instance: `docker compose ps` shows every container `Up` and the backend `(healthy)`; `free -m` shows swap.

## 9. Snapshots and alarms

1. Instance → **Snapshots** → enable **automatic snapshots** (daily; Lightsail keeps the last seven).
2. Instance → **Alarms** → add one for **Status check failed** → notify by email. Skip the CPU alarm: builds max out the CPU on every deploy and would page you for nothing.

## 10. UptimeRobot

1. **HTTP(s) monitor** on `https://lms.yourdomain.com/api/health`, every 5 minutes, email alert.
2. **Heartbeat monitor**, expected every 24 hours (allow a 2-hour grace). Copy its URL into `.env` as `HEARTBEAT_URL=` and run `docker compose up -d` (not strictly needed; only the backup script reads it).

## 11. Rehearse the backup once

```bash
sudo scripts/backup.sh
aws s3 ls s3://cgs-lms-backups/db/
sudo scripts/restore-db.sh /var/backups/lms/db-<date>.dump
```

The heartbeat in UptimeRobot should turn green and the restore should finish without errors. You now know the recovery path works before you ever need it.

### The pre-deploy dump (every deploy, not just the nightly backup)

The nightly `scripts/backup.sh` can be up to 24 hours old, so every deploy is preceded by a fresh dump taken by hand immediately before `scripts/deploy.sh` runs:

```bash
cd /home/ubuntu/cognisphere-lms
sudo sh -c '. ./.env; docker exec lms-postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > ~/pre-deploy-$(date +%Y%m%d-%H%M).sql.gz
```

It is read-only: it copies the database out and never writes to it, and it is restored only if a human chooses to, with `scripts/restore-db.sh`. A successful deploy leaves the file unused. It earns its keep when a release adds tables or columns, because Prisma migrations are forward-only — `git checkout <old sha> && scripts/deploy.sh --no-pull` reverts the code but not the schema, and this dump is then the only seconds-old copy of the data. The step-by-step version for a non-developer is [DEPLOYMENT.md](./DEPLOYMENT.md) Step 5.

## 12. Optional: SSH alias on your laptop

```text
# ~/.ssh/config
Host lms
  HostName <static IP>
  User ubuntu
  IdentityFile ~/.ssh/id_ed25519
```

From then on, deploying is:

```bash
ssh lms 'cd /home/ubuntu/cognisphere-lms && sudo sh -c ". ./.env; docker exec lms-postgres pg_dump -U \$POSTGRES_USER -d \$POSTGRES_DB" | gzip > ~/pre-deploy-$(date +%Y%m%d-%H%M).sql.gz && sudo scripts/deploy.sh'
```

---

## Environment variable reference

| Variable | Purpose |
|----------|---------|
| `SITE_ADDRESS` | Public hostname. Caddy provisions HTTPS for it. Empty or `:80` means plain HTTP (dev). |
| `PROXY_PORT` | Dev only: host port for the local proxy (default 8080). |
| `FRONTEND_PORT` / `BACKEND_PORT` | Internal container ports. |
| `POSTGRES_PORT` | Dev only: host port for a local SQL client. Not published in production. |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Database credentials. |
| `DATABASE_URL` | Prisma connection string; host must be `postgres`. |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN` | Access token secret + lifetime. Also signs video/PDF stream links. |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Refresh token secret + lifetime. |
| `CORS_ORIGINS` | Allowed browser origins; the site URL in production. |
| `STORAGE_DRIVER` / `STORAGE_LOCAL_ROOT` | `local` and the in-container path of the uploads volume. |
| `MAX_FILE_SIZE_BYTES` | Per-file upload limit (default 2 GB). Caddy enforces the same ceiling. |
| `STREAM_URL_TTL_SECONDS` | How long a video/PDF stream link stays valid (default 1 hour). |
| `THROTTLE_TTL_SECONDS` / `THROTTLE_LIMIT` | API rate limit per client IP. |
| `MASTER_SEED_EMAIL` / `MASTER_SEED_PASSWORD` | Master account created on first boot. |
| `BACKUP_BUCKET` / `AWS_DEFAULT_REGION` | Where `scripts/backup.sh` sends backups. |
| `HEARTBEAT_URL` | UptimeRobot heartbeat pinged after a successful backup. |
