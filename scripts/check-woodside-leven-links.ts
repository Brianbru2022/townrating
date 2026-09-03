import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const files = ['woodside-largo.json', 'new-gilston.json', 'wester-newburn.json', 'lundin-links.json', 'lower-largo.json', 'drumeldrie.json', 'leven-fife.json'];
const urls = new Set<string>();

for (const file of files) {
  const pkg = JSON.parse(await readFile(resolve('data/projects', file), 'utf8'));
  for (const feature of pkg.features) {
    if (feature.tags?.includes('woodside-leven-full-audit-2026-09-02') && feature.visitorWebsiteUrl) urls.add(feature.visitorWebsiteUrl);
  }
  const report = JSON.parse(await readFile(resolve('data/review', `${file.replace(/\.json$/, '')}-full-visitor-audit-2026-09-02.json`), 'utf8'));
  for (const check of report.research.sourceChecks) urls.add(check.url);
}

const results = [];
for (const url of [...urls].sort()) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 Heat Map audit link verifier' },
    });
    results.push({ url, ok: response.ok, status: response.status, finalUrl: response.url });
  } catch (error) {
    results.push({ url, ok: false, status: null, error: error instanceof Error ? error.message : String(error) });
  } finally {
    clearTimeout(timeout);
  }
}

const report = {
  checkedAt: new Date().toISOString(),
  checked: results.length,
  working: results.filter((result) => result.ok).length,
  failed: results.filter((result) => !result.ok).length,
  trailLinks: results.filter((result) => /trail|coastal-path|walks|crusoe|silverburn/i.test(result.url)),
  results,
};

await writeFile(resolve('data/review/woodside-leven-link-check-2026-09-02.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ checked: report.checked, working: report.working, failed: report.failed, failures: results.filter((result) => !result.ok) }, null, 2));
