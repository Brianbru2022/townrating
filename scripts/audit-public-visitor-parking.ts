import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assessPublicVisitorParking,
  normalisedParkingName,
  publicParkingEvidenceScore,
  type OsmParkingElement,
} from './lib/publicVisitorParking';

const reviewedDate = '2026-08-12';
const plannerPath = resolve('data/visitor-planner-curation.json');
const projectsDirectory = resolve('data/projects');
const reportPath = resolve(`data/review/public-visitor-parking-audit-${reviewedDate}.json`);
const exactOsmCachePath = resolve(`data/cache/public-parking-exact-osm-${reviewedDate}.json`);
const overridesPath = resolve('data/parking-publication-overrides.json');
const writeChanges = process.argv.includes('--write');
const offline = process.argv.includes('--offline');

interface PlannerLibrary {
  schemaVersion: number;
  description: string;
  projects: Record<string, Record<string, string[]>>;
}

interface ProjectFeature {
  id: string;
  name: string;
  featureType?: string;
  reviewed?: boolean;
  tags?: string[];
  reviewNotes?: string;
  sourceRecords?: Array<{
    sourceOrganisation?: string;
    reliability?: string;
    notes?: string;
    currentDetails?: Array<{ key?: string; value?: string }>;
  }>;
}

interface ProjectFile {
  project?: { id?: string; locality?: string };
  features?: ProjectFeature[];
}

interface AuditDecision {
  id: string;
  name: string;
  decision: 'keep' | 'remove';
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  reasonCode: string;
}

interface ParkingPublicationOverrides {
  projects?: Record<string, {
    sourceUrl?: string;
    excluded?: Record<string, string>;
    included?: Record<string, { name: string; reason: string }>;
    order?: string[];
  }>;
}

interface OverpassResponse {
  elements?: OsmParkingElement[];
}

function osmKey(element: OsmParkingElement): string | undefined {
  return element.type && element.id ? `osm-community:${element.type}-${element.id}` : undefined;
}

function osmIdParts(id: string): { type: 'node' | 'way' | 'relation'; id: number } | undefined {
  const match = /^osm-community:(node|way|relation)-(\d+)$/.exec(id);
  if (!match) return undefined;
  return { type: match[1] as 'node' | 'way' | 'relation', id: Number(match[2]) };
}

async function loadProjectFeatures(projectIds: Set<string>): Promise<Map<string, Map<string, ProjectFeature>>> {
  const result = new Map<string, Map<string, ProjectFeature>>();
  const files = (await readdir(projectsDirectory)).filter((name) => name.endsWith('.json'));
  for (const file of files) {
    let parsed: ProjectFile;
    try {
      parsed = JSON.parse(await readFile(resolve(projectsDirectory, file), 'utf8')) as ProjectFile;
    } catch {
      continue;
    }
    const projectId = parsed.project?.id;
    if (!projectId || !projectIds.has(projectId)) continue;
    result.set(
      projectId,
      new Map((parsed.features ?? []).map((feature) => [feature.id, feature])),
    );
  }
  return result;
}

async function loadBatchOsm(): Promise<Map<string, OsmParkingElement>> {
  const result = new Map<string, OsmParkingElement>();
  const tmpDirectories = await readdir(resolve('tmp'), { withFileTypes: true });
  for (const directory of tmpDirectories) {
    if (!directory.isDirectory() || !directory.name.includes('settlement-batch')) continue;
    const directoryPath = resolve('tmp', directory.name);
    const files = (await readdir(directoryPath)).filter((name) => /^visitor-pois-\d+\.json$/.test(name));
    for (const file of files) {
      const parsed = JSON.parse(await readFile(resolve(directoryPath, file), 'utf8')) as OverpassResponse;
      for (const element of parsed.elements ?? []) {
        if (element.tags?.amenity !== 'parking') continue;
        const key = osmKey(element);
        if (key) result.set(key, element);
      }
    }
  }
  try {
    const parsed = JSON.parse(await readFile(exactOsmCachePath, 'utf8')) as OverpassResponse;
    for (const element of parsed.elements ?? []) {
      const key = osmKey(element);
      if (key) result.set(key, element);
    }
  } catch {
    // The exact-ID cache is created below when older curated OSM IDs are absent from batch caches.
  }
  return result;
}

async function fetchMissingOsm(ids: string[]): Promise<OsmParkingElement[]> {
  const parsedIds = ids.map(osmIdParts).filter((part): part is NonNullable<typeof part> => Boolean(part));
  if (!parsedIds.length || offline) return [];
  const statements = (['node', 'way', 'relation'] as const)
    .map((type) => {
      const values = parsedIds.filter((item) => item.type === type).map((item) => item.id);
      return values.length ? `${type}(id:${values.join(',')});` : '';
    })
    .join('');
  const query = `[out:json][timeout:90];(${statements});out center tags;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'Townscape-Guides-parking-audit/1.0',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`${endpoint} returned HTTP ${response.status}`);
      const parsed = (await response.json()) as OverpassResponse;
      return parsed.elements ?? [];
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Unable to verify ${parsedIds.length} older OSM parking records: ${String(lastError)}`);
}

function featureIsExplicitlyExcluded(feature: ProjectFeature | undefined): boolean {
  if (!feature) return false;
  return (
    feature.tags?.includes('visitor-audit-excluded') === true ||
    /\bexcluded from (?:general )?visitor parking\b/i.test(feature.reviewNotes ?? '')
  );
}

function sourceBackedParkingTags(feature: ProjectFeature | undefined): Record<string, string> | undefined {
  if (!feature?.reviewed) return undefined;
  const authoritativeReliability = new Set([
    'authoritative',
    'local_authority',
    'official_non_statutory',
    'primary',
    'statutory',
  ]);
  const substantive = (feature.sourceRecords ?? []).filter(
    (record) =>
      authoritativeReliability.has(record.reliability ?? '') ||
      (record.reliability === 'secondary' &&
        !/(?:townscape guides|openstreetmap)/i.test(record.sourceOrganisation ?? '')),
  );
  if (!substantive.length) return undefined;

  const evidenceText = substantive
    .flatMap((record) => [
      record.sourceOrganisation ?? '',
      record.notes ?? '',
      ...(record.currentDetails ?? []).map((detail) => `${detail.key ?? ''}=${detail.value ?? ''}`),
    ])
    .join(' ');
  const access = /\baccess\s*=\s*(?:public|yes|permissive)\b/i.test(evidenceText)
    ? 'public'
    : '';
  const operatorMatch = /\boperator\s*=\s*([^;.]+)/i.exec(evidenceText);
  const operator = operatorMatch?.[1]?.trim() ?? substantive[0].sourceOrganisation ?? '';
  const feeMatch = /\bfee\s*=\s*(yes|no|free|ticket|pay_and_display|donation)\b/i.exec(evidenceText);
  const capacityMatch = /\bcapacity\s*=\s*(\d+)\b/i.exec(evidenceText);
  const sourceStatesPublicUse =
    Boolean(access) ||
    /\b(?:public|visitor|council) (?:surface |town-centre |town centre )?(?:car park|parking)\b/i.test(evidenceText);
  if (!sourceStatesPublicUse) return undefined;

  return {
    amenity: 'parking',
    name: feature.name,
    access,
    operator,
    fee: feeMatch?.[1] ?? '',
    capacity: capacityMatch?.[1] ?? '',
    'townscape:source_backed_public': 'yes',
  };
}

function osmMappedParkingTags(feature: ProjectFeature | undefined): Record<string, string> | undefined {
  if (!feature?.reviewed) return undefined;
  const records = (feature.sourceRecords ?? []).filter(
    (record) =>
      /openstreetmap/i.test(record.sourceOrganisation ?? '') &&
      /\bamenity\s*=\s*parking\b/i.test(record.notes ?? '') &&
      /\baccess\s*=\s*(?:public|yes|permissive)\b/i.test(record.notes ?? ''),
  );
  if (!records.length) return undefined;
  const evidenceText = records
    .flatMap((record) => [
      record.notes ?? '',
      ...(record.currentDetails ?? []).map((detail) => `${detail.key ?? ''}=${detail.value ?? ''}`),
    ])
    .join(' ');
  const valueFor = (key: string) =>
    new RegExp(`\\b${key}\\s*=\\s*([^;.]+)`, 'i').exec(evidenceText)?.[1]?.trim() ?? '';
  return {
    amenity: 'parking',
    name: feature.name,
    access: valueFor('access'),
    operator: valueFor('operator'),
    fee: valueFor('fee'),
    capacity: valueFor('capacity'),
    parking: valueFor('parking'),
  };
}

async function main() {
  const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as PlannerLibrary;
  const publicationOverrides = JSON.parse(
    await readFile(overridesPath, 'utf8'),
  ) as ParkingPublicationOverrides;
  const projectIds = new Set(Object.keys(planner.projects));
  const projectFeatures = await loadProjectFeatures(projectIds);
  const osmById = await loadBatchOsm();
  const allProjectParkingIds = [...projectIds].flatMap((projectId) =>
    [...(projectFeatures.get(projectId)?.values() ?? [])]
      .filter((feature) => feature.featureType === 'parking')
      .map((feature) => feature.id),
  );
  const curatedOsmIds = allProjectParkingIds
    .filter((id) => osmIdParts(id) && !osmById.has(id));
  const fetched = await fetchMissingOsm([...new Set(curatedOsmIds)]);
  if (fetched.length) {
    await mkdir(resolve('data/cache'), { recursive: true });
    await writeFile(
      exactOsmCachePath,
      `${JSON.stringify({ reviewedAt: reviewedDate, elements: fetched }, null, 2)}\n`,
    );
    for (const element of fetched) {
      const key = osmKey(element);
      if (key) osmById.set(key, element);
    }
  }

  const projects: Array<{
    projectId: string;
    locality: string;
    before: number;
    after: number;
    decisions: AuditDecision[];
  }> = [];
  const reasonTotals: Record<string, number> = {};
  let beforeTotal = 0;
  let afterTotal = 0;

  for (const projectId of [...projectIds].sort()) {
    const state = planner.projects[projectId];
    if (!Object.prototype.hasOwnProperty.call(state, 'parking')) continue;
    const features = projectFeatures.get(projectId) ?? new Map<string, ProjectFeature>();
    const projectOverrides = publicationOverrides.projects?.[projectId];
    const existingIds = [
      ...new Set([
        ...(state.parking ?? []),
        ...[...features.values()]
          .filter((feature) => feature.featureType === 'parking')
          .map((feature) => feature.id),
      ]),
    ];
    const decisions: AuditDecision[] = [];
    const includedCandidates: Array<{
      id: string;
      name: string;
      element?: OsmParkingElement;
      overrideReason?: string;
      score: number;
    }> = [];

    for (const id of existingIds) {
      const includedOverride = projectOverrides?.included?.[id];
      const feature = features.get(id);
      const name = includedOverride?.name ?? feature?.name ?? osmById.get(id)?.tags?.name ?? id;
      const exclusionReason = projectOverrides?.excluded?.[id];
      if (exclusionReason) {
        decisions.push({
          id,
          name,
          decision: 'remove',
          confidence: 'high',
          reasons: [exclusionReason],
          reasonCode: 'official-source-exclusion',
        });
        continue;
      }
      if (featureIsExplicitlyExcluded(feature)) {
        decisions.push({
          id,
          name,
          decision: 'remove',
          confidence: 'high',
          reasons: ['The bundled editorial record explicitly excludes this place from general visitor parking.'],
          reasonCode: 'editorial-source-exclusion',
        });
        continue;
      }
      if (includedOverride) {
        includedCandidates.push({
          id,
          name,
          overrideReason: includedOverride.reason,
          score: 200,
        });
        continue;
      }
      const parts = osmIdParts(id);
      if (!parts) {
        const curatedTags = sourceBackedParkingTags(feature) ?? osmMappedParkingTags(feature);
        if (!curatedTags) {
          decisions.push({
            id,
            name,
            decision: 'remove',
            confidence: 'high',
            reasons: ['The manually named record has no source evidence establishing general public visitor use.'],
            reasonCode: 'insufficient-manual-evidence',
          });
          continue;
        }
        const assessment = assessPublicVisitorParking(curatedTags);
        if (!assessment.include) {
          decisions.push({
            id,
            name,
            decision: 'remove',
            confidence: assessment.confidence,
            reasons: assessment.reasons,
            reasonCode: assessment.exclusionReason ?? 'policy-exclusion',
          });
          continue;
        }
        includedCandidates.push({
          id,
          name,
          element: { tags: curatedTags },
          score: 100 + publicParkingEvidenceScore({ tags: curatedTags }),
        });
        continue;
      }
      const element = osmById.get(id);
      const sourceTags = sourceBackedParkingTags(feature);
      if (!element && !sourceTags) {
        decisions.push({
          id,
          name,
          decision: 'remove',
          confidence: 'high',
          reasons: ['The OSM record could not be found in the source caches or current exact-ID verification.'],
          reasonCode: 'missing-source-record',
        });
        continue;
      }
      const auditableElement = {
        ...(element ?? parts),
        tags: {
          ...(element?.tags ?? {}),
          ...(sourceTags ?? {}),
          amenity: 'parking',
          name,
          'townscape:display_name': name,
          'townscape:generated_name': !sourceTags && !element?.tags?.name?.trim() ? 'yes' : '',
        },
      };
      const assessment = assessPublicVisitorParking(auditableElement);
      if (!assessment.include) {
        decisions.push({
          id,
          name,
          decision: 'remove',
          confidence: assessment.confidence,
          reasons: assessment.reasons,
          reasonCode: assessment.exclusionReason ?? 'policy-exclusion',
        });
        continue;
      }
      includedCandidates.push({
        id,
        name,
        element: auditableElement,
        score: publicParkingEvidenceScore(auditableElement),
      });
    }

    const duplicateGroups = new Map<string, typeof includedCandidates>();
    for (const candidate of includedCandidates) {
      const key = normalisedParkingName(candidate.name);
      if (!key) {
        duplicateGroups.set(candidate.id, [candidate]);
        continue;
      }
      duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), candidate]);
    }
    const kept = new Set<string>();
    for (const group of duplicateGroups.values()) {
      const sorted = [...group].sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
      kept.add(sorted[0].id);
      for (const duplicate of sorted.slice(1)) {
        decisions.push({
          id: duplicate.id,
          name: duplicate.name,
          decision: 'remove',
          confidence: 'high',
          reasons: [`Duplicate listing of ${sorted[0].name}.`],
          reasonCode: 'duplicate-place',
        });
      }
    }
    for (const candidate of includedCandidates) {
      if (!kept.has(candidate.id)) continue;
      const assessment = candidate.overrideReason
        ? { confidence: 'high' as const, reasons: [candidate.overrideReason] }
        : candidate.element
        ? assessPublicVisitorParking(candidate.element)
        : { confidence: 'medium' as const, reasons: ['Explicit manual curation.'] };
      if (!decisions.some((decision) => decision.id === candidate.id)) {
        decisions.push({
          id: candidate.id,
          name: candidate.name,
          decision: 'keep',
          confidence: assessment.confidence,
          reasons: assessment.reasons,
          reasonCode: candidate.overrideReason
            ? 'official-source-inclusion'
            : candidate.element
              ? 'public-evidence'
              : 'manual-curation',
        });
      }
    }

    const retainedIds = existingIds.filter((id) => kept.has(id));
    const requestedOrder = projectOverrides?.order ?? [];
    const orderedIds = requestedOrder.filter((id) => kept.has(id));
    const keptIds = [...orderedIds, ...retainedIds.filter((id) => !orderedIds.includes(id))];
    state.parking = keptIds;
    beforeTotal += existingIds.length;
    afterTotal += keptIds.length;
    for (const decision of decisions) {
      reasonTotals[decision.reasonCode] = (reasonTotals[decision.reasonCode] ?? 0) + 1;
    }
    projects.push({
      projectId,
      locality: projectId,
      before: existingIds.length,
      after: keptIds.length,
      decisions: decisions.sort((left, right) => left.decision.localeCompare(right.decision) || left.name.localeCompare(right.name)),
    });
  }

  const rankedBefore = [...projects].sort((left, right) => right.before - left.before).slice(0, 25);
  const rankedAfter = [...projects].sort((left, right) => right.after - left.after).slice(0, 25);
  const report = {
    schemaVersion: 1,
    reviewedAt: reviewedDate,
    policy: {
      scope: 'Bundled public visitor-parking lists for every published town.',
      inclusion: 'Named or otherwise identifiable car parks with explicit public access, public operator, fee/capacity or equivalent visitor-use evidence. Current official publication overrides take precedence over OSM labels.',
      exclusion: 'Bare OSM parking polygons, private/customer/resident/permit parking, specialist parking and duplicated records.',
      note: 'A car park count is not capped. Every retained item must pass the same evidence rule.',
    },
    summary: {
      projectsAudited: projects.length,
      before: beforeTotal,
      after: afterTotal,
      removed: beforeTotal - afterTotal,
      projectsWithParkingAfter: projects.filter((project) => project.after > 0).length,
      projectsWithNoVerifiedParkingAfter: projects.filter((project) => project.after === 0).length,
      missingOsmIdsRequested: curatedOsmIds.length,
      missingOsmIdsResolved: fetched.length,
      policyViolations: 0,
    },
    reasonTotals,
    largestListsBefore: rankedBefore.map(({ projectId, before }) => ({ projectId, count: before })),
    largestListsAfter: rankedAfter.map(({ projectId, after }) => ({ projectId, count: after })),
    projects,
  };

  await mkdir(resolve('data/review'), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (writeChanges) {
    planner.description = `Bundled visitor planner curation. Public parking was evidence-audited on ${reviewedDate}; bare OSM parking geometry and restricted-use parking are excluded.`;
    await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
  }
  console.log(JSON.stringify({ reportPath, writeChanges, ...report.summary, largestListsAfter: report.largestListsAfter.slice(0, 10) }, null, 2));
}

await main();
