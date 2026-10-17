# Operations Runbook

Day-to-day maintenance of the production LMS. If a task is not on this page, it is not part of the design.

Everything runs on **one Lightsail instance** (Mumbai, 4 GB) from `/home/ubuntu/cognisphere-lms` with `docker compose`. First-time setup lives in [PROD_DEPLOYMENT.md](./PROD_DEPLOYMENT.md), the plain-English walkthrough of publishing a change in [DEPLOYMENT.md](./DEPLOYMENT.md); the reasoning behind the setup is in the README's *Architecture Decisions* section.

Conventions used below:

```bash
ssh lms            # an SSH alias for ubuntu@<static-ip>; see PROD_DEPLOYMENT.md
cd /home/ubuntu/cognisphere-lms        # every command assumes this directory
```

---

## The whole list at a glance

| Task | How | How often |
|------|-----|-----------|
| Deploy new code | `sudo scripts/deploy.sh` | Whenever you merge to `main` |
| Roll back a bad release | `git checkout <sha>` then `sudo scripts/deploy.sh --no-pull` | Rare |
| Restore the database | `sudo scripts/restore-db.sh <dump>` | Rare; rehearsed once |
| Restore uploaded files | `aws s3 sync` from the bucket into the volume | Rare |
| Rebuild the whole machine | Restore the latest Lightsail snapshot, move the static IP | Disaster only |
| Rotate secrets | Edit `.env`, `docker compose up -d` | Yearly, or on suspicion |
| Disk filling up | Prune Docker, then grow storage | When the heartbeat alert fires |
| Resize the instance | Snapshot → bigger instance → move static IP | If 4 GB ever feels tight |
| OS security patches | Automatic, reboot at 04:00 IST if needed | Nothing to do |
| Look at logs | `docker compose logs -f backend` | When debugging |
| Check backups happened | UptimeRobot heartbeat, or `tail /var/log/lms-backup.log` | Glance weekly |

---

## 1. Deploy new code

```bash
ssh lms
cd /home/ubuntu/cognisphere-lms
sudo scripts/deploy.sh
```

What it does: `git pull`, builds the backend image then the frontend image (one at a time, to stay inside 4 GB), runs database migrations, restarts containers, prunes old images, and waits until `/api/health` answers. Expect 3 to 6 minutes, of which the site is unavailable for a few seconds while containers swap.

If it fails, the script prints `docker compose ps`. Look at:

```bash
docker compose logs --tail=100 migrate backend
```

The previous images are still on disk, so a failed build leaves the old version running.

## 2. Roll back a bad release

```bash
cd /home/ubuntu/cognisphere-lms
git log --oneline -5             # find the last good commit
git checkout <sha>
sudo scripts/deploy.sh --no-pull
```

**Migrations only roll forward.** If the bad release added a migration that changed data, a code rollback is not enough: restore last night's dump (section 3) and then redeploy the good commit. When you are back on `main`, run `git checkout main` before the next normal deploy.

## 3. Restore the database

Dumps are made nightly at 02:30 IST and kept 30 days, both locally in `/var/backups/lms/` and in the bucket under `db/`.

```bash
ls -lh /var/backups/lms/                              # local copies
aws s3 ls s3://<BACKUP_BUCKET>/db/                    # bucket copies
sudo scripts/restore-db.sh /var/backups/lms/db-20261016-0230.dump
# or straight from the bucket:
sudo scripts/restore-db.sh s3://<BACKUP_BUCKET>/db/db-20261016-0230.dump
```

The script stops the app, drops and recreates the database, restores, and starts the app. It asks for a typed `yes` first. Everyone is logged out afterwards (refresh tokens live in the database).

Rehearse this once right after go-live so you know it works before you need it.

**Prefer a pre-deploy dump when one exists.** Every deploy is preceded by a hand-taken dump ([DEPLOYMENT.md](./DEPLOYMENT.md) Step 5), which is seconds old rather than up to 24 hours:

```bash
ls -lh ~/pre-deploy-*.sql.gz
cd /home/ubuntu/cognisphere-lms
gunzip -c ~/pre-deploy-20261017-2138.sql.gz > /tmp/restore.sql
sudo sh -c '. ./.env; docker exec -i lms-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /tmp/restore.sql
rm /tmp/restore.sql
```

Those are plain `pg_dump` SQL, not the custom-format `.dump` files `restore-db.sh` takes, so they go back in through `psql` as above — into an empty database, after `docker compose stop backend frontend`.

## 4. Restore uploaded files

Course files are synced nightly to the bucket under `storage/`, mirroring the `backend_storage` Docker volume.

```bash
vol=$(docker volume ls -q --filter label=com.docker.compose.volume=backend_storage)
path=$(docker volume inspect -f '{{ .Mountpoint }}' "$vol")
sudo aws s3 sync s3://<BACKUP_BUCKET>/storage/ "$path"
sudo chown -R 1000:1000 "$path"                      # the API runs as the `node` user (uid 1000)
```

Database rows and files are restored independently; a file whose row is gone simply sits unused, and a row whose file is gone shows an error when a student opens it.

## 5. Rebuild the whole machine (disaster)

Lightsail takes a snapshot of the instance every day and keeps seven.

1. Lightsail console → Snapshots → pick the latest → *Create new instance* (same plan).
2. Networking → detach the static IP from the dead instance, attach it to the new one.
3. SSH in, `cd /home/ubuntu/cognisphere-lms`, `docker compose ps`. Everything should already be running.
4. If the snapshot is older than the last backup, restore the newer dump and files (sections 3 and 4).
5. Re-attach the new instance to the bucket under *Resource access* so backups keep working.

## 6. Rotate secrets

```bash
cd /home/ubuntu/cognisphere-lms
nano .env                         # change the value(s)
docker compose up -d              # restarts only the containers whose env changed
```

- Changing `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` logs everyone out and invalidates video/PDF links in open tabs. Do it outside class hours.
- Changing `POSTGRES_PASSWORD` also requires changing it inside Postgres first: `docker compose exec postgres psql -U lms_user -d lms_db -c "ALTER USER lms_user PASSWORD 'new';"`, then update both `POSTGRES_PASSWORD` and `DATABASE_URL` in `.env`.
- After any change, put the new `.env` in your password manager. It exists nowhere else.

## 7. Disk filling up

The backup script refuses to report success when the root disk is over 85% full, so the UptimeRobot heartbeat goes red. Check:

```bash
df -h /
docker system df
du -sh /var/lib/docker/volumes/*/_data 2>/dev/null | sort -h
```

**What normal looks like**, measured on 17 Oct 2026 with 4 users and 2 uploaded files — about 18 GB of the 58 GB usable, and almost none of it data:

| Using it | Size | Is it garbage? |
|---|---|---|
| `/swapfile` | 6.0 GB | No — deliberate. `next build` needs ~2 GB and the instance has under 2 GB of RAM, so the build runs on swap |
| `/var/lib/containerd` | 8.0 GB | Partly. This is where Docker's images **and build cache** really live; the build cache alone was 6.3 GB, 5.2 GB of it reclaimable |
| `/usr` + `/var/lib/{snapd,apt,dpkg}` | ~3.2 GB | No — the operating system |
| `/var/log/journal` | ~160 MB | Capped by log rotation; vacuum if it grows |
| Postgres data | ~9 MB | No — this is the actual database |
| Uploaded course files | ~1.2 MB | No — this is the actual course material |

Two traps when reading those numbers:

- **`du -sh /var/lib/docker` tells you almost nothing** (90 MB here). Images and build cache sit under `/var/lib/containerd`. Use `docker system df` for the real figures.
- **Images and build cache grow with every deploy, not with usage.** `deploy.sh` prunes images and build cache older than 7 days, so several deploys inside a week leave the cache at a few GB. That is the normal reason the disk creeps up on a site with no data on it.

In order:

1. `docker builder prune -af` and `docker image prune -af` (reclaims build cache and unused images; harmless — the next deploy just rebuilds from scratch and takes a few minutes longer).
2. `sudo journalctl --vacuum-size=200M`.
3. If uploads are the reason, attach a **Lightsail block storage disk**: console → Storage → Create disk (e.g. 64 GB, about $6/month) → attach to the instance. Then move the volume onto it:
   ```bash
   docker compose stop backend
   sudo mkfs.ext4 /dev/xvdf && sudo mkdir -p /mnt/uploads && sudo mount /dev/xvdf /mnt/uploads
   vol=$(docker volume ls -q --filter label=com.docker.compose.volume=backend_storage)
   sudo rsync -a "$(docker volume inspect -f '{{ .Mountpoint }}' "$vol")/" /mnt/uploads/
   ```
   add the disk to `/etc/fstab`, change the `backend_storage` volume in `docker-compose.yml` to a bind mount of `/mnt/uploads`, and `docker compose up -d`. No application change.

## 8. Resize the instance

Only if deploys or playback feel slow and `free -m` / `docker stats` show memory pressure.

1. Lightsail → instance → Snapshots → *Create snapshot* (manual, so you are not waiting for the nightly one).
2. From that snapshot, *Create new instance* with the larger plan (8 GB is $44/month, still under budget).
3. Move the static IP to the new instance, verify the site, delete the old instance.

About 15 minutes of downtime. Do it outside class hours.

## 9. OS updates

`unattended-upgrades` installs security updates daily and reboots at 04:00 IST only when a kernel update requires it. Docker brings every container back up on boot. Nothing to do; if you want to see what happened:

```bash
tail -50 /var/log/unattended-upgrades/unattended-upgrades.log
```

Docker Engine itself is updated the same way. A Docker restart stops the stack for about 30 seconds.

## 10. Logs

```bash
docker compose logs -f backend          # API (JSON lines)
docker compose logs -f caddy            # access log, TLS events
docker compose logs --tail=200 migrate  # last migration run
tail -f /var/log/lms-backup.log         # nightly backup output
```

Logs rotate at 10 MB × 3 files per container. Nothing else is written to disk.

## 11. Alerts you will receive

| Alert | Source | Meaning | First thing to do |
|-------|--------|---------|-------------------|
| Site down | UptimeRobot HTTPS monitor on `/api/health` | API not answering or database unreachable | `ssh lms`, `docker compose ps`, `docker compose logs --tail=100 backend postgres` |
| Heartbeat missed | UptimeRobot heartbeat | Last night's backup did not finish, or disk > 85% | `tail -50 /var/log/lms-backup.log` |
| Instance status check failed | Lightsail alarm | The VM itself is unresponsive | Lightsail console → Reboot; if it stays dead, section 5 |

## 12. Things to never do on the server

- `docker compose down -v`: deletes the database, every uploaded file, and the TLS certificates. Let's Encrypt rate-limits re-issuing certificates, so the site can stay down for hours.
- Editing files outside `.env` by hand; deploy from git instead so the server matches the repo.
- Opening ports other than 22, 80, 443 in the Lightsail firewall. Postgres must never be reachable from the internet.
