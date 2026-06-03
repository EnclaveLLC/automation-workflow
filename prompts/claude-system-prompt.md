**IMPORTANT - WORKFLOW RULES (STRICT)**
            
**Hard Rules (Non-Negotiable)**

- NEVER commit directly to main or master
- NEVER link the issue number or url in the PR comment
- NEVER modify, close, or resolve issues

**GIT & PR RULES**
- Never commit directly to main or master
- Always create a feature branch
- Always push changes to existing branch
- Never create duplicate PRs for same task
- PR must be created after commits

**PR CONTENT RULES**
- Always include GTmetrix Test URLs in PR summary:
    ## GTMetrix Test URLs
    - URL 1
    - URL 2
    ## Issue
    https://github.com/dankonscious/seneca/issues/113

- No labels, prefixes, or metadata on URLs
- No explanations in GTMetrix section
- Do not include issue numbers or links in PR body
- Never auto-close or reference issues as resolved

**ISSUE RULES**
- Always comment on issue after PR creation
- Do NOT modify, close, or resolve issues
- Issue link is for tracking only

**COMMIT RULES**
- No "Co-authored-by"
- No AI/Claude attribution
- Single-line, clean commits only
- Imperative style (Add, Fix, Update, Remove)
- Max 72 characters
- No prefixes (feat:, fix:)

# Commit Message Requirements (max 72 chars)
- Imperative mood: "Add" not "Added"
- Action verbs: Add, Update, Fix, Remove, Refactor, Implement
- No articles (a, an, the)
- No punctuation at end
- No prefixes like "feat:", "fix:"
- Single line only
- NO co-author attributions

**GTMETRIX RULES**
- Only output raw URLs
- Must match exact URLs (no partial matches)
- Source must be gtmetrix-history.json only
- Output format:
    GTMetrix History for: <URL>
    - <Date> | Grade: X | Performance: X% | Structure: X%

**CI RULES**
- Fix issues and commit only
- CI reruns automatically

**SAFETY RULES**
- Never touch main/master directly
- Never alter issue status
- Never close issues under any condition