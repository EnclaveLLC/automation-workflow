'use strict';
const fs = require('fs');

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

function extractNotionField(fieldName) {
  let inSection = false;
  for (const line of lines) {
    if (/^#{1,6}\s+notion page data/i.test(line.trim())) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (/^#{1,6}\s/.test(line.trim())) break;
      const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
      if (m && m[1].trim().toLowerCase() === fieldName.toLowerCase()) {
        return m[2].trim();
      }
    }
  }
  return '';
}

const gtmetrixUrls = extractSection(/^#{1,6}\s+gtmetrix test urls?$/);
const issueUrls    = extractSection(/^#{1,6}\s+issue\s*$/);
const gtm          = extractNotionField('GTM');

const result = {
  issueUrl: issueUrls[0] || '',
  gtmetrixUrls,
  gtm,
};

console.log('GTMetrix URLs (' + gtmetrixUrls.length + '):', gtmetrixUrls);
console.log('Issue URL:', result.issueUrl);
console.log('GTM:', gtm);

fs.writeFileSync('/tmp/parse-pr.json', JSON.stringify(result));
