# Agentic Development Framework — Architecture

> AI-powered development orchestration for building professional software with CLI Coding Agents.

---

## Overview

ADF is a modular framework consisting of:

- **16 Specialist Agents** — Role-based AI personas for development tasks
- **41+ Skills** — Domain-specific knowledge modules loaded on-demand
- **13 Workflows** — Slash command procedures
- **5 Rule Sets** — Global behavioral constraints and standards

---

## Directory Structure

```plaintext
.agent/
├── ARCHITECTURE.md          # This file
├── agents/                  # 16 Specialist Agents (symlink → .claude/agents/)
├── skills/                  # 41+ Skills (symlink → .claude/skills/)
├── workflows/               # 13 Slash Commands
└── rules/                   # 5 Rule Sets (symlink → .claude/rules/)
```

> **Note:** `agents/`, `skills/`, and `rules/` are symlinks to `.claude/` — single source of truth for both Claude Code and Antigravity.

---

## Agents (16)

Specialist AI personas for different development concerns.

| Agent | Focus | Skills Used |
|-------|-------|-------------|
| `business-analyst` | Requirements analysis, FSD, use cases | ba |
| `testcase-writer` | Test case generation from BA docs | test-cases |
| `planner` | Research, architecture, implementation plans | plan, research, brainstorm |
| `researcher` | Technical investigation, best practices | research, docs-seeker |
| `fullstack-developer` | Code implementation (backend + frontend) | cook, frontend-development, backend-development |
| `code-reviewer` | Quality analysis, standards enforcement | code-review, scout |
| `code-simplifier` | Refactoring, clarity, maintainability | code-review |
| `tester` | Test execution, coverage, validation | test, web-testing |
| `debugger` | Root cause analysis, diagnostics | debug, fix |
| `docs-manager` | Documentation sync and maintenance | docs |
| `git-manager` | Commits, PRs, branch management | git |
| `project-manager` | Progress tracking, plan sync-back | project-management, plans-kanban |
| `ui-ux-designer` | Interface design, design systems | ui-ux-pro-max, ui-styling, frontend-design |
| `brainstormer` | Trade-off analysis, solution ideation | brainstorm, sequential-thinking |
| `journal-writer` | Decision records, lessons learned | journal |
| `mcp-manager` | MCP server integration management | — |

---

## Skills (41+)

Modular knowledge domains loaded on-demand based on task context.

### Business Analysis & QA

| Skill | Description |
|-------|-------------|
| `specs` | FSD and use case management (init, analyze, update) |
| `test-cases` | Test case generation, update, export (CSV/JSON) |

### Planning & Architecture

| Skill | Description |
|-------|-------------|
| `plan` | Phased implementation plans (--fast, --hard, --two) |
| `cook` | End-to-end feature implementation |
| `brainstorm` | Trade-off analysis, solution ideation |
| `research` | Technical research and investigation |
| `sequential-thinking` | Step-by-step structured analysis |
| `problem-solving` | Systematic techniques for complex problems |
| `scout` | Fast parallel codebase exploration |

### Implementation

| Skill | Description |
|-------|-------------|
| `fix` | Intelligent bug fixing (--quick, --parallel) |
| `frontend-development` | React, TypeScript, modern patterns |
| `frontend-design` | Polished UI from designs/screenshots |
| `backend-development` | Node.js, Python, Go APIs |
| `databases` | PostgreSQL, MongoDB schema and queries |
| `mobile-development` | React Native, Flutter, Swift, Kotlin |
| `web-frameworks` | Next.js App Router, Turborepo |

### Testing & Quality

| Skill | Description |
|-------|-------------|
| `test` | Test execution, coverage analysis |
| `web-testing` | Playwright, Vitest, k6 |
| `code-review` | Multi-pass review with edge case scouting |
| `debug` | Root cause analysis, log analysis |

### UI/UX & Design

| Skill | Description |
|-------|-------------|
| `ui-ux-pro-max` | 50 styles, 21 palettes, 50 font pairings |
| `ui-styling` | shadcn/ui, Radix UI, Tailwind CSS |
| `web-design-guidelines` | Web Interface Guidelines compliance |
| `react-best-practices` | React/Next.js performance optimization |
| `mermaidjs-v11` | Diagram creation (flowcharts, ER, sequence) |

### DevOps & Infrastructure

| Skill | Description |
|-------|-------------|
| `devops` | Cloudflare, Docker, GCP, Kubernetes |
| `git` | Conventional commits, PRs, branch management |

### Documentation & Tools

| Skill | Description |
|-------|-------------|
| `docs` | Documentation generation and sync |
| `docs-seeker` | Library/framework docs via llms.txt |
| `repomix` | Pack repos into AI-friendly files |
| `preview` | Visual explanations, slides, diagrams |
| `markdown-novel-viewer` | Calm reading experience for markdown |
| `plans-kanban` | Plans dashboard with progress tracking |

### AI & Multimodal

| Skill | Description |
|-------|-------------|
| `ai-multimodal` | Image/audio/video analysis via Gemini |
| `chrome-devtools` | Browser automation with Puppeteer |

### Project Management

| Skill | Description |
|-------|-------------|
| `project-management` | Progress tracking, status reports |
| `journal` | Session reflections, decision records |
| `context-engineering` | Context usage monitoring, optimization |
| `skill-creator` | Create or update skills |

### Collaboration

| Skill | Description |
|-------|-------------|
| `team` | Agent Teams for parallel multi-session work |
| `ask` | Technical and architectural Q&A |

---

## Workflows (13)

Slash command procedures. Each proxies to the corresponding ADF skill.

| Command | Description | Skill |
|---------|-------------|-------|
| `/specs` | Requirements analysis, FSD, use cases | `specs` |
| `/test-cases` | Test case generation and export | `test-cases` |
| `/plan` | Create implementation plans | `plan` |
| `/cook` | Implement features end-to-end | `cook` |
| `/fix` | Debug issues and apply fixes | `fix` |
| `/test` | Run tests and analyze results | `test` |
| `/code-review` | Automated code quality analysis | `code-review` |
| `/docs` | Manage project documentation | `docs` |
| `/brainstorm` | Solution ideation, trade-off analysis | `brainstorm` |
| `/debug` | Root cause analysis, diagnostics | `debug` |
| `/ask` | Technical and architectural Q&A | `ask` |
| `/git` | Commits, push, PRs, merge | `git` |
| `/scout` | Fast parallel codebase exploration | `scout` |

---

## Rules (5)

Global behavioral constraints and development standards.

| Rule Set | Purpose |
|----------|---------|
| `primary-workflow` | End-to-end development pipeline |
| `development-rules` | Code quality, file naming, modularization |
| `orchestration-protocol` | Agent delegation, sequential/parallel patterns |
| `documentation-management` | Docs structure, update triggers, plan format |
| `team-coordination-rules` | File ownership, git safety, communication |

---

## Skill Loading Protocol

```plaintext
User Request → Skill Description Match → Load SKILL.md
                                            ↓
                                    Read references/
                                            ↓
                                    Execute scripts/ (optional)
```

### Skill Structure

```plaintext
skill-name/
├── SKILL.md           # (Required) Metadata & instructions
├── scripts/           # (Optional) Python/Bash helpers
├── references/        # (Optional) Templates, docs, guides
└── assets/            # (Optional) Images, logos
```

---

## Cross-Platform Compatibility

ADF works across multiple AI coding tools:

| Tool | Config Directory | Instruction File | Workflows |
|------|-----------------|------------------|-----------|
| **Claude Code** | `.claude/` | `CLAUDE.md` | Skills (slash commands) |
| **Antigravity** | `.agent/` (symlinked) | `AGENTS.md` | `.agent/workflows/` |

Skills, agents, and rules are shared via symlinks — zero duplication.

---

## Statistics

| Metric | Value |
|--------|-------|
| **Total Agents** | 16 |
| **Total Skills** | 41+ |
| **Total Workflows** | 13 |
| **Total Rules** | 5 |
| **Platforms** | Claude Code, Antigravity |
| **Principles** | YAGNI, KISS, DRY |

---

## Quick Reference

| Need | Agent | Skills |
|------|-------|--------|
| Analyze requirements | `business-analyst` | ba |
| Generate test cases | `testcase-writer` | test-cases |
| Plan a feature | `planner` | plan, research, brainstorm |
| Build it | `fullstack-developer` | cook, frontend-development, backend-development |
| Fix a bug | `debugger` | fix, debug |
| Run tests | `tester` | test, web-testing |
| Review code | `code-reviewer` | code-review, scout |
| Design UI | `ui-ux-designer` | ui-ux-pro-max, ui-styling |
| Update docs | `docs-manager` | docs |
| Ship it | `git-manager` | git |
