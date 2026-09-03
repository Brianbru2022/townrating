import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import { cairnOMountPackages } from '../src/data/cairnOMount';

const reviewedAt = '2026-09-01';
const userAgent = 'TownscapeGuides-AngusAudit/1.0 (local editorial research)';

type FetchRecord = {
  url: string;
  ok: boolean;
  status: number | null;
  finalUrl?: string;
  contentType?: string;
  body?: string;
  error?: string;
};

async function fetchText(url: string, timeoutMs = 30_000, retries = 2): Promise<FetchRecord> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': userAgent, accept: 'text/html,application/json,application/xml,text/xml;q=0.9,*/*;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      const result = {
        url,
        ok: response.ok,
        status: response.status,
        finalUrl: response.url,
        contentType: response.headers.get('content-type') ?? undefined,
        body: await response.text(),
      };
      if (![429, 502, 503, 504].includes(response.status) || attempt === retries) return result;
    } catch (error) {
      if (attempt === retries) return { url, ok: false, status: null, error: error instanceof Error ? error.message : String(error) };
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
  }
  return { url, ok: false, status: null, error: 'Retry loop exhausted' };
}

async function mapConcurrent<T, R>(items: readonly T[], concurrency: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await work(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalise(value: string): string {
  return value.normalize('NFKD').replace(/[’']/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLocaleLowerCase('en-GB');
}

function exactPlaceMention(value: string, place: string): boolean {
  const haystack = ` ${normalise(value)} `;
  const needle = ` ${normalise(place)} `;
  return haystack.includes(needle);
}

async function sitemapUrls(rootUrl: string): Promise<{ root: FetchRecord; urls: string[]; childFailures: FetchRecord[] }> {
  const root = await fetchText(rootUrl);
  if (!root.ok || !root.body) return { root, urls: [], childFailures: [] };
  const extract = (body: string) => [...body.matchAll(/<loc>(.*?)<\/loc>/gis)].map((match) => match[1].replace(/&amp;/g, '&').trim());
  const initial = extract(root.body);
  const childMaps = initial.filter((url) => /(?:sitemap|sitemap_index)[^/]*\.xml(?:\?|$)/i.test(url));
  const direct = initial.filter((url) => !childMaps.includes(url));
  const children = await mapConcurrent(childMaps.slice(0, 80), 6, (url) => fetchText(url));
  const urls = [...direct, ...children.flatMap((child) => child.ok && child.body ? extract(child.body) : [])];
  return { root: { ...root, body: undefined }, urls: [...new Set(urls)], childFailures: children.filter((child) => !child.ok).map((child) => ({ ...child, body: undefined })) };
}

const packages = cairnOMountPackages
  .filter((candidate) => candidate.project.region === 'Angus')
  .sort((left, right) => left.project.locality.localeCompare(right.project.locality));

console.log(`Researching ${packages.length} Angus places against current official and provider sources...`);

const [curiousCatalogue, goQuestCatalogue] = await Promise.all([
  sitemapUrls('https://curiousabout.co.uk/sitemap.xml'),
  sitemapUrls('https://goquestadventures.com/sitemap.xml'),
]);

const [toiletDirectory, parkingPage] = await Promise.all([
  fetchText('https://www.angus.gov.uk/directories/public_toilets_and_radar_keys/all_public_toilets_listed_by_location'),
  fetchText('https://www.angus.gov.uk/roads_parking_and_travel/parking/changes_to_parking_and_parking_review'),
]);
const toiletText = stripHtml(toiletDirectory.body ?? '');
const parkingText = stripHtml(parkingPage.body ?? '');

// Current OSM point amenities provide candidate discovery only. Keeping this
// query to nodes makes the county request bounded; authoritative Visit Angus,
// council and operator sources remain mandatory before publication.
const overpassQuery = `[out:json][timeout:60];(node["amenity"~"^(cafe|ice_cream|toilets)$"](56.42,-3.35,56.95,-2.30);node["shop"~"^(bakery|coffee|deli)$"](56.42,-3.35,56.95,-2.30);node["tourism"~"^(attraction|museum|viewpoint|gallery|picnic_site)$"](56.42,-3.35,56.95,-2.30);node["leisure"="picnic_table"](56.42,-3.35,56.95,-2.30););out tags qt;`;
let overpass = await fetchText(`https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(overpassQuery)}`, 90_000, 1);
if (!overpass.ok) overpass = await fetchText(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`, 90_000, 1);
let osmElements: any[] = [];
try { osmElements = JSON.parse(overpass.body ?? '{}').elements ?? []; } catch { /* explicit failure remains in sourceHealth */ }
const overpassChecks = [{ bbox: [56.42, -3.35, 56.95, -2.30], url: overpass.finalUrl ?? overpass.url, status: overpass.status, ok: overpass.ok }];
const osmCandidates = osmElements.flatMap((element) => {
  const lon = element.lon ?? element.center?.lon;
  const lat = element.lat ?? element.center?.lat;
  return Number.isFinite(lon) && Number.isFinite(lat) ? [{
    id: `${element.type}/${element.id}`,
    url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    coordinates: [lon, lat] as [number, number],
    tags: element.tags ?? {},
  }] : [];
});

const places = await mapConcurrent(packages, 1, async (pkg, index) => {
  const place = pkg.project.locality;
  if (index > 0 && index % 20 === 0) console.log(`Current-source searches completed for ${index}/${packages.length} places...`);
  const visitAngusUrl = `https://visitangus.com/wp-json/wp/v2/search?search=${encodeURIComponent(place)}&per_page=40`;
  const treasureUrl = `https://www.treasuretrails.co.uk/search/suggest.json?q=${encodeURIComponent(place)}&resources%5Btype%5D=product`;
  const mysteryUrl = `https://www.mysteryguides.co.uk/search/suggest.json?q=${encodeURIComponent(place)}&resources%5Btype%5D=product`;
  const visitAngusResponse = await fetchText(visitAngusUrl);
  const treasureResponse = await fetchText(treasureUrl);
  const mysteryResponse = await fetchText(mysteryUrl);
  let visitAngusResults: Array<{ title: string; url: string; subtype?: string }> = [];
  let treasureResults: Array<Record<string, unknown>> = [];
  let mysteryResults: Array<Record<string, unknown>> = [];
  try {
    visitAngusResults = JSON.parse(visitAngusResponse.body ?? '[]').map((result: any) => ({ title: stripHtml(result.title ?? ''), url: result.url, subtype: result.subtype }));
  } catch { /* recorded through status */ }
  try {
    treasureResults = (JSON.parse(treasureResponse.body ?? '{}').resources?.results?.products ?? []).map((product: any) => ({
      title: product.title, url: new URL(product.url, 'https://www.treasuretrails.co.uk').href, available: product.available, price: product.price, tags: product.tags,
    }));
  } catch { /* recorded through status */ }
  try {
    mysteryResults = (JSON.parse(mysteryResponse.body ?? '{}').resources?.results?.products ?? []).map((product: any) => ({
      title: product.title, url: new URL(product.url, 'https://www.mysteryguides.co.uk').href, available: product.available, price: product.price, tags: product.tags,
    }));
  } catch { /* recorded through status */ }

  const boundary = pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;
  const localOsm = osmCandidates.filter((candidate) => {
    try { return booleanPointInPolygon(point(candidate.coordinates), boundary); } catch { return false; }
  });
  const currentVisitorUrls = [...new Set(pkg.features.map((feature) => feature.visitorWebsiteUrl).filter((url): url is string => Boolean(url)))];

  return {
    id: pkg.project.id,
    place,
    scoreBeforeAudit: pkg.project.touristAppeal?.score,
    exact58SecondPassRequired: pkg.project.touristAppeal?.score === 58,
    sources: {
      visitAngus: {
        searchUrl: visitAngusUrl, status: visitAngusResponse.status, resultCount: visitAngusResults.length, results: visitAngusResults,
      },
      treasureTrails: {
        searchUrl: treasureUrl, status: treasureResponse.status, resultCount: treasureResults.length, results: treasureResults,
      },
      mysteryGuides: {
        searchUrl: mysteryUrl, status: mysteryResponse.status, resultCount: mysteryResults.length, results: mysteryResults,
      },
      curiousAbout: {
        catalogueUrl: 'https://curiousabout.co.uk/sitemap.xml',
        matches: curiousCatalogue.urls.filter((url) => exactPlaceMention(decodeURIComponent(url), place)),
      },
      goQuestAdventures: {
        catalogueUrl: 'https://goquestadventures.com/sitemap.xml',
        matches: goQuestCatalogue.urls.filter((url) => exactPlaceMention(decodeURIComponent(url), place)),
      },
      angusCouncilToilets: {
        directoryUrl: toiletDirectory.url, status: toiletDirectory.status, exactPlaceMention: exactPlaceMention(toiletText, place),
      },
      angusCouncilParking: {
        directoryUrl: parkingPage.url, status: parkingPage.status, exactPlaceMention: exactPlaceMention(parkingText, place),
      },
      currentOsm: {
        queryUrls: overpassChecks.map((check) => check.url), status: overpassChecks.every((check) => check.ok) ? 200 : null, candidates: localOsm,
      },
      currentPublishedVisitorUrls: currentVisitorUrls,
    },
  };
});

const visitorUrls = [...new Set(places.flatMap((entry) => entry.sources.currentPublishedVisitorUrls))];
console.log(`Checking ${visitorUrls.length} currently published visitor links...`);
const linkChecks = await mapConcurrent(visitorUrls, 10, async (url, index) => {
  if (index > 0 && index % 100 === 0) console.log(`Published-link checks completed for ${index}/${visitorUrls.length} URLs...`);
  const result = await fetchText(url, 20_000);
  return { url, ok: result.ok, status: result.status, finalUrl: result.finalUrl, contentType: result.contentType, error: result.error };
});

const dossier = {
  reviewedAt,
  county: 'Angus',
  method: {
    boundary: 'Current OSM candidates were spatially joined to each project visitor boundary; discovery candidates are not automatically published.',
    visitorResearch: 'An exact-place query was run against the current Visit Angus WordPress search endpoint for every selector entry.',
    clueTrailResearch: 'Every place was queried against live Treasure Trails and Mystery Guides product search; current Curious About and GoQuest catalogue sitemaps were matched separately.',
    facilities: 'Current Angus Council public-toilet and off-street-parking directories were checked by exact place name; OSM candidates remain discovery evidence only.',
    linkCheck: 'Every currently published visitorWebsiteUrl in the 182 Angus projects received a current HTTP request; blocked responses remain review items rather than automatic deletions.',
  },
  sourceHealth: {
    visitAngusSuccessful: places.filter((entry) => entry.sources.visitAngus.status === 200).length,
    treasureTrailsSuccessful: places.filter((entry) => entry.sources.treasureTrails.status === 200).length,
    mysteryGuidesSuccessful: places.filter((entry) => entry.sources.mysteryGuides.status === 200).length,
    curiousAboutCatalogueUrls: curiousCatalogue.urls.length,
    goQuestCatalogueUrls: goQuestCatalogue.urls.length,
    angusCouncilToiletsStatus: toiletDirectory.status,
    angusCouncilParkingStatus: parkingPage.status,
    overpassStatus: overpassChecks.every((check) => check.ok) ? 200 : null,
    overpassTilesSuccessful: overpassChecks.filter((check) => check.ok).length,
    overpassTilesTotal: overpassChecks.length,
    overpassCandidateCount: osmCandidates.length,
    publishedLinksChecked: linkChecks.length,
    publishedLinksReachable: linkChecks.filter((entry) => entry.ok).length,
  },
  places,
  linkChecks,
};

await writeFile(resolve(`data/review/angus-county-web-research-${reviewedAt}.json`), `${JSON.stringify(dossier, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(dossier.sourceHealth, null, 2));
