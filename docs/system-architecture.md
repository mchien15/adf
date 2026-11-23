# System Architecture

**Last Updated**: 2026-04-01
**Version**: 0.0.1
**Project**: Agentic Development Framework

## Overview

Agentic Development Framework implements a multi-agent AI orchestration architecture where specialized agents collaborate through a file-based communication protocol. The system enables developers to leverage AI assistance throughout the entire software development lifecycle - from planning and implementation to testing, review, and deployment.

## Architectural Pattern

### Pattern Classification
**Primary Pattern**: Microservices-inspired Agent Architecture
**Secondary Patterns**:
- Command Pattern (slash commands)
- Observer Pattern (agent communication)
- Strategy Pattern (workflow selection)
- Template Method Pattern (agent workflows)

### Design Philosophy
- **Decoupled Agents**: Each agent is independent and specialized
- **File-Based Communication**: Agents communicate via markdown reports
- **Workflow Orchestration**: Coordinated agent execution (sequential/parallel)
- **Configuration-Driven**: Agents and commands defined in markdown
- **AI-First Development**: Leverage AI at every stage of SDLC

## System Components

### 1. Core Layer

#### 1.1 CLI Interface
**Location**: Claude Code CLI
**Responsibility**: User interaction and command routing
**Key Functions**:
- Parse slash commands
- Route to appropriate agent workflows
- Display results to users
- Manage conversation context

**Technologies**:
- Anthropic Claude Code CLI (via `claude` command)

#### 1.2 Command Parser
**Location**: Built into CLI
**Responsibility**: Command interpretation and argument extraction
**Input**: Slash command with arguments (`/command arg1 arg2`)
**Output**: Parsed command and argument values
**Argument Variables**:
- `$ARGUMENTS` - All arguments as single string
- `$1, $2, $3...` - Individual positional arguments

#### 1.3 Configuration Manager
**Location**: `.claude/` (canonical source)
**Responsibility**: Load agent and command definitions
**File Types**:
- Agent definitions (`.md` with YAML frontmatter)
- Skill modules (knowledge bases)
- Workflow templates
- Hook scripts (performance, context, security)

**Cross-Platform Design**:
- Source repo canonical tree: `.claude/`
- Installed repo canonical tree: `.adf/payload/`
- Root `.claude/` and the managed block in `CLAUDE.md` are generated outputs
- Ownership and recovery are tracked in `.adf/manifest.json`

#### 1.4 Installer Profile Resolution

**Location**: `scripts/adf`, `profiles/git-profiles.json`, `profiles/`

**Responsibility**: Resolve repo-specific git convention overlays during installer execution.

**Resolution Flow**:
1. Parse installer arguments, including optional `--git-profile`
2. Default to `adf` when profile flag is omitted
3. Validate requested profile against `profiles/git-profiles.json`
4. Stage canonical payload under `.adf/payload`
5. Apply narrow overlay files from `profiles/<profile>/` onto staged payload
6. Generate Claude Code outputs and write manifest

**Overlay targets**:
- `.claude/` for Claude Code

```text
adf claude --git-profile cmc
    -> parse args
    -> validate manifest entry
    -> stage payload in .adf/payload
    -> overlay profile-specific git refs
    -> write Claude Code outputs
    -> write manifest + backup metadata
    -> target repo reads updated git guidance
```

### 2. Agent Layer

#### 2.1 Agent Types (16 Agents)

**Planning Agents**:
- `planner` - Technical planning and architecture (Opus)
- `researcher` - Research and analysis
- `brainstormer` - Solution ideation

**Analysis Agents**:
- `business-analyst` - Requirements analysis, FSD and use case creation (Opus)

**Implementation Agents**:
- `fullstack-developer` - Full-stack implementation
- `ui-ux-designer` - Design creation and UX analysis

**Quality Assurance Agents**:
- `code-reviewer` - Code quality, architecture and reliability review
- `tester` - Test creation and execution
- `debugger` - Issue analysis, root-cause diagnosis
- `testcase-writer` - Test case generation from BA docs (Sonnet)

**Documentation & Operations Agents**:
- `docs-manager` - Documentation maintenance (Gemini)
- `journal-writer` - Development decision journaling
- `git-manager` - Version control and commit management
- `project-manager` - Progress tracking and oversight
- `mcp-manager` - MCP server management and integration

#### 2.2 Agent Definition Structure

```yaml
---
name: agent-name
description: Agent purpose and use cases
mode: subagent | all
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
---

# Agent instructions in markdown
## Core Responsibilities
## Workflow Process
## Output Requirements
## Quality Standards
```

**Model Selection**:
- Source `.claude/agents/*.md` keeps abstract model tiers such as `opus`, `sonnet`, `haiku`, and `inherit`, which Claude Code resolves at runtime

#### 2.3 Agent Communication Protocol

**Communication Medium**: File system (markdown files)
**Report Location**: `./plans/<plan-name>/reports/` (active or branch-matched plan), otherwise `./plans/reports/{YYMM}/`. Finished plans move to `./plans/archive/{YYMM}/` via `.claude/scripts/tidy-plans.cjs`
**Naming Convention**: `{date}-from-[source]-to-[dest]-[task]-report.md`

**Report Structure**:
```markdown
# Task Report: [Task Name]

**From**: [Source Agent]
**To**: [Destination Agent]
**Date**: YYYY-MM-DD
**Status**: [Complete|In Progress|Blocked]

## Summary
Brief overview of findings/results

## Details
Comprehensive information

## Recommendations
Actionable next steps

## Concerns
Issues, blockers, or questions
```

**Communication Patterns**:
1. **Request-Response**: Agent A requests, Agent B responds
2. **Broadcast**: Agent publishes report for multiple consumers
3. **Chain**: Sequential handoffs (A → B → C)
4. **Fan-Out**: Parallel execution (A spawns B, C, D)
5. **Fan-In**: Collect results from parallel agents

### 3. Command Layer

#### 3.1 Command Categories (Claude Code)

**Core Development**:
- `/plan` - Research and planning
- `/cook` - Feature implementation
- `/test` - Test execution
- `/brainstorm` - Solution ideation
- `/debug` - Deep analysis
- `/fix` - Bug fixes
- `/code-review` - Automated code review
- `/docs` - Documentation updates
- `/git` - Git operations

**Skill-Backed Commands** (`.claude/skills/`):
- `docs/` - Documentation workflows
- `plan/` - Planning workflow variants
- `code-review/` - Code review workflows
- `test/` - Testing workflows

#### 3.2 Command Workflow Pattern

```
User Input: /command [args]
    ↓
Command Parser
    ↓
Load Command Definition
    ↓
Substitute Arguments
    ↓
Execute Agent Workflow
    ↓
Sequential or Parallel Execution
    ↓
Collect Results
    ↓
Present to User
```

### 4. Workflow Layer

#### 4.1 Orchestration Patterns

**Sequential Chaining**:
```
Planner → Researcher → Planner → Main Agent → Tester → Code Reviewer → Docs Manager → Git Manager
```
Use when tasks have dependencies

**Parallel Execution**:
```
            ┌─→ Researcher (Auth) ─┐
Planner ────┼─→ Researcher (DB) ───┼─→ Planner (Synthesize)
            └─→ Researcher (UI) ───┘
```
Use for independent research tasks

**Query Fan-Out**:
```
Main Agent → Planner → [Multiple Researchers in Parallel] → Planner → Main Agent
```
Explore different approaches simultaneously

#### 4.2 Standard Workflows

**Feature Development Workflow**:
1. User: `/cook "add user authentication"`
2. Cook: Classify risk, check branch/workspace isolation, and escalate if high-risk work stays in-place
3. Planner: Create implementation plan
4. Researchers: Explore auth solutions (parallel)
5. Planner: Synthesize research, create detailed plan
6. Fullstack Developer: Implement code test-first — one failing test per acceptance criterion, then code (one fresh subagent per phase, phases back to back; the main agent orchestrates and never edits code). Steps 6–7 repeat per phase; 8–13 run once for the whole run, or after every phase with `--per-phase`
7. Main Agent: Check the diff, run type checking/compilation and checkpoint review when policy requires it
8. Tester: Run the full suite, check TDD evidence, add a test only for an acceptance criterion with none, or reject `--no-test` if the work is not low-risk
9. (If tests fail): Debugger analyzes, loop to step 6
10. Cook: Collect evidence per acceptance criterion (tester report, TDD evidence) for the reviewer
11. Code Reviewer: Judge each acceptance criterion from evidence (any ✕ blocks approval); review the diff since the run base (`{plan-dir}/reports/run-base.txt`, written when Step 3 starts), incl. the Tests row and the architecture & reliability checklist. At high risk, a second `code-reviewer` runs only that checklist in parallel; the two reports are merged
12. Docs Manager: Update documentation if warranted
13. Git Manager: Prepare closeout; commit only when git actions are approved

**Bug Fix Workflow**:
1. User: `/debug "API timeout errors"`
2. Debugger: Analyze logs and system
3. Debugger: Identify root cause
4. Planner: Create fix plan
5. Fullstack Developer: Write a failing test that reproduces the bug, then fix it
6. Tester: Validate fix
7. Code Reviewer: Review changes
8. Git Manager: Commit fix

**Documentation Update Workflow**:
1. User: `/docs update`
2. Docs Manager: Check doc freshness
3. Docs Manager: Read the codebase (Glob/Grep/Read, or `/scout` for large repos)
4. Docs Manager: Update affected documentation
5. Docs Manager: Validate naming conventions
6. Docs Manager: Create update report

### 5. Skills Layer

#### 5.1 Skill Architecture

**Purpose**: Reusable knowledge modules for specific technologies

**Structure**:
```
.claude/skills/
└── [skill-name]/
    ├── SKILL.md           # Main skill definition
    ├── references/        # Supporting documentation
    │   ├── api-ref.md
    │   └── examples.md
    └── scripts/           # Utility scripts (if applicable)
```

**Current Skills (12 Total)**: adr, brainstorm, code-review, cook, debug, docs, fix, git, plan, quality-gates, scout, test

#### 5.2 Skill Invocation

**Invocation**: `Skill` tool in CLI
**Usage**: Agents invoke skills to access specialized knowledge
**Example**:
```
Planner needs Next.js expertise
  ↓
Invokes "nextjs" skill
  ↓
Skill provides implementation guidance
  ↓
Planner incorporates into plan
```

### 6. Integration Layer

#### 6.1 Hook System (13 Core Hooks)

**Purpose**: Intercept and control Claude Code operations for performance, context management, and security

**Hook Architecture**:
All hooks located in `.claude/hooks/` with consistent patterns - fail-safe exit code 0 (non-blocking)

**Additional Hooks**:
- `privacy-block.cjs` - Sensitive file access control
- `descriptive-name.cjs` - Naming conventions enforcement
- `usage-context-awareness.cjs` - Context-aware usage patterns
- `cook-after-plan-reminder.cjs` - Cook workflow guidance
- `skill-dedup.cjs` - Skill deduplication
- `team-context-inject.cjs` - Team coordination context
- `task-completed-handler.cjs` - Task completion monitoring
- `teammate-idle-handler.cjs` - Teammate idle state detection

**1. Session-Init Hook** (`session-init.cjs`)
- **Trigger**: Session startup
- **Purpose**: Initialize session state and context
- **Functionality**:
  - Detects project type (monorepo vs library)
  - Identifies package manager (pnpm/npm/yarn)
  - Detects framework (Next.js, React, etc.)
  - Writes 25+ environment variables for context cascade
  - Enables efficient context reuse across agents

**2. Dev-Rules-Reminder Hook** (`dev-rules-reminder.cjs`)
- **Trigger**: Every user prompt
- **Purpose**: Inject development context and rules
- **Functionality**:
  - Injects current development rules from `.claude/rules/`
  - Smart deduplication prevents redundant context
  - Suggests branch-matched workflows
  - Optimized for minimal token overhead
  - Enables consistent behavior across team

**3. Subagent-Init Hook** (`subagent-init.cjs`)
- **Trigger**: When spawning subagents
- **Purpose**: Provide minimal context to subagents
- **Functionality**:
  - Injects ~200 tokens of essential context
  - Eliminates need for full context retransmission
  - Enables efficient agent-to-agent communication
  - Reduces token consumption for delegation patterns
  - Optimized for token efficiency

**4. Scout-Block Hook** (`scout-block.cjs` - Cross-Platform)
- **Trigger**: Before bash/command execution
- **Purpose**: Block access to heavy directories for performance
- **Architecture**:
  - Node.js dispatcher with platform-specific implementations
  - Windows: PowerShell implementation (`scout-block.ps1`)
  - Unix (Linux/macOS/WSL): Bash implementation (`scout-block.sh`)
  - Platform Detection: Automatic via `process.platform`
  - Zero-config setup

**Functionality**:
- Blocks access to heavy directories (node_modules, __pycache__, .git/, dist/, build/)
- Input validation (JSON structure, command presence)
- Error handling with exit codes (0 = allow, 2 = block/error)
- Security: sanitized error messages, input validation
- Performance: Reduces AI token usage and improves response time

**Testing**:
- Cross-platform test suites (`test-scout-block.sh`, `test-scout-block.ps1`)
- Comprehensive coverage (11 Unix tests, 7 Windows tests)
- Validates: blocked/allowed patterns, error handling, edge cases, JSON validation

**Hook Configuration** (`.claude/settings.json`):
```json
{
  "hooks": {
    "SubagentStart": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/subagent-init.cjs"
      }]
    }],
    "BeforeBash": [{
      "type": "command",
      "command": "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/scout-block.js"
    }]
  }
}
```

**Hook Features Summary**:
- Fail-Safe: All hooks exit 0 (non-blocking) - graceful degradation
- Performance: Optimized token consumption
- Cross-Platform: Windows (PowerShell) & Unix (Bash) support
- Context Cascade: Environment variables flow from session to agents
- Smart Dedup: Prevent redundant context injection
- Comprehensive Testing: Cross-platform test coverage

#### 6.2 External Service Integration

**GitHub**:
- Actions (CI/CD automation)
- Releases (semantic versioning)
- Issues and PRs (project management)

**Discord**:
- Webhook notifications
- Project updates
- Team communication

### 7. Data Layer

#### 7.1 File-Based Storage

**Configuration Data**:
- `.claude/` - Claude Code config
- `.claude/metadata.json` - Framework version
- `.gitignore` - Git exclusions

**Runtime Data**:
- `plans/` - Implementation plans
- `plans/<plan-name>/reports/` - Agent communication
- `plans/<plan-name>/research/` - Research reports
- `docs/` - Project documentation

**Version Control**:
- `.git/` - Git repository
- Git tags - Release versions

#### 7.2 Data Flow

```
User Input
    ↓
Command Parsing
    ↓
Agent Execution
    ↓
File System (Reports/Plans)
    ↓
Agent Reading
    ↓
Processing
    ↓
File System (Updated Docs/Code)
    ↓
Version Control (Git)
    ↓
Remote Repository (GitHub)
```

## Component Interactions

### Typical Interaction Flow: Feature Implementation

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ /cook "add auth"
       ↓
┌─────────────────────┐
│   Command Parser    │
└──────┬──────────────┘
       │ Parse command + args
       ↓
┌─────────────────────┐
│  Planner Agent      │
└──────┬──────────────┘
       │ Spawn researchers
       ↓
┌──────────────────────────────────┐
│  Researchers (Parallel)          │
│  - Auth strategies               │
│  - Security best practices       │
│  - Integration patterns          │
└──────┬───────────────────────────┘
       │ Reports to planner
       ↓
┌─────────────────────┐
│  Planner Agent      │
└──────┬──────────────┘
       │ Create plan
       │ Save to ./plans/
       ↓
┌─────────────────────┐
│   Main Agent        │
└──────┬──────────────┘
       │ Read plan
       │ Implement code
       ↓
┌─────────────────────┐
│  Tester Agent       │
└──────┬──────────────┘
       │ Write & run tests
       ↓
┌─────────────────────┐
│ Code Reviewer Agent │
└──────┬──────────────┘
       │ Review quality
       ↓
┌─────────────────────┐
│ Docs Manager Agent  │
└──────┬──────────────┘
       │ Update docs
       ↓
┌─────────────────────┐
│  Git Manager Agent  │
└──────┬──────────────┘
       │ Commit & push
       ↓
┌─────────────────────┐
│   User (Result)     │
└─────────────────────┘
```

### Agent Communication Example

```
plans/<plan-name>/reports/251026-from-planner-to-main-auth-plan-report.md
    ↓
Main Agent reads plan
    ↓
Implements features
    ↓
plans/<plan-name>/reports/251026-from-main-to-tester-auth-impl-report.md
    ↓
Tester reads implementation details
    ↓
Runs tests
    ↓
plans/<plan-name>/reports/251026-from-tester-to-main-test-results-report.md
```

## Technology Stack

### Core Technologies

**Runtime Environment**:
- Node.js >= 18.0.0
- Bash scripting (hooks)

**AI Platforms**:
- Anthropic Claude (Sonnet 4, Opus 4)
- Google Gemini 2.5 Flash
- OpenRouter (multi-model support)
- Grok Code

**CI/CD**:
- GitHub Actions
- Conventional Commits
- Semantic Versioning

### Documentation Update Flow

```
Code Changes
    ↓
Docs Manager Triggered
    ↓
Read Existing Docs + Codebase
             ↓
    Analyze Changes
             ↓
    Update Documentation
    - API docs
    - Code standards
    - Architecture
    - Codebase summary
             ↓
    Validate Naming
             ↓
    Create Report
             ↓
    Save to ./docs/
```

## Security Architecture

### Security Layers

**Layer 1: Pre-Commit Security**
- Secret scanning (git-manager agent)
- Credential detection
- .gitignore validation
- Environment file exclusion

**Layer 2: Code Security**
- Input validation enforcement
- SQL injection prevention
- XSS protection patterns
- OWASP Top 10 awareness

**Layer 3: Agent Security**
- No logging of sensitive data
- Sanitized error messages
- Secure credential handling
- API key protection

**Layer 4: Communication Security**
- File system permissions
- Report sanitization
- Context isolation
- Clean handoffs

### Secret Management

**Environment Variables**:
```
.env (local, gitignored)
.env.example (template, committed)
```

**API Keys**:
- Never hardcoded
- Environment variable injection
- Secure storage systems in production

**Credentials**:
- Password hashing (bcrypt, argon2)
- Token-based authentication
- Secure session management

## Scalability Considerations

### Horizontal Scalability

**Parallel Agent Execution**:
- Independent researchers run simultaneously
- No shared state between agents
- File-based coordination
- Scalable to N agents

**Workflow Parallelization**:
- Multiple feature branches
- Concurrent issue resolution
- Parallel test execution
- Independent documentation updates

### Vertical Scalability

**Context Management**:
- Selective context loading
- Chunked file processing
- Efficient token usage

**Performance Optimization**:
- Lazy loading of skills
- Cached MCP responses
- Incremental documentation updates
- Optimized file I/O

## Deployment Architecture

### Development Environment

```
Developer Machine
├── Claude Code CLI
├── .claude/ (configuration)
├── Git repository
└── Node.js runtime
```

### CI/CD Pipeline

```
GitHub Repository
    ↓ Push to main
GitHub Actions
    ↓
Run Tests / Checks
    ↓
Tag + GitHub Release (manual via git tag + gh release create)
```

### Production Usage

```
User Project
├── .claude/ (from template)
├── docs/ (generated)
├── plans/ (generated)
├── src/ (user code)
└── tests/ (user tests)
```

## Monitoring & Observability

### Agent Activity Tracking

**Logs**:
- Agent invocations
- Command executions
- Workflow progress
- Error occurrences

**Reports**:
- Agent communication files
- Implementation plans
- Research findings
- Test results

**Metrics**:
- Command execution time
- Agent success rates
- Test pass/fail ratios
- Documentation coverage

### Quality Metrics

**Code Quality**:
- Test coverage percentage
- Type safety compliance
- Linting pass rate
- Security scan results

**Process Metrics**:
- Planning to implementation time
- Code review turnaround
- Documentation freshness
- Commit message compliance

## Failure Handling

### Error Recovery Strategies

**Agent Failures**:
- Graceful degradation
- Error reporting to user
- Rollback mechanisms
- Retry logic for transient errors

**Workflow Failures**:
- Checkpoint saving
- Partial progress preservation
- Clear failure messages
- Recovery suggestions

**Communication Failures**:
- File write retries
- Report validation
- Missing report detection
- Timeout handling

## Extension Points

### Adding New Agents

1. Create agent definition file: `.claude/agents/my-agent.md`
2. Define YAML frontmatter (name, description, mode, model)
3. Write agent instructions and workflows
4. Reference in commands or other agents

### Adding New Command-Style Skills

1. Create skill directory: `.claude/skills/my-command/`
2. Define `SKILL.md` with YAML frontmatter and workflow instructions
3. Add script/reference files under `scripts/` or `references/` as needed
4. Register discoverability metadata for skill discovery

### Adding New Skills

1. Create skill directory: `.claude/skills/my-skill/`
2. Write `SKILL.md` with knowledge content
3. Add references and examples
4. Reference in agent definitions

### Custom Workflows

1. Define workflow in `.claude/rules/`
2. Document orchestration patterns
3. Specify agent handoffs
4. Provide examples

## Performance Considerations

### Optimization Strategies

**Token Efficiency**:
- Selective context inclusion
- Efficient prompt engineering
- Response caching where possible

**Execution Speed**:
- Parallel agent spawning
- Async file operations
- Lazy skill loading
- Minimal context switching

**Resource Usage**:
- File system efficiency
- Memory management for large files
- Cleanup of temporary files
- Optimized git operations

## Future Architecture Evolution

### Planned Enhancements

**Agent Improvements**:
- Visual workflow builder for agent orchestration
- Custom agent creator with UI
- Agent marketplace for community contributions
- Real-time agent communication (beyond files)

**Scalability Enhancements**:
- Distributed agent execution
- Cloud-based agent orchestration
- Multi-repository support
- Large-scale project handling

**Integration Expansions**:
- Additional AI platforms
- More MCP servers
- Custom integration framework
- Enterprise service connectors

## References

### Internal Documentation
- [Project Overview PDR](./project-overview-pdr.md)
- [Codebase Summary](./codebase-summary.md)
- [Code Standards](./code-standards.md)

### Tool & Platform Documentation
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)
- [MCP Documentation](https://modelcontextprotocol.io/)
- [Semantic Versioning](https://semver.org/)

## Unresolved Questions

1. **Real-Time Collaboration**: How to handle multiple developers using agents simultaneously on same codebase?
2. **Agent State Management**: Should agents maintain state between invocations beyond file system?
3. **Distributed Execution**: Architecture for running agents across multiple machines?
4. **Performance Benchmarking**: What are acceptable latency thresholds for different operation types?
