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
    ├── claude.yml
    ├── ftp_deploy.yml
    ├── convert_images_to_webp.yml
scripts/
    ├── gtmetrix.js
    ├── replace-img.js