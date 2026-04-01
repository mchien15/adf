---
description: Implement features end-to-end
---
# /cook - Implement Features End-to-End

$ARGUMENTS

---

## Task

Load and follow the skill definition at `.agent/skills/cook/SKILL.md`.

Pass `$ARGUMENTS` to the skill as the task or plan path.

---

## Flags

| Flag | Description |
|------|-------------|
| `--interactive` | Full workflow with user approval gates (default) |
| `--auto` | Auto-approve all steps |
| `--fast` | Skip research, scout→plan→code |
| `--parallel` | Multi-agent execution |
| `--no-test` | Skip testing step |

---

## Examples

```
/cook add a health check endpoint
/cook --auto implement the authentication plan
/cook --fast add dark mode toggle
/cook plans/260316-auth/plan.md
```
