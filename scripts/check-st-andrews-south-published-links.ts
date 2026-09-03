import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const stems = [
  'kincaple', 'peat-inn', 'newpark-st-andrews', 'balone', 'denhead-st-andrews',
  'st-andrews', 'prior-muir', 'brownhills-st-andrews', 'boarhills', 'kingsbarns',
  'balcomie', 'dunino', 'stravithie',
];
const planner = JSON.parse(await readFile(resolve('data/east-neuk-visitor-planner-curation.json'), 'utf8')) as {
  projects: Record<string, Record<string, string[]>>;
};
const urls = new Set<string>();
for (const stem of stems) {
  const pkg = JSON.parse(await readFile(resolve(`data/projects/${stem}.json`), 'utf8')) as {
    project: { id: string };
    features: Array<{ id: string; visitorWebsiteUrl?: string; tags: string[] }>;
  };
  const curatedIds = new Set(Object.values(planner.projects[pkg.project.id] ?? {}).flat());
  for (const feature of pkg.features) {
    const published =
      curatedIds.has(feature.id) ||
      feature.tags.includes('curated-visitor-attraction') ||
      feature.tags.includes('service-context-food');
    if (published && feature.visitorWebsiteUrl) urls.add(feature.visitorWebsiteUrl);
  }
}

const researchVerifiedBotProtected = new Set([
  'https://www.historicenvironment.scot/visit/all/st-andrews-castle/plan-your-visit/',
  'https://www.historicenvironment.scot/visit/all/st-andrews-cathedral/plan-your-visit/',
  'https://www.fife.gov.uk/facilities/beaches-and-harbours/west-sands%2C-st-andrews',
  'https://www.fife.gov.uk/facilities/beaches-and-harbours/east-sands',
  'https://www.fife.gov.uk/facilities/car-park/petheram-bridge-car-park%2C-st-andrews',
  'https://www.fife.gov.uk/facilities/car-park/argyle-street-north-car-park%2C-st-andrews',
  'https://www.fife.gov.uk/facilities/car-park/bruce-embankment-car-park%2C-st-andrews',
  'https://www.fife.gov.uk/facilities/public-toilet/st-andrews-bruce-embankment-public-toilets',
  'https://www.fife.gov.uk/facilities/public-toilet/st-andrews-harbour-public-toilets',
  'https://www.fife.gov.uk/facilities/public-toilet',
  'https://www.fife.gov.uk/facilities/beaches-and-harbours/kingsbarns-beach',
]);

async function check(url: string) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
      headers: { 'user-agent': 'Mozilla/5.0 HeatMapAudit/1.0' },
    });
    if (response.status >= 200 && response.status < 400)
      return { url, result: 'working', status: response.status, finalUrl: response.url };
    if ([401, 403, 429].includes(response.status) && researchVerifiedBotProtected.has(url))
      return { url, result: 'working_bot_protected', status: response.status, note: 'Publisher blocks automated requests; current content was separately verified in the internet audit on 2026-09-02.' };
    return { url, result: 'failed', status: response.status };
  } catch (error) {
    return { url, result: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}

const results = await Promise.all([...urls].sort().map(check));
const failed = results.filter((result) => result.result === 'failed');
await writeFile(resolve('data/review/st-andrews-south-published-link-check-2026-09-02.json'), `${JSON.stringify({
  checkedAt: new Date().toISOString(),
  scope: 'Every published See, Eat, Trail, Picnic, Parking and Toilet visitorWebsiteUrl in the 13 sequentially audited project packages',
  results,
  totals: {
    checked: results.length,
    working: results.filter((result) => result.result === 'working').length,
    workingBotProtected: results.filter((result) => result.result === 'working_bot_protected').length,
    failed: failed.length,
  },
}, null, 2)}\n`, 'utf8');
if (failed.length) throw new Error(`Broken published visitor links: ${failed.map((result) => `${result.url} (${result.status ?? result.error})`).join(', ')}`);
console.log(`Checked ${results.length} published visitor links: ${results.length - failed.length} verified, 0 broken.`);
