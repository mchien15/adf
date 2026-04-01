---
description: Automated code quality analysis
---
# /code-review - Automated Code Quality Analysis

$ARGUMENTS

---

## Task

Load and follow the skill definition at `.agent/skills/code-review/SKILL.md`.

Pass `$ARGUMENTS` to the skill.

---

## Sub-commands

| Command | Description |
|---------|-------------|
| `/code-review` | Review recent changes |
| `/code-review codebase` | Full codebase scan |
| `/code-review codebase parallel` | Parallel multi-reviewer audit |

---

## Examples

```
/code-review
/code-review codebase
/code-review codebase parallel
```
