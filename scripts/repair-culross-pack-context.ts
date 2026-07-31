import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/culross.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;

function feature(id: string) {
  const found = pkg.features.find((item) => item.id === id);
  if (!found) throw new Error(`Missing ${id}.`);
  return found;
}
function removeText(value: string | undefined, removals: string[]): string | undefined {
  if (!value) return value;
  return removals.reduce((result, removal) => result.replace(`\n\n${removal}`, ''), value);
}

const study = feature('hes-listed-building:LB24045');
study.fullDescription = removeText(study.fullDescription, [
  'Digitise separate harbour-edge and reclamation polygons from georeferenced maps; the modern Sandhaven must not be treated as the original shoreline.',
  'Import current street centre lines and property or building geometries, then compare them with georeferenced maps. The listed Causeways and Steps record should remain a separate statutory feature.',
]);
study.sourceRecords = study.sourceRecords.filter(
  (source) =>
    ![
      'Royal Burgh of Culross',
      'Historic Environment Scotland designation LB24061',
      'Culross Conservation Area Appraisal and Management Plan',
    ].includes(source.sourceName),
);

const palace = feature('hes-scheduled-monument:SM5288');
palace.fullDescription = removeText(palace.fullDescription, [
  'Use scheduled-monument and NRHE records for individual shafts, pits, saltpans, industrial features and offshore remains. Do not represent this as one undifferentiated heat point.',
]);
palace.sourceRecords = palace.sourceRecords.filter(
  (source) => source.sourceName !== 'The Moat, coal shaft, 650m SE of Cuvey Hall (SM13797)',
);

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log('Removed thematic context accidentally attached to individual statutory features.');
