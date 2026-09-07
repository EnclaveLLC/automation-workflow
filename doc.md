# GTmetrix Removal

Removed the GTmetrix performance-test integration from automation-workflow.
The shared "Test URLs" PR-body section was kept (renamed from "GTMetrix Test
URLs") since `pr-deploy.yml`'s Post-QA job also depends on that same URL
list — deleting it outright would have broken Post-QA for every caller repo.

## Deleted files

- `.github/workflows/gtmetrix.yml` — the GTmetrix performance-test workflow
  (polled for 200, ran up to 5 GTmetrix runs/URL, posted results, committed
  `reports/gtmetrix-history.json`).
- `scripts/gtmetrix/gtmetrix.js` — the Node script that called the GTmetrix
  API.
- `reports/gtmetrix-history.json` — empty shape-reference placeholder for
  the per-repo history file the deleted workflow used to write.

## Modified files

- **`.github/workflows/pr-deploy.yml`**
  - Removed the `gtmetrix` job entirely (and its `needs`/`if` gating on
    `parse-pr.outputs.gtmetrix_url`).
  - Removed the `GTMETRIX_API_KEY` secret from `on.workflow_call.secrets`.
  - Removed the `GTMETRIX_API_KEY` line from the "Verifying Secrets" echo
    step.
  - Removed the `| GT Metrix Test | ... |` row and the
    `<!-- gtmetrix-details -->` / `<!-- /gtmetrix-details -->` markers from
    the initial status comment template.
  - Renamed `parse-pr` job output `gtmetrix_url` → `test_urls` (and the
    corresponding env vars `GTMETRIX_URLS` → `TEST_URLS`).
  - `workflow-complete` job now depends on `post-qa-check` instead of the
    deleted `gtmetrix` job.
  - Updated the header comment (job 4 is now "Post QA check", not "GTmetrix
    check").

- **`.github/workflows/pre-qa-check.yml`**
  - Removed a now-dead regex that updated the "GT Metrix Test" row in the
    status comment (that row no longer exists).

- **`.github/workflows/claude.yml`**
  - Removed the unused `GTMETRIX_API_KEY` secret pass-through to the
    `claude-code-action` step.

- **`.github/workflows/page-duplicate.yml`**
  - Renamed output/env var `gtmetrix_urls` → `test_urls`
    (`GTMETRIX_URLS` → `TEST_URLS`, `gtmetrixUrls` → `testUrls`).
  - Renamed PR-body section header `### GTMetrix Test URLs` → `### Test URLs`.

- **`.github/workflows/split-test.yml`**
  - Renamed PR-body section header `### GTMetrix Test URLs` → `### Test URLs`
    (both the split-test-on and split-test-off PR bodies).

- **`.github/workflows/pull-request.yml`**
  - Renamed PR-body section header `### GTMetrix Test URLs` → `### Test URLs`.
  - Updated a log line: "Parsed page URL for GTmetrix" → "Parsed page URL".

- **`scripts/page_duplicate/parse-issue.js`**
  - Renamed variable/output `gtmetrix_urls` → `test_urls` (including the
    `GITHUB_OUTPUT` heredoc delimiter `GTEOF` → `TESTEOF`).

- **`scripts/pr-deploy/parse-pr.js`**
  - Renamed `gtmetrixUrls` → `testUrls`; updated the section-header regex to
    match `### Test URLs` instead of `### GTMetrix Test URLs`.

- **`prompts/claude-system-prompt.md`**
  - Renamed `## GTMetrix Test URLs` → `## Test URLs` in the PR-body template
    and rule text.
  - Removed the entire **GTMETRIX RULES** block (sourcing GTmetrix history
    from `reports/gtmetrix-history.json` — no longer applicable since that
    file/workflow is gone).

- **`CLAUDE.md`**
  - Updated the pipeline overview, workflow catalog (removed the
    `gtmetrix.yml` row, dropped `GTMETRIX_API_KEY` from `claude.yml` and
    `pr-deploy.yml`'s secrets column, 18 → 17 workflows), script catalog
    (removed the `gtmetrix.js` row), repo-layout notes, and the "PR body
    sections are machine-parsed" / "Two different Claudes" sections to
    reflect the rename and removal.

## Not touched

- `readme.md` — already documented as stale in `CLAUDE.md` (lists other
  filenames that no longer exist either); left as-is rather than propping up
  a file nothing trusts.

## Impact for caller repos

Live immediately for every site repo on the next `pr-deploy.yml` run:
GTmetrix performance testing no longer runs. Post-QA (Playwright image/CDN/
robots/GTM checks) and PR-body URL reporting are unaffected, just under the
renamed "Test URLs" header instead of "GTMetrix Test URLs".
