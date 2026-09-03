import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import type { PlannerCurationLibrary } from '../src/domain/plannerCuration';
import {
  townRatingEvidenceForProject,
  townRatingFromEvidence,
  townRatingLabels,
  townRatingPolicyVersion,
  townRatingSummary,
} from '../src/domain/townRating';

interface PlannerCurationFile {
  schemaVersion: number;
  projects: PlannerCurationLibrary;
}

interface RatingAuditRow {
  projectId: string;
  locality: string;
  file: string;
  oldRating: TouristAppealRating | null;
  oldLabel: string | null;
  newRating: TouristAppealRating;
  newLabel: string;
  attractionEvidence: Array<{ featureId: string; name: string; score: number }>;
  qualifyingTrailEvidence: Array<{
    featureId: string;
    name: string;
    score: number;
    sourceUrl?: string;
  }>;
  ratingChanged: boolean;
  fileChanged: boolean;
}

const reviewedAt = '2026-08-09T00:00:00Z';
const projectsDirectory = resolve('data/projects');
const plannerPath = resolve('data/visitor-planner-curation.json');
const reportPath = resolve('data/review/town-rating-policy-audit-2026-08-09.json');

const plannerFile = JSON.parse(await readFile(plannerPath, 'utf8')) as PlannerCurationFile;
const previousRows = new Map<string, RatingAuditRow>();
try {
  const previousReport = JSON.parse(await readFile(reportPath, 'utf8')) as {
    policyVersion?: string;
    projects?: RatingAuditRow[];
  };
  if (previousReport.policyVersion === townRatingPolicyVersion) {
    for (const row of previousReport.projects ?? []) previousRows.set(row.file, row);
  }
} catch {
  // The first policy run has no preceding audit to preserve.
}
const projectFiles = (await readdir(projectsDirectory))
  .filter((file) => file.endsWith('.json') && !file.endsWith('.template.json'))
  .sort((left, right) => left.localeCompare(right, 'en-GB'));
const rows: RatingAuditRow[] = [];

for (const file of projectFiles) {
  const path = resolve(projectsDirectory, file);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  if (!pkg.project?.id || !pkg.project.locality || !Array.isArray(pkg.features)) continue;

  const curation = plannerFile.projects[pkg.project.id] ?? {};
  const evidence = townRatingEvidenceForProject(pkg, curation);
  const newRating = townRatingFromEvidence(
    evidence.attractions.map((item) => item.score),
    evidence.trails.map((item) => item.score),
  );
  const previousRow = previousRows.get(file);
  const oldRating = previousRow?.oldRating ?? pkg.project.touristAppeal?.rating ?? null;
  const oldLabel = previousRow?.oldLabel ?? pkg.project.touristAppeal?.label ?? null;
  const newLabel = townRatingLabels[newRating];
  const ratingChanged = oldRating !== newRating;
  const summary =
    ratingChanged || !pkg.project.touristAppeal?.summary
      ? townRatingSummary(pkg.project.locality, newRating, evidence)
      : pkg.project.touristAppeal.summary;
  const nextAppeal = { rating: newRating, label: newLabel, summary };
  const fileChanged = JSON.stringify(pkg.project.touristAppeal) !== JSON.stringify(nextAppeal);

  pkg.project.touristAppeal = nextAppeal;
  if (fileChanged) await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  rows.push({
    projectId: pkg.project.id,
    locality: pkg.project.locality,
    file: basename(path),
    oldRating,
    oldLabel,
    newRating,
    newLabel,
    attractionEvidence: evidence.attractions.map(({ featureId, name, score }) => ({
      featureId,
      name,
      score,
    })),
    qualifyingTrailEvidence: evidence.trails,
    ratingChanged,
    fileChanged,
  });
}

const distribution = rows.reduce<Record<string, number>>((counts, row) => {
  counts[row.newRating] = (counts[row.newRating] ?? 0) + 1;
  return counts;
}, {});
const changed = rows.filter((row) => row.ratingChanged);
const report = {
  schemaVersion: 1,
  policyVersion: townRatingPolicyVersion,
  reviewedAt,
  policy: {
    zero: 'Minor heritage records, ordinary amenities or one modest site cluster.',
    one: 'At least one attraction scoring 75+, or two genuinely independent attractions scoring 60+.',
    two: 'An 85+ attraction, at least two 70+ attractions and at least three meaningful 60+ attraction or 75+ genuine-trail experiences.',
    three: 'A 90+ attraction, at least three 80+ attractions and at least five 70+ attraction or 80+ genuine-trail experiences.',
    exclusions: 'Food, parking, toilets, picnic provision and other practical amenities never create a town rating.',
    trailRule: 'Only explicitly scored curated trails with a responsible non-OSM external route source count towards depth. Trails cannot create rating 1.',
  },
  totals: {
    projectsReviewed: rows.length,
    ratingsChanged: changed.length,
    filesChanged: rows.filter((row) => row.fileChanged).length,
    distribution,
  },
  changedProjects: changed,
  projects: rows,
};

await mkdir(resolve('data/review'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(
  JSON.stringify(
    {
      reportPath,
      projectsReviewed: rows.length,
      ratingsChanged: changed.length,
      filesChanged: rows.filter((row) => row.fileChanged).length,
      distribution,
    },
    null,
    2,
  ),
);
