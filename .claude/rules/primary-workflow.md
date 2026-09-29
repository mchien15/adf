# Primary Workflow

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT**: Ensure token efficiency while maintaining high quality.

#### 0. Requirements Analysis (Optional)
For projects that need formal requirements documentation:
- `/specs init` — Create initial FSD + use cases from codebase and PRD
- `/specs analyze "feature"` — Document new feature requirements
- `/specs update` — Sync FSD and use cases with code changes
- `/test-cases generate` — Generate test cases from use cases
- `/test-cases export csv` — Export for manual QA testing

These steps are optional. Skip if project doesn't need formal BA/QA documentation.

#### 1. Code Implementation
- Before you start, delegate to `planner` agent to create a implementation plan with TODO tasks in `./plans` directory.
- When in planning phase, use multiple `researcher` agents in parallel to conduct research on different relevant technical topics and report back to `planner` agent to create implementation plan.
- **[IMPORTANT] Main agent orchestrates, subagents write code.** Delegate every code change to a `fullstack-developer` subagent (`ui-ux-designer` for UI work): one fresh subagent per plan phase or independent task. Hand it the plan/phase file path, the files it owns, acceptance criteria and risk level.
  - When it returns: read its report, check `git diff --stat` against the files it owns, and run the compile/typecheck command.
  - Wrong or incomplete → send the findings back to that subagent (`SendMessage`), or spawn a fresh one if it is stuck. **Do not patch the code yourself.** Fixes coming out of test/review cycles are delegated the same way.
  - The main agent edits directly only plans, docs and other markdown, or when the user explicitly asks it to.
- Write clean, readable, and maintainable code
- Follow established architectural patterns
- Implement features according to specifications
- Handle edge cases and error scenarios
- **DO NOT** create new enhanced files, update to the existing files directly.
- **[IMPORTANT]** After creating or modifying code file, run compile command/script to check for any compile errors.

#### 2. Testing
- Delegate to `tester` agent to run tests on the **simplified code**
  - Write comprehensive unit tests
  - Ensure high code coverage
  - Test error scenarios
  - Validate performance requirements
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

#### 6. Visual Explanations
When explaining complex code, protocols, or architecture:
- **When to use:** User asks "explain", "how does X work", "visualize", or topic has 3+ interacting components
- Use `/preview --explain <topic>` to generate visual explanation with ASCII + Mermaid
- Use `/preview --diagram <topic>` for architecture and data flow diagrams
- Use `/preview --slides <topic>` for step-by-step walkthroughs
- Use `/preview --ascii <topic>` for terminal-friendly output only
- **Plan context:** Visuals save to plan folder from `## Plan Context` hook injection; if none, uses `plans/visuals/`
- Auto-opens in browser via markdown-novel-viewer with Mermaid rendering
- See `development-rules.md` → "Visual Aids" section for additional guidance
