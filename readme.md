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

Instead of duplicating workflow files across repositories, all repositories reference workflows from this repository.

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
    ├── aws_deploy.yml
    ├── claude.yml
    ├── ftp_deploy.yml
    ├── gtmetrix.yml
    ├── page_duplicate.yml
    ├── qa_check.yml
    ├── slack.yml
    └── split_test.yml
prompts/
└── claude-system-prompt.md
scripts/
├── ftp_deploy/
│   └── replace-img.js
├── gtmetrix/
│   └── gtmetrix.js
└── page_duplicate/
    ├── apply-replacements.js
    ├── parse-issue.js
    └── verify.js