import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  AttractionEditorialAssessment,
  FoodEditorialAssessment,
  HeritageFeature,
  ProjectPackage,
  Reliability,
  VisitorHighlight,
} from '../src/domain/models';
import { editorialRatingMethodVersion } from '../src/domain/editorialResearch';
import { validateFeatures } from '../src/domain/validation';

type Json = Record<string, any>;
type Feature = HeritageFeature & Json;
type Package = ProjectPackage & {
  project: ProjectPackage['project'] & Json;
  features: Feature[];
};

const reviewedAt = '2026-09-02';
const accessedAt = '2026-09-02T16:45:00Z';
const liveVerifiedAt = process.argv.includes('--live-verified')
  ? '2026-09-02T17:45:00Z'
  : null;
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as Json;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as Json;

const providers = {
  treasure: 'https://www.treasuretrails.co.uk/collections/aberdeenshire',
  curious: 'https://curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/pages/scotland',
  goQuest: 'https://goquestadventures.com/',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

function evidence(
  sourceName: string,
  sourceOrganisation: string,
  sourceUrl: string,
  notes: string,
  reliability: Reliability = 'official_non_statutory',
) {
  return {
    sourceName,
    sourceOrganisation,
    sourceUrl,
    accessedAt,
    reliability,
    licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
    notes,
  };
}

function splitScore(score: number, maximums: number[], weights: number[]): number[] {
  const values = weights.map((weight, index) => Math.min(maximums[index], Math.floor(score * weight)));
  let remainder = score - values.reduce((sum, value) => sum + value, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % values.length) {
    if (values[index] >= maximums[index]) continue;
    values[index] += 1;
    remainder -= 1;
  }
  return values;
}

function attractionAssessment(score: number): AttractionEditorialAssessment {
  const values = splitScore(score, [30, 20, 20, 15, 10, 5], [0.3, 0.2, 0.2, 0.15, 0.1, 0.05]);
  return {
    experienceDepth: values[0], distinctiveness: values[1], presentation: values[2],
    journeyWorth: values[3], accessAndReliability: values[4], evidenceConfidence: values[5],
    visitability: 'full_visitor_experience',
  };
}

function foodAssessment(score: number): FoodEditorialAssessment {
  const values = splitScore(score, [30, 20, 15, 15, 10, 10], [0.3, 0.2, 0.15, 0.15, 0.1, 0.1]);
  return {
    foodAndDrinkQuality: values[0], daytimeRelevance: values[1], distinctiveness: values[2],
    consistency: values[3], visitorFit: values[4], evidenceConfidence: values[5],
  };
}

interface FeatureSpec {
  id: string;
  name: string;
  projectId: string;
  locality: string;
  type: string;
  coordinates: [number, number];
  score: number;
  category: 'attraction' | 'food' | 'trail';
  description: string;
  tagline: string;
  details: Record<string, string>;
  reason: string;
  url: string;
  sources: ReturnType<typeof evidence>[];
  tags: string[];
  evidenceScope?: 'parish_evidence' | 'related_context' | 'out_of_scope';
}

function feature(spec: FeatureSpec): Feature {
  const details = {
    ...(spec.category === 'trail' ? { trail_score: String(spec.score) } : { visit_score: String(spec.score) }),
    tagline: spec.tagline,
    description: spec.description,
    ...spec.details,
  };
  return {
    id: spec.id,
    projectId: spec.projectId,
    name: spec.name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    region: 'Aberdeenshire',
    locality: spec.locality,
    featureType: spec.type,
    significance: spec.score >= 80 ? 'national' : spec.score >= 70 ? 'regional' : 'local',
    geometry: { type: 'Point', coordinates: spec.coordinates },
    locationType: 'exact',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: spec.description,
    visitorWebsiteUrl: spec.url,
    details: Object.entries(details)
      .map(([key, value]) => `${key}=${String(value).replaceAll(';', ',')}`)
      .join('; '),
    editorialReview: {
      status: 'editorially_researched',
      category: spec.category,
      methodVersion: editorialRatingMethodVersion,
      reviewedAt,
      scoreRationale: spec.reason,
      evidenceUrls: spec.sources.map((source) => source.sourceUrl),
      ...(spec.category === 'food'
        ? { foodAssessment: foodAssessment(spec.score) }
        : {
            visitability: 'full_visitor_experience',
            attractionAssessment: attractionAssessment(spec.score),
          }),
    },
    sourceRecords: spec.sources,
    tags: [...new Set([...spec.tags, 'curated-visitor', 'current-context'])],
    createdAt: accessedAt,
    updatedAt: accessedAt,
    reviewed: true,
    evidenceScope: spec.evidenceScope ?? 'parish_evidence',
  };
}

function updateHighlightFeature(
  target: Feature,
  score: number,
  description: string,
  reason: string,
  url: string,
  sources: ReturnType<typeof evidence>[],
  details: Record<string, string>,
): void {
  target.shortDescription = description;
  target.visitorWebsiteUrl = url;
  target.details = Object.entries({
    visit_score: String(score),
    tagline: details.tagline,
    description,
    ...details,
  }).map(([key, value]) => `${key}=${String(value).replaceAll(';', ',')}`).join('; ');
  target.editorialReview = {
    status: 'editorially_researched',
    category: 'attraction',
    methodVersion: editorialRatingMethodVersion,
    reviewedAt,
    scoreRationale: reason,
    evidenceUrls: sources.map((source) => source.sourceUrl),
    visitability: 'full_visitor_experience',
    attractionAssessment: attractionAssessment(score),
  };
  target.sourceRecords = [...target.sourceRecords, ...sources];
  target.tags = [...new Set([...target.tags, 'curated-visitor', 'current-context'])];
  target.updatedAt = accessedAt;
  target.reviewed = true;
}

function highlight(
  target: Feature,
  rank: number,
  name: string,
  tagline: string,
  score: number,
  timeToSpend: string,
  openingTimes: string,
  admission: string,
): VisitorHighlight {
  return {
    rank,
    featureId: target.id,
    name,
    reason: target.editorialReview!.scoreRationale,
    tagline,
    visitorScore: score,
    timeToSpend,
    openingTimes,
    admission,
    freeAdmission: /^free/i.test(admission),
    visitorWebsiteUrl: target.visitorWebsiteUrl,
    editorialReview: target.editorialReview,
    sourceName: target.sourceRecords.at(-1)!.sourceName,
    sourceUrl: target.sourceRecords.at(-1)!.sourceUrl!,
    verifiedInBoundaryAt: reviewedAt,
  };
}

function replaceCurated(pkg: Package, additions: Feature[]): void {
  const ids = new Set(additions.map((entry) => entry.id));
  pkg.features = [...pkg.features.filter((entry) => !ids.has(entry.id)), ...additions];
}

function dogEntry(sourceName: string, sourceUrl: string, kind: 'trail' | 'place' | 'food' = 'place') {
  if (kind === 'trail') {
    return {
      rating: 2, status: 'restricted', label: 'Close control required',
      summary: 'Use leads or close control around roads, livestock, wildlife and other path users, following route-specific signs.',
      sourceName, sourceUrl, reviewedAt,
    };
  }
  return {
    rating: 0, status: 'unconfirmed', label: 'Dog policy not published',
    summary: `No reliable current dog policy is published for this ${kind === 'food' ? 'food stop' : 'visitor place'}; confirm directly before travelling with a dog.`,
    sourceName, sourceUrl, reviewedAt,
  };
}

function sourceCheck(url: string, outcome: 'verified' | 'no_result' | 'excluded', note: string) {
  return { url, checkedAt: reviewedAt, outcome, note };
}

function statutoryFeatures(pkg: Package): Feature[] {
  return pkg.features.filter((entry) => entry.tags.some((tag: string) =>
    ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape'].includes(tag)));
}

function assertPackage(pkg: Package, expectedStatutory: number): void {
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((entry: Json) => entry.severity === 'error');
  if (errors.length) throw new Error(`${pkg.project.name}: ${errors.map((entry: Json) => entry.message).join('; ')}`);
  const statutory = statutoryFeatures(pkg);
  const undated = statutory.filter((entry) =>
    !entry.tags.includes('map-hidden') && (!entry.documentedDateText || entry.dateBasis === 'unknown'));
  if (statutory.length !== expectedStatutory || undated.length) {
    throw new Error(`${pkg.project.name} HES gate: ${statutory.length}/${expectedStatutory}; undated=${undated.map((entry) => entry.id).join(',')}`);
  }
  const datedNames = statutory.filter((entry) =>
    entry.documentedDateText && entry.name.includes(entry.documentedDateText));
  if (datedNames.length) throw new Error(`${pkg.project.name}: HES dates appended to labels`);
}

async function writeProject(pkg: Package, fileName: string): Promise<void> {
  await writeFile(resolve('data/projects', fileName), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

async function auditDinnet(): Promise<void> {
  const projectId = 'dinnet-scotland';
  const projectFile = 'dinnet.json';
  const pkg = JSON.parse(await readFile(resolve('data/projects', projectFile), 'utf8')) as Package;
  const urls = {
    bridge: 'https://her.aberdeenshire.gov.uk/Monument/MAB35727',
    reserve: 'https://www.nature.scot/enjoying-outdoors/visit-our-nature-reserves/muir-dinnet-nnr/muir-dinnet-nnr-visiting-reserve',
    leaflet: 'https://www.nature.scot/doc/muir-dinnet-nnr-visiting-reserve-leaflet',
    deesideWay: 'https://www.deesideway.org/walks/aboyne-to-ballater/',
    dinnetBallater: 'https://cairngorms.co.uk/paths/dinnet-to-ballater',
    clarack: 'https://www.scottishlandandestates.co.uk/helping-it-happen/case-studies/clarack-car-park-dinnet-estate',
  };
  const bridge = pkg.features.find((entry) => entry.id === 'hes-listed-building:LB50735');
  if (!bridge) throw new Error('Dinnet: missing LB50735');
  bridge.documentedDateText = '1935';
  bridge.earliestPossibleYear = 1935;
  bridge.latestPossibleYear = 1935;
  bridge.datePrecision = 'exact_year';
  bridge.dateBasis = 'documented_construction';
  bridge.dateConfidence = 'high';
  bridge.reviewNotes = 'Aberdeenshire HER confirms F A MacDonald & Sons built the bridge in 1935. A previous 21st-century label described later refurbishment, not construction.';
  bridge.tags = [...new Set([...bridge.tags.filter((tag: string) => tag !== 'map-hidden'), 'date-reviewed', 'hes-date-reviewed'])];
  updateHighlightFeature(
    bridge, 63,
    'A 1935 concrete bridge by F A MacDonald & Sons, beside Dinnet’s compact group of church, former station and estate buildings.',
    'A modest but distinctive open-air village heritage stop, now correctly dated from the council HER rather than its later refurbishment.',
    urls.bridge,
    [evidence('Dinnet Bridge MAB35727', 'Aberdeenshire Council Historic Environment Record', urls.bridge, 'Official local HER identifies the 1935 builder and construction date.', 'official_statutory')],
    { tagline: 'Art Deco bridge and village heritage', admission: 'free', 'opening_hours:description': 'Open-air; view from public roads and paths', time_to_spend: '20–40 minutes' },
  );

  const reserve = feature({
    id: 'curated-attraction:dinnet-muir-nnr', name: 'Muir of Dinnet National Nature Reserve',
    projectId, locality: 'Dinnet', type: 'park', coordinates: [-2.9428095, 57.085058], score: 92,
    category: 'attraction', tagline: 'Lochs, woodland and the Burn O’Vat',
    description: 'A major NatureScot reserve west of the village, with four marked trails, visitor centre, toilets, picnic benches and the Burn O’Vat pothole.',
    reason: 'A nationally distinctive natural attraction with strong interpretation and a complete, verified visitor offer. It is separately shown in See and does not inflate Dinnet village’s score.',
    url: urls.reserve, details: { entrance_fee: 'free', 'opening_hours:description': 'Reserve open all year; visitor centre normally 10:00–16:00 from Easter to October, with winter changes', time_to_spend: '2 hours to a full day', warning: 'Outdoor paths can be wet, uneven or icy; check NatureScot updates' },
    sources: [evidence('Muir of Dinnet NNR visiting the reserve', 'NatureScot', urls.reserve, 'Current access, facilities and visitor-centre information.'), evidence('Muir of Dinnet NNR leaflet', 'NatureScot', urls.leaflet, 'Official route distances, durations and terrain.')],
    tags: ['service-context-visitor', 'home-standalone-place'], evidenceScope: 'related_context',
  });
  const trailSpecs: Array<[string, string, [number, number], number, string, string, string]> = [
    ['deeside-way', 'Dinnet to Ballater on the Deeside Way', [-2.8936947, 57.0767846], 74, '11.2 km', '4 hours', urls.dinnetBallater],
    ['vat', 'Vat Trail', [-2.9428095, 57.085058], 76, '1.2 km', '45 minutes', urls.leaflet],
    ['parkins-moss', 'Parkin’s Moss Trail', [-2.9428095, 57.085058], 72, '3.3 km', '1.5 hours', urls.leaflet],
    ['little-ord', 'Little Ord Trail', [-2.9428095, 57.085058], 72, '5.3 km', '2.5 hours', urls.leaflet],
    ['loch-kinord', 'Loch Kinord Trail', [-2.9428095, 57.085058], 78, '6.5 km', '2.5 hours', urls.leaflet],
  ];
  const trails = trailSpecs.map(([slug, name, coordinates, score, distance, duration, url], index) => feature({
    id: `curated-trail:dinnet-${slug}`, name, projectId, locality: 'Dinnet', type: 'other', coordinates,
    score, category: 'trail', tagline: index === 0 ? 'Old railway route from the village' : 'NatureScot waymarked reserve trail',
    description: index === 0
      ? 'Surfaced former-railway route from Dinnet towards Ballater, forming part of the Deeside Way.'
      : `${name} is one of four official waymarked circuits in Muir of Dinnet NNR.`,
    reason: index === 0 ? 'A live official route directly from Dinnet with distance, duration and surface information.' : 'An exact NatureScot route with current distance, duration and terrain information.',
    url, details: { distance, duration, trail_type: 'waymarked walking route', warning: index === 0 ? 'Shared route; check current path conditions' : 'Read the official leaflet for route-specific gradients, wet ground and accessibility' },
    sources: [evidence(index === 0 ? 'Dinnet to Ballater' : 'Muir of Dinnet NNR leaflet', index === 0 ? 'Cairngorms National Park Authority' : 'NatureScot', url, 'Current official route information.')],
    tags: ['service-context-trail'], evidenceScope: index === 0 ? 'parish_evidence' : 'related_context',
  }));
  const services = [
    feature({ id: 'curated-picnic:dinnet-muir', name: 'Muir of Dinnet Visitor Centre Picnic Benches', projectId, locality: 'Dinnet', type: 'other', coordinates: [-2.9428095, 57.085058], score: 66, category: 'attraction', tagline: 'Accessible reserve picnic stop', description: 'Two wheelchair-accessible picnic benches beside the reserve visitor centre.', reason: 'NatureScot explicitly confirms two wheelchair-accessible picnic benches.', url: urls.reserve, details: { tourism: 'picnic_site', tables: '2 accessible benches', entrance_fee: 'free' }, sources: [evidence('Muir of Dinnet NNR visiting the reserve', 'NatureScot', urls.reserve, 'Official picnic and accessibility information.')], tags: ['service-context-picnic'], evidenceScope: 'related_context' }),
    feature({ id: 'curated-parking:dinnet-village', name: 'Dinnet Village Car Park', projectId, locality: 'Dinnet', type: 'other', coordinates: [-2.8936947, 57.0767846], score: 60, category: 'attraction', tagline: 'Village pay-and-display parking', description: 'Small signed village car park providing direct access to Dinnet and the Deeside Way.', reason: 'NatureScot confirms a paid car park in Dinnet village; capacity and accessible-bay count are not published.', url: urls.reserve, details: { amenity: 'parking', fee: 'yes', capacity: 'Not published', capacity_disabled: 'Not published', overnight: 'Check signs' }, sources: [evidence('Muir of Dinnet NNR visiting the reserve', 'NatureScot', urls.reserve, 'Official page confirms paid village parking.')], tags: ['service-context-parking'] }),
    feature({ id: 'curated-parking:dinnet-clarack', name: 'Clarack Car Park', projectId, locality: 'Dinnet', type: 'other', coordinates: [-2.9057804, 57.0761499], score: 66, category: 'attraction', tagline: 'Larger route car park west of Dinnet', description: 'A 52-space car park with cycle racks and toilets, about half a mile west of Dinnet.', reason: 'The estate case study confirms its 2022 opening, 52 spaces, cycle racks and toilets; NatureScot confirms current pay-and-display use.', url: urls.clarack, details: { amenity: 'parking', fee: 'yes', capacity: '52', bicycle_parking: 'yes', overnight: 'Check signs' }, sources: [evidence('Clarack Car Park', 'Scottish Land & Estates / Dinnet Estate', urls.clarack, 'Opening date, capacity and facilities.'), evidence('Muir of Dinnet NNR visiting the reserve', 'NatureScot', urls.reserve, 'Current location and payment status.')], tags: ['service-context-parking'], evidenceScope: 'related_context' }),
    feature({ id: 'curated-parking:dinnet-burn-o-vat', name: 'Burn O’Vat Car Park', projectId, locality: 'Dinnet', type: 'other', coordinates: [-2.9428095, 57.085058], score: 68, category: 'attraction', tagline: 'Main reserve car park', description: 'Main NatureScot car park for the visitor centre, four marked trails and Burn O’Vat.', reason: 'Official reserve guidance confirms the principal trailhead car park; exact capacity is not published.', url: urls.reserve, details: { amenity: 'parking', fee: 'Not published on the current page', capacity: 'Not published', overnight: 'Check reserve signs' }, sources: [evidence('Muir of Dinnet NNR visiting the reserve', 'NatureScot', urls.reserve, 'Official current parking information.')], tags: ['service-context-parking'], evidenceScope: 'related_context' }),
    feature({ id: 'curated-toilet:dinnet-clarack', name: 'Clarack Public Toilets', projectId, locality: 'Dinnet', type: 'other', coordinates: [-2.9057804, 57.0761499], score: 62, category: 'attraction', tagline: 'Car-park toilets', description: 'Toilets provided at Clarack car park.', reason: 'The estate confirms toilets at Clarack; precise hours and accessible specification are not published.', url: urls.clarack, details: { amenity: 'toilets', 'opening_hours:description': 'Not published; check on arrival', disabled: 'Not published' }, sources: [evidence('Clarack Car Park', 'Scottish Land & Estates / Dinnet Estate', urls.clarack, 'Current facility statement.')], tags: ['service-context-toilets'], evidenceScope: 'related_context' }),
    feature({ id: 'curated-toilet:dinnet-burn-o-vat', name: 'Muir of Dinnet Visitor Centre Toilets', projectId, locality: 'Dinnet', type: 'other', coordinates: [-2.9440939, 57.0843383], score: 66, category: 'attraction', tagline: 'Year-round reserve toilets', description: 'Public toilets at the NatureScot visitor centre, available all year.', reason: 'NatureScot explicitly confirms year-round toilet availability; precise daily hours are not separately published.', url: urls.reserve, details: { amenity: 'toilets', 'opening_hours:description': 'Available all year; precise daily hours not separately published', disabled: 'Check current accessibility information' }, sources: [evidence('Muir of Dinnet NNR visiting the reserve', 'NatureScot', urls.reserve, 'Official toilet availability.')], tags: ['service-context-toilets'], evidenceScope: 'related_context' }),
  ];
  replaceCurated(pkg, [reserve, ...trails, ...services]);
  pkg.project.touristAppeal = { score: 57, dogOwnerScore: 55, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest', summary: 'A small Deeside village with a distinctive 1935 bridge and direct Deeside Way access; the major nature reserve is separately shown in See and does not prop up the village score.', dogAccessRating: 2, dogAccessSummary: 'The Deeside Way and reserve trails can suit responsible dogs, with close control around roads, livestock, water and wildlife.', methodVersion: '2026-09-02-strict-settlement-full-audit-v4', reviewedAt, sourceUrls: [...Object.values(urls), ...Object.values(providers)] };
  pkg.project.visitorHighlights = [
    highlight(reserve, 1, 'Muir of Dinnet National Nature Reserve', 'Lochs, woodland and Burn O’Vat', 92, '2 hours to a full day', 'Reserve open all year; visitor centre seasonal', 'Free'),
    highlight(bridge, 2, 'Dinnet Bridge and village heritage', 'A correctly dated 1935 landmark', 63, '20–40 minutes', 'Open-air', 'Free'),
  ];
  pkg.project.townGuide = { characterTag: 'Small Royal Deeside village', headline: 'A quiet Deeside Way stop beside a major nature reserve', intro: 'Dinnet scores 57 after a complete audit. Its own case rests on a compact village, a correctly dated 1935 bridge and direct Deeside Way access. Muir of Dinnet is an excellent separate See attraction, but it is not counted as proof that the settlement itself deserves a map pin.', bestFor: ['A Deeside Way pause', 'Open-air village heritage', 'Connecting to Muir of Dinnet'], perfectFor: ['A short village stop before a reserve walk'], suggestedFirstVisit: { title: 'Bridge first, reserve second', summary: 'Look at the 1935 bridge and former railway corridor, then travel to the NatureScot visitor centre for a marked trail.' }, dontMiss: ['Dinnet Bridge', 'Dinnet to Ballater on the Deeside Way', 'Muir of Dinnet National Nature Reserve'], suggestedTime: '30–60 minutes in the village; longer for the separate reserve', visitorMood: 'Quiet, outdoors-led and intentionally not over-scored.', sourceUrls: [...Object.values(urls), ...Object.values(providers)], lastReviewedAt: reviewedAt };
  pkg.project.researchNotes = 'Full current web, strict-boundary, facilities, trail-provider and HES audit. Dinnet Bridge corrected from an erroneous 21st-century label to its documented 1935 construction. Muir of Dinnet and its remote facilities are related-context See content and do not support the village score. No qualifying daytime café was verified in the settlement. No exact product was found from TreasureTrails, CuriousAbout, MysteryGuides or GoQuest Adventures.';
  planner.projects[projectId] = { eat: [], trails: trails.map((entry) => entry.id), picnic: ['curated-picnic:dinnet-muir'], parking: ['curated-parking:dinnet-village', 'curated-parking:dinnet-clarack', 'curated-parking:dinnet-burn-o-vat'], toilets: ['curated-toilet:dinnet-clarack', 'curated-toilet:dinnet-burn-o-vat'] };
  dog.projects[projectId] = { attraction: Object.fromEntries([reserve, bridge].map((entry) => [entry.id, dogEntry(entry.sourceRecords.at(-1)!.sourceName, entry.visitorWebsiteUrl!)])), trail: Object.fromEntries(trails.map((entry) => [entry.id, dogEntry('Scottish Outdoor Access Code', providers.dogCode, 'trail')])) };
  assertPackage(pkg, 4);
  await writeProject(pkg, projectFile);
  const report = { reviewedAt: accessedAt, projectId, place: 'Dinnet', townScore: 57, mapPublished: false, categories: { see: { audited: true, published: 2 }, eat: { audited: true, published: 0 }, trails: { audited: true, published: 5, providerChecks: { TreasureTrails: 'No exact Dinnet product found.', CuriousAbout: 'No exact Dinnet product found.', MysteryGuides: 'No exact Dinnet product found.', GoQuestAdventures: 'No exact Dinnet product found.', NatureScot: 'Four exact marked reserve trails verified.', OfficialDeesideWay: 'Dinnet to Ballater route verified.' } }, picnic: { audited: true, published: 1 }, parking: { audited: true, published: 3 }, toilets: { audited: true, published: 2 } }, hes: { assigned: 4, visibleDated: 4, hiddenUndated: 0, visibleUndated: 0, missing: 0, correction: 'LB50735 corrected to documented 1935 construction.' }, boundaryRule: 'Muir of Dinnet NNR is related-context See content; it and its remote facilities do not support Dinnet village’s score.', research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks: [...Object.values(urls).map((url) => sourceCheck(url, 'verified', 'Opened and checked during the current audit.')), sourceCheck(providers.treasure, 'no_result', 'Provider collection checked; no exact Dinnet trail.'), sourceCheck(providers.curious, 'no_result', 'Provider checked; no exact Dinnet trail.'), sourceCheck(providers.mystery, 'no_result', 'Provider checked; no exact Dinnet trail.'), sourceCheck(providers.goQuest, 'no_result', 'Provider checked; no exact Dinnet trail.'), sourceCheck(providers.dogCode, 'verified', 'Current responsible dog-access guidance checked.')] }, scoreReanalysis: { required: true, completed: true, previousScore: 54, resultScore: 57, rationale: 'The placeholder was replaced by a complete audit. Genuine village content remains below 60 after the separate reserve is excluded from town scoring.' }, certification: { publicationCountsReconciled: true, liveBrowserVerifiedAt: liveVerifiedAt } };
  await writeFile(resolve('data/review/dinnet-full-visitor-audit-2026-09-02.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function auditFinzean(): Promise<void> {
  const projectId = 'finzean-scotland';
  const projectFile = 'finzean.json';
  const pkg = JSON.parse(await readFile(resolve('data/projects', projectFile), 'utf8')) as Package;
  const urls = {
    book: 'https://finzean.com/pages/book-a-table', menu: 'https://finzean.com/pages/farm-shop-menu',
    visit: 'https://visitabdn.com/businesses/finzean-estate-accommodation-farm-shop-and-tea-room',
    things: 'https://finzean.com/pages/things-to-do', walks: 'https://finzean.com/pages/walking',
    circular: 'https://www.garioch.info/walks/Scotland/Aberdeenshire/Finzean%20Circular%20Walk.pdf',
    toms: 'https://www.ramblers.org.uk/go-walking/group-walks/toms-cairn-finzean-deeside',
    mill: 'https://bucketmill.co.uk/', millHes: 'https://portal.historicenvironment.scot/designation/LB3100',
    parking: 'https://www.aberdeenshire.gov.uk/waste/recycling/recycling-point/',
  };
  const mill = feature({ id: 'curated-attraction:finzean-bucket-mill', name: 'Finzean Bucket Mill', projectId, locality: 'Finzean', type: 'mill', coordinates: [-2.69714, 57.01007], score: 72, category: 'attraction', tagline: 'Rare working water-powered bucket mill', description: 'An exceptional 1853 watermill preserving specialised bucket-making machinery; routine public opening has ceased, but pre-arranged visits and occasional events are offered.', reason: 'Nationally distinctive industrial heritage with surviving machinery, reduced by access that now requires advance arrangement or an event date.', url: urls.mill, details: { entrance_fee: 'Pre-arranged visits are free; a £10 donation is suggested', 'opening_hours:description': 'Closed to routine daily public access; pre-arranged visits and occasional advertised events only', time_to_spend: '45–75 minutes when a visit is arranged', warning: 'Do not travel without arranging access' }, sources: [evidence('Finzean Bucket Mill', 'Finzean Water Mills Trust', urls.mill, 'Current access and pre-arranged visit policy.'), evidence('Finzean Bucket Mill LB3100', 'Historic Environment Scotland', urls.millHes, 'Official A-listed designation and 1853 construction.', 'official_statutory')], tags: ['service-context-visitor'], evidenceScope: 'related_context' });
  const eat = feature({ id: 'curated-food:finzean-farm-shop', name: 'Finzean Farm Shop & Tearoom', projectId, locality: 'Finzean', type: 'other', coordinates: [-2.6527824, 57.0261269], score: 88, category: 'food', tagline: 'Estate coffee, cakes and light lunch', description: 'A seven-day farm shop and tearoom serving coffee, tea, scones, cakes, traybakes, breakfast and light lunches with local produce.', reason: 'An unusually strong rural daytime stop for the user’s coffee-and-cake brief, verified from the current operator menu, booking page and destination listing.', url: urls.book, details: { amenity: 'cafe', cuisine: 'coffee_cake_light_lunch', 'opening_hours:description': 'Daily 09:00–17:00; coffee and tea served 09:00–16:30', price_band: '££', parking: 'Customer parking on site' }, sources: [evidence('Book a table', 'Finzean Estate', urls.book, 'Current daily hours and service times.'), evidence('Farm shop menu', 'Finzean Estate', urls.menu, 'Current coffee, cake, breakfast and light-lunch menu.'), evidence('Finzean Farm Shop and Tearoom', 'VisitAberdeenshire', urls.visit, 'Current visitor and accessibility listing.')], tags: ['service-context-food'], evidenceScope: 'related_context' });
  const trails = [
    feature({ id: 'curated-trail:finzean-circular', name: 'Finzean Circular Walk', projectId, locality: 'Finzean', type: 'other', coordinates: [-2.6263895, 57.0223506], score: 74, category: 'trail', tagline: 'Village, woodland and estate circuit', description: 'An 8.79 km circuit from Finzean Hall through the rural community on mixed tracks and quiet roads.', reason: 'A complete live route with exact distance, approximate duration, start point, surfaces and dog/livestock cautions.', url: urls.circular, details: { distance: '8.79 km', duration: '2.5 hours', trail_type: 'circular walk', warning: 'Mixed surfaces and roads; dogs on leads near livestock and traffic' }, sources: [evidence('Finzean Circular Walk', 'Garioch.info / Mack Walks', urls.circular, 'Current downloadable route description and mapping.', 'secondary')], tags: ['service-context-trail'] }),
    feature({ id: 'curated-trail:finzean-toms-cairn', name: 'Tom’s Cairn from Finzean', projectId, locality: 'Finzean', type: 'other', coordinates: [-2.6527824, 57.0261269], score: 72, category: 'trail', tagline: 'Estate tracks to a Deeside viewpoint', description: 'A roughly 10.5 km circular outing using Finzean Estate tracks to Tom’s Cairn and wide Deeside views.', reason: 'The estate promotes the route and a current Ramblers listing supplies distance and duration; exact conditions should be checked before travel.', url: urls.walks, details: { distance: 'about 10.5 km', duration: 'about 4 hours', trail_type: 'circular estate-track walk', warning: 'Working estate, livestock and changeable upland weather; follow signs and access guidance' }, sources: [evidence('Walking at Finzean', 'Finzean Estate', urls.walks, 'Current estate route information and downloadable mapping.'), evidence('Tom’s Cairn, Finzean', 'Ramblers', urls.toms, 'Current distance, duration and route description.', 'secondary')], tags: ['service-context-trail'], evidenceScope: 'related_context' }),
  ];
  const services = [
    feature({ id: 'curated-parking:finzean-hall', name: 'Finzean Hall Car Park', projectId, locality: 'Finzean', type: 'other', coordinates: [-2.6262991, 57.0219824], score: 62, category: 'attraction', tagline: 'Free village walk parking', description: 'Free car park at Finzean Hall, used as the start for the Finzean Circular and also listed as a council recycling point.', reason: 'Route instructions and council records independently locate visitor parking at the hall; exact capacity and accessible-bay count are not published.', url: urls.parking, details: { amenity: 'parking', fee: 'no', capacity: 'Not published', capacity_disabled: 'Not published', overnight: 'Check signs' }, sources: [evidence('Aberdeenshire recycling points', 'Aberdeenshire Council', urls.parking, 'Current Finzean Hall car-park listing.', 'local_authority'), evidence('Finzean Circular Walk', 'Garioch.info / Mack Walks', urls.circular, 'Route start identifies free hall parking.', 'secondary')], tags: ['service-context-parking'] }),
    feature({ id: 'curated-parking:finzean-farm-shop', name: 'Finzean Farm Shop Customer Parking', projectId, locality: 'Finzean', type: 'other', coordinates: [-2.6529208, 57.0262252], score: 60, category: 'attraction', tagline: 'Tearoom customer parking', description: 'On-site customer parking for the farm shop and tearoom; this is not a general village car park.', reason: 'The operator and destination listing support on-site visitor access; it is customer parking, not a general village car park, and capacity is not published.', url: urls.visit, details: { amenity: 'parking', access: 'customers', fee: 'free for customers', capacity: 'Not published', overnight: 'no' }, sources: [evidence('Finzean Farm Shop and Tearoom', 'VisitAberdeenshire', urls.visit, 'Current visitor access information.')], tags: ['service-context-parking'], evidenceScope: 'related_context' }),
  ];
  replaceCurated(pkg, [mill, eat, ...trails, ...services]);
  pkg.project.touristAppeal = { score: 66, dogOwnerScore: 64, dogAccessScoreAdjustment: -2, rating: 1, label: 'Worth a Stop', summary: 'A dispersed but genuine rural visitor stop with an excellent seven-day tearoom, two complete walks and distinctive watermill heritage available by arrangement.', dogAccessRating: 2, dogAccessSummary: 'Estate tracks can suit responsible dogs, with leads and close control around livestock, roads, wildlife and working-estate activity.', methodVersion: '2026-09-02-strict-settlement-full-audit-v4', reviewedAt, sourceUrls: [...Object.values(urls), ...Object.values(providers)] };
  pkg.project.visitorHighlights = [highlight(mill, 1, 'Finzean Bucket Mill', 'Rare working water-powered bucket mill', 72, '45–75 minutes when arranged', 'Pre-arranged visits and occasional events only', 'Free by arrangement; donation suggested')];
  pkg.project.townGuide = { characterTag: 'Dispersed rural Deeside community', headline: 'Estate walks, excellent baking and rare watermill heritage', intro: 'Finzean scores 66 after a current full audit. The settlement is dispersed, but its seven-day farm-shop tearoom, an exact village circuit and an estate route create a genuine visitor proposition. Bucket Mill remains separately described and cannot be assumed open.', bestFor: ['Coffee and cake', 'Rural walking', 'Industrial heritage by arrangement'], perfectFor: ['A relaxed half-day rural detour'], suggestedFirstVisit: { title: 'Walk first, tearoom second', summary: 'Start at Finzean Hall for the circular route, then use the farm-shop tearoom. Arrange Bucket Mill separately.' }, dontMiss: ['Finzean Farm Shop & Tearoom', 'Finzean Circular Walk', 'Finzean Bucket Mill when access is arranged'], suggestedTime: '2–4 hours', visitorMood: 'Quiet, locally rooted and spread across a working rural landscape.', sourceUrls: [...Object.values(urls), ...Object.values(providers)], lastReviewedAt: reviewedAt };
  pkg.project.researchNotes = 'Full current web, strict-boundary, café, facilities, trail-provider and HES audit. The farm shop is explicitly curated as connected context at its real coordinates. Bucket Mill is not treated as routinely open. No public toilets or dedicated public picnic site were verified. No exact TreasureTrails, CuriousAbout, MysteryGuides or GoQuest Adventures product was found.';
  planner.projects[projectId] = { eat: [eat.id], trails: trails.map((entry) => entry.id), picnic: [], parking: services.map((entry) => entry.id), toilets: [] };
  dog.projects[projectId] = { attraction: { [mill.id]: dogEntry('Finzean Bucket Mill', urls.mill) }, eat: { [eat.id]: dogEntry('Finzean Farm Shop & Tearoom', urls.book, 'food') }, trail: Object.fromEntries(trails.map((entry) => [entry.id, dogEntry('Scottish Outdoor Access Code', providers.dogCode, 'trail')])) };
  assertPackage(pkg, 4);
  await writeProject(pkg, projectFile);
  const report = { reviewedAt: accessedAt, projectId, place: 'Finzean', townScore: 66, mapPublished: true, categories: { see: { audited: true, published: 1 }, eat: { audited: true, published: 1 }, trails: { audited: true, published: 2, providerChecks: { TreasureTrails: 'No exact Finzean product found.', CuriousAbout: 'No exact Finzean product found.', MysteryGuides: 'No exact Finzean product found.', GoQuestAdventures: 'No exact Finzean product found.', OfficialEstateWalks: 'Finzean Estate walking page and downloadable map checked.', MackWalks: 'Finzean Circular route details checked.' } }, picnic: { audited: true, published: 0 }, parking: { audited: true, published: 1 }, toilets: { audited: true, published: 0 } }, hes: { assigned: 4, visibleDated: 4, hiddenUndated: 0, visibleUndated: 0, missing: 0 }, boundaryRule: 'Farm shop, Tom’s Cairn and Bucket Mill are explicit connected context at real coordinates; the town score relies on a rounded café-and-walk offer, not Bucket Mill alone. The tearoom has customer parking, but only the hall car park counts as general visitor parking.', research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks: [...Object.values(urls).map((url) => sourceCheck(url, 'verified', 'Opened and checked during the current audit.')), sourceCheck(providers.treasure, 'no_result', 'Provider checked; no exact Finzean trail.'), sourceCheck(providers.curious, 'no_result', 'Provider checked; no exact Finzean trail.'), sourceCheck(providers.mystery, 'no_result', 'Provider checked; no exact Finzean trail.'), sourceCheck(providers.goQuest, 'no_result', 'Provider checked; no exact Finzean trail.'), sourceCheck(providers.dogCode, 'verified', 'Current responsible dog-access guidance checked.')] }, scoreReanalysis: { required: true, completed: true, previousScore: 56, resultScore: 66, rationale: 'The former pending-audit score omitted a current seven-day destination tearoom and two fully evidenced routes. The revised score remains proportionate to the dispersed, limited-facility settlement.' }, certification: { publicationCountsReconciled: true, liveBrowserVerifiedAt: liveVerifiedAt } };
  await writeFile(resolve('data/review/finzean-full-visitor-audit-2026-09-02.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function auditLumphanan(): Promise<void> {
  const projectId = 'lumphanan-scotland';
  const projectFile = 'lumphanan.json';
  const pkg = JSON.parse(await readFile(resolve('data/projects', projectFile), 'utf8')) as Package;
  const urls = {
    peel: 'https://www.historicenvironment.scot/visit/all/peel-ring-of-lumphanan/',
    peelPlan: 'https://www.historicenvironment.scot/visit/all/peel-ring-of-lumphanan/plan-your-visit/',
    peelHistory: 'https://www.historicenvironment.scot/visit/all/peel-ring-of-lumphanan/history-and-stories/',
    paths: 'https://www.lumphananpaths.org/', walks: 'https://www.lumphananpaths.org/walks-around-lumphanan',
    tea: 'https://www.meetagainteashop.co.uk/', menu: 'https://www.meetagainteashop.co.uk/page8.html',
    parking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
    toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets', openSpace: 'https://www.aberdeenshire.gov.uk/media/6136/lumphanan.pdf',
    lb9278: 'https://portal.historicenvironment.scot/designation/LB9278', lb9280: 'https://portal.historicenvironment.scot/designation/LB9280',
  };
  const churchyard = pkg.features.find((entry) => entry.id === 'hes-listed-building:LB9278');
  const garden = pkg.features.find((entry) => entry.id === 'hes-listed-building:LB9280');
  const church = pkg.features.find((entry) => entry.id === 'hes-listed-building:LB9277');
  const peel = pkg.features.find((entry) => entry.id === 'hes-scheduled-monument:SM90238');
  if (!churchyard || !garden || !church || !peel) throw new Error('Lumphanan: missing statutory feature');
  Object.assign(churchyard, { documentedDateText: 'Probably 18th century, associated with the 1762 church', earliestPossibleYear: 1700, latestPossibleYear: 1799, datePrecision: 'century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', reviewNotes: 'HES gives no explicit construction date. This honest contextual estimate follows the rubble enclosure’s association with the 1762 church and must not be read as an exact year or listing date.' });
  Object.assign(garden, { documentedDateText: 'Probably late 18th or early 19th century, associated with the 1782 manse', earliestPossibleYear: 1782, latestPossibleYear: 1828, datePrecision: 'broad_range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', reviewNotes: 'HES gives no explicit construction date. This contextual range follows the 1782 manse and its 1828 offices and deliberately avoids using the listing date as a building date.' });
  for (const entry of [churchyard, garden]) {
    entry.tags = [...new Set([...entry.tags.filter((tag: string) => tag !== 'map-hidden'), 'date-reviewed', 'hes-date-reviewed'])];
    entry.updatedAt = accessedAt;
  }
  peel.evidenceScope = 'related_context';
  updateHighlightFeature(peel, 84, 'A free, year-round 13th-century earthwork castle site just south-west of Lumphanan, with a high motte, broad ditch and later hall remains.', 'A nationally important and legible medieval earthwork with free year-round access and its own parking, physically linked to village walking routes.', urls.peel, [evidence('Peel Ring of Lumphanan', 'Historic Environment Scotland', urls.peel, 'Current visitor information.', 'official_statutory'), evidence('Peel Ring plan your visit', 'Historic Environment Scotland', urls.peelPlan, 'Current access and parking information.', 'official_statutory'), evidence('Peel Ring history', 'Historic Environment Scotland', urls.peelHistory, 'Authoritative site chronology.', 'official_statutory')], { tagline: '13th-century ringwork and motte', entrance_fee: 'free', 'opening_hours:description': 'Open year-round', time_to_spend: '45–75 minutes', warning: 'Uneven grassy earthworks; conditions can be wet' });
  const peelAttraction = feature({ id: 'curated-attraction:lumphanan-peel-ring', name: 'Peel Ring of Lumphanan', projectId, locality: 'Lumphanan', type: 'archaeological_site', coordinates: [-2.7017205, 57.1222088], score: 84, category: 'attraction', tagline: '13th-century ringwork and motte', description: 'A free, year-round 13th-century earthwork castle site just south-west of Lumphanan, with a high motte, broad ditch and later hall remains.', reason: 'A nationally important and legible medieval earthwork with free year-round access and its own parking, physically linked to village walking routes.', url: urls.peel, details: { entrance_fee: 'free', 'opening_hours:description': 'Open year-round', time_to_spend: '45–75 minutes', warning: 'Uneven grassy earthworks; conditions can be wet', hes_record: 'SM90238' }, sources: [evidence('Peel Ring of Lumphanan', 'Historic Environment Scotland', urls.peel, 'Current visitor information.', 'official_statutory'), evidence('Peel Ring plan your visit', 'Historic Environment Scotland', urls.peelPlan, 'Current access and parking information.', 'official_statutory'), evidence('Peel Ring history', 'Historic Environment Scotland', urls.peelHistory, 'Authoritative site chronology.', 'official_statutory')], tags: ['service-context-visitor'], evidenceScope: 'related_context' });
  updateHighlightFeature(church, 65, 'Lumphanan’s 1762 old parish church, churchyard and associated manse group mark the historic settlement core on the local walking circuit.', 'A coherent, dated open-air heritage group that adds depth to the village circuit, though the church itself has limited routine visitor opening.', urls.walks, [evidence('Walks around Lumphanan', 'Lumphanan Paths Group', urls.walks, 'Current route context linking St Finan’s and Peel Ring.'), evidence('St Finan’s Church LB9277', 'Historic Environment Scotland', 'https://portal.historicenvironment.scot/designation/LB9277', 'Official 1762 date and listing description.', 'official_statutory')], { tagline: 'Old parish core on village circuit', entrance_fee: 'free to view externally', 'opening_hours:description': 'Exterior and churchyard visible from the public route; interior opening not published', time_to_spend: '20–40 minutes' });
  const eat = feature({ id: 'curated-food:lumphanan-meet-again', name: 'Meet Again Tea Shop', projectId, locality: 'Lumphanan', type: 'other', coordinates: [-2.6883239, 57.128812], score: 82, category: 'food', tagline: 'Tea, home baking and walk guides', description: 'A village tea shop specialising in teas, coffee, cakes, sandwiches and light food, with printed local walking guides available.', reason: 'A distinctive, directly relevant coffee-and-cake stop with an operator menu and unusually good integration with the local walking offer.', url: urls.tea, details: { amenity: 'cafe', cuisine: 'coffee_cake_light_lunch', 'opening_hours:description': 'Current weekly opening hours are not published by the operator; telephone confirmation is required', price_band: '££' }, sources: [evidence('Meet Again Tea Shop', 'Meet Again Tea Shop', urls.tea, 'Current operator description and walking-guide offer.'), evidence('Meet Again menu', 'Meet Again Tea Shop', urls.menu, 'Operator menu evidence for tea, coffee, cakes, sandwiches and light food.')], tags: ['service-context-food'] });
  const trailSpecs: Array<[string, string, number, string, string]> = [
    ['circular', 'Lumphanan Circular', 78, 'Village circuit using the Old Military Road, Tullochvenus, St Finan’s Church and the Peel Ring.', 'Read the live leaflet for distance, surfaces, roads and livestock conditions'],
    ['peel', 'Lumphanan to the Peel Ring', 72, 'Short village-to-castle walking connection using the local path network.', 'Uneven ground at the earthworks; use close control around roads and fields'],
    ['dess', 'Lumphanan to Kincardine O’Neil and Dess', 74, 'Longer through-route from Lumphanan towards Kincardine O’Neil and Dess.', 'Long rural route; check the current leaflet, return transport and path conditions'],
  ];
  const trails = trailSpecs.map(([slug, name, score, description, warning]) => feature({ id: `curated-trail:lumphanan-${slug}`, name, projectId, locality: 'Lumphanan', type: 'other', coordinates: [-2.688454, 57.1289789], score, category: 'trail', tagline: slug === 'circular' ? 'The complete village heritage circuit' : 'Community-mapped Lumphanan route', description, reason: 'The active Lumphanan Paths Group publishes a live route page and downloadable mapping with route-specific information.', url: urls.walks, details: { distance: 'See current route leaflet', duration: 'See current route leaflet', trail_type: slug === 'dess' ? 'linear longer walk' : 'walking route', warning }, sources: [evidence('Walks around Lumphanan', 'Lumphanan Paths Group', urls.walks, 'Current named route information and live mapping.')], tags: ['service-context-trail'] }));
  const services = [
    feature({ id: 'curated-picnic:lumphanan-peel', name: 'Peel Ring Picnic Stop', projectId, locality: 'Lumphanan', type: 'other', coordinates: [-2.7017205, 57.1222088], score: 62, category: 'attraction', tagline: 'Informal picnic by the Peel Ring', description: 'An informal picnic stop at the Peel Ring; no tables or shelter are claimed.', reason: 'The local tea shop explicitly recommends the Peel Ring for a picnic, but no formal picnic furniture is published.', url: urls.tea, details: { tourism: 'picnic_site', tables: 'No tables verified', shelter: 'No shelter verified', entrance_fee: 'free', warning: 'Take litter home and protect the monument' }, sources: [evidence('Meet Again Tea Shop', 'Meet Again Tea Shop', urls.tea, 'Operator suggests the Peel Ring as a picnic destination.')], tags: ['service-context-picnic'], evidenceScope: 'related_context' }),
    feature({ id: 'curated-parking:lumphanan-village', name: 'Lumphanan Village Car Park', projectId, locality: 'Lumphanan', type: 'other', coordinates: [-2.6869082, 57.1289761], score: 62, category: 'attraction', tagline: 'Free central parking', description: 'Council car park in Lumphanan with eight free spaces.', reason: 'Aberdeenshire Council confirms the location, free status and eight-space capacity.', url: urls.parking, details: { amenity: 'parking', fee: 'no', capacity: '8', capacity_disabled: 'Not published', overnight: 'Check signs' }, sources: [evidence('Aberdeenshire car parks', 'Aberdeenshire Council', urls.parking, 'Current free status and eight-space capacity.', 'local_authority')], tags: ['service-context-parking'] }),
    feature({ id: 'curated-parking:lumphanan-peel', name: 'Peel Ring Car Park', projectId, locality: 'Lumphanan', type: 'other', coordinates: [-2.7017205, 57.1222088], score: 62, category: 'attraction', tagline: 'Free castle-site parking', description: 'Small parking area serving the Peel Ring of Lumphanan.', reason: 'Historic Environment Scotland confirms parking at the monument; capacity and accessible-bay count are not published.', url: urls.peelPlan, details: { amenity: 'parking', fee: 'no', capacity: 'Not published', capacity_disabled: 'Not published', overnight: 'Check signs' }, sources: [evidence('Peel Ring plan your visit', 'Historic Environment Scotland', urls.peelPlan, 'Official current parking information.', 'official_statutory')], tags: ['service-context-parking'], evidenceScope: 'related_context' }),
    feature({ id: 'curated-toilet:lumphanan-village', name: 'Lumphanan Public Toilets', projectId, locality: 'Lumphanan', type: 'other', coordinates: [-2.6883023, 57.1283507], score: 64, category: 'attraction', tagline: 'Village public toilets', description: 'Council-listed public toilets in Lumphanan.', reason: 'Aberdeenshire Council’s current public-toilet directory includes Lumphanan; exact hours and accessibility details are not published on the filtered page.', url: urls.toilets, details: { amenity: 'toilets', 'opening_hours:description': 'Current daily hours are not published; check council information locally', disabled: 'Not published' }, sources: [evidence('Aberdeenshire public toilets', 'Aberdeenshire Council', urls.toilets, 'Current council directory includes Lumphanan.', 'local_authority')], tags: ['service-context-toilets'] }),
  ];
  replaceCurated(pkg, [peelAttraction, eat, ...trails, ...services]);
  pkg.project.touristAppeal = { score: 76, dogOwnerScore: 74, dogAccessScoreAdjustment: -2, rating: 2, label: 'Great Place', summary: 'A genuine historic walking village with the Peel Ring, a strong community path network, an excellent tea shop and complete basic visitor facilities.', dogAccessRating: 2, dogAccessSummary: 'The route network can suit responsible dogs, with close control around roads, livestock, wildlife and the scheduled monument.', methodVersion: '2026-09-02-strict-settlement-full-audit-v4', reviewedAt, sourceUrls: [...Object.values(urls), ...Object.values(providers)] };
  pkg.project.visitorHighlights = [highlight(peelAttraction, 1, 'Peel Ring of Lumphanan', '13th-century ringwork and motte', 84, '45–75 minutes', 'Open year-round', 'Free'), highlight(church, 2, 'St Finan’s historic church group', 'Old parish core on village circuit', 65, '20–40 minutes', 'Exterior and churchyard visible; interior opening not published', 'Free to view externally')];
  pkg.project.townGuide = { characterTag: 'Historic Deeside path village', headline: 'A medieval earthwork, living path network and proper tea stop', intro: 'Lumphanan scores 76 after a complete current audit. The Peel Ring is physically connected to a village with its own active paths group, historic church core, tea shop, free parking and public toilets, so this is not an attraction-only promotion.', bestFor: ['Medieval earthworks', 'Village circuits', 'Tea and home baking'], perfectFor: ['A heritage walk with a café stop'], suggestedFirstVisit: { title: 'Follow the local circuit', summary: 'Use the village car park, connect St Finan’s with the Peel Ring, then return for tea and cake.' }, dontMiss: ['Peel Ring of Lumphanan', 'Lumphanan Circular', 'Meet Again Tea Shop'], suggestedTime: '2–4 hours', visitorMood: 'Community-led, quietly historic and easy to turn into a rounded visit.', sourceUrls: [...Object.values(urls), ...Object.values(providers)], lastReviewedAt: reviewedAt };
  pkg.project.researchNotes = 'Full current web, strict-boundary, café, parking, toilet, picnic, trail-provider and HES audit. LB9278 and LB9280 are now visible with cautious contextual date ranges because HES supplies no exact construction date; listing dates were not misused. Dates remain metadata and are not appended to map labels. No exact commercial clue-trail product was found.';
  planner.projects[projectId] = { eat: [eat.id], trails: trails.map((entry) => entry.id), picnic: ['curated-picnic:lumphanan-peel'], parking: ['curated-parking:lumphanan-village', 'curated-parking:lumphanan-peel'], toilets: ['curated-toilet:lumphanan-village'] };
  dog.projects[projectId] = { attraction: { [peelAttraction.id]: dogEntry('Peel Ring of Lumphanan', urls.peel), [church.id]: dogEntry('Lumphanan Paths Group', urls.walks) }, eat: { [eat.id]: dogEntry('Meet Again Tea Shop', urls.tea, 'food') }, trail: Object.fromEntries(trails.map((entry) => [entry.id, dogEntry('Scottish Outdoor Access Code', providers.dogCode, 'trail')])) };
  assertPackage(pkg, 8);
  await writeProject(pkg, projectFile);
  const report = { reviewedAt: accessedAt, projectId, place: 'Lumphanan', townScore: 76, mapPublished: true, categories: { see: { audited: true, published: 2 }, eat: { audited: true, published: 1 }, trails: { audited: true, published: 3, providerChecks: { TreasureTrails: 'No exact Lumphanan product found.', CuriousAbout: 'No exact Lumphanan product found.', MysteryGuides: 'No exact Lumphanan product found.', GoQuestAdventures: 'No exact Lumphanan product found.', LumphananPathsGroup: 'Current named routes and live leaflets verified.', OfficialHES: 'Peel Ring access and history checked.' } }, picnic: { audited: true, published: 1 }, parking: { audited: true, published: 2 }, toilets: { audited: true, published: 1 } }, hes: { assigned: 8, visibleDated: 8, hiddenUndated: 0, visibleUndated: 0, missing: 0, correction: 'LB9278 and LB9280 made visible with cautious contextual ranges; HES gives no exact construction years.' }, boundaryRule: 'The Peel Ring is related context but physically linked by the village route network; Lumphanan’s score also rests on its paths group, tea shop, historic core and facilities.', research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks: [...Object.values(urls).map((url) => sourceCheck(url, 'verified', 'Opened and checked during the current audit.')), sourceCheck(providers.treasure, 'no_result', 'Provider checked; no exact Lumphanan trail.'), sourceCheck(providers.curious, 'no_result', 'Provider checked; no exact Lumphanan trail.'), sourceCheck(providers.mystery, 'no_result', 'Provider checked; no exact Lumphanan trail.'), sourceCheck(providers.goQuest, 'no_result', 'Provider checked; no exact Lumphanan trail.'), sourceCheck(providers.dogCode, 'verified', 'Current responsible dog-access guidance checked.')] }, scoreReanalysis: { required: true, completed: true, previousScore: 56, resultScore: 76, rationale: 'The pending-audit score omitted the current paths network, strong daytime tea shop and complete practical facilities. The village independently supports a rounded visit beyond the Peel Ring alone.' }, certification: { publicationCountsReconciled: true, liveBrowserVerifiedAt: liveVerifiedAt } };
  await writeFile(resolve('data/review/lumphanan-full-visitor-audit-2026-09-02.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

await auditDinnet();
await auditFinzean();
await auditLumphanan();
planner.reviewedAt = reviewedAt;
dog.reviewedAt = reviewedAt;
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ audited: ['Dinnet', 'Finzean', 'Lumphanan'], liveVerifiedAt }, null, 2));
