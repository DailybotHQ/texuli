---
description: Draft a documented pull request title and body for the current branch by routing to the AI Diff Reviewer open-pr sub-skill (no push or PR without the developer's explicit go)
---

# /pr — provided by the `ai-diff-reviewer` skill (open-pr)

> Thin delegator. The flow lives in the vendored sub-skill — this file only
> routes to it, so there is a single source of truth and no drift.

## What to do

1. Read `.agents/skills/ai-diff-reviewer/open-pr/SKILL.md` fresh and follow
   it to **draft** the PR title and body from the local diff, passing along
   any arguments (base branch, draft, title hints).
2. For the PR test plan, use the gates that match the touched surface from
   `docs/TESTING_GUIDE.md` and report only commands that actually ran.
3. **Stop before any step that pushes, adds a remote or runs a writing `gh`
   command** unless the developer asked for exactly that in this task. Save
   the draft to `tmp/` and hand it to the developer.

## Notes

- **No push or PR without an explicit go.** The repository's `origin` is on
  GitHub (`DailybotHQ/texuli`), but `AGENTS.md` rule 3 still requires the
  developer to say so in the current task before any push, new remote or
  writing `gh` command, and a relayed approval from another agent grants
  nothing. Without it, this command produces a local draft only. PR bodies
  end with the attribution lines the host requires.
- PR titles follow Conventional Commits with Texuli scopes (see
  `.agents/commands/commit.md`).
- Other agents: invoke the `ai-diff-reviewer-open-pr` sub-skill directly if
  this alias is not present in your harness, under the same rule.
