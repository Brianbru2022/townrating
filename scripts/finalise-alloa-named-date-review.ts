import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/alloa.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();
const researchedTag = 'alloa-date-researched-no-date';
const councilLicence =
  'Open Government Licence v3.0 for Council-held public-sector information; acknowledge Clackmannanshire Council and do not reuse third-party material.';

function findFeature(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error('Expected Alloa feature ' + id + ' was not found.');
  return feature;
}

function appendReviewNote(feature: HeritageFeature, note: string): void {
  feature.reviewed = true;
  feature.updatedAt = accessedAt;
  feature.tags = [
    ...new Set(
      [...feature.tags, researchedTag].filter((tag) => tag !== 'curation-priority-named-site'),
    ),
  ];
  if (!feature.reviewNotes?.includes(note))
    feature.reviewNotes = [feature.reviewNotes, note].filter(Boolean).join(' ');
}

const brickworks = findFeature('nrhe:141370');
brickworks.documentedDateText =
  'Alloa brick and tile works operating at significant scale by 1815 (industry/site evidence; mapped works construction date not established)';
delete brickworks.earliestPossibleYear;
brickworks.latestPossibleYear = 1815;
brickworks.datePrecision = 'documented industry expansion year';
brickworks.dateBasis = 'present_by';
brickworks.dateConfidence = 'medium';
brickworks.sourceRecords = [
  ...brickworks.sourceRecords.filter(
    (source) =>
      !(
        source.sourceOrganisation === 'Clackmannanshire Council' &&
        source.sourceUrl ===
          'https://www.clackmannanshire.scot/index.php/history/new-statistical-account-alloa-parish'
      ),
  ),
  {
    sourceName: 'New Statistical Account — Alloa Parish',
    sourceOrganisation: 'Clackmannanshire Council',
    sourceUrl:
      'https://www.clackmannanshire.scot/index.php/history/new-statistical-account-alloa-parish',
    accessedAt,
    licence: councilLicence,
    reliability: 'archival',
    notes:
      'States that brick and tile manufacture had long occurred at Alloa and that the works were carried on to a significant extent from 1815. It does not date the construction of the mapped works.',
  } satisfies SourceRecord,
];
brickworks.tags = [
  ...new Set(
    [...brickworks.tags, 'alloa-reviewed-named-date'].filter(
      (tag) => tag !== 'curation-priority-named-site',
    ),
  ),
];
brickworks.reviewed = true;
brickworks.updatedAt = accessedAt;
const brickworksNote =
  'Final named-site review completed. The 1815 evidence dates the Alloa brick-and-tile industry/site operating at scale, not construction of a particular surviving works building.';
if (!brickworks.reviewNotes?.includes(brickworksNote))
  brickworks.reviewNotes = [brickworks.reviewNotes, brickworksNote].filter(Boolean).join(' ');

const inchIsland = findFeature('nrhe:47226');
inchIsland.documentedDateText =
  'Farmstead and pier noted on the first-edition OS map (map year not recorded in the NRHE extract)';
inchIsland.dateBasis = 'first_mapped';
inchIsland.dateConfidence = 'medium';
inchIsland.datePrecision = 'first-edition map cited without a survey/publication year';
inchIsland.tags = [...new Set([...inchIsland.tags, 'inventory-presence-date'])];
appendReviewNote(
  inchIsland,
  'Final named-site review completed. The official NRHE record confirms first-edition map presence but supplies no sheet year, so this remains excluded by the established-date filter until a dated map source is reviewed.',
);

const noDirectDateIds = [
  'nrhe:79075',
  'nrhe:120695',
  'nrhe:133349',
  'nrhe:141977',
  'nrhe:140175',
  'nrhe:141923',
  'nrhe:165147',
  'nrhe:176967',
  'nrhe:194455',
  'nrhe:220544',
  'nrhe:291462',
  'nrhe:315748',
  'nrhe:320521',
];
for (const id of noDirectDateIds) {
  appendReviewNote(
    findFeature(id),
    'Final named-site review completed. The available NRHE and local-history sources did not establish a date for this specific mapped feature; it remains openly undated rather than receiving a site, business or nearby-asset date.',
  );
}

for (const id of ['nrhe:133349', 'nrhe:315748', 'nrhe:320521']) {
  const feature = findFeature(id);
  feature.tags = [...new Set([...feature.tags, 'map-hidden', 'catalogue-general-view'])];
  const note =
    'This record is a generic event, road or place reference rather than a discrete dated historic asset. It remains in Data Review and exports but is not a public map pin.';
  if (!feature.reviewNotes?.includes(note))
    feature.reviewNotes = [feature.reviewNotes, note].filter(Boolean).join(' ');
}

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error('Refusing to write ' + errors.length + ' validation error(s).');
await writeFile(projectPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(
  'Finalised named-date review for 15 Alloa records: 1 dated site record, 1 dated-map reference pending map year and 13 records retained as reviewed undated evidence.',
);
