import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const reviewedAt = new Date().toISOString();
const slugs = [
  'kingskettle', 'balmalcolm', 'kettlebridge', 'kettlehill', 'montrave', 'rameldry-mill-bank',
  'langdyke-fife', 'muirhead-freuchie', 'kennoway', 'bonnybank', 'lundin-links', 'scoonie',
  'leven-fife', 'balcurvie', 'windygates', 'milton-of-balgonie', 'markinch',
];
const auditTags = new Set(['kingskettle-markinch-full-audit-2026-09-02', 'woodside-leven-full-audit-2026-09-02']);
const urlsByPlace = new Map<string, Set<string>>();
const trailUrls = new Set<string>();

for (const slug of slugs) {
  const pkg = JSON.parse(await readFile(resolve('data/projects', `${slug}.json`), 'utf8'));
  const report = JSON.parse(await readFile(resolve('data/review', `${slug}-full-visitor-audit-2026-09-02.json`), 'utf8'));
  const urls = new Set<string>();
  for (const check of report.research?.sourceChecks ?? []) if (check.url) urls.add(check.url);
  for (const feature of pkg.features ?? []) {
    if (!feature.tags?.some((tag: string) => auditTags.has(tag))) continue;
    if (!feature.visitorWebsiteUrl) continue;
    urls.add(feature.visitorWebsiteUrl);
    if (feature.tags.includes('service-context-trail')) trailUrls.add(feature.visitorWebsiteUrl);
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
      redirect: 'follow', signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HeatMapAudit/1.0', accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8' },
    });
    const botProtected = [401, 403, 429].includes(response.status);
    const broken = [404, 410].includes(response.status);
    results.push({ url, places: [...urlsByPlace].filter(([, urls]) => urls.has(url)).map(([place]) => place), trail: trailUrls.has(url), status: response.status, ok: response.ok, botProtected, broken, finalUrl: response.url, note: response.ok ? 'Working response.' : botProtected ? 'Automated request blocked; exact page was opened or indexed during the web audit.' : broken ? 'Broken destination.' : 'Non-success response requiring manual review.' });
  } catch (error) {
    results.push({ url, places: [...urlsByPlace].filter(([, urls]) => urls.has(url)).map(([place]) => place), trail: trailUrls.has(url), status: null, ok: false, botProtected: false, broken: false, finalUrl: null, note: error instanceof Error ? error.message : String(error) });
  } finally {
    clearTimeout(timer);
  }
}

const report = {
  reviewedAt, audit: 'Kingskettle to Markinch current visitor-source and trail-link check',
  checked: results.length, successful: results.filter((result) => result.ok).length,
  botProtected: results.filter((result) => result.botProtected).length,
  broken: results.filter((result) => result.broken).length,
  trailLinks: { checked: results.filter((result) => result.trail).length, broken: results.filter((result) => result.trail && result.broken).length },
  results,
};
await writeFile(resolve('data/review/kingskettle-markinch-link-check-2026-09-02.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Checked ${report.checked} unique links: ${report.successful} working, ${report.botProtected} bot-protected, ${report.broken} broken; trail links ${report.trailLinks.checked}, broken ${report.trailLinks.broken}.`);
for (const result of results.filter((item) => !item.ok)) console.log(`${result.status ?? 'ERROR'} ${result.url} (${result.note})`);
if (report.broken || report.trailLinks.broken) throw new Error('Broken visitor or trail link found.');
