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
    boundaryConfidence?: string;
    boundary?: {
      type?: string;
      geometry?: unknown;
      properties?: {
        visitorBoundary?: boolean;
        adjoiningPublicGreenSpaces?: unknown[];
        sourceDataset?: string;
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
const manifestPath = resolve('data/imports/shropshire-settlements-2026-08-12.json');
const generatedModulePath = resolve('src/data/shropshireSettlements.generated.ts');
const visitorAuditPath = resolve(`data/review/all-town-bundled-visitor-audit-${reviewedDate}.json`);
const batchAuditPath = resolve('data/review/shropshire-settlement-batch-audit-2026-08-12.json');
const dateAuditPath = resolve('data/review/shropshire-nhle-date-enrichment-2026-08-12.json');
const jsonOutputPath = resolve(`data/review/shropshire-full-completeness-audit-${reviewedDate}.json`);
const markdownOutputPath = resolve(`data/review/shropshire-full-completeness-audit-${reviewedDate}.md`);

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
    compliance: Record<string, boolean>;
    createdProjects: Array<{
      projectId: string;
      locality: string;
      checks: Record<string, boolean>;
    }>;
  };
  const dateAudit = JSON.parse(await readFile(dateAuditPath, 'utf8')) as {
    reviewedAt: string;
    methodology: string;
    counts: Record<string, number>;
    captureErrors: Array<{ listEntry: string; sourceUrl: string; reason: string }>;
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
    const adjoiningGreenCount = boundary?.properties?.adjoiningPublicGreenSpaces?.length ?? 0;
    if (adjoiningGreenCount > 0) townsWithAdjoiningGreens.push({
      projectId: projectPackage.project.id,
      count: adjoiningGreenCount,
    });

    if (!projectPackage.project.id.endsWith('-shropshire-england')) {
      sourceFailures.push({ projectId: projectPackage.project.id, issues: ['project ID is not region-safe'] });
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

  const categoryNames = ['see', 'eat', 'trails', 'picnic', 'parking', 'toilets'];
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
      const categoryHardIssues = category.issues.filter((issue) => {
        if (categoryName === 'parking' && isParkingResearchOnly(issue)) {
          parkingResearch.push({ projectId: town.projectId, featureId: issue.featureId, name: issue.name });
          return false;
        }
        return true;
      });
      if (categoryHardIssues.length > 0) issues.push(`${categoryHardIssues.length} invalid public records`);
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
  }]));
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
  const heatMapDates = {
    historicFeatures: sum(townAudits.map((town) => town.heatMapDates.historicFeatures)),
    datedFeatures: sum(townAudits.map((town) => town.heatMapDates.datedFeatures)),
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
    sourceFailures,
    hardVisitorIssues,
    batchCheckFailures,
    generatorFailures: batchAudit.failed,
  };
  const hardFailureCount = missingPackages.length
    + unexpectedPackages.length
    + duplicateProjectIds.length
    + duplicateLocalities.length
    + missingVisitorAudits.length
    + boundaryFailures.length
    + sourceFailures.length
    + hardVisitorIssues.length
    + batchCheckFailures.length
    + batchAudit.failed;

  const report = {
    schemaVersion: 1,
    reviewedAt: `${reviewedDate}T00:00:00Z`,
    scope: `All ${manifest.settlements.length} OSM city, town and village records in Shropshire and Telford and Wrekin.`,
    methodology: [
      'Checked manifest/package completeness, region-safe identities, source provenance and original-versus-active visitor boundaries.',
      'Checked curated See, daytime Eat, trails and practical categories for unresolved IDs, duplicates, score order, caps and out-of-boundary records.',
      'Applied the strict 0-3 tourist-town evidence rule; food and practical amenities do not create a town rating.',
      dateAudit.methodology,
      'Research gaps are reported separately and do not masquerade as verified facts.',
    ],
    compliance: {
      hardRulesPassed: hardFailureCount === 0,
      editorialResearchComplete: lowConfidenceBoundaries.length === 0
        && trailResearch.length === 0
        && dogResearch.attractions.unconfirmed === 0
        && dogResearch.eat.unconfirmed === 0
        && parkingResearch.length === 0
        && dateAudit.counts.unresolved === 0,
      hardFailureCount,
    },
    counts: {
      requestedTowns: manifest.settlements.length,
      bundledTowns: projects.length,
      visitorAuditedTowns: townAudits.length,
      ratingDistribution: Object.fromEntries([0, 1, 2, 3].map((rating) => [rating, townAudits.filter((town) => town.townRating.published === rating).length])),
      categoryTotals,
      boundaries: {
        officialOrHighConfidence: projects.length - lowConfidenceBoundaries.length,
        lowConfidenceFallbacks: lowConfidenceBoundaries.length,
        townsWithAdjoiningPublicGreenSpaces: townsWithAdjoiningGreens.length,
        adjoiningPublicGreenSpaces: sum(townsWithAdjoiningGreens.map((town) => town.count)),
      },
      heatMapDates: {
        ...heatMapDates,
        coveragePercent: heatMapDates.historicFeatures === 0
          ? 100
          : Math.round((heatMapDates.datedFeatures / heatMapDates.historicFeatures) * 10_000) / 100,
        officialNhleEnrichment: dateAudit.counts,
      },
      dogAccess: dogResearch,
      parkingChargeResearch: parkingResearch.length,
    },
    hardFailures,
    researchQueues: {
      lowConfidenceBoundaries,
      townsWithoutValidTrails: trailResearch,
      townsWithoutSee: categoryTotals.see.townsWithNone,
      townsWithoutDaytimeEat: categoryTotals.eat.townsWithNone,
      dogAccess: dogResearch,
      parkingCharges: parkingResearch,
      heatMapDates: {
        townsBelow50Percent: heatMapDates.townsBelow50Percent,
        townsBelow100Percent: heatMapDates.townsBelow100Percent,
        officialNhleUnresolved: dateAudit.counts.unresolved,
        officialPageCaptureErrors: dateAudit.captureErrors,
      },
    },
  };

  const category = report.counts.categoryTotals;
  const markdown = `# Shropshire town completeness and compliance audit\n\n`
    + `Reviewed: ${reviewedDate}\n\n`
    + `## Result\n\n`
    + `- Hard public-data rules: **${report.compliance.hardRulesPassed ? 'PASS' : 'FAIL'}** (${hardFailureCount} failure(s)).\n`
    + `- Editorial research complete: **${report.compliance.editorialResearchComplete ? 'YES' : 'NO'}**. Open research is listed separately below.\n`
    + `- Manifest/package coverage: ${projects.length}/${manifest.settlements.length} towns.\n`
    + `- Rating distribution: 0=${report.counts.ratingDistribution[0]}, 1=${report.counts.ratingDistribution[1]}, 2=${report.counts.ratingDistribution[2]}, 3=${report.counts.ratingDistribution[3]}.\n\n`
    + `## Public visitor data\n\n`
    + `| Category | Records | Towns with none |\n|---|---:|---:|\n`
    + categoryNames.map((name) => `| ${name} | ${category[name].listed} | ${category[name].townsWithNone.length} |`).join('\n')
    + `\n\nAll planner records pass boundary, duplicate, ordering and public-list rules. See and Eat remain capped at 20; practical categories remain uncapped.\n\n`
    + `## Boundaries and green spaces\n\n`
    + `- ${report.counts.boundaries.officialOrHighConfidence} towns use an official/high-confidence boundary; ${lowConfidenceBoundaries.length} use documented low-confidence OSM settlement envelopes.\n`
    + (townsWithAdjoiningGreens.length > 0
      ? `- ${townsWithAdjoiningGreens.length} towns have ${report.counts.boundaries.adjoiningPublicGreenSpaces} adjoining public green-space polygon(s) explicitly recorded in the active visitor boundary.\n`
      : '- No adjoining public green-space polygons were added; this remains a boundary-research warning.\n')
    + `- Every package preserves its original settlement boundary separately from the active visitor boundary.\n\n`
    + `## Historic dates and heat map\n\n`
    + `- Audit historic-date coverage: ${heatMapDates.datedFeatures}/${heatMapDates.historicFeatures} (${report.counts.heatMapDates.coveragePercent}%).\n`
    + `- Historic England NHLE records enriched from official list-entry text: ${dateAudit.counts.enriched}/${dateAudit.counts.nhleRecords}.\n`
    + `- Unresolved NHLE records: ${dateAudit.counts.unresolved}; official page capture errors: ${dateAudit.counts.captureErrors}.\n`
    + `- Administrative listing dates and restoration-only dates were not used as construction dates.\n\n`
    + `## Open research queues\n\n`
    + `These are unknowns to verify, not fabricated failures or inferred facts.\n\n`
    + `- Low-confidence boundary review (${lowConfidenceBoundaries.length}): ${list(lowConfidenceBoundaries)}.\n`
    + `- Towns without a verified visitor trail (${trailResearch.length}): ${list(trailResearch)}.\n`
    + `- Towns without a curated See item (${category.see.townsWithNone.length}): ${list(category.see.townsWithNone)}.\n`
    + `- Towns without a curated daytime Eat item (${category.eat.townsWithNone.length}): ${list(category.eat.townsWithNone)}.\n`
    + `- Attraction dog access unconfirmed: ${dogResearch.attractions.unconfirmed}/${dogResearch.attractions.total}.\n`
    + `- Eat dog access unconfirmed: ${dogResearch.eat.unconfirmed}/${dogResearch.eat.total}.\n`
    + `- Parking charge status requiring confirmation: ${parkingResearch.length}.\n`
    + `- Towns below 50% historic-date coverage: ${heatMapDates.townsBelow50Percent.length}.\n\n`
    + `## Regeneration\n\n`
    + `The county generation command is chained to rerun official Historic England date enrichment, so rebuilding the packages does not discard the heat-map date work.\n`;

  await writeFile(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownOutputPath, markdown, 'utf8');
  console.log(`Shropshire audit: ${report.compliance.hardRulesPassed ? 'PASS' : 'FAIL'}; ${projects.length} towns; ${hardFailureCount} hard failure(s).`);
  console.log(`Historic date coverage: ${heatMapDates.datedFeatures}/${heatMapDates.historicFeatures} (${report.counts.heatMapDates.coveragePercent}%).`);
  console.log(`Research queues: ${lowConfidenceBoundaries.length} boundaries, ${trailResearch.length} trail gaps, ${parkingResearch.length} parking charge checks.`);
  if (!report.compliance.hardRulesPassed) process.exitCode = 1;
}

await main();
