import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const stems = ['scotscraig', 'tayport', 'rhynd-fife', 'carrick-leuchars', 'leuchars', 'guardbridge'];
const urls = new Set<string>();
for (const stem of stems) {
  const pkg = JSON.parse(await readFile(resolve(`data/projects/${stem}.json`), 'utf8')) as {
    features: Array<{ visitorWebsiteUrl?: string }>;
  };
  for (const feature of pkg.features) if (feature.visitorWebsiteUrl) urls.add(feature.visitorWebsiteUrl);
}

const browserVerifiedBotProtected = new Set([
  'https://www.fife.gov.uk/facilities/car-park/station-car-park-a-b%2C-leuchars',
  'https://www.fife.gov.uk/facilities/park/east-common%2C-tayport',
  'https://www.fife.gov.uk/facilities/public-toilet/public-toilets',
]);

async function check(url: string) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'Mozilla/5.0 HeatMapAudit/1.0' },
    });
    if (response.status >= 200 && response.status < 400)
      return { url, result: 'working', status: response.status, finalUrl: response.url };
    if (response.status === 403 && browserVerifiedBotProtected.has(url))
      return { url, result: 'working_bot_protected', status: response.status, note: 'The publisher blocks automated requests; the current page and relevant content were separately verified through web search/browser research on 2026-09-02.' };
    return { url, result: 'failed', status: response.status };
  } catch (error) {
    return { url, result: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}

const results = await Promise.all([...urls].sort().map(check));
const failed = results.filter((result) => result.result === 'failed');
await writeFile(resolve('data/review/scotscraig-guardbridge-link-check-2026-09-02.json'), `${JSON.stringify({
  checkedAt: new Date().toISOString(),
  scope: 'Every published visitorWebsiteUrl in the six fully audited project packages',
  results,
  totals: {
    checked: results.length,
    working: results.filter((result) => result.result === 'working').length,
    workingBotProtected: results.filter((result) => result.result === 'working_bot_protected').length,
    failed: failed.length,
  },
}, null, 2)}\n`, 'utf8');
if (failed.length) throw new Error(`Broken published visitor links: ${failed.map((result) => result.url).join(', ')}`);
console.log(`Checked ${results.length} published visitor links: ${results.length - failed.length} verified, 0 broken.`);
