'use strict';

const fs = require('fs');

const samcartFile = process.env.SAMCART_LINKS_FILE || '';
const ctaLinksRaw = process.env.CTA_LINKS          || '';
const notionRaw   = process.env.NOTION_JSON         || '';

// Parse "'1 pack' => new-url" lines from parse-issue output
const newLinks = {};
for (const line of ctaLinksRaw.split('\n')) {
  const match = line.trim().match(/^'(.+?)'\s*=>\s*(.+)$/);
  if (!match) continue;
  newLinks[match[1].toLowerCase()] = match[2].trim();
}

// Notion field names → cta_links label names
const NOTION_PACK_MAP = {
  checkout_1_pack: '1 pack',
  checkout_3_pack: '3 pack',
  checkout_6_pack: '6 pack',
  checkout_9_pack: '9 pack',
};

// Build old-URL lookup { "1 pack": "https://old-url" }
let oldLinks = {};

if (notionRaw) {
  let notion;
  try {
    notion = JSON.parse(notionRaw);
  } catch (e) {
    console.error('ERROR: Failed to parse NOTION_JSON:', e.message);
    process.exit(1);
  }
  for (const [field, label] of Object.entries(NOTION_PACK_MAP)) {
    const url = notion[field];
    if (url && url.trim()) oldLinks[label] = url.trim();
  }
  console.log(`Using Notion checkout links (${Object.keys(oldLinks).length} found).`);
} else if (samcartFile) {
  oldLinks = JSON.parse(fs.readFileSync(samcartFile, 'utf8'));
  console.log(`Using samcart-links.json (${Object.keys(oldLinks).length} entries).`);
} else {
  console.error('ERROR: Neither NOTION_JSON nor SAMCART_LINKS_FILE is set.');
  process.exit(1);
}

// Build "old-url -> new-url" pairs
const pairs = [];
for (const [label, oldUrl] of Object.entries(oldLinks)) {
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
