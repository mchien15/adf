---
description: Create implementation plans
---
# /plan - Create Implementation Plans

$ARGUMENTS

---

## Task

Load and follow the skill definition at `.agent/skills/plan/SKILL.md`.

Pass `$ARGUMENTS` to the skill as the task description.

---

## Flags

| Flag | Mode | Description |
|------|------|-------------|
| `--auto` | Auto-detect | Analyze complexity, pick mode |
| `--fast` | Fast | Skip research, just plan |
| `--hard` | Hard | Deep research with 2 researchers |
| `--two` | Two approaches | Generate 2 competing plans |

---

## Examples

```
/plan add user authentication with OAuth2
/plan --fast refactor the database layer
/plan --hard migrate from REST to GraphQL
/plan --two implement real-time notifications
```
