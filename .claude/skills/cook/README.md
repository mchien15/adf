# Cook Skill

End-to-end feature implementation with smart intent detection.

## Installation

Copy the `cook/` folder to your Claude skills directory:
```bash
cp -r cook ~/.claude/skills/
```

## Usage

```bash
/cook <natural language task OR plan path>
```

The skill automatically detects your intent and routes to the appropriate workflow.

## Examples

```bash
# Interactive mode (default)
/cook implement user authentication

# Execute existing plan
/cook plans/260120-auth

# Fast mode (skip research)
/cook quick fix for login bug
/cook implement feature --fast

# Auto mode (trust me bro)
/cook implement dashboard trust me
/cook implement feature --auto

# Auto still verifies before completion
/cook plans/260519-auth/plan.md --auto

# Parallel mode (multi-agent)
/cook implement auth, payments, notifications
/cook implement feature --parallel

# No-test mode (low-risk only)
/cook update docs copy --no-test
```

## Modes

| Mode | Research | Testing | Review | Use Case |
|------|----------|---------|--------|----------|
| interactive | ✓ | ✓ | User approval | Default, full control |
| auto | ✓ | ✓ | Approval gates skipped, hard gates stay on | Trusted, hands-off |
| fast | ✗ | ✓ | Simplified | Quick fixes |
| parallel | Optional | ✓ | User approval | Multi-feature work |
| no-test | ✓ | Policy-limited skip | User approval | Low-risk speed priority |
| code | ✗ | ✓ | User approval | Existing plans |

## Intent Detection

The skill detects mode from:
1. **Explicit flags:** `--fast`, `--auto`, `--parallel`, `--no-test`
2. **Plan paths:** `./plans/*`, `plan.md`, `phase-*.md`
3. **Keywords:** "fast", "quick", "trust me", "auto", "no test"
4. **Feature count:** 3+ features → parallel mode

## Workflow

```
[Detect + Risk + Isolation] → [Research?] → [Plan] → [Implement] → [Checkpoint?] → [Test?] → [Plan-Conformance] → [Review] → [Finalize + Verify]
```

## New Guardrails

- Verification before completion always runs, even in `--auto` and allowed `--no-test` flows
- Medium/high-risk behavior work needs TDD evidence
- High-risk work, and some medium-risk multi-file phases, trigger checkpoint review
- `--no-test` is not a universal bypass
- Plan-conformance is checked before final code-quality review

## Files

```
cook/
├── SKILL.md                           # Main skill definition
├── README.md                          # This file
└── references/
    ├── intent-detection.md            # Detection rules
    ├── risk-and-gates.md              # Risk policy and hard gates
    ├── workflow-steps.md              # Step definitions
    ├── review-cycle.md                # Review process
    └── subagent-patterns.md           # Subagent usage
```

## Version

2.2.0 - Added risk-based gates, checkpoint review, plan-conformance, and mandatory verification
2.1.0 - Review gates added for human-in-the-loop mode
2.0.0 - Smart intent detection (hybrid approach)
