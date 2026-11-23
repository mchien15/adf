# Agentic Development Framework

A framework for building software with **Claude Code**: agents, skills, hooks and rules in `.claude/`, installed into any project with the `adf` CLI.

ADF draws ideas and inspiration from several open-source projects and communities like Superpowers, ClaudeKit, AntigravityKit, GSD, etc..

## Key Benefits

- **AI-Powered Planning** — automated research, architecture design, phased implementation plans
- **Multi-Agent Code Review** — specialized agents for security, performance, and standards
- **Automated Testing** — comprehensive test generation and execution
- **Smart Documentation** — docs that evolve with your code
- **Clean Git Workflow** — professional conventional commits and branch management

## Documentation

- **[Documentation Index](./docs/documentation-index.md)** — Navigation guide to all ADF docs by role and topic
- **[Project Overview & PDR](./docs/project-overview-pdr.md)** — Goals, features, and product requirements
- **[System Architecture](./docs/system-architecture.md)** — Component interactions and data flow
- **[Code Standards](./docs/code-standards.md)** — Naming conventions and best practices
- **[Codebase Summary](./docs/codebase-summary.md)** — High-level project structure overview

---

## Quick Start

### Prerequisites
- Git for version control
- macOS 10.15+, Ubuntu 20.04+/Debian 10+, or Windows 10+ (WSL/Git Bash)
- 4GB+ RAM
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)

### Step 1: Clone ADF

```bash
git clone https://github.com/sotatek-dev/adf.git ~/adf
```

### Step 2: Install the `adf` CLI (once)

```bash
mkdir -p ~/bin
cp ~/adf/scripts/adf ~/bin/adf
cp ~/adf/scripts/adf-installer-lib.js ~/bin/adf-installer-lib.js
chmod +x ~/bin/adf
```

Then add `~/bin` to your PATH:

**Ubuntu/Linux (bash)** — add to `~/.bashrc`:
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**macOS (zsh)** — add to `~/.zshrc`:
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

> `ADF_HOME` defaults to `~/adf`. Only set it if you cloned elsewhere.

### Step 3: Install into a project

```bash
cd /path/to/your-project
adf claude
# or
adf claude --git-profile cmc
```

Then launch:
```bash
claude
```

Claude Code reads `CLAUDE.md` and loads the agents and skills automatically.

> **Note:** In this source repo, `.claude/` is canonical. In installed repos, ADF lives under `./.adf/payload/`, and the root `.claude/` and the managed block in `CLAUDE.md` are tracked by `./.adf/manifest.json`.

> **Upgrading?** Run `adf --update` to pull the latest CLI, then re-run `adf claude` in your project. A repo installed earlier with `adf all`, `adf codex`, `adf opencode` or `adf ag` gets its `.codex/`, `.opencode/`, `.agent/`, `.agents` and `AGENTS.md` block removed on that run (backed up in `.adf/backups/`).

> **Git profiles:** If `--git-profile` is omitted, ADF keeps the profile recorded by a prior install (`.adf/manifest.json`), or uses `adf` for a fresh install. Pass `--git-profile <id>` to set or switch it explicitly. Available profiles: `adf`, `cmc`.
> **Shorthand:** A known profile name is treated as `--git-profile`, so `adf cmc` and `adf claude cmc` work like `adf claude --git-profile cmc`.
> **CMC profile & docs:** Under `cmc`, ADF writes its generated docs to `./.adf/docs/` (code-level only: `codebase-summary.md`, `code-standards.md`, `documentation-index.md`) instead of `docs/`, leaving the company's curated `docs/` knowledge base untouched. The installer ships `./.adf/.gitignore` so `.adf/docs/` is committed while `payload/`, `backups/`, and `state/` stay untracked. **Do not add `.adf/` to your repo-root `.gitignore`** — git will not descend into an excluded directory to re-include `docs/`, so `.adf/docs/` would silently never be committed.
> **Safety:** Use `adf claude --dry-run` to preview changes. Legacy root-copy installs require `--adopt-legacy` before ADF will take ownership.

### Installer Behavior

- Canonical installed payload: `./.adf/payload/`
- Manifest and ownership tracking: `./.adf/manifest.json`
- Local rollback snapshots: `./.adf/backups/`
- Root markdown files use managed blocks so repo-authored text outside the markers stays intact
- Existing unmanaged root files and directory children are not overwritten silently

Recovery commands:

```bash
adf repair
adf rollback latest
```

### Framework Development (Maintainers)

To publish changes to `.claude/` (managed dirs: skills, agents, rules, hooks, scripts, config, plus statusline.* and metadata.json) to your global `~/.claude`:

```bash
./scripts/sync-claude-global.sh [--dry-run]
```

One-way publish via `rsync`. Never touches `settings.json`, `settings.local.json`, `agent-memory/`, or runtime state (sessions, projects, history.jsonl, tasks, caches). Run `--dry-run` first to preview. `ADF_HOME` defaults to `~/adf`.

---

### Using ADF

#### Initialize Documentation

On first run, generate baseline docs for your codebase.

```
/docs init
```

Creates `docs/` files: project overview, code standards, system architecture, codebase summary. These living docs keep agents context-aware about your project.

#### Plan a Feature

Before writing code, create an implementation plan.

```
/plan "add user authentication with OAuth2"
```

**What happens behind the scenes:**
1. Planner agent spawns multiple researcher agents in parallel
2. Researchers investigate best practices, libraries, patterns
3. Planner synthesizes findings into a phased plan in `plans/`
4. You review and approve the plan before implementation begins

Plan files are saved to `plans/{date}-{slug}/` with `plan.md` (overview) and `phase-XX-*.md` (detailed steps).

| Invocation | Use Case |
|---------|----------|
| `/plan "task"` | Standard research + plan |
| `/plan --fast "task"` | Fast path |
| `/plan --hard "task"` | Deep research path |

#### Implement

**Step-by-step** (recommended for complex features):
```
/cook "implement the authentication plan"
```

**Auto mode** (for simpler tasks):
```
/cook --auto "add a health check endpoint"
```

**Execute an existing plan:**
```
/cook plans/260315-auth-implementation/plan.md
```

#### Fix Bugs

```
/fix "login form not validating email"
```

| Command | Use Case |
|---------|----------|
| `/fix "issue"` | Auto-detect complexity |
| `/fix --quick "issue"` | Quick fix, no deep analysis |
| `/fix --parallel "issue"` | Multi-agent investigation |
| `/fix test` | Run tests and fix failures |
| `/fix types` | Fix TypeScript type errors |
| `/fix ci <url>` | Analyze GitHub Actions logs and fix |
| `/fix logs "issue"` | Analyze app logs and fix |

#### Test

```
/test
```

Runs your test suite, analyzes results, and reports coverage.

#### Code Review

```
/code-review
```

Multi-pass review: code quality, security, performance, edge cases.

#### Debug Production Issues

```
/debug "API returning 500 on /api/orders"
```

Root cause analysis with diagnostic report in `plans/reports/`.

#### Commit and Push

```
/git cm          # Stage all + commit with conventional message
/git cp          # Stage + commit + push
/git pr          # Create a pull request
```

#### Update Docs

```
/docs update
```

Syncs `docs/` with current codebase state.

---

### Everyday Workflow

```
/plan "feature description"     # 1. Plan
/cook "implement the plan"      # 2. Build
/test                           # 3. Test
/code-review                    # 4. Review
/quality-gates run              # 5. Security & quality scan
/git cp                         # 6. Ship
/docs update                    # 7. Document
```

### Other Commands

```
/brainstorm "should we use WebSockets or SSE?"   # Trade-off analysis
/adr "choose Postgres over MongoDB"               # Record an architecture decision
/scout "find all API route handlers"              # Codebase exploration
/quality-gates setup                             # Configure security gates for project
/quality-gates report                            # Generate markdown report from last run
```

### Tips

1. **Start with `/plan`** for anything non-trivial. Plans prevent wasted effort.
2. **Use `/cook --auto`** for small, well-understood tasks. Use `/cook` for anything complex.
3. **Don't skip tests.** The framework enforces real tests — no mocks or fake data to pass builds.
4. **Let agents chain.** The workflow is plan → implement → test → review. Trust the pipeline.
5. **Check `plans/reports/`** for detailed agent findings when debugging or reviewing.
6. **Use `/brainstorm`** when unsure about approach — it's cheaper than re-implementing.

---

## Project Structure

```
├── .claude/                 # Canonical source of truth
│   ├── agents/             # 16 specialist agent definitions
│   ├── hooks/              # Claude Code event hooks
│   ├── rules/              # Development rules and workflows
│   ├── skills/             # 12 skills
│   └── config/             # ADF configuration
├── archive/                # Unused skills/agents/scripts: not installed or loaded (restore with git mv)
├── scripts/                # adf installer, sync-claude-global.sh
├── docs/                   # Project documentation (auto-generated)
├── plans/                  # Implementation plans and reports
│   └── reports/            # Agent-to-agent communication
├── CLAUDE.md               # Claude Code instruction file
└── README.md               # This file
```

## The AI Agent Team

16 specialized agents that coordinate through file-based communication:

| Agent | Focus |
|-------|-------|
| **Business Analyst** | Requirements analysis, FSD, use cases |
| **Testcase Writer** | Test case generation from BA docs |
| **Planner** | Research, architecture, implementation plans |
| **Researcher** | Technical investigation, best practices |
| **Fullstack Developer** | Code implementation (backend + frontend) |
| **Code Reviewer** | Quality analysis, standards enforcement |
| **Code Simplifier** | Refactoring, clarity, maintainability |
| **Tester** | Test execution, coverage, validation |
| **Debugger** | Root cause analysis, diagnostics |
| **Docs Manager** | Documentation sync and maintenance |
| **Git Manager** | Commits, PRs, branch management |
| **Project Manager** | Progress tracking, plan sync-back |
| **UI/UX Designer** | Interface design, design systems |
| **Brainstormer** | Trade-off analysis, solution ideation |
| **Journal Writer** | Decision records, lessons learned |
| **MCP Manager** | MCP server integration management |

Agents work in **sequential chains** (plan → implement → test → review) or **parallel execution** (multiple researchers investigating simultaneously).

## Best Practices

- **YAGNI**: You Aren't Gonna Need It — avoid over-engineering
- **KISS**: Keep It Simple, Stupid — prefer simple solutions
- **DRY**: Don't Repeat Yourself — eliminate code duplication
- All code changes go through automated review
- Comprehensive testing is mandatory
- Documentation evolves with code changes
- Clean, conventional commit messages — no AI attribution

## Contributing

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the agent orchestration workflow
4. Ensure all tests pass and documentation is updated
5. Create a Pull Request

## Releasing

1. Update version in `.claude/metadata.json`
2. Create git tag: `git tag v{version}`
3. Push tag: `git push origin v{version}`
4. Create GitHub release: `gh release create v{version} --generate-notes`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- [Issue Tracker](https://github.com/sotatek-dev/adf/issues)
- [Feature Requests](https://github.com/sotatek-dev/adf/discussions)
- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code/overview)
