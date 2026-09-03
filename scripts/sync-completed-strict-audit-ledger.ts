import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const correctionPath = resolve('data/review/strict-settlement-score-correction-2026-08-30.json');
const correction: any = JSON.parse(await readFile(correctionPath, 'utf8'));

const completedProjectIds = new Set(
  correction.results.slice(0, 33).map((value: any) => value.projectId),
);
const projectFiles = (await readdir(resolve('data/projects'))).filter((value) => value.endsWith('.json'));
const completedPackages: any[] = [];
for (const filename of projectFiles) {
  const pkg: any = JSON.parse(await readFile(resolve('data/projects', filename), 'utf8'));
  if (completedProjectIds.has(pkg.project?.id)) completedPackages.push(pkg);
}
if (completedPackages.length !== completedProjectIds.size) {
  const found = new Set(completedPackages.map((pkg) => pkg.project.id));
  const missing = [...completedProjectIds].filter((id) => !found.has(id));
  throw new Error(`Missing completed project package(s): ${missing.join(', ')}`);
}

for (const pkg of completedPackages) {
  const row = correction.results.find((value: any) => value.projectId === pkg.project.id);
  if (!row) throw new Error(`Missing strict-audit row for ${pkg.project.id}`);
  const score = pkg.project.touristAppeal.score;
  row.correctedScore = score;
  row.changed = row.previousScore !== score;
  row.publishOnTownMap = score >= 60;
  row.rationale = pkg.project.touristAppeal.summary;
  row.sourceUrls = pkg.project.touristAppeal.sourceUrls;
}

correction.changedScores = correction.results.filter((value: any) => value.changed).length;
correction.mappedAfterCorrection = correction.results
  .filter((value: any) => value.correctedScore >= 60)
  .map((value: any) => ({ projectId: value.projectId, name: value.name, score: value.correctedScore }));

await writeFile(correctionPath, `${JSON.stringify(correction, null, 2)}\n`);
console.log(`Synchronised ${completedPackages.length} completed audit rows.`);
