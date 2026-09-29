#!/usr/bin/env node
/**
 * cook-after-plan-reminder: never points /cook at an archived (missing) plan.
 * Run: node --test .claude/hooks/__tests__/cook-after-plan-reminder.test.cjs
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { writeSessionState, getSessionTempPath } = require('../lib/ck-config-utils.cjs');

const HOOK = path.join(__dirname, '..', 'cook-after-plan-reminder.cjs');

function runHook(sessionId) {
  const res = spawnSync('node', [HOOK], {
    input: '{}',
    encoding: 'utf8',
    env: { ...process.env, CK_SESSION_ID: sessionId }
  });
  return { exitCode: res.status, stdout: res.stdout };
}

describe('cook-after-plan-reminder plan path', () => {
  let root;
  const sessions = [];

  before(() => { root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ck-cook-reminder-'))); });
  after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    for (const id of sessions) fs.rmSync(getSessionTempPath(id), { force: true });
  });

  function sessionWithPlan(planDir) {
    const id = `cook-reminder-${process.pid}-${sessions.length}-${Date.now()}`;
    sessions.push(id);
    writeSessionState(id, { activePlan: planDir, sessionOrigin: root, timestamp: Date.now() });
    return id;
  }

  it('prints the plan.md path of an existing active plan', () => {
    const planDir = path.join(root, 'plans', '260929-1200-live');
    fs.mkdirSync(planDir, { recursive: true });
    const res = runHook(sessionWithPlan(planDir));
    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stdout.includes(`Run /clear then /cook ${path.join(planDir, 'plan.md')}`), res.stdout);
  });

  it('falls back to the placeholder when the active plan was archived', () => {
    const planDir = path.join(root, 'plans', '260101-0000-archived');
    const res = runHook(sessionWithPlan(planDir));
    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stdout.includes('{full-absolute-path-to-plan.md}'), res.stdout);
    assert.ok(!res.stdout.includes(planDir), res.stdout);
  });
});
