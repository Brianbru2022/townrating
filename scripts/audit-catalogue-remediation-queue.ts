import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publishedProjectPackages } from '../src/data/publishedProjects';
import { hasAppendedHeritageDateInMapName } from '../src/domain/townAuditCertification';

const reviewedAt = new Date().toISOString();
const reviewDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const reviewDirectory = resolve('data/review');
const reportPath = resolve(`data/review/catalogue-remediation-inventory-${reviewDate}.json`);

type JsonRecord = Record<string, any>;

function countPublished(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value.length;
  return undefined;
}

function statutoryFeature(feature: { tags: string[] }): boolean {
  return feature.tags.some((tag) => [
    'hes-listed-building',
    'hes-scheduled-monument',
    'scheduled_monument',
    'hes-garden-designed-landscape',
    'hes-inventory-garden',
    'hes-battlefield',
  ].includes(tag));
}

function completeHistoricDate(feature: {
  documentedDateText?: string;
  earliestPossibleYear?: number;
  latestPossibleYear?: number;
  dateBasis: string;
}): boolean {
  return Boolean(
    feature.documentedDateText?.trim()
    && feature.earliestPossibleYear != null
    && feature.latestPossibleYear != null
    && feature.dateBasis !== 'unknown',
  );
}

function reportPlace(report: JsonRecord): string | undefined {
  return report.place ?? report.projectName ?? report.locality ?? report.town;
}

function reportScore(report: JsonRecord): number | undefined {
  const value = report.townScore ?? report.score?.value ?? report.score;
  return typeof value === 'number' ? value : undefined;
}

function reportReviewedAt(report: JsonRecord): string {
  return String(report.reviewedAt ?? report.generatedAt ?? '');
}

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-GB')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

function reportFullGate(report: JsonRecord, score: number | undefined) {
  const categoryNames = ['see', 'eat', 'trails', 'picnic', 'parking', 'toilets'];
  const categoriesComplete = categoryNames.every((category) => {
    const value = report.categories?.[category];
    return value?.audited === true && countPublished(value.published) != null;
  });
  const providerNames = Object.keys(report.categories?.trails?.providerChecks ?? {})
    .join(' ')
    .toLocaleLowerCase('en-GB');
  const trailProvidersComplete = ['treasure', 'curious', 'mystery', 'goquest']
    .every((provider) => providerNames.includes(provider))
    && /(?:official|walk|path|visit|discover|community|fife|council|trust|forestry|national.?park)/i.test(providerNames);
  const heritage = report.hes ?? report.heritage ?? {};
  const heritageComplete = Number(heritage.visibleUndated ?? heritage.visibleUndatedPins ?? 0) === 0
    && Number(heritage.missing ?? heritage.missingStatutoryDesignations ?? 0) === 0;
  const currentWebResearch = report.research?.currentWebResearch === true;
  const strictBoundaryChecked = report.research?.strictBoundaryChecked === true
    || Boolean(report.boundaryRule)
    || Boolean(report.boundary?.rule);
  const publicationCountsReconciled = report.certification?.publicationCountsReconciled === true
    || Boolean(report.publication);
  const liveBrowserVerified = Boolean(report.certification?.liveBrowserVerifiedAt);
  const exact58SecondPass = score !== 58 || (
    report.scoreReanalysis?.required === true
    && report.scoreReanalysis?.completed === true
    && report.scoreReanalysis?.resultScore === 58
    && Boolean(report.scoreReanalysis?.rationale?.trim())
  );
  return {
    categoriesComplete,
    trailProvidersComplete,
    heritageComplete,
    currentWebResearch,
    strictBoundaryChecked,
    publicationCountsReconciled,
    liveBrowserVerified,
    exact58SecondPass,
    complete: categoriesComplete
      && trailProvidersComplete
      && heritageComplete
      && currentWebResearch
      && strictBoundaryChecked
      && publicationCountsReconciled
      && liveBrowserVerified
      && exact58SecondPass,
  };
}

const reviewFiles = (await readdir(reviewDirectory))
  .filter((file) => /(?:full-visitor-audit|visitor-audit)/i.test(file) && file.endsWith('.json'));
const auditReports: Array<{ file: string; report: JsonRecord }> = [];
for (const file of reviewFiles) {
  try {
    const report = JSON.parse(await readFile(resolve(reviewDirectory, file), 'utf8')) as JsonRecord;
    if (!reportPlace(report)) continue;
    auditReports.push({ file, report });
  } catch {
    // Non-town and legacy report shapes remain outside this deterministic queue.
  }
}

const hesReportFiles = (await readdir(reviewDirectory))
  .filter((file) => /^scotland-wide-hes-integrity-audit-\d{4}-\d{2}-\d{2}\.json$/.test(file))
  .sort()
  .reverse();
const latestHesReportFile = hesReportFiles[0];
const latestHesReport = latestHesReportFile
  ? JSON.parse(await readFile(resolve(reviewDirectory, latestHesReportFile), 'utf8')) as JsonRecord
  : undefined;
const hesProjectReports = new Map<string, JsonRecord>(
  (latestHesReport?.projectsDetail ?? []).map((item: JsonRecord) => [item.projectId, item]),
);

const duplicatePlaceNames = new Set(
  publishedProjectPackages
    .map((pkg) => pkg.project.name.toLocaleLowerCase('en-GB'))
    .filter((name, index, names) => names.indexOf(name) !== index),
);

function reportMatchQuality(pkg: (typeof publishedProjectPackages)[number], candidate: { file: string; report: JsonRecord }): number {
  const reportId = String(candidate.report.projectId ?? candidate.report.project?.id ?? '');
  if (reportId === pkg.project.id) return 4;
  const projectStem = pkg.project.id.replace(/-scotland$/, '');
  const fileSlug = slug(candidate.file.replace(/\.json$/i, ''));
  if (pkg.project.countryCode === 'GB-SCT' && /-england(?:-|$)/.test(fileSlug)) return 0;
  if (pkg.project.countryCode === 'GB-ENG' && /-(?:scotland|wales)(?:-|$)/.test(fileSlug)) return 0;
  if (pkg.project.countryCode === 'GB-WLS' && /-(?:scotland|england)(?:-|$)/.test(fileSlug)) return 0;
  if (fileSlug.startsWith(`${projectStem}-`) || fileSlug === projectStem) return 3;
  const place = reportPlace(candidate.report)?.toLocaleLowerCase('en-GB');
  if (place !== pkg.project.name.toLocaleLowerCase('en-GB')) return 0;
  const reportRegion = String(candidate.report.region ?? candidate.report.project?.region ?? '').toLocaleLowerCase('en-GB');
  if (reportRegion && reportRegion === pkg.project.region.toLocaleLowerCase('en-GB')) return 2;
  return duplicatePlaceNames.has(place) ? 0 : 1;
}

const towns = publishedProjectPackages.map((pkg) => {
  const score = pkg.project.touristAppeal?.score;
  const methodVersion = pkg.project.touristAppeal?.methodVersion;
  const reports = auditReports
    .map((candidate) => ({ ...candidate, matchQuality: reportMatchQuality(pkg, candidate) }))
    .filter(({ matchQuality }) => matchQuality > 0)
    .filter(({ report }) => reportScore(report) == null || reportScore(report) === score)
    .sort((left, right) => {
      const leftComplete = reportFullGate(left.report, score).complete ? 1 : 0;
      const rightComplete = reportFullGate(right.report, score).complete ? 1 : 0;
      return rightComplete - leftComplete
        || right.matchQuality - left.matchQuality
        || right.file.localeCompare(left.file)
        || reportReviewedAt(right.report).localeCompare(reportReviewedAt(left.report));
    });
  const latestTownReport = reports[0];
  const fullGate = latestTownReport ? reportFullGate(latestTownReport.report, score) : undefined;
  const statutory = pkg.features.filter(statutoryFeature);
  const visibleStatutory = statutory.filter((feature) => !feature.tags.includes('map-hidden'));
  const visibleUndated = visibleStatutory.filter((feature) => !completeHistoricDate(feature));
  const hiddenUndated = statutory.filter(
    (feature) => feature.tags.includes('map-hidden') && !completeHistoricDate(feature),
  );
  const datesInMapNames = visibleStatutory.filter((feature) =>
    hasAppendedHeritageDateInMapName(feature.name, feature.documentedDateText),
  );
  const currentHes = hesProjectReports.get(pkg.project.id);
  const mapPublished = Number(score) >= 60;
  const fullMethod = /(?:full|destination-audit)/i.test(methodVersion ?? '');
  const exact58 = score === 58;
  const issues: string[] = [];
  if (exact58 && fullGate?.exact58SecondPass !== true) issues.push('exact 58 lacks a documented completed second pass');
  if (!fullMethod) issues.push('score method is not a completed full-audit method');
  if (!latestTownReport) issues.push('no matching visitor-audit report found');
  else if (fullGate?.complete !== true) issues.push('latest visitor-audit report does not pass every full-audit evidence gate');
  if (visibleUndated.length) issues.push(`${visibleUndated.length} visible HES pins lack a complete material date`);
  if (datesInMapNames.length) issues.push(`${datesInMapNames.length} HES dates are appended to map names`);
  if (Number(currentHes?.missingDesignations ?? 0) > 0) issues.push(`${currentHes.missingDesignations.length} HES designations are missing`);
  if (hiddenUndated.length) issues.push(`${hiddenUndated.length} HES records remain hidden pending a defensible material date`);
  return {
    projectId: pkg.project.id,
    name: pkg.project.name,
    region: pkg.project.region,
    score,
    mapPublished,
    methodVersion: methodVersion ?? null,
    latestAuditReport: latestTownReport?.file ?? null,
    fullGate: fullGate ?? null,
    heritage: {
      expectedListedBuildings: currentHes?.expectedHesDesignations ?? null,
      representedListedBuildings: currentHes?.representedHesDesignations ?? null,
      statutoryRecords: statutory.length,
      visibleDatedPins: visibleStatutory.length - visibleUndated.length,
      visibleUndatedPins: visibleUndated.map((feature) => feature.id),
      hiddenUndatedRecords: hiddenUndated.map((feature) => feature.id),
      datesAppendedToMapNames: datesInMapNames.map((feature) => feature.id),
      missingListedBuildings: currentHes?.missingDesignations ?? [],
    },
    issues,
  };
});

const exact58 = towns.filter((town) => town.score === 58);
const incomplete58 = exact58.filter((town) => town.fullGate?.exact58SecondPass !== true || town.fullGate?.complete !== true);
const nonFullMethod = towns.filter((town) => !/(?:full|destination-audit)/i.test(town.methodVersion ?? ''));
const mapHeritageFailures = towns.filter((town) => town.mapPublished && (
  town.heritage.visibleUndatedPins.length
  || town.heritage.datesAppendedToMapNames.length
  || town.heritage.missingListedBuildings.length
));
const mapHiddenUnresolved = towns.filter((town) =>
  town.mapPublished && town.heritage.hiddenUndatedRecords.length,
);
const mapAuditFailures = towns.filter((town) => town.mapPublished && town.fullGate?.complete !== true);

const report = {
  reviewedAt,
  scope: 'Every currently published project package in the application database.',
  policy: {
    exact58: 'Every exact score of 58 requires a documented complete second pass and must never be a cap or placeholder.',
    audit: 'A full audit requires all six visitor categories, named clue-trail provider checks, current web research, a strict boundary, reconciled publication counts, HES completeness and live verification.',
    heritage: 'Every visible HES pin must have a defensible material date. Administrative designation dates are not construction dates. Unresolved records remain retained but map-hidden.',
  },
  hesReconciliationReport: latestHesReportFile ?? null,
  summary: {
    publishedProjects: towns.length,
    mapPublishedProjects: towns.filter((town) => town.mapPublished).length,
    exact58Scores: exact58.length,
    exact58NeedingAudit: incomplete58.length,
    nonFullAuditMethods: nonFullMethod.length,
    mapTownsFailingFullAuditEvidence: mapAuditFailures.length,
    mapTownsWithVisibleHeritageFailures: mapHeritageFailures.length,
    mapTownsWithHiddenUnresolvedHesRecords: mapHiddenUnresolved.length,
  },
  queues: {
    exact58: exact58.map((town) => ({
      projectId: town.projectId,
      name: town.name,
      methodVersion: town.methodVersion,
      report: town.latestAuditReport,
      secondPassComplete: town.fullGate?.exact58SecondPass === true,
      fullGateComplete: town.fullGate?.complete === true,
    })),
    mapHeritageFailures: mapHeritageFailures.map((town) => ({
      projectId: town.projectId,
      name: town.name,
      heritage: town.heritage,
    })),
    mapHiddenUnresolved: mapHiddenUnresolved.map((town) => ({
      projectId: town.projectId,
      name: town.name,
      hiddenUndatedRecords: town.heritage.hiddenUndatedRecords,
    })),
    mapAuditFailures: mapAuditFailures.map((town) => ({
      projectId: town.projectId,
      name: town.name,
      score: town.score,
      methodVersion: town.methodVersion,
      report: town.latestAuditReport,
      fullGate: town.fullGate,
    })),
    nonFullMethod: nonFullMethod.map((town) => ({
      projectId: town.projectId,
      name: town.name,
      score: town.score,
      mapPublished: town.mapPublished,
      methodVersion: town.methodVersion,
    })),
  },
  towns,
};

await mkdir(reviewDirectory, { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ reportPath, ...report.summary }, null, 2));
