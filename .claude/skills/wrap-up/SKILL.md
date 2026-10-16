---
name: wrap-up
description: End-of-session routine. Updates docs/PROGRESS.md with what changed, current state, decisions and next steps so the next session starts with context.
---

Update `docs/PROGRESS.md` so a fresh session can continue without this conversation. Do this in one pass:

1. Run `git status --short` and `git log --oneline -5` to ground what is committed versus pending.
2. Rewrite the **Current state** section to describe the project as it is right now. Replace stale statements; do not append.
3. Add any decision made this session to the **Decisions** table, with a one-line reason. Remove nothing already there unless the user explicitly reversed it.
4. Rewrite **Next steps** as an ordered list of what should happen next, most important first. Drop items that are done.
5. Update **Open questions**: add new ones, remove answered ones.
6. Append a dated entry under **Session log** (today's date, `### YYYY-MM-DD`; if an entry for today exists, add bullets to it). Three to eight bullets: what was built or changed, what was verified and how, what was left unfinished and why. Mention file paths only where the next session will need to go there.

Rules:
- Keep the whole file under roughly 200 lines. Prune old session-log entries into a single summary bullet once they are more than a month old.
- Record things not derivable from the code or git history: reasoning, verification results, user preferences, blockers, things tried and rejected.
- Never write secrets or credentials into it.
- Do not commit; just tell the user the file is updated and give a three-line summary of what you wrote.
