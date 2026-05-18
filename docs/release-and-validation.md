# Release and Validation Procedures

## Overview

ADF maintains strict validation gates for cross-tool support before claiming first-class support for Claude Code, OpenAI Codex, and OpenCode. This document outlines the procedures and validation requirements.

## Pre-Release Validation

Before merging changes to the main branch or creating a release:

### 1. Claude Code Support Validation

**Command:**
```bash
node scripts/validate-claude-support.js
```

**Checks:**
- `CLAUDE.md` exists and contains proper instructions
- `.claude/settings.json` exists with valid hook configuration (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse)
- `.claude/agents/` directory contains exactly 16 agent definitions (`.md` files)
- `.claude/skills/` directory contains exactly 44 skills with proper structure

**Failure Handling:**
If validation fails, the script exits with code 1. Do not merge until all checks pass.

### 2. Codex Support Validation

**Command:**
```bash
node scripts/validate-codex-support.js
```

**Checks:**
- `AGENTS.md` exists with proper instructions
- `.codex/config.toml` exists with:
  - `project_doc_fallback_filenames = ["CLAUDE.md"]`
  - `[agents]` section with `max_depth = 2` and `max_threads = 8`
- `.codex/hooks.json` exists with proper event groups (SessionStart, UserPromptSubmit, PreToolUse)
- `.codex/agents/` directory exists
- `.codex/scripts/set-active-plan-codex.cjs` exists
- `.agents/` support path exists
- `.claude/scripts/set-active-plan.cjs` and `.agents/scripts/set-active-plan.cjs` stay in parity
- Generated `.codex/agents/` (`.toml` files) count matches source `.claude/agents/` (`.md` files) count
- All `.codex/agents/*.toml` files contain `developer_instructions` field
- Known `opus|sonnet|haiku` source tiers map to explicit Codex `model = "..."` lines, while `inherit` omits `model`
- Generated Codex planner output references the native Codex helper, not the Claude helper
- Codex SessionStart and UserPromptSubmit hooks still resolve plan/report paths correctly from subdirectory `cwd` values

**Failure Handling:**
If validation fails, regenerate tool configs and re-validate.

### 3. Support Matrix Validation

**Command:**
```bash
node scripts/validate-support-matrix.js
```

**Checks:**
- `README.md` does not promise same-command parity across tools
- `README.md` links to `docs/tool-support-matrix.md`
- `README.md` contains correct tool support table rows for all four platforms
- `docs/tool-support-matrix.md` contains all required status indicators (`native`, `degraded`, `unsupported`)
- Documentation mentions Codex privacy limitations
- Documentation includes release gate validation commands

**Failure Handling:**
Fix documentation drift in README.md and docs/tool-support-matrix.md before merging.

## Configuration Regeneration

After modifying `.claude/agents/*.md` or `.claude/skills/*/SKILL.md`:

**Command:**
```bash
node scripts/generate-tool-configs.js
```

**Output:**
- `.codex/agents/*.toml` — Codex-native agent configurations
- `.opencode/agents/*.md` — OpenCode agent configurations

`generate-tool-configs.js` does not regenerate `.codex/config.toml` or `.codex/hooks.json`; those runtime files are maintained separately.

## Release Gate Procedure

**Full Release Gate (before publishing v0.0.x):**

```bash
# 1. Validate Claude support
node scripts/validate-claude-support.js

# 2. Validate Codex support
node scripts/validate-codex-support.js

# 3. Validate support matrix documentation
node scripts/validate-support-matrix.js

# 4. Regenerate artifacts if agents or skills changed
node scripts/generate-tool-configs.js

# 5. Run tests to ensure nothing broke
npm test  # if applicable

# 6. Verify Git status clean
git status
```

If all validations pass, the release is ready to proceed.

## Canonical and Generated Paths

### Authored Sources (.claude/)
- `.claude/agents/*.md` — Agent definitions (canonical source, 16 total)
- `.claude/skills/*/SKILL.md` — Skill definitions (canonical source, 44 total)
- `.claude/settings.json` — Claude Code hook configuration
- `.claude/rules/` — Workflow rules and development guidelines
- `CLAUDE.md` — Claude Code project instructions

### Generated for Codex
- `.codex/agents/*.toml` — Agent definitions (Codex-native format, with explicit `model` for mapped tiers)
- `.codex/config.toml` — Codex runtime and agent configuration
- `.codex/hooks.json` — Codex hook registration
- `.codex/scripts/set-active-plan-codex.cjs` — Codex-native active-plan helper
- `.agents/skills/` — Directory containing skill references for Codex

### Generated for OpenCode
- `.opencode/agents/*.md` — Agent definitions (OpenCode-native format)

### Codex Runtime Sources
- `AGENTS.md` — Codex project instructions (Antigravity fallback)
- `.agents/` — Support path for skills and rules

## Known Limitations

### Codex Privacy Enforcement
- **Full support**: Session/bootstrap hooks, bash privacy interception
- **Degraded support**: Read/Edit/Write operations (Codex cannot hook file operations the same way Claude can)
- **Consequence**: Privacy enforcement in Codex is bash-only, not file-operation complete

See [Tool Support Matrix](./tool-support-matrix.md) for full cross-tool surface mapping.

## Continuous Integration

All validation scripts should run in CI/CD before merge:

**GitHub Actions Example:**
```yaml
- name: Validate tool support
  run: |
    node scripts/validate-claude-support.js
    node scripts/validate-codex-support.js
    node scripts/validate-support-matrix.js
```

## Troubleshooting

### Validation Failures

**Claude support fails:**
- Check `.claude/settings.json` has all required hooks
- Verify `.claude/agents/` and `.claude/skills/` counts match expected (16 agents, 44 skills)

**Codex support fails:**
- Run `node scripts/generate-tool-configs.js` to regenerate from source
- Verify `.codex/config.toml` has correct config keys
- Check `.codex/agents/*.toml` files exist, contain `developer_instructions`, and have correct Codex `model` mapping behavior
- Check `.codex/scripts/set-active-plan-codex.cjs` exists and planner output references it
- Re-run the hook validation path to confirm subdirectory `cwd` handling still resolves repo-root plans and reports

**Support matrix fails:**
- Update `README.md` to remove same-command parity promises
- Add Tool Support Matrix link to README
- Verify all platform rows in README match generated agent/skill counts

## Related Documentation

- [Tool Support Matrix](./tool-support-matrix.md)
- [System Architecture](./system-architecture.md)
- [Project Overview & PDR](./project-overview-pdr.md)
