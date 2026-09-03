import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publishedProjectPackages } from '../src/data/publishedProjects';
import { publishedPlannerCurationForProject } from '../src/data/visitorPlannerCuration';

interface TreasureTrailsProduct {
  id: number;
  title: string;
  handle: string;
  product_type?: string;
  published_at?: string;
  tags?: string[];
  variants?: Array<{ price?: string }>;
}

interface ProductPage {
  products?: TreasureTrailsProduct[];
}

interface TrailCandidate {
  provider: 'Treasure Trails';
  title: string;
  url: string;
  productId: number;
  location?: string;
  trailType?: string;
  duration?: string;
  accessibility?: string[];
  price?: string;
  matchKind: 'exact_town_title' | 'multi_place_title';
  alreadyCurated: boolean;
}

interface VerifiedTrailSource {
  projectId: string;
  projectFile: string;
  featureId: string;
  name: string;
  provider: string;
  url: string;
  sourceTier: WebTrailCandidate['sourceTier'];
  score: number;
  boundaryStatus: 'confirmed_in_active_boundary';
  coordinates: [number, number];
  shortDescription: string;
  trailType: string;
  distance?: string;
  timeToSpend?: string;
  accessibility?: string;
  entranceFee?: string;
  sourceRecordId: string;
  licence: string;
  reliability: 'official_non_statutory' | 'secondary';
  reviewNotes: string;
}

interface VerifiedTrailSourceRegistry {
  schemaVersion: 1;
  trails: VerifiedTrailSource[];
}

interface WebTrailCandidate {
  title: string;
  url: string;
  domain: string;
  sourceTier: 'official_or_destination' | 'established_route_provider' | 'other_discovery';
}

interface WebSearchRecord {
  searchedAt: string;
  query: string;
  queries: string[];
  status: 'completed' | 'partial' | 'failed';
  results: WebTrailCandidate[];
  queryResults: Array<{
    query: string;
    status: 'completed' | 'failed';
    results: WebTrailCandidate[];
    error?: string;
  }>;
  error?: string;
}

interface WebSearchCache {
  schemaVersion: 2;
  searches: Record<string, WebSearchRecord>;
}

const catalogueEndpoint = 'https://www.treasuretrails.co.uk/products.json';
const reportPath = resolve('data/review/online-town-trail-audit.json');
const queuePath = resolve('data/review/online-town-trail-research-queue.json');
const webSearchCachePath = resolve('data/cache/online-town-trail-search-cache.json');
const verifiedSourceRegistryPath = resolve('data/trail-source-registry.json');
const reviewedAt = new Date().toISOString().slice(0, 10);
const searchWebRequested = process.argv.includes('--search-web');
const refreshWebSearch = process.argv.includes('--refresh-web');
const webSearchConcurrency = Math.max(1, Number(process.env.TRAIL_WEB_CONCURRENCY ?? 1));
const projectsArgument = process.argv.find((argument) => argument.startsWith('--projects='));
const requestedProjectIds = new Set(
  (projectsArgument?.slice('--projects='.length) ?? '').split(',').map((value) => value.trim()).filter(Boolean),
);
const batchStart = Math.max(
  0,
  Number(process.argv.find((argument) => argument.startsWith('--batch-start='))?.split('=')[1] ?? 0),
);
const batchSize = Math.max(
  0,
  Number(process.argv.find((argument) => argument.startsWith('--batch-size='))?.split('=')[1] ?? 0),
);

function normalise(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-GB')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function townAliases(locality: string): string[] {
  return [...new Set([locality, locality.replace(/\s*\([^)]*\)\s*/g, ' ')].map(normalise))];
}

const regionAliases: Record<string, string[]> = {
  buckinghamshire: ['milton keynes'],
  clwyd: ['conwy', 'denbighshire', 'flintshire', 'north wales', 'wrexham'],
  'city of edinburgh': ['edinburgh', 'lothian'],
  gwynedd: ['north wales', 'snowdonia', 'eryri'],
  northamptonshire: ['north northamptonshire', 'west northamptonshire'],
};

const recognisedUkRegions = [
  'angus',
  'bedfordshire',
  'berkshire',
  'bristol',
  'buckinghamshire',
  'cambridgeshire',
  'cheshire',
  'clackmannanshire',
  'clwyd',
  'cornwall',
  'cumbria',
  'denbighshire',
  'derbyshire',
  'devon',
  'dorset',
  'durham',
  'east sussex',
  'essex',
  'fife',
  'flintshire',
  'gloucestershire',
  'greater london',
  'greater manchester',
  'gwynedd',
  'hampshire',
  'herefordshire',
  'hertfordshire',
  'inverclyde',
  'isle of wight',
  'kent',
  'lancashire',
  'leicestershire',
  'lincolnshire',
  'lothian',
  'merseyside',
  'milton keynes',
  'norfolk',
  'north wales',
  'north yorkshire',
  'northamptonshire',
  'northumberland',
  'nottinghamshire',
  'oxfordshire',
  'perth and kinross',
  'rutland',
  'shropshire',
  'somerset',
  'south yorkshire',
  'staffordshire',
  'stirling',
  'suffolk',
  'surrey',
  'tyne and wear',
  'warwickshire',
  'west lothian',
  'west midlands',
  'west sussex',
  'west yorkshire',
  'wiltshire',
  'worcestershire',
  'wrexham',
].map(normalise);

function providerLocationMatchesRegion(location: string | undefined, region: string | undefined): boolean {
  if (!location || !region) return true;
  const normalisedLocation = normalise(location);
  const normalisedRegion = normalise(region);
  const expectedRegions = [normalisedRegion, ...(regionAliases[normalisedRegion] ?? []).map(normalise)];
  if (expectedRegions.some((candidate) => normalisedLocation.includes(candidate))) return true;
  return !recognisedUkRegions.some((candidate) => normalisedLocation.includes(candidate));
}

function productTownParts(title: string): string[] {
  const placePart = title.split(/\s+-\s+/, 1)[0] ?? title;
  return placePart
    .split(/\s+(?:&|and|to)\s+|\s*\/\s*/i)
    .map(normalise)
    .filter(Boolean);
}

function tagValue(product: TreasureTrailsProduct, prefix: string): string | undefined {
  const tag = product.tags?.find((candidate) =>
    candidate.toLocaleLowerCase('en-GB').startsWith(prefix.toLocaleLowerCase('en-GB')),
  );
  return tag?.slice(tag.indexOf(':') + 1).trim();
}

function accessibilityTags(product: TreasureTrailsProduct): string[] {
  return (product.tags ?? [])
    .filter((tag) => tag.toLocaleLowerCase('en-GB').startsWith('accessibility :'))
    .map((tag) => tag.slice(tag.indexOf(':') + 1).trim());
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\.(?:js|json)$/i, '').replace(/\/$/, '')}`;
  } catch {
    return value.replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

async function fetchCatalogue(): Promise<{
  products: TreasureTrailsProduct[];
  pages: string[];
}> {
  const products: TreasureTrailsProduct[] = [];
  const pages: string[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const url = `${catalogueEndpoint}?limit=250&page=${page}`;
    let response: Response | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await fetch(url, {
          headers: { 'User-Agent': 'Townscape Guides trail audit/1.0' },
          signal: AbortSignal.timeout(45_000),
        });
        if (response.ok) break;
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 2_000));
    }
    if (!response) throw lastError instanceof Error ? lastError : new Error(String(lastError));
    if (!response.ok) throw new Error(`Treasure Trails catalogue request failed: ${response.status} ${url}`);
    const payload = (await response.json()) as ProductPage;
    const batch = payload.products ?? [];
    if (batch.length === 0) break;
    products.push(...batch);
    pages.push(url);
    if (batch.length < 250) break;
  }

  if (products.length === 0) throw new Error('Treasure Trails catalogue returned no products.');
  return { products, pages };
}

function widerWebQueries(locality: string, region: string | undefined, country: string): string[] {
  const place = `"${locality}"`;
  const area = region && normalise(region) !== normalise(locality) ? ` ${region}` : '';
  const queries = [
    `${place} "heritage trail"${area}`,
    `${place} "town trail"${area}`,
    `${place} "self-guided walk"${area}`,
    `${place} "treasure trail"`,
    `${place} "heritage walk" council OR civic society OR history society${area}`,
    `${place} walking route site:ramblers.org.uk OR site:ldwa.org.uk${area}`,
  ];

  if (country === 'Wales') {
    queries.push(`${place} walking trail site:visitwales.com OR site:cadw.gov.wales`);
  } else if (country === 'Scotland') {
    queries.push(
      `${place} walking trail site:visitscotland.com OR site:walkhighlands.co.uk OR site:forestryandland.gov.scot`,
    );
  } else {
    queries.push(`${place} walking trail site:gov.uk OR site:nationaltrail.co.uk`);
  }
  return queries;
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&ndash;|&#8211;/g, '-')
    .replace(/&mdash;|&#8212;/g, '-')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unwrapDuckDuckGoUrl(value: string): string | undefined {
  try {
    const decoded = decodeHtml(value);
    const absolute = decoded.startsWith('//') ? `https:${decoded}` : decoded;
    const url = new URL(absolute);
    if (url.hostname.endsWith('duckduckgo.com') && url.searchParams.get('uddg')) {
      return url.searchParams.get('uddg') ?? undefined;
    }
    return /^https?:$/.test(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function sourceTier(domain: string): WebTrailCandidate['sourceTier'] {
  if (
    domain.endsWith('.gov.uk') ||
    domain.includes('nationaltrust.org.uk') ||
    domain.includes('forestryandland.gov.scot') ||
    domain.includes('visitscotland.com') ||
    domain.includes('visitwales.com') ||
    domain.includes('cadw.gov.wales') ||
    /^visit[a-z0-9-]+\.(?:com|co\.uk)$/.test(domain)
  ) {
    return 'official_or_destination';
  }
  if (
    domain.includes('walkhighlands.co.uk') ||
    domain.includes('ldwa.org.uk') ||
    domain.includes('nationaltrail.co.uk') ||
    domain.includes('ramblers.org.uk') ||
    domain.includes('treasuretrails.co.uk')
  ) {
    return 'established_route_provider';
  }
  return 'other_discovery';
}

function webSearchQuery(locality: string, region: string | undefined, country: string): string {
  const area = region && normalise(region) !== normalise(locality) ? ` ${region}` : '';
  return `"${locality}"${area} ${country} heritage trail town trail self-guided walk walking route`;
}

function parseDuckDuckGoResults(html: string): WebTrailCandidate[] {
  const matches = [...html.matchAll(/class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set<string>();
  return matches.flatMap<WebTrailCandidate>((match) => {
    const url = unwrapDuckDuckGoUrl(match[1] ?? '');
    const title = decodeHtml(match[2] ?? '');
    if (!url || !title) return [];
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '').toLocaleLowerCase('en-GB');
    if (/reddit\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com/.test(domain)) return [];
    if (!/trail|walk|walking|route|footpath|circuit|heritage/i.test(`${title} ${parsed.pathname}`)) return [];
    const canonical = canonicalUrl(url);
    if (seen.has(canonical)) return [];
    seen.add(canonical);
    return [{ title, url, domain, sourceTier: sourceTier(domain) }];
  }).slice(0, 8);
}

function parseBraveResults(html: string): WebTrailCandidate[] {
  const matches = [
    ...html.matchAll(
      /<a[^>]+href="(https?:\/\/[^"#]+)"[^>]+class="[^"]*\bl1\b[^"]*"[^>]*>[\s\S]*?<div class="title[^"]*"[^>]*>([\s\S]*?)<\/div><\/a>/gi,
    ),
  ];
  const seen = new Set<string>();
  return matches.flatMap<WebTrailCandidate>((match) => {
    const url = decodeHtml(match[1] ?? '');
    const title = decodeHtml(match[2] ?? '');
    if (!url || !title) return [];
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '').toLocaleLowerCase('en-GB');
    if (/reddit\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com/.test(domain)) return [];
    if (!/trail|walk|walking|route|footpath|circuit|heritage/i.test(`${title} ${parsed.pathname}`)) return [];
    const canonical = canonicalUrl(url);
    if (seen.has(canonical)) return [];
    seen.add(canonical);
    return [{ title, url, domain, sourceTier: sourceTier(domain) }];
  }).slice(0, 8);
}

async function readWebSearchCache(): Promise<WebSearchCache> {
  try {
    const parsed = JSON.parse(await readFile(webSearchCachePath, 'utf8')) as WebSearchCache;
    return parsed.schemaVersion === 2 && parsed.searches ? parsed : { schemaVersion: 2, searches: {} };
  } catch {
    return { schemaVersion: 2, searches: {} };
  }
}

function sameQueries(left: string[] | undefined, right: string[]): boolean {
  return Boolean(left) && left!.length === right.length && left!.every((query, index) => query === right[index]);
}

function uniqueWebCandidates(candidates: WebTrailCandidate[]): WebTrailCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const url = canonicalUrl(candidate.url);
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function webCandidateMatchesTown(candidate: WebTrailCandidate, locality: string): boolean {
  let pathname = '';
  try {
    pathname = decodeURIComponent(new URL(candidate.url).pathname);
  } catch {
    pathname = candidate.url;
  }
  const searchable = normalise(`${candidate.title} ${pathname}`);
  return townAliases(locality).some((alias) => searchable.includes(alias));
}

async function searchWeb(query: string): Promise<WebTrailCandidate[]> {
  let lastError: unknown;
  const providers = [
    {
      name: 'Brave Search',
      url: `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`,
      parser: parseBraveResults,
    },
    {
      name: 'DuckDuckGo',
      url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      parser: parseDuckDuckGoResults,
    },
  ];
  for (const provider of providers) {
    try {
      const response = await fetch(provider.url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36 TownscapeGuides/1.0',
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`${provider.name} HTTP ${response.status}`);
      const html = await response.text();
      const results = provider.parser(html);
      const hasSearchResults =
        provider.name === 'Brave Search'
          ? /class="[^"]*\bl1\b[^"]*"/.test(html)
          : html.includes('result__a');
      if (!hasSearchResults) throw new Error(`${provider.name} returned no search-result links`);
      return results;
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function mapWithConcurrency<T, U>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<U>,
): Promise<U[]> {
  const output = new Array<U>(values.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await worker(values[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, runWorker));
  return output;
}

async function auditTownWebSearches(): Promise<Map<string, WebSearchRecord>> {
  const cache = await readWebSearchCache();
  if (!searchWebRequested) {
    return new Map(
      publishedProjectPackages.flatMap((pkg) => {
        const query = webSearchQuery(pkg.project.locality, pkg.project.region, pkg.project.country);
        const queries = widerWebQueries(pkg.project.locality, pkg.project.region, pkg.project.country);
        const cached = cache.searches[pkg.project.id];
        return cached?.query === query
          && sameQueries(cached.queries, queries)
          && (cached.status === 'completed' || cached.status === 'partial')
          ? [[pkg.project.id, cached] as const]
          : [];
      }),
    );
  }

  const targetPackages = requestedProjectIds.size > 0
    ? publishedProjectPackages.filter((pkg) => requestedProjectIds.has(pkg.project.id))
    : batchSize > 0
      ? publishedProjectPackages.slice(batchStart, batchStart + batchSize)
      : [];
  if (targetPackages.length === 0) {
    throw new Error(
      'Controlled web research requires --projects=id-one,id-two or --batch-start=N --batch-size=N. Keep batches small enough to inspect.',
    );
  }
  const unknownProjectIds = [...requestedProjectIds].filter(
    (projectId) => !publishedProjectPackages.some((pkg) => pkg.project.id === projectId),
  );
  if (unknownProjectIds.length > 0) throw new Error(`Unknown project ids: ${unknownProjectIds.join(', ')}`);

  await mkdir(resolve('data/cache'), { recursive: true });
  let completed = 0;
  const records = await mapWithConcurrency(targetPackages, webSearchConcurrency, async (pkg) => {
    const query = webSearchQuery(pkg.project.locality, pkg.project.region, pkg.project.country);
    const queries = widerWebQueries(pkg.project.locality, pkg.project.region, pkg.project.country);
    const cached = cache.searches[pkg.project.id];
    if (
      !refreshWebSearch
      && cached?.query === query
      && sameQueries(cached.queries, queries)
      && cached.status === 'completed'
    ) {
      completed += 1;
      return [pkg.project.id, cached] as const;
    }
    const queryResults: WebSearchRecord['queryResults'] = [];
    for (const targetedQuery of queries) {
      try {
        queryResults.push({
          query: targetedQuery,
          status: 'completed',
          results: await searchWeb(targetedQuery),
        });
      } catch (error) {
        queryResults.push({
          query: targetedQuery,
          status: 'failed',
          results: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
    }
    const completedQueries = queryResults.filter((result) => result.status === 'completed').length;
    const status: WebSearchRecord['status'] = completedQueries === queries.length
      ? 'completed'
      : completedQueries > 0
        ? 'partial'
        : 'failed';
    const record: WebSearchRecord = {
      searchedAt: reviewedAt,
      query,
      queries,
      status,
      results: uniqueWebCandidates(queryResults.flatMap((result) => result.results)),
      queryResults,
      ...(status === 'failed' ? { error: 'All targeted wider-web searches failed.' } : {}),
    };
    cache.searches[pkg.project.id] = record;
    completed += 1;
    if (completed % 5 === 0) {
      await writeFile(webSearchCachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
      console.log(`Trail web searches: ${completed}/${targetPackages.length}`);
    }
    return [pkg.project.id, record] as const;
  });
  await writeFile(webSearchCachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
  const result = new Map<string, WebSearchRecord>();
  for (const pkg of publishedProjectPackages) {
    const query = webSearchQuery(pkg.project.locality, pkg.project.region, pkg.project.country);
    const queries = widerWebQueries(pkg.project.locality, pkg.project.region, pkg.project.country);
    const cached = cache.searches[pkg.project.id];
    if (
      cached?.query === query
      && sameQueries(cached.queries, queries)
      && (cached.status === 'completed' || cached.status === 'partial')
    ) {
      result.set(pkg.project.id, cached);
    }
  }
  for (const [projectId, record] of records) result.set(projectId, record);
  return result;
}

const [{ products, pages }, webSearchByProjectId, verifiedSourceRegistry] = await Promise.all([
  fetchCatalogue(),
  auditTownWebSearches(),
  readFile(verifiedSourceRegistryPath, 'utf8').then(
    (value) => JSON.parse(value) as VerifiedTrailSourceRegistry,
  ),
]);
const verifiedSourcesByProjectId = new Map<string, VerifiedTrailSource[]>();
for (const trail of verifiedSourceRegistry.trails) {
  const existing = verifiedSourcesByProjectId.get(trail.projectId) ?? [];
  existing.push(trail);
  verifiedSourcesByProjectId.set(trail.projectId, existing);
}
const packagesSharingLocality = new Map<string, number>();
for (const pkg of publishedProjectPackages) {
  const key = normalise(pkg.project.locality);
  packagesSharingLocality.set(key, (packagesSharingLocality.get(key) ?? 0) + 1);
}

const towns = publishedProjectPackages
  .map((pkg) => {
    const aliases = townAliases(pkg.project.locality);
    const duplicateLocality = (packagesSharingLocality.get(normalise(pkg.project.locality)) ?? 0) > 1;
    const curatedTrailIds = publishedPlannerCurationForProject(pkg.project.id).trails ?? [];
    const verifiedSources = (verifiedSourcesByProjectId.get(pkg.project.id) ?? []).map((source) => ({
      ...source,
      alreadyCurated: curatedTrailIds.includes(source.featureId),
    }));
    const curatedUrls = new Set(
      curatedTrailIds.flatMap((featureId) => {
        const feature = pkg.features.find((candidate) => candidate.id === featureId);
        return feature?.sourceRecords.flatMap((source) =>
          source.sourceUrl ? [canonicalUrl(source.sourceUrl)] : []
        ) ?? [];
      }),
    );

    const candidates = products.flatMap<TrailCandidate>((product) => {
      const parts = productTownParts(product.title);
      const matchingParts = parts.filter((part) => aliases.includes(part));
      if (matchingParts.length === 0) return [];

      const location = tagValue(product, 'Location :');
      if (!providerLocationMatchesRegion(location, pkg.project.region)) return [];
      if (duplicateLocality && !location) return [];

      const url = `https://www.treasuretrails.co.uk/products/${product.handle}`;
      return [
        {
          provider: 'Treasure Trails',
          title: product.title,
          url,
          productId: product.id,
          location,
          trailType: tagValue(product, 'Trail Type :'),
          duration: tagValue(product, 'Getting Around :'),
          accessibility: accessibilityTags(product),
          price: product.variants?.[0]?.price,
          matchKind: parts.length === 1 ? 'exact_town_title' : 'multi_place_title',
          alreadyCurated: curatedUrls.has(canonicalUrl(url)),
        },
      ];
    });

    const exactCandidates = candidates.filter((candidate) => candidate.matchKind === 'exact_town_title');
    const multiPlaceCandidates = candidates.filter(
      (candidate) => candidate.matchKind === 'multi_place_title',
    );
    const alreadyCurated = candidates.filter((candidate) => candidate.alreadyCurated);
    const webSearch = webSearchByProjectId.get(pkg.project.id) ?? {
      searchedAt: null,
      query: webSearchQuery(pkg.project.locality, pkg.project.region, pkg.project.country),
      status: 'not_run' as const,
      results: [],
      queries: widerWebQueries(pkg.project.locality, pkg.project.region, pkg.project.country),
      queryResults: [],
    };
    const webCandidates = webSearch.results.filter(
      (candidate) =>
        !candidate.domain.includes('treasuretrails.co.uk')
        && webCandidateMatchesTown(candidate, pkg.project.locality),
    );
    let status:
      | 'already_curated'
      | 'verified_source_requires_curation'
      | 'catalogue_match_requires_boundary_review'
      | 'multi_place_match_requires_scope_review'
      | 'web_candidates_require_boundary_review'
      | 'no_online_match_found'
      | 'online_search_incomplete'
      | 'online_search_failed'
      | 'wider_web_search_not_run';
    const uncuratedVerifiedSources = verifiedSources.filter((source) => !source.alreadyCurated);
    if (
      verifiedSources.length > 0
      && uncuratedVerifiedSources.length === 0
      && candidates.every((candidate) => candidate.alreadyCurated)
    ) {
      status = 'already_curated';
    } else if (uncuratedVerifiedSources.length > 0) {
      status = 'verified_source_requires_curation';
    } else if (alreadyCurated.length > 0 && alreadyCurated.length === candidates.length) {
      status = 'already_curated';
    } else if (exactCandidates.some((candidate) => !candidate.alreadyCurated)) {
      status = 'catalogue_match_requires_boundary_review';
    } else if (multiPlaceCandidates.length > 0) {
      status = 'multi_place_match_requires_scope_review';
    } else if (webCandidates.length > 0) {
      status = 'web_candidates_require_boundary_review';
    } else if (webSearch.status === 'failed') {
      status = 'online_search_failed';
    } else if (webSearch.status === 'partial') {
      status = 'online_search_incomplete';
    } else if (webSearch.status === 'not_run') {
      status = 'wider_web_search_not_run';
    } else {
      status = 'no_online_match_found';
    }

    return {
      projectId: pkg.project.id,
      locality: pkg.project.locality,
      region: pkg.project.region ?? '',
      country: pkg.project.country,
      townRating: pkg.project.touristAppeal?.rating ?? 0,
      curatedTrailCount: curatedTrailIds.length,
      status,
      candidates,
      verifiedSources,
      webSearch: { ...webSearch, results: webCandidates },
      widerWebQueries: widerWebQueries(
        pkg.project.locality,
        pkg.project.region,
        pkg.project.country,
      ),
    };
  })
  .sort((left, right) =>
    left.country.localeCompare(right.country) ||
    left.region.localeCompare(right.region) ||
    left.locality.localeCompare(right.locality),
  );

const curatedTrailSourceSummary = publishedProjectPackages.reduce(
  (summary, pkg) => {
    const curatedTrailIds = publishedPlannerCurationForProject(pkg.project.id).trails ?? [];
    for (const featureId of curatedTrailIds) {
      const feature = pkg.features.find((candidate) => candidate.id === featureId);
      if (!feature) {
        summary.unresolved += 1;
        continue;
      }

      const sourceText = normalise(
        feature.sourceRecords
          .flatMap((source) => [source.sourceName, source.sourceUrl])
          .filter(Boolean)
          .join(' '),
      );
      summary.total += 1;
      if (sourceText.includes('treasuretrails co uk') || sourceText.includes('treasure trails')) {
        summary.treasureTrails += 1;
      } else if (
        sourceText.includes('openstreetmap org')
        || sourceText.includes('openstreetmap contributors')
      ) {
        summary.openStreetMapOnly += 1;
      } else if (sourceText) {
        summary.officialCivicOrWalkingProvider += 1;
      } else {
        summary.missingSource += 1;
      }
    }
    return summary;
  },
  {
    total: 0,
    treasureTrails: 0,
    officialCivicOrWalkingProvider: 0,
    openStreetMapOnly: 0,
    missingSource: 0,
    unresolved: 0,
  },
);

const summary = {
  townCount: towns.length,
  catalogueProductsChecked: products.length,
  cataloguePagesChecked: pages.length,
  townsWithCatalogueCandidates: towns.filter((town) => town.candidates.length > 0).length,
  catalogueCandidates: towns.reduce((sum, town) => sum + town.candidates.length, 0),
  alreadyCuratedCandidates: towns.reduce(
    (sum, town) => sum + town.candidates.filter((candidate) => candidate.alreadyCurated).length,
    0,
  ),
  townsRequiringBoundaryReview: towns.filter(
    (town) => town.status === 'catalogue_match_requires_boundary_review',
  ).length,
  townsRequiringScopeReview: towns.filter(
    (town) => town.status === 'multi_place_match_requires_scope_review',
  ).length,
  townsRequiringWiderWebSearch: towns.filter(
    (town) =>
      town.status === 'no_online_match_found'
      || town.status === 'online_search_incomplete'
      || town.status === 'online_search_failed'
      || town.status === 'wider_web_search_not_run',
  ).length,
  townsWithVerifiedNonTreasureSources: towns.filter((town) =>
    town.verifiedSources.some((source) => source.provider !== 'Treasure Trails')
  ).length,
  webSearchesCompleted: towns.filter((town) => town.webSearch.status === 'completed').length,
  webSearchesPartial: towns.filter((town) => town.webSearch.status === 'partial').length,
  webSearchesFailed: towns.filter((town) => town.webSearch.status === 'failed').length,
  webSearchesNotRun: towns.filter((town) => town.webSearch.status === 'not_run').length,
  townsWithWebCandidates: towns.filter((town) => town.webSearch.results.length > 0).length,
  verifiedNonTreasureSources: towns.reduce(
    (sum, town) => sum + town.verifiedSources.filter((source) => source.provider !== 'Treasure Trails').length,
    0,
  ),
  curatedTrailSources: curatedTrailSourceSummary,
};

const report = {
  schemaVersion: 3,
  reviewedAt,
  purpose:
    'Multi-source trail discovery for every published town: full Treasure Trails catalogue matching, verified council and heritage route sources, and explicitly recorded controlled wider-web research. A discovery match is evidence for manual review, not proof that its route is contained by the active visitor polygon.',
  policy: {
    publication:
      'Publish only a genuine visitor route with a responsible external link, a defensible trail score and a manually confirmed in-boundary route.',
    noMatch:
      'No provider match never means no trail exists. Complete every recorded source class: council, destination organisation, civic or heritage body, established walking provider and commercial puzzle-trail provider.',
    multiPlace:
      'Multi-place routes require explicit scope review and normally remain outside an individual town planner.',
  },
  catalogue: {
    provider: 'Treasure Trails',
    endpoint: catalogueEndpoint,
    pages,
    productCount: products.length,
  },
  verifiedSourceRegistry: {
    path: 'data/trail-source-registry.json',
    routeCount: verifiedSourceRegistry.trails.length,
    providers: [...new Set(verifiedSourceRegistry.trails.map((trail) => trail.provider))].sort(),
  },
  webSearch: {
    provider: 'Brave Search HTML with DuckDuckGo HTML fallback',
    method:
      'Controlled place-specific research batches separately query heritage trails, town trails, self-guided walks, council and civic-society heritage walks, established walking providers, commercial puzzle trails and country-specific official sources. Results are discovery evidence only; partial and not_run remain explicit.',
    cachePath: 'data/cache/online-town-trail-search-cache.json',
  },
  summary,
  towns,
};

const researchQueue = {
  schemaVersion: 2,
  reviewedAt,
  policy: report.policy,
  total: towns.filter((town) => town.status !== 'already_curated').length,
  towns: towns
    .filter((town) => town.status !== 'already_curated')
    .map((town) => ({
      projectId: town.projectId,
      locality: town.locality,
      region: town.region,
      country: town.country,
      townRating: town.townRating,
      curatedTrailCount: town.curatedTrailCount,
      priority:
        town.curatedTrailCount === 0 && town.townRating >= 2
          ? 'urgent_rated_town_without_trail'
          : town.curatedTrailCount === 0 && town.townRating === 1
            ? 'high_rated_town_without_trail'
            : town.candidates.length > 0 || town.webSearch.results.length > 0
              ? 'candidate_review'
              : 'routine_research',
      status: town.status,
      catalogueCandidates: town.candidates,
      verifiedSources: town.verifiedSources,
      webCandidates: town.webSearch.results,
      webSearchStatus: town.webSearch.status,
      webSearchQuery: town.webSearch.query,
      widerWebQueries: town.widerWebQueries,
      requiredSourceClasses: [
        'official council or local authority',
        'destination or tourism organisation',
        'civic society, heritage body or local history group',
        'established walking or access provider',
        'commercial puzzle-trail provider',
      ],
      requiredDecision:
        town.candidates.length > 0 || town.webSearch.results.length > 0
          ? 'Open each discovered route, prefer official or responsible sources, and check the full route against the active visitor polygon before scoring or curating it.'
          : 'No online candidate was found by the automated searches. Manually check the listed queries and official local visitor sources before recording a reviewed no-trail outcome.',
    }))
    .sort((left, right) => {
      const priorityRank: Record<string, number> = {
        urgent_rated_town_without_trail: 0,
        high_rated_town_without_trail: 1,
        candidate_review: 2,
        routine_research: 3,
      } as const;
      return priorityRank[left.priority] - priorityRank[right.priority]
        || right.townRating - left.townRating
        || left.country.localeCompare(right.country)
        || left.region.localeCompare(right.region)
        || left.locality.localeCompare(right.locality);
    }),
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(queuePath, `${JSON.stringify(researchQueue, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
console.log(reportPath);
console.log(queuePath);
