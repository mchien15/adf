# Primary Workflow

Plan → implement → test → review → docs. The `cook` and `fix` skills run this flow; this file holds the rules they rely on.

## 1. Plan
- For non-trivial work, the `planner` agent writes a plan in the plans path (`$CK_PLANS_PATH`). It may run several `researcher` agents in parallel first.
- Plan layout, the `## Impact` table and the append-only `## Decision Log`: `plan` skill → `references/plan-organization.md`.

## 2. Implement
- **The main agent orchestrates; subagents write code.** Delegate every code change to a fresh `fullstack-developer` subagent per plan phase or independent task. Hand it the plan/phase file, the files it owns, the acceptance criteria and the risk level.
  - When it returns: read its report, check `git diff --stat` against the files it owns, and run the compile/typecheck command.
  - Wrong or incomplete → send the findings back to it (`SendMessage`), or spawn a fresh one if it is stuck. Do not patch the code yourself; fixes from test and review cycles are delegated the same way.
  - The main agent edits only plans, docs and other markdown directly, unless the user asks otherwise.
- **How much code:** the implementer follows the ponytail rules (injected into subagents by the ponytail plugin while ponytail mode is on) and the phase's Reuse list.
- **Test-first (TDD).** Every acceptance criterion starts with a failing test (no plan: a small test for non-trivial logic, none for trivial changes; a bug fix starts with a test that reproduces the bug): RED (fails for the right reason) → GREEN (simplest code) → REFACTOR. The full suite runs once at the end of the phase. The implementer reports RED/GREEN evidence; the cycle is defined in `fullstack-developer`.
- After changing code, run the compile/typecheck command.

## 3. Test
- Delegate to the `tester` agent on the final code. It checks the RED/GREEN evidence and adds a test only for an acceptance criterion or listed edge case no test covers.
- Coverage is a diagnostic, not a target: follow the project's configured threshold. Check performance only when the task sets a requirement.
- Never ignore failing tests, and never use fake data, mocks or workarounds just to pass the build. Fix (through `fullstack-developer`) and re-run until everything passes.

## 4. Review
- After tests pass, delegate to the `code-reviewer` agent.
- Before merge, run by the user (not part of cook): `/thermo-nuclear-code-quality-review` (Opus) for a deep structural review of the branch, and `/ponytail-debt` to list the `shortcut:` comments it adds. A large restructuring that thermo suggests becomes a new phase or plan, not an edit to the branch under review.

## 5. Docs
- Delegate to the `docs-manager` agent to update the docs path (`$CK_DOCS_PATH`) when the change warrants it: roadmap progress, a changelog entry for features and significant fixes, architecture or code standards when they change. Document breaking changes.

## Debugging
For bugs and server or CI/CD issues: the `debugger` agent finds the root cause and writes a report, a `fullstack-developer` makes the fix, the `tester` re-runs the tests, and the change goes back through Review.

## Delegation context
Every subagent prompt includes:
- **Work context:** the git root of the files being worked on
- **Plans:** `{work context}/plans/`
- **Reports:** the `Reports:` path from `## Plan Context` (fallback `{work context}/plans/reports/`)

When the files belong to a project other than the current directory, use that project's paths. Chain subagents when one needs another's output; run them in parallel only when they own different files.
