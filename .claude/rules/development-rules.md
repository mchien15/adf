# Development Rules

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You ALWAYS follow these principles: **YAGNI (You Aren't Gonna Need It) - KISS (Keep It Simple, Stupid) - DRY (Don't Repeat Yourself)**

**IMPORTANT — Docs path:** Every `docs/` reference in this framework resolves to the **configured docs directory**, injected each session as `Docs → <path>` (env `$CK_DOCS_PATH`). Default profile → `docs/`; `cmc` git-profile → `.adf/docs/`. When reading or writing project docs, use that injected path, not a literal `./docs`.

## General
- **Naming** (files, identifiers, tests, branches, ADRs, and terms in plans/reports — plan words end up in code):
  - The plain term a developer in this stack would search for, the one the library or domain uses (`compacted_at`, not `folded_at`; `pending_tool_results`, not `owed`). Unknown to a new teammate → a common word, or define it in the repo's glossary (none yet → `## Glossary` in `$CK_DOCS_PATH/project-overview-pdr.md`)
  - One term per concept, one meaning per term. Existing unclear term: keep it for its concept, flag it as a rename candidate, never reuse the word for something new
  - No metaphors, invented jargon or sentence-shaped identifiers, files or branches (`stamp_ids`, `reads-its-own-record`); things are nouns, actions are verbs
  - Tests: the behavior in about 8 words or fewer. Branch, plan and ADR slugs: 2–4 plain words (formats: `git` and `adr` skills)
  - Casing follows the language: kebab-case for JS/TS/shell, snake_case for Python (a kebab-case module cannot be imported), PascalCase for C#/Java/Kotlin/Swift, snake_case for Go/Rust. A short name for what the module holds beats a long one. Add a new file only for a new concept, never to keep another file short.
- When looking for docs, activate `docs-seeker` skill (`context7` reference) for exploring latest docs.
- Use `gh` bash command to interact with Github features if needed
- Use `psql` bash command to query Postgres database for debugging if needed
- Use `ai-multimodal` skill for describing details of images, videos, documents, etc. if needed
- Use `ai-multimodal` skill and `imagemagick` skill for generating and editing images, videos, documents, etc. if needed
- Use `sequential-thinking` and `debug` skills for sequential thinking, analyzing code, debugging, etc. if needed
- **[IMPORTANT]** Follow the codebase structure and code standards in the configured docs dir (`$CK_DOCS_PATH`) during implementation.
- **[IMPORTANT]** Do not just simulate the implementation or mocking them, always implement the real code.

## Code Quality Guidelines
- Read and follow codebase structure and code standards in the configured docs dir (`$CK_DOCS_PATH`)
- Don't be too harsh on code linting, but **make sure there are no syntax errors and code are compilable**
- Prioritize functionality and readability over strict style enforcement and code formatting
- Use reasonable code quality standards that enhance developer productivity
- Use try catch error handling & cover security standards
- Use `code-reviewer` agent to review code after every implementation

## Pre-commit/Push Rules
- Run linting before commit
- Run tests before push (DO NOT ignore failed tests just to pass the build or github actions)
- Keep commits focused on the actual code changes
- **DO NOT** commit and push any confidential information (such as dotenv files, API keys, database credentials, etc.) to git repository!
- Create clean, professional commit messages without AI references. Use conventional commit format.

## Code Implementation
- Write clean, readable, and maintainable code
- Follow established architectural patterns
- Implement features according to specifications
- Handle edge cases and error scenarios
- **DO NOT** create new enhanced files, update to the existing files directly.

## Visual Aids
- Use `/preview --explain` when explaining unfamiliar code patterns or complex logic
- Use `/preview --diagram` for architecture diagrams and data flow visualization
- Use `/preview --slides` for step-by-step walkthroughs and presentations
- Use `/preview --ascii` for terminal-friendly diagrams (no browser needed to understand)
- **Plan context:** Active plan determined from `## Plan Context` in hook injection; visuals save to `{plan_dir}/visuals/`
- If no active plan, fallback to `plans/visuals/` directory
- For Mermaid diagrams, use `/mermaidjs-v11` skill for v11 syntax rules
- See `primary-workflow.md` → Step 6 for workflow integration