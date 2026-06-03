---
name: docs
description: "Analyze codebase and manage project documentation — init, update, summarize."
argument-hint: "init|update|summarize"
---

# Documentation Management

Analyze codebase and manage project documentation through scouting, analysis, and structured doc generation.

## Default (No Arguments)

If invoked without arguments, use `AskUserQuestion` to present available documentation operations:

| Operation | Description |
|-----------|-------------|
| `init` | Analyze codebase & create initial docs |
| `update` | Analyze changes & update docs |
| `summarize` | Quick codebase summary |

Present as options via `AskUserQuestion` with header "Documentation Operation", question "What would you like to do?".

## Subcommands

| Subcommand | Reference | Purpose |
|------------|-----------|---------|
| `/docs init` | `references/init-workflow.md` | Analyze codebase and create initial documentation |
| `/docs update` | `references/update-workflow.md` | Analyze codebase and update existing documentation |
| `/docs summarize` | `references/summarize-workflow.md` | Quick analysis and update of codebase summary |

## Routing

Parse `$ARGUMENTS` first word:
- `init` → Load `references/init-workflow.md`
- `update` → Load `references/update-workflow.md`
- `summarize` → Load `references/summarize-workflow.md`
- empty/unclear → AskUserQuestion (do not auto-run `init`)

## Shared Context

Documentation lives in the configured docs directory (`$CK_DOCS_PATH` — default `docs/`, `cmc` git-profile `.adf/docs/`):
```
$CK_DOCS_PATH
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-system/            # Design principles, tokens, catalog, themes
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

Use the configured docs directory (`$CK_DOCS_PATH`) as the source of truth for documentation.

**Code-level-only (cmc) mode:** when the injected context shows `Docs mode: code-level only`, generate ONLY `codebase-summary.md`, `code-standards.md`, and `documentation-index.md`. Do NOT (re)generate architecture, PRD/overview, FSD, or use-cases — the company `docs/` tree owns those; cross-link to them from `documentation-index.md` instead.

**IMPORTANT**: **Do not** start implementing code.
