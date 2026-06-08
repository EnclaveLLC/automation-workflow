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

let control_url = '';
const variations = []; // [{ name, url }]

const lines = body.split('\n');
let i = 0;

while (i < lines.length) {
  const line = lines[i].trim();
  i++;

  if (!line.startsWith('|')) continue;
  if (isSeparatorRow(line)) continue;

  const headers = parseTableCells(line);
  const h0 = headers[0].toLowerCase().replace(/\s+/g, '');

  // | Control Page URL |
  if (h0 === 'controlpageurl') {
    if (i < lines.length && isSeparatorRow(lines[i].trim())) i++;
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const row = lines[i].trim(); i++;
      if (isSeparatorRow(row)) continue;
      const cells = parseTableCells(row);
      if (cells.length >= 1 && cells[0] && !control_url) {
        control_url = toFullUrl(cells[0]);
      }
    }
    continue;
  }

  // | Page Variations | Page URL |
  if (h0 === 'pagevariations') {
    if (i < lines.length && isSeparatorRow(lines[i].trim())) i++;
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const row = lines[i].trim(); i++;
      if (isSeparatorRow(row)) continue;
      const cells = parseTableCells(row);
      if (cells.length >= 2 && cells[0] && cells[1]) {
        const url = toFullUrl(cells[1]);
        const path = new URL(url).pathname.replace(/^\//, '');
        variations.push({ name: cells[0], url, path });
      }
    }
    continue;
  }
}

if (!control_url) {
  console.error('ERROR: Control Page URL not found in issue body.');
  process.exit(1);
}

if (variations.length === 0) {
  console.error('ERROR: No Page Variations found in issue body.');
  process.exit(1);
}

const variationsJson = JSON.stringify(variations);

const control_path = new URL(control_url).pathname.replace(/^\//, '');

const outputFile = process.env.GITHUB_OUTPUT || '';
const out = [
  `control_url=${control_url}`,
  `control_path=${control_path}`,
  `variations=${variationsJson}`,
  '',
].join('\n');

if (outputFile) fs.appendFileSync(outputFile, out);

console.log(`control_url:  ${control_url}`);
console.log(`control_path: ${control_path}`);
console.log(`variations:   ${variationsJson}`);
