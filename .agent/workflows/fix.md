---
description: Debug issues and apply fixes
---
# /fix - Debug Issues and Apply Fixes

$ARGUMENTS

---

## Task

Load and follow the skill definition at `.agent/skills/fix/SKILL.md`.

Pass `$ARGUMENTS` to the skill as the issue description.

---

## Flags

| Flag | Description |
|------|-------------|
| `--auto` | Autonomous mode (default) |
| `--review` | Human-in-the-loop review |
| `--quick` | Quick fix, no deep analysis |
| `--parallel` | Parallel multi-agent fix |

## Specialized Workflows

| Keyword | Description |
|---------|-------------|
| `test` | Run tests and fix failures |
| `types` | Fix TypeScript type errors |
| `ui` | Fix UI/visual issues |
| `ci <url>` | Analyze GitHub Actions logs |
| `logs` | Analyze app logs and fix |

---

## Examples

```
/fix login form not validating email
/fix --quick typo in header component
/fix --parallel race condition in WebSocket
/fix test
/fix ci https://github.com/org/repo/actions/runs/123
```
