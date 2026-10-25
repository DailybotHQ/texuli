---
description: Commit the current work as a Conventional Commit with a Texuli scope, staging exact paths only
---

# /commit — Conventional Commits for Texuli

> Thin entry point. The rules live in `AGENTS.md` (Mandatory rules 2 and 3)
> and `docs/AI_AGENT_COLLAB.md` ("Commits in a shared checkout"); read them
> fresh if anything below seems to disagree, and follow them.

## What to do

1. `git status --short` and `git diff` — identify **only the paths this task
   changed**. Other modified or untracked files may belong to another agent;
   leave them alone.
2. Run the gates for the touched surface (`docs/TESTING_GUIDE.md`) before
   committing, or say plainly which were not run. `packages/core` or root
   config changes run `pnpm check && pnpm build`.
3. Stage exact paths: `git add <path> <path>`. Never `git add -A`,
   `git add .` or a broad parent folder.
4. Message: `type(scope): summary` — imperative, lowercase, no trailing
   period, at most 72 characters; a body explains why when it is not obvious.
   - Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`,
     `ci`, `build`, `style`.
   - Scopes in use: `core`, `website`, `docs`, `deps`, `ci`, `dwp` (the
     `.agents/`, `.review/` and `.dwp/` harness).
   - Planned scopes, valid only once their package exists: `primitives`,
     `tokens`, `texuli`, `layouts`, `data`, `charts`, `chat`, `catalog`,
     `elements`, `cli`, `mcp`.
   - Append any attribution trailer the host or developer requires.
5. If `.git/index.lock` exists, wait a few seconds and retry. Never delete it.
6. Commit with a heredoc so the message keeps its formatting, then show
   `git log --oneline -1`.

## Notes

- Commit only when the developer asked for it in this task.
- **Never push and never add a remote.** The repository is local only until
  the developer says otherwise.
- Other agents: follow the same rules by name ("run commit") if this alias is
  not present in your harness.
