# Codebase Summary

**Last Updated**: 2026-10-14
**Version**: 0.0.1
**Repository**: [sotatek-dev/adf](https://github.com/sotatek-dev/adf)

## Overview

Agentic Development Framework is a comprehensive boilerplate template for building professional software projects with AI Coding Agents in Claude Code. It provides a slash-command workflow model and intelligent project management.

## Project Structure

```
agentic-development-framework/
├── .claude/                  # Source-repo canonical source of truth
│   ├── agents/              # Specialized agent definitions (8 agents)
│   ├── hooks/               # Claude Code hooks and scripts
│   ├── skills/              # Specialized skills library (12 skills)
│   ├── rules/               # Development workflow definitions
│   ├── config/              # ADF configuration
│   ├── metadata.json        # Framework version metadata
│   ├── settings.json        # Hook configuration
│   └── settings.local.json  # Local overrides
├── scripts/
│   ├── adf                   # Installer CLI entrypoint
│   └── adf-installer-lib.js  # Installer planner/executor implementation
├── profiles/                  # Installer git profile overlays
│   ├── git-profiles.json      # Git profile manifest and default profile
│   └── cmc/                   # CMC git workflow overrides for .claude
├── docs/                     # Project documentation
├── plans/                    # Implementation plans and reports
│   └── reports/             # Agent reports not tied to a plan, by month ({YYMM}/)
├── .github/                  # GitHub workflows
├── archive/                  # Unused skills, agents and scripts; not installed or loaded
├── CLAUDE.md                # Claude Code instruction file
└── README.md                # Project overview
```

## Core Technologies

### Runtime & Dependencies
- **Node.js**: >=18.0.0 (hooks only — no npm package)
- **License**: MIT

### CI/CD
- **GitHub Actions**: Automated workflows
- **Conventional Commits**: Structured commit messages

## Key Components

### 1. Agent Orchestration System (8 Agents)

**Claude Code Agents** (`.claude/agents/`):
- `planner.md` - Technical planning and architecture (Opus model)
- `researcher.md` - Research and analysis
- `fullstack-developer.md` - Full-stack implementation
- `code-reviewer.md` - Code quality, architecture and reliability review
- `tester.md` - Testing and validation
- `debugger.md` - Issue analysis and debugging
- `docs-manager.md` - Documentation management (Haiku model)
- `git-manager.md` - Version control operations

### 2. Workflow System

**Core Development Commands**:
- `/plan` - Research and planning (--fast, --hard, --two, --parallel variants)
- `/cook` - Risk-gated feature implementation (--auto skips approval gates only, --fast, --parallel, policy-limited --no-test, one test + review after the last phase (--per-phase to review each phase), mandatory verification)
- `/test` - Test execution and coverage analysis
- `/brainstorm` - Solution ideation
- `/debug` - Root cause analysis and debugging
- `/fix` - Bug fixes (--quick, --parallel, specialized: test, types, ui, ci, logs)
- `/code-review` - Multi-pass automated review
- `/docs` - Documentation generation and updates
- `/git` - Conventional commits, PRs/MRs, branch management
- `/scout` - Codebase exploration

**Slash-command tools** (`.claude/skills/`):
- Claude Code exposes ADF workflows directly as slash commands

### 3. Skills Library (12 Skills)

**Location**: `.claude/skills/` (canonical)
**Available in**: Claude Code

**Current Skills (12 Total)**: adr, brainstorm, code-review, cook, debug, docs, fix, git, plan, quality-gates, scout, test

**quality-gates skill v1** (`.claude/skills/quality-gates/`) — Production release (2026-03-31):
- Gates: secrets (gitleaks), deps (trivy), sast (semgrep), dast (nuclei), coverage, sonar (opt-in)
- Config: `.quality-gates/config.yaml` (created by `/quality-gates setup`)
- Scripts: `install.sh`, `run-all.sh`, `report.sh`, `setup/setup-all.sh`, `setup/setup-hooks.sh`, `setup/generate-config.sh`, `setup/setup-sonar.sh`
- Templates: `gitleaks.toml`, `quality-gates-config.yaml`, `sonar-project.properties`, `pre-commit-hook.sh`, `pre-push-hook.sh`
- References: `setup-wizard.md`, `nuclei-templates-catalog.md`, `sonar-properties-reference.md`, `gitleaks-rules-reference.md`
- Execution modes: pre-commit, pre-push, pr, ci, diff, full (auto-detected from env)
- Setup wizard: stack-aware — infers exclude patterns, selects nuclei tags, composes gitleaks.toml + sonar-project.properties per detected stack
- Removed: profiles feature, config validate/doctor, zombie config fields (nuclei block, dast.severity, sonar.sources/exclusions)

### 4. Hook System (13 Core Hooks)

**Location**: `.claude/hooks/`

**Core Hooks:**

1. **session-init.cjs** - Session Initialization
   - Detects project type (monorepo/library)
   - Identifies package manager (pnpm/npm/yarn)
   - Detects framework (Next/React/etc)
   - Writes 25+ environment variables for context cascade

2. **dev-rules-reminder.cjs** - Development Context Injection
   - Injects dev rules & context on every prompt
   - Smart deduplication prevents redundancy
   - Provides branch-matched workflow suggestions
   - Optimized for token efficiency

3. **subagent-init.cjs** - Subagent Context Injection
   - Injects compact context (~200 tokens) when spawning subagents
   - Minimizes token overhead during delegation
   - Enables efficient agent-to-agent communication

4. **scout-block.cjs** - Cross-Platform Performance Optimization
   - Blocks access to heavy directories (node_modules, .git, __pycache__, dist/, build/)
   - Node.js dispatcher with platform-specific implementations
   - Unix (Bash): scout-block.sh
   - Windows (PowerShell): scout-block.ps1
   - Automatic platform detection via `process.platform`
   - Improves AI response time and token efficiency

5. **privacy-block.cjs** - Sensitive File Access Control
6. **descriptive-name.cjs** - Naming conventions enforcement
7. **usage-context-awareness.cjs** - Context-aware usage patterns
8. **cook-after-plan-reminder.cjs** - Cook workflow guidance
9. **skill-dedup.cjs** - Skill deduplication
10. **team-context-inject.cjs** - Team coordination context
11. **task-completed-handler.cjs** - Task completion monitoring
12. **teammate-idle-handler.cjs** - Teammate idle state detection

### 6. Installer Profile System

**Purpose**: Allow `adf` installer users to select repo-specific git workflow guidance without forking the full framework.

**Key files**:
- `scripts/adf` - Parses `--git-profile`, validates manifest, applies overlays after base copy
- `profiles/git-profiles.json` - Declares available profiles and default profile (`adf`)
- `profiles/cmc/.claude/skills/git/references/*` - CMC git guidance for Claude Code

**Current behavior**:
- Default install remains `adf` when `--git-profile` is omitted
- `--git-profile cmc` overlays CMC git branch and merge guidance
- Overlay surface is intentionally narrow to minimize maintenance
- Installed repos now keep payload in `./.adf/payload/` and track generated compatibility outputs in `./.adf/manifest.json`

**Hook Features:**
- Fail-Safe: All hooks exit 0 (non-blocking) - graceful degradation
- Performance: Optimized token consumption
- Cross-Platform: Windows (PowerShell) & Unix (Bash) via Node.js dispatcher
- Comprehensive Test Coverage: test-scout-block.sh (11 tests), test-scout-block.ps1 (7 tests)

### 5. Workflows

**Primary Workflows** (`.claude/rules/`):
1. **primary-workflow.md**: Core development cycle
   - Code implementation
   - Testing
   - Code quality
   - Integration
   - Debugging

2. **orchestration-protocol.md**: Agent coordination patterns
   - Sequential chaining
   - Parallel execution

3. **development-rules.md**: Development standards
   - YAGNI, KISS, DRY principles
   - Code quality guidelines
   - Pre-commit/push rules

4. **documentation-management.md**: Doc maintenance
   - Roadmap and changelog updates
   - Automatic update triggers
   - Documentation protocols

## Entry Points

### For Users
- **README.md**: Project overview and quick start
- **CLAUDE.md**: Claude Code development instructions and workflows

### For Developers
- **.claude/metadata.json**: Framework version
- **.claude/settings.json**: Hook configuration
- **.gitignore**: Version control exclusions

### For Agents & Systems
- **CLAUDE.md**: Primary agent instructions (Claude Code)
- **.claude/rules/**: Development rules and protocols (shared)
- **plans/templates/**: Implementation plan templates

## Development Principles

### YAGNI (You Aren't Gonna Need It)
Avoid over-engineering and unnecessary features

### KISS (Keep It Simple, Stupid)
Prefer simple, straightforward solutions

### DRY (Don't Repeat Yourself)
Eliminate code duplication

### Security First
- Try-catch error handling
- Security standards coverage
- No secrets in commits
- Confidential info protection

## Agent Communication Protocol

**Report Format**: Markdown files in `./plans/<plan-name>/reports/`
**Naming Convention**: `{date}-from-[agent]-to-[agent]-[task]-report.md`

**Communication Patterns**:
- Sequential: Task dependencies require ordered execution
- Parallel: Independent tasks run simultaneously
- Query Fan-Out: Multiple researchers explore different approaches

## Git Workflow

**Commit Message Format**: Conventional Commits
```
type(scope): description

Types:
- feat: Features (minor bump)
- fix: Bug fixes (patch bump)
- docs: Documentation (patch bump)
- refactor: Code refactoring (patch bump)
- test: Tests (patch bump)
- ci: CI changes (patch bump)
- BREAKING CHANGE: Major version bump
```

**Release Process**:
- Update version in `.claude/metadata.json`
- Tag commit: `git tag v{version}`
- Push tag and create GitHub release with `gh release create`

## Testing Strategy

- Test-first (TDD) for every behavior change, through the public interface
- Coverage is a diagnostic: follow the project's configured threshold
- One test (or parametrized test) per acceptance criterion; tester adds tests only for criteria with none; performance only when required
- Tests must pass before push
- No ignoring failed tests

## Documentation Standards

**Required Docs** (`./docs/`):
- `project-overview-pdr.md` - Project overview and PDR
- `code-standards.md` - Coding standards and structure
- `codebase-summary.md` - This file
- `system-architecture.md` - Architecture documentation
- `project-roadmap.md` - Development roadmap
- `project-changelog.md` - Detailed changelog

**Documentation Triggers**:
- Feature implementation completion
- Major milestone achievements
- Bug fixes
- Security updates
- Weekly reviews

## Key Statistics

**Framework Components**:
- 16 specialized agent definitions
- 12 skills
- 13 core hooks with cross-platform support
- Complete documentation system

**Languages**: JavaScript/Node.js, Bash, Markdown
**CI/CD**: GitHub Actions
**License**: MIT

## Integration Capabilities

### Discord Notifications
Script: `.claude/hooks/send-discord.sh`
Purpose: Send project updates to Discord channels

### GitHub Actions
Workflow: `.github/workflows/branch-protection.yml`
Features: Branch protection rules

## Critical Files

### Configuration
- `.claude/metadata.json` - Framework version
- `.gitignore` - Git exclusions

### Documentation
- `README.md` - Main project docs
- `CLAUDE.md` - Agent instructions (Claude Code)
- `docs/` - Project documentation (overview, architecture, standards, roadmap)

### Workflows
- `.claude/rules/primary-workflow.md`
- `.claude/rules/development-rules.md`
- `.claude/rules/orchestration-protocol.md`
- `.claude/rules/documentation-management.md`

## External References

- **Claude Code Documentation**: https://docs.anthropic.com/en/docs/claude-code/overview
- **Repository**: https://github.com/sotatek-dev/adf

## Version History

**Current**: v0.0.1 (2026-03-16)
**License**: MIT
**Author**: Duy Nguyen
**Repository**: https://github.com/sotatek-dev/adf

## Notes for Maintainers

- In this source repo, `.claude/` is canonical; in installed repos, `.adf/payload/` is canonical
- Version management: update `.claude/metadata.json` for releases
- Hook system is cross-platform (Node.js dispatcher + platform-specific scripts)

## Unresolved Questions

None identified. All core components are well-documented and functional.
