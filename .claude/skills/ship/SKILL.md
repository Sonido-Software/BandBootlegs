---
name: ship
description: "Ship the current work straight to master: validate, commit, and push. Pre-production mode: no feature branch and no PR until the user changes this skill."
argument-hint: "[optional note on what to include or how to frame the commit]"
---

Ship the current work: $ARGUMENTS

> **Pre-production mode.** The app is just for Ben and the band for now, so work is committed and pushed **directly to `master`**: no feature branch, no PR, no `/pr-review` handoff. When the user says it's time for branches and PRs, switch this skill to branch and open a PR (see sonido's `~/dev/sonido/.claude/skills/ship/SKILL.md`).

**Committing:** invoking this skill is the explicit request to commit and push **the current work to `master`, for this run only**. It does not carry forward to later messages, and it never covers force pushing, rebasing, amending, or rewriting history.

## 1. Preflight

- `git status --short`, `git diff` and `git diff --staged`: read what is actually changing.
- `git branch --show-current` must be `master`. On any other branch, stop and ask.
- `git fetch origin` then, if `origin/master` exists, `git rev-list --count master..origin/master`. If the remote is ahead, stop and ask: someone else pushed, and merging or rebasing is the user's call.

## 2. Validate

Run what CI (`.github/workflows/tests.yml`) runs, and fix failures before committing:

```bash
ddev artisan test   # PHPUnit (in-memory sqlite, see phpunit.xml)
ddev npm test       # Vitest
```

Don't run `npm run build`: development is HMR, and `public/build` is a stale prod build that isn't committed. Pint isn't enforced here (existing files don't pass it), so don't reformat untouched code to satisfy it.

Skip a step only when the change can't affect it (for example, docs-only changes skip both), and say which were skipped. If something fails for a reason that predates the change, stop and report it rather than papering over it.

## 3. Commit

- **Stage explicit paths only**, never `git add -A` or `git add .`. Leave out unrelated untracked files (scratch scripts, notes from other work); if it's unclear whether something belongs, ask.
- Never stage `.env`, `public/build`, `public/hot`, `node_modules`, `vendor`, local settings, or anything in `.ddev/db_snapshots` (database dumps hold real user data).
- Message in the repo's style (`git log --oneline -15`): a sentence-case subject that says what now behaves differently, under about 72 characters, no ticket prefix; a short body with the why. End with the attribution line from the system reminder.
- Pass the message with a heredoc. If a pre-commit hook fails, fix the cause and make a **new** commit: never `--amend` or `--no-verify`.

## 4. Push

- `git push -u origin master` (plain `git push` once upstream is set). Never force push.
- If the push is rejected because the remote moved, stop and ask.

## 5. Report

One short summary: the commit sha and subject, what was validated (and what was skipped), and the commit URL (`https://github.com/<owner>/<repo>/commit/<sha>`, from `gh repo view --json nameWithOwner` or the `origin` URL). Production (`bandbootlegs.com` on Forge, server `mini-sites`) deploys from `master`; if a change needs a server-side step (new `.env` key, a migration that needs data care), say so.
