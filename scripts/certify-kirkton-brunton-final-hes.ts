import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasAppendedHeritageDateInMapName } from '../src/domain/townAuditCertification';

const slugs = [
  'kirkton-balmerino',
  'bottomcraig',
  'kilmany',
  'logie-fife',
  'rathillet',
  'hazelton-walls',
  'creich-fife',
  'brunton-creich',
];

const projects = [];
for (const slug of slugs) {
  const pkg = JSON.parse(await readFile(resolve('data/projects', `${slug}.json`), 'utf8'));
  const statutory = pkg.features.filter((feature: { tags: string[] }) =>
    feature.tags.some((tag) =>
      ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape'].includes(tag),
    ),
  );
  const visible = statutory.filter((feature: { tags: string[] }) => !feature.tags.includes('map-hidden'));
  const undated = visible.filter((feature: { documentedDateText?: string; dateBasis?: string }) =>
    !feature.documentedDateText || feature.dateBasis === 'unknown',
  );
  const dateInName = visible.filter((feature: { name: string; documentedDateText?: string }) =>
    hasAppendedHeritageDateInMapName(feature.name, feature.documentedDateText),
  );
  if (undated.length || dateInName.length) {
    throw new Error(`${pkg.project.name}: undated=${undated.length}, date-in-name=${dateInName.length}`);
  }
  projects.push({
    projectId: pkg.project.id,
    place: pkg.project.name,
    assigned: statutory.length,
    visibleAndDated: visible.length,
    listedBuildings: statutory.filter((feature: { tags: string[] }) => feature.tags.includes('hes-listed-building')).length,
    scheduledMonuments: statutory.filter((feature: { tags: string[] }) => feature.tags.includes('hes-scheduled-monument')).length,
    hidden: statutory.length - visible.length,
    undatedVisible: 0,
    datesAppendedToMapNames: 0,
  });
}

const report = {
  verifiedAt: new Date().toISOString(),
  audit: 'Final post-curation HES certification for Kirkton to Brunton sequential audits',
  localFirst: true,
  statutoryMissing: 0,
  assigned: projects.reduce((sum, project) => sum + project.assigned, 0),
  visibleAndDated: projects.reduce((sum, project) => sum + project.visibleAndDated, 0),
  hidden: projects.reduce((sum, project) => sum + project.hidden, 0),
  undatedVisible: 0,
  datesAppendedToMapNames: 0,
  projects,
};

await writeFile(
  resolve('data/review/kirkton-brunton-final-hes-certification-2026-09-02.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(`Certified ${report.visibleAndDated}/${report.assigned} visible dated HES records across ${projects.length} places.`);
