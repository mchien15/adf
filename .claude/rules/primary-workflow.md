# Primary Workflow

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT**: Ensure token efficiency while maintaining high quality.

#### 1. Code Implementation
- Before you start, delegate to `planner` agent to create a implementation plan with TODO tasks in `./plans` directory.
- When in planning phase, use multiple `researcher` agents in parallel to conduct research on different relevant technical topics and report back to `planner` agent to create implementation plan.
- **[IMPORTANT] Main agent orchestrates, subagents write code.** Delegate every code change to a `fullstack-developer` subagent (`ui-ux-designer` for UI work): one fresh subagent per plan phase or independent task. Hand it the plan/phase file path, the files it owns, acceptance criteria and risk level.
  - When it returns: read its report, check `git diff --stat` against the files it owns, and run the compile/typecheck command.
  - Wrong or incomplete → send the findings back to that subagent (`SendMessage`), or spawn a fresh one if it is stuck. **Do not patch the code yourself.** Fixes coming out of test/review cycles are delegated the same way.
  - The main agent edits directly only plans, docs and other markdown, or when the user explicitly asks it to.
- **How much code:** the implementer follows the ponytail rules (injected into subagents by the ponytail plugin while ponytail mode is on) and the phase's Reuse list.
- **[IMPORTANT] Test-first (TDD).** Every acceptance criterion starts with a failing test (no plan: follow the ponytail skill — a small test for non-trivial logic, none for trivial changes; bug fixes still start with a reproducing test): RED (watch it fail for the right reason) → GREEN (simplest code, tests of the changed code pass) → REFACTOR; the full suite runs once at the end of the phase. Bug fixes start with a test that reproduces the bug. The implementer reports RED/GREEN evidence; the cycle is defined in `fullstack-developer`.
- Write clean, readable, and maintainable code
- Follow established architectural patterns
- Implement features according to specifications
- Handle edge cases and error scenarios
- **DO NOT** create new enhanced files, update to the existing files directly.
- **[IMPORTANT]** After creating or modifying code file, run compile command/script to check for any compile errors.

#### 2. Testing
- Delegate to `tester` agent to run tests on the final code
  - Tests were written first during implementation (TDD); check the RED/GREEN evidence and add a test only for an acceptance criterion or listed edge case no test checks
  - Coverage is a diagnostic, not a target: follow the project's configured threshold, never add tests just to raise it
  - Validate performance only when the task sets a performance requirement
- Tests verify the FINAL code that will be reviewed and merged
- **DO NOT** ignore failing tests just to pass the build.
- **IMPORTANT:** make sure you don't use fake data, mocks, cheats, tricks, temporary solutions, just to pass the build or github actions.
- **IMPORTANT:** Always fix failing tests follow the recommendations and delegate to `tester` agent to run tests again, only finish your session when all tests pass.

#### 3. Code Quality
- After testing passes, delegate to `code-reviewer` agent to review clean, tested code.
- Follow coding standards and conventions
- Write self-documenting code
- Add meaningful comments for complex logic
- Optimize for performance and maintainability

#### 3b. Before Merge (run by the user, not part of cook)
- `/thermo-nuclear-code-quality-review` (Opus) for a deep structural review of the branch
- `/ponytail-debt` to list the `shortcut:` comments the branch adds
- A large restructuring that thermo suggests becomes a new phase or plan, not an edit to the branch under review

#### 4. Integration
- Always follow the plan given by `planner` agent
- Ensure seamless integration with existing code
- Follow API contracts precisely
- Maintain backward compatibility
- Document breaking changes
- Delegate to `docs-manager` agent to update docs in `./docs` directory if any.

#### 5. Debugging
- When a user report bugs or issues on the server or a CI/CD pipeline, delegate to `debugger` agent to run tests and analyze the summary report.
- Read the summary report from `debugger` agent and delegate the fix to a `fullstack-developer` subagent (see Step 1).
- Delegate to `tester` agent to run tests and analyze the summary report.
- If the `tester` agent reports failed tests, fix them follow the recommendations and repeat from the **Step 3**.
