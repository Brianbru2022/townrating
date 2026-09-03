import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import {
  area,
  booleanPointInPolygon,
  buffer,
  distance,
  point,
  pointOnFeature,
  simplify,
} from '@turf/turf';
import type { Feature, Geometry, MultiPolygon, Point, Polygon } from 'geojson';
import { extractHistoricEnglandDate } from '../src/domain/historicDateExtraction';
import type {
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
  VisitorHighlight,
} from '../src/domain/models';
import type { PlannerCurationState } from '../src/domain/plannerCuration';
import {
  townRatingEvidenceForProject,
  townRatingFromEvidence,
  townRatingLabels,
  townRatingSummary,
} from '../src/domain/townRating';
import {
  currentPlaceInfo,
  osmTagValue,
  parkingPriceStatus,
  visitorPlaceType,
} from '../src/domain/visitorExperience';
import {
  foodRecommendation,
  trailRecommendation,
  visitRecommendation,
} from '../src/domain/visiting';

const reviewedDate = '2026-08-09';
const reviewedAt = `${reviewedDate}T00:00:00Z`;
const projectsDirectory = resolve('data/projects');
const reviewDirectory = resolve('data/review');
const curationPath = resolve('data/visitor-planner-curation.json');
const settlementBatchAuditPaths = [
  resolve(`data/review/northamptonshire-settlement-batch-audit-${reviewedDate}.json`),
  resolve(`data/review/cambridgeshire-settlement-batch-audit-${reviewedDate}.json`),
];
const reportJsonPath = resolve(
  `data/review/england-publication-compliance-${reviewedDate}.json`,
);
const reportMarkdownPath = resolve(
  `data/review/england-publication-compliance-${reviewedDate}.md`,
);

type VisitorBoundary = Feature<Polygon | MultiPolygon>;
type CuratedNeed = 'eat' | 'trails' | 'picnic' | 'parking' | 'toilets';
type Severity = 'error' | 'warning' | 'notice';

interface Finding {
  severity: Severity;
  code: string;
  message: string;
  itemId?: string;
}

interface OfficialTextRecord {
  featureId: string;
  listEntry: string;
  name: string;
  designationType: string;
  sourceUrl: string;
  details: string;
}

interface OfficialTextAudit {
  accessedAt: string;
  source: string;
  records: OfficialTextRecord[];
  errors: Array<{ featureId: string; reason: string }>;
}

interface CurationLibraryFile {
  schemaVersion: number;
  description: string;
  projects: Record<string, PlannerCurationState>;
}

interface SettlementBatchAuditFile {
  createdProjects?: Array<Record<string, unknown> & { projectId?: string }>;
  auditedAt?: string;
}

interface TownAudit {
  projectId: string;
  locality: string;
  file: string;
  rating: number;
  features: number;
  boundary: {
    officialAreaHectares: number;
    visitorAreaHectares: number;
    increasePercent: number;
    closingMetres?: number;
    preservedExistingCuratedBoundary: boolean;
  };
  heritageDates: {
    statutoryRecords: number;
    datedStatutoryRecords: number;
    newlyRestored: number;
    unresolved: number;
  };
  categories: Record<string, number>;
  standaloneAttractions: number;
  findings: Finding[];
}

const specialCuratedBoundaries = new Set([
  'bletchley-england',
  'brampton-huntingdonshire-england',
  'corby-england',
  'deeping-st-james-england',
  'desborough-england',
  'higham-ferrers-england',
  'irthlingborough-england',
  'market-deeping-england',
  'milton-keynes-england',
  'northampton-england',
  'oakham-england',
  'peterborough-england',
  'sawtry-england',
  'wellingborough-england',
]);
const specialBoundaryClosingKilometres = new Map([
  ['northampton-england', 0.3],
  ['peterborough-england', 0.2],
  ['sawtry-england', 0.15],
]);
const preservedVisitorBoundaryProperties = new Map<string, Record<string, unknown>>([
  [
    'peterborough-england',
    {
      sourceDataset: 'Curated Peterborough visitor study boundary',
      visitorExtensionReviewedAt: '2026-08-07',
    },
  ],
]);
const restrictedPracticalAccess = /^(private|permit|residents|no|customers)$/i;
const genericPracticalNames: Record<'picnic' | 'parking' | 'toilets', RegExp> = {
  picnic: /^(picnic site|picnic area|picnic table)(?:\s+\d+)?$/i,
  parking: /^(parking|car park|public car park)(?:\s+\d+)?$/i,
  toilets: /^(public toilets|toilets)(?:\s+\d+)?$/i,
};

const reviewedPracticalNames = new Map<string, string>([
  ['osm-community:way-179408522', 'Bletchley Central NCP car park'],
  ['osm-community:node-10015564337', 'Bletchley Station public toilets'],
  ['osm-community:way-471834494', 'London Road car park'],
  ['osm-community:node-4347773590', 'Chandos Park public toilets'],
  ['osm-community:way-989187436', 'Trinity Bridge car park'],
  ['osm-community:way-976231027', 'Bartholomew Close public toilets'],
  ['osm-community:way-659728278', 'Chichele College car park'],
  ['osm-community:node-6715658087', 'Riverside Park public toilets'],
  ['osm-community:node-9439262515', "St Benedict's Court public toilets"],
  ['osm-community:node-13176589617', 'Huntingdon Library accessible toilet'],
  ['osm-community:way-316949127', "Les O'Dell Park car park"],
  ['osm-community:way-1001861559', 'North Park car park'],
  ['osm-community:node-4417238578', 'Wicksteed Park main-entrance toilets'],
  ['osm-community:node-13512771011', 'London Road car park public toilets'],
  ['osm-community:way-908194948', 'The Square car park'],
  ['osm-community:way-914391593', 'Greenlands car park'],
  ['osm-community:way-907860138', 'Market Place public toilets'],
  ['osm-community:way-34696996', 'Furzton Lake car park'],
  ['osm-community:way-199214730', 'Woolstone Green car park'],
  ['osm-community:way-379665394', 'Clocktower car park'],
  ['osm-community:way-393571029', 'Leys Road car park'],
  ['osm-community:way-654703013', 'Oakridge Park Local Centre car park'],
  ['osm-community:way-1003658318', 'Midsummer Place car park'],
  ['osm-community:node-11400856573', 'Midsummer Place public toilets'],
  ['osm-community:node-4498509691', 'Lodge Lake picnic area'],
  ['osm-community:node-4962648623', 'Howe Park Wood picnic area'],
  ['osm-community:way-435768838', 'War Memorial car park'],
  ['osm-community:node-2344589371', 'High Street public toilets'],
  ['osm-community:way-798041565', 'Far Cotton Recreation Ground car park'],
  ['osm-community:way-1031507371', 'Castle Mound car park'],
  ['osm-community:way-1449262832', 'Longford Avenue open-space car park'],
  ['osm-community:node-6581745489', 'Abington Park Walled Garden toilets'],
  ['osm-community:node-9983584116', 'Abington Park east public toilets'],
  ['osm-community:way-893169368', 'Burley Road car park'],
  ['osm-community:node-2690815444', 'Church Street public toilets'],
  ['osm-community:way-542351957', 'War Memorial car park'],
  ['osm-community:way-97499261', 'Long-stay car park public toilets'],
  ['osm-community:way-116328210', 'Market Place public toilets'],
  ['osm-community:way-229146418', "St George's Square car park"],
  ['osm-community:way-238799053', "St Peter's Square car park"],
  ['osm-community:way-440862505', 'Red Lion Square public toilets'],
  ['osm-community:way-1358376649', 'Queensway Park car park'],
  ['osm-community:node-4225296016', 'Swanspool Gardens public toilets'],
]);

const duplicatePracticalFeatureIds = new Set([
  'osm-community:way-33915443', // Duplicates the source-backed Brook Street Council car park.
  'osm-community:node-4962651522',
  'osm-community:node-4962651524',
  'osm-community:node-4962652522',
  'osm-community:way-976231027', // OSM notes this Crowland toilet was closed; West Street is the current council facility.
  'osm-community:way-1097376433', // Not present on the current council-operated toilet list.
  'osm-community:way-178647586', // Generic institution-style parking, not a useful destination car park.
  'osm-community:way-833816539', // Generic area label with no visitor-facing destination.
  'osm-community:node-2447620069', // Petrol-station customer toilet, not a dependable public facility.
  'osm-community:way-106361736', // Business-operated customer parking.
  'osm-community:way-359180861', // Specialist centre/shop parking rather than general visitor parking.
]);

function ensureOfficialPracticalFeatures(
  pkg: ProjectPackage,
  state: PlannerCurationState,
  findings: Finding[],
): void {
  if (pkg.project.id !== 'crowland-england') return;

  const featureId = 'south-holland-council:west-street-crowland-toilets';
  if (!pkg.features.some((feature) => feature.id === featureId)) {
    pkg.features.push({
      id: featureId,
      projectId: pkg.project.id,
      name: 'West Street public toilets',
      alternativeNames: [],
      countryCode: pkg.project.countryCode,
      region: pkg.project.region,
      locality: pkg.project.locality,
      featureType: 'toilets',
      significance: 'local',
      geometry: { type: 'Point', coordinates: [-0.1692443, 52.6755938] },
      locationType: 'representative_point',
      locationConfidence: 'high',
      dateBasis: 'unknown',
      dateConfidence: 'unknown',
      survival: 'substantially_intact',
      shortDescription:
        'Council-maintained public toilets on West Street, open daily during published daytime hours.',
      sourceRecords: [
        {
          sourceName: 'South Holland District Council public toilets',
          sourceOrganisation: 'South Holland District Council',
          sourceRecordId: 'west-street-crowland-public-toilets',
          sourceUrl: 'https://www.sholland.gov.uk/article/5190/Toilets',
          accessedAt: reviewedAt,
          reliability: 'official_non_statutory',
          licence:
            'Official council facility listing; coordinates use the council-linked public toilet map.',
          notes:
            'West Street, Crowland; open daily between 8am and 4pm; disabled facilities available by RADAR key.',
        },
      ],
      tags: [
        `${pkg.project.id}-visitor-audit`,
        'current-context',
        'service-context-toilets',
        'council-current-place',
      ],
      createdAt: reviewedAt,
      updatedAt: reviewedAt,
      reviewed: true,
      reviewNotes:
        `Current public facility checked against the council listing and linked council map ${reviewedDate}.`,
      evidenceScope: 'related_context',
      licence: 'Original editorial summary; factual visitor metadata from the linked council source.',
    });
    findings.push({
      severity: 'notice',
      code: 'toilets.official-facility-added',
      itemId: featureId,
      message:
        'West Street public toilets replaced the closed OSM toilet record using the current council listing.',
    });
  }

  const toilets = (state.toilets ??= []);
  if (!toilets.includes(featureId)) toilets.push(featureId);
}

function normalise(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function featurePoint(feature: HeritageFeature): Feature<Point> | undefined {
  if (!feature.geometry) return undefined;
  if (feature.geometry.type === 'Point') {
    return point(feature.geometry.coordinates);
  }
  try {
    return pointOnFeature({
      type: 'Feature',
      properties: {},
      geometry: feature.geometry,
    } as Feature<Geometry>);
  } catch {
    return undefined;
  }
}

function featureInsideBoundary(
  feature: HeritageFeature,
  boundary: VisitorBoundary,
): boolean {
  const location = featurePoint(feature);
  return location ? booleanPointInPolygon(location, boundary) : false;
}

function areaHectares(boundary: VisitorBoundary): number {
  return area(boundary) / 10_000;
}

function closingDistanceKilometres(projectId: string, hectares: number): number {
  if (projectId === 'milton-keynes-england') return 0.1;
  if (hectares >= 1_000) return 0.4;
  if (hectares >= 500) return 0.3;
  if (hectares >= 200) return 0.2;
  return 0.15;
}

function morphologicallyCloseBoundary(
  boundary: VisitorBoundary,
  closingDistance: number,
): VisitorBoundary | undefined {
  const simplified = simplify(boundary, {
    tolerance: 0.00006,
    highQuality: true,
    mutate: false,
  });
  const expanded = buffer(simplified, closingDistance, {
    units: 'kilometers',
    steps: 3,
  });
  const closed = expanded
    ? buffer(expanded, -closingDistance, { units: 'kilometers', steps: 3 })
    : undefined;
  return closed as VisitorBoundary | undefined;
}

function createVisitorBoundary(pkg: ProjectPackage): {
  boundary: VisitorBoundary;
  closingMetres?: number;
  preservedExisting: boolean;
  finding?: Finding;
} {
  const studyArea = pkg.project.townStudyArea;
  if (!studyArea?.localityBoundary) {
    return {
      boundary: pkg.project.boundary,
      preservedExisting: true,
      finding: {
        severity: 'error',
        code: 'boundary.missing-official',
        message: 'No preserved official locality boundary is available.',
      },
    };
  }
  const official = structuredClone(studyArea.localityBoundary) as VisitorBoundary;
  const officialHectares = areaHectares(official);
  const hasSpecialCuratedBoundary = specialCuratedBoundaries.has(pkg.project.id);
  const baseBoundary = hasSpecialCuratedBoundary
    ? structuredClone(studyArea.visitorBoundary ?? pkg.project.boundary)
    : official;
  const baseHectares = areaHectares(baseBoundary);
  const closingDistance =
    specialBoundaryClosingKilometres.get(pkg.project.id) ??
    closingDistanceKilometres(pkg.project.id, officialHectares);
  const closed = morphologicallyCloseBoundary(baseBoundary, closingDistance);
  if (!closed) {
    return {
      boundary: studyArea.visitorBoundary ?? pkg.project.boundary,
      preservedExisting: true,
      finding: {
        severity: 'error',
        code: 'boundary.close-failed',
        message: 'Could not generate a visitor boundary from the official geometry.',
      },
    };
  }

  const visitorBoundary = closed as VisitorBoundary;
  const visitorHectares = areaHectares(visitorBoundary);
  const increasePercent = ((visitorHectares - baseHectares) / baseHectares) * 100;
  if (increasePercent > 30) {
    return {
      boundary: studyArea.visitorBoundary ?? pkg.project.boundary,
      preservedExisting: true,
      finding: {
        severity: 'notice',
        code: 'boundary.expansion-refused',
        message: `Automatic green-space closing would add ${increasePercent.toFixed(1)}% to the active boundary, so the existing boundary was safely retained.`,
      },
    };
  }

  const baseProperties = baseBoundary.properties ?? {};
  visitorBoundary.properties = {
    ...baseProperties,
    name: hasSpecialCuratedBoundary
      ? (baseProperties.name ?? `${pkg.project.locality} curated visitor boundary`)
      : `${pkg.project.locality} curated visitor boundary`,
    sourceDataset: hasSpecialCuratedBoundary
      ? (baseProperties.sourceDataset ?? `Curated ${pkg.project.locality} visitor boundary`)
      : `Curated ${pkg.project.locality} visitor boundary`,
    originalSourceDataset: studyArea.sourceName,
    originalLocalityCode: studyArea.localityCode,
    methodology: hasSpecialCuratedBoundary
      ? `Morphological closing of the existing curated visitor boundary using a ${Math.round(closingDistance * 1_000)} metre outward and inward buffer. This preserves its deliberate visitor extensions while filling internal omissions for connected parks, river corridors and visitor green spaces.`
      : `Morphological closing of the preserved official built-up-area geometry using a ${Math.round(closingDistance * 1_000)} metre outward and inward buffer. This fills internal omissions for connected parks, river corridors and visitor green spaces without applying a general outward town buffer.`,
    notAdministrativeBoundary: true,
    reviewedAt: reviewedDate,
    ...(preservedVisitorBoundaryProperties.get(pkg.project.id) ?? {}),
  };
  return {
    boundary: visitorBoundary,
    closingMetres: Math.round(closingDistance * 1_000),
    preservedExisting: hasSpecialCuratedBoundary,
  };
}

function detail(feature: HeritageFeature, key: string): string | undefined {
  return currentPlaceInfo(feature).currentDetails.find((item) => item.key === key)?.value;
}

function sourceDetail(feature: HeritageFeature, key: string): string | undefined {
  return osmTagValue(feature, key) ?? detail(feature, key);
}

function trailScore(feature: HeritageFeature): number | undefined {
  const value = Number(detail(feature, 'trail_score') ?? detail(feature, 'visit_score'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function addCurrentDetail(
  feature: HeritageFeature,
  details: Record<string, string | number>,
  note: string,
): void {
  const serialised = Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
  const source: SourceRecord = {
    sourceName: 'Townscape Guides publication curation',
    sourceOrganisation: 'Townscape Guides',
    sourceRecordId: `${feature.id}:publication-review:${reviewedDate}`,
    sourceUrl: feature.sourceRecords.map((item) => item.sourceUrl).find(Boolean),
    accessedAt: reviewedAt,
    reliability: 'secondary',
    licence: 'Original editorial curation derived from the linked source record.',
    notes: `Current-place curation: ${serialised}; review_note=${note}`,
  };
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (item) => item.sourceRecordId !== source.sourceRecordId,
    ),
    source,
  ];
  feature.updatedAt = reviewedAt;
}

function nearestAnchor(
  feature: HeritageFeature,
  pkg: ProjectPackage,
): HeritageFeature | undefined {
  const from = featurePoint(feature);
  if (!from) return undefined;
  const candidates = pkg.features
    .filter((candidate) => candidate.id !== feature.id && !candidate.tags.includes('home-standalone-place'))
    .filter(
      (candidate) =>
        candidate.tags.includes('visitor-highlight') ||
        candidate.tags.includes('service-context-visitor') ||
        visitorPlaceType(candidate) === 'attraction',
    )
    .filter((candidate) => {
      const name = candidate.name.trim();
      return (
        name.length > 3 &&
        !/^(parking|car park|public car park|public toilets|toilets|picnic site|picnic area|picnic table)$/i.test(
          name,
        )
      );
    })
    .map((candidate) => {
      const location = featurePoint(candidate);
      return location
        ? { candidate, kilometres: distance(from, location, { units: 'kilometers' }) }
        : undefined;
    })
    .filter(
      (candidate): candidate is { candidate: HeritageFeature; kilometres: number } =>
        Boolean(candidate && candidate.kilometres <= 0.6),
    )
    .sort((left, right) => left.kilometres - right.kilometres);
  return candidates[0]?.candidate;
}

function hasCurrentOsmSource(feature: HeritageFeature): boolean {
  return (
    feature.tags.includes('osm-current-place') ||
    feature.sourceRecords.some(
      (source) => source.sourceName === 'OpenStreetMap current community places',
    )
  );
}

function practicalPublicationExclusion(
  feature: HeritageFeature,
  need: 'picnic' | 'parking' | 'toilets',
): string | undefined {
  if (duplicatePracticalFeatureIds.has(feature.id)) return 'duplicate of a stronger curated record';
  if (!hasCurrentOsmSource(feature) || reviewedPracticalNames.has(feature.id)) return undefined;

  const name = feature.name.trim();
  const evidence = normalise(
    [name, feature.shortDescription, ...feature.sourceRecords.map((source) => source.notes)]
      .filter(Boolean)
      .join(' '),
  );

  if (genericPracticalNames[need].test(name)) return 'generic or numbered OSM label';
  if (/^(?:public )?(?:car park|toilets|picnic (?:area|site|table)) near\b/i.test(name)) {
    return 'automatic nearby-place label without a reviewed public facility name';
  }

  if (need === 'parking') {
    if (
      /\b(?:coach(?:es)? only|coach parking|coach park|drop off|hospital|nhs|patients|staff|tool station|sales display|school parking)\b/.test(
        evidence,
      ) ||
      /^(?:disabled(?:\s*&\s*premier)?|pick u?o\/drop off|car park[-\s]*\d+|p\d+)\b/i.test(name)
    ) {
      return 'specialist, institutional or restricted parking rather than a general visitor car park';
    }
  }

  if (need === 'toilets') {
    if (/\b(?:customers only|staff only|private toilet|shop hours only)\b/.test(evidence)) {
      return 'customer, staff or private toilet rather than a dependable public facility';
    }
  }

  return undefined;
}

function applyReviewedPracticalName(
  feature: HeritageFeature,
  need: 'picnic' | 'parking' | 'toilets',
): boolean {
  const reviewedName = reviewedPracticalNames.get(feature.id);
  if (!reviewedName || feature.name === reviewedName) return false;
  feature.name = reviewedName;
  feature.shortDescription =
    need === 'parking'
      ? `${reviewedName} is a mapped public visitor parking option. Check the on-site signs for current restrictions and tariffs.`
      : need === 'toilets'
        ? `${reviewedName} is mapped as a public visitor facility.`
        : `${reviewedName} provides mapped outdoor picnic seating.`;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = `${feature.reviewNotes ?? ''} Public-facing practical name manually reviewed ${reviewedDate}.`
    .replace(/\s+/g, ' ')
    .trim();
  return true;
}

function improveGenericPracticalName(
  feature: HeritageFeature,
  need: 'picnic' | 'parking' | 'toilets',
  pkg: ProjectPackage,
): boolean {
  if (!genericPracticalNames[need].test(feature.name.trim())) return false;
  const anchor = nearestAnchor(feature, pkg);
  const street =
    sourceDetail(feature, 'addr:street') ??
    sourceDetail(feature, 'street') ??
    sourceDetail(feature, 'loc_name');
  const location = street ?? anchor?.name ?? pkg.project.locality;
  const prefix =
    need === 'parking' ? 'Car park' : need === 'toilets' ? 'Public toilets' : 'Picnic area';
  feature.name = `${prefix} near ${location}`;
  feature.shortDescription =
    need === 'parking'
      ? `Public parking close to ${location}. Check the on-site signs for current restrictions and tariffs.`
      : need === 'toilets'
        ? `Public toilets close to ${location}.`
        : `Picnic provision close to ${location}.`;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = `${feature.reviewNotes ?? ''} Location-specific public name normalised ${reviewedDate}.`
    .replace(/\s+/g, ' ')
    .trim();
  return true;
}

function officialTextForProject(
  pkg: ProjectPackage,
  audits: Array<{ path: string; audit: OfficialTextAudit }>,
): { path: string; audit: OfficialTextAudit } | undefined {
  const featureIds = new Set(pkg.features.map((feature) => feature.id));
  return audits
    .map((entry) => ({
      ...entry,
      matches: entry.audit.records.filter((record) => featureIds.has(record.featureId)).length,
    }))
    .filter((entry) => entry.matches > 0)
    .sort((left, right) => right.matches - left.matches)[0];
}

function restoreHistoricEnglandDates(
  pkg: ProjectPackage,
  officialText?: { path: string; audit: OfficialTextAudit },
): {
  statutoryRecords: number;
  datedStatutoryRecords: number;
  newlyRestored: number;
  unresolved: number;
  audit: object;
} {
  const nhleFeatures = pkg.features.filter((feature) => feature.tags.includes('nhle'));
  const recordsByFeatureId = new Map(
    officialText?.audit.records.map((record) => [record.featureId, record]) ?? [],
  );
  let newlyRestored = 0;
  const unresolved: Array<{ featureId: string; name: string; reason: string }> = [];
  const enriched: Array<{ featureId: string; name: string; evidenceText: string }> = [];

  for (const feature of nhleFeatures) {
    if (feature.earliestPossibleYear !== undefined || feature.latestPossibleYear !== undefined) {
      continue;
    }
    const record = recordsByFeatureId.get(feature.id);
    if (!record) {
      unresolved.push({
        featureId: feature.id,
        name: feature.name,
        reason: 'No locally captured Historic England list-entry text is available.',
      });
      continue;
    }
    const extracted = extractHistoricEnglandDate(
      feature.designationType === 'scheduled_monument'
        ? `${record.name}. ${record.details}`
        : record.details,
    );
    if (!extracted) {
      unresolved.push({
        featureId: feature.id,
        name: feature.name,
        reason: 'No defensible historic date expression was found in the official text.',
      });
      continue;
    }
    const evidenceSource: SourceRecord = {
      sourceName: 'Historic England official list entry date evidence',
      sourceOrganisation: 'Historic England',
      sourceRecordId: record.listEntry,
      sourceUrl: record.sourceUrl,
      accessedAt: reviewedAt,
      reliability: 'official_statutory',
      licence: 'Open Government Licence v3.0; contains Historic England data.',
      notes: `Earliest dated fabric or historic component normalised from the official list-entry wording: ${extracted.evidenceText}`,
    };
    feature.documentedDateText = extracted.evidenceText;
    feature.earliestPossibleYear = extracted.earliestPossibleYear;
    feature.latestPossibleYear = extracted.latestPossibleYear;
    feature.datePrecision = extracted.datePrecision;
    feature.dateBasis = extracted.dateBasis;
    feature.dateConfidence = extracted.dateConfidence;
    feature.sourceRecords = [
      ...feature.sourceRecords.filter((source) => source.sourceName !== evidenceSource.sourceName),
      evidenceSource,
    ];
    feature.tags = [...new Set([...feature.tags, 'historic-england-date-enriched'])];
    feature.reviewed = true;
    feature.updatedAt = reviewedAt;
    feature.reviewNotes = `${feature.reviewNotes ?? ''} Earliest dated fabric normalised from official Historic England text on ${reviewedDate}; listing and restoration dates were excluded.`
      .replace(/\s+/g, ' ')
      .trim();
    newlyRestored += 1;
    enriched.push({
      featureId: feature.id,
      name: feature.name,
      evidenceText: extracted.evidenceText,
    });
  }

  const datedStatutoryRecords = nhleFeatures.filter(
    (feature) =>
      feature.earliestPossibleYear !== undefined || feature.latestPossibleYear !== undefined,
  ).length;
  return {
    statutoryRecords: nhleFeatures.length,
    datedStatutoryRecords,
    newlyRestored,
    unresolved: unresolved.length,
    audit: {
      projectId: pkg.project.id,
      reviewedAt,
      sourcePath: officialText?.path,
      methodology:
        'Restored the earliest defensible dated fabric from locally captured official Historic England list-entry text. Administrative listing dates and restoration-only dates were excluded.',
      counts: {
        nhleRecords: nhleFeatures.length,
        restored: newlyRestored,
        datedAfterEnrichment: datedStatutoryRecords,
        unresolved: unresolved.length,
      },
      enriched,
      unresolved,
    },
  };
}

function highlightScore(highlight: VisitorHighlight, feature?: HeritageFeature): number {
  if (Number.isFinite(highlight.visitorScore)) return Number(highlight.visitorScore);
  void feature;
  return 0;
}

function isWeakAutomaticHighlight(
  highlight: VisitorHighlight,
  feature: HeritageFeature,
): boolean {
  const name = feature.name.trim();
  const nhleRecord = feature.tags.includes('nhle') || feature.id.startsWith('historic-england:');
  const score = highlightScore(highlight, feature);
  const editoriallyCurated =
    score >= 75 ||
    feature.sourceRecords.some(
      (source) =>
        source.reliability !== 'discovery_only' &&
        /(?:publication curation|visitor audit|visitor research)/i.test(source.sourceName),
    );
  if (
    !editoriallyCurated &&
    (/^(?:NOS?\.?\s*)?\d+[A-Z]?(?:\s*(?:-|AND|TO|&)\s*\d+[A-Z]?)?\s*(?:,|-)?\s+/i.test(name) ||
      /\b(?:AVENUE|CLOSE|DRIVE|LANE|MEWS|ROAD|STREET|WAY)\s*$/i.test(name))
  ) {
    return true;
  }
  if (
    nhleRecord &&
    !editoriallyCurated &&
    /^BRIDGE\b.*\b(?:APPROXIMATELY|METRES?)\b/i.test(name)
  ) {
    return true;
  }
  if (
    nhleRecord &&
    !editoriallyCurated &&
    /\b(?:HOUSE|COTTAGE|FARMHOUSE|FARM|LODGE|RECTORY|VICARAGE|SHOP|PUBLIC HOUSE)\b/i.test(name) &&
    !/\bCROSS\b|NATIONAL TRUST/i.test(name)
  ) {
    return true;
  }

  if (
    !feature.tags.includes('service-context-visitor') ||
    !feature.tags.includes('osm-current-place')
  ) {
    return false;
  }

  const amenity = sourceDetail(feature, 'amenity');
  const leisure = sourceDetail(feature, 'leisure');
  if (!editoriallyCurated && amenity === 'place_of_worship') return true;
  if (
    !editoriallyCurated &&
    leisure &&
    ['fitness_centre', 'park', 'playground', 'recreation_ground', 'sports_centre'].includes(
      leisure,
    )
  ) {
    return true;
  }

  if (score > 48) return false;
  const weakTypes = new Set([
    'hotel',
    'park',
    'parking',
    'place',
    'place_of_worship',
    'road',
    'theme_park',
    'yes',
  ]);
  if (weakTypes.has(feature.featureType)) return true;
  return /\b(?:avenue|close|drive|lane|line|road|street|way)\b$/i.test(name);
}

function foodEvidenceText(feature: HeritageFeature): string {
  return normalise(
    [
      feature.name,
      feature.shortDescription,
      sourceDetail(feature, 'amenity'),
      sourceDetail(feature, 'shop'),
      sourceDetail(feature, 'cuisine'),
      sourceDetail(feature, 'description'),
      sourceDetail(feature, 'opening_hours'),
      sourceDetail(feature, 'opening_hours:description'),
      ...feature.sourceRecords.map((source) => source.notes),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function isDaytimeFoodStop(feature: HeritageFeature): boolean {
  const amenity = sourceDetail(feature, 'amenity');
  const shop = sourceDetail(feature, 'shop');
  const evidence = foodEvidenceText(feature);

  if (amenity === 'cafe' || amenity === 'ice_cream') return true;
  if (shop && ['bakery', 'coffee', 'confectionery', 'deli', 'pastry'].includes(shop)) return true;
  if (
    /\b(?:afternoon tea|bakery|breakfast|brunch|cafe|coffee|daytime|light lunch|lunch|sandwich|tea room|tearoom)\b/.test(
      evidence,
    )
  ) {
    return true;
  }

  if (!['fast_food', 'pub', 'restaurant'].includes(amenity ?? '')) return false;
  const hours =
    sourceDetail(feature, 'opening_hours') ?? sourceDetail(feature, 'opening_hours:description') ?? '';
  return /(?:^|\D)(?:0?8|0?9|10|11|12|13):[0-5][0-9]/.test(hours);
}

const landmarkNameStopWords = new Set([
  'and',
  'at',
  'church',
  'of',
  'parish',
  'the',
  'with',
]);

function landmarkNameTokens(value: string): Set<string> {
  return new Set(
    normalise(value.replace(/\bsaint\b/gi, 'st'))
      .split(' ')
      .filter((token) => token.length > 1 && !landmarkNameStopWords.has(token)),
  );
}

function likelySameMappedLandmark(
  left: { feature: HeritageFeature; highlight: VisitorHighlight },
  right: { feature: HeritageFeature; highlight: VisitorHighlight },
): boolean {
  const crossSource =
    left.feature.id.startsWith('historic-england:') !==
    right.feature.id.startsWith('historic-england:');
  if (!crossSource) return false;

  const leftPoint = featurePoint(left.feature);
  const rightPoint = featurePoint(right.feature);
  if (!leftPoint || !rightPoint) return false;
  if (distance(leftPoint, rightPoint, { units: 'kilometers' }) > 0.04) return false;

  const leftTokens = landmarkNameTokens(left.highlight.name);
  const rightTokens = landmarkNameTokens(right.highlight.name);
  const shared = [...leftTokens].filter((token) => rightTokens.has(token));
  const union = new Set([...leftTokens, ...rightTokens]);
  return shared.length >= 2 && shared.length / Math.max(union.size, 1) >= 0.5;
}

function normaliseHighlights(pkg: ProjectPackage, findings: Finding[]): void {
  const featureById = new Map(pkg.features.map((feature) => [feature.id, feature]));
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const accepted: Array<{ feature: HeritageFeature; highlight: VisitorHighlight }> = [];
  const cleaned = (pkg.project.visitorHighlights ?? [])
    .sort(
      (left, right) =>
        Number(right.visitorScore ?? 0) - Number(left.visitorScore ?? 0) ||
        left.name.localeCompare(right.name),
    )
    .filter((highlight) => {
      const feature = featureById.get(highlight.featureId);
      if (!feature) {
        findings.push({
          severity: 'error',
          code: 'see.missing-feature',
          itemId: highlight.featureId,
          message: `${highlight.name} refers to a missing bundled feature.`,
        });
        return false;
      }
      if (isWeakAutomaticHighlight(highlight, feature)) {
        findings.push({
          severity: 'notice',
          code: 'see.weak-automatic-removed',
          itemId: highlight.featureId,
          message: `${highlight.name} was removed from See because it is ordinary service/background mapping rather than a visitor attraction.`,
        });
        return false;
      }
      const nameKey = normalise(highlight.name);
      if (seenIds.has(highlight.featureId) || seenNames.has(nameKey)) {
        findings.push({
          severity: 'warning',
          code: 'see.duplicate',
          itemId: highlight.featureId,
          message: `${highlight.name} was duplicated and has been published once.`,
        });
        return false;
      }
      const nearbyDuplicate = accepted.find((candidate) =>
        likelySameMappedLandmark(candidate, { feature, highlight }),
      );
      if (nearbyDuplicate) {
        findings.push({
          severity: 'notice',
          code: 'see.cross-source-duplicate-removed',
          itemId: highlight.featureId,
          message: `${highlight.name} duplicates ${nearbyDuplicate.highlight.name} at the same mapped landmark and has been published once.`,
        });
        return false;
      }
      seenIds.add(highlight.featureId);
      seenNames.add(nameKey);
      highlight.visitorScore = highlightScore(highlight, feature);
      if (!featureInsideBoundary(feature, pkg.project.boundary)) {
        findings.push({
          severity: 'error',
          code: 'see.outside-boundary',
          itemId: highlight.featureId,
          message: `${highlight.name} remains outside the active visitor boundary and needs a project-specific decision.`,
        });
      }
      accepted.push({ feature, highlight });
      return true;
    })
    .slice(0, 20);
  cleaned.forEach((highlight, index) => {
    highlight.rank = index + 1;
  });
  pkg.project.visitorHighlights = cleaned;
}

function normaliseCuration(
  pkg: ProjectPackage,
  state: PlannerCurationState,
  findings: Finding[],
): PlannerCurationState {
  const featureById = new Map(pkg.features.map((feature) => [feature.id, feature]));
  const cleaned: PlannerCurationState = {};
  for (const need of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as CuratedNeed[]) {
    const seenIds = new Set<string>();
    const entries = (state[need] ?? [])
      .filter((featureId) => {
        if (seenIds.has(featureId)) return false;
        seenIds.add(featureId);
        const feature = featureById.get(featureId);
        if (!feature) {
          findings.push({
            severity: 'error',
            code: `${need}.missing-feature`,
            itemId: featureId,
            message: `Curated ${need} item ${featureId} is missing from the project package.`,
          });
          return false;
        }
        if (!featureInsideBoundary(feature, pkg.project.boundary)) {
          findings.push({
            severity: 'notice',
            code: `${need}.outside-boundary-removed`,
            itemId: featureId,
            message: `${feature.name} was removed because it falls outside the active visitor boundary.`,
          });
          return false;
        }
        if (need === 'eat' && !isDaytimeFoodStop(feature)) {
          findings.push({
            severity: 'notice',
            code: 'eat.non-daytime-removed',
            itemId: featureId,
            message: `${feature.name} was removed because the bundled evidence does not establish a daytime lunch, coffee or cake offer.`,
          });
          return false;
        }
        if (need === 'picnic' || need === 'parking' || need === 'toilets') {
          const access = sourceDetail(feature, 'access');
          if (access && restrictedPracticalAccess.test(access)) {
            findings.push({
              severity: 'notice',
              code: `${need}.restricted`,
              itemId: featureId,
              message: `${feature.name} was removed because access is ${access}.`,
            });
            return false;
          }
          const exclusion = practicalPublicationExclusion(feature, need);
          if (exclusion) {
            findings.push({
              severity: 'notice',
              code: `${need}.publication-excluded`,
              itemId: featureId,
              message: `${feature.name} was removed from the public planner: ${exclusion}.`,
            });
            return false;
          }
          if (applyReviewedPracticalName(feature, need)) {
            findings.push({
              severity: 'notice',
              code: `${need}.public-name-reviewed`,
              itemId: featureId,
              message: `${feature.name} now uses a reviewed, location-specific public name.`,
            });
          }
          improveGenericPracticalName(feature, need, pkg);
        }
        if (need === 'parking') {
          const priceStatus = parkingPriceStatus(feature);
          if (priceStatus === 'unknown') {
            addCurrentDetail(
              feature,
              { price_display: 'Check signs', payment_required: 'unknown' },
              'No defensible current tariff was available; visitors are told to check signs.',
            );
            findings.push({
              severity: 'notice',
              code: 'parking.price-unverified',
              itemId: featureId,
              message: `${feature.name} has no defensible current tariff; the public UI must show Check signs.`,
            });
          } else {
            feature.sourceRecords = feature.sourceRecords.filter(
              (source) =>
                !(
                  source.sourceRecordId ===
                    `${feature.id}:publication-review:${reviewedDate}` &&
                  /price_display=Check signs|payment_required=unknown/i.test(source.notes ?? '')
                ),
            );
          }
        }
        return true;
      })
      .map((featureId, sourceIndex) => ({
        featureId,
        sourceIndex,
        score:
          need === 'trails'
            ? (trailScore(featureById.get(featureId)!) ?? 0)
            : need === 'eat'
              ? Number(detail(featureById.get(featureId)!, 'visit_score') ?? 0)
              : 0,
      }));
    if (need === 'eat' || need === 'trails') {
      entries.sort((left, right) => right.score - left.score || left.sourceIndex - right.sourceIndex);
    }
    cleaned[need] = entries
      .slice(0, need === 'eat' ? 20 : Number.MAX_SAFE_INTEGER)
      .map((entry) => entry.featureId);
  }
  return cleaned;
}

function editorialPlaceName(value: string): string {
  if (value !== value.toUpperCase() || !/[A-Z]/.test(value)) return value;
  const minorWords = new Set(['and', 'at', 'by', 'for', 'in', 'of', 'on', 'the', 'to', 'with']);
  return value
    .toLocaleLowerCase('en-GB')
    .split(/(\s+|-)/)
    .map((part, index) => {
      if (!/[a-z]/.test(part)) return part;
      if (index > 0 && minorWords.has(part)) return part;
      return `${part[0].toLocaleUpperCase('en-GB')}${part.slice(1)}`;
    })
    .join('');
}

function reconcileGeneratedTownGuide(
  pkg: ProjectPackage,
  curation: PlannerCurationState,
  findings: Finding[],
): void {
  const highlights = pkg.project.visitorHighlights ?? [];
  highlights.forEach((highlight) => {
    highlight.name = editorialPlaceName(highlight.name);
  });

  const previousRating = pkg.project.touristAppeal?.rating;
  const previousGuide = JSON.stringify(pkg.project.townGuide ?? null);
  const ratingEvidence = townRatingEvidenceForProject(pkg, curation);
  const rating = townRatingFromEvidence(
    ratingEvidence.attractions.map((item) => item.score),
    ratingEvidence.trails.map((item) => item.score),
  );
  const ratingLabel = townRatingLabels[rating];
  const topNames = highlights.slice(0, 3).map((highlight) => highlight.name);
  const hasFood = (curation.eat?.length ?? 0) > 0;
  const hasTrail = (curation.trails?.length ?? 0) > 0;
  const bestFor = [
    topNames.length > 0 ? 'Local heritage' : undefined,
    topNames.length > 0 ? 'Short settlement walks' : undefined,
    hasFood ? 'Daytime stops' : undefined,
    hasTrail ? 'Local trails' : undefined,
  ].filter((value): value is string => Boolean(value));
  if (!bestFor.length) bestFor.push('Local orientation');

  pkg.project.touristAppeal = {
    rating,
    label: ratingLabel,
    summary: townRatingSummary(pkg.project.locality, rating, ratingEvidence),
  };
  pkg.project.townGuide = {
    headline:
      rating === 0
        ? `A practical local guide to ${pkg.project.locality}`
        : `${pkg.project.locality}: ${topNames.length ? 'local heritage' : 'daytime stops'} and an easy settlement wander`,
    intro:
      rating === 0
        ? `${pkg.project.locality} has a modest visitor offer within its active settlement boundary. The guide records only defensible visitor interest without presenting the place as a destination.`
        : `${pkg.project.locality} offers ${topNames.length ? topNames.join(', ') : 'a small collection of daytime stops'} within a compact settlement visit${hasFood ? ', with curated places for lunch, coffee or cake' : ''}.`,
    bestFor,
    perfectFor:
      rating === 0
        ? ['Visitors already nearby']
        : ['A short local detour', 'Visitors exploring Northamptonshire'],
    suggestedFirstVisit: {
      title: topNames[0] ?? `A short ${pkg.project.locality} wander`,
      summary: topNames.length
        ? `Start with ${topNames.slice(0, 2).join(' and ')}${hasFood ? ', then choose a daytime stop from the planner' : ''}.`
        : 'Use the planner to find the strongest in-boundary daytime stops.',
    },
    dontMiss: topNames,
    suggestedTime:
      rating >= 2 ? 'Half day' : rating === 1 ? 'One to three hours' : 'As part of a wider local journey',
    visitorMood:
      rating === 0
        ? 'A local settlement rather than a tourist destination.'
        : 'A low-key, evidence-led local visit.',
    sourceUrls:
      pkg.project.townGuide?.sourceUrls ??
      [
        pkg.project.townStudyArea?.sourceUrl,
        'https://historicengland.org.uk/listing/the-list/data-downloads/',
        'https://www.openstreetmap.org/',
      ].filter((value): value is string => Boolean(value)),
    lastReviewedAt: reviewedDate,
  };

  if (previousRating !== rating || previousGuide !== JSON.stringify(pkg.project.townGuide)) {
    findings.push({
      severity: 'notice',
      code: 'town.generated-guide-reconciled',
      message: 'The batch-generated rating and guide copy were reconciled to the final cleaned visitor lists.',
    });
  }
}

function auditStandaloneAttractions(pkg: ProjectPackage, findings: Finding[]): number {
  const standalone = pkg.features.filter((feature) => {
    if (!feature.tags.includes('home-standalone-place')) return false;
    if (!featureInsideBoundary(feature, pkg.project.boundary)) return true;
    feature.tags = feature.tags.filter((tag) => tag !== 'home-standalone-place');
    feature.updatedAt = reviewedAt;
    findings.push({
      severity: 'notice',
      code: 'standalone.reclassified-inside-town',
      itemId: feature.id,
      message: `${feature.name} was reclassified as a town attraction because it now falls inside the active visitor boundary.`,
    });
    return false;
  });
  for (const feature of standalone) {
    const score = Number(detail(feature, 'visit_score'));
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      findings.push({
        severity: 'error',
        code: 'standalone.score',
        itemId: feature.id,
        message: `${feature.name} has no valid 0-100 visit score.`,
      });
    }
    const guide = feature.attractionGuide;
    const missing = [
      !guide?.heroImage && 'illustration',
      !guide?.headline && 'headline',
      !guide?.intro && 'visitor introduction',
      !guide?.thingsToDo?.length && 'things to do',
      !guide?.trails && 'trail review',
      !guide?.toilets && 'toilet review',
      !guide?.picnic && 'picnic review',
      !guide?.food && 'food review',
    ].filter(Boolean);
    if (missing.length) {
      findings.push({
        severity: 'warning',
        code: 'standalone.guide-incomplete',
        itemId: feature.id,
        message: `${feature.name} still needs: ${missing.join(', ')}.`,
      });
    }
  }
  return standalone.length;
}

function auditRatingsAndGuides(pkg: ProjectPackage, findings: Finding[]): void {
  const rating = pkg.project.touristAppeal?.rating;
  if (![0, 1, 2, 3].includes(Number(rating))) {
    findings.push({
      severity: 'error',
      code: 'town.rating',
      message: 'Town appeal must use the 0-3 destination-draw scale.',
    });
  }
  if (!pkg.project.touristAppeal?.summary?.trim()) {
    findings.push({
      severity: 'warning',
      code: 'town.rating-summary',
      message: 'Town rating has no visitor-first explanation.',
    });
  }
  if (!pkg.project.visualIdentity?.heroImage || !pkg.project.townGuide?.headline) {
    findings.push({
      severity: 'notice',
      code: 'town.guide',
      message: 'Town guide artwork or editorial guide copy remains an editorial enhancement rather than a publication-data blocker.',
    });
  }
  for (const highlight of pkg.project.visitorHighlights ?? []) {
    const recommendation = visitRecommendation(highlight.visitorScore);
    if (!recommendation) {
      findings.push({
        severity: 'error',
        code: 'see.score',
        itemId: highlight.featureId,
        message: `${highlight.name} has no valid attraction score.`,
      });
    }
  }
}

function auditCategoryLabels(
  pkg: ProjectPackage,
  state: PlannerCurationState,
  findings: Finding[],
): void {
  const featureById = new Map(pkg.features.map((feature) => [feature.id, feature]));
  for (const featureId of state.eat ?? []) {
    const feature = featureById.get(featureId);
    if (!feature) continue;
    const score = Number(detail(feature, 'visit_score'));
    if (!Number.isFinite(score) || !foodRecommendation(score)) {
      findings.push({
        severity: 'warning',
        code: 'eat.score',
        itemId: featureId,
        message: `${feature.name} has no defensible food score; it remains ordered after scored entries.`,
      });
    }
  }
  for (const featureId of state.trails ?? []) {
    const feature = featureById.get(featureId);
    if (!feature) continue;
    const score = trailScore(feature);
    if (score === undefined || !trailRecommendation(score)) {
      findings.push({
        severity: 'error',
        code: 'trail.score',
        itemId: featureId,
        message: `${feature.name} has no valid trail score.`,
      });
    }
  }
}

async function loadOfficialTextAudits(): Promise<
  Array<{ path: string; audit: OfficialTextAudit }>
> {
  const files = (await readdir(reviewDirectory)).filter((file) =>
    file.includes('-nhle-official-text-'),
  );
  const audits: Array<{ path: string; audit: OfficialTextAudit }> = [];
  for (const file of files) {
    const path = join(reviewDirectory, file);
    try {
      audits.push({ path, audit: JSON.parse(await readFile(path, 'utf8')) as OfficialTextAudit });
    } catch {
      // An unreadable review artefact is reported by the affected town as missing source text.
    }
  }
  return audits;
}

const projectFiles: Array<{ path: string; file: string; pkg: ProjectPackage }> = [];
for (const file of (await readdir(projectsDirectory)).filter((name) => name.endsWith('.json'))) {
  const path = join(projectsDirectory, file);
  try {
    const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
    if (pkg.project.countryCode === 'GB-ENG') projectFiles.push({ path, file, pkg });
  } catch {
    // Other JSON artefacts are outside this publication sweep.
  }
}
projectFiles.sort((left, right) => left.pkg.project.locality.localeCompare(right.pkg.project.locality));

const curationFile = JSON.parse(await readFile(curationPath, 'utf8')) as CurationLibraryFile;
const settlementBatchAudits = await Promise.all(
  settlementBatchAuditPaths.map(async (path) => ({
    path,
    audit: JSON.parse(await readFile(path, 'utf8')) as SettlementBatchAuditFile,
  })),
);
const settlementBatchProjectIds = new Set(
  settlementBatchAudits
    .flatMap(({ audit }) => audit.createdProjects ?? [])
    .map((project) => project.projectId)
    .filter((projectId): projectId is string => Boolean(projectId)),
);
const officialTextAudits = await loadOfficialTextAudits();
const townAudits: TownAudit[] = [];

for (const { path, pkg } of projectFiles) {
  const findings: Finding[] = [];
  const studyArea = pkg.project.townStudyArea;
  const officialBoundary = studyArea?.localityBoundary ?? pkg.project.boundary;
  const boundaryResult = createVisitorBoundary(pkg);
  if (boundaryResult.finding) findings.push(boundaryResult.finding);
  const visitorBoundary = boundaryResult.boundary;
  if (studyArea) {
    studyArea.visitorBoundary = visitorBoundary;
    studyArea.bufferedBoundary = visitorBoundary;
    if (/ONS Built-up Areas/i.test(studyArea.sourceName)) studyArea.bufferMetres = 0;
    if (!boundaryResult.preservedExisting) {
      studyArea.notes =
        `The official locality geometry is preserved unchanged. The active visitor boundary uses a transparent ${boundaryResult.closingMetres} metre morphological closing to include connected parks, river corridors and green spaces omitted by the statistical built-up-area geometry. This is a visitor extent, not an administrative replacement.`;
      pkg.project.boundarySource =
        `Curated ${pkg.project.locality} visitor boundary derived from ${studyArea.sourceName}`;
    }
  }
  pkg.project.boundary = visitorBoundary;
  pkg.project.boundaryConfidence = 'high';

  const dateResult = restoreHistoricEnglandDates(
    pkg,
    officialTextForProject(pkg, officialTextAudits),
  );
  await writeFile(
    join(reviewDirectory, `${pkg.project.id}-nhle-date-enrichment-${reviewedDate}.json`),
    `${JSON.stringify(dateResult.audit, null, 2)}\n`,
    'utf8',
  );

  normaliseHighlights(pkg, findings);
  const sourceCuration = curationFile.projects[pkg.project.id] ?? {};
  ensureOfficialPracticalFeatures(pkg, sourceCuration, findings);
  const curation = normaliseCuration(
    pkg,
    sourceCuration,
    findings,
  );
  curationFile.projects[pkg.project.id] = curation;
  if (settlementBatchProjectIds.has(pkg.project.id)) {
    reconcileGeneratedTownGuide(pkg, curation, findings);
  }
  auditRatingsAndGuides(pkg, findings);
  auditCategoryLabels(pkg, curation, findings);
  const standaloneAttractions = auditStandaloneAttractions(pkg, findings);

  const officialArea = areaHectares(officialBoundary);
  const visitorArea = areaHectares(visitorBoundary);
  const increasePercent = ((visitorArea - officialArea) / officialArea) * 100;
  const outsideCuratedCount = findings.filter((finding) =>
    finding.code.endsWith('.outside-boundary'),
  ).length;
  if (outsideCuratedCount > 0) {
    findings.push({
      severity: 'error',
      code: 'boundary.curated-items-outside',
      message: `${outsideCuratedCount} curated planner item(s) need a project-specific boundary or publication decision.`,
    });
  }

  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  townAudits.push({
    projectId: pkg.project.id,
    locality: pkg.project.locality,
    file: basename(path),
    rating: Number(pkg.project.touristAppeal?.rating ?? 0),
    features: pkg.features.length,
    boundary: {
      officialAreaHectares: Number(officialArea.toFixed(2)),
      visitorAreaHectares: Number(visitorArea.toFixed(2)),
      increasePercent: Number(increasePercent.toFixed(1)),
      closingMetres: boundaryResult.closingMetres,
      preservedExistingCuratedBoundary: boundaryResult.preservedExisting,
    },
    heritageDates: {
      statutoryRecords: dateResult.statutoryRecords,
      datedStatutoryRecords: dateResult.datedStatutoryRecords,
      newlyRestored: dateResult.newlyRestored,
      unresolved: dateResult.unresolved,
    },
    categories: {
      see: pkg.project.visitorHighlights?.length ?? 0,
      eat: curation.eat?.length ?? 0,
      trails: curation.trails?.length ?? 0,
      picnic: curation.picnic?.length ?? 0,
      parking: curation.parking?.length ?? 0,
      toilets: curation.toilets?.length ?? 0,
    },
    standaloneAttractions,
    findings,
  });
}

for (const batch of settlementBatchAudits) {
  batch.audit.createdProjects = (batch.audit.createdProjects ?? []).map((createdProject) => {
    const projectFile = projectFiles.find(
      (candidate) => candidate.pkg.project.id === createdProject.projectId,
    );
    if (!projectFile) return createdProject;
    const { pkg } = projectFile;
    const curation = curationFile.projects[pkg.project.id] ?? {};
    return {
      ...createdProject,
      touristAppeal: pkg.project.touristAppeal,
      counts: {
        features: pkg.features.length,
        historicEngland: pkg.features.filter((feature) => feature.tags.includes('nhle')).length,
        see: pkg.project.visitorHighlights?.length ?? 0,
        eat: curation.eat?.length ?? 0,
        trails: curation.trails?.length ?? 0,
        parking: curation.parking?.length ?? 0,
        toilets: curation.toilets?.length ?? 0,
        picnic: curation.picnic?.length ?? 0,
      },
    };
  });
  batch.audit.auditedAt = reviewedAt;
  await writeFile(batch.path, `${JSON.stringify(batch.audit, null, 2)}\n`, 'utf8');
}
await writeFile(curationPath, `${JSON.stringify(curationFile, null, 2)}\n`, 'utf8');

const totalFindings = townAudits.flatMap((town) => town.findings);
const report = {
  schemaVersion: 1,
  reviewedAt,
  scope: `${townAudits.length} published English town packages and their bundled standalone Home attractions.`,
  policy: {
    boundaries:
      'Official locality geometry is preserved; active visitor geometry may close internal green-space gaps but cannot add more than 30% automatically.',
    towns: 'Tourist appeal uses the editorial 0-3 destination-draw scale.',
    see: 'Up to 20 in-boundary attractions, ranked by 0-100 score.',
    eat: 'Up to 20 daytime food stops, ranked by the food-specific 0-100 scale.',
    trails: 'All linked trails carry a 0-100 trail score and are ordered highest first.',
    practical:
      'All curated practical places must be public, in-boundary, location-specific and honest about unknown tariffs.',
    heritage:
      'Only defensible dates extracted from locally captured official Historic England text are published.',
  },
  totals: {
    towns: townAudits.length,
    features: townAudits.reduce((sum, town) => sum + town.features, 0),
    standaloneAttractions: townAudits.reduce(
      (sum, town) => sum + town.standaloneAttractions,
      0,
    ),
    datedStatutoryRecords: townAudits.reduce(
      (sum, town) => sum + town.heritageDates.datedStatutoryRecords,
      0,
    ),
    statutoryRecords: townAudits.reduce(
      (sum, town) => sum + town.heritageDates.statutoryRecords,
      0,
    ),
    errors: totalFindings.filter((finding) => finding.severity === 'error').length,
    warnings: totalFindings.filter((finding) => finding.severity === 'warning').length,
    notices: totalFindings.filter((finding) => finding.severity === 'notice').length,
  },
  towns: townAudits,
};
await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const markdown = [
  '# England publication compliance audit',
  '',
  `Reviewed: ${reviewedDate}`,
  '',
  `Scope: ${report.totals.towns} towns, ${report.totals.features} bundled records and ${report.totals.standaloneAttractions} standalone attractions.`,
  '',
  `Historic England dates: ${report.totals.datedStatutoryRecords}/${report.totals.statutoryRecords} statutory records carry defensible date evidence.`,
  '',
  `Remaining findings: ${report.totals.errors} errors and ${report.totals.warnings} warnings. ${report.totals.notices} notices record automatic clean-up and disclosed unknowns without blocking publication.`,
  '',
  '| Town | Stars | Boundary change | Dated NHLE | See | Eat | Trails | Parking | Toilets | Errors | Warnings | Notices |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...townAudits.map((town) => {
    const errors = town.findings.filter((finding) => finding.severity === 'error').length;
    const warnings = town.findings.filter((finding) => finding.severity === 'warning').length;
    const notices = town.findings.filter((finding) => finding.severity === 'notice').length;
    return `| ${town.locality} | ${town.rating} | ${town.boundary.increasePercent}% | ${town.heritageDates.datedStatutoryRecords}/${town.heritageDates.statutoryRecords} | ${town.categories.see} | ${town.categories.eat} | ${town.categories.trails} | ${town.categories.parking} | ${town.categories.toilets} | ${errors} | ${warnings} | ${notices} |`;
  }),
  '',
  '## Remaining project-specific findings',
  '',
  ...townAudits.flatMap((town) => {
    if (!town.findings.length) return [];
    return [
      `### ${town.locality}`,
      '',
      ...town.findings.map(
        (finding) =>
          `- **${finding.severity.toUpperCase()} ${finding.code}:** ${finding.message}${finding.itemId ? ` (${finding.itemId})` : ''}`,
      ),
      '',
    ];
  }),
].join('\n');
await writeFile(reportMarkdownPath, `${markdown}\n`, 'utf8');

console.log(
  `Audited and normalised ${townAudits.length} English towns: ${report.totals.errors} error(s), ${report.totals.warnings} warning(s), ${report.totals.notices} notice(s).`,
);
console.log(reportJsonPath);
console.log(reportMarkdownPath);
