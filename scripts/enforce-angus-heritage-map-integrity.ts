import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = new Date().toISOString();
const projectsDirectory = resolve('data/projects');
const statutoryTags = new Set([
  'hes-listed-building',
  'hes-scheduled-monument',
  'hes-garden-designed-landscape',
]);
const heritageTags = new Set([...statutoryTags, 'nrhe', 'hes-nrhe']);

function isDated(feature: HeritageFeature): boolean {
  return Boolean(
    feature.documentedDateText?.trim() &&
    feature.dateBasis !== 'unknown' &&
    feature.earliestPossibleYear != null &&
    feature.latestPossibleYear != null,
  );
}

const projects: Array<Record<string, unknown>> = [];
for (const fileName of (await readdir(projectsDirectory)).filter((name) => name.endsWith('.json')).sort()) {
  const filePath = resolve(projectsDirectory, fileName);
  const pkg = JSON.parse(await readFile(filePath, 'utf8')) as ProjectPackage;
  if (pkg.project.region !== 'Angus') continue;

  const heritage = pkg.features.filter((feature) => feature.tags.some((tag) => heritageTags.has(tag)));
  const statutory = heritage.filter((feature) => feature.tags.some((tag) => statutoryTags.has(tag)));
  const nrhe = heritage.filter((feature) => feature.tags.some((tag) => tag === 'nrhe' || tag === 'hes-nrhe'));
  let hiddenUndated = 0;

  for (const feature of heritage) {
    if (isDated(feature)) continue;
    feature.tags = [...new Set([...feature.tags, 'heritage-record-retained', 'map-hidden'])];
    feature.updatedAt = reviewedAt;
    hiddenUndated += 1;
  }

  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((result) => result.severity === 'error');
  if (errors.length) throw new Error(`${fileName}: ${errors.map((result) => result.message).join('; ')}`);
  await writeFile(filePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
  const visibleUndated = visible.filter((feature) => !isDated(feature));
  projects.push({
    file: fileName,
    projectId: pkg.project.id,
    place: pkg.project.locality,
    statutory: statutory.length,
    nrhe: nrhe.length,
    visibleHeritage: visible.length,
    visibleUndated: visibleUndated.length,
    hiddenUndated,
  });
}

const report = {
  reviewedAt,
  county: 'Angus',
  projects: projects.length,
  totals: {
    statutory: projects.reduce((sum, row) => sum + Number(row.statutory), 0),
    nrhe: projects.reduce((sum, row) => sum + Number(row.nrhe), 0),
    visibleHeritage: projects.reduce((sum, row) => sum + Number(row.visibleHeritage), 0),
    visibleUndated: projects.reduce((sum, row) => sum + Number(row.visibleUndated), 0),
    hiddenUndated: projects.reduce((sum, row) => sum + Number(row.hiddenUndated), 0),
  },
  policy: {
    catalogue: 'All local HES statutory and NRHE records remain in their strict project boundary.',
    map: 'Only heritage records with a defensible construction or material-period date are eligible to remain visible.',
    dates: 'Administrative designation, amendment and database dates are not used as historic dates.',
  },
  projectDetails: projects,
};

await writeFile(
  resolve('data/review/angus-heritage-map-integrity-2026-09-01.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report.totals, null, 2));
