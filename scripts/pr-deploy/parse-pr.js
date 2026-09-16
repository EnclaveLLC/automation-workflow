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

function extractIssueUrl() {
  let inSection = false;
  for (const line of lines) {
    if (/^#{1,6}\s+issue\s*$/.test(line.toLowerCase().trim())) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (/^#{1,6}\s/.test(line.trim())) break;
      const urlMatch = line.match(/https?:\/\/\S+/);
      if (urlMatch) return urlMatch[0];
      const shortMatch = line.trim().match(/^#(\d+)$/);
      if (shortMatch && process.env.REPO) {
        return `https://github.com/${process.env.REPO}/issues/${shortMatch[1]}`;
      }
    }
  }
  return '';
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

function extractLinearId() {
  for (const line of lines) {
    const m = line.trim().match(/^resolves\s+([a-z]+-\d+)/i);
    if (m) return m[1].toUpperCase();
  }
  return '';
}

const testUrls = extractSection(/^#{1,6}\s+test urls?$/);
const issueUrl = extractIssueUrl();
const gtm      = extractNotionField('GTM');
const linearId = extractLinearId();

const result = {
  issueUrl,
  testUrls,
  gtm,
  linearId,
};

console.log('Test URLs (' + testUrls.length + '):', testUrls);
console.log('Issue URL:', result.issueUrl);
console.log('GTM:', gtm);
console.log('Linear ID:', linearId);

fs.writeFileSync('/tmp/parse-pr.json', JSON.stringify(result));
