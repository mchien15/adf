# Agentic Development Framework

A comprehensive framework for building professional software projects with **AI Coding Agents**. Works with **Claude Code**, **Antigravity**, **OpenAI Codex**, and **OpenCode** — same commands, same workflows, regardless of which tool you use.

ADF draws ideas and inspiration from several open-source projects and communities like Superpowers, ClaudeKit, AntigravityKit, GSD, etc..

## Key Benefits

- **AI-Powered Planning** — automated research, architecture design, phased implementation plans
- **Multi-Agent Code Review** — specialized agents for security, performance, and standards
- **Automated Testing** — comprehensive test generation and execution
- **Smart Documentation** — docs that evolve with your code
- **Clean Git Workflow** — professional conventional commits and branch management
- **Cross-Platform** — same skills and commands on Claude Code, Antigravity, OpenCode, and Codex

## Documentation

- **[Project Overview & PDR](./docs/project-overview-pdr.md)** — Goals, features, and product requirements
- **[System Architecture](./docs/system-architecture.md)** — Component interactions and data flow
- **[Code Standards](./docs/code-standards.md)** — Naming conventions and best practices
- **[Codebase Summary](./docs/codebase-summary.md)** — High-level project structure overview

---

## Quick Start

## Supported AI Coding Tools

| Tool | Skills | Agents | Hooks | Setup |
|------|--------|--------|-------|-------|
| Claude Code | ✅ 44 | ✅ 16 | ✅ Full | Built-in (`CLAUDE.md`) |
| Antigravity | ✅ 44 | ✅ 16 | ✅ Full | Built-in (`AGENTS.md`) |
| OpenCode | ✅ 44 | ✅ 16 | ✅ Full | `opencode.json` included |
| OpenAI Codex | ✅ 51 | ✅ 16 | ⚠️ Partial* | `ln -s .claude .agents` |

\* Codex `PreToolUse` hook covers Bash only — Read/Write privacy interception not available.

After modifying `.claude/agents/*.md`, regenerate tool configs:
```bash
node scripts/generate-tool-configs.js
```

---

### Prerequisites
- Git for version control
- macOS 10.15+, Ubuntu 20.04+/Debian 10+, or Windows 10+ (WSL/Git Bash)
- 4GB+ RAM
- **One of:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview), [Antigravity IDE](https://antigravity.dev), [OpenCode](https://opencode.ai), or [OpenAI Codex](https://openai.com/codex)

### Step 1: Clone ADF

```bash
git clone https://github.com/sotatek-dev/adf.git /tmp/adf
```

### Step 2: Install the `adf` CLI (once)

```bash
mkdir -p ~/bin
cp /tmp/adf/scripts/adf ~/bin/adf && chmod +x ~/bin/adf
```

Then add `~/bin` to your PATH and set `ADF_HOME` (only needed if your ADF repo isn't at `~/adf`):

**Ubuntu/Linux (bash)** — add to `~/.bashrc`:
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
echo 'export ADF_HOME="$HOME/adf"' >> ~/.bashrc   # optional, ~/adf is the default
source ~/.bashrc
```

**macOS (zsh)** — add to `~/.zshrc`:
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
echo 'export ADF_HOME="$HOME/adf"' >> ~/.zshrc   # optional, ~/adf is the default
source ~/.zshrc
```

### Step 3: Setup for Your Tool

#### Option A: Claude Code

```bash
cd /path/to/your-project
adf claude
```

Then launch:
```bash
claude
```

Claude Code reads `CLAUDE.md` and loads the full agent/skill ecosystem automatically.

#### Option B: Antigravity

```bash
cd /path/to/your-project
adf ag
```

Then open your project in Antigravity IDE. The workflows (slash commands) are available immediately.

#### Option C: OpenCode

```bash
cd /path/to/your-project
adf opencode
```

Then launch:
```bash
opencode
```

OpenCode reads `.claude/skills/` natively and `.opencode/agents/` for agent configs.

#### Option D: OpenAI Codex

```bash
cd /path/to/your-project
adf codex
```

Then launch:
```bash
codex
```

Codex discovers skills via `.agents/skills/` and agents via `.agents/agents/`.

#### Option E: All tools (recommended for teams)

```bash
cd /path/to/your-project
adf all
```

> **Note:** `.claude/` is the canonical source of truth. `.agent/`, `.agents`, `.codex/agents/`, and `.opencode/agents/` are all derived from it — via symlinks or the generator script (`node scripts/generate-tool-configs.js`). Zero duplication.

> **Upgrading?** Run `adf --update` to pull the latest CLI, then re-run `adf <tool>` in your project.

---

### Using ADF (same on both tools)

Once set up, the commands are identical regardless of which AI coding tool you use.

#### Initialize Documentation

On first run, generate baseline docs for your codebase:

```
/docs init
```

Creates `docs/` files: project overview, code standards, system architecture, codebase summary. These living docs keep agents context-aware about your project.

#### Plan a Feature

Before writing code, create an implementation plan:

```
/plan "add user authentication with OAuth2"
```

**What happens behind the scenes:**
1. Planner agent spawns multiple researcher agents in parallel
2. Researchers investigate best practices, libraries, patterns
3. Planner synthesizes findings into a phased plan in `plans/`
4. You review and approve the plan before implementation begins

Plan files are saved to `plans/{date}-{slug}/` with `plan.md` (overview) and `phase-XX-*.md` (detailed steps).

| Command | Use Case |
|---------|----------|
| `/plan "task"` | Standard — research + plan |
| `/plan --fast "task"` | Skip research, just analyze and plan |
| `/plan --hard "task"` | Deep research with multiple agents |
| `/plan --two "task"` | Generate 2 competing approaches |

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
| `/fix ui "issue"` | Fix UI/visual issues |
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

#### Business Analysis (Optional)

```
/specs init                           # Create FSD + use cases from codebase
/specs analyze "add payment feature"  # Document new feature requirements
/specs update                         # Sync FSD with codebase changes
```

#### Test Case Generation (Optional)

```
/test-cases generate               # Generate test cases from all use cases
/test-cases generate auth          # Generate for specific module
/test-cases update                 # Sync test cases with UC changes
/test-cases export csv             # Export for manual QA testing
```

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
/specs init                        # 0. (Optional) Create requirements docs
/test-cases generate            # 0. (Optional) Generate test cases
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
/ask "how does the middleware chain work?"        # Technical questions
/scout "find all API route handlers"              # Codebase exploration
/quality-gates setup                             # Configure security gates for project
/quality-gates report                            # Generate markdown report from last run
```

### Tips

1. **Start with `/plan`** for anything non-trivial. Plans prevent wasted effort.
2. **Use `/cook --auto`** for small, well-understood tasks. Use `/cook` for anything complex.
3. **Don't skip tests.** The framework enforces real tests — no mocks or fake data to pass builds.
4. **Let agents chain.** The workflow is plan → implement → simplify → test → review. Trust the pipeline.
5. **Check `plans/reports/`** for detailed agent findings when debugging or reviewing.
6. **Use `/brainstorm`** when unsure about approach — it's cheaper than re-implementing.

---

## Project Structure

```
├── .claude/                 # Canonical source of truth
│   ├── agents/             # 16 specialist agent definitions
│   ├── hooks/              # Claude Code event hooks
│   ├── rules/              # Development rules and workflows
│   ├── skills/             # 44 skill modules
│   └── config/             # ADF configuration
├── .agent/                  # Antigravity (symlinks to .claude/)
│   ├── agents/             # → .claude/agents/
│   ├── rules/              # → .claude/rules/
│   ├── skills/             # → .claude/skills/
│   └── workflows/          # 13 slash command proxies
├── .agents                  # → symlink to .claude (Codex skill discovery)
├── .codex/                  # OpenAI Codex configuration
│   ├── config.toml         # Project-scoped Codex config
│   ├── hooks.json          # Hook registry (3 hooks)
│   ├── hooks/              # Hook scripts (session-init, dev-rules, privacy-block)
│   └── agents/             # Generated from .claude/agents/ (16 × .toml)
├── .opencode/               # OpenCode configuration
│   ├── agents/             # Generated from .claude/agents/ (16 × .md)
│   └── plugins/
│       └── adf-hooks.js    # OpenCode plugin (session, privacy, simplify)
├── scripts/
│   └── generate-tool-configs.js  # Regenerates .codex/agents/ + .opencode/agents/
├── docs/                   # Project documentation (auto-generated)
├── plans/                  # Implementation plans and reports
│   └── reports/            # Agent-to-agent communication
├── opencode.json           # OpenCode project config (model, permissions)
├── CLAUDE.md               # Claude Code instruction file
├── AGENTS.md               # Tool-agnostic instruction file
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

---

**Works with Claude Code, Antigravity, OpenCode, and OpenAI Codex.** Same framework, same commands, same quality — pick your tool.
