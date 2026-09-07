---
name: edit-workflow
description: Safely add to or modify one of the reusable GitHub Actions workflows or Node scripts in the automation-workflow repo (the shared workflow library every Enclave site repo calls via `uses: EnclaveLLC/automation-workflow/.github/workflows/X.yml@main`). Use this whenever asked to change a `.github/workflows/*.yml` file or a `scripts/**/*.js` file here, add a new workflow input, wire up a new caller repo, fix a broken issue/PR automation step, or change the badge/status-comment behavior — since every edit here goes live for ~20 site repos the instant it's pushed, with no version pinning and no test suite to catch a mistake.
---

# Editing automation-workflow

Every caller repo pins `uses: .../X.yml@main`. There is no version pinning,
no staging environment, and no test suite in this repo. **The moment you push
to `main`, every site repo's next workflow run uses your change.** Treat this
more like editing a shared library that's already in prod than like a normal
feature branch — the safety net is "read carefully and change the minimum
necessary," not CI.

Read [CLAUDE.md](../../../CLAUDE.md) first if you haven't already this
session — it has the full workflow/script catalog and the conventions this
skill assumes you already know (status-comment pattern, `handle-failure`
pattern, PR-body sections that are machine-parsed, Linear ID extraction).

## Before touching anything

1. **Find every caller.** Read the target workflow's `on: workflow_call`
   block (`inputs:`/`secrets:`) to know its current contract. Then check
   whether any *other* workflow in this repo calls it (`grep -rn "uses:.*<filename>" .github/workflows/`)
   — several workflows call `notion-parse.yml`, `restart.yml` internally.
2. **Never rename or remove a `.github/workflows/*.yml` file, or delete a
   required `workflow_call` input**, without grepping every sibling repo
   first: `grep -rln "automation-workflow/.github/workflows" ~/Documents/workspace/*/. github/workflows/ 2>/dev/null`.
   A rename breaks every caller still on the old name with a hard
   "workflow file not found" — there's no deprecation period. `seneca` is
   already in this broken state from a past rename (see CLAUDE.md); don't
   create a second instance of that problem.
3. **Adding a new `workflow_call` input is safe** as long as it has a
   sensible `default:` — existing callers that don't pass it keep working
   unchanged. This is the preferred way to extend behavior.
4. If the change touches a script under `scripts/`, find its one caller
   workflow (see the script catalog in CLAUDE.md) and check what env vars it
   sets — scripts take config exclusively through env vars (never CLI flags,
   except `gtmetrix.js`'s URL argv).

## Making the change

- **New workflow_call input** → add it under `inputs:` with a `default`,
  thread it through to wherever it's used (usually a `${{ inputs.x }}` inside
  a `run:` block or a nested `with:` to a called workflow), and update the
  table in CLAUDE.md's workflow catalog.
- **New/changed status-comment step** → follow the existing PATCH pattern:
  find the `comment_id` capture step, then add your update as another
  `gh api ... -X PATCH` against that same comment. Don't post a new comment.
- **New failure path inside a job** → set that job's `comment_updated: 'true'`
  output alongside your specific failure message, or the trailing
  `handle-failure` job will post a second, generic failure comment on top of
  yours.
- **Changing what a PR body contains** (`page-duplicate.yml`,
  `pull-request.yml`) → if you touch the `### Issue` or
  `### GTMetrix Test URLs` sections, update `scripts/pr-deploy/parse-pr.js`
  in the same change (it regexes those exact headers), and update
  `prompts/claude-system-prompt.md` if the automated Claude is expected to
  produce this shape too.
- **Editing `prompts/claude-system-prompt.md` itself** → you're changing the
  behavior contract for the *automated* `claude-code-action` that runs inside
  caller repos on `@claude` mentions, not for this session. Its commit-message
  and PR rules are deliberately different from normal interactive-session
  conventions (no `Co-Authored-By`, no conventional-commit prefixes) — don't
  "fix" that mismatch, it's intentional for that other context.
- **Wiring up a new site repo** → copy the four wrapper files from
  `testosteroneprotocol.com/.github/workflows/` (`claude-workflow.yml`,
  `standard-workflow.yml`, `workflow-commands.yml`, `deploy.yml`) — that repo
  is the canonical, currently-correct example. Every wrapper should use
  `secrets: inherit` (never enumerate secrets individually) and pin `@main`.

## Before you consider it done

- Re-read the full workflow file, not just your diff — these files are long
  (300–800+ lines) and a single `if:` or `needs:` typo silently skips a whole
  job with no error.
- If you changed a script, trace through by hand what env vars the calling
  workflow step actually sets vs. what the script reads — there's no test
  suite to catch a mismatched var name.
- Commit with a terse, single-purpose, imperative message matching this
  repo's existing style (`Update pr-deploy.yml`, `Fix Playwright`) — don't
  introduce conventional-commit prefixes or a heavier process than the repo
  already has.
- Mention to the user which caller repos are affected, since the change is
  live for them immediately — this is the one place where "I pushed it" and
  "it's deployed everywhere" are the same event.
