'use strict';

const fs = require('fs');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const filePath = process.env.FILE_PATH || '';
const pairsRaw = process.env.PAIRS     || '';

if (!filePath) {
  console.error('ERROR: FILE_PATH is not set.');
  process.exit(1);
}

if (!pairsRaw.trim()) {
  console.warn('WARNING: PAIRS is empty — nothing to replace.');
  process.exit(0);
}

// Parse "search -> replace" or "search => replace" lines
const pairs = [];
for (const line of pairsRaw.split('\n')) {
  const trimmed = line.trim();
  const sep = trimmed.includes(' -> ') ? ' -> '
             : trimmed.includes(' => ') ? ' => '
             : null;
  if (!sep) continue;
  const idx     = trimmed.indexOf(sep);
  const search  = trimmed.slice(0, idx).trim();
  const replace = trimmed.slice(idx + sep.length).trim();
  if (search) pairs.push({ search, replace });
}

if (!pairs.length) {
  console.warn('WARNING: No valid pairs found — nothing to replace.');
  process.exit(0);
}

let content  = fs.readFileSync(filePath, 'utf8');
let modified = false;

for (const { search, replace } of pairs) {
  // If replace starts with search (e.g. adding a suffix), use a negative lookahead
  // so already-replaced occurrences are not double-replaced.
  let pattern;
  if (replace.startsWith(search)) {
    const suffix = escapeRegex(replace.slice(search.length));
    pattern = new RegExp(escapeRegex(search) + '(?!' + suffix + ')', 'g');
  } else {
    pattern = new RegExp(escapeRegex(search), 'g');
  }

  const matches = content.match(pattern);
  if (!matches) {
    console.log(`  [skip] no match: ${JSON.stringify(search)}`);
    continue;
  }

  content  = content.replace(pattern, replace);
  modified = true;
  console.log(`  ${matches.length}x: ${JSON.stringify(search)} -> ${JSON.stringify(replace)}`);
}

if (modified) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Saved: ${filePath}`);
} else {
  console.log('No changes made.');
}
