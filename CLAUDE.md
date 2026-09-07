# automation-workflow

Centralized library of **reusable GitHub Actions workflows** + Node helper
scripts that every Enclave site repo (seneca, fixmybiome.com,
testosteroneprotocol.com, tryakka.com, and ~20 other `*.com` landing-page
repos under `~/Documents/workspace/`) calls into via:

```yaml
uses: EnclaveLLC/automation-workflow/.github/workflows/<file>.yml@main
```

**Every caller pins `@main` — there is no versioning.** A change pushed here
takes effect immediately, for every site, on their very next workflow run.
There's no `package.json`, no lint, no test suite, and no CI on this repo
itself. Treat every edit here as a live production change, not a PR draft.

## What this repo actually does

It implements an **issue-driven page-ops pipeline** for a fleet of near-
identical marketing/VSL landing-page sites:

1. Someone opens a GitHub **issue** on a site repo with one of 5 labels:
   `New Page`, `Page Update`, `Page Duplicate`, `Split Test On`, `Split Test Off`.
2. The site repo's `standard-workflow.yml` wrapper forwards `label_name` +
   `issue_number` to this repo's [standard-workflow.yml](.github/workflows/standard-workflow.yml),
   a pure router that dispatches to [new-page.yml](.github/workflows/new-page.yml),
   [page-update.yml](.github/workflows/page-update.yml),
   [page-duplicate.yml](.github/workflows/page-duplicate.yml), or
   [split-test.yml](.github/workflows/split-test.yml).
3. That workflow parses the issue body, creates a branch (duplicate/split-test
   also open the PR directly), and posts one progress **comment** that gets
   PATCHed in place through every step (see "The shared status-comment
   pattern" below) rather than posting new comments per step.
4. A human (or Claude) comments `/pr` on the issue →
   [workflow-commands.yml](.github/workflows/workflow-commands.yml) →
   [pull-request.yml](.github/workflows/pull-request.yml) opens the real PR
   from the branch created in step 3.
5. Merging that PR (or pushing directly to main) triggers deploy:
   [push-deploy.yml](.github/workflows/push-deploy.yml) (direct push, lean —
   just FTP + AWS, no QA) or [pr-deploy.yml](.github/workflows/pr-deploy.yml)
   (merged PR, full pipeline — FTP + AWS in parallel → pre-QA → post-QA →
   comment marked "Completed").
6. [claude.yml](.github/workflows/claude.yml) wires `@claude` mentions /
   `claude`-labeled issues to `anthropics/claude-code-action@v1`, governed by
   [prompts/claude-system-prompt.md](prompts/claude-system-prompt.md) — see
   "Two different Claudes" below, this is **not** the same behavior contract
   as an interactive Claude Code session working in this repo directly.

## Repo layout

```
.github/workflows/   17 reusable workflows (all `on: workflow_call`)
prompts/             claude-system-prompt.md — system prompt for the automated
                     claude-code-action that runs inside caller repos
scripts/             Node helpers, invoked via `node scripts/.../x.js`,
                     configured entirely through env vars set by the caller
                     workflow step
images/              badge SVGs/PNGs/GIFs (loading/waiting/in-progress/
                     completed/failed/aborted) referenced by raw GitHub URL
                     from nearly every workflow
```

Folder naming under `scripts/` is inconsistent (`ftp_deploy` underscore vs
`pr-deploy` hyphen vs `page_duplicate` underscore) — this is just how it is,
don't "fix" it as a drive-by; it'd break every workflow's checkout paths.

**`readme.md` at the repo root is stale** — it lists workflow/script filenames
(`aws_deploy.yml`, `qa_check.yml`, `slack.yml`, `apply-replacements.js`) that
no longer exist. Don't trust it; this file supersedes it.

## Workflow catalog

All 17 files in `.github/workflows/` are `on: workflow_call`. Two
(`notion-parse.yml`, `restart.yml`) are only ever called *internally* by other
workflows in this repo, never directly by a caller repo's wrapper.

| File | Required inputs | Key secrets | Purpose |
|---|---|---|---|
| `claude.yml` | — | `CLAUDE_CODE_OAUTH_TOKEN` | Runs `claude-code-action` with `prompts/claude-system-prompt.md`, model `claude-opus-4-5`, `--max-turns 100`. |
| `push-deploy.yml` | — | `FTP_*`, `AWS_*` | Direct-push pipeline: `ftp-deploy.yml` + `aws-deploy.yml` in parallel, no QA. |
| `pr-deploy.yml` | `pr_number`, `pr_title`, `pr_body` | `FTP_*`, `AWS_*` | Merged-PR pipeline: status comment → parse PR body (`scripts/pr-deploy/parse-pr.js`) → deploy-ftp + deploy-aws → pre-QA → post-QA → mark comment "Completed". |
| `ftp-deploy.yml` | — | `FTP_SERVER/USERNAME/PASSWORD` | Diffs changed web files, rewrites `<img>`/`srcset` to CloudFront `.webp` (`scripts/ftp_deploy/replace-img.js`), uploads via `FTP-Deploy-Action`. |
| `aws-deploy.yml` | — | `AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY` | Converts changed images to `.webp` via `sharp`, syncs to `s3://cdn-konscious/<repo>/…`, deletes removed originals. |
| `notion-parse.yml` | `repo_name` | `NOTION_TOKEN` | Looks up the site's row in Notion (domain/GTM/pixels/checkout links/buyer/GDPR) by `URL contains repo_name`; outputs `notion_json`. |
| `pre-qa-check.yml` | — | — | Static: every changed image < 1MB, every changed file has a recognized extension. |
| `post-qa-check.yml` | `urls`, `gtm_id` | — | Playwright: live image weight, CDN host check, `noindex,nofollow`, GTM container ID present. |
| `new-page.yml` | `issue_number` | — | Parses issue table, scaffolds `index.html`, branch `new-page/<slug>`. |
| `page-update.yml` | `issue_number` | — | Same parse/branch as new-page but verifies path **exists**, no scaffolding, branch `page-update/`. |
| `page-duplicate.yml` | `issue_number` | `NOTION_TOKEN`, `CROSS_REPO_APP_ID/PRIVATE_KEY` (opt, cross-repo dup) | Largest workflow: parses Reference/New/CTA/Search-Replace tables (`scripts/page_duplicate/parse-issue.js`), `cp -R`s the folder (optionally from a sibling repo via GitHub App token), builds CTA pairs (`build_cta_pairs.js`), applies replacements (`general/search_replace.js`), opens the PR directly. |
| `restart.yml` | `issue_number`, `repository` | — | Reads the issue's current trigger label, re-dispatches `standard-workflow.yml`. |
| `standard-workflow.yml` | `label_name`, `issue_number` | `secrets: inherit` | Router: label → new-page/page-update/page-duplicate/split-test. |
| `workflow-commands.yml` | `issue_number`, `comment_body`, `repository` | `secrets: inherit` | Slash commands: `/restart`, `/split-test check`, `/pr`. |
| `pull-request.yml` | `issue_number`, `repository` | `NOTION_TOKEN` (opt) | Finds the branch link posted earlier on the issue, opens the PR. |
| `split-test.yml` | `issue_number`, `type` (`on`/`off`) | `NOTION_TOKEN` (opt) | `on`: prepends a PHP `SplitTester` block to `index.php` (`add_split_test_code.js`). `off`: strips it (`remove_split_test_code.js`). |
| `split-test-check.yml` | `issue_number`, `repository` | — | Diagnostic only: hits the control URL 50× via Playwright, tabulates redirect distribution across variations. |

## Script catalog

All scripts read config from **env vars** set by the calling workflow step,
never CLI flags.

| Script | Called from | Purpose |
|---|---|---|
| `scripts/ftp_deploy/replace-img.js` | `ftp-deploy.yml` | Rewrites `<img>`/`srcset` to CloudFront `.webp` URLs; skips absolute URLs and any tag with `no-cdn`. |
| `scripts/general/search_replace.js` | `page-duplicate.yml` | Generic find/replace over one file; idempotency guard for suffix-append replacements. |
| `scripts/page_duplicate/parse-issue.js` | `page-duplicate.yml` | Parses Reference/New Page + CTA + Search/Replace tables; derives `ref_host`/`new_host` to detect cross-repo duplication. |
| `scripts/page_duplicate/build_cta_pairs.js` | `page-duplicate.yml` | Builds old→new CTA pairs, preferring Notion checkout URLs over the caller repo's `constant-files/samcart-links.json`. |
| `scripts/page_duplicate/verify.js` | **nothing currently** | Orphaned — no workflow invokes it. Leave alone unless you're deliberately re-wiring page-duplicate.yml to use it. |
| `scripts/pr-deploy/parse-pr.js` | `pr-deploy.yml` | Extracts `### Issue` URL and `### Test URLs` from the PR body; writes `/tmp/parse-pr.json`. |
| `scripts/split_test/parse_issue.js` | `split-test.yml`, `split-test-check.yml` | Parses Control Page URL + Page Variations table. |
| `scripts/split_test/add_split_test_code.js` | `split-test.yml` (type=on) | Prepends the PHP `SplitTester` block. |
| `scripts/split_test/remove_split_test_code.js` | `split-test.yml` (type=off) | Strips the block `add_split_test_code.js` added. |

## Shared conventions — follow these when editing any workflow

**The status-comment pattern.** Post one "🔄 in progress" comment early
(`images/badges-loading.svg`), capture its `comment_id`, then PATCH that same
comment (`gh api ... -X PATCH`) at every subsequent step. Never post a second
comment for the same issue/PR run.

**The `handle-failure` job pattern.** Most workflows end with a job gated on
`failure() && needs.<job>.outputs.comment_updated != 'true'`, so a generic
"something failed, check the run" comment only appears when no step already
wrote a more specific failure message. If you add a new failure path inside a
job, make sure that job sets `comment_updated: 'true'` in its outputs, or the
generic handler will pile a redundant comment on top of yours.

**PR body sections are machine-parsed.** `### Issue` and
`### Test URLs` sections in a PR body aren't just for humans —
`scripts/pr-deploy/parse-pr.js` regexes them out. If you change this shape in
one of the PR-creating workflows (`page-duplicate.yml`, `pull-request.yml`),
update `parse-pr.js` (and `prompts/claude-system-prompt.md`, which is what
tells the *automated* Claude to produce this exact shape) in the same change.

**Linear ID extraction.** Several workflows pull a ticket ID out of Linear's
bot comment on the issue via
`gh api .../comments --jq '[.[] | select(.user.login | test("linear"; "i")) | .body | match("[A-Z]+-[0-9]+").string] | first'`
and fold it into branch names (`new-page/ENG-123-slug`) and PR bodies
(`Resolves ENG-123`). Reuse this exact pattern rather than reinventing it if
you add a new branch-creating workflow.

**Badges.** Referenced two ways: as `inputs.badge_*` URLs with
`raw.githubusercontent.com/EnclaveLLC/automation-workflow/main/images/...`
defaults (in the `pr-deploy.yml` call chain), and hardcoded to the same raw
URL directly in the issue-driven workflows. Keep filenames in `images/`
stable — they're referenced by absolute URL, not by relative path.

## Two different Claudes

`prompts/claude-system-prompt.md` governs the **automated** `claude-code-action`
that runs inside caller repos when someone `@claude`-mentions an issue — not
an interactive Claude Code CLI session working in *this* repo. Its rules are
notably different from (and sometimes opposite to) normal interactive-session
git conventions:

- Single-line, imperative commit messages, ≤72 chars, **no** conventional-commit
  prefixes, **no** `Co-Authored-By` trailer.
- PR body must carry `## Test URLs` (raw URLs, no labels) and
  `## Issue` (full URL) — but the issue **comment** reply must never link the
  issue number/URL, and must never auto-close the issue.

If you're asked to edit `claude-system-prompt.md` itself, you're editing the
other Claude's behavior contract, not your own.

## Known gotchas

- **`seneca`'s workflow wrappers are stale and currently broken.**
  `seneca/.github/workflows/deploy.yml` and `standard_workflow.yml` reference
  `.../deploy.yml@main` and `.../standard_workflow.yml@main` (underscore) —
  neither filename exists in this repo (current names are `push-deploy.yml`/
  `pr-deploy.yml`/`standard-workflow.yml`, hyphenated). This is a leftover
  from before a rename here. Use `testosteroneprotocol.com/.github/workflows/`
  as the canonical, correctly-wired example if you need to fix seneca or wire
  up a new site repo.
- **Renaming any file under `.github/workflows/` is a breaking change** for
  every caller still pinned to the old name — there's no deprecation window,
  since every caller is on `@main`. Prefer additive changes (new optional
  inputs with defaults) over renames/removals.
- `scripts/page_duplicate/verify.js` is dead code — don't assume it runs.
- Commit style here is terse and direct-to-main (`Update pr-deploy.yml`,
  `Fix Playwright`) — match that; don't invent a heavier process for this repo
  than it already has.
