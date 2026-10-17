# Publishing the LMS to the live server

This page explains, in plain English, how a change made on the developer's laptop ends up on the live website that students and tutors use. No prior knowledge assumed: every command is written out, and every command says what it does and what you should see when it works.

There are three production documents and they do different jobs:

| Document | Use it when |
|----------|-------------|
| **This page (DEPLOYMENT.md)** | You want to put new code on the live site, or understand what happens when we do |
| [PROD_DEPLOYMENT.md](./PROD_DEPLOYMENT.md) | Setting up a brand-new server from scratch — done once, already done for this project |
| [OPERATIONS.md](./OPERATIONS.md) | Something broke, or a backup / restore / resize / secret change is needed |

---

## 1. The setup in one picture

```text
   Laptop                GitHub                 Lightsail server              Users
(code is written)   (shared copy of code)   (the computer that runs it)   (browsers)

   write  ──push──▶   main branch   ──pull──▶   /home/ubuntu/cognisphere-lms  ──rebuild──▶   learn.cognispheremc.com
```

Three things to understand and the rest follows:

- **GitHub is the middleman.** We never copy files onto the server by hand. Code goes laptop → GitHub → server. That way the live site always matches a known version of the code, and we can go back to an older one.
- **One rented computer runs everything.** It is an AWS Lightsail "instance" in Mumbai — think of it as a small always-on PC in a data centre. Our code lives on it in the folder `/home/ubuntu/cognisphere-lms`.
- **Five programs run side by side on it**, each in its own sealed box (a *container*), so they cannot interfere with each other:

| Container | In plain English |
|-----------|------------------|
| `lms-caddy` | The doorman. Takes every visitor from the internet, handles the padlock (HTTPS security certificate) and sends them to the right place inside. |
| `lms-frontend` | The website itself — the pages, buttons and screens people see. |
| `lms-backend` | The rule-keeper. Logins, permissions, and serving course files and videos. |
| `lms-migrate` | A one-off helper. Runs at the start of every publish, updates the shape of the database if the new code needs it, then exits. |
| `lms-postgres` | The filing cabinet. Users, courses, lessons, progress. Not reachable from the internet at all, by design. |

Uploaded course material (PDF, PPTX, MP4) is **not** inside the database. It sits on the server's disk, in a storage area that survives every publish.

---

## 2. Details for this project — fill in once

Write these down here the first time, so nobody has to go hunting in the AWS console again.

| Thing | Value |
|-------|-------|
| Site address (what users type) | `https://learn.cognispheremc.com` |
| Server static IP | `43.204.58.194` |
| How to connect | `ssh ubuntu@43.204.58.194 -i ~/.ssh/lms-prod` (or `ssh lms` if the shortcut below is set up) |
| Folder on the server | `/home/ubuntu/cognisphere-lms` |
| Code repository | `github.com/AakashChandha/cognisphere-lms`, branch `main` |
| Backup bucket | `________________` |

**Optional but worth 2 minutes:** add a shortcut on the laptop so you can type `ssh lms` instead of the long version. Open `~/.ssh/config` and add:

```text
Host lms
  HostName 43.204.58.194
  User ubuntu
  IdentityFile ~/.ssh/lms-prod
```

The rest of this page says `ssh lms`. If you skipped the shortcut, use the long form instead.

---

## 3. Before the very first publish

**For this project these are already done** — `learn.cognispheremc.com` is live and answering on HTTPS. The list is here so it can be checked after a disaster rebuild, or reused if a second environment is ever set up. Each item is described step by step in [PROD_DEPLOYMENT.md](./PROD_DEPLOYMENT.md).

- [ ] Lightsail instance created (Mumbai, 4 GB RAM) with a **static IP** attached
- [ ] Firewall allows **only** ports 22 (SSH), 80 (web) and 443 (secure web)
- [ ] Domain name points at the static IP — `A` record `learn.cognispheremc.com` → `43.204.58.194`, plain DNS with no Cloudflare proxy in front (confirmed in place)
- [ ] Backup bucket created and the instance attached to it under *Resource access*
- [ ] A read-only **deploy key** added to GitHub so the server can fetch the code
- [ ] Code cloned to `/home/ubuntu/cognisphere-lms` and `sudo scripts/server-setup.sh` has been run once
- [ ] `/home/ubuntu/cognisphere-lms/.env` filled in with the real values — `SITE_ADDRESS=learn.cognispheremc.com` and `CORS_ORIGINS=https://learn.cognispheremc.com` (both must match the domain exactly, or the padlock or the logins will fail), plus the database password and JWT secrets — **and a copy saved in the password manager**, because that file exists nowhere else
- [ ] Automatic daily snapshots and the UptimeRobot monitors switched on

After that, publishing is the short routine below, every time, forever.

---

## 4. Publishing a change — the routine

Seven steps. Roughly ten minutes, most of it waiting.

### Step 1 — On the laptop: check the work before sending it

```bash
cd ~/CGS/cognisphere-lms
cd backend  && npx tsc --noEmit && cd ..
cd frontend && npx tsc --noEmit && npm run lint && cd ..
```

These are spell-checkers for code. They print nothing (or `✔ No ESLint warnings or errors`) when all is well. **If any of them complains, stop and fix it first** — the server runs the same checks while building, and a failure there just wastes ten minutes.

### Step 2 — On the laptop: save the change as a labelled version ("commit")

```bash
git status                       # shows which files changed
git add -A                       # include all of them
git commit -m "Short description of what changed"
```

A commit is a labelled snapshot. The message matters: it is what we read later when deciding which version to go back to.

### Step 3 — On the laptop: send it to GitHub ("push")

```bash
git push origin main
```

Nothing is live yet. The code is now in the shared copy where the server can reach it.

### Step 4 — Connect to the server

```bash
ssh lms
```

You are now typing commands *on the server in Mumbai* instead of on the laptop. The prompt changes to something like `ubuntu@ip-172-26-x-x:~$`.

### Step 5 — Take a safety copy of the database (30 seconds)

Do this every time, before publishing. It costs half a minute and it is the difference between "we undo it" and "we lost today's work".

```bash
cd /home/ubuntu/cognisphere-lms
sudo sh -c '. ./.env; docker exec lms-postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > ~/pre-deploy-$(date +%Y%m%d-%H%M).sql.gz
ls -lh ~/pre-deploy-*.sql.gz
```

That writes a complete copy of the filing cabinet — every user, course, lesson and progress record — into a dated file in your home folder on the server. The last line should show the file with a size next to it.

**Why this and not just the nightly backup.** The nightly backup is up to 24 hours old. This one is seconds old, so if a publish goes wrong you lose nothing.

**What it does *not* do.** Taking the copy does not change the live database in any way — it only reads. Nothing is ever put back automatically. A copy is restored only if a human decides to, deliberately, with the restore procedure in [OPERATIONS.md](./OPERATIONS.md) section 3. A normal, successful publish leaves the copy sitting there unused, which is exactly what you want.

**Why it matters most for releases that change the database.** A publish can add new tables or columns (the `lms-migrate` step). Those changes only move forward: going back to older code does **not** undo them, so a rollback after a database change needs this copy. See section 8.

Tidy up occasionally — these files are small but they accumulate:

```bash
ls -lh ~/pre-deploy-*.sql.gz          # look first
rm ~/pre-deploy-2026*.sql.gz          # then delete the old ones you no longer want
```

### Step 6 — Run the one publish command

```bash
cd /home/ubuntu/cognisphere-lms
sudo scripts/deploy.sh
```

That is the whole deployment. There is deliberately only one command, so there is nothing to get wrong or do in the wrong order.

It prints a running commentary with timestamps and takes **3 to 6 minutes** — longer the first time, because everything is built from scratch. Leave the window open until it finishes. It ends with something like:

```text
2026-10-17 18:42:10 Deployed. 94eea57 Wrap useSearchParams pages in Suspense
NAME            STATUS
lms-backend     Up 30 seconds (healthy)
lms-caddy       Up 2 minutes
lms-frontend    Up 12 seconds
lms-postgres    Up 2 minutes (healthy)
```

**`Deployed.` plus every container `Up` is what success looks like.** The `lms-migrate` container is missing from that list on purpose — it does its job and exits.

### Step 7 — Check the live site

Three checks, in this order:

1. Open `https://learn.cognispheremc.com` in a browser. The page loads and there is a **padlock** in the address bar.
2. Open `https://learn.cognispheremc.com/api/health`. It shows `"status":"ok"`. This one proves the rule-keeper can reach the filing cabinet.
3. Log in and click through whatever was changed in this release. A green deploy means "the code is running", not "the feature is correct" — only a human clicking can tell you that.

Then type `exit` to leave the server.

---

## 5. What those 3 to 6 minutes are actually doing

Useful to know, because the log tells you which stage you are in if it ever stalls:

1. **Pulling latest code** — the server fetches the new version from GitHub. If someone edited files directly on the server, this step refuses to continue (by design: the server must match the repository).
2. **Building backend image** — packages up the new rule-keeper.
3. **Building frontend image** — packages up the new website. This is the slow part and the hungriest for memory, which is why the two builds are done one after the other, never together.
4. **Starting stack** — the migrate helper updates the database shape first, then the backend starts, then the frontend, then they swap in behind the doorman. **This is the only moment users notice anything**: a few seconds where a page may need a refresh.
5. **Cleaning up** — deletes old unused images so the disk does not slowly fill.
6. **Waiting for health** — polls `/api/health` until the site answers, for up to 2.5 minutes. If it never answers, the script stops and tells you where to look.

Two reassuring facts:

- **The old version keeps serving traffic while the new one is being built.** A build that fails changes nothing for users.
- **The database and the uploaded course files are never touched by a publish.** They live in separate storage that survives everything.

---

## 6. When to publish

- Prefer **outside class hours**. The swap is seconds, not minutes, but a tutor mid-upload would have to start that upload again.
- Never publish and then walk away. Stay for the three checks in Step 7.
- Avoid publishing on the way out on a Friday evening. If it needs undoing, you want to be awake.

---

## 7. If something goes wrong

The deploy script prints the container list when it fails, and the first thing to look at is almost always the logs:

```bash
cd /home/ubuntu/cognisphere-lms
docker compose logs --tail=100 migrate backend
```

| What you see | What it usually means | What to do |
|--------------|----------------------|------------|
| `git pull` fails with *local changes* | Somebody edited files on the server by hand | Ask the developer. `git status` on the server shows what was changed |
| Build fails, old site still works | A code mistake, or the server briefly ran out of memory | Read the last 20 lines of output. Re-running `sudo scripts/deploy.sh` fixes memory-related failures surprisingly often |
| `migrate` container exits with an error | A database update failed; the backend deliberately refuses to start on a half-updated database | `docker compose logs migrate`, then the developer. Do not improvise here |
| `API did not become healthy within 150s` | Backend starts and dies, or cannot reach the database | `docker compose logs --tail=100 backend postgres` |
| Site unreachable, no padlock, fresh server | The security certificate could not be issued — nearly always DNS not pointing at the server yet | `docker compose logs caddy`; check the domain's `A` record; wait and retry |
| Everything `Up` but the site looks wrong | The code published fine, the change itself has a bug | Roll back (next section), then fix properly |

If it is broken and the cause is not obvious: **roll back first, investigate afterwards.** A working old version beats a clever diagnosis.

---

## 8. Undoing a release (rollback)

```bash
ssh lms
cd /home/ubuntu/cognisphere-lms
git log --oneline -5                 # pick the last known-good line; copy its short code
git checkout <that code>
sudo scripts/deploy.sh --no-pull     # rebuild what is now checked out, without fetching
```

`--no-pull` is the important part: it tells the server to rebuild the older code you just selected instead of fetching the newest again.

**One real limitation.** Database changes only move forward. If the bad release changed the *shape* of the database, going back to older code is not enough on its own — the database has to be restored as well: use the safety copy from Step 5 (`~/pre-deploy-*.sql.gz`, seconds old) in preference to last night's backup, which can be up to 24 hours stale (OPERATIONS.md, section 3). Say so to the developer rather than guessing.

When the fix is ready and pushed, return the server to normal before deploying again:

```bash
git checkout main
sudo scripts/deploy.sh
```

---

## 9. Things to never do on the server

- **Never run `docker compose down -v`.** The `-v` deletes the database, every uploaded course file and the security certificates. Certificates are rate-limited, so the site can stay down for hours afterwards.
- **Never edit code files on the server.** The only file that is edited there is `.env`. Everything else arrives through GitHub, so the live site always matches a version we can identify.
- **Never open extra ports** in the Lightsail firewall. Only 22, 80 and 443. The database must stay unreachable from the internet.
- **Never lose `.env`.** It holds the database password and the login secrets, and it exists only on that server and in your password manager.

---

## 10. Quick reference

```bash
# Laptop: check, commit, send
cd ~/CGS/cognisphere-lms
cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit && npm run lint && cd ..
git add -A && git commit -m "What changed" && git push origin main

# Server: safety copy of the database, then publish
ssh lms
cd /home/ubuntu/cognisphere-lms
sudo sh -c '. ./.env; docker exec lms-postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > ~/pre-deploy-$(date +%Y%m%d-%H%M).sql.gz
sudo scripts/deploy.sh

# Check
curl -s https://learn.cognispheremc.com/api/health   # expects "status":"ok"
docker compose ps                           # everything Up, backend (healthy)

# Undo
git log --oneline -5 && git checkout <sha> && sudo scripts/deploy.sh --no-pull
```

One-line version, once the SSH shortcut exists — safety copy included, because skipping it is the one shortcut that can cost you data:

```bash
ssh lms 'cd /home/ubuntu/cognisphere-lms && sudo sh -c ". ./.env; docker exec lms-postgres pg_dump -U \$POSTGRES_USER -d \$POSTGRES_DB" | gzip > ~/pre-deploy-$(date +%Y%m%d-%H%M).sql.gz && sudo scripts/deploy.sh'
```

Backups, restores, disk space, secret changes, instance resizing and the alerts you may receive: [OPERATIONS.md](./OPERATIONS.md).
