---
description: Draft a documented pull request title and body for the current branch by routing to the AI Diff Reviewer open-pr sub-skill (pushing is forbidden for now)
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
   command.** Save the draft to `tmp/` and hand it to the developer.

## Notes

- **Pushing is forbidden for now.** Texuli has no remote; the developer has
  not authorized pushing, adding a remote or opening PRs on any host. Until
  they say so, this command produces a local draft only.
- PR titles follow Conventional Commits with Texuli scopes (see
  `.agents/commands/commit.md`).
- Other agents: invoke the `ai-diff-reviewer-open-pr` sub-skill directly if
  this alias is not present in your harness, under the same no-push rule.
