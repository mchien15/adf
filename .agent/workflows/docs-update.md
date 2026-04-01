---
description: Manage project documentation
---
# /docs - Manage Project Documentation

$ARGUMENTS

---

## Task

Load and follow the skill definition at `.agent/skills/docs/SKILL.md`.

Pass `$ARGUMENTS` to the skill.

---

## Sub-commands

| Command | Description |
|---------|-------------|
| `/docs init` | Generate baseline docs for codebase |
| `/docs update` | Sync docs with current code state |
| `/docs summary` | Generate documentation summary |

---

## Examples

```
/docs init
/docs update
/docs summary
```
