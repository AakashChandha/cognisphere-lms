# Progress log

Read this at the start of every session. Update it at the end of every session (`/wrap-up`).
Keep **Current state**, **Decisions** and **Next steps** accurate; the **Session log** is append-only and dated.

## Current state (as of 17 Oct 2026)

- **Batch 3 (17 Oct, uncommitted): admin has full privileges, course deactivation, PPTX viewer fixed.** Every `/api/tutor/courses|lessons|files` endpoint and `tutor/students/directory` now also accept MASTER with ownership bypassed, so the admin creates courses (optionally picking a tutor, else unassigned), edits lessons/files/enrolments and publishes from `/master/courses/new` and `/master/courses/[id]` (shared components in `frontend/src/components/courses/`). Migration `20261016192635_course_deactivation`: `CourseStatus.DEACTIVATED`, `Course.deactivatedAt/deactivationReason`, audit `COURSE_DEACTIVATED/REACTIVATED`; `POST /master/courses/:id/deactivate {reason}` and `/reactivate`. While deactivated: students lose access, tutor sees the reason read-only, admin can still edit. Students now only see PUBLISHED courses (previously drafts leaked to enrolled students). PPTX viewer: host div measured 0 px tall on the lesson page so it never rendered; size is now derived from width. Verified: tsc/eslint clean both sides, 53-check API smoke test, headless-Chrome screenshots of PPTX on lesson page and dialog. Stale zip test row removed from the dev DB (zip uploads were already blocked). **Slide narration**: `frontend/src/components/shared/pptx-narration.ts` extracts per-slide text (speaker notes take precedence) from the PPTX with jszip + DOMParser and speaks it with the browser Web Speech API (no vendor, no server); controls bar above the slides: Narrate/Pause, Auto-advance switch (default on, localStorage), status + "Tutor notes" badge. Starts only on a click; every navigation or Pause cancels speech. Headless Chrome has no voices, so the actual audio is unverified until the user tries it in a real browser.
- **UX batches 1 and 2 are implemented (uncommitted, on top of the uncommitted Phase 1 infra work).** Batch 1: self-delete/last-admin guards, announcement edit fix, select labels, lesson page as a readable Markdown article with a lesson rail, clickable + drag-reorderable tutor lessons, tutor file list with lesson badges and move-to-lesson, publish checklist + unpublish, named confirmations, toasts bottom-right, inline login error, mobile viewer, navy/slate theme, upload types restricted to PDF/PPTX/MP4. Batch 2: Prisma migration `20261016185404_progress_first_login_and_course_ownership` (LessonCompletion, User.mustChangePassword, Course.tutorId nullable + SetNull), completion endpoints + course progress + "continue learning" dashboard data, forced change-password page at `/change-password`, API client that no longer logs out on network errors and returns users to `?next=`, master course reads + reassign tutor, tutor/master dashboard data. Backend verified by scripted API smoke tests; frontend passes tsc + eslint and every page returns 200 through the dev server. Not yet looked at in a browser.
- New frontend packages: react-markdown, remark-gfm, @tailwindcss/typography, @dnd-kit/*. After pulling, run `npm install` in `frontend/` and, for the Docker dev stack, `docker exec lms-frontend-dev npm install` then clear `.next/dev` and restart the frontend container (Turbopack caches a failed plugin resolution).

- App is functional locally via the dev Docker stack. No production deployment yet; no domain bought yet.
- **Phase 1 (production readiness in the repo) is implemented and verified locally but NOT committed.** Changes are in the working tree (see `git status`): Caddy replaces nginx, compose hardening, prod-gated seed, disk-based uploads up to 2 GB, signed one-hour stream URLs for PDF/video, native video player, `scripts/` (server-setup, deploy, backup, restore-db), `OPERATIONS.md`, rewritten `PROD_DEPLOYMENT.md`, README decisions table.
- Verified: tsc clean on both sides, frontend lint clean, prod compose stack ran locally (health 200 through Caddy, Swagger 404 in prod, only master seeded, Postgres not published), scripted API checks for upload/stream/range/auth/413.
- Not verified: real MP4 playback in a browser (no ffmpeg on the Mac to produce a test video).
- Known broken: backend `npm run lint` (legacy `.eslintrc.json` with ESLint 10). Needs flat config migration.
- UX/UI review report is DONE: `~/Desktop/CGS-LMS-UX-Review-Report.md` (52 findings, 38-item prioritised backlog in section 6, 14 open product questions in section 7, screenshots in `~/Desktop/CGS-LMS-UX-Review-Screenshots/`). Code-verified so far: A-002 (no API guard against disabling/deleting own or last master account) is a real P0; A-001 (deleting a tutor cascades to courses, lessons, enrolments and file rows, leaving orphan files on disk) is confirmed; T-001 (announcement edit sends `id` in PATCH body, rejected by forbidNonWhitelisted) is confirmed.
- Dev database contains the reviewer's test data (12 extra users, demo student renamed "Samuel"); `docker compose -f docker-compose.dev.yml down -v` + reseed resets it.

## Decisions (settled, do not re-open)

| Topic | Decision | Why |
|---|---|---|
| Hosting | One AWS Lightsail instance, Mumbai, 4 GB / 2 vCPU / 80 GB, Ubuntu 24.04, Docker Compose | Fixed INR-billed price, users in India, 4 GB needed for `next build` |
| TLS / proxy | Caddy with automatic Let's Encrypt | Zero cert ops |
| Database | Postgres in a container, nightly `pg_dump` to a Lightsail bucket, daily snapshots | Managed DB doubles cost for no benefit at this scale |
| Files and video | Stored on the instance disk, streamed by NestJS with signed 1 h URLs and HTTP Range | Instance has 2 TB/mo transfer; bucket egress would blow the budget |
| Deploy | SSH in and run `scripts/deploy.sh` | Simplest for one developer; GitHub Actions push-to-deploy is an optional later step |
| Monitoring | UptimeRobot health + backup heartbeat, Lightsail status-check alarm | Free |
| Budget | ≈ ₹3,300/month incl. GST, cap ₹5,000 | User constraint |
| If more storage is ever needed | Lightsail block-storage disk first; Cloudflare R2 (zero egress) if object storage is unavoidable | Keeps video egress off metered buckets |
| Student downloads | Students can NEVER download source material (video, PDF, PPTX, any file). View-only in the app; the student download endpoint goes away and the PDF viewer must hide download/print (pdf.js, not the native Chrome viewer) | Course IP protection (user, 17 Oct 2026). Deterrent, not DRM: screen capture is always possible |
| Progress | Formal completion tracking (per-student lesson completions, progress %, Continue button). Non-sequential by default; lessons are never locked | Confirmed by user 17 Oct 2026 |
| Credentials | Admin-only. Admin creates the user with email + temporary password; user must change it at first login. No self-registration, no email invites | User, 17 Oct 2026 |
| Course ownership | Every course and file is company material and must stay in the DB. A course is owned by one tutor. Removing a tutor never deletes courses or files: they become unassigned, visible only to admin, who reassigns them to another tutor. Admin has full read/write on all students, tutors, courses and materials | User, 17 Oct 2026. Means Course.tutorId becomes nullable with SetNull, user delete must not cascade to courses, and "remove tutor" should be deactivate, not delete |
| Admin privileges | The admin can do everything a tutor can on any course (create, edit, lessons, files, enrol, publish, announcements) and can deactivate a course with a reason; reactivation returns it to draft | User, 17 Oct 2026 ("they can literally do anything in the platform") |
| Course material model | Keep it simple: a file is uploaded to a course and optionally attached to one lesson (current model). Tutor and admin can attach/detach. Only browser-viewable types are accepted (PDF, PPTX, MP4) because students cannot download | User, 17 Oct 2026 |

Full write-up: `readme.md` (Architecture Decisions) and the plan page https://claude.ai/artifact/X3XfYcgDESCEnzcBe1ia97.

## Next steps

1. Review and commit the Phase 1 changes (user to decide commit message / branch).
2. Finish the UX report backlog: remaining items are the audit-log target labels (A-007), a person detail page / merged Tutors+Students pages (A-006), tutor Students page with course names (T-013), announcement audience as one radio group (T-014), multi-file upload queue (T-011), pdf.js viewer with its own toolbar (S-019; today the native viewer is loaded with `#toolbar=0`), PPTX fidelity (S-008), rich-text editor (T-004, Markdown with preview is in place), 2FA/httpOnly tokens (X-007, A-011), role switcher (A-009).
3. Visual QA in a real browser at desktop and 375 px (the agents could only curl pages; only the PPTX viewer was screenshotted); then re-run the Claude Desktop test plan for a second review pass.
4. Fix backend ESLint (migrate to `eslint.config.mjs` flat config).
5. Verify real MP4 upload and playback in the browser once a sample video is available.
6. Phase 2: provision Lightsail per `PROD_DEPLOYMENT.md` (domain, instance, static IP, firewall 22/80/443, bucket with resource access, deploy key, `server-setup.sh`, `.env`, `deploy.sh`, snapshots, alarms, UptimeRobot, backup rehearsal).

## Open questions

- Domain name not chosen yet.
- Which real email address becomes the master account in production.
- Still unanswered from the UX report section 7: modules/units grouping (Q3), tutors seeing each other's courses (Q7), mixed Tutor+Student roles (Q9), tutor "Everyone" announcement scope (Q10), archive visibility (Q11), branding (Q12), "Admin" vs "Master" wording (Q13), 2FA before launch (Q14).

## Session log

### 2026-10-17
- User asked for slide narration with auto-advance, fully pausable; built in one scoped subagent (Web Speech API, no new vendor).
- Smoke test by user found: PPTX not opening for students, a leftover zip file, admin unable to enrol or create courses. Fixed all three (batch 3 above) using three fresh scoped subagents instead of forks, per user request to cut token use.
- Implemented UX batch 1 (quick wins) and batch 2 (learning/teaching flow) across backend and frontend; backend verified with scripted smoke tests (guards, reorder, optional notes, unpublish, upload type rejection, completion/progress/continue, first-login flag lifecycle, reassign + delete-tutor keeps course). Frontend pages verified by tsc, eslint and HTTP 200 compile checks through the dev server; no visual browser pass yet.
- Gotcha recorded: after installing new frontend packages the dev server returned 500 "Can't resolve '@tailwindcss/typography'" until `.next/dev` was deleted and the container restarted.
- User confirmed non-sequential lessons and the simple file model; asked for a friendly UI focused on the learning and teaching experience. UX implementation started in three batches (quick wins → learning/teaching flow → theme).
- User answered UX report questions 1, 2, 4, 8: no student downloads at all; formal completion tracking; admin-minted credentials with forced first-login change; tutor removal keeps courses/files as unassigned company material that admin reassigns; files are a tutor-owned library attachable/detachable to courses. Recorded in Decisions.

### 2026-10-16
- Decided the production infrastructure (see Decisions). Plan file and artifact produced.
- Implemented Phase 1 across backend, frontend, compose, Caddy, scripts and docs; verified locally with the prod compose stack and scripted API tests. Nothing committed.
- Cleaned up unrelated Docker containers/images on the Mac. Dev backend host port moved to 5001 because macOS AirPlay occupies 5000.
- Wrote the Claude Desktop UX test plan on the Desktop.
- Set up this progress-log workflow (`CLAUDE.md`, `docs/PROGRESS.md`, `/wrap-up` skill).
- The repo folder was accidentally moved to `~/untitled folder/`; moved back to `~/CGS/cognisphere-lms`. Keep it there: Claude Code auto-memory is keyed to this path.
