'use strict';

const fs = require('fs');
const path = require('path');

// Local testing: reads ./issue.txt (or ISSUE_FILE) next to this script.
// Once wired into a workflow, ISSUE_BODY (set from github.event.issue.body)
// takes precedence, matching the pattern used by scripts/split_test/parse_issue.js.
const issueFile = process.env.ISSUE_FILE || path.join(__dirname, 'issue.txt');
const body = process.env.ISSUE_BODY || fs.readFileSync(issueFile, 'utf8');

// Once wired into a workflow, ISSUE_LABEL is set from the issue's label
// (e.g. github.event.issue.labels[0].name). Locally it defaults to '' —
// override with ISSUE_LABEL=<label> when testing a specific issue type.
const issueLabel = process.env.ISSUE_LABEL || '';

const ISSUE_TYPES = {
  PAGE_UPDATE: 'page_update',
  SPLIT_TEST: 'split_test',
  NEW_PAGE: 'new_page',
  PAGE_DUPLICATE: 'page_duplicate',
};

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

function normalizeHeader(h) {
  return h.toLowerCase().replace(/\s+/g, '');
}

// Splits the issue body into markdown tables: [{ headers: [...], rows: [[...], ...] }, ...]
function parseTables(lines) {
  const tables = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line.startsWith('|') || isSeparatorRow(line)) { i++; continue; }

    const headers = parseTableCells(line);
    i++;
    if (i < lines.length && isSeparatorRow(lines[i].trim())) i++;

    const rows = [];
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const row = lines[i].trim(); i++;
      if (isSeparatorRow(row)) continue;
      rows.push(parseTableCells(row));
    }

    tables.push({ headers, rows });
  }

  return tables;
}

// Finds the first table with a column matching one of `columnNames`
// (case-/whitespace-insensitive) and returns that column's first cell as a URL.
// Works for single-column tables ("| Page Update |") and multi-column tables
// ("| Reference Page | New Page |") alike.
function findColumnUrl(tables, columnNames) {
  const wanted = columnNames.map(normalizeHeader);

  for (const { headers, rows } of tables) {
    const colIndex = headers.findIndex(h => wanted.includes(normalizeHeader(h)));
    if (colIndex === -1) continue;

    for (const row of rows) {
      if (row[colIndex]) return toFullUrl(row[colIndex]);
    }
  }

  return '';
}

// Same as findColumnUrl, but returns every row's cell in that column as URLs
// instead of just the first. Use when a table (like "Page Update") can list
// more than one row, e.g. multiple funnel URLs to update.
function findColumnUrls(tables, columnNames) {
  const wanted = columnNames.map(normalizeHeader);

  for (const { headers, rows } of tables) {
    const colIndex = headers.findIndex(h => wanted.includes(normalizeHeader(h)));
    if (colIndex === -1) continue;

    return rows
      .filter(row => row[colIndex])
      .map(row => toFullUrl(row[colIndex]));
  }

  return [];
}

// Finds the "Page Variations | Page URL" table and returns its rows as
// a single array of { name, url } objects.
function findVariations(tables) {
  for (const { headers, rows } of tables) {
    const nameIdx = headers.findIndex(h => normalizeHeader(h) === 'pagevariations');
    const urlIdx = headers.findIndex(h => normalizeHeader(h) === 'pageurl');
    if (nameIdx === -1 || urlIdx === -1) continue;

    return rows
      .filter(row => row[nameIdx] && row[urlIdx])
      .map(row => ({ name: row[nameIdx], url: toFullUrl(row[urlIdx]) }));
  }

  return [];
}

// Finds checkout URLs anywhere in the body — inside a table or a plain
// paragraph — by matching the "go.<site>/products/<slug>" URL shape
// directly, rather than relying on table structure. Keyed off the
// "#-pack" segment found in the URL itself (falls back to the full URL
// if no pack size is present).
function findCheckoutUrls(rawBody) {
  const urlRegex = /https?:\/\/go\.[^\s<>()|[\]]+\/products\/[^\s<>()|[\]]+/gi;
  const seen = new Set();
  const checkoutUrls = [];

  const matches = rawBody.match(urlRegex) || [];
  for (const match of matches) {
    const url = match.trim();
    if (seen.has(url)) continue;
    seen.add(url);

    const packMatch = url.match(/(\d+)-pack/i);
    const pack = packMatch ? `${packMatch[1]}-pack` : url;

    checkoutUrls.push({ pack, url });
  }

  return checkoutUrls;
}

// Finds Wistia video URLs (wistia.com/medias/<id>) anywhere in the body.
// The surrounding markdown link text often has its own nested [...], so
// this matches the URL shape directly instead of parsing the link text.
// Keyed off "desktop"/"mobile" when the same line names one, otherwise
// keyed by the media id.
function findWistiaUrls(rawBody) {
  const urlRegex = /https?:\/\/[^\s<>()|[\]]*wistia\.com\/medias\/[^\s<>()|[\]]+/gi;
  const seen = new Set();
  const wistiaUrls = [];

  for (const line of rawBody.split('\n')) {
    const matches = line.match(urlRegex) || [];
    for (const match of matches) {
      const url = match.trim();
      if (seen.has(url)) continue;
      seen.add(url);

      let device;
      if (/desktop/i.test(line)) device = 'desktop';
      else if (/mobile/i.test(line)) device = 'mobile';
      else device = url.split('/').pop();

      wistiaUrls.push({ device, url });
    }
  }

  return wistiaUrls;
}

// Finds the "Button Drop" / "Price Drop" timestamp line — same field,
// different label depending on the issue — e.g. "Button Drop: 28:40 ($59)"
// or "Price Drop: 30:49 ($59)". Returns just the timestamp, e.g. "28:40".
function findButtonDropTime(rawBody) {
  const match = rawBody.match(/(?:button|price)\s*drop\s*:\s*([\d:]+)/i);
  return match ? match[1] : '';
}

// Maps a raw issue label (e.g. "Page Update", "split-test") to one of ISSUE_TYPES.
function resolveIssueType(label) {
  const l = normalizeHeader(label).replace(/-/g, '');

  if (l.includes('splittest')) return ISSUE_TYPES.SPLIT_TEST;
  if (l.includes('pageduplicate') || l.includes('duplicatepage')) return ISSUE_TYPES.PAGE_DUPLICATE;
  if (l.includes('newpage')) return ISSUE_TYPES.NEW_PAGE;
  if (l.includes('pageupdate')) return ISSUE_TYPES.PAGE_UPDATE;

  return '';
}

const issue_type = resolveIssueType(issueLabel);

const lines = body.split('\n');
const tables = parseTables(lines);

const page_update_urls = findColumnUrls(tables, ['Page Update']);
const split_test_control_url = findColumnUrl(tables, ['Control Page URL']);
const split_test_variations = findVariations(tables);
const new_page_url = findColumnUrl(tables, ['New Page']);
const checkout_urls = findCheckoutUrls(body);
const wistia_urls = findWistiaUrls(body);
const button_drop_time = findButtonDropTime(body);

if (!page_update_urls.length && !split_test_control_url && !new_page_url && !checkout_urls.length && !wistia_urls.length) {
  console.error('ERROR: No known table (Page Update / Control Page URL / New Page), checkout URLs, or Wistia URLs found in issue body.');
  process.exit(1);
}

const page_update_urls_json = JSON.stringify(page_update_urls);
const split_test_variations_json = JSON.stringify(split_test_variations);
const checkout_urls_json = JSON.stringify(checkout_urls);
const wistia_urls_json = JSON.stringify(wistia_urls);

const outputFile = process.env.GITHUB_OUTPUT || '';
const out = [
  `issue_type=${issue_type}`,
  `page_update_urls=${page_update_urls_json}`,
  `split_test_control_url=${split_test_control_url}`,
  `split_test_variations=${split_test_variations_json}`,
  `new_page_url=${new_page_url}`,
  `checkout_urls=${checkout_urls_json}`,
  `wistia_urls=${wistia_urls_json}`,
  `button_drop_time=${button_drop_time}`,
  '',
].join('\n');

if (outputFile) fs.appendFileSync(outputFile, out);

if (issue_type) console.log(`issue_type:              ${issue_type}`);
if (page_update_urls.length) console.log(`page_update_urls:       ${page_update_urls_json}`);
if (split_test_control_url) console.log(`split_test_control_url: ${split_test_control_url}`);
if (split_test_variations.length) console.log(`split_test_variations:  ${split_test_variations_json}`);
if (new_page_url) console.log(`new_page_url:           ${new_page_url}`);
if (checkout_urls.length) console.log(`checkout_urls:           ${checkout_urls_json}`);
if (wistia_urls.length) console.log(`wistia_urls:             ${wistia_urls_json}`);
if (button_drop_time) console.log(`button_drop_time:        ${button_drop_time}`);
