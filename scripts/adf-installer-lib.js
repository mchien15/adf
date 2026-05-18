#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const MANIFEST_VERSION = '2.0.0';
const DEFAULT_PROFILE = 'adf';
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const BLUE = '\x1b[0;34m';
const NC = '\x1b[0m';

const TOOL_ALIASES = new Map([
  ['', 'claude'],
  ['claude', 'claude'],
  ['ag', 'ag'],
  ['antigravity', 'ag'],
  ['opencode', 'opencode'],
  ['oc', 'opencode'],
  ['codex', 'codex'],
  ['all', 'all'],
  ['repair', 'repair'],
  ['rollback', 'rollback'],
  ['help', 'help'],
  ['--help', 'help'],
  ['-h', 'help'],
  ['update', 'update'],
  ['--update', 'update'],
  ['-u', 'update'],
]);

const BLOCKS = {
  'CLAUDE.md': 'adf-claude-instructions',
  'AGENTS.md': 'adf-agents-instructions',
};

const OWNERSHIP = {
  TREE: 'managed-children',
  BLOCK: 'managed-block',
  GENERATED: 'generated-exclusive',
};

function createInstallerContext(env = {}) {
  const adfHome = path.resolve(env.ADF_HOME || path.join(os.homedir(), 'adf'));
  const target = env.TARGET ? path.resolve(env.TARGET) : process.cwd();
  return { adfHome, target };
}

function log(color, message) {
  console.log(`${color}[ADF]${NC} ${message}`);
}

function info(message) { log(BLUE, message); }
function success(message) { log(GREEN, message); }
function warn(message) { log(YELLOW, message); }
function fail(message, code = 1) { log(RED, message); process.exit(code); }

function usage(adfHome) {
  console.log(`ADF - Install ADF payload into .adf with tool-specific support surfaces

Usage: adf [tool] [flags]

Tools:
  adf                Install Claude support surfaces (default)
  adf claude         Install Claude support surfaces
  adf ag             Install Antigravity support surfaces
  adf opencode       Install OpenCode support surfaces
  adf codex          Install Codex support surfaces
  adf all            Install all support surfaces
  adf repair         Recreate missing/broken managed outputs from manifest
  adf rollback [id]  Restore last successful managed state (default: latest)
  adf --update       Update ~/bin/adf from ADF_HOME

Flags:
  --git-profile <id>  Git overlay profile (${DEFAULT_PROFILE} by default)
  --dry-run           Print plan and conflicts without writing
  --adopt-legacy      Adopt pristine legacy root-copy installs

Examples:
  adf opencode --git-profile cmc
  adf all --dry-run
  adf claude --adopt-legacy
  adf repair
  adf rollback latest

Current ADF_HOME: ${adfHome}`);
}

function ensureInsideTarget(context, relativePath) {
  const absolute = path.resolve(context.target, relativePath);
  const targetPrefix = `${context.target}${path.sep}`;
  if (absolute !== context.target && !absolute.startsWith(targetPrefix)) {
    fail(`Refusing to access path outside target repo: ${relativePath}`);
  }
  return absolute;
}

function repoPath(context, relativePath) {
  return ensureInsideTarget(context, relativePath);
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Corrupt JSON at ${filePath}: ${error.message}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function statType(filePath) {
  if (!fs.existsSync(filePath)) return 'missing';
  const stats = fs.lstatSync(filePath);
  if (stats.isSymbolicLink()) return 'symlink';
  if (stats.isDirectory()) return 'directory';
  return 'file';
}

function walkDir(root, current, lines) {
  const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const entryPath = path.join(current, entry.name);
    const relative = path.relative(root, entryPath).split(path.sep).join('/');
    if (entry.isSymbolicLink()) {
      lines.push(`symlink:${relative}:${fs.readlinkSync(entryPath)}`);
      continue;
    }
    if (entry.isDirectory()) {
      lines.push(`dir:${relative}`);
      walkDir(root, entryPath, lines);
      continue;
    }
    lines.push(`file:${relative}:${sha256Text(fs.readFileSync(entryPath))}`);
  }
}

function pathFingerprint(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const type = statType(filePath);
  if (type === 'symlink') return `symlink:${fs.readlinkSync(filePath)}`;
  if (type === 'file') return `file:${sha256Text(fs.readFileSync(filePath))}`;
  const lines = [];
  walkDir(filePath, filePath, lines);
  return `dir:${sha256Text(lines.join('\n'))}`;
}

function copyPath(source, target) {
  const type = statType(source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });
  if (type === 'symlink') {
    const linkType = process.platform === 'win32'
      ? 'junction'
      : fs.statSync(source).isDirectory() ? 'dir' : 'file';
    fs.symlinkSync(fs.readlinkSync(source), target, linkType);
    return;
  }
  if (type === 'directory') {
    fs.cpSync(source, target, { recursive: true, dereference: false, force: true, verbatimSymlinks: true });
    return;
  }
  fs.cpSync(source, target, { recursive: false, dereference: false, force: true, verbatimSymlinks: true });
}

function createManagedBlock(fileName, content) {
  const id = BLOCKS[fileName];
  return [`<!-- adf:managed-block:start ${id} -->`, content.trimEnd(), `<!-- adf:managed-block:end ${id} -->`, ''].join('\n');
}

function upsertManagedBlock(existingText, fileName, content) {
  const id = BLOCKS[fileName];
  const block = createManagedBlock(fileName, content);
  const pattern = new RegExp(`<!-- adf:managed-block:start ${id} -->[\\s\\S]*?<!-- adf:managed-block:end ${id} -->\\n?`, 'm');
  if (pattern.test(existingText)) return existingText.replace(pattern, block);
  if (!existingText.trim()) return block;
  return `${block.trimEnd()}\n\n${existingText.replace(/^\s+/, '')}`;
}

function removeManagedBlock(existingText, fileName) {
  const id = BLOCKS[fileName];
  const pattern = new RegExp(`<!-- adf:managed-block:start ${id} -->[\\s\\S]*?<!-- adf:managed-block:end ${id} -->\\n?`, 'm');
  return existingText.replace(pattern, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function validateAdfHome(context) {
  if (!fs.existsSync(context.adfHome)) fail(`ADF_HOME not found: ${context.adfHome}`);
}

function frameworkVersion(context) {
  const metadata = readJson(path.join(context.adfHome, '.claude', 'metadata.json'), {});
  return metadata.version || 'unknown';
}

function profileManifest(context) {
  return readJson(path.join(context.adfHome, 'profiles', 'git-profiles.json'), { defaultProfile: DEFAULT_PROFILE, profiles: { adf: {} } });
}

function isKnownGitProfile(context, name) {
  if (!name) return false;
  const manifest = profileManifest(context);
  return Boolean(manifest.profiles && manifest.profiles[name]);
}

function resolveOverlayRoot(context, profile) {
  const manifest = profileManifest(context);
  if (!manifest.profiles || !manifest.profiles[profile]) fail(`Unknown git profile: ${profile}`);
  const overlayPath = manifest.profiles[profile].overlayPath;
  if (!overlayPath) return null;
  const resolved = path.join(context.adfHome, overlayPath);
  if (!fs.existsSync(resolved)) fail(`Git profile overlay not found: ${resolved}`);
  return resolved;
}

function payloadStatePaths(context, baseRoot = repoPath(context, '.adf')) {
  return {
    root: baseRoot,
    manifest: path.join(baseRoot, 'manifest.json'),
    backups: path.join(baseRoot, 'backups'),
    payload: path.join(baseRoot, 'payload'),
    payloadGenerated: path.join(baseRoot, 'payload', '.generated'),
    nextRoot: path.join(baseRoot, 'state', 'next'),
    nextPayload: path.join(baseRoot, 'state', 'next', 'payload'),
    nextPayloadGenerated: path.join(baseRoot, 'state', 'next', 'payload', '.generated'),
  };
}

function filterFrameworkTree(relative) {
  const normalized = relative.split(path.sep).join('/');
  if (normalized.startsWith('.opencode/node_modules')) return false;
  if (normalized.startsWith('.opencode/agents')) return false;
  if (normalized.startsWith('.codex/agents')) return false;
  return true;
}

function stagePayload(context, gitProfile, dryRun) {
  const stageRoot = dryRun ? fs.mkdtempSync(path.join(os.tmpdir(), 'adf-install-')) : repoPath(context, '.adf');
  const paths = payloadStatePaths(context, stageRoot);
  fs.rmSync(paths.nextRoot, { recursive: true, force: true });
  fs.mkdirSync(paths.nextPayload, { recursive: true });

  const copies = ['.claude', '.agent', '.codex', '.opencode', 'CLAUDE.md', 'AGENTS.md', 'opencode.json'];
  for (const item of copies) {
    const source = path.join(context.adfHome, item);
    if (!fs.existsSync(source)) continue;
    const target = path.join(paths.nextPayload, item);
    if (statType(source) === 'directory') {
      fs.cpSync(source, target, {
        recursive: true,
        dereference: item === '.agent',
        force: true,
        filter: (src) => filterFrameworkTree(path.relative(context.adfHome, src) || item),
      });
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
  }

  const overlayRoot = resolveOverlayRoot(context, gitProfile);
  if (overlayRoot) {
    for (const area of ['.claude', '.agent']) {
      const source = path.join(overlayRoot, area);
      const target = path.join(paths.nextPayload, area);
      if (fs.existsSync(source)) fs.cpSync(source, target, { recursive: true, dereference: false, force: true });
    }
  }

  fs.mkdirSync(paths.nextPayloadGenerated, { recursive: true });
  const generateArgs = [
    path.join(context.adfHome, 'scripts', 'generate-tool-configs.js'),
    '--source-root', path.join(paths.nextPayload, '.claude', 'agents'),
    '--codex-out', path.join(paths.nextPayloadGenerated, '.codex', 'agents'),
    '--opencode-out', path.join(paths.nextPayloadGenerated, '.opencode', 'agents'),
  ];
  if (dryRun) generateArgs.push('--dry-run');
  execFileSync(process.execPath, generateArgs, { stdio: 'inherit' });
  return paths;
}

function treeEntries(rootDir, rootName) {
  if (!fs.existsSync(rootDir)) return [];
  const entries = [];
  for (const name of fs.readdirSync(rootDir).sort()) {
    const source = path.join(rootDir, name);
    const relative = `${rootName}/${name}`;
    const type = statType(source);
    if (type === 'directory') {
      entries.push(...treeEntries(source, relative));
      continue;
    }
    if (type === 'symlink') {
      entries.push({ path: relative, kind: 'symlink', ownership: OWNERSHIP.TREE, target: fs.readlinkSync(source), fallbackSource: source });
      continue;
    }
    entries.push({ path: relative, kind: 'path', ownership: OWNERSHIP.TREE, source });
  }
  return entries;
}

function desiredEntries(command, paths) {
  const payload = paths.nextPayload && fs.existsSync(paths.nextPayload) ? paths.nextPayload : paths.payload;
  const generated = paths.nextPayloadGenerated && fs.existsSync(paths.nextPayloadGenerated) ? paths.nextPayloadGenerated : paths.payloadGenerated;
  const entries = [];
  const includeClaude = ['claude', 'opencode', 'codex', 'all'].includes(command);
  const includeAg = ['ag', 'all'].includes(command);
  const includeOpencode = ['opencode', 'all'].includes(command);
  const includeCodex = ['codex', 'all'].includes(command);

  if (includeClaude) entries.push(...treeEntries(path.join(payload, '.claude'), '.claude'));
  if (includeAg) entries.push(...treeEntries(path.join(payload, '.agent'), '.agent'));
  if (includeOpencode) {
    entries.push(...treeEntries(path.join(payload, '.opencode'), '.opencode'));
    entries.push({ path: '.opencode/agents', kind: 'path', ownership: OWNERSHIP.GENERATED, source: path.join(generated, '.opencode', 'agents') });
    entries.push({ path: 'opencode.json', kind: 'path', ownership: OWNERSHIP.TREE, source: path.join(payload, 'opencode.json') });
  }
  if (includeCodex) {
    entries.push(...treeEntries(path.join(payload, '.codex'), '.codex'));
    entries.push({ path: '.codex/agents', kind: 'path', ownership: OWNERSHIP.GENERATED, source: path.join(generated, '.codex', 'agents') });
    entries.push({ path: '.agents', kind: 'symlink', ownership: OWNERSHIP.GENERATED, target: '.claude', fallbackSource: path.join(payload, '.claude') });
  }
  if (['claude', 'opencode', 'all'].includes(command)) {
    entries.push({ path: 'CLAUDE.md', kind: 'block', ownership: OWNERSHIP.BLOCK, source: path.join(payload, 'CLAUDE.md') });
  }
  if (['ag', 'codex', 'all'].includes(command)) {
    entries.push({ path: 'AGENTS.md', kind: 'block', ownership: OWNERSHIP.BLOCK, source: path.join(payload, 'AGENTS.md') });
  }
  return entries.filter((entry) => !entry.source || fs.existsSync(entry.source));
}

function currentManifest(context) {
  return readJson(repoPath(context, '.adf/manifest.json'), null);
}

function classifyEntry(context, entry, manifest) {
  const target = repoPath(context, entry.path);
  const managed = manifest && manifest.managedPaths && manifest.managedPaths[entry.path];
  if (entry.kind === 'block') {
    const sourceText = fs.readFileSync(entry.source, 'utf8');
    const desiredBlock = createManagedBlock(entry.path, sourceText);
    const exists = fs.existsSync(target);
    const currentText = exists ? fs.readFileSync(target, 'utf8') : '';
    const hasBlock = currentText.includes(`<!-- adf:managed-block:start ${BLOCKS[entry.path]} -->`);
    if (!exists) return { status: 'safe-create', desiredHash: sha256Text(desiredBlock) };
    if (hasBlock && upsertManagedBlock(currentText, entry.path, sourceText) === currentText) return { status: managed ? 'unchanged' : 'legacy-adoptable', desiredHash: sha256Text(desiredBlock) };
    if (!managed && currentText.trim() === sourceText.trim()) return { status: 'legacy-adoptable', desiredHash: sha256Text(desiredBlock) };
    return { status: managed ? 'safe-update-managed' : 'safe-create', desiredHash: sha256Text(desiredBlock) };
  }

  const desiredHash = entry.kind === 'symlink' ? `symlink:${entry.target}` : pathFingerprint(entry.source);
  const currentHash = pathFingerprint(target);
  if (!currentHash) return { status: managed ? 'repair-needed' : 'safe-create', desiredHash };
  const matchesFallback = entry.kind === 'symlink' && pathFingerprint(entry.fallbackSource) === currentHash;
  if (currentHash === desiredHash || matchesFallback) return { status: managed ? 'unchanged' : 'legacy-adoptable', desiredHash };
  if (managed) return { status: 'safe-update-managed', desiredHash };
  const parentManaged = manifest && manifest.managedPaths && Object.keys(manifest.managedPaths).some((managedPath) => managedPath.startsWith(`${entry.path}/`) || entry.path.startsWith(`${managedPath}/`));
  if (parentManaged) return { status: 'conflict-user-modified-managed-path', desiredHash, currentHash };
  return { status: entry.path.includes('/') ? 'conflict-unmanaged-root-dir-child' : 'conflict-unmanaged-root-file', desiredHash, currentHash };
}

function removalEntries(manifest, command, paths) {
  if (!manifest || !manifest.managedPaths || command === 'repair') return [];
  const desired = new Set(desiredEntries(command, paths).map((entry) => entry.path));
  return Object.keys(manifest.managedPaths)
    .filter((managedPath) => !desired.has(managedPath))
    .sort()
    .map((managedPath) => ({ path: managedPath, kind: manifest.managedPaths[managedPath].ownership === OWNERSHIP.BLOCK ? 'remove-block' : 'remove-path', status: 'safe-update-managed' }));
}

function printPlan(command, plan) {
  info(`Install mode: ${command}`);
  for (const item of plan) {
    const detail = item.currentHash && item.desiredHash ? ` [${item.currentHash} -> ${item.desiredHash}]` : '';
    console.log(` - ${item.status.padEnd(30)} ${item.path}${detail}`);
  }
}

function collectBackupTargets(plan, removals) {
  const seen = new Set();
  const targets = [];
  for (const item of [...plan, ...removals]) {
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    targets.push(item.path);
  }
  targets.push('.adf/payload', '.adf/manifest.json');
  return [...new Set(targets)].sort();
}

function backupIdNow() {
  const iso = new Date().toISOString();
  const [datePart, timePart] = iso.split('T');
  const compactDate = datePart.replace(/-/g, '');
  const compactTime = timePart.replace(/[:Z]/g, '').replace('.', '');
  return `${compactDate}${compactTime}`;
}

function createBackup(context, reason, targets) {
  const backupId = backupIdNow();
  const backupRoot = repoPath(context, `.adf/backups/${backupId}`);
  const filesRoot = path.join(backupRoot, 'files');
  fs.mkdirSync(filesRoot, { recursive: true });
  const entries = [];
  for (const relativePath of targets) {
    const source = repoPath(context, relativePath);
    const existed = fs.existsSync(source);
    const snapshot = path.join(filesRoot, relativePath);
    entries.push({ path: relativePath, existedBefore: existed, type: statType(source) });
    if (!existed) continue;
    fs.mkdirSync(path.dirname(snapshot), { recursive: true });
    copyPath(source, snapshot);
  }
  writeJson(path.join(backupRoot, 'meta.json'), { id: backupId, createdAt: new Date().toISOString(), reason, entries });
  return backupId;
}

function restoreBackup(context, backupId) {
  const backupRoot = repoPath(context, `.adf/backups/${backupId}`);
  const meta = readJson(path.join(backupRoot, 'meta.json'));
  if (!meta) fail(`Backup not found: ${backupId}`);
  for (const entry of meta.entries) {
    if (!entry.existedBefore) continue;
    const snapshotPath = path.join(backupRoot, 'files', entry.path);
    if (!fs.existsSync(snapshotPath)) fail(`Backup is incomplete for ${backupId}: missing ${entry.path}`);
  }
  const current = currentManifest(context);
  const currentManaged = current && current.managedPaths ? Object.keys(current.managedPaths) : [];
  const removalPaths = [...new Set([...meta.entries.map((entry) => entry.path), ...currentManaged, '.adf/payload', '.adf/manifest.json'])]
    .sort((a, b) => b.length - a.length);
  for (const relativePath of removalPaths) fs.rmSync(repoPath(context, relativePath), { recursive: true, force: true });
  pruneEmptyParents(context, removalPaths);
  for (const entry of [...meta.entries].sort((a, b) => a.path.length - b.path.length)) {
    if (!entry.existedBefore) continue;
    copyPath(path.join(backupRoot, 'files', entry.path), repoPath(context, entry.path));
  }
  success(`Rollback complete: ${backupId}`);
}

function pruneEmptyParents(context, relativePaths) {
  const visited = new Set();
  const parents = [];
  for (const relativePath of relativePaths) {
    let current = path.dirname(relativePath);
    while (current && current !== '.' && current !== path.sep && !visited.has(current)) {
      visited.add(current);
      parents.push(current);
      current = path.dirname(current);
    }
  }
  parents.sort((a, b) => b.length - a.length);
  for (const relativePath of parents) {
    const absolute = repoPath(context, relativePath);
    if (!fs.existsSync(absolute) || statType(absolute) !== 'directory') continue;
    if (fs.readdirSync(absolute).length === 0) fs.rmdirSync(absolute);
  }
}

function writeRootEntry(context, entry) {
  const target = repoPath(context, entry.path);
  if (entry.kind === 'block') {
    const currentText = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    const sourceText = fs.readFileSync(entry.source, 'utf8');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, upsertManagedBlock(currentText, entry.path, sourceText), 'utf8');
    return;
  }
  if (entry.kind === 'symlink') {
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try {
      const linkType = process.platform === 'win32'
        ? 'junction'
        : statType(entry.fallbackSource) === 'directory' ? 'dir' : 'file';
      fs.symlinkSync(entry.target, target, linkType);
    } catch (_) {
      copyPath(entry.fallbackSource, target);
    }
    return;
  }
  copyPath(entry.source, target);
}

function removeManagedEntry(context, entry) {
  const target = repoPath(context, entry.path);
  if (entry.kind === 'remove-block') {
    if (!fs.existsSync(target)) return;
    const next = removeManagedBlock(fs.readFileSync(target, 'utf8'), entry.path);
    if (next.trim()) fs.writeFileSync(target, next, 'utf8');
    else fs.rmSync(target, { force: true });
    return;
  }
  fs.rmSync(target, { recursive: true, force: true });
}

function finalizePayload(paths) {
  fs.mkdirSync(path.dirname(paths.payload), { recursive: true });
  fs.rmSync(paths.payload, { recursive: true, force: true });
  fs.renameSync(paths.nextPayload, paths.payload);
  fs.rmSync(paths.nextRoot, { recursive: true, force: true });
}

function cleanupStaging(context, paths) {
  if (!paths || !paths.root || paths.root === repoPath(context, '.adf')) return;
  fs.rmSync(paths.root, { recursive: true, force: true });
}

function buildManifest(context, command, gitProfile, backupId, entries, legacyAdopted) {
  const managedPaths = {};
  for (const entry of entries) {
    const sourceHash = entry.kind === 'block'
      ? sha256Text(createManagedBlock(entry.path, fs.readFileSync(entry.source, 'utf8')))
      : entry.kind === 'symlink'
        ? `symlink:${entry.target}`
        : pathFingerprint(entry.source);
    managedPaths[entry.path] = {
      ownership: entry.ownership,
      hash: sourceHash,
      source: entry.kind === 'symlink' ? entry.target : path.relative(context.target, entry.source).split(path.sep).join('/'),
    };
  }
  const previous = currentManifest(context);
  const backups = [backupId, ...(((previous && previous.backups) || []).map((item) => item.id))]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 10)
    .map((id) => ({ id }));
  return {
    manifestVersion: MANIFEST_VERSION,
    frameworkVersion: frameworkVersion(context),
    installedAt: new Date().toISOString(),
    installMode: command,
    gitProfile,
    payloadRoot: '.adf/payload',
    generatedRoot: '.adf/payload/.generated',
    backupRoot: '.adf/backups',
    latestBackupId: backupId,
    backups,
    managedPaths,
    legacy: legacyAdopted ? { adoptedAt: new Date().toISOString() } : null,
  };
}

function installSelfFile(context, fileName) {
  const source = path.join(context.adfHome, 'scripts', fileName);
  const target = path.join(os.homedir(), 'bin', fileName);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  if (fileName === 'adf') fs.chmodSync(target, 0o755);
  return target;
}

function updateSelf(context) {
  validateAdfHome(context);
  const target = installSelfFile(context, 'adf');
  installSelfFile(context, 'adf-installer-lib.js');
  success(`Updated: ${target}`);
}

function runRollback(context, id) {
  validateAdfHome(context);
  const backupsRoot = repoPath(context, '.adf/backups');
  if (!fs.existsSync(backupsRoot)) fail('No backups found');
  const candidates = fs.readdirSync(backupsRoot).sort().reverse();
  const backupId = id === 'latest' ? candidates[0] : id;
  if (!backupId) fail('No backup available for rollback');
  const manifest = currentManifest(context);
  if (manifest && manifest.managedPaths) {
    const currentTargets = [...new Set([...Object.keys(manifest.managedPaths), '.adf/payload', '.adf/manifest.json'])].sort();
    createBackup(context, `pre-rollback:${backupId}`, currentTargets);
  }
  restoreBackup(context, backupId);
}

function parseArgs(context, argv) {
  const options = { command: 'claude', dryRun: false, gitProfile: DEFAULT_PROFILE, adoptLegacy: false, rollbackId: 'latest' };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') { options.dryRun = true; continue; }
    if (arg === '--adopt-legacy') { options.adoptLegacy = true; continue; }
    if (arg === '--git-profile') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) fail('Missing value for --git-profile');
      options.gitProfile = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--git-profile=')) {
      options.gitProfile = arg.slice('--git-profile='.length);
      continue;
    }
    positional.push(arg);
  }
  const first = positional[0] || 'claude';
  options.command = TOOL_ALIASES.get(first) || first;
  if (options.command === 'rollback' && positional[1]) options.rollbackId = positional[1];
  if (!TOOL_ALIASES.has(first) && isKnownGitProfile(context, first)) {
    if (positional.length > 1) warn(`Profile shorthand detected; ignoring extra positionals: ${positional.slice(1).join(', ')}`);
    options.command = 'claude';
    options.gitProfile = first;
  } else if (positional.length > 1 && options.gitProfile === DEFAULT_PROFILE && isKnownGitProfile(context, positional[1])) {
    options.gitProfile = positional[1];
    info(`Interpreting trailing argument '${positional[1]}' as --git-profile ${positional[1]}`);
  }
  return options;
}

function runInstall(context, command, options) {
  validateAdfHome(context);
  const manifest = currentManifest(context);
  let staged;
  try {
    const requestedCommand = command;
    if (command === 'repair') {
      const repairRoot = options.dryRun ? fs.mkdtempSync(path.join(os.tmpdir(), 'adf-repair-')) : repoPath(context, '.adf');
      staged = {
        root: repairRoot,
        payload: repoPath(context, '.adf/payload'),
        payloadGenerated: options.dryRun
          ? path.join(repairRoot, 'payload', '.generated')
          : repoPath(context, '.adf/payload/.generated'),
      };
    } else {
      staged = stagePayload(context, options.gitProfile, options.dryRun);
    }

    const installMode = requestedCommand === 'repair' ? manifest && manifest.installMode : requestedCommand;
    if (requestedCommand === 'repair') {
      if (!manifest) fail('Repair requires an existing .adf/manifest.json');
      const repairGenerated = staged.payloadGenerated;
      fs.rmSync(repairGenerated, { recursive: true, force: true });
      execFileSync(process.execPath, [
        path.join(context.adfHome, 'scripts', 'generate-tool-configs.js'),
        '--source-root', path.join(staged.payload, '.claude', 'agents'),
        '--codex-out', path.join(repairGenerated, '.codex', 'agents'),
        '--opencode-out', path.join(repairGenerated, '.opencode', 'agents'),
      ], { stdio: 'inherit' });
    }

    const plan = desiredEntries(installMode, staged).map((entry) => ({ ...entry, ...classifyEntry(context, entry, manifest) }));
    const removals = removalEntries(manifest, requestedCommand, staged);
    printPlan(installMode, [...plan, ...removals]);

    const blockers = plan.filter((entry) => entry.status.startsWith('conflict-'));
    const legacy = plan.filter((entry) => entry.status === 'legacy-adoptable');
    if (options.dryRun) {
      if (blockers.length) warn(`Blocking conflicts: ${blockers.map((entry) => entry.path).join(', ')}`);
      if (legacy.length && !options.adoptLegacy) warn(`Legacy adoption required: ${legacy.map((entry) => entry.path).join(', ')}`);
      success('Dry-run complete');
      return;
    }
    if (blockers.length) fail(`Blocking conflicts detected: ${blockers.map((entry) => entry.path).join(', ')}`);
    if (legacy.length && !options.adoptLegacy) fail(`Legacy ADF paths detected. Re-run with --adopt-legacy to adopt: ${legacy.map((entry) => entry.path).join(', ')}`);

    const backupReason = requestedCommand === 'repair' ? 'repair' : `install:${installMode}`;
    const backupId = createBackup(context, backupReason, collectBackupTargets(plan, removals));
    for (const entry of removals) removeManagedEntry(context, entry);
    for (const entry of plan) if (entry.status !== 'unchanged') writeRootEntry(context, entry);
    if (staged.nextPayload) finalizePayload(staged);

    const manifestValue = buildManifest(context, installMode, options.gitProfile, backupId, desiredEntries(installMode, payloadStatePaths(context)), legacy.length > 0);
    writeJson(repoPath(context, '.adf/manifest.json'), manifestValue);
    success(`Done! Installed ${installMode} compatibility via .adf payload`);
  } finally {
    cleanupStaging(context, staged);
  }
}

function main(argv = process.argv.slice(2), env = process.env) {
  try {
    const context = createInstallerContext(env);
    const options = parseArgs(context, argv);
    switch (options.command) {
      case 'help': usage(context.adfHome); return;
      case 'update': updateSelf(context); return;
      case 'rollback': runRollback(context, options.rollbackId); return;
      case 'repair': runInstall(context, 'repair', options); return;
      case 'claude':
      case 'ag':
      case 'opencode':
      case 'codex':
      case 'all':
        runInstall(context, options.command, options);
        return;
      default:
        fail(`Unknown command: ${options.command}`);
    }
  } catch (error) {
    fail(error && error.message ? error.message : String(error));
  }
}

module.exports = { main, createInstallerContext };
