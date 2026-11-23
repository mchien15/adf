# Claude Code Hooks

This directory contains hooks for Claude Code sessions. Registered in `.claude/settings.json`.

## Hooks Overview

| Hook | Event | Location | Description |
|------|-------|----------|-------------|
| **Session Init** | SessionStart | `session-init.cjs` | Resolves plan/paths, writes `CK_*` env vars |
| **Subagent Init** | SubagentStart | `subagent-init.cjs` | Injects context, paths and naming into subagents |
| **Dev Rules** | UserPromptSubmit | `dev-rules-reminder.cjs` | Injects `## Paths`, `## Plan Context`, `## Naming` (skipped if already in the last 150 transcript lines) |
| **Privacy Block** | PreToolUse | `privacy-block.cjs` | Prevents access to sensitive files |

Heavy directories (`node_modules`, `.git`, ...) are denied through `permissions.deny` in `.claude/settings.json`.

## Security

1. **Never commit tokens** - Add `.env` to `.gitignore`
2. **Use environment variables** - Never hardcode credentials
