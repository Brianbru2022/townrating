import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const towns = [
  { id: 'alloa-scotland', path: 'data/projects/alloa.json', parish: 'Alloa' },
  { id: 'alva-scotland', path: 'data/projects/alva.json' },
  { id: 'culross-scotland', path: 'data/projects/culross.json' },
  { id: 'kincardine-on-forth-scotland', path: 'data/projects/kincardine.json' },
  { id: 'tillicoultry-scotland', path: 'data/projects/tillicoultry.json' },
  { id: 'quarriers-village-scotland', path: 'data/projects/quarriers-village.json' },
  { id: 'biggar-scotland', path: 'data/projects/biggar.json' },
  { id: 'killin-scotland', path: 'data/projects/killin.json' },
];
const requested = process.argv[2];
const selected = requested ? towns.filter((town) => town.id === requested) : towns;
if (!selected.length) throw new Error(`Unknown town '${requested}'.`);

function run(script: string, args: string[] = []): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn('npx', ['tsx', script, ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolveRun()
        : reject(new Error(`${script} exited with ${code ?? 'an unknown error'}.`)),
    );
  });
}

await run('scripts/sync-reference-data.ts');
for (const town of selected) {
  if (town.parish)
    await run('scripts/import-nrs-civil-parish-boundary.ts', [town.path, town.parish]);
  await run('scripts/import-hes-listed-buildings.ts', [town.path]);
  await run('scripts/import-hes-project-polygons.ts', [town.path]);
  await run('scripts/import-hes-nrhe.ts', [town.path]);
  await run('scripts/import-hes-contextual-layers.ts', [town.path]);
  await run('scripts/import-osm-current-parks.ts', [town.path]);
  await run('scripts/import-osm-community-places.ts', [town.path]);
  const curationPath = `data/curation/${town.id}-current-place-curation.json`;
  if (existsSync(curationPath))
    await run('scripts/apply-current-place-curation.ts', [town.path, curationPath]);
  await run('scripts/export-current-place-curation-queue.ts', [town.path]);
}
await run(
  'scripts/export-listed-buildings.ts',
  selected.map((town) => town.path),
);
console.log(`Completed town population for ${selected.map((town) => town.id).join(', ')}.`);
