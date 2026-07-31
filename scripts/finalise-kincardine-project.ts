import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/kincardine.json');
const projectPackage = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;

const bridge = projectPackage.features.find((feature) => feature.id === 'curated:hes-lb50078');
if (!bridge) throw new Error('Kincardine Bridge record was not found after pack import.');
// The supplied representative point is beyond the official Tulliallan parish boundary. It remains
// visible as evidence for the Forth crossing, but must not distort parish totals or heat scoring.
bridge.evidenceScope = 'related_context';
bridge.reviewed = true;
bridge.reviewNotes = [
  bridge.reviewNotes,
  'Representative location is beyond the authoritative Tulliallan parish boundary; retained as related context for the Kincardine Forth crossing and excluded from parish totals and heat scoring.',
]
  .filter(Boolean)
  .join(' ');

projectPackage.validation = validateFeatures(projectPackage.project, projectPackage.features);
const errors = projectPackage.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(projectPackage, null, 2)}\n`, 'utf8');
console.log(
  `Finalised Kincardine package: ${projectPackage.features.length} records, ${projectPackage.validation.length} review warning(s).`,
);
