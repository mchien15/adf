# Summarize Workflow

Activate `scout` skill to analyze the codebase and update `$CK_DOCS_PATH/codebase-summary.md` and respond with a summary report.

## Arguments
$1: Focused topics (default: all)
$2: Should scan codebase (`Boolean`, default: `false`)

## Focused Topics
<focused_topics>$1</focused_topics>

## Should Scan Codebase
<should_scan_codebase>$2</should_scan_codebase>

## Important
- Use the configured docs directory (`$CK_DOCS_PATH`) as the source of truth for documentation.
- Do not scan the entire codebase unless the user explicitly requests it.
- **Do not** start implementing.
