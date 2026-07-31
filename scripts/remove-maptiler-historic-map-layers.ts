import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

for (const filename of ['alloa.json', 'alva.json', 'culross.json', 'kincardine.json']) {
  const path = resolve('data/projects', filename);
  const projectPackage = JSON.parse(await readFile(path, 'utf8')) as {
    historicMaps: Array<{ tileUrl?: string }>;
  };
  projectPackage.historicMaps = projectPackage.historicMaps.filter(
    (layer) => !layer.tileUrl?.includes('api.maptiler.com'),
  );
  await writeFile(path, `${JSON.stringify(projectPackage, null, 2)}\n`);
  console.log(`Removed quota-dependent historic layers from ${filename}.`);
}
