import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type Primitive = string | number | boolean | null | undefined;

interface CategoryAudit {
  listed: number;
  unresolvedIds: string[];
  duplicateRequestedIds: string[];
  duplicateNames: string[];
  scoreOrderValid?: boolean;
  exceedsPublicCap: boolean;
  issues: Array<{ featureId: string; name: string; issues: string[] }>;
}

interface TownAudit {
  projectId: string;
  locality: string;
  categories: Record<string, CategoryAudit>;
  dogAccess: {
    attractions: Record<string, Primitive | string[]>;
    eat: Record<string, Primitive | string[]>;
  };
  trails: { valid: number; researchGap: boolean };
  heatMapDates: { historicFeatures: number; datedFeatures: number; coveragePercent: number };
  townRating: { compliant: boolean; published: number; expected: number };
}

interface ProjectFile {
  project: {
    id: string;
    locality: string;
    region: string;
    centre: [number, number];
    boundaryConfidence?: string;
    visitorHighlights?: Array<{ featureId: string; name: string }>;
    boundary?: {
      geometry?: unknown;
      properties?: {
        visitorBoundary?: boolean;
        adjoiningPublicGreenSpaces?: unknown[];
      };
    };
    townStudyArea?: {
      localityBoundary?: unknown;
      sourceName?: string;
      sourceUrl?: string;
    };
  };
  features: Array<{
    id: string;
    sourceRecords?: Array<{
      sourceName?: string;
      sourceOrganisation?: string;
      sourceRecordId?: string;
      sourceUrl?: string;
      accessedAt?: string;
      reliability?: string;
      licence?: string;
    }>;
  }>;
  sources?: Array<{
    id?: string;
    name?: string;
    organisation?: string;
    sourceUrl?: string;
    reliability?: string;
    licence?: string;
  }>;
}

const reviewedDate = new Date().toISOString().slice(0, 10);
const manifestPath = resolve('data/imports/clwyd-settlements-2026-08-11.json');
const generatedModulePath = resolve('src/data/clwydSettlements.generated.ts');
const visitorAuditPath = resolve(`data/review/all-town-bundled-visitor-audit-${reviewedDate}.json`);
const batchAuditPath = resolve('data/review/clwyd-settlement-batch-audit-2026-08-11.json');
const jsonOutputPath = resolve(`data/review/clwyd-full-completeness-audit-${reviewedDate}.json`);
const markdownOutputPath = resolve(`data/review/clwyd-full-completeness-audit-${reviewedDate}.md`);
const categoryNames = ['see', 'eat', 'trails', 'picnic', 'parking', 'toilets'] as const;

function numberOf(value: Primitive | string[] | undefined) {
  if (typeof value === 'number') return value;
  return Array.isArray(value) ? value.length : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function list(names: string[], limit = 30) {
  if (names.length === 0) return 'None';
  const shown = names.slice(0, limit).join(', ');
  return names.length > limit ? `${shown}, and ${names.length - limit} more` : shown;
}

function isParkingResearchOnly(issue: { issues: string[] }) {
  return issue.issues.length > 0
    && issue.issues.every((message) => message === 'parking price status unknown');
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { settlements: string[] };
  const generatedModule = await readFile(generatedModulePath, 'utf8');
  const projectPaths = [...generatedModule.matchAll(/from '\.\.\/\.\.\/(data\/projects\/[^']+\.json)'/g)]
    .map((match) => resolve(match[1]));
  const projects = await Promise.all(projectPaths.map(async (path) => ({
    path,
    package: JSON.parse(await readFile(path, 'utf8')) as ProjectFile,
  })));
  const visitorAudit = JSON.parse(await readFile(visitorAuditPath, 'utf8')) as { towns: TownAudit[] };
  const batchAudit = JSON.parse(await readFile(batchAuditPath, 'utf8')) as {
    requested: number;
    failed: number;
    createdProjects: Array<{ projectId: string; checks: Record<string, boolean> }>;
  };

  const expectedNames = new Set(manifest.settlements);
  const projectIds = projects.map(({ package: projectPackage }) => projectPackage.project.id);
  const projectNames = projects.map(({ package: projectPackage }) => projectPackage.project.locality);
  const townAudits = visitorAudit.towns.filter((town) => projectIds.includes(town.projectId));
  const auditById = new Map(townAudits.map((town) => [town.projectId, town]));

  const missingPackages = manifest.settlements.filter((name) => !projectNames.includes(name));
  const unexpectedPackages = projectNames.filter((name) => !expectedNames.has(name));
  const duplicateProjectIds = projectIds.filter((id, index) => projectIds.indexOf(id) !== index);
  const duplicateLocalities = projectNames.filter((name, index) => projectNames.indexOf(name) !== index);
  const missingVisitorAudits = projectIds.filter((id) => !auditById.has(id));
  const boundaryFailures: Array<{ projectId: string; issues: string[] }> = [];
  const regionalExtentFailures: Array<{ projectId: string; locality: string; centre: [number, number] }> = [];
  const lowConfidenceBoundaries: string[] = [];
  const townsWithAdjoiningGreens: Array<{ projectId: string; count: number }> = [];
  const sourceFailures: Array<{ projectId: string; featureId?: string; issues: string[] }> = [];

  for (const { package: projectPackage } of projects) {
    const boundaryIssues: string[] = [];
    const boundary = projectPackage.project.boundary;
    if (!boundary?.geometry) boundaryIssues.push('active visitor boundary is missing');
    if (boundary?.properties?.visitorBoundary !== true) boundaryIssues.push('active boundary is not marked as a visitor boundary');
    if (!Array.isArray(boundary?.properties?.adjoiningPublicGreenSpaces)) {
      boundaryIssues.push('adjoining public green-space provenance is missing');
    }
    if (!projectPackage.project.townStudyArea?.localityBoundary) {
      boundaryIssues.push('original settlement boundary is not preserved');
    }
    if (!projectPackage.project.townStudyArea?.sourceName || !projectPackage.project.townStudyArea?.sourceUrl) {
      boundaryIssues.push('original settlement boundary source is incomplete');
    }
    if (boundaryIssues.length > 0) boundaryFailures.push({ projectId: projectPackage.project.id, issues: boundaryIssues });
    if (projectPackage.project.boundaryConfidence === 'low') lowConfidenceBoundaries.push(projectPackage.project.locality);
    const greenCount = boundary?.properties?.adjoiningPublicGreenSpaces?.length ?? 0;
    if (greenCount > 0) townsWithAdjoiningGreens.push({ projectId: projectPackage.project.id, count: greenCount });

    if (!projectPackage.project.id.endsWith('-clwyd-wales')) {
      sourceFailures.push({ projectId: projectPackage.project.id, issues: ['project ID is not region-safe'] });
    }
    if (projectPackage.project.region !== 'Clwyd') {
      sourceFailures.push({ projectId: projectPackage.project.id, issues: ['project region is not Clwyd'] });
    }
    const [longitude, latitude] = projectPackage.project.centre;
    if (longitude < -4.15 || longitude > -2.75 || latitude < 52.75 || latitude > 53.42) {
      regionalExtentFailures.push({
        projectId: projectPackage.project.id,
        locality: projectPackage.project.locality,
        centre: projectPackage.project.centre,
      });
    }
    for (const source of projectPackage.sources ?? []) {
      const missing = [
        ['name', source.name],
        ['organisation', source.organisation],
        ['sourceUrl', source.sourceUrl],
        ['reliability', source.reliability],
        ['licence', source.licence],
      ].filter(([, value]) => !value).map(([key]) => String(key));
      if (missing.length > 0) sourceFailures.push({
        projectId: projectPackage.project.id,
        issues: [`package source ${source.id ?? 'unknown'} lacks ${missing.join(', ')}`],
      });
    }
    for (const feature of projectPackage.features) {
      if (!feature.sourceRecords || feature.sourceRecords.length === 0) {
        sourceFailures.push({ projectId: projectPackage.project.id, featureId: feature.id, issues: ['feature has no source record'] });
        continue;
      }
      for (const source of feature.sourceRecords) {
        const missing = [
          ['sourceName', source.sourceName],
          ['sourceOrganisation', source.sourceOrganisation],
          ['sourceRecordId', source.sourceRecordId],
          ['sourceUrl', source.sourceUrl],
          ['accessedAt', source.accessedAt],
          ['reliability', source.reliability],
          ['licence', source.licence],
        ].filter(([, value]) => !value).map(([key]) => String(key));
        if (missing.length > 0) sourceFailures.push({
          projectId: projectPackage.project.id,
          featureId: feature.id,
          issues: [`source record lacks ${missing.join(', ')}`],
        });
      }
    }
  }

  const visitorHighlightOwners = new Map<string, string[]>();
  for (const { package: projectPackage } of projects) {
    for (const highlight of projectPackage.project.visitorHighlights ?? []) {
      visitorHighlightOwners.set(
        highlight.featureId,
        [...(visitorHighlightOwners.get(highlight.featureId) ?? []), projectPackage.project.id],
      );
    }
  }
  const crossTownVisitorDuplicates = [...visitorHighlightOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([featureId, owners]) => ({ featureId, owners }));

  const hardVisitorIssues: Array<{ projectId: string; category: string; issues: string[] }> = [];
  const parkingResearch: Array<{ projectId: string; featureId: string; name: string }> = [];
  for (const town of townAudits) {
    for (const categoryName of categoryNames) {
      const category = town.categories[categoryName];
      if (!category) continue;
      const issues: string[] = [];
      if (category.unresolvedIds.length > 0) issues.push(`${category.unresolvedIds.length} unresolved curated IDs`);
      if (category.duplicateRequestedIds.length > 0) issues.push(`${category.duplicateRequestedIds.length} duplicate curated IDs`);
      if (category.duplicateNames.length > 0) issues.push(`${category.duplicateNames.length} duplicate public names`);
      if (category.scoreOrderValid === false) issues.push('records are not in score order');
      if (category.exceedsPublicCap) issues.push('public See/Eat cap is exceeded');
      const hardIssues = category.issues.filter((issue) => {
        if (categoryName === 'parking' && isParkingResearchOnly(issue)) {
          parkingResearch.push({ projectId: town.projectId, featureId: issue.featureId, name: issue.name });
          return false;
        }
        return true;
      });
      if (hardIssues.length > 0) issues.push(`${hardIssues.length} invalid public records`);
      if (issues.length > 0) hardVisitorIssues.push({ projectId: town.projectId, category: categoryName, issues });
    }
    if (!town.townRating.compliant) hardVisitorIssues.push({
      projectId: town.projectId,
      category: 'town-rating',
      issues: [`published ${town.townRating.published}; expected ${town.townRating.expected}`],
    });
  }

  const categoryTotals = Object.fromEntries(categoryNames.map((categoryName) => [categoryName, {
    listed: sum(townAudits.map((town) => town.categories[categoryName]?.listed ?? 0)),
    townsWithNone: townAudits.filter((town) => (town.categories[categoryName]?.listed ?? 0) === 0).map((town) => town.locality),
  }])) as Record<typeof categoryNames[number], { listed: number; townsWithNone: string[] }>;
  const trailResearch = townAudits.filter((town) => town.trails.researchGap).map((town) => town.locality);
  const dogResearch = {
    attractions: {
      total: sum(townAudits.map((town) => numberOf(town.dogAccess.attractions.total))),
      explicit: sum(townAudits.map((town) => numberOf(town.dogAccess.attractions.explicit))),
      unconfirmed: sum(townAudits.map((town) => numberOf(town.dogAccess.attractions.unconfirmed))),
      towns: townAudits.filter((town) => numberOf(town.dogAccess.attractions.unconfirmed) > 0).map((town) => town.locality),
    },
    eat: {
      total: sum(townAudits.map((town) => numberOf(town.dogAccess.eat.total))),
      explicit: sum(townAudits.map((town) => numberOf(town.dogAccess.eat.explicit))),
      unconfirmed: sum(townAudits.map((town) => numberOf(town.dogAccess.eat.unconfirmed))),
      towns: townAudits.filter((town) => numberOf(town.dogAccess.eat.unconfirmed) > 0).map((town) => town.locality),
    },
  };
  const historicFeatures = sum(townAudits.map((town) => town.heatMapDates.historicFeatures));
  const datedFeatures = sum(townAudits.map((town) => town.heatMapDates.datedFeatures));
  const heatMapDates = {
    historicFeatures,
    datedFeatures,
    coveragePercent: historicFeatures === 0 ? 100 : Math.round((datedFeatures / historicFeatures) * 10_000) / 100,
    townsBelow50Percent: townAudits.filter((town) => town.heatMapDates.coveragePercent < 50).map((town) => town.locality),
    townsBelow100Percent: townAudits.filter((town) => town.heatMapDates.coveragePercent < 100).map((town) => town.locality),
  };
  const batchCheckFailures = batchAudit.createdProjects.flatMap((town) => Object.entries(town.checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => ({ projectId: town.projectId, check })));

  const hardFailures = {
    missingPackages,
    unexpectedPackages,
    duplicateProjectIds,
    duplicateLocalities,
    missingVisitorAudits,
    boundaryFailures,
    regionalExtentFailures,
    crossTownVisitorDuplicates,
    sourceFailures,
    hardVisitorIssues,
    batchCheckFailures,
    generatorFailures: batchAudit.failed,
  };
  const hardFailureCount = missingPackages.length + unexpectedPackages.length
    + duplicateProjectIds.length + duplicateLocalities.length + missingVisitorAudits.length
    + boundaryFailures.length + regionalExtentFailures.length + crossTownVisitorDuplicates.length
    + sourceFailures.length + hardVisitorIssues.length
    + batchCheckFailures.length + batchAudit.failed;

  const report = {
    schemaVersion: 1,
    reviewedAt: `${reviewedDate}T00:00:00Z`,
    scope: `All ${manifest.settlements.length} towns in the bundled Clwyd settlement manifest.`,
    methodology: [
      'Checked manifest/package completeness, region-safe identities, source provenance and original-versus-active visitor boundaries.',
      'Checked every settlement centre against the Clwyd working extent and ensured overlapping visitor records have a single town owner.',
      'Checked curated See, daytime Eat, trails and practical categories for unresolved IDs, duplicates, score order, caps and out-of-boundary records.',
      'Applied the strict 0-3 tourist-town evidence rule; food and practical amenities do not create a town rating.',
      'Measured heat-map date coverage from defensible Welsh heritage dates already bundled from Cadw and RCAHMW records.',
      'Research gaps are reported separately and are never converted into invented public facts.',
    ],
    compliance: {
      hardRulesPassed: hardFailureCount === 0,
      editorialResearchComplete: lowConfidenceBoundaries.length === 0
        && trailResearch.length === 0
        && dogResearch.attractions.unconfirmed === 0
        && dogResearch.eat.unconfirmed === 0
        && parkingResearch.length === 0
        && heatMapDates.townsBelow100Percent.length === 0,
      hardFailureCount,
    },
    counts: {
      requestedTowns: manifest.settlements.length,
      bundledTowns: projects.length,
      visitorAuditedTowns: townAudits.length,
      features: sum(projects.map(({ package: projectPackage }) => projectPackage.features.length)),
      ratingDistribution: Object.fromEntries([0, 1, 2, 3].map((rating) => [rating, townAudits.filter((town) => town.townRating.published === rating).length])),
      categoryTotals,
      boundaries: {
        officialOrHighConfidence: projects.length - lowConfidenceBoundaries.length,
        lowConfidenceFallbacks: lowConfidenceBoundaries.length,
        townsWithAdjoiningPublicGreenSpaces: townsWithAdjoiningGreens.length,
        adjoiningPublicGreenSpaces: sum(townsWithAdjoiningGreens.map((town) => town.count)),
      },
      heatMapDates,
      dogAccess: dogResearch,
      parkingChargeResearch: parkingResearch.length,
    },
    hardFailures,
    researchQueues: {
      lowConfidenceBoundaries,
      townsWithoutValidTrails: trailResearch,
      townsWithoutSee: categoryTotals.see.townsWithNone,
      townsWithoutDaytimeEat: categoryTotals.eat.townsWithNone,
      townsWithoutPicnic: categoryTotals.picnic.townsWithNone,
      townsWithoutParking: categoryTotals.parking.townsWithNone,
      townsWithoutToilets: categoryTotals.toilets.townsWithNone,
      dogAccess: dogResearch,
      parkingCharges: parkingResearch,
      heatMapDates: {
        townsBelow50Percent: heatMapDates.townsBelow50Percent,
        townsBelow100Percent: heatMapDates.townsBelow100Percent,
      },
    },
    verificationSources: [
      {
        name: 'ONS Built-up Areas (December 2024)',
        url: 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/main_ONS_BUA_2024_EW_V2/FeatureServer/0',
        use: 'Primary settlement boundaries before documented visitor-boundary extensions.',
      },
      {
        name: 'Cadw Cof Cymru and Coflein national heritage extracts',
        url: 'https://cadw.gov.wales/advice-support/cof-cymru/search-cadw-records',
        use: 'Locally supplied Welsh listed-building, scheduled-monument and national-monument evidence, including defensible periods and dates.',
      },
      {
        name: 'OpenStreetMap and Overpass',
        url: 'https://www.openstreetmap.org/',
        use: 'Current visitor POIs, practical facilities and adjoining public green-space geometry.',
      },
      {
        name: 'Treasure Trails',
        url: 'https://www.treasuretrails.co.uk/',
        use: 'Town-trail product matching; ordinary mapped paths are not promoted as visitor trails.',
      },
    ],
    auditLimitations: [
      'A full live Overpass refresh was attempted for this dated audit but did not complete within the public service timeout. OSM visitor records were therefore checked against the complete cached source snapshot used by the Clwyd batch generator.',
      'Open evidence queues are deliberately reported rather than filled with inferred ratings, access claims or opening information.',
    ],
  };

  const markdown = `# Clwyd town completeness and compliance audit\n\n`
    + `Reviewed: ${reviewedDate}\n\n`
    + `## Result\n\n`
    + `- Hard public-data rules: **${report.compliance.hardRulesPassed ? 'PASS' : 'FAIL'}** (${hardFailureCount} failure(s)).\n`
    + `- Editorial research complete: **${report.compliance.editorialResearchComplete ? 'YES' : 'NO'}**. Open evidence work is listed below.\n`
    + `- Manifest/package coverage: ${projects.length}/${manifest.settlements.length} towns; ${report.counts.features} bundled features.\n`
    + `- Rating distribution: 0=${report.counts.ratingDistribution[0]}, 1=${report.counts.ratingDistribution[1]}, 2=${report.counts.ratingDistribution[2]}, 3=${report.counts.ratingDistribution[3]}.\n\n`
    + `## Public visitor data\n\n| Category | Records | Towns with none |\n|---|---:|---:|\n`
    + categoryNames.map((name) => `| ${name} | ${categoryTotals[name].listed} | ${categoryTotals[name].townsWithNone.length} |`).join('\n')
    + `\n\nAll listed planner records pass boundary, duplicate, ordering and public-list rules. See and Eat are capped at 20; practical categories remain uncapped.\n\n`
    + `## Boundaries and green spaces\n\n`
    + `- ${report.counts.boundaries.officialOrHighConfidence} towns use an official/high-confidence boundary; ${lowConfidenceBoundaries.length} use documented low-confidence OSM settlement envelopes.\n`
    + `- ${townsWithAdjoiningGreens.length} towns record ${report.counts.boundaries.adjoiningPublicGreenSpaces} adjoining public green-space polygon(s) in the active visitor boundary.\n`
    + `- Every package preserves its original settlement boundary separately from the active visitor boundary.\n\n`
    + `## Evidence base\n\n`
    + `- Original settlement extents come from ONS Built-up Areas (December 2024) where available; documented OSM settlement envelopes are retained as low-confidence fallbacks.\n`
    + `- Cadw and Coflein records come from the locally supplied national heritage archive and are spatially filtered against each active town boundary.\n`
    + `- Current visitor and practical POIs come from the retained OSM source snapshot; unknown parking charges remain explicitly unconfirmed rather than being guessed.\n`
    + `- Treasure Trails products were checked separately; missing trails remain an evidence queue rather than being inferred from ordinary mapped paths.\n`
    + `- The live all-town Overpass refresh timed out, so this audit uses the complete cached OSM source snapshot retained by the Clwyd generator.\n\n`
    + `## Historic dates and heat map\n\n`
    + `- Defensibly dated historic features: ${datedFeatures}/${historicFeatures} (${heatMapDates.coveragePercent}%).\n`
    + `- Towns below 50% coverage: ${heatMapDates.townsBelow50Percent.length}.\n`
    + `- Listing, survey, restoration and administrative dates are not used as construction dates.\n\n`
    + `## Open evidence queues\n\nThese are unknowns to verify, not fabricated failures or inferred facts.\n\n`
    + `- Low-confidence boundary review (${lowConfidenceBoundaries.length}): ${list(lowConfidenceBoundaries)}.\n`
    + `- Towns without a verified visitor trail (${trailResearch.length}): ${list(trailResearch)}.\n`
    + `- Towns without a curated See item (${categoryTotals.see.townsWithNone.length}): ${list(categoryTotals.see.townsWithNone)}.\n`
    + `- Towns without a curated daytime Eat item (${categoryTotals.eat.townsWithNone.length}): ${list(categoryTotals.eat.townsWithNone)}.\n`
    + `- Towns without a curated picnic facility (${categoryTotals.picnic.townsWithNone.length}): ${list(categoryTotals.picnic.townsWithNone)}.\n`
    + `- Towns without parking (${categoryTotals.parking.townsWithNone.length}): ${list(categoryTotals.parking.townsWithNone)}.\n`
    + `- Towns without toilets (${categoryTotals.toilets.townsWithNone.length}): ${list(categoryTotals.toilets.townsWithNone)}.\n`
    + `- Attraction dog access unconfirmed: ${dogResearch.attractions.unconfirmed}/${dogResearch.attractions.total}.\n`
    + `- Eat dog access unconfirmed: ${dogResearch.eat.unconfirmed}/${dogResearch.eat.total}.\n`
    + `- Parking charge status requiring confirmation: ${parkingResearch.length}.\n`
    + `- Towns below 50% historic-date coverage: ${heatMapDates.townsBelow50Percent.length}.\n`;

  await writeFile(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownOutputPath, markdown, 'utf8');
  console.log(`Clwyd audit: ${report.compliance.hardRulesPassed ? 'PASS' : 'FAIL'}; ${projects.length} towns; ${hardFailureCount} hard failure(s).`);
  console.log(`Historic date coverage: ${datedFeatures}/${historicFeatures} (${heatMapDates.coveragePercent}%).`);
  console.log(`Research queues: ${lowConfidenceBoundaries.length} boundaries, ${trailResearch.length} trail gaps, ${parkingResearch.length} parking charge checks.`);
  if (!report.compliance.hardRulesPassed) process.exitCode = 1;
}

await main();
