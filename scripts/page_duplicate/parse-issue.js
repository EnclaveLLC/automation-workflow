'use strict';

const fs = require('fs');

const body = (process.env.ISSUE_BODY || '').replace(/<br\s*\/?>/gi, '\n');

function toFullUrl(raw) {
  let s = raw.trim();
  const mdLink = s.match(/^\[.*?\]\(<?(.*?)>?\)$/);
  if (mdLink) s = mdLink[1];
  return s;
}

function classifyLine(line) {
  if (line === 'Reference Page')         return 'heading:ref';
  if (line === 'New Page')               return 'heading:new';
  if (/^CTA \d+ Replace Mapping$/i.test(line)) return 'heading:cta_section';
  if (/^CTA \d+ \(OLD\)$/i.test(line))  return 'heading:cta_old';
  if (/^CTA \d+ \(NEW\)$/i.test(line))  return 'heading:cta_new';
  if (line === 'Custom Replace Mapping') return 'heading:custom_section';
  if (line === 'OLD TEXT')               return 'heading:custom_old';
  if (line === 'NEW TEXT')               return 'heading:custom_new';
  if (/^GTMetrix Test URL$/i.test(line)) return 'heading:gtmetrix';
  return 'value';
}

let ref_url = '';
let new_url = '';
let gtmetrix_url = '';
const replace_mapping = [];
let state = null;
let pendingOld = null;

for (const rawLine of body.split('\n')) {
  const line = rawLine.trim();
  if (!line) continue;

  const cls = classifyLine(line);

  if (cls.startsWith('heading:')) {
    const heading = cls.slice(8);
    state = (heading === 'cta_section' || heading === 'custom_section') ? null : heading;
    continue;
  }

  const val = toFullUrl(line);

  switch (state) {
    case 'ref':
      if (!ref_url) { ref_url = val; state = null; }
      break;
    case 'new':
      if (!new_url) { new_url = val; state = null; }
      break;
    case 'cta_old':
      pendingOld = val; state = null;
      break;
    case 'cta_new':
      if (pendingOld) replace_mapping.push({ old: pendingOld, new: val });
      pendingOld = null; state = null;
      break;
    case 'custom_old':
      pendingOld = val; state = null;
      break;
    case 'custom_new':
      if (pendingOld && val) replace_mapping.push({ old: pendingOld, new: val });
      pendingOld = null; state = null;
      break;
    case 'gtmetrix':
      if (!gtmetrix_url) { gtmetrix_url = val; state = null; }
      break;
  }
}

if (!ref_url || !new_url) {
  console.error('ERROR: Reference Page or New Page URL not found in issue body.');
  process.exit(1);
}

const outputFile = process.env.GITHUB_OUTPUT || '';
const out = [
  `ref_url=${ref_url}`,
  `new_url=${new_url}`,
  `gtmetrix_url=${gtmetrix_url}`,
  'replace_mapping<<RMEOF',
  replace_mapping.map(p => `${p.old} -> ${p.new}`).join('\n'),
  'RMEOF',
  '',
].join('\n');

if (outputFile) fs.appendFileSync(outputFile, out);

console.log(`ref_url:         ${ref_url}`);
console.log(`new_url:         ${new_url}`);
console.log(`gtmetrix_url:    ${gtmetrix_url}`);
console.log(`replace_mapping: ${JSON.stringify(replace_mapping)}`);
