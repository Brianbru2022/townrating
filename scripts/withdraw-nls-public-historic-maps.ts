import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage } from '../src/domain/models';

const projects = [
  'data/projects/alloa.json',
  'data/projects/alva.json',
  'data/projects/culross.json',
  'data/projects/kincardine.json',
  'data/projects/tillicoultry.json',
];

for (const filename of projects) {
  const path = resolve(filename);
  const projectPackage = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  projectPackage.historicMaps = projectPackage.historicMaps.filter(
    (map) => map.id !== 'nls-os-1920s-public-api',
  );
  await writeFile(path, `${JSON.stringify(projectPackage, null, 2)}\n`, 'utf8');
  console.log(`Withdrew watermarked NLS fallback from ${projectPackage.project.id}.`);
}
