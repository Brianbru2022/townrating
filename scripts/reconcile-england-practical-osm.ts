import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { distance, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import type { PlannerCurationState } from '../src/domain/plannerCuration';

type PracticalNeed = 'picnic' | 'parking' | 'toilets';

interface Candidate {
  osmId: string;
  name: string;
  coordinates: [number, number];
  category: 'see' | 'eat' | PracticalNeed;
  eligible: boolean;
  exclusionReason?: string;
  existingFeatureId?: string;
  curated: boolean;
  tags: Record<string, string>;
  osmUrl: string;
}

interface SweepTown {
  projectId: string;
  locality: string;
  projectFile: string;
  candidates: Record<'see' | 'eat' | PracticalNeed, Candidate[]>;
}

interface SweepFile {
  towns: SweepTown[];
}

interface CurationFile {
  schemaVersion: number;
  description: string;
  projects: Record<string, PlannerCurationState>;
}

interface Decision {
  osmId: string;
  name: string;
  category: Candidate['category'];
  decision:
    | 'already-curated'
    | 'already-represented'
    | 'published'
    | 'excluded'
    | 'editorial-review-only';
  reason: string;
  publishedFeatureId?: string;
}

const reviewedDate = '2026-08-09';
const reviewedAt = `${reviewedDate}T00:00:00Z`;
const dryRun = process.argv.includes('--dry-run');
const sweepPath = resolve(`data/review/gb-eng-osm-visitor-sweep-${reviewedDate}.json`);
const curationPath = resolve('data/visitor-planner-curation.json');
const reportJsonPath = resolve(
  `data/review/england-practical-osm-reconciliation-${reviewedDate}.json`,
);
const reportMarkdownPath = resolve(
  `data/review/england-practical-osm-reconciliation-${reviewedDate}.md`,
);

const businessOrRestrictedName = /\b(?:aldi|arms|asda|b&m|bank|business|cafe|church|college|coffee|co-?op|dentist|diner|factory|farmhouse|gym|hospital|hotel|industrial|inn|kitchen|lidl|morrisons|nursery|office|pizza|pub|restaurant|retail|sainsbury|school|staff|surgery|tesco|waitrose|warehouse)\b/i;
const nonVisitorParkingName = /\b(?:bus depot|coach park|disabled parking|drop[ -]?off|hgv|loading|lorry|motorcycle|park and ride|residents?|service yard)\b/i;
const descriptiveParkingName = /^(?:\d+\s*(?:hours?|hrs?)\s*free|free parking|parking|car park(?:\s+[a-z])?|public car park|unnamed car park)$/i;
const genericNames = {
  parking: /^(?:parking|car park|public car park|unnamed car park)$/i,
  picnic: /^(?:picnic site|picnic area|picnic table|unnamed picnic place)$/i,
  toilets: /^(?:public toilets|toilets|unnamed public toilets)$/i,
};
const duplicateDistanceKilometres: Record<PracticalNeed, number> = {
  parking: 0.08,
  picnic: 0.13,
  toilets: 0.06,
};

// These are the additions accepted by the 2026-08-09 all-England manual sweep.
// Every other uncurated OSM practical object remains in the reconciliation report,
// but is not promoted into the bundled visitor library without separate evidence.
const approvedPracticalOsmIds = new Set([
  'node/1154998215', // Brampton village green and memorial gardens picnic table
  'node/11898143760', // Corby Boating Lake picnic table
  'node/696653752', // Desborough Buckwell Close parking
  'node/10278216214', // Huntingdon Bloomfield Park picnic table
  'node/8707574610', // Kettering Wicksteed Park picnic table
  'way/16730926', // Peterborough Deacon Street Car Park
  'node/13131631344', // Peterborough Ferry Meadows toilets
  'node/12846536009', // Peterborough Ferry Meadows picnic table
  'node/9062100780', // Stamford town-centre picnic table
  'way/28904138', // Rothwell Market Square parking
  'way/179394976', // Bletchley Library Car Park
  'way/179443513', // Bletchley Elizabeth Square Short Stay
  'way/179416345', // Bletchley station NCP
  'way/436900316', // Buckingham Western Avenue Long Stay
  'way/1305690445', // Buckingham Bourton Park picnic site
  'way/363777596', // Milton Keynes Horn Lane Car Park
  'way/121258513', // Milton Keynes Coachway Park and Ride
  'way/380039645', // Milton Keynes Stanton Low Car Park
  'way/363779939', // Milton Keynes Willow Lane Car Park
  'node/2344589370', // Newport Pagnell Ousebank Gardens picnic table
  'way/542262156', // Northampton Albion Place Car Park
  'way/354193917', // Northampton Hazelwood Road Car Park
  'way/135270723', // Northampton Marefair Car Park
  'way/138943394', // Northampton Mayorhold multi-storey
  'way/542262158', // Northampton Newlands Car Park
  'way/62696814', // Northampton St John's multi-storey
  'way/101938094', // Rushden Splash Pool Car Park
  'way/588938884', // Wellingborough Jacksons Lane Car Park
]);

const reviewedPracticalNames: Record<string, string> = {
  'node/1154998215': 'Memorial Garden picnic area',
  'node/11898143760': 'Corby Boating Lake picnic area',
  'node/696653752': 'Buckwell Close car park',
  'node/10278216214': 'Bloomfield Park picnic area',
  'node/8707574610': 'Wicksteed Park picnic area',
  'node/13131631344': 'Ferry Meadows public toilets',
  'node/12846536009': 'Ferry Meadows picnic area',
  'node/9062100780': 'Stamford town-centre picnic area',
  'way/28904138': 'Market Square car park',
  'way/179443513': 'Elizabeth Square short-stay car park',
  'way/436900316': 'Western Avenue long-stay car park',
  'way/1305690445': 'Bourton Park picnic area',
  'way/138943394': 'Mayorhold multi-storey car park',
  'way/62696814': "St John's multi-storey car park",
  'node/2344589370': 'Ousebank Gardens picnic area',
  'way/588938884': 'Jacksons Lane car park',
};

function normalise(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function featureCoordinates(feature: HeritageFeature): [number, number] | undefined {
  return feature.geometry?.type === 'Point'
    ? (feature.geometry.coordinates as [number, number])
    : undefined;
}

function kilometresBetween(
  left: [number, number],
  right: [number, number],
): number {
  return distance(point(left), point(right), { units: 'kilometers' });
}

function featureNeed(feature: HeritageFeature): PracticalNeed | undefined {
  if (feature.tags.includes('service-context-parking') || feature.featureType === 'parking') {
    return 'parking';
  }
  if (feature.tags.includes('service-context-toilets') || feature.featureType === 'toilets') {
    return 'toilets';
  }
  if (feature.tags.includes('service-context-picnic') || feature.featureType === 'picnic') {
    return 'picnic';
  }
  return undefined;
}

function nearestAnchor(
  coordinates: [number, number],
  pkg: ProjectPackage,
  curatedSee: Set<string>,
): HeritageFeature | undefined {
  return pkg.features
    .filter(
      (feature) =>
        !featureNeed(feature) &&
        !feature.tags.includes('home-standalone-place') &&
        (curatedSee.has(feature.id) ||
          ['park', 'garden', 'square', 'market', 'harbour'].includes(feature.featureType) ||
          feature.tags.some((tag) =>
            ['current-park', 'visitor-highlight', 'visitor-attraction'].includes(tag),
          )),
    )
    .map((feature) => {
      const location = featureCoordinates(feature);
      return location
        ? { feature, kilometres: kilometresBetween(coordinates, location) }
        : undefined;
    })
    .filter(
      (entry): entry is { feature: HeritageFeature; kilometres: number } =>
        Boolean(entry && entry.kilometres <= 0.3 && entry.feature.name.trim().length > 3),
    )
    .sort((left, right) => {
      const leftPriority = ['park', 'garden', 'square', 'market'].includes(left.feature.featureType)
        ? 0
        : 1;
      const rightPriority = ['park', 'garden', 'square', 'market'].includes(right.feature.featureType)
        ? 0
        : 1;
      return leftPriority - rightPriority || left.kilometres - right.kilometres;
    })[0]?.feature;
}

function meaningfulParkingName(candidate: Candidate, anchor?: HeritageFeature): string | undefined {
  if (reviewedPracticalNames[candidate.osmId]) {
    return reviewedPracticalNames[candidate.osmId];
  }
  const taggedName = candidate.tags.name?.trim();
  if (taggedName && !descriptiveParkingName.test(taggedName)) return taggedName;
  const street =
    candidate.tags['addr:street'] ?? candidate.tags['addr:place'] ?? candidate.tags.loc_name;
  if (street) return `${street} car park`;
  if (
    anchor &&
    /^(?:public|council|government)$/i.test(candidate.tags['operator:type'] ?? '')
  ) {
    return `${anchor.name} car park`;
  }
  return undefined;
}

function publicParking(candidate: Candidate, displayName?: string): { accepted: boolean; reason: string } {
  const tags = candidate.tags;
  const joined = [displayName, tags.operator, tags.description, tags.access, tags.parking]
    .filter(Boolean)
    .join(' ');
  if (!candidate.eligible) {
    return { accepted: false, reason: candidate.exclusionReason ?? 'OSM marks it as ineligible.' };
  }
  if (['private', 'permit', 'residents', 'customers', 'no'].includes(tags.access ?? '')) {
    return { accepted: false, reason: `Restricted access (${tags.access}).` };
  }
  if (businessOrRestrictedName.test(joined) || nonVisitorParkingName.test(joined)) {
    return { accepted: false, reason: 'Business, staff, residential or specialist parking.' };
  }
  if (!displayName) {
    return { accepted: false, reason: 'Unnamed parking with no defensible visitor-facing location.' };
  }
  const explicitlyPublic =
    /^(?:public|council|government)$/i.test(tags['operator:type'] ?? '') ||
    /\bcouncil\b/i.test(tags.operator ?? '') ||
    /^(?:yes|public)$/i.test(tags.access ?? '');
  const independentlyNamed = Boolean(
    tags.name?.trim() && !descriptiveParkingName.test(tags.name.trim()),
  );
  return explicitlyPublic || independentlyNamed
    ? { accepted: true, reason: 'Distinct named public visitor parking.' }
    : { accepted: false, reason: 'Not established as independently useful public visitor parking.' };
}

function practicalName(
  candidate: Candidate,
  need: PracticalNeed,
  anchor?: HeritageFeature,
): string | undefined {
  if (reviewedPracticalNames[candidate.osmId]) {
    return reviewedPracticalNames[candidate.osmId];
  }
  if (need === 'parking') return meaningfulParkingName(candidate, anchor);
  const taggedName = candidate.tags.name?.trim();
  if (taggedName && !genericNames[need].test(taggedName)) return taggedName;
  const street =
    candidate.tags['addr:street'] ?? candidate.tags['addr:place'] ?? candidate.tags.loc_name;
  const location = street ?? anchor?.name;
  if (!location) return undefined;
  return need === 'toilets' ? `${location} public toilets` : `${location} picnic area`;
}

function practicalExclusion(
  candidate: Candidate,
  need: PracticalNeed,
  displayName?: string,
): string | undefined {
  if (!candidate.eligible) return candidate.exclusionReason ?? 'OSM marks it as ineligible.';
  const tags = candidate.tags;
  if (['private', 'permit', 'residents', 'customers', 'no'].includes(tags.access ?? '')) {
    return `Restricted access (${tags.access}).`;
  }
  const joined = [displayName, tags.operator, tags.description].filter(Boolean).join(' ');
  if (businessOrRestrictedName.test(joined)) {
    return 'Business, customer, staff or institution-only facility.';
  }
  if (need === 'toilets' && (tags.level || /platform|station barrier/i.test(joined))) {
    return 'Transport or indoor level-specific toilets are not established as general public facilities.';
  }
  if (!displayName) {
    return `No defensible visitor-facing location could be established for this ${need} site.`;
  }
  return undefined;
}

function duplicateFeature(
  candidate: Candidate,
  displayName: string,
  need: PracticalNeed,
  features: HeritageFeature[],
): HeritageFeature | undefined {
  const normalisedName = normalise(displayName);
  return features.find((feature) => {
    if (featureNeed(feature) !== need) return false;
    if (normalise(feature.name) === normalisedName) return true;
    const location = featureCoordinates(feature);
    return location
      ? kilometresBetween(candidate.coordinates, location) <= duplicateDistanceKilometres[need]
      : false;
  });
}

function candidateDuplicate(
  candidate: Candidate,
  need: PracticalNeed,
  published: Array<{ candidate: Candidate; featureId: string }>,
) {
  return published.find(
    (entry) =>
      kilometresBetween(candidate.coordinates, entry.candidate.coordinates) <=
      duplicateDistanceKilometres[need],
  );
}

function sourceNotes(candidate: Candidate, need: PracticalNeed): string {
  const tags = { ...candidate.tags };
  if (need === 'parking') {
    if (tags.fee === 'no') {
      tags.payment_required = 'no';
      tags.price_display = 'Free';
    } else if (tags.fee === 'yes' || tags.charge) {
      tags.payment_required = 'yes';
      tags.price_display = tags.charge || 'Pay - check signs';
    } else {
      tags.payment_required = 'unknown';
      tags.price_display = 'Check signs';
    }
  }
  return `Current OSM: ${Object.entries(tags)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')}`;
}

function createFeature(
  pkg: ProjectPackage,
  candidate: Candidate,
  need: PracticalNeed,
  displayName: string,
): HeritageFeature {
  const source: SourceRecord = {
    sourceName: 'OpenStreetMap current community places',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceRecordId: candidate.osmId,
    sourceUrl: candidate.osmUrl,
    accessedAt: reviewedAt,
    reliability: 'discovery_only',
    licence: 'OpenStreetMap contributors; ODbL. Editorial visitor description is original.',
    notes: sourceNotes(candidate, need),
  };
  const description =
    need === 'parking'
      ? `Visitor parking at ${displayName.replace(/ car park$/i, '')}. Check on-site signs for current tariffs and restrictions.`
      : need === 'toilets'
        ? `Public toilets at ${displayName.replace(/ public toilets$/i, '')}.`
        : `Picnic provision at ${displayName.replace(/ picnic area$/i, '')}.`;
  return {
    id: `osm-community:${candidate.osmId.replace('/', '-')}`,
    projectId: pkg.project.id,
    name: displayName,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType: need,
    significance: 'local',
    geometry: { type: 'Point', coordinates: candidate.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: description,
    sourceRecords: [source],
    tags: [
      `${pkg.project.id}-visitor-audit`,
      'current-context',
      `service-context-${need}`,
      'osm-current-place',
    ],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: `Public visitor facility reconciled against OSM and the active town boundary ${reviewedDate}.`,
    evidenceScope: 'related_context',
    licence: 'OpenStreetMap contributors; ODbL. Editorial visitor description is original.',
  };
}

const sweep = JSON.parse(await readFile(sweepPath, 'utf8')) as SweepFile;
const curation = JSON.parse(await readFile(curationPath, 'utf8')) as CurationFile;
const reports: Array<{
  projectId: string;
  locality: string;
  published: number;
  decisions: Decision[];
}> = [];

for (const town of sweep.towns) {
  const projectPath = resolve('data/projects', town.projectFile);
  const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
  const projectCuration = (curation.projects[pkg.project.id] ??= {});
  const decisions: Decision[] = [];
  let publishedCount = 0;

  for (const category of ['see', 'eat'] as const) {
    for (const candidate of town.candidates[category]) {
      decisions.push({
        osmId: candidate.osmId,
        name: candidate.name,
        category,
        decision: candidate.curated ? 'already-curated' : 'editorial-review-only',
        reason: candidate.curated
          ? 'Already represented by the source-backed editorial curation.'
          : 'OSM is discovery evidence only; See and Eat require independent visitor research and scoring.',
      });
    }
  }

  for (const need of ['parking', 'toilets', 'picnic'] as PracticalNeed[]) {
    const published: Array<{ candidate: Candidate; featureId: string }> = [];
    projectCuration[need] ??= [];
    for (const candidate of town.candidates[need]) {
      if (candidate.curated && candidate.existingFeatureId) {
        decisions.push({
          osmId: candidate.osmId,
          name: candidate.name,
          category: need,
          decision: 'already-curated',
          reason: 'Already present in the bundled visitor planner.',
          publishedFeatureId: candidate.existingFeatureId,
        });
        continue;
      }
      const anchor = nearestAnchor(
        candidate.coordinates,
        pkg,
        new Set(projectCuration.see ?? []),
      );
      const displayName = practicalName(candidate, need, anchor);
      const exclusion =
        need === 'parking'
          ? (() => {
              const result = publicParking(candidate, displayName);
              return result.accepted ? undefined : result.reason;
            })()
          : practicalExclusion(candidate, need, displayName);
      if (exclusion || !displayName) {
        decisions.push({
          osmId: candidate.osmId,
          name: candidate.name,
          category: need,
          decision: 'excluded',
          reason: exclusion ?? 'No defensible visitor-facing name.',
        });
        continue;
      }
      if (!approvedPracticalOsmIds.has(candidate.osmId)) {
        decisions.push({
          osmId: candidate.osmId,
          name: displayName,
          category: need,
          decision: 'excluded',
          reason:
            'Reviewed in the all-England sweep but not established as a distinct general-public visitor facility.',
        });
        continue;
      }
      const represented = duplicateFeature(candidate, displayName, need, pkg.features);
      if (represented) {
        decisions.push({
          osmId: candidate.osmId,
          name: displayName,
          category: need,
          decision: 'already-represented',
          reason: `Represented by ${represented.name}.`,
          publishedFeatureId: represented.id,
        });
        continue;
      }
      const clustered = candidateDuplicate(candidate, need, published);
      if (clustered) {
        decisions.push({
          osmId: candidate.osmId,
          name: displayName,
          category: need,
          decision: 'already-represented',
          reason: `Same visitor facility cluster as ${clustered.featureId}.`,
          publishedFeatureId: clustered.featureId,
        });
        continue;
      }
      const feature = createFeature(pkg, candidate, need, displayName);
      pkg.features.push(feature);
      projectCuration[need] = [...new Set([...(projectCuration[need] ?? []), feature.id])];
      published.push({ candidate, featureId: feature.id });
      publishedCount += 1;
      decisions.push({
        osmId: candidate.osmId,
        name: displayName,
        category: need,
        decision: 'published',
        reason: 'Distinct public visitor facility inside the active town boundary.',
        publishedFeatureId: feature.id,
      });
    }
  }

  if (publishedCount && !dryRun) {
    await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }
  reports.push({
    projectId: pkg.project.id,
    locality: pkg.project.locality,
    published: publishedCount,
    decisions,
  });
  console.log(`${pkg.project.locality}: published ${publishedCount} practical place(s)`);
}

if (!dryRun) {
  await writeFile(curationPath, `${JSON.stringify(curation, null, 2)}\n`, 'utf8');
}
const decisionTotals = reports
  .flatMap((report) => report.decisions)
  .reduce<Record<string, number>>((totals, decision) => {
    totals[decision.decision] = (totals[decision.decision] ?? 0) + 1;
    return totals;
  }, {});
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: 'All bundled GB-ENG towns using their active curated visitor boundaries.',
  policy: {
    seeAndEat: 'OSM discovery only; independent visitor research and scoring remain mandatory.',
    parking: 'Distinct public visitor parking only; no customer, staff, school, retail or residential lots.',
    toilets: 'General public facilities with a defensible location-specific name only.',
    picnic: 'One visitor-facing place per coherent table or picnic-site cluster.',
  },
  totals: decisionTotals,
  towns: reports,
};
if (!dryRun) {
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(
    reportMarkdownPath,
    `${[
    '# England practical OSM reconciliation',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Published: ${decisionTotals.published ?? 0}`,
    `Already curated or represented: ${(decisionTotals['already-curated'] ?? 0) + (decisionTotals['already-represented'] ?? 0)}`,
    `Excluded after review: ${decisionTotals.excluded ?? 0}`,
    `See/Eat held for editorial review: ${decisionTotals['editorial-review-only'] ?? 0}`,
    '',
    '| Town | Newly published practical places | Decisions |',
    '| --- | ---: | ---: |',
    ...reports.map(
      (town) => `| ${town.locality} | ${town.published} | ${town.decisions.length} |`,
    ),
    ].join('\n')}\n`,
    'utf8',
  );
  console.log(`Wrote ${reportJsonPath}`);
} else {
  await writeFile(
    resolve(`tmp/england-practical-osm-reconciliation-${reviewedDate}-dry-run.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  console.log(`Dry run totals: ${JSON.stringify(decisionTotals)}`);
}
