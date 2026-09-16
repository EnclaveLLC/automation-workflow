'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_KEY;
const REPO          = process.env.REPO || '';
const PR_LABELS     = process.env.PR_LABELS || '';
const TEST_URLS     = process.env.TEST_URLS || '';
const LINEAR_ID     = process.env.LINEAR_ID || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const labels = PR_LABELS.split(',').map(s => s.trim()).filter(Boolean);
let status;
if (labels.includes('Split Test On')) status = 'on';
else if (labels.includes('Split Test Off')) status = 'off';
else {
  console.log('No Split Test On/Off label found on this PR — skipping Supabase update.');
  process.exit(0);
}

const repoName = REPO.split('/').pop();

const urls = TEST_URLS.split('\n').map(s => s.trim()).filter(Boolean);
if (urls.length === 0) {
  console.error('No test URLs found in PR body — cannot determine split test pages.');
  process.exit(1);
}

function slugFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || '';
  } catch (e) {
    return '';
  }
}

const controlSlug = slugFromUrl(urls[0]);
const variationSlugs = urls.slice(1).map(slugFromUrl).filter(Boolean);

if (!controlSlug) {
  console.error(`Could not derive control page slug from URL: ${urls[0]}`);
  process.exit(1);
}

async function supabaseRequest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase request to ${path} failed (${res.status} ${res.statusText}): ${text}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

(async () => {
  const domains = await supabaseRequest(`domains?repo=eq.${encodeURIComponent(repoName)}&select=id`);
  if (!domains || domains.length === 0) {
    throw new Error(`No domains row found in Supabase for repo "${repoName}"`);
  }
  const domainId = domains[0].id;

  const row = {
    domain_id: domainId,
    page_slug_control: controlSlug,
    page_slug_variations: variationSlugs,
    linear_id: LINEAR_ID || null,
    status,
  };

  await supabaseRequest('split_test', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });

  console.log(`Inserted split_test row: domain_id=${domainId}, control=${controlSlug}, variations=${JSON.stringify(variationSlugs)}, status=${status}, linear_id=${LINEAR_ID || 'null'}`);
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
