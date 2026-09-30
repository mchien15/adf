# Test Report Format

Structured QA report template. Sacrifice grammar for concision.

## Template

```markdown
# Test Report — {date} — {scope}

## Test Results Overview
- **Total**: X tests
- **Passed**: X | **Failed**: X | **Skipped**: X
- **Duration**: Xs

## Tests Added
- `test/path/file.test.ts` — TestName — gap: [changed behavior / error path / integration point no test exercised]
- (or: none)

## Coverage Metrics (when the test runner produces coverage)
| Metric   | Value | Project threshold      | Status |
|----------|-------|------------------------|--------|
| Lines    | X%    | [configured or "none"] | PASS/FAIL/n-a |
| Branches | X%    | [configured or "none"] | PASS/FAIL/n-a |
| Functions| X%    | [configured or "none"] | PASS/FAIL/n-a |

## Failed Tests
### `test/path/file.test.ts` — TestName
- **Error**: Error message
- **Stack**: Relevant stack trace (truncated)
- **Cause**: Brief root cause analysis
- **Fix**: Suggested resolution

## UI Test Results (if applicable)
- **Pages tested**: X
- **Screenshots**: ./screenshots/
- **Console errors**: none | [list]
- **Responsive**: checked at [viewports] | skipped
- **Performance**: LCP Xs, FID Xms, CLS X

## Build Status
- **Build**: PASS/FAIL
- **Warnings**: none | [list]
- **Dependencies**: all resolved | [issues]

## Critical Issues
1. [Blocking issue description + impact]

## Recommendations
1. [Fix for a finding above, with priority — not a list of extra tests]

## Unresolved Questions
- [Any open questions, if any]
```

## Guidelines

- Include ALL failed tests with error messages — don't summarize away details
- Coverage: name uncovered changed code, not just percentages; a number below the project threshold is a finding, not a reason to add filler tests
- Screenshots: embed paths directly in report for easy access
- Recommendations: prioritize by impact (critical > high > medium > low)
- Keep report under 200 lines — split into sections if larger scope needed
- Save report using naming pattern from `## Naming` section injected by hooks
