'use strict';

const fs = require('fs');
const path = require('path');

const controlPath = (process.env.CONTROL_PATH || '').replace(/^\//, '');

if (!controlPath) {
  console.error('ERROR: CONTROL_PATH is not set.');
  process.exit(1);
}

const indexFile = path.join(controlPath, 'index.php');

if (!fs.existsSync(indexFile)) {
  console.error('ERROR: index.php not found at ' + indexFile);
  process.exit(1);
}

const existing = fs.readFileSync(indexFile, 'utf8');

if (!existing.includes('splittester.class.php')) {
  console.log('ℹ️  No split test code found in ' + indexFile + ' — nothing to remove.');
  process.exit(0);
}

// The add script prepends a <?php ... ?>\n block. Remove it by finding the
// closing ?> that ends the prepended block and dropping everything before it.
const closingTag = '?>\n';
const closingIndex = existing.indexOf(closingTag);

if (closingIndex === -1) {
  console.error('ERROR: Could not locate closing ?> of split test block in ' + indexFile);
  process.exit(1);
}

const stripped = existing.slice(closingIndex + closingTag.length);
fs.writeFileSync(indexFile, stripped);

console.log('✅ Split test code removed from ' + indexFile);
