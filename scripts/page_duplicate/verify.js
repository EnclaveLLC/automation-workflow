'use strict';

const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

const SUPPORTED_EXT = new Set(['.html', '.js', '.css', '.json']);

function collectFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (entry.isFile() && SUPPORTED_EXT.has(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

const duplicatePath = (process.env.DUPLICATE_PATH || '').replace(/\/+$/, '');
const replaceRaw    = process.env.REPLACE_MAP    || '';
const indexFile     = process.env.INDEX_FILE     || '';
let failed          = false;

// ── 1. Duplicate folder must exist ────────────────────────────────────────────
if (!fs.existsSync(duplicatePath) || !fs.statSync(duplicatePath).isDirectory()) {
  console.error(`FAIL: Duplicate folder not found: ${duplicatePath}`);
  process.exit(1);
}
console.log(`PASS: Duplicate folder exists: ${duplicatePath}/`);

if (!indexFile) {
  console.error('FAIL: INDEX_FILE is not set.');
  process.exit(1);
}

// Only scan the index file where replacements were applied.
const files = [path.join(duplicatePath, indexFile)];
console.log(`Scanning ${files.length} file(s) in ${duplicatePath}/ (${indexFile} only)`);

const allContent = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');

// ── 2. Old values absent / new values present (across all files) ──────────────
for (const line of replaceRaw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed.includes(' -> ')) continue;

  const idx    = trimmed.indexOf(' -> ');
  const old    = trimmed.substring(0, idx).trim();
  const newVal = trimmed.substring(idx + 4).trim();

  if (allContent.includes(old)) {
    console.log(`FAIL: Old value still present: ${JSON.stringify(old)}`);
    failed = true;
  } else {
    console.log(`PASS: Old value removed: ${JSON.stringify(old)}`);
  }

  if (allContent.includes(newVal)) {
    console.log(`PASS: New value present: ${JSON.stringify(newVal)}`);
  } else {
    console.log(`FAIL: New value not found: ${JSON.stringify(newVal)}`);
    failed = true;
  }
}

// ── 3. No unrelated file changes ──────────────────────────────────────────────
// All git-tracked changes must live inside duplicatePath/.
const prefix       = duplicatePath + '/';
const gitStatus    = execSync('git status --short', { encoding: 'utf8' });
const changedFiles = gitStatus
  .split('\n')
  .filter(l => l.trim())
  .map(l => l.slice(3).trim());

const unexpected = changedFiles.filter(f => !f.startsWith(prefix));
if (unexpected.length > 0) {
  console.log(`FAIL: Unexpected files changed: ${JSON.stringify(unexpected)}`);
  failed = true;
} else {
  console.log('PASS: No unrelated changes detected.');
}

if (failed) {
  console.error('Verification FAILED.');
  process.exit(1);
}
console.log('All verification checks passed.');
