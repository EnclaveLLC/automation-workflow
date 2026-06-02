'use strict';

const fs   = require('fs');
const path = require('path');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const duplicatePath = (process.env.DUPLICATE_PATH || '').replace(/\/+$/, '');
const replaceRaw    = process.env.REPLACE_MAP    || '';
const indexFile     = process.env.INDEX_FILE     || '';

if (!duplicatePath) {
  console.error('ERROR: DUPLICATE_PATH is not set.');
  process.exit(1);
}

if (!indexFile) {
  console.error('ERROR: INDEX_FILE is not set.');
  process.exit(1);
}

if (!replaceRaw.trim()) {
  console.warn('WARNING: replace_map is empty — nothing to replace.');
  process.exit(0);
}

const replacePairs = [];
for (const line of replaceRaw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed.includes(' -> ')) continue;
  const idx    = trimmed.indexOf(' -> ');
  const old    = trimmed.substring(0, idx).trim();
  const newVal = trimmed.substring(idx + 4).trim();
  if (old) replacePairs.push({ old, new: newVal });
}

const files = [path.join(duplicatePath, indexFile)];
console.log(`Scanning ${files.length} file(s) in ${duplicatePath}/ (${indexFile} only)`);

for (const file of files) {
  let content  = fs.readFileSync(file, 'utf8');
  let modified = false;

  for (const { old, new: newVal } of replacePairs) {
    // When newVal starts with old (e.g. adding a suffix like "-v6"), use a negative
    // lookahead so already-replaced occurrences are skipped and don't get double-replaced.
    let pattern;
    if (newVal.startsWith(old)) {
      const suffix = escapeRegex(newVal.slice(old.length));
      pattern = new RegExp(escapeRegex(old) + '(?!' + suffix + ')', 'g');
    } else {
      pattern = new RegExp(escapeRegex(old), 'g');
    }

    const matches = content.match(pattern);
    if (!matches) continue;

    content  = content.replace(pattern, newVal);
    modified = true;
    console.log(`  [${path.relative(duplicatePath, file)}] ${matches.length}x: ${JSON.stringify(old)} -> ${JSON.stringify(newVal)}`);
  }

  if (modified) fs.writeFileSync(file, content, 'utf8');
}

console.log('All replacements applied.');
