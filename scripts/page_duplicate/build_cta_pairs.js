'use strict';

const fs = require('fs');

const samcartFile = process.env.SAMCART_LINKS_FILE || '';
const ctaLinksRaw = process.env.CTA_LINKS          || '';

if (!samcartFile) {
  console.error('ERROR: SAMCART_LINKS_FILE is not set.');
  process.exit(1);
}

// { "1 pack": "current-url", ... }
const samcartLinks = JSON.parse(fs.readFileSync(samcartFile, 'utf8'));

// Parse "'1 pack' => new-url" lines from parse-issue output
const newLinks = {};
for (const line of ctaLinksRaw.split('\n')) {
  const match = line.trim().match(/^'(.+?)'\s*=>\s*(.+)$/);
  if (!match) continue;
  newLinks[match[1].toLowerCase()] = match[2].trim();
}

// Build "old-url -> new-url" pairs
const pairs = [];
for (const [label, oldUrl] of Object.entries(samcartLinks)) {
  const newUrl = newLinks[label.toLowerCase()];
  if (!newUrl) {
    console.warn(`WARNING: no new URL for label "${label}" — skipping.`);
    continue;
  }
  pairs.push(`${oldUrl} -> ${newUrl}`);
  console.log(`  ${label}: ${oldUrl} -> ${newUrl}`);
}

const pairsStr = pairs.join('\n');

const outputFile = process.env.GITHUB_OUTPUT || '';
if (outputFile) {
  fs.appendFileSync(outputFile, `pairs<<PAIRSEOF\n${pairsStr}\nPAIRSEOF\n`);
}

console.log(`\nGenerated ${pairs.length} pair(s).`);
