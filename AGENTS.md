# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

## Workflows

- Primary workflow: `./.agent/rules/primary-workflow.md`
- Development rules: `./.agent/rules/development-rules.md`
- Orchestration protocols: `./.agent/rules/orchestration-protocol.md`
- Documentation management: `./.agent/rules/documentation-management.md`
- And other workflows: `./.agent/rules/*`

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You must follow strictly the development rules in `./.agent/rules/development-rules.md` file.
**IMPORTANT:** Before you plan or proceed any implementation, always read the `./README.md` file first to get context.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.

## Python Scripts (Skills)

When running Python scripts from `.agent/skills/`, use the venv Python interpreter:
- **Linux/macOS:** `.agent/skills/.venv/bin/python3 scripts/xxx.py`
- **Windows:** `.agent\skills\.venv\Scripts\python.exe scripts\xxx.py`

This ensures packages installed by `install.sh` (google-genai, pypdf, etc.) are available.

**IMPORTANT:** When scripts of skills failed, don't stop, try to fix them directly.

## [IMPORTANT] Consider Modularization
- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names, it's fine if the file name is long because this ensures file names are self-documenting for LLM tools (Grep, Glob, Search)
- Write descriptive code comments
- After modularization, continue with main task
- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.

## Documentation Management

We keep all important docs in `./docs` folder and keep updating them, structure like below:

```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-system/            # Design principles, tokens, catalog, themes
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

**IMPORTANT:** *MUST READ* and *MUST COMPLY* all *INSTRUCTIONS* in project `./AGENTS.md`, especially *WORKFLOWS* section is *CRITICALLY IMPORTANT*, this rule is *MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS. MUST REMEMBER AT ALL TIMES!!!*

## Supported AI Coding Tools

This repo works with Claude Code, Antigravity, OpenAI Codex, and OpenCode. See `README.md` for the full compatibility table.

**Tool Support Contract:** See `docs/tool-support-matrix.md` for per-tool surface mapping (native vs degraded vs unsupported), canonical and generated paths, and release gate validation procedures.

- **Skills location:** `.claude/skills/` (45 skills) — OpenCode reads this natively; Codex via `.agents/skills/`
- **Agents location:** `.claude/agents/` (16 canonical source agents) — generated to `.codex/agents/` and `.opencode/agents/`
- **Tool-specific config:** `opencode.json` (OpenCode), `.codex/config.toml` (Codex)
- **Validation procedures:** See `docs/release-and-validation.md` for pre-release checks and CI/CD setup

## Workflow Invocation

ADF uses the same workflow model across tools, but invocation is tool-native.

### Claude Code, Antigravity, OpenCode

Use workflow slash commands directly:

```
/cook "implement feature X"    # End-to-end implementation
/plan "design auth system"     # Create implementation plan
/fix "TypeError in auth.js"    # Debug and fix bug
/research "best DB for X"      # Technical research
/test                          # Run test suite
/review                        # Code review
/git                           # Commit + push
```

### Codex

- Read `AGENTS.md` first, then use Codex-native prompts that reference the workflow or agent explicitly
- Skills are authored in `.agents/skills/*/SKILL.md`
- Custom agents are generated in `.codex/agents/*.toml`
- Prefer prompts like `Use the plan skill to design auth` or `Use the cook skill on plans/.../plan.md`
- After modifying `.claude/agents/*.md`, regenerate: `node scripts/generate-tool-configs.js`

## Agent Switching (OpenCode)

- Press **Tab** to cycle agents
- `@agent-name` to mention a specific agent inline
- Available agents: `planner`, `researcher`, `tester`, `code-reviewer`, `debugger`, `docs-manager`, `git-manager`, `ui-ux-designer`, `fullstack-developer`, `code-simplifier`

## Agent Invocation (Codex)

- Use Codex custom agents from `.codex/agents/`
- Use `.agents/skills/` as the Codex-facing skill/reference tree sourced from `.claude/`
- Do not assume Claude slash-command parity in Codex; use native prompts and agent selection
