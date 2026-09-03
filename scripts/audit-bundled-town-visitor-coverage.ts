import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point, pointOnFeature } from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { publishedDogAccessForPlace } from '../src/data/dogAccessCuration';
import { publishedProjectPackages } from '../src/data/publishedProjects';
import { publishedPlannerCurationForProject } from '../src/data/visitorPlannerCuration';
import type { HeritageFeature } from '../src/domain/models';
import { hasHistoricTimelineDate } from '../src/domain/timeline';
import {
  ratingForProject,
  townRatingEvidenceForProject,
} from '../src/domain/townRating';
import {
  currentPlaceInfo,
  osmTagValue,
  parkingPriceStatus,
  visitorNeedPlaces,
  type VisitorNeed,
} from '../src/domain/visitorExperience';

const reviewedAt = new Date().toISOString();
const localDateParts = Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date())
    .map((part) => [part.type, part.value]),
);
const reviewDate = `${localDateParts.year}-${localDateParts.month}-${localDateParts.day}`;
const reportPath = resolve(`data/review/all-town-bundled-visitor-audit-${reviewDate}.json`);
const coveragePath = resolve(`data/review/cross-town-visitor-coverage-${reviewDate}.json`);
const dogResearchPath = resolve(`data/review/dog-access-research-queue-${reviewDate}.json`);
const trailResearchPath = resolve(`data/review/trail-research-queue-${reviewDate}.json`);
const needs: VisitorNeed[] = ['see', 'eat', 'trails', 'picnic', 'parking', 'toilets'];
const nonVisitorParkingName = /\b(?:bus|coach|motorcycle|cycle|bicycle|loading|drop[ -]?off|church|chapel|mosque|school|college|university|hospital|surgery|clinic|hotel|inn|pub|restaurant|cafe|caf[eé]|club|rugby|football|supermarket|retail|shop|store|garden centre|cinema|theatre|leisure centre|community centre|warehouse|depot)\b/i;
const genericNames: Partial<Record<VisitorNeed, RegExp>> = {
  eat: /^(cafe|café|restaurant|takeaway|fast food|coffee shop)$/i,
  picnic: /^(picnic site|picnic area|picnic table)$/i,
  parking: /^(parking|car park)$/i,
  toilets: /^(public toilets|toilets)$/i,
};

type ActiveBoundary = Feature<Polygon | MultiPolygon>;

function detail(feature: HeritageFeature, key: string): string | undefined {
  return currentPlaceInfo(feature).currentDetails.find((item) => item.key === key)?.value;
}

function safeHttpUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function safeRouteResource(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return safeHttpUrl(value);
}

function responsibleExternalUrl(feature: HeritageFeature): string | undefined {
  for (const key of ['website', 'external_url', 'map']) {
    const url = safeRouteResource(detail(feature, key));
    if (url && !/openstreetmap\.org/i.test(url)) return url;
  }
  for (const source of [...feature.sourceRecords].reverse()) {
    const url = safeRouteResource(source.sourceUrl);
    if (url && !/openstreetmap/i.test(source.sourceName) && !/openstreetmap\.org/i.test(url)) {
      return url;
    }
  }
  return undefined;
}

function numericScore(feature: HeritageFeature, need: VisitorNeed): number | undefined {
  const keys = need === 'trails' ? ['trail_score', 'visit_score'] : ['visit_score'];
  for (const key of keys) {
    const value = Number(detail(feature, key));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function featureInsideBoundary(feature: HeritageFeature, boundary: ActiveBoundary): boolean {
  if (!feature.geometry) return false;
  try {
    const location =
      feature.geometry.type === 'Point'
        ? point(feature.geometry.coordinates)
        : pointOnFeature({ type: 'Feature', properties: {}, geometry: feature.geometry });
    return booleanPointInPolygon(location, boundary);
  } catch {
    return false;
  }
}

function issueForFeature(
  feature: HeritageFeature,
  need: VisitorNeed,
  boundary: ActiveBoundary,
  scoreOverride?: number,
): string[] {
  const issues: string[] = [];
  const access = osmTagValue(feature, 'access') ?? detail(feature, 'access');
  // Paying customers are valid visitors for attractions and food venues. The
  // same tag still excludes customer-only practical facilities from the
  // public parking, toilet and picnic lists.
  const blocksPublicVisit = /^(?:private|permit|residents|no)$/i.test(access ?? '')
    || (access === 'customers' && ['parking', 'toilets', 'picnic'].includes(need));
  if (blocksPublicVisit) issues.push(`restricted access: ${access}`);
  if (genericNames[need]?.test(feature.name.trim())) issues.push('generic name');
  if (!feature.geometry) issues.push('map geometry missing');
  else if (
    feature.evidenceScope !== 'related_context' &&
    !featureInsideBoundary(feature, boundary)
  ) {
    issues.push('outside active visitor boundary');
  }
  if (need === 'parking' && parkingPriceStatus(feature) === 'unknown') {
    issues.push('parking price status unknown');
  }
  if (need === 'parking') {
    const operator = `${osmTagValue(feature, 'operator') ?? detail(feature, 'operator') ?? ''} ${osmTagValue(feature, 'operator:type') ?? detail(feature, 'operator:type') ?? ''}`;
    const accessValue = osmTagValue(feature, 'access') ?? detail(feature, 'access') ?? '';
    const publicEvidence = /\b(?:council|district|borough|city|county|local authority|wrexham|flintshire|denbighshire|conwy|public|government)\b/i.test(`${operator} ${accessValue}`);
    if (nonVisitorParkingName.test(feature.name) && !publicEvidence) {
      issues.push('not a general public visitor car park');
    }
  }
  if (
    (need === 'see' || need === 'eat' || need === 'trails') &&
    !Number.isFinite(scoreOverride ?? numericScore(feature, need))
  ) {
    issues.push(`${need} score missing`);
  }
  if (need === 'trails' && !responsibleExternalUrl(feature)) {
    issues.push('responsible external trail link missing');
  }
  return issues;
}

function dogAudit(projectId: string, featureIds: string[], kind: 'attraction' | 'eat') {
  const entries = featureIds.map((featureId) => ({
    featureId,
    info: publishedDogAccessForPlace(projectId, kind, featureId),
  }));
  return {
    total: entries.length,
    explicit: entries.filter(({ info }) => info && info.status !== 'unconfirmed').length,
    unconfirmed: entries
      .filter(({ info }) => info?.status === 'unconfirmed')
      .map(({ featureId }) => featureId),
    missing: entries.filter(({ info }) => !info).map(({ featureId }) => featureId),
    missingSource: entries
      .filter(({ info }) => info && (!info.sourceName || !safeHttpUrl(info.sourceUrl)))
      .map(({ featureId }) => featureId),
  };
}

const towns = publishedProjectPackages.map((pkg) => {
  const curation = publishedPlannerCurationForProject(pkg.project.id);
  const featureById = new Map(pkg.features.map((feature) => [feature.id, feature]));
  const activeBoundary = (pkg.project.townStudyArea?.visitorBoundary ??
    pkg.project.boundary) as ActiveBoundary;
  const publishedRating = pkg.project.touristAppeal?.rating ?? 0;
  const seeScores = new Map(
    (pkg.project.visitorHighlights ?? []).map((highlight) => [
      highlight.featureId,
      highlight.visitorScore,
    ]),
  );
  const categories = Object.fromEntries(
    needs.map((need) => {
      const curatedIds =
        need === 'see'
          ? (pkg.project.visitorHighlights ?? []).map((highlight) => highlight.featureId)
          : (curation[need] ?? []);
      const curatedPlaces = visitorNeedPlaces(pkg, need, Number.MAX_SAFE_INTEGER, {
        curatedFeatureIds: curatedIds,
      });
      const availablePlaces = visitorNeedPlaces(pkg, need, Number.MAX_SAFE_INTEGER);
      const curatedIdSet = new Set(curatedIds);
      const duplicateRequestedIds = [...new Set(
        curatedIds.filter((featureId, index) => curatedIds.indexOf(featureId) !== index),
      )];
      const duplicateNames = [...new Set(
        curatedPlaces
          .map((place) => place.name.toLocaleLowerCase('en-GB'))
          .filter((name, index, names) => names.indexOf(name) !== index),
      )];
      const issues = curatedIds.flatMap((featureId) => {
        const feature = featureById.get(featureId);
        if (!feature) return [{ featureId, name: featureId, issues: ['missing feature'] }];
        const featureIssues = issueForFeature(
          feature,
          need,
          activeBoundary,
          need === 'see' ? seeScores.get(featureId) : undefined,
        );
        return featureIssues.length
          ? [{ featureId, name: feature.name, issues: featureIssues }]
          : [];
      });
      const requestedScores = curatedIds
        .map((featureId) => {
          const feature = featureById.get(featureId);
          if (!feature) return undefined;
          return need === 'see' ? seeScores.get(featureId) : numericScore(feature, need);
        })
        .filter((score): score is number => Number.isFinite(score));
      const sortedScores = [...requestedScores].sort((left, right) => right - left);
      const candidates = availablePlaces
        .filter((place) => !curatedIdSet.has(place.id))
        .filter((place) => !genericNames[need]?.test(place.name.trim()))
        .slice(0, 30)
        .map((place) => ({ id: place.id, name: place.name, score: place.visitorScore }));
      return [
        need,
        {
          listed: curatedPlaces.length,
          requestedIds: curatedIds.length,
          availableInBundledData: availablePlaces.length,
          unresolvedIds: curatedIds.filter((featureId) => !featureById.has(featureId)),
          duplicateRequestedIds,
          duplicateNames,
          scoreOrderValid:
            need === 'see' || need === 'eat' || need === 'trails'
              ? requestedScores.every((score, index) => score === sortedScores[index])
              : undefined,
          exceedsPublicCap:
            (need === 'see' || need === 'eat') && curatedPlaces.length > 20,
          issues,
          uncuratedCandidates: candidates,
        },
      ];
    }),
  ) as Record<VisitorNeed, {
    listed: number;
    requestedIds: number;
    availableInBundledData: number;
    unresolvedIds: string[];
    duplicateRequestedIds: string[];
    duplicateNames: string[];
    scoreOrderValid?: boolean;
    exceedsPublicCap: boolean;
    issues: Array<{ featureId: string; name: string; issues: string[] }>;
    uncuratedCandidates: Array<{ id: string; name: string; score?: number }>;
  }>;
  const attractionIds = (pkg.project.visitorHighlights ?? []).map(
    (highlight) => highlight.featureId,
  );
  const eatIds = curation.eat ?? [];
  const allPlannerIds = new Set([
    ...attractionIds,
    ...needs.flatMap((need) => curation[need] ?? []),
  ]);
  const historicFeatures = pkg.features.filter(
    (feature) =>
      !allPlannerIds.has(feature.id) &&
      feature.evidenceScope !== 'related_context' &&
      feature.evidenceScope !== 'out_of_scope' &&
      !feature.tags.includes('current-context') &&
      !feature.tags.includes('osm-current-place'),
  );
  const ratingEvidence = townRatingEvidenceForProject(pkg, curation);
  const expectedRating = ratingForProject(pkg, curation);
  return {
    projectId: pkg.project.id,
    locality: pkg.project.locality,
    country: pkg.project.country,
    featureCount: pkg.features.length,
    activeBoundarySource:
      activeBoundary.properties?.sourceDataset ?? activeBoundary.properties?.sourceName ?? 'unknown',
    categories,
    dogAccess: {
      attractions: dogAudit(pkg.project.id, attractionIds, 'attraction'),
      eat: dogAudit(pkg.project.id, eatIds, 'eat'),
    },
    trails: {
      curated: categories.trails.requestedIds,
      valid: ratingEvidence.trails.length,
      researchGap: ratingEvidence.trails.length === 0,
    },
    heatMapDates: {
      historicFeatures: historicFeatures.length,
      datedFeatures: historicFeatures.filter(hasHistoricTimelineDate).length,
      coveragePercent: historicFeatures.length
        ? Math.round(
            (historicFeatures.filter(hasHistoricTimelineDate).length / historicFeatures.length) *
              100,
          )
        : 100,
    },
    townRating: {
      published: publishedRating,
      expected: expectedRating,
      compliant: publishedRating === expectedRating,
      evidence: ratingEvidence,
    },
  };
});

const categoryTotals = Object.fromEntries(
  needs.map((need) => [
    need,
    {
      listed: towns.reduce((sum, town) => sum + town.categories[need].listed, 0),
      townsWithNone: towns.filter((town) => town.categories[need].listed === 0).length,
      recordsWithIssues: towns.reduce(
        (sum, town) =>
          sum +
          town.categories[need].issues.filter(
            (issue) =>
              !(
                need === 'parking' &&
                issue.issues.length === 1 &&
                issue.issues[0] === 'parking price status unknown'
              ),
          ).length,
        0,
      ),
      recordsNeedingResearch: towns.reduce(
        (sum, town) =>
          sum +
          town.categories[need].issues.filter((issue) =>
            issue.issues.includes('parking price status unknown'),
          ).length,
        0,
      ),
    },
  ]),
);
const summary = {
  townCount: towns.length,
  categoryTotals,
  dogAccess: {
    attractions: {
      total: towns.reduce((sum, town) => sum + town.dogAccess.attractions.total, 0),
      explicit: towns.reduce((sum, town) => sum + town.dogAccess.attractions.explicit, 0),
      unconfirmed: towns.reduce(
        (sum, town) => sum + town.dogAccess.attractions.unconfirmed.length,
        0,
      ),
      missing: towns.reduce((sum, town) => sum + town.dogAccess.attractions.missing.length, 0),
    },
    eat: {
      total: towns.reduce((sum, town) => sum + town.dogAccess.eat.total, 0),
      explicit: towns.reduce((sum, town) => sum + town.dogAccess.eat.explicit, 0),
      unconfirmed: towns.reduce((sum, town) => sum + town.dogAccess.eat.unconfirmed.length, 0),
      missing: towns.reduce((sum, town) => sum + town.dogAccess.eat.missing.length, 0),
    },
  },
  trailCoverage: {
    townsWithValidTrails: towns.filter((town) => town.trails.valid > 0).length,
    townsWithoutValidTrails: towns.filter((town) => town.trails.researchGap).length,
    curatedTrailRecords: towns.reduce((sum, town) => sum + town.trails.curated, 0),
    validTrailRecords: towns.reduce((sum, town) => sum + town.trails.valid, 0),
  },
  boundaries: {
    outOfBoundaryRecords: towns.reduce(
      (sum, town) =>
        sum +
        needs.reduce(
          (needSum, need) =>
            needSum +
            town.categories[need].issues.filter((issue) =>
              issue.issues.includes('outside active visitor boundary'),
            ).length,
          0,
        ),
      0,
    ),
  },
  heatMapDates: {
    townsBelow50Percent: towns.filter((town) => town.heatMapDates.coveragePercent < 50).length,
    historicFeatures: towns.reduce((sum, town) => sum + town.heatMapDates.historicFeatures, 0),
    datedFeatures: towns.reduce((sum, town) => sum + town.heatMapDates.datedFeatures, 0),
  },
  ratings: {
    nonCompliantTowns: towns.filter((town) => !town.townRating.compliant).length,
  },
};

const report = {
  schemaVersion: 2,
  reviewedAt,
  scope:
    'All published project packages. Candidate counts use the active visitor boundary and bundled feature library. Trail and dog research gaps require source-backed review and are never auto-published from OSM paths or inference.',
  summary,
  towns,
};

const coverage = {
  schemaVersion: 2,
  reviewedAt,
  policy: {
    see: 'Up to 20 reviewed in-boundary attractions, ordered by visitor score.',
    eat: 'Up to 20 reviewed in-boundary daytime food stops, ordered by visitor score.',
    trails:
      'Only genuine visitor routes with a score and responsible external route link. OSM paths alone do not qualify.',
    dogAccess:
      'Every See and Eat place must have an explicit 0-3 dog-access record. Unconfirmed policies remain visible in detail and in the research queue.',
    practical:
      'No display cap. Include every reviewed in-boundary picnic place, public car park and public toilet, using location-specific names.',
  },
  towns: towns.map((town) => ({
    projectId: town.projectId,
    locality: town.locality,
    ...Object.fromEntries(needs.map((need) => [need, town.categories[need].listed])),
    dogAttractionsUnconfirmed: town.dogAccess.attractions.unconfirmed.length,
    dogEatUnconfirmed: town.dogAccess.eat.unconfirmed.length,
    validTrails: town.trails.valid,
    heatMapDateCoveragePercent: town.heatMapDates.coveragePercent,
  })),
};

const packageByProjectId = new Map(
  publishedProjectPackages.map((pkg) => [pkg.project.id, pkg]),
);
const dogAccessResearch = towns.flatMap((town) => {
  const pkg = packageByProjectId.get(town.projectId);
  const featureById = new Map(pkg?.features.map((feature) => [feature.id, feature]) ?? []);
  return [
    ...town.dogAccess.attractions.unconfirmed.map((featureId) => ({
      projectId: town.projectId,
      locality: town.locality,
      category: 'see' as const,
      featureId,
      name: featureById.get(featureId)?.name ?? featureId,
    })),
    ...town.dogAccess.eat.unconfirmed.map((featureId) => ({
      projectId: town.projectId,
      locality: town.locality,
      category: 'eat' as const,
      featureId,
      name: featureById.get(featureId)?.name ?? featureId,
    })),
  ];
});
const trailResearch = towns
  .filter((town) => town.trails.researchGap)
  .map((town) => ({
    projectId: town.projectId,
    locality: town.locality,
    country: town.country,
    bundledTrailCandidates: town.categories.trails.availableInBundledData,
    instruction:
      'Run npm run audit-online-trails, review its live provider and web-search candidates, then inspect each route against the active polygon. Publish only an in-scope route with a responsible external link and a defensible trail score.',
  }));

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(coveragePath, `${JSON.stringify(coverage, null, 2)}\n`);
await writeFile(
  dogResearchPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      reviewedAt,
      policy:
        'Never infer dog access. Confirm each policy from an operator, venue or responsible visitor source, then assign the published 0-3 dog-access rating.',
      total: dogAccessResearch.length,
      records: dogAccessResearch,
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  trailResearchPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      reviewedAt,
      policy:
        'This bundled-data check is not an internet search. Use data/review/online-town-trail-audit.json for online discovery. A town without a trail is valid only after review; do not turn an ordinary OSM path into a visitor trail or include a route outside the active visitor boundary.',
      onlineResearchReport: 'data/review/online-town-trail-audit.json',
      total: trailResearch.length,
      towns: trailResearch,
    },
    null,
    2,
  )}\n`,
);
console.log(JSON.stringify(summary, null, 2));
console.log(`Audited ${towns.length} published towns.`);
console.log(reportPath);
console.log(dogResearchPath);
console.log(trailResearchPath);
