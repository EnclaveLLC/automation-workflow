'use strict';

const fs = require('fs');

const body = (process.env.ISSUE_BODY || '').replace(/<br\s*\/?>/gi, '\n');

function toFullUrl(raw) {
  let s = raw.trim();
  // [text](<url>) or [text](url)
  const mdLink = s.match(/^\[.*?\]\(<?(.*?)>?\)$/);
  if (mdLink) s = mdLink[1];
  // bare <url>
  const angleLink = s.match(/^<(.+)>$/);
  if (angleLink) s = angleLink[1];
  return s.trim();
}

function parseTableCells(line) {
  return line.split('|').slice(1, -1).map(c => c.trim());
}

function isSeparatorRow(line) {
  return /^\|[\s\-:|]+\|$/.test(line);
}

let ref_url = '';
let new_url = '';
const cta_links = [];      // [{ label, url }]
const replace_mapping = []; // [{ old, new }]

const lines = body.split('\n');
let i = 0;

while (i < lines.length) {
  const line = lines[i].trim();
  i++;

  if (!line.startsWith('|')) continue;
  if (isSeparatorRow(line)) continue;

  const headers = parseTableCells(line);
  if (headers.length < 2) continue;

  const h0 = headers[0].toLowerCase().replace(/\s+/g, '');
  const h1 = headers[1].toLowerCase().replace(/\s+/g, '');

  // | Referrence Page | New Page |
  if ((h0 === 'referrencepage' || h0 === 'referencepage') && h1 === 'newpage') {
    if (i < lines.length && isSeparatorRow(lines[i].trim())) i++;
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const row = lines[i].trim(); i++;
      if (isSeparatorRow(row)) continue;
      const cells = parseTableCells(row);
      if (cells.length >= 2) {
        if (!ref_url) ref_url = toFullUrl(cells[0]);
        if (!new_url) new_url = toFullUrl(cells[1]);
      }
    }
    continue;
  }

  // | CTA | Link |
  if (h0 === 'cta' && h1 === 'link') {
    if (i < lines.length && isSeparatorRow(lines[i].trim())) i++;
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const row = lines[i].trim(); i++;
      if (isSeparatorRow(row)) continue;
      const cells = parseTableCells(row);
      if (cells.length >= 2 && cells[0] && cells[1]) {
        cta_links.push({ label: cells[0], url: toFullUrl(cells[1]) });
      }
    }
    continue;
  }

  // | Search | Replace |
  if (h0 === 'search' && h1 === 'replace') {
    if (i < lines.length && isSeparatorRow(lines[i].trim())) i++;
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const row = lines[i].trim(); i++;
      if (isSeparatorRow(row)) continue;
      const cells = parseTableCells(row);
      if (cells.length >= 2 && cells[0] && cells[1]) {
        replace_mapping.push({ old: cells[0], new: toFullUrl(cells[1]) });
      }
    }
    continue;
  }
}

if (!ref_url || !new_url) {
  console.error('ERROR: Reference Page or New Page URL not found in issue body.');
  process.exit(1);
}

const gtmetrix_urls = `${ref_url}\n${new_url}`;

// Format: '1 pack' => url
const ctaFormatted = cta_links
  .map(({ label, url }) => `'${label.toLowerCase()}' => ${url}`)
  .join('\n');

const outputFile = process.env.GITHUB_OUTPUT || '';
const out = [
  `ref_url=${ref_url}`,
  `new_url=${new_url}`,
  'gtmetrix_urls<<GTEOF',
  gtmetrix_urls,
  'GTEOF',
  'cta_links<<CTAEOF',
  ctaFormatted,
  'CTAEOF',
  'replace_mapping<<RMEOF',
  replace_mapping.map(p => `${p.old} -> ${p.new}`).join('\n'),
  'RMEOF',
  '',
].join('\n');

if (outputFile) fs.appendFileSync(outputFile, out);

console.log(`ref_url:         ${ref_url}`);
console.log(`new_url:         ${new_url}`);
console.log(`gtmetrix_urls:\n${gtmetrix_urls}`);
console.log(`cta_links:\n${ctaFormatted}`);
console.log(`replace_mapping: ${JSON.stringify(replace_mapping)}`);
