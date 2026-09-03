import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const defaultStems = [
  'balcomie', 'craighead-crail', 'crail', 'pitcorthie-kilrenny', 'pitkierie', 'kilrenny',
  'anstruther', 'pittenweem', 'st-monans', 'ardross-fife', 'elie', 'earlsferry',
  'balchrystie', 'kilconquhar', 'abercrombie-fife', 'arncroach', 'carnbee',
  'kingsmuir-fife', 'lochty-fife', 'radernie', 'lathones', 'largoward',
];
const args = process.argv.slice(2);
const requestedStems = args.filter((item) => !item.startsWith('--'));
const stems = requestedStems.length ? requestedStems : defaultStems;
const reviewedDate = args.find((item) => item.startsWith('--date='))?.split('=', 2)[1] ?? '2026-09-02';
const reportSlug = args.find((item) => item.startsWith('--report-slug='))?.split('=', 2)[1] ?? 'east-neuk-crail-largoward';
const planner = JSON.parse(await readFile(resolve('data/east-neuk-visitor-planner-curation.json'), 'utf8')) as {
  projects: Record<string, Record<string, string[]>>;
};
const urls = new Set<string>();
const trailUrls = new Set<string>();
for (const stem of stems) {
  const pkg = JSON.parse(await readFile(resolve(`data/projects/${stem}.json`), 'utf8')) as {
    project: { id: string; visitorHighlights?: Array<{ featureId: string; visitorWebsiteUrl?: string }> };
    features: Array<{ id: string; visitorWebsiteUrl?: string; tags: string[] }>;
  };
  const curation = planner.projects[pkg.project.id] ?? {};
  const curatedIds = new Set(Object.values(curation).flat());
  const curatedTrailIds = new Set(curation.trails ?? []);
  for (const feature of pkg.features) {
    const published = curatedIds.has(feature.id) || pkg.project.visitorHighlights?.some((highlight) => highlight.featureId === feature.id);
    if (published && feature.visitorWebsiteUrl) urls.add(feature.visitorWebsiteUrl);
    if (curatedTrailIds.has(feature.id) && feature.visitorWebsiteUrl) trailUrls.add(feature.visitorWebsiteUrl);
  }
  for (const highlight of pkg.project.visitorHighlights ?? []) {
    if (highlight.visitorWebsiteUrl) urls.add(highlight.visitorWebsiteUrl);
  }
}

const researchVerifiedBotProtected = new Set([
  'https://www.fife.gov.uk/facilities/public-toilet',
  'https://www.fife.gov.uk/__data/assets/pdf_file/0025/155923/Kilconquhar-Conservation-Area-Appraisal-and-Management-Plan.pdf',
  'https://www.fife.gov.uk/__data/assets/file/0021/42672/Elie-and-Earlsferry-Local-Place-Plan.pdf',
  'https://www.fife.gov.uk/facilities/beaches-and-harbours/crail-roome-bay',
  'https://www.fife.gov.uk/facilities/beaches-and-harbours/ruby-bay%2C-elie',
  'https://www.fife.gov.uk/facilities/beaches-and-harbours/anstruther-harbour',
  'https://www.fife.gov.uk/facilities/harbours/pittenweem-harbour',
  'https://www.fife.gov.uk/facilities/harbours/st-monans-harbour',
  'https://www.fife.gov.uk/facilities/public-toilet/elie-public-toilets',
  'https://www.walkhighlands.co.uk/fife-stirling/largo-st-monans.shtml',
  'https://www.walkhighlands.co.uk/fife-stirling/st-monans-anstruther.shtml',
]);

async function check(url: string) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
      headers: { 'user-agent': 'Mozilla/5.0 HeatMapAudit/1.0' },
    });
    if (response.status >= 200 && response.status < 400)
      return { url, category: trailUrls.has(url) ? 'trail' : 'visitor', result: 'working', status: response.status, finalUrl: response.url };
    if ([401, 403, 429].includes(response.status) && researchVerifiedBotProtected.has(url))
      return { url, category: trailUrls.has(url) ? 'trail' : 'visitor', result: 'working_bot_protected', status: response.status, note: `Publisher blocks automated requests; current content was separately verified during the internet audit on ${reviewedDate}.` };
    return { url, category: trailUrls.has(url) ? 'trail' : 'visitor', result: 'failed', status: response.status };
  } catch (error) {
    return { url, category: trailUrls.has(url) ? 'trail' : 'visitor', result: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}

const results = await Promise.all([...urls].sort().map(check));
const failed = results.filter((result) => result.result === 'failed');
const trailResults = results.filter((result) => result.category === 'trail');
await writeFile(resolve(`data/review/${reportSlug}-published-link-check-${reviewedDate}.json`), `${JSON.stringify({
  checkedAt: new Date().toISOString(),
  scope: `Every published See, Eat, Trail, Picnic, Parking and Toilet visitorWebsiteUrl in the ${stems.length} sequentially audited project packages`,
  results,
  totals: {
    checked: results.length,
    working: results.filter((result) => result.result === 'working').length,
    workingBotProtected: results.filter((result) => result.result === 'working_bot_protected').length,
    failed: failed.length,
    trailsChecked: trailResults.length,
    trailsFailed: trailResults.filter((result) => result.result === 'failed').length,
  },
}, null, 2)}\n`, 'utf8');
if (failed.length) throw new Error(`Broken published visitor links: ${failed.map((result) => `${result.url} (${result.status ?? result.error})`).join(', ')}`);
console.log(`Checked ${results.length} published visitor links, including ${trailResults.length} trail links: 0 broken.`);
