# Codebase Summary

**Last Updated**: 2026-05-18
**Version**: 0.0.1
**Repository**: [sotatek-dev/adf](https://github.com/sotatek-dev/adf)

## Overview

Agentic Development Framework is a comprehensive boilerplate template for building professional software projects with AI Coding Agents across Claude Code, Antigravity, OpenCode, and OpenAI Codex. It provides one shared workflow model with tool-native invocation, generated compatibility artifacts, and intelligent project management.

## Project Structure

```
agentic-development-framework/
├── .claude/                  # Source-repo canonical source of truth
│   ├── agents/              # Specialized agent definitions (16 agents)
│   ├── hooks/               # Claude Code hooks and scripts
│   ├── skills/              # Specialized skills library (45 skills)
│   ├── rules/               # Development workflow definitions
│   ├── config/              # ADF configuration
│   ├── metadata.json        # Framework version metadata
│   ├── settings.json        # Hook configuration
│   └── settings.local.json  # Local overrides
├── .agent/                   # Antigravity IDE configuration
│   ├── agents/              # → symlink to .claude/agents/
│   ├── skills/              # → symlink to .claude/skills/
│   ├── rules/               # → symlink to .claude/rules/
│   ├── workflows/           # 13 slash command proxy files
│   └── ARCHITECTURE.md      # Agent/skill/workflow reference
├── .agents                   # → symlink to .claude (Codex skills + authored references)
├── .codex/                   # OpenAI Codex configuration
│   ├── config.toml          # Project-scoped Codex settings
│   ├── hooks.json           # Hook registry (3 hooks)
│   ├── hooks/               # Hook scripts (session-init, dev-rules, privacy-block)
│   └── agents/              # Generated Codex custom agents (16 × .toml)
├── .opencode/                # OpenCode configuration
│   ├── agents/              # Generated agent markdown files (16 × .md)
│   └── plugins/
│       └── adf-hooks.js     # OpenCode plugin (session, privacy, simplify hooks)
├── scripts/
│   ├── adf                   # Installer CLI entrypoint
│   ├── adf-installer-lib.js  # Installer planner/executor implementation
│   └── generate-tool-configs.js  # Generates .codex/agents/ + .opencode/agents/
├── profiles/                  # Installer git profile overlays
│   ├── git-profiles.json      # Git profile manifest and default profile
│   └── cmc/                   # CMC git workflow overrides for .claude/.agent
├── docs/                     # Project documentation
├── plans/                    # Implementation plans and reports
│   └── reports/             # Agent-to-agent communication
├── .github/                  # GitHub workflows
├── opencode.json            # OpenCode project config (model, permissions)
├── CLAUDE.md                # Claude Code instruction file
├── AGENTS.md                # Tool-agnostic instruction file
└── README.md                # Project overview
```

## Core Technologies

### Runtime & Dependencies
- **Node.js**: >=18.0.0 (hooks only — no npm package)
- **License**: MIT

### Development Tools
- **Repomix**: Codebase compaction for AI consumption

### CI/CD
- **GitHub Actions**: Automated workflows
- **Conventional Commits**: Structured commit messages

## Key Components

### 1. Agent Orchestration System (16 Agents)

**Claude Code Agents** (`.claude/agents/`):
- `planner.md` - Technical planning and architecture (Opus model)
- `researcher.md` - Research and analysis
- `fullstack-developer.md` - Full-stack implementation
- `code-reviewer.md` - Code quality assessment
- `tester.md` - Testing and validation
- `debugger.md` - Issue analysis and debugging
- `docs-manager.md` - Documentation management (Gemini model)
- `git-manager.md` - Version control operations
- `journal-writer.md` - Development journaling
- `brainstormer.md` - Solution ideation
- `project-manager.md` - Project tracking
- `ui-ux-designer.md` - UI/UX design
- `mcp-manager.md` - MCP server management
- `code-simplifier.md` - Code optimization and simplification
- `business-analyst.md` - Requirements analysis, FSD and use cases (Opus model)
- `testcase-writer.md` - Test case generation from BA docs (Sonnet model)

### 2. Workflow System

**Core Development Commands**:
- `/plan` - Research and planning (--fast, --hard, --two, --parallel variants)
- `/cook` - Risk-gated feature implementation (--auto skips approval gates only, --fast, --parallel, policy-limited --no-test, mandatory verification)
- `/test` - Test execution and coverage analysis
- `/ask` - Technical consultation
- `/bootstrap` - Project initialization
- `/brainstorm` - Solution ideation
- `/debug` - Root cause analysis and debugging
- `/fix` - Bug fixes (--quick, --parallel, specialized: test, types, ui, ci, logs)
- `/code-review` - Multi-pass automated review
- `/docs` - Documentation generation and updates
- `/git` - Conventional commits, PRs/MRs, branch management
- `/scout` - Codebase exploration
- `/specs` - Business analysis (init, analyze, update)
- `/test-cases` - Test case generation and export (generate, update, export)

**Slash-command tools** (`.claude/skills/` + `.agent/workflows/`):
- Claude Code, Antigravity, and OpenCode expose ADF workflows directly as slash commands
- `.agent/workflows/` contains 13 proxy files for Antigravity slash command support

**Codex-native workflow entrypoints**:
- Codex uses `AGENTS.md`, `.codex/config.toml`, `.codex/agents/*.toml`, and `.agents/skills/*`
- Codex active-plan updates use `.codex/scripts/set-active-plan-codex.cjs`
- Codex generated agents now carry explicit `model = "..."` fields for `opus|sonnet|haiku` source tiers
- Codex follows the same workflow intent, but invocation happens through native prompts and custom-agent selection rather than guaranteed slash-command aliases

### 3. Skills Library (45 Skills, Unified)

**Location**: `.claude/skills/` (canonical)
**Available in**: Claude Code, Antigravity (`.agent/skills/` symlinks), OpenCode (native), Codex (`.agents/skills/` symlink)

Support guarantees per tool live in `docs/tool-support-matrix.md`.

**Current Skills (45 Total)**:
- **AI & Vision**: ai-artist, ai-multimodal, agent-browser
- **Authentication**: better-auth
- **Backend & Databases**: backend-development, databases
- **Code Quality**: code-review, debug, sequential-thinking, quality-gates
- **Content**: copywriting, brainstorm
- **Design & Frontend**: design-mockup-create, design-system, frontend-design, frontend-development, ui-styling, ui-ux-pro-max, web-design-guidelines
- **DevOps**: devops, git
- **Documentation**: docs-seeker, repomix, markdown-novel-viewer, document-skills
- **Framework Integration**: web-frameworks, react-best-practices, shopify
- **Game Dev**: threejs, shader
- **Media**: media-processing (FFmpeg, ImageMagick)
- **MCP**: mcp-builder, mcp-management
- **Mobile**: mobile-development
- **Project Planning**: plan, plans-kanban
- **Security**: quality-gates (gitleaks, trivy, semgrep, nuclei, SonarQube, file-size)
- **Skills**: skill-creator, template-skill
- **Testing**: web-testing
- **Visualization**: mermaidjs-v11
- **Business Analysis**: ba (FSD + use cases), test-cases (TC generation + export)
- **Workflow Tools**: cook, research, scout, payment-integration

**quality-gates skill v1** (`.claude/skills/quality-gates/`) — Production release (2026-03-31):
- Gates: secrets (gitleaks), deps (trivy), sast (semgrep), dast (nuclei), coverage, file-size, sonar (opt-in)
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
7. **post-edit-simplify-reminder.cjs** - Post-edit optimization hints
8. **usage-context-awareness.cjs** - Context-aware usage patterns
9. **cook-after-plan-reminder.cjs** - Cook workflow guidance
10. **skill-dedup.cjs** - Skill deduplication
11. **team-context-inject.cjs** - Team coordination context
12. **task-completed-handler.cjs** - Task completion monitoring
13. **teammate-idle-handler.cjs** - Teammate idle state detection

### 6. Installer Profile System

**Purpose**: Allow `adf` installer users to select repo-specific git workflow guidance without forking the full framework.

**Key files**:
- `scripts/adf` - Parses `--git-profile`, validates manifest, applies overlays after base copy
- `profiles/git-profiles.json` - Declares available profiles and default profile (`adf`)
- `profiles/cmc/.claude/skills/git/references/*` - CMC git guidance for Claude/OpenCode/Codex
- `profiles/cmc/.agent/skills/git/references/*` - CMC git guidance for Antigravity
- `profiles/cmc/.agent/workflows/git.md` - Antigravity git workflow override

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
   - File size management (<500 lines)
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
- **AGENTS.md**: Antigravity IDE development instructions and workflows

### For Developers
- **.claude/metadata.json**: Framework version
- **.claude/settings.json**: Hook configuration
- **.gitignore**: Version control exclusions

### For Agents & Systems
- **CLAUDE.md**: Primary agent instructions (Claude Code)
- **AGENTS.md**: Primary agent instructions (Antigravity)
- **.claude/rules/**: Development rules and protocols (shared)
- **.agent/ARCHITECTURE.md**: Antigravity workflow reference
- **plans/templates/**: Implementation plan templates

## Development Principles

### YAGNI (You Aren't Gonna Need It)
Avoid over-engineering and unnecessary features

### KISS (Keep It Simple, Stupid)
Prefer simple, straightforward solutions

### DRY (Don't Repeat Yourself)
Eliminate code duplication

### File Size Management
- Keep files under 500 lines
- Split large files into focused components
- Extract utilities into separate modules

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

- Comprehensive unit tests required
- High code coverage mandatory
- Error scenario testing
- Performance validation
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
- 45 skills in organized categories
- 13 core hooks with cross-platform support
- 13 Antigravity workflow proxy files
- Complete documentation system

**Languages**: JavaScript/Node.js, Python, Bash, Markdown
**CI/CD**: GitHub Actions
**License**: MIT

## Integration Capabilities

### Discord Notifications
Script: `.claude/hooks/send-discord.sh`
Purpose: Send project updates to Discord channels

### GitHub Actions
Workflow: `.github/workflows/branch-protection.yml`
Features: Branch protection rules

### Agent Skills
- **brain**: Advanced reasoning
- **docs-seeker**: Documentation reading
- **ai-multimodal**: Visual understanding
- **ai-multimodal & imagemagick skills**: Content generation and processing

## Critical Files

### Configuration
- `.claude/metadata.json` - Framework version
- `.gitignore` - Git exclusions
- `.repomixignore` - Repomix exclusions

### Documentation
- `README.md` - Main project docs
- `CLAUDE.md` - Agent instructions (Claude Code)
- `AGENTS.md` - Agent instructions (Antigravity)
- `docs/` - Project documentation (overview, architecture, standards, roadmap)

### Workflows
- `.claude/rules/primary-workflow.md`
- `.claude/rules/development-rules.md`
- `.claude/rules/orchestration-protocol.md`
- `.claude/rules/documentation-management.md`

## External References

- **Claude Code Documentation**: https://docs.anthropic.com/en/docs/claude-code/overview
- **Antigravity IDE**: https://antigravity.dev
- **Repository**: https://github.com/sotatek-dev/adf

## Version History

**Current**: v0.0.1 (2026-03-16)
**License**: MIT
**Author**: Duy Nguyen
**Repository**: https://github.com/sotatek-dev/adf

## Notes for Maintainers

- In this source repo, `.claude/` is canonical; in installed repos, `.adf/payload/` is canonical
- `.agent/` uses symlinks (agents, skills, rules) — do NOT manually edit
- `.agents` symlink → `.claude` — enables Codex skill/agent discovery
- `.codex/agents/` and `.opencode/agents/` are generated — run `node scripts/generate-tool-configs.js` after agent changes
- Both `.agent/workflows/` and `.claude/skills/` implement slash commands
- Version management: update `.claude/metadata.json` for releases
- Hook system is cross-platform (Node.js dispatcher + platform-specific scripts)

## Unresolved Questions

None identified. All core components are well-documented and functional.
