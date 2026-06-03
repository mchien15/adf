#!/usr/bin/env bash
# Guard (Phase 2 of cmc docs-path feature): doc writer/reader instructions must reference the
# configured docs path ($CK_DOCS_PATH), NOT a literal docs/ path. A hardcoded docs/<generated>.md
# would contradict the injected path under the cmc git-profile (.adf/docs/) and send agents to the
# wrong location. Run in CI / quality-gates. Exit non-zero on violation.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Files whose docs references must stay config-aware (the writers + primary readers).
FILES="
.claude/agents/docs-manager.md
.claude/skills/docs/SKILL.md
.claude/skills/docs/references/init-workflow.md
.claude/skills/docs/references/update-workflow.md
.claude/skills/docs/references/summarize-workflow.md
.claude/agents/debugger.md
.claude/agents/code-reviewer.md
.claude/agents/fullstack-developer.md
.claude/agents/business-analyst.md
.claude/agents/testcase-writer.md
"

# Anti-pattern: a literal (./)docs/<generated-doc>.md reference (lowercase docs/ only;
# $CK_DOCS_PATH/... does not match because the segment before the file is uppercase PATH/).
PATTERN='(\./)?docs/(codebase-summary|code-standards|system-architecture|project-overview-pdr|api-docs|project-fsd|documentation-index|project-roadmap|deployment-guide)\.md'

violations=0
for f in $FILES; do
  [ -f "$f" ] || continue
  if matches="$(grep -EnH "$PATTERN" "$f" 2>/dev/null)"; then
    echo "$matches"
    violations=1
  fi
done

if [ "$violations" -ne 0 ]; then
  echo "" >&2
  echo "ERROR: hardcoded docs/ path(s) above. Use \$CK_DOCS_PATH (cmc git-profile -> .adf/docs/)." >&2
  exit 1
fi
echo "OK: docs path references are config-aware."
