import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const reviewedAt = new Date().toISOString();
const slugs = [
  'kirkton-balmerino',
  'bottomcraig',
  'kilmany',
  'logie-fife',
  'rathillet',
  'hazelton-walls',
  'creich-fife',
  'brunton-creich',
];

const urlsByPlace = new Map<string, Set<string>>();

for (const slug of slugs) {
  const pkg = JSON.parse(await readFile(resolve('data/projects', `${slug}.json`), 'utf8'));
  const report = JSON.parse(
    await readFile(resolve('data/review', `${slug}-full-visitor-audit-2026-09-02.json`), 'utf8'),
  );
  const urls = new Set<string>();
  for (const check of report.research.sourceChecks ?? []) urls.add(check.url);
  for (const feature of pkg.features ?? []) {
    if (feature.visitorWebsiteUrl) urls.add(feature.visitorWebsiteUrl);
    for (const source of feature.sourceRecords ?? []) {
      if (source.sourceUrl) urls.add(source.sourceUrl);
    }
  }
  for (const url of pkg.project.touristAppeal?.sourceUrls ?? []) urls.add(url);
  urlsByPlace.set(pkg.project.name, urls);
}

const uniqueUrls = [...new Set([...urlsByPlace.values()].flatMap((urls) => [...urls]))].sort();
const results = [];
for (const url of uniqueUrls) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HeatMapAudit/1.0',
        accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
      },
    });
    results.push({
      url,
      places: [...urlsByPlace].filter(([, urls]) => urls.has(url)).map(([place]) => place),
      status: response.status,
      ok: response.ok,
      finalUrl: response.url,
      note: response.ok ? 'Working response.' : 'Non-success response; review manually if the site blocks automated requests.',
    });
  } catch (error) {
    results.push({
      url,
      places: [...urlsByPlace].filter(([, urls]) => urls.has(url)).map(([place]) => place),
      status: null,
      ok: false,
      finalUrl: null,
      note: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }
}

const report = {
  reviewedAt,
  audit: 'Kirkton to Brunton saved-source and trail-link check',
  checked: results.length,
  successful: results.filter((result) => result.ok).length,
  automatedFailures: results.filter((result) => !result.ok).length,
  results,
};

await writeFile(
  resolve('data/review/kirkton-brunton-link-check-2026-09-02.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);

console.log(`Checked ${report.checked} unique links: ${report.successful} working responses, ${report.automatedFailures} requiring manual review.`);
for (const result of results.filter((item) => !item.ok)) {
  console.log(`${result.status ?? 'ERROR'} ${result.url} (${result.note})`);
}
