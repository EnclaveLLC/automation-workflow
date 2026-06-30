'use strict';
const fs = require('fs');
const crypto = require('crypto');

const body = process.env.PR_BODY || '';

console.log('PR_BODY length:', body.length, 'chars');
console.log('-------- PR Body --------');
console.log(body);
console.log('-------------------------');

const lines = body.split('\n').map(l => l.replace(/\r$/, ''));

function extractSection(headerRe) {
  let inSection = false;
  const urls = [];
  for (const line of lines) {
    if (headerRe.test(line.toLowerCase().trim())) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (/^#{1,6}\s/.test(line.trim())) break;
      const m = line.match(/https?:\/\/\S+/);
      if (m) urls.push(m[0]);
    }
  }
  return urls;
}

const gtmetrixUrls = extractSection(/^#{1,6}\s+gtmetrix test urls?$/);
const issueUrls    = extractSection(/^#{1,6}\s+issue\s*$/);

const issueUrl    = issueUrls[0] || '';
const gtmetrixUrl = gtmetrixUrls.join('\n');

console.log('GTMetrix URLs (' + gtmetrixUrls.length + '):', gtmetrixUrls);
console.log('Issue URL:', issueUrl);

const outFile = process.env.GITHUB_OUTPUT;
if (outFile) {
  const delimiter = 'GTMETRIX_' + crypto.randomBytes(8).toString('hex');
  let out = '';
  if (issueUrl)    out += `issue_url=${issueUrl}\n`;
  if (gtmetrixUrl) out += `gtmetrix_url<<${delimiter}\n${gtmetrixUrl}\n${delimiter}\n`;
  fs.appendFileSync(outFile, out, 'utf8');
  console.log('Wrote to GITHUB_OUTPUT:', out || '(nothing)');
}
