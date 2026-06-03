# Init Workflow

## Phase 1: Parallel Codebase Scouting

1. Scan the codebase and calculate the number of files with LOC in each directory (skip credentials, cache or external modules directories, such as `.claude`, `.git`, `tests`, `node_modules`, `__pycache__`, `secrets`, etc.)
2. Target directories **that actually exist** - adapt to project structure, don't hardcode paths
3. Activate `scout` skill to explore the code base and return detailed summary reports to the main agent
4. Merge scout reports into context summary

## Phase 2: Documentation Creation (docs-manager Agent)

**CRITICAL:** You MUST spawn `docs-manager` agent via Task tool with merged reports. Do not wait for user input.

Pass the gathered context to docs-manager agent to create initial documentation:
- `README.md`: Update README with initial documentation (keep it under 300 lines)
- `$CK_DOCS_PATH/project-overview-pdr.md`: Project overview and PDR (Product Development Requirements)
- `$CK_DOCS_PATH/codebase-summary.md`: Codebase summary
- `$CK_DOCS_PATH/code-standards.md`: Codebase structure and code standards
- `$CK_DOCS_PATH/system-architecture.md`: System architecture
- `$CK_DOCS_PATH/project-roadmap.md`: Project roadmap
- `$CK_DOCS_PATH/deployment-guide.md` [optional]: Deployment guide
- `$CK_DOCS_PATH/design-system/design-principles.md` [optional]: Design principles

**Code-level-only (cmc) mode:** when the injected context shows `Docs mode: code-level only`, instruct docs-manager to create ONLY `$CK_DOCS_PATH/codebase-summary.md`, `$CK_DOCS_PATH/code-standards.md`, and `$CK_DOCS_PATH/documentation-index.md` (cross-linking the company `docs/` tree). Skip overview-pdr / system-architecture / roadmap / deployment-guide / design-system — the company `docs/` tree owns those.

## Phase 3: Size Check (Post-Generation)

After docs-manager completes:
1. Run `wc -l "$CK_DOCS_PATH"/*.md 2>/dev/null | sort -rn` to check LOC
2. Use `docs.maxLoc` from session context (default: 800)
3. For files exceeding limit:
   - Report which files exceed and by how much
   - docs-manager should have already split proactively
   - If still oversized, ask user: split now or accept as-is?
