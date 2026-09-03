import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson';
import type {
  AttractionGuide,
  HeritageFeature,
  ProjectPackage,
  VisitorHighlight,
} from '../src/domain/models';
import {
  classifyMappedVisitorAttraction,
  mappedAttractionDescription,
  type VisitorAttractionCategory,
  type VisitorAttractionClassification,
} from '../src/domain/visitorAttractionTaxonomy';
import { publicVisitorUrl } from '../src/domain/editorialResearch';

interface OsmCandidate {
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  coordinates: [number, number];
  tags: Record<string, string>;
}

interface IndexedProject {
  path: string;
  pkg: ProjectPackage;
  boundary: Feature<Polygon | MultiPolygon>;
  bounds: [number, number, number, number];
  existingNames: Set<string>;
  candidates: RankedCandidate[];
}

interface RankedCandidate {
  candidate: OsmCandidate;
  classification: VisitorAttractionClassification;
}

interface AdditionRecord {
  projectId: string;
  locality: string;
  featureId: string;
  name: string;
  category: VisitorAttractionCategory;
  candidatePriorityScore: number;
  sourceUrl: string;
  missingCurrentResearch: string[];
}

interface TownResearchRecord {
  projectId: string;
  locality: string;
  see: number;
  broad: number;
  reason: 'no-curated-see' | 'heritage-only-see';
}

interface HighlightEntry {
  highlight: VisitorHighlight;
  existing: boolean;
  category?: VisitorAttractionCategory;
  researchPriority: number;
  candidatePriorityScore: number;
}

const reviewedDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const reviewedAt = new Date().toISOString();
const projectsDirectory = resolve('data/projects');
const cliArguments = process.argv.slice(2);
const dryRun = cliArguments.includes('--dry-run');
const positionalArguments = cliArguments.filter((argument) => !argument.startsWith('--'));
const inputPath = resolve(positionalArguments[0] ?? 'tmp/england-broad-visitor-osm.ndjson');
const reportPath = resolve(
  positionalArguments[1] ?? `data/review/england-broad-visitor-editorial-pass-${reviewedDate}.json`,
);
const reportMarkdownPath = reportPath.replace(/\.json$/i, '.md');
const gridSize = 0.1;
const osmLicence = 'Open Database Licence (ODbL) 1.0';
const auditMarker = `Broad visitor-attraction editorial discovery pass ${reviewedDate}`;

const categoryLabels: Readonly<Record<VisitorAttractionCategory, string>> = {
  'active-and-adventure': 'Activity and adventure',
  'animal-and-family': 'Family attraction',
  'arts-and-entertainment': 'Culture and entertainment',
  'beach-and-coast': 'Beach and coast',
  'general-attraction': 'Visitor attraction',
  'lake-and-waterside': 'Lake and waterside',
  'museum-and-gallery': 'Museum and gallery',
  'outdoor-and-nature': 'Nature and outdoors',
  'visitor-centre': 'Visitor centre',
  'water-activity': 'Watersports and boating',
  'viewpoint-and-landmark': 'Viewpoint and landmark',
};

const broadFeatureTypes = new Set([
  'amusement_arcade',
  'aquarium',
  'arts_centre',
  'axe_throwing',
  'beach',
  'bird_hide',
  'boat_rental',
  'boat_sharing',
  'bowling_alley',
  'cave_entrance',
  'climbing',
  'escape_game',
  'garden',
  'heritage railway',
  'high_ropes_course',
  'ice_rink',
  'indoor_play',
  'karting',
  'lake',
  'lagoon',
  'lighthouse',
  'market',
  'marina',
  'miniature_golf',
  'museum',
  'nature_reserve',
  'observatory',
  'park',
  'pier',
  'planetarium',
  'reservoir',
  'slipway',
  'swimming',
  'swimming_area',
  'swimming_pool',
  'theatre',
  'theme_park',
  'tower',
  'trampoline_park',
  'visitor_centre',
  'water_park',
  'water_sports',
  'waterfall',
  'zoo',
]);

const categoryActivities: Readonly<Record<VisitorAttractionCategory, string[]>> = {
  'active-and-adventure': ['Try the main visitor activity', 'Check sessions and booking before travelling'],
  'animal-and-family': ['Explore the main visitor experience', 'Check current sessions and activities'],
  'arts-and-entertainment': ['Check the current programme', 'Build the visit around a performance or activity'],
  'beach-and-coast': ['Spend time by the shore', 'Enjoy the coastal views and fresh air'],
  'general-attraction': ['Explore the main visitor experience', 'Check current visitor information before setting out'],
  'lake-and-waterside': ['Follow the waterside', 'Pause for views and wildlife'],
  'museum-and-gallery': ['Explore the principal displays', 'Look for temporary exhibitions or events'],
  'outdoor-and-nature': ['Explore the public paths', 'Look for seasonal wildlife and landscape interest'],
  'visitor-centre': ['Pick up current local information', 'Use the centre to plan the wider visit'],
  'water-activity': ['Check which activities are running', 'Allow time for equipment, briefing and changing'],
  'viewpoint-and-landmark': ['Take in the main view', 'Allow time for photographs and orientation'],
};

const automaticCategoryCaps: Readonly<Record<VisitorAttractionCategory, number>> = {
  'active-and-adventure': 3,
  'animal-and-family': 3,
  'arts-and-entertainment': 3,
  'beach-and-coast': 4,
  'general-attraction': 4,
  'lake-and-waterside': 3,
  'museum-and-gallery': 3,
  'outdoor-and-nature': 4,
  'visitor-centre': 1,
  'water-activity': 3,
  'viewpoint-and-landmark': 3,
};

function normalise(value: string): string {
  return value
    .toLocaleLowerCase('en-GB')
    .replaceAll(/[’']/g, '')
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

function normaliseWebsite(tags: Record<string, string>): string | undefined {
  const raw = tags.website ?? tags['contact:website'];
  if (!raw) return undefined;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const pathname = url.pathname.replace(/\/+$/, '');
    return `${url.hostname.toLocaleLowerCase('en-GB').replace(/^www\./, '')}${pathname}`;
  } catch {
    return raw.toLocaleLowerCase('en-GB').replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/+$/, '');
  }
}

function descriptiveNameScore(value: string): number {
  const name = normalise(value);
  const visitorWords = name.match(
    /\b(?:adventure|arcade|arts|beach|bowling|centre|cinema|gallery|garden|golf|lake|lido|market|museum|nature|park|pier|railway|reserve|theatre|viewpoint|wildlife)\b/g,
  );
  return (visitorWords?.length ?? 0) * 10 + Math.min(name.length, 30);
}

const identityStopWords = new Set([
  'age',
  'and',
  'archaeological',
  'archaeology',
  'bronze',
  'centre',
  'gallery',
  'gardens',
  'haven',
  'local',
  'museum',
  'nature',
  'park',
  'reserve',
  'the',
  'visitor',
  'wildlife',
]);
const genericIdentityTokens = new Set([
  'beach',
  'central',
  'centre',
  'garden',
  'hall',
  'house',
  'market',
  'park',
  'pier',
  'river',
  'street',
  'tower',
]);

function identityTokens(value: string): Set<string> {
  return new Set(
    normalise(value)
      .split(' ')
      .filter((token) => token.length >= 3 && !identityStopWords.has(token)),
  );
}

function namesShareIdentity(left: string, right: string): boolean {
  const normalLeft = normalise(left);
  const normalRight = normalise(right);
  if (normalLeft === normalRight) return true;
  if (
    (normalLeft.length >= 6 && normalRight.includes(normalLeft)) ||
    (normalRight.length >= 6 && normalLeft.includes(normalRight))
  ) {
    return true;
  }
  const leftTokens = identityTokens(left);
  const rightTokens = identityTokens(right);
  const sharedTokens = [...leftTokens].filter((token) => rightTokens.has(token));
  if (sharedTokens.length >= 2) return true;
  if (sharedTokens.length !== 1) return false;
  const [sharedToken] = sharedTokens;
  return (
    !genericIdentityTokens.has(sharedToken) &&
    sharedToken.length >= 6 &&
    (leftTokens.size === 1 || rightTokens.size === 1)
  );
}

function distanceMetres(left: [number, number], right: [number, number]): number {
  const latitudeRadians = ((left[1] + right[1]) / 2) * (Math.PI / 180);
  const longitudeDistance = (left[0] - right[0]) * 111_320 * Math.cos(latitudeRadians);
  const latitudeDistance = (left[1] - right[1]) * 110_540;
  return Math.hypot(longitudeDistance, latitudeDistance);
}

function representativeCoordinates(geometry: Geometry): [number, number] | undefined {
  const positions = geometryPositions(geometry);
  if (positions.length === 0) return undefined;
  return [
    positions.reduce((sum, [longitude]) => sum + longitude, 0) / positions.length,
    positions.reduce((sum, [, latitude]) => sum + latitude, 0) / positions.length,
  ];
}

function duplicatesExistingFeature(project: IndexedProject, candidate: OsmCandidate): boolean {
  return project.pkg.features.some((feature) => {
    if (!namesShareIdentity(feature.name, candidate.tags.name)) return false;
    if (!feature.geometry) return false;
    const coordinates = representativeCoordinates(feature.geometry);
    return coordinates ? distanceMetres(coordinates, candidate.coordinates) <= 250 : false;
  });
}

function candidatesAreDuplicates(left: RankedCandidate, right: RankedCandidate): boolean {
  if (distanceMetres(left.candidate.coordinates, right.candidate.coordinates) > 250) return false;
  if (namesShareIdentity(left.candidate.tags.name, right.candidate.tags.name)) return true;
  const leftWebsite = normaliseWebsite(left.candidate.tags);
  const rightWebsite = normaliseWebsite(right.candidate.tags);
  return Boolean(leftWebsite && rightWebsite && leftWebsite === rightWebsite);
}

function geometryPositions(geometry: Geometry): [number, number][] {
  if (geometry.type === 'Point') return [geometry.coordinates as [number, number]];
  if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
    return geometry.coordinates as [number, number][];
  }
  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') {
    return geometry.coordinates.flat() as [number, number][];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat(2) as [number, number][];
  }
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.flatMap(geometryPositions);
  }
  return [];
}

function featureBounds(feature: Feature<Polygon | MultiPolygon>): [number, number, number, number] {
  const positions = geometryPositions(feature.geometry);
  return [
    Math.min(...positions.map(([longitude]) => longitude)),
    Math.min(...positions.map(([, latitude]) => latitude)),
    Math.max(...positions.map(([longitude]) => longitude)),
    Math.max(...positions.map(([, latitude]) => latitude)),
  ];
}

function gridCoordinate(value: number): number {
  return Math.floor(value / gridSize);
}

function gridKey(longitude: number, latitude: number): string {
  return `${gridCoordinate(longitude)}:${gridCoordinate(latitude)}`;
}

function gridKeysForBounds(bounds: [number, number, number, number]): string[] {
  const keys: string[] = [];
  for (
    let longitude = gridCoordinate(bounds[0]);
    longitude <= gridCoordinate(bounds[2]);
    longitude += 1
  ) {
    for (
      let latitude = gridCoordinate(bounds[1]);
      latitude <= gridCoordinate(bounds[3]);
      latitude += 1
    ) {
      keys.push(`${longitude}:${latitude}`);
    }
  }
  return keys;
}

function isEnglishProject(pkg: ProjectPackage): boolean {
  return (
    pkg.project.country.toLocaleLowerCase('en-GB') === 'england' ||
    /(?:^|-)ENG$/i.test(pkg.project.countryCode)
  );
}

function externalUrl(candidate: OsmCandidate): string {
  return (
    candidate.tags.website ??
    candidate.tags['contact:website'] ??
    `https://www.openstreetmap.org/${candidate.osmType}/${candidate.osmId}`
  );
}

function osmUrl(candidate: OsmCandidate): string {
  return `https://www.openstreetmap.org/${candidate.osmType}/${candidate.osmId}`;
}

function featureId(projectId: string, candidate: OsmCandidate): string {
  return `osm-community:${projectId}:${candidate.osmType}-${candidate.osmId}`;
}

function admission(candidate: OsmCandidate): Pick<VisitorHighlight, 'admission' | 'freeAdmission'> {
  if (/^(?:no|free|0)$/i.test(candidate.tags.fee ?? '')) {
    return { admission: 'Free', freeAdmission: true };
  }
  if (/^(?:yes|ticket|paid)$/i.test(candidate.tags.fee ?? '')) {
    return {
      admission: 'Admission charged; check current prices before travelling.',
      freeAdmission: false,
    };
  }
  return {};
}

function readableOpeningTimes(candidate: OsmCandidate): string | undefined {
  const openingTimes = candidate.tags.opening_hours?.trim();
  if (!openingTimes) return undefined;
  if (/^(?:24\/7|open)$/i.test(openingTimes)) return 'Open at all times.';
  return openingTimes.replaceAll(';', '; ');
}

function sourceNotes(candidate: OsmCandidate, classification: VisitorAttractionClassification): string {
  const details: Record<string, string | undefined> = {
    tourism: candidate.tags.tourism,
    leisure: candidate.tags.leisure,
    amenity: candidate.tags.amenity,
    natural: candidate.tags.natural,
    water: candidate.tags.water,
    waterway: candidate.tags.waterway,
    sport: candidate.tags.sport,
    opening_hours: candidate.tags.opening_hours?.replaceAll(';', ', '),
    fee: candidate.tags.fee,
    toilets: candidate.tags.toilets,
    picnic: candidate.tags.picnic,
    cafe: candidate.tags.cafe,
    restaurant: candidate.tags.restaurant,
    visitor_category: classification.category,
    research_priority: String(classification.candidatePriorityScore),
    editorial_status: 'OSM-discovered candidate; current visitor details require source review',
  };
  return Object.entries(details)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function attractionGuide(
  candidate: OsmCandidate,
  classification: VisitorAttractionClassification,
  description: string,
): AttractionGuide {
  const guide: AttractionGuide = {
    headline: categoryLabels[classification.category],
    intro: description,
    motifs: [categoryLabels[classification.category], classification.descriptionNoun],
    bestFor: classification.bestFor,
    thingsToDo: categoryActivities[classification.category].map((name) => ({ name })),
  };
  if (/^(?:yes|public)$/i.test(candidate.tags.toilets ?? '')) {
    guide.toilets = 'Visitor toilets are mapped on site.';
  }
  if (/^(?:yes|public)$/i.test(candidate.tags.picnic ?? '')) {
    guide.picnic = 'Picnic provision is mapped on site.';
  }
  if (/^(?:yes|public)$/i.test(candidate.tags.cafe ?? '')) {
    guide.foodNote = 'An on-site cafe is mapped; check current opening before relying on it.';
  } else if (/^(?:yes|public)$/i.test(candidate.tags.restaurant ?? '')) {
    guide.foodNote = 'An on-site restaurant is mapped; check current opening before relying on it.';
  }
  return guide;
}

function createFeature(
  indexed: IndexedProject,
  ranked: RankedCandidate,
): HeritageFeature {
  const { candidate, classification } = ranked;
  const description = mappedAttractionDescription(
    candidate.tags.name,
    indexed.pkg.project.locality,
    classification,
  );
  return {
    id: featureId(indexed.pkg.project.id, candidate),
    projectId: indexed.pkg.project.id,
    name: candidate.tags.name,
    alternativeNames: [],
    countryCode: indexed.pkg.project.countryCode,
    region: indexed.pkg.project.region,
    locality: indexed.pkg.project.locality,
    featureType: classification.featureType,
    significance: 'local',
    geometry: point(candidate.coordinates).geometry,
    locationType: 'representative_point',
    locationConfidence: candidate.osmType === 'node' ? 'high' : 'medium',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: description,
    sourceRecords: [
      {
        sourceName: 'OpenStreetMap current community places',
        sourceOrganisation: 'OpenStreetMap contributors',
        sourceRecordId: `${candidate.osmType}/${candidate.osmId}`,
        sourceUrl: osmUrl(candidate),
        accessedAt: reviewedAt,
        licence: osmLicence,
        notes: sourceNotes(candidate, classification),
        reliability: 'discovery_only',
      },
    ],
    licence: osmLicence,
    tags: [
      'current-context',
      'service-context-visitor',
      'osm-current-place',
      'broad-visitor-attraction',
      `visitor-category:${classification.category}`,
    ],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Broad visitor category and active-boundary inclusion checked automatically; operator details and public recommendation strength require editorial source review.',
    evidenceScope: 'related_context',
    attractionGuide: attractionGuide(candidate, classification, description),
  };
}

function createHighlight(
  indexed: IndexedProject,
  ranked: RankedCandidate,
  feature: HeritageFeature,
): VisitorHighlight {
  const { candidate, classification } = ranked;
  return {
    rank: 0,
    featureId: feature.id,
    name: feature.name,
    reason: feature.shortDescription ?? feature.name,
    tagline: categoryLabels[classification.category],
    timeToSpend: classification.defaultDuration,
    openingTimes: readableOpeningTimes(candidate),
    ...admission(candidate),
    organisationPills: [],
    attractionGuide: feature.attractionGuide,
    visitorWebsiteUrl: publicVisitorUrl(externalUrl(candidate)),
    sourceName: 'OpenStreetMap current community places',
    sourceUrl: osmUrl(candidate),
    verifiedInBoundaryAt: reviewedDate,
  };
}

function existingIsBroad(feature: HeritageFeature | undefined): boolean {
  if (!feature) return false;
  if (
    feature.tags.some((tag) =>
      /^(?:broad-visitor-attraction|service-context-(?:park|leisure)|osm-community-(?:park|visitor))$/.test(
        tag,
      ),
    )
  ) {
    return true;
  }
  return broadFeatureTypes.has(feature.featureType.toLocaleLowerCase('en-GB'));
}

function townSpectrum(pkg: ProjectPackage): { see: number; broad: number; historicOnly: boolean } {
  const features = new Map(pkg.features.map((feature) => [feature.id, feature]));
  const highlights = pkg.project.visitorHighlights ?? [];
  const broad = highlights.filter((highlight) => existingIsBroad(features.get(highlight.featureId))).length;
  return { see: highlights.length, broad, historicOnly: highlights.length > 0 && broad === 0 };
}

function missingResearch(candidate: OsmCandidate): string[] {
  const missing: string[] = [];
  if (!candidate.tags.opening_hours) missing.push('opening times');
  if (!candidate.tags.fee) missing.push('admission/prices');
  if (!candidate.tags.dog && !candidate.tags.dogs) missing.push('dog policy');
  if (!candidate.tags.toilets) missing.push('toilets');
  if (!candidate.tags.picnic) missing.push('picnic provision');
  if (!candidate.tags.cafe && !candidate.tags.restaurant) missing.push('cafe/food');
  return missing;
}

async function loadProjects(): Promise<IndexedProject[]> {
  const fileNames = (await readdir(projectsDirectory)).filter((name) => name.endsWith('.json'));
  const projects: IndexedProject[] = [];
  for (const fileName of fileNames) {
    const path = resolve(projectsDirectory, fileName);
    const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
    if (!isEnglishProject(pkg) || !pkg.project.touristAppeal) continue;
    const boundary = pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;
    projects.push({
      path,
      pkg,
      boundary,
      bounds: featureBounds(boundary),
      existingNames: new Set(pkg.features.map((feature) => normalise(feature.name))),
      candidates: [],
    });
  }
  return projects;
}

async function discoverCandidates(projects: IndexedProject[]): Promise<{
  sourceCandidates: number;
  classifiedCandidates: number;
  inBoundaryMatches: number;
  categoryMatches: Record<string, number>;
}> {
  const grid = new Map<string, IndexedProject[]>();
  for (const project of projects) {
    for (const key of gridKeysForBounds(project.bounds)) {
      const cell = grid.get(key) ?? [];
      cell.push(project);
      grid.set(key, cell);
    }
  }

  let sourceCandidates = 0;
  let classifiedCandidates = 0;
  let inBoundaryMatches = 0;
  const categoryMatches: Record<string, number> = {};
  const input = createInterface({ input: createReadStream(inputPath, 'utf8'), crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
    sourceCandidates += 1;
    const candidate = JSON.parse(line) as OsmCandidate;
    const classification = classifyMappedVisitorAttraction(candidate.tags);
    if (!classification) continue;
    classifiedCandidates += 1;
    const matchingProjects = (grid.get(gridKey(...candidate.coordinates)) ?? []).filter(
      (project) =>
        !project.existingNames.has(normalise(candidate.tags.name)) &&
        !duplicatesExistingFeature(project, candidate) &&
        booleanPointInPolygon(point(candidate.coordinates), project.boundary),
    );
    const project = matchingProjects.sort(
      (left, right) =>
        distanceMetres(candidate.coordinates, left.pkg.project.centre) -
          distanceMetres(candidate.coordinates, right.pkg.project.centre) ||
        left.pkg.project.locality.localeCompare(right.pkg.project.locality, 'en-GB'),
    )[0];
    if (project) {
      project.candidates.push({ candidate, classification });
      inBoundaryMatches += 1;
      categoryMatches[classification.category] =
        (categoryMatches[classification.category] ?? 0) + 1;
    }
  }
  return { sourceCandidates, classifiedCandidates, inBoundaryMatches, categoryMatches };
}

function selectTownAdditions(project: IndexedProject): AdditionRecord[] {
  const pkg = project.pkg;
  const existingFeatures = new Map(pkg.features.map((feature) => [feature.id, feature]));
  const existingHighlights = pkg.project.visitorHighlights ?? [];
  const entries: HighlightEntry[] = existingHighlights.map((highlight) => ({
    highlight,
    existing: true,
    researchPriority: 1_000 - highlight.rank,
    candidatePriorityScore: highlight.visitorScore ?? 0,
  }));
  const bestCandidates = new Map<string, RankedCandidate>();
  for (const ranked of project.candidates) {
    const key = normalise(ranked.candidate.tags.name);
    const duplicateEntry = [...bestCandidates.entries()].find(([, existing]) =>
      candidatesAreDuplicates(existing, ranked),
    );
    const duplicateKey = duplicateEntry?.[0] ?? key;
    const existing = duplicateEntry?.[1] ?? bestCandidates.get(key);
    if (
      !existing ||
      ranked.classification.candidatePriorityScore > existing.classification.candidatePriorityScore ||
      (ranked.classification.candidatePriorityScore === existing.classification.candidatePriorityScore &&
        (ranked.classification.researchPriority > existing.classification.researchPriority ||
          (ranked.classification.researchPriority === existing.classification.researchPriority &&
            descriptiveNameScore(ranked.candidate.tags.name) >
              descriptiveNameScore(existing.candidate.tags.name))))
    ) {
      bestCandidates.set(duplicateKey, ranked);
    }
  }

  const proposedFeatures = new Map<string, HeritageFeature>();
  for (const ranked of bestCandidates.values()) {
    const id = featureId(pkg.project.id, ranked.candidate);
    const feature = existingFeatures.get(id) ?? createFeature(project, ranked);
    proposedFeatures.set(id, feature);
    entries.push({
      highlight: createHighlight(project, ranked, feature),
      existing: false,
      category: ranked.classification.category,
      researchPriority: ranked.classification.researchPriority,
      candidatePriorityScore: ranked.classification.candidatePriorityScore,
    });
  }

  entries.sort(
    (left, right) =>
      Number(right.existing) - Number(left.existing) ||
      (right.highlight.visitorScore ?? 0) - (left.highlight.visitorScore ?? 0) ||
      right.candidatePriorityScore - left.candidatePriorityScore ||
      right.researchPriority - left.researchPriority ||
      left.highlight.name.localeCompare(right.highlight.name, 'en-GB'),
  );
  const selected: HighlightEntry[] = [];
  const names = new Set<string>();
  const automaticCategoryCounts = new Map<VisitorAttractionCategory, number>();
  for (const entry of entries) {
    const key = normalise(entry.highlight.name);
    if (names.has(key)) continue;
    if (!entry.existing && entry.category) {
      const count = automaticCategoryCounts.get(entry.category) ?? 0;
      if (count >= automaticCategoryCaps[entry.category]) continue;
      automaticCategoryCounts.set(entry.category, count + 1);
    }
    names.add(key);
    selected.push(entry);
    if (selected.length === 20) break;
  }

  const additions: AdditionRecord[] = [];
  const selectedNewIds = new Set(
    selected.filter((entry) => !entry.existing).map((entry) => entry.highlight.featureId),
  );
  for (const entry of selected) {
    if (entry.existing) continue;
    const feature = proposedFeatures.get(entry.highlight.featureId);
    const ranked = [...bestCandidates.values()].find(
      (candidate) => featureId(pkg.project.id, candidate.candidate) === entry.highlight.featureId,
    );
    if (!feature || !ranked || !entry.category) continue;
    if (!existingFeatures.has(feature.id)) pkg.features.push(feature);
    additions.push({
      projectId: pkg.project.id,
      locality: pkg.project.locality,
      featureId: feature.id,
      name: feature.name,
      category: entry.category,
      candidatePriorityScore: entry.candidatePriorityScore,
      sourceUrl: entry.highlight.sourceUrl,
      missingCurrentResearch: missingResearch(ranked.candidate),
    });
  }

  if (selectedNewIds.size === 0) return [];
  pkg.project.visitorHighlights = selected.map((entry, index) => ({
    ...entry.highlight,
    rank: index + 1,
  }));
  pkg.project.researchNotes = pkg.project.researchNotes?.includes(auditMarker)
    ? pkg.project.researchNotes
    : `${pkg.project.researchNotes ? `${pkg.project.researchNotes}\n\n` : ''}${auditMarker}: expanded See discovery beyond historic records using a local OSM extract. Automatically discovered additions remain below Recommended until source-backed editorial review.`;
  return additions;
}

async function main(): Promise<void> {
  const projects = await loadProjects();
  const before = projects.map((project) => ({
    projectId: project.pkg.project.id,
    locality: project.pkg.project.locality,
    ...townSpectrum(project.pkg),
  }));
  const discovery = await discoverCandidates(projects);
  const additions = projects.flatMap(selectTownAdditions);
  const changedProjectIds = new Set(additions.map((addition) => addition.projectId));

  for (const project of projects) {
    if (dryRun || !changedProjectIds.has(project.pkg.project.id)) continue;
    await writeFile(project.path, `${JSON.stringify(project.pkg, null, 2)}\n`, 'utf8');
  }

  const after = projects.map((project) => ({
    projectId: project.pkg.project.id,
    locality: project.pkg.project.locality,
    ...townSpectrum(project.pkg),
  }));
  const byCategory = Object.fromEntries(
    Object.keys(categoryLabels).map((category) => [
      category,
      additions.filter((addition) => addition.category === category).length,
    ]),
  );
  const researchQueue = [...additions].sort(
    (left, right) =>
      right.candidatePriorityScore - left.candidatePriorityScore ||
      left.locality.localeCompare(right.locality, 'en-GB') ||
      left.name.localeCompare(right.name, 'en-GB'),
  );
  const townResearchQueue: TownResearchRecord[] = after
    .filter((town) => town.see === 0 || town.historicOnly)
    .map((town) => ({
      projectId: town.projectId,
      locality: town.locality,
      see: town.see,
      broad: town.broad,
      reason: (town.see === 0 ? 'no-curated-see' : 'heritage-only-see') as TownResearchRecord['reason'],
    }))
    .sort(
      (left, right) =>
        left.reason.localeCompare(right.reason, 'en-GB') ||
        left.locality.localeCompare(right.locality, 'en-GB'),
    );
  const totals = {
    englishProjects: projects.length,
    sourceCandidates: discovery.sourceCandidates,
    classifiedCandidates: discovery.classifiedCandidates,
    inBoundaryMatches: discovery.inBoundaryMatches,
    changedTowns: changedProjectIds.size,
    addedVisitorHighlights: additions.length,
    zeroSeeBefore: before.filter((town) => town.see === 0).length,
    zeroSeeAfter: after.filter((town) => town.see === 0).length,
    historicOnlyBefore: before.filter((town) => town.historicOnly).length,
    historicOnlyAfter: after.filter((town) => town.historicOnly).length,
    townsWithUnderThreeSeeBefore: before.filter((town) => town.see < 3).length,
    townsWithUnderThreeSeeAfter: after.filter((town) => town.see < 3).length,
  };
  const report = {
    schemaVersion: 1,
    reviewedAt,
    dryRun,
    scope:
      'All published English town packages with tourist appeal metadata, using each active visitor boundary.',
    policy: {
      inclusion:
        'Named, public, visitor-relevant OSM places inside the active town visitor polygon. Categories include beaches, lakes, watersports, family attractions, arts and entertainment, visitor centres, museums, destination green spaces and viewpoints.',
      ranking:
        'Existing researched highlights and automatically discovered candidates are ranked together by score. Existing records win ties and the public See list remains capped at 20.',
      scoring:
        'Automatically discovered candidates are capped at 74. Recommended, Highly recommended and Exceptional labels require a separate source-backed editorial review.',
      exclusions:
        'Private or restricted places, accommodation, animal enclosures, generic playgrounds, ordinary recreation grounds, practical facilities and unnamed features are excluded.',
      unchanged:
        'Town ratings, boundaries, heat-map evidence, Eat, Trails, Picnic, Parking and Toilets are not changed by this pass.',
    },
    source: {
      path: inputPath,
      osmSnapshot: 'great-britain-latest.osm.pbf, local snapshot dated 2026-08-04',
      licence: osmLicence,
    },
    totals,
    discoveredByCategory: discovery.categoryMatches,
    selectedAdditionsByCategory: byCategory,
    changedTowns: after
      .filter((town) => changedProjectIds.has(town.projectId))
      .map((town) => ({
        ...town,
        before: before.find((candidate) => candidate.projectId === town.projectId),
        additions: additions.filter((addition) => addition.projectId === town.projectId),
      })),
    researchQueue,
    townResearchQueue,
  };
  const markdown = [
    '# England broad visitor-attraction editorial pass',
    '',
    `Reviewed: ${reviewedDate}`,
    '',
    '## Result',
    '',
    `- English towns checked: ${totals.englishProjects}`,
    `- Towns changed: ${totals.changedTowns}`,
    `- Visitor highlights added: ${totals.addedVisitorHighlights}`,
    `- Towns with no See places: ${totals.zeroSeeBefore} before, ${totals.zeroSeeAfter} after`,
    `- Historic-only non-empty See lists: ${totals.historicOnlyBefore} before, ${totals.historicOnlyAfter} after`,
    `- Towns with fewer than three See places: ${totals.townsWithUnderThreeSeeBefore} before, ${totals.townsWithUnderThreeSeeAfter} after`,
    '',
    '## Editorial safeguards',
    '',
    '- Every addition is inside the active visitor boundary.',
    '- Automatic candidates cannot score 75 or above.',
    '- Town star ratings are unchanged.',
    '- Missing opening, pricing, dog and facility facts are queued rather than invented.',
    `- Towns requiring a future manual source review: ${townResearchQueue.length}.`,
    '- Full town-by-town additions and research needs are recorded in the JSON report.',
    '',
  ].join('\n');
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(reportMarkdownPath, markdown, 'utf8');
  console.log(
    JSON.stringify(
      { dryRun, reportPath, reportMarkdownPath, input: basename(inputPath), ...totals, byCategory },
      null,
      2,
    ),
  );
}

await main();
