'use strict';

const fs = require('fs');

const body = (process.env.ISSUE_BODY || '').replace(/<br\s*\/?>/gi, '\n');

// Strip Markdown link syntax [label](<url>) or [label](url) → bare URL/path
function toFullUrl(raw) {
  let s = raw.trim();
  const mdLink = s.match(/^\[.*?\]\(<?(.*?)>?\)$/);
  if (mdLink) s = mdLink[1];
  return s;
}

// Extract repo-relative path from a full URL or bare path
function toRepoPath(raw) {
  const s = toFullUrl(raw);
  try { return new URL(s).pathname; } catch { return s; }
}

// Normalize to a clean folder path with trailing slash
function normalizeFolder(p) {
  return toRepoPath(p).replace(/\/+$/, '') + '/';
}

// ── ref_url / duplicate_url ───────────────────────────────────────────────────
const refRawMatch = body.match(/ref_url:\s*(\S+)/);
const refRaw = refRawMatch ? refRawMatch[1] : '';
const refPath = refRaw ? normalizeFolder(refRaw) : '';
const refFullUrl = refRaw ? toFullUrl(refRaw) : '';

const dupRawMatch = body.match(/duplicate_url:\s*(\S+)/);
const dupRaw = dupRawMatch ? dupRawMatch[1] : '';
const duplicatePath = dupRaw ? normalizeFolder(dupRaw) : '';
const dupFullUrl = dupRaw ? toFullUrl(dupRaw) : '';

if (!refPath || !duplicatePath) {
  console.error('ERROR: ref_url or duplicate_url not found in issue body.');
  process.exit(1);
}

// ── GTMetrix Test URLs ─────────────────────────────────────────────────────────
// Capture everything between the "GTMetrix Test URLs" heading and "replace_map:"
const gtmetrixSectionMatch = body.match(/GT\s*Metrix\s+Test\s+URLs?\s*\n([\s\S]*?)(?=replace_map:|$)/i);
const gtmetrixUrls = [];
if (gtmetrixSectionMatch) {
  for (const line of gtmetrixSectionMatch[1].split('\n')) {
    let url = line.replace(/^[ \t]*[-*][ \t]*/, '').trim();
    if (!url) continue;
    // Resolve placeholders with full domain URLs (not repo paths)
    url = url.replace('<ref_url>', refFullUrl).replace('<duplicate_url>', dupFullUrl);
    url = toFullUrl(url);
    if (url.startsWith('http://') || url.startsWith('https://')) gtmetrixUrls.push(url);
  }
}

// ── replace_map ───────────────────────────────────────────────────────────────
// Supports both formats:
//   single-line:  old → new  (or  old -> new)
//   two-line:     old\n→ new
const replaceSection = body.match(/replace_map:\s*\n([\s\S]+)/);
const replacePairs = [];
if (replaceSection) {
  const lines = replaceSection[1].split('\n');
  let pendingOld = null;
  for (const line of lines) {
    const s = line.replace(/^[ \t]*[-*][ \t]*/, '').trim();
    if (!s) continue;

    // "old → new" or "old -> new" on a single line
    const inlineMatch = s.match(/^(.+?)\s+→\s+(.+)$/) || s.match(/^(.+?)\s+->\s+(.+)$/);
    // "→ new" or "-> new" — second half of a two-line pair
    const arrowOnlyMatch = s.match(/^→\s+(.+)$/) || s.match(/^->\s+(.+)$/);

    if (inlineMatch) {
      replacePairs.push({ old: toFullUrl(inlineMatch[1]), new: toFullUrl(inlineMatch[2]) });
      pendingOld = null;
    } else if (arrowOnlyMatch && pendingOld !== null) {
      replacePairs.push({ old: pendingOld, new: toFullUrl(arrowOnlyMatch[1]) });
      pendingOld = null;
    } else {
      pendingOld = toFullUrl(s);
    }
  }
}

// ── Write GitHub Actions outputs ──────────────────────────────────────────────
const outputFile = process.env.GITHUB_OUTPUT || '';
const out = [
  `ref_path=${refPath}`,
  `duplicate_path=${duplicatePath}`,
  'gtmetrix_urls<<GTEOF',
  gtmetrixUrls.join('\n'),
  'GTEOF',
  'replace_map<<RMEOF',
  replacePairs.map(p => `${p.old} -> ${p.new}`).join('\n'),
  'RMEOF',
  '',
].join('\n');

fs.appendFileSync(outputFile, out);

console.log(`ref_path:       ${refPath}`);
console.log(`duplicate_path: ${duplicatePath}`);
console.log(`gtmetrix_urls:  ${JSON.stringify(gtmetrixUrls)}`);
console.log(`replace_map:    ${JSON.stringify(replacePairs)}`);
