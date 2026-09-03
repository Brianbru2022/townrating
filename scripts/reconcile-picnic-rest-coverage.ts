import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import type { PlannerCurationLibrary, PlannerCurationState } from '../src/domain/plannerCuration';

type PicnicKind = 'picnic_site' | 'picnic_table' | 'barbecue';
type RestKind = PicnicKind | 'bench' | 'outdoor_seating';

interface OsmRecord {
  osmId: string;
  osmType: 'node' | 'way';
  id: number;
  coordinates: [number, number];
  locationType: 'exact' | 'site_centroid';
  tags: Record<string, string>;
}

interface OsmCandidate extends OsmRecord {
  kind: RestKind;
}

interface ExtractedOsm {
  sourceFile: string;
  candidates: OsmCandidate[];
  anchors: OsmRecord[];
}

interface PlannerFile {
  schemaVersion: number;
  description: string;
  projects: PlannerCurationLibrary;
}

interface ProjectContext {
  filePath: string;
  pkg: ProjectPackage;
  boundary: Feature<Polygon | MultiPolygon>;
  bounds: [number, number, number, number];
  candidates: OsmCandidate[];
  anchors: OsmRecord[];
}

interface ProjectAudit {
  projectId: string;
  locality: string;
  genuinePicnicLocations: number;
  genuinePicnicFeaturesAdded: number;
  existingCuratedPicnicEntries: number;
  restBenchesAdded: number;
  finalCuratedPicnicAndRestEntries: number;
  excludedRestrictedCandidates: number;
  stillBelowFive: boolean;
}

const reviewedAt = '2026-08-11T00:00:00Z';
const extractPath = resolve(process.argv[2] ?? 'data/review/gb-picnic-rest-osm-2026-08-11.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const reportPath = resolve('data/review/picnic-rest-coverage-2026-08-11.json');
const minimumUsefulRestStops = 5;
const gridSize = 0.05;
const projectsWithoutUsableBoundary: Array<{ projectId: string; locality: string }> = [];

function positions(value: unknown, result: Array<[number, number]> = []): Array<[number, number]> {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === 'number')
  ) {
    result.push(value as [number, number]);
  } else if (Array.isArray(value)) {
    value.forEach((item) => positions(item, result));
  }
  return result;
}

function bounds(boundary: Feature<Polygon | MultiPolygon>): [number, number, number, number] {
  const all = positions(boundary.geometry.coordinates);
  return [
    Math.min(...all.map(([longitude]) => longitude)),
    Math.min(...all.map(([, latitude]) => latitude)),
    Math.max(...all.map(([longitude]) => longitude)),
    Math.max(...all.map(([, latitude]) => latitude)),
  ];
}

function gridCoordinate(value: number): number {
  return Math.floor(value / gridSize);
}

function gridKey(longitude: number, latitude: number): string {
  return `${gridCoordinate(longitude)}:${gridCoordinate(latitude)}`;
}

function distanceMetres(left: [number, number], right: [number, number]): number {
  const latitude = ((left[1] + right[1]) / 2) * (Math.PI / 180);
  const x = (right[0] - left[0]) * Math.cos(latitude) * 111_320;
  const y = (right[1] - left[1]) * 110_540;
  return Math.hypot(x, y);
}

function normalise(value: string | undefined): string {
  return (value ?? '')
    .toLocaleLowerCase('en-GB')
    .normalize('NFKD')
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isGenuinePicnic(kind: RestKind): kind is PicnicKind {
  return kind === 'picnic_site' || kind === 'picnic_table' || kind === 'barbecue';
}

function isRestricted(candidate: OsmCandidate): boolean {
  const { tags } = candidate;
  return Boolean(
    ['no', 'private', 'permit', 'customers', 'residents', 'military'].includes(tags.access ?? '') ||
    tags.disused ||
    tags.abandoned ||
    tags.demolished ||
    tags.closed === 'yes',
  );
}

function suitableFallback(candidate: OsmCandidate): boolean {
  if (!['bench', 'outdoor_seating'].includes(candidate.kind) || isRestricted(candidate))
    return false;
  const text = normalise(
    [candidate.tags.name, candidate.tags.description, candidate.tags.inscription]
      .filter(Boolean)
      .join(' '),
  );
  return !candidate.tags.memorial && !text.includes('memorial') && !text.includes('private');
}

function featureCoordinates(feature: HeritageFeature): [number, number] | undefined {
  return feature.geometry?.type === 'Point'
    ? (feature.geometry.coordinates as [number, number])
    : undefined;
}

function sourceRecordId(feature: HeritageFeature): string | undefined {
  return feature.sourceRecords
    ?.find((source) => source.sourceOrganisation.includes('OpenStreetMap'))
    ?.sourceRecordId;
}

function hasTag(feature: HeritageFeature, tag: string): boolean {
  return feature.tags.includes(tag);
}

function isExistingGenuinePicnic(feature: HeritageFeature): boolean {
  return Boolean(
    ['picnic_site', 'picnic_table', 'barbecue', 'bbq'].includes(feature.featureType) ||
    hasTag(feature, 'verified-picnic-facility') ||
    (hasTag(feature, 'service-context-picnic') && !hasTag(feature, 'picnic-rest-fallback')),
  );
}

function inside(location: [number, number], boundary: Feature<Polygon | MultiPolygon>): boolean {
  return booleanPointInPolygon(point(location), boundary);
}

function anchorName(anchor: OsmRecord): string | undefined {
  return anchor.tags.name ?? anchor.tags['name:en'] ?? anchor.tags.loc_name;
}

function anchorPriority(anchor: OsmRecord): number {
  if (
    ['park', 'garden', 'nature_reserve', 'recreation_ground', 'common'].includes(
      anchor.tags.leisure ?? '',
    )
  )
    return 5;
  if (['recreation_ground', 'village_green'].includes(anchor.tags.landuse ?? '')) return 4;
  if (['attraction', 'museum', 'viewpoint'].includes(anchor.tags.tourism ?? '')) return 3;
  if (anchor.tags.place === 'square' || anchor.tags.amenity === 'marketplace') return 3;
  return 1;
}

function nearestAnchor(
  location: [number, number],
  anchors: OsmRecord[],
  features: HeritageFeature[],
): { name: string; coordinates: [number, number] } | undefined {
  const osm = anchors
    .map((anchor) => ({
      name: anchorName(anchor),
      coordinates: anchor.coordinates,
      distance: distanceMetres(location, anchor.coordinates),
      priority: anchorPriority(anchor),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        name: string;
        coordinates: [number, number];
        distance: number;
        priority: number;
      } => Boolean(candidate.name && candidate.distance <= 280),
    )
    .sort((left, right) => right.priority - left.priority || left.distance - right.distance)[0];
  if (osm) return { name: osm.name, coordinates: osm.coordinates };

  const usefulTypes = new Set([
    'park',
    'garden',
    'designed_landscape',
    'square',
    'market',
    'harbour',
    'dock',
    'public_art',
    'museum',
    'castle',
    'palace',
  ]);
  const existing = features
    .filter((feature) => usefulTypes.has(feature.featureType))
    .map((feature) => ({ feature, coordinates: featureCoordinates(feature) }))
    .filter((entry): entry is { feature: HeritageFeature; coordinates: [number, number] } =>
      Boolean(entry.coordinates),
    )
    .map((entry) => ({ ...entry, distance: distanceMetres(location, entry.coordinates) }))
    .filter((entry) => entry.distance <= 220)
    .sort((left, right) => left.distance - right.distance)[0];
  return existing ? { name: existing.feature.name, coordinates: existing.coordinates } : undefined;
}

function compassName(
  location: [number, number],
  centre: [number, number],
  locality: string,
): string {
  const dx = (location[0] - centre[0]) * Math.cos(centre[1] * (Math.PI / 180));
  const dy = location[1] - centre[1];
  const distance = distanceMetres(location, centre);
  if (distance < 320) return `${locality} town-centre`;
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  const sectors = [
    'north',
    'north-east',
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
  ];
  const sector = sectors[Math.round((angle + 360) / 45) % 8];
  return `${sector} ${locality}`;
}

function baseLocationName(
  candidate: OsmCandidate,
  context: ProjectContext,
): { label: string; anchor?: { name: string; coordinates: [number, number] } } {
  const explicit = candidate.tags.name ?? candidate.tags['name:en'] ?? candidate.tags.loc_name;
  if (
    explicit &&
    !['bench', 'picnic table', 'picnic area', 'picnic site'].includes(normalise(explicit))
  ) {
    return { label: explicit };
  }
  const street = candidate.tags['addr:street'] ?? candidate.tags['addr:place'];
  if (street) return { label: street };
  const anchor = nearestAnchor(candidate.coordinates, context.anchors, context.pkg.features);
  if (anchor) return { label: anchor.name, anchor };
  return {
    label: compassName(
      candidate.coordinates,
      context.pkg.project.centre,
      context.pkg.project.locality,
    ),
  };
}

function sideOfAnchor(location: [number, number], anchor: [number, number]): string {
  const dx = location[0] - anchor[0];
  const dy = location[1] - anchor[1];
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'east-side' : 'west-side';
  return dy >= 0 ? 'north-side' : 'south-side';
}

function uniqueVisitorName(
  candidate: OsmCandidate,
  context: ProjectContext,
  used: Set<string>,
): string {
  const { label, anchor } = baseLocationName(candidate, context);
  const suffix = isGenuinePicnic(candidate.kind)
    ? candidate.kind === 'barbecue'
      ? 'barbecue and picnic spot'
      : 'picnic area'
    : 'rest bench';
  const first = `${label} ${suffix}`.replaceAll(/\s+/g, ' ').trim();
  if (!used.has(normalise(first))) {
    used.add(normalise(first));
    return first;
  }
  const qualified = anchor
    ? `${label} ${sideOfAnchor(candidate.coordinates, anchor.coordinates)} ${suffix}`
    : `${compassName(candidate.coordinates, context.pkg.project.centre, context.pkg.project.locality)} ${suffix}`;
  if (!used.has(normalise(qualified))) {
    used.add(normalise(qualified));
    return qualified;
  }
  let number = 2;
  const numberedName = (value: number) => `${qualified.slice(0, -suffix.length)}${value} ${suffix}`;
  while (used.has(normalise(numberedName(number)))) number += 1;
  const numbered = numberedName(number);
  used.add(normalise(numbered));
  return numbered;
}

function sourceRecord(candidate: OsmCandidate, sourceFile: string): SourceRecord {
  return {
    sourceName: 'OpenStreetMap current picnic and rest facilities',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceRecordId: candidate.osmId,
    sourceUrl: `https://www.openstreetmap.org/${candidate.osmId}`,
    accessedAt: reviewedAt,
    licence: 'Open Database Licence (ODbL) v1.0; (c) OpenStreetMap contributors.',
    notes: `Curated from ${sourceFile}. Current OSM tags: ${
      Object.entries(candidate.tags)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ') || 'facility type only'
    }.`,
    reliability: 'discovery_only',
  };
}

function createFeature(
  candidate: OsmCandidate,
  context: ProjectContext,
  sourceFile: string,
  usedNames: Set<string>,
): HeritageFeature {
  const fallback = !isGenuinePicnic(candidate.kind);
  const name = uniqueVisitorName(candidate, context, usedNames);
  return {
    id: `osm-picnic-rest:${candidate.osmType}-${candidate.id}`,
    projectId: context.pkg.project.id,
    name,
    alternativeNames: [],
    countryCode: context.pkg.project.countryCode,
    region: context.pkg.project.region,
    locality: context.pkg.project.locality,
    featureType: candidate.kind,
    significance: 'recognised',
    geometry: { type: 'Point', coordinates: candidate.coordinates },
    locationType: candidate.locationType,
    locationConfidence: candidate.locationType === 'exact' ? 'high' : 'medium',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription: fallback
      ? `A public rest bench included because ${context.pkg.project.locality} has fewer than five mapped picnic locations. It is useful for a pause, not presented as a formal picnic area.`
      : `A mapped public ${candidate.kind.replaceAll('_', ' ')} within the active ${context.pkg.project.locality} visitor boundary.`,
    sourceRecords: [sourceRecord(candidate, sourceFile)],
    licence: 'Open Database Licence (ODbL) v1.0; (c) OpenStreetMap contributors.',
    tags: [
      'current-context',
      'osm-community-place',
      'service-context-picnic',
      fallback ? 'picnic-rest-fallback' : 'verified-picnic-facility',
    ],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: fallback
      ? 'Public OSM bench checked inside the active visitor boundary and curated as a sparse-town rest fallback. It is not counted as a formal picnic facility.'
      : 'Public OSM picnic facility checked inside the active visitor boundary and curated for the visitor planner.',
    evidenceScope: 'parish_evidence',
  };
}

function existingCoversCandidate(
  candidate: OsmCandidate,
  features: HeritageFeature[],
  curatedIds: Set<string>,
  distance = 35,
): boolean {
  return features.some((feature) => {
    if (!curatedIds.has(feature.id)) return false;
    if (sourceRecordId(feature) === candidate.osmId) return true;
    const coordinates = featureCoordinates(feature);
    return coordinates ? distanceMetres(candidate.coordinates, coordinates) <= distance : false;
  });
}

function candidateScore(candidate: OsmCandidate, context: ProjectContext): number {
  const name = candidate.tags.name ?? candidate.tags['addr:street'] ?? candidate.tags['addr:place'];
  const anchor = nearestAnchor(candidate.coordinates, context.anchors, context.pkg.features);
  return (
    Number(Boolean(name)) * 100 +
    Number(Boolean(anchor)) * 60 +
    Number(candidate.tags.backrest === 'yes') * 8 +
    Number(candidate.tags.covered === 'yes' || candidate.tags.shelter === 'yes') * 5 -
    distanceMetres(candidate.coordinates, context.pkg.project.centre) / 2_000
  );
}

async function loadProjects(planner: PlannerFile): Promise<ProjectContext[]> {
  const projectIds = new Set(Object.keys(planner.projects));
  const files = (await readdir(resolve('data/projects'), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => resolve('data/projects', entry.name));
  const contexts: ProjectContext[] = [];
  const locatedProjectIds = new Set<string>();
  for (const filePath of files) {
    const pkg = JSON.parse(await readFile(filePath, 'utf8')) as ProjectPackage;
    if (!projectIds.has(pkg.project.id)) continue;
    locatedProjectIds.add(pkg.project.id);
    const boundary = pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;
    if (!boundary?.geometry || positions(boundary.geometry.coordinates).length < 3) {
      projectsWithoutUsableBoundary.push({
        projectId: pkg.project.id,
        locality: pkg.project.locality,
      });
      continue;
    }
    contexts.push({
      filePath,
      pkg,
      boundary,
      bounds: bounds(boundary),
      candidates: [],
      anchors: [],
    });
  }
  const processedProjectIds = new Set(contexts.map((context) => context.pkg.project.id));
  for (let index = projectsWithoutUsableBoundary.length - 1; index >= 0; index -= 1) {
    if (processedProjectIds.has(projectsWithoutUsableBoundary[index].projectId)) {
      projectsWithoutUsableBoundary.splice(index, 1);
    }
  }
  const missing = [...projectIds].filter((projectId) => !locatedProjectIds.has(projectId));
  if (missing.length) throw new Error(`Could not locate project JSON for: ${missing.join(', ')}`);
  return contexts;
}

function buildSpatialIndex(contexts: ProjectContext[]): Map<string, ProjectContext[]> {
  const index = new Map<string, ProjectContext[]>();
  for (const context of contexts) {
    const [west, south, east, north] = context.bounds;
    for (let x = gridCoordinate(west); x <= gridCoordinate(east); x += 1) {
      for (let y = gridCoordinate(south); y <= gridCoordinate(north); y += 1) {
        const key = `${x}:${y}`;
        const entries = index.get(key) ?? [];
        entries.push(context);
        index.set(key, entries);
      }
    }
  }
  return index;
}

function assignToProjects(
  records: Array<OsmCandidate | OsmRecord>,
  index: Map<string, ProjectContext[]>,
  target: 'candidates' | 'anchors',
): void {
  for (const record of records) {
    for (const context of index.get(gridKey(...record.coordinates)) ?? []) {
      const [west, south, east, north] = context.bounds;
      const [longitude, latitude] = record.coordinates;
      if (longitude < west || longitude > east || latitude < south || latitude > north) continue;
      if (!inside(record.coordinates, context.boundary)) continue;
      if (target === 'candidates') context.candidates.push(record as OsmCandidate);
      else context.anchors.push(record);
    }
  }
}

const extracted = JSON.parse(await readFile(extractPath, 'utf8')) as ExtractedOsm;
const planner = JSON.parse(await readFile(curationPath, 'utf8')) as PlannerFile;
const contexts = await loadProjects(planner);
const spatialIndex = buildSpatialIndex(contexts);
assignToProjects(extracted.candidates, spatialIndex, 'candidates');
assignToProjects(extracted.anchors, spatialIndex, 'anchors');

const audit: ProjectAudit[] = [];
for (const context of contexts) {
  const curation: PlannerCurationState = planner.projects[context.pkg.project.id] ?? {};
  const curated = new Set(curation.picnic ?? []);
  const usedNames = new Set(
    context.pkg.features
      .filter((feature) => curated.has(feature.id))
      .map((feature) => normalise(feature.name)),
  );
  const initialCuratedCount = curated.size;
  const eligiblePicnic = context.candidates
    .filter((candidate) => isGenuinePicnic(candidate.kind) && !isRestricted(candidate))
    .sort((left, right) => candidateScore(right, context) - candidateScore(left, context));
  const restricted = context.candidates.filter(isRestricted).length;
  let genuineAdded = 0;

  for (const candidate of eligiblePicnic) {
    if (existingCoversCandidate(candidate, context.pkg.features, curated)) continue;
    const feature = createFeature(candidate, context, extracted.sourceFile, usedNames);
    context.pkg.features.push(feature);
    curated.add(feature.id);
    genuineAdded += 1;
  }

  let genuineCount = context.pkg.features.filter(
    (feature) => curated.has(feature.id) && isExistingGenuinePicnic(feature),
  ).length;
  let restAdded = 0;
  if (genuineCount < minimumUsefulRestStops) {
    const selectedLocations = context.pkg.features
      .filter((feature) => curated.has(feature.id))
      .map(featureCoordinates)
      .filter((coordinates): coordinates is [number, number] => Boolean(coordinates));
    const fallbacks = context.candidates
      .filter(suitableFallback)
      .sort((left, right) => candidateScore(right, context) - candidateScore(left, context));
    for (const candidate of fallbacks) {
      if (curated.size >= minimumUsefulRestStops) break;
      if (existingCoversCandidate(candidate, context.pkg.features, curated, 24)) continue;
      if (
        selectedLocations.some((location) => distanceMetres(location, candidate.coordinates) < 90)
      )
        continue;
      const feature = createFeature(candidate, context, extracted.sourceFile, usedNames);
      context.pkg.features.push(feature);
      curated.add(feature.id);
      selectedLocations.push(candidate.coordinates);
      restAdded += 1;
    }
  }

  genuineCount = context.pkg.features.filter(
    (feature) => curated.has(feature.id) && isExistingGenuinePicnic(feature),
  ).length;
  planner.projects[context.pkg.project.id] = {
    ...curation,
    picnic: [...curated],
  };
  if (genuineAdded || restAdded) {
    context.pkg.features.sort((left, right) => left.name.localeCompare(right.name));
    await writeFile(context.filePath, `${JSON.stringify(context.pkg, null, 2)}\n`, 'utf8');
  }
  audit.push({
    projectId: context.pkg.project.id,
    locality: context.pkg.project.locality,
    genuinePicnicLocations: genuineCount,
    genuinePicnicFeaturesAdded: genuineAdded,
    existingCuratedPicnicEntries: initialCuratedCount,
    restBenchesAdded: restAdded,
    finalCuratedPicnicAndRestEntries: curated.size,
    excludedRestrictedCandidates: restricted,
    stillBelowFive: curated.size < minimumUsefulRestStops,
  });
  if (genuineAdded || restAdded) {
    console.log(
      `${context.pkg.project.locality}: +${genuineAdded} picnic, +${restAdded} rest benches (${curated.size} total)`,
    );
  }
}

await writeFile(curationPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
const summary = {
  schemaVersion: 1,
  generatedAt: reviewedAt,
  sourceFile: extracted.sourceFile,
  rule: 'Keep every distinct public OSM picnic facility inside the active visitor boundary. When fewer than five genuine picnic locations exist, add suitable public benches or outdoor seating as clearly labelled rest fallbacks, up to five combined entries.',
  projectsChecked: audit.length,
  projectsWithPicnicOrRestAdded: audit.filter(
    (entry) => entry.genuinePicnicFeaturesAdded > 0 || entry.restBenchesAdded > 0,
  ).length,
  genuinePicnicFeaturesAdded: audit.reduce(
    (sum, entry) => sum + entry.genuinePicnicFeaturesAdded,
    0,
  ),
  restBenchesAdded: audit.reduce((sum, entry) => sum + entry.restBenchesAdded, 0),
  projectsStillBelowFive: audit.filter((entry) => entry.stillBelowFive).length,
  projectsSkippedWithoutUsableBoundary: projectsWithoutUsableBoundary,
  projects: audit.sort((left, right) => left.locality.localeCompare(right.locality)),
};
await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`Wrote ${reportPath}`);
