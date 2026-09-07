# automation-workflow

Centralized automation workflows, reusable GitHub Actions, and AI operational infrastructure.

## Overview

This repository serves as the central source of truth for shared automation across all repositories.

It contains:

- Reusable GitHub Actions workflows
- CI/CD automation
- AI-assisted operational workflows
- Shared deployment pipelines
- Common engineering automation
- Internal operational tooling

Instead of duplicating workflow files across repositories, all repositories reference workflows from this repository via:

```yaml
uses: EnclaveLLC/automation-workflow/.github/workflows/<file>.yml@main
```

**Every caller pins `@main` — there is no versioning.** A change pushed here takes effect immediately, for every site, on their very next workflow run. There's no `package.json`, no lint, no test suite, and no CI on this repo itself. Treat every edit here as a live production change, not a PR draft.

For the full workflow/script catalog, shared conventions (status-comment pattern, `handle-failure` pattern, machine-parsed PR-body sections), and known gotchas, see [CLAUDE.md](CLAUDE.md) — that file is the up-to-date reference; this readme is a lighter-weight overview.

---

## Goals

- Centralize workflow management
- Reduce duplicated YAML configuration
- Standardize automation across repositories
- Enable scalable AI-assisted development workflows
- Simplify maintenance and updates
- Build a foundation for operational automation

---

## Repository Structure

```text
.github/
└── workflows/
    ├── aws-deploy.yml
    ├── claude.yml
    ├── ftp-deploy.yml
    ├── new-page.yml
    ├── notion-parse.yml
    ├── page-duplicate.yml
    ├── page-update.yml
    ├── post-qa-check.yml
    ├── pr-deploy.yml
    ├── pre-qa-check.yml
    ├── pull-request.yml
    ├── push-deploy.yml
    ├── restart.yml
    ├── split-test-check.yml
    ├── split-test.yml
    ├── standard-workflow.yml
    └── workflow-commands.yml
prompts/
└── claude-system-prompt.md
scripts/
├── ftp_deploy/
│   └── replace-img.js
├── general/
│   └── search_replace.js
├── page_duplicate/
│   ├── build_cta_pairs.js
│   ├── parse-issue.js
│   └── verify.js
└── split_test/
    ├── add_split_test_code.js
    ├── parse_issue.js
    └── remove_split_test_code.js
images/
└── badges-*.{svg,png,gif}
```

> The GTmetrix performance-test integration (`gtmetrix.yml`, `scripts/gtmetrix/gtmetrix.js`, `reports/gtmetrix-history.json`) has been removed. The PR-body section that used to feed it — `### GTMetrix Test URLs` — was renamed to `### Test URLs` and kept, since Post-QA still consumes that same URL list.

---

## Editing this repo with the `edit-workflow` skill

This repo ships a Claude Code skill at `.claude/skills/edit-workflow/SKILL.md`. Invoke it with:

```
/edit-workflow
```

when you're about to change a `.github/workflows/*.yml` file or a `scripts/**/*.js` file here — adding a workflow input, fixing an issue/PR automation step, changing badge/status-comment behavior, or wiring up a new caller repo. Because every caller pins `@main` with no test suite, the skill enforces a "read carefully, change the minimum necessary" workflow instead of relying on CI:

- Find every caller before renaming or removing a workflow file or a required input (a rename breaks every caller still on the old name, with no deprecation window).
- Prefer additive changes — a new `workflow_call` input with a sensible `default` is always safe.
- Follow the existing conventions when touching shared plumbing: the status-comment PATCH pattern, the `handle-failure` job pattern, and the machine-parsed PR-body sections (`### Issue`, `### Test URLs`) that `scripts/pr-deploy/parse-pr.js` and `prompts/claude-system-prompt.md` both depend on.
- Re-read the full workflow file (not just the diff) before considering a change done, and trace env vars by hand for any script change, since there's no test suite to catch a mismatch.

See [CLAUDE.md](CLAUDE.md) for the complete workflow/script catalog and conventions the skill assumes.
