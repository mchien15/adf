# Project Documentation Management

### Roadmap & Changelog Maintenance
- **Project Roadmap** (`./docs/development-roadmap.md`): Living document tracking project phases, milestones, and progress
- **Project Changelog** (`./docs/project-changelog.md`): Detailed record of all significant changes, features, and fixes
- **System Architecture** (`./docs/system-architecture.md`): Detailed record of all significant changes, features, and fixes
- **Code Standards** (`./docs/code-standards.md`): Detailed record of all significant changes, features, and fixes

### Automatic Updates Required
- **After Feature Implementation**: Update roadmap progress status and changelog entries
- **After Major Milestones**: Review and adjust roadmap phases, update success metrics
- **After Bug Fixes**: Document fixes in changelog with severity and impact
- **After Security Updates**: Record security improvements and version updates
- **Weekly Reviews**: Update progress percentages and milestone statuses

### BA/QA Documentation
- **Functional Spec** (`./docs/project-fsd.md`): Feature specs, data models, business rules, API contracts, screen descriptions
- **Use Cases** (`./docs/usecases/{module}/`): Per-module use case files (UC-{MOD}-{NNN})
- **Test Cases** (`./test-cases/{module}/`): Per-module test case files (TC-{MOD}-{NNN}-{NN})
- **Test Summary** (`./test-cases/test-summary.md`): Coverage matrix, priority/type distribution

### Documentation Triggers
The `project-manager` agent MUST update these documents when:
- A development phase status changes (e.g., from "In Progress" to "Complete")
- Major features are implemented or released
- Significant bugs are resolved or security patches applied
- Project timeline or scope adjustments are made
- External dependencies or breaking changes occur
- After BA analysis: update FSD and use cases via `/specs update`
- After QA generation: update test cases via `/test-cases update`

### Update Protocol
1. **Before Updates**: Always read current roadmap and changelog status
2. **During Updates**: Maintain version consistency and proper formatting
3. **After Updates**: Verify links, dates, and cross-references are accurate
4. **Quality Check**: Ensure updates align with actual implementation progress

### Plans

### Plan Location
Save plans in `./plans` directory with timestamp and descriptive name.

**Format:** Use naming pattern from `## Naming` section injected by hooks.

**Example:** `plans/251101-1505-authentication-and-profile-implementation/`

#### File Organization & Structure

**Single source of truth:** [`.claude/skills/plan/references/plan-organization.md`](../skills/plan/references/plan-organization.md)

It defines the plan directory layout, the required `plan.md` sections — `Overview` · `Impact` · `Phases` · `Dependencies` · `Decision Log` — and the phase-file section list.

Do not restate that spec here. Two copies drift, and the one that drifts is always the copy nobody is looking at.

Two rules from it are worth knowing without opening the file:

- **`## Impact`** — four fixed rows (DB schema/migration · API contract · Security/permissions · Breaking change). An empty table means "not assessed yet", not "nothing is affected".
- **`## Decision Log`** — append-only. Never edit or delete a row, never condense the log. It is what keeps the *why* alive across compaction and new sessions.