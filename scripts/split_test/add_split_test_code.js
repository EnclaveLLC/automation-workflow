'use strict';

const fs = require('fs');
const path = require('path');

const controlPath = (process.env.CONTROL_PATH || '').replace(/^\//, '');
const controlUrl  = process.env.CONTROL_URL || '';
const variations  = JSON.parse(process.env.VARIATIONS || '[]');

if (!controlPath) {
  console.error('ERROR: CONTROL_PATH is not set.');
  process.exit(1);
}

if (!controlUrl) {
  console.error('ERROR: CONTROL_URL is not set.');
  process.exit(1);
}

const indexFile = path.join(controlPath, 'index.php');

if (!fs.existsSync(indexFile)) {
  console.error('ERROR: index.php not found at ' + indexFile);
  process.exit(1);
}

const urlEntries = [
  ...variations.map(v => '"' + v.url + '$qs"'),
].map(e => '    ' + e).join(',\n');

const splitTestCode =
  '<?php\n' +
  'if (@$_GET["test"] != "false") {\n' +
  '  $qs = ($_SERVER["QUERY_STRING"] ? "?" : "") . $_SERVER["QUERY_STRING"];\n' +
  '\n' +
  '  require_once("../../splittester/splittester.class.php");\n' +
  '\n' +
  '  $urls = array(\n' +
  urlEntries + '\n' +
  '  );\n' +
  '\n' +
  '  $split = new SplitTester($urls);\n' +
  '}\n' +
  '?>\n';

const existing = fs.readFileSync(indexFile, 'utf8');
fs.writeFileSync(indexFile, splitTestCode + existing);

console.log('✅ Split test code prepended to ' + indexFile);
console.log('   Control:  ' + controlPath);
variations.forEach(v => console.log('   Variation: ' + v.url));
