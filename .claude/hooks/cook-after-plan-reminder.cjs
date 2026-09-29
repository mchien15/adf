#!/usr/bin/env node
/**
 * Plan Subagent Stop Hook - Cook Skill Reminder
 *
 * Fires when Plan subagent completes. Reminds to invoke /cook --auto before implementation.
 * Also outputs full absolute path so new sessions (after /clear) can find the plan in worktrees.
 *
 * Exit Codes:
 *   0 - Success (non-blocking)
 */

// Crash wrapper
try {
  const fs = require('fs');
  const path = require('path');
  const { isHookEnabled, resolveSessionPlanPath } = require('./lib/ck-config-utils.cjs');

  // Early exit if hook disabled in config
  if (!isHookEnabled('cook-after-plan-reminder')) {
    process.exit(0);
  }

  async function main() {
  try {
    const stdin = fs.readFileSync(0, 'utf-8').trim();
    if (!stdin) process.exit(0);

    // Active plan path from session state; null once its dir is gone (archived/deleted)
    const planPath = resolveSessionPlanPath(process.env.CK_SESSION_ID);

    // Output reminder with full absolute path if available
    console.log('MUST invoke /cook --auto skill before implementing the plan');
    if (planPath) {
      const planMdPath = path.join(planPath, 'plan.md');
      console.log(`Best Practice: Run /clear then /cook ${planMdPath}`);
    } else {
      // Fallback when plan path unavailable
      console.log('Best Practice: Run /clear then /cook {full-absolute-path-to-plan.md}');
    }

    process.exit(0);
  } catch (error) {
    // Silent fail - non-blocking
    process.exit(0);
  }
  }

  main();
} catch (e) {
  // Minimal crash logging (zero deps — only Node builtins)
  try {
    const fs = require('fs');
    const p = require('path');
    const logDir = p.join(__dirname, '.logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(p.join(logDir, 'hook-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), hook: p.basename(__filename, '.cjs'), status: 'crash', error: e.message }) + '\n');
  } catch (_) {}
  process.exit(0); // fail-open
}
