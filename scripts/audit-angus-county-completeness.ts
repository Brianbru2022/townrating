import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publishedPlannerCurationForProject } from '../src/data/visitorPlannerCuration';
import { cairnOMountPackages } from '../src/data/cairnOMount';
import {
  hasAppendedHeritageDateInMapName,
  publishedAuditCounts,
  type FullTownAuditReport,
} from '../src/domain/townAuditCertification';

const reviewedAt = '2026-09-01';
const reportDirectory = resolve('data/review');
const reportFiles = (await readdir(reportDirectory)).filter((name) => /full-visitor-audit-.*\.json$/i.test(name));

async function latestAuditReport(id: string): Promise<{ file: string; report: FullTownAuditReport & Record<string, any> } | undefined> {
  const slug = id.replace(/-scotland$/, '').replace(/-angus$/, '');
  const aliases = new Set([
    slug,
    slug.replace(/-angus$/, ''),
    slug.replace(/-arbroath$/, ''),
    slug.replace(/-monifieth$/, ''),
    slug.replace(/-glenesk$/, ''),
    slug.replace(/-glamis$/, ''),
    slug.replace(/-memus$/, ''),
  ]);
  const candidates = reportFiles
    .filter((file) => [...aliases].some((alias) => file.startsWith(`${alias}-full-visitor-audit-`)))
    .sort((left, right) => {
      const countyPriority = Number(right.includes('-z-county.json')) - Number(left.includes('-z-county.json'));
      return countyPriority || right.localeCompare(left);
    });
  for (const file of candidates) {
    try {
      return { file, report: JSON.parse(await readFile(resolve(reportDirectory, file), 'utf8')) };
    } catch {
      // A malformed historic report must not prevent the county baseline.
    }
  }
  return undefined;
}

const rows: Array<Record<string, unknown>> = [];
for (const pkg of cairnOMountPackages
  .filter((candidate) => candidate.project.region === 'Angus')
  .sort((left, right) => left.project.locality.localeCompare(right.project.locality))) {
  const statutory = pkg.features.filter((feature) => feature.tags.some((tag) =>
    ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape'].includes(tag),
  ));
  const nrhe = pkg.features.filter((feature) => feature.tags.some((tag) => ['hes-nrhe', 'nrhe'].includes(tag)));
  const visibleStatutory = statutory.filter((feature) => !feature.tags.includes('map-hidden'));
  const visibleUndated = visibleStatutory.filter((feature) =>
    !feature.documentedDateText?.trim() || feature.dateBasis === 'unknown' ||
    feature.earliestPossibleYear == null || feature.latestPossibleYear == null,
  );
  const dateInName = visibleStatutory.filter((feature) =>
    hasAppendedHeritageDateInMapName(feature.name, feature.documentedDateText),
  );
  const counts = publishedAuditCounts(pkg, publishedPlannerCurationForProject(pkg.project.id));
  const latest = await latestAuditReport(pkg.project.id);
  const report = latest?.report;
  const providerChecks = report?.categories?.trails?.providerChecks ?? report?.trailProviderSearches;
  const providerText = JSON.stringify(providerChecks ?? '').toLocaleLowerCase('en-GB');
  const namedProvidersComplete = ['treasure', 'curious', 'mystery', 'go quest'].every((name) => providerText.includes(name));
  const reportResearchComplete = report?.research?.currentWebResearch === true &&
    report?.research?.strictBoundaryChecked === true &&
    Boolean(report?.research?.sourceChecks?.length);
  const exact58Complete = pkg.project.touristAppeal?.score !== 58 || (
    report?.scoreReanalysis?.required === true &&
    report?.scoreReanalysis?.completed === true &&
    report?.scoreReanalysis?.resultScore === 58
  );
  const issues = [
    ...(latest ? [] : ['missing full-audit report']),
    ...(reportResearchComplete ? [] : ['current web research not certified']),
    ...(namedProvidersComplete ? [] : ['named trail-provider checks incomplete']),
    ...(visibleUndated.length ? [`${visibleUndated.length} visible statutory heritage pins undated`] : []),
    ...(dateInName.length ? [`${dateInName.length} heritage map names contain dates`] : []),
    ...(exact58Complete ? [] : ['exact-58 second pass incomplete']),
    ...(report?.certification?.liveBrowserVerifiedAt ? [] : ['live browser verification not certified']),
  ];
  rows.push({
    id: pkg.project.id,
    place: pkg.project.locality,
    featureCount: pkg.features.length,
    score: pkg.project.touristAppeal?.score,
    mapPublished: Number(pkg.project.touristAppeal?.score) >= 60,
    counts,
    heritage: {
      statutory: statutory.length,
      nrhe: nrhe.length,
      visibleStatutory: visibleStatutory.length,
      visibleUndated: visibleUndated.length,
      dateInName: dateInName.length,
    },
    latestAuditReport: latest?.file ?? null,
    issues,
  });
}

const output = {
  reviewedAt,
  county: 'Angus',
  placeCount: rows.length,
  summary: {
    certifiedWithoutIssues: rows.filter((row: any) => row.issues.length === 0).length,
    missingAuditReport: rows.filter((row: any) => row.issues.includes('missing full-audit report')).length,
    webResearchNotCertified: rows.filter((row: any) => row.issues.includes('current web research not certified')).length,
    namedTrailChecksIncomplete: rows.filter((row: any) => row.issues.includes('named trail-provider checks incomplete')).length,
    placesWithVisibleUndatedStatutoryPins: rows.filter((row: any) => row.heritage.visibleUndated > 0).length,
    exact58SecondPassIncomplete: rows.filter((row: any) => row.issues.includes('exact-58 second pass incomplete')).length,
    zeroFeatureProjects: rows.filter((row: any) => row.featureCount === 0).length,
    liveBrowserNotCertified: rows.filter((row: any) => row.issues.includes('live browser verification not certified')).length,
  },
  places: rows,
};

await writeFile(resolve(`data/review/angus-county-baseline-${reviewedAt}.json`), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output.summary, null, 2));
