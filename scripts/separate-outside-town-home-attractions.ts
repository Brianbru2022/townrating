import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { ProjectPackage } from '../src/domain/models';

const projectsDirectory = resolve('data/projects');
const reviewedAt = '2026-08-08T00:00:00Z';
const files = (await readdir(projectsDirectory)).filter((file) => file.endsWith('.json'));
const changes: Array<{ projectId: string; removedFromTown: string[] }> = [];

for (const file of files) {
  const path = resolve(projectsDirectory, file);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  const highlights = pkg.project.visitorHighlights ?? [];
  const boundary = pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;
  const featureById = new Map(pkg.features.map((feature) => [feature.id, feature]));
  const outsideNames: string[] = [];
  const retained = highlights.filter((highlight) => {
    const feature = featureById.get(highlight.featureId);
    if (!feature?.geometry || feature.geometry.type !== 'Point') return true;
    const inside = booleanPointInPolygon(point(feature.geometry.coordinates), boundary);
    if (inside) return true;
    outsideNames.push(highlight.name);
    feature.tags = [...new Set([...feature.tags, 'home-standalone-place'])];
    feature.homeMapEligible = highlight.homeMapEligible ?? true;
    feature.updatedAt = reviewedAt;
    feature.reviewNotes = [
      feature.reviewNotes,
      'Removed from the town planner because the mapped point is outside the active visitor boundary; retained as a standalone Home discovery place.',
    ]
      .filter(Boolean)
      .join(' ');
    return false;
  });
  if (!outsideNames.length) continue;
  pkg.project.visitorHighlights = retained
    .sort(
      (left, right) =>
        (right.visitorScore ?? 0) - (left.visitorScore ?? 0) || left.name.localeCompare(right.name),
    )
    .map((highlight, index) => ({ ...highlight, rank: index + 1 }));
  pkg.project.researchNotes = [
    pkg.project.researchNotes,
    `Boundary sweep ${reviewedAt.slice(0, 10)}: ${outsideNames.join(', ')} moved from the town planner to standalone Home discovery because nearby does not count as in-town.`,
  ]
    .filter(Boolean)
    .join(' ');
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`);
  changes.push({ projectId: pkg.project.id, removedFromTown: outsideNames });
}

console.log(JSON.stringify(changes, null, 2));
