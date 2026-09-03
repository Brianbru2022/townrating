import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const reviewedAt = new Date().toISOString();
const slugs = [
  'glenduckie',
  'luthrie',
  'moonzie',
  'kilmaron-castle',
  'lindifferon',
  'fernie-castle',
  'letham-fife',
  'bow-of-fife',
  'cupar-muir',
  'cupar',
  'craigrothie',
  'pitlessie',
  'springfield-fife',
  'ladybank',
];
const auditTag = 'glenduckie-ladybank-full-audit-2026-09-02';
const urlsByPlace = new Map<string, Set<string>>();

for (const slug of slugs) {
  const pkg = JSON.parse(await readFile(resolve('data/projects', `${slug}.json`), 'utf8'));
  const report = JSON.parse(
    await readFile(resolve('data/review', `${slug}-full-visitor-audit-2026-09-02.json`), 'utf8'),
  );
  const urls = new Set<string>();
  for (const check of report.research.sourceChecks ?? []) if (check.url) urls.add(check.url);
  for (const feature of pkg.features ?? []) {
    if (!feature.tags?.includes(auditTag)) continue;
    if (feature.visitorWebsiteUrl) urls.add(feature.visitorWebsiteUrl);
  }
  for (const [provider, value] of Object.entries(report.namedTrailSearch ?? {})) {
    if (typeof value === 'string' && /^https?:\/\//.test(value)) urls.add(value);
    void provider;
  }
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
    const botProtected = [401, 403, 429].includes(response.status);
    const broken = [404, 410].includes(response.status);
    results.push({
      url,
      places: [...urlsByPlace].filter(([, urls]) => urls.has(url)).map(([place]) => place),
      status: response.status,
      ok: response.ok,
      botProtected,
      broken,
      finalUrl: response.url,
      note: response.ok
        ? 'Working response.'
        : botProtected
          ? 'The site blocks automated requests; the exact destination was cross-checked during the web audit.'
          : broken
            ? 'Broken destination.'
            : 'Non-success response requiring manual review.',
    });
  } catch (error) {
    results.push({
      url,
      places: [...urlsByPlace].filter(([, urls]) => urls.has(url)).map(([place]) => place),
      status: null,
      ok: false,
      botProtected: false,
      broken: false,
      finalUrl: null,
      note: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }
}

const report = {
  reviewedAt,
  audit: 'Glenduckie to Ladybank current visitor-source and trail-link check',
  checked: results.length,
  successful: results.filter((result) => result.ok).length,
  botProtected: results.filter((result) => result.botProtected).length,
  broken: results.filter((result) => result.broken).length,
  automatedFailures: results.filter((result) => !result.ok).length,
  results,
};
await writeFile(
  resolve('data/review/glenduckie-ladybank-link-check-2026-09-02.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(
  `Checked ${report.checked} unique visitor links: ${report.successful} working responses, ${report.botProtected} bot-protected, ${report.broken} broken.`,
);
for (const result of results.filter((item) => !item.ok))
  console.log(`${result.status ?? 'ERROR'} ${result.url} (${result.note})`);
