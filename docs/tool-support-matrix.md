# Tool Support Matrix

## Contract

ADF uses one workflow model across tools, with tool-native invocation.

- `native`: supported through the tool's real project surface
- `degraded`: supported, but with a documented platform limitation
- `unsupported`: not claimed, not relied on

`.claude/` remains the canonical authored source. Codex and OpenCode consume generated artifacts from that source.

## Support Matrix

| Surface | Claude Code | Antigravity | OpenCode | OpenAI Codex |
|---|---|---|---|---|
| Project instructions | `native` via `CLAUDE.md` | `native` via `AGENTS.md` | `native` via `opencode.json` + `.claude/skills/` | `native` via `AGENTS.md` + `.codex/config.toml` |
| Rules/workflows | `native` via `.claude/rules/*` | `native` via `.agent/rules/*` | `native` via shared `.claude/skills/*` | `native` workflow intent, tool-native invocation |
| Skills | `native` via `.claude/skills/*` | `native` via `.agent/skills/*` symlink | `native` via `.claude/skills/*` | `native` content via `.agents/skills/*` symlink |
| Custom agents | `native` via `.claude/agents/*` | `native` via `.agent/agents/*` symlink | `native` generated agents via `.opencode/agents/*` | `native` generated agents via `.codex/agents/*` |
| Hook bootstrap | `native` | `native` to tool | `native` plugin coverage | `native` for session and prompt hooks |
| Privacy enforcement | `native` on hooked Claude tools | `unsupported` in ADF layer | `native` plugin coverage | `degraded`: bash interception only |
| Workflow invocation | `native` slash commands | `native` slash commands | `native` slash commands | `native` prompts + custom-agent selection |
| Generated artifact ownership | `native` | `native` | `native` | `native` |

## Canonical And Generated Paths

| Concern | Canonical Source | Generated / Consumed Paths |
|---|---|---|
| Authored agents | `.claude/agents/*.md` | `.codex/agents/*.toml`, `.opencode/agents/*.md` |
| Authored skills | `.claude/skills/*/SKILL.md` | `.agent/skills/*`, `.agents/skills/*`, `.claude/skills/*` |
| Codex runtime | `AGENTS.md`, `.codex/config.toml`, `.codex/hooks.json` | `.codex/agents/*`, `.agents/*` |
| Claude runtime | `CLAUDE.md`, `.claude/settings.json` | `.claude/hooks/*`, `.claude/agents/*` |

## Codex Notes

- Codex is a first-class target in ADF, but not a Claude clone.
- ADF does not promise Claude-style slash-command parity in Codex.
- Codex workflows should be invoked through native prompts and generated custom agents.
- Codex privacy blocking is limited by Codex hook coverage: Bash is interceptable, Read/Edit/Write are not.

## Antigravity Notes

- Antigravity consumes ADF rules, skills, and workflow proxies, but ADF does not ship a separate Antigravity privacy-hook layer.
- Treat Antigravity privacy behavior as tool-managed rather than ADF-enforced.

## Release Gate

Before claiming first-class Claude/Codex support in docs or release notes:

- Run `node scripts/validate-claude-support.js`
- Run `node scripts/validate-codex-support.js`
- Run `node scripts/validate-support-matrix.js`
- Regenerate agents with `node scripts/generate-tool-configs.js`
- Confirm docs do not promise same-command parity for Codex
