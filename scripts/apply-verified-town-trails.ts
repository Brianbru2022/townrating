import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';

interface VerifiedTrail {
  projectId: string;
  projectFile: string;
  featureId: string;
  name: string;
  provider: string;
  url: string;
  score: number;
  boundaryStatus: 'confirmed_in_active_boundary';
  coordinates: [number, number];
  shortDescription: string;
  trailType: string;
  distance?: string;
  timeToSpend?: string;
  accessibility?: string;
  entranceFee?: string;
  sourceRecordId: string;
  licence: string;
  reliability: 'official_non_statutory' | 'secondary';
  reviewNotes: string;
}

interface TrailRegistry {
  schemaVersion: 1;
  trails: VerifiedTrail[];
}

interface PlannerCuration {
  schemaVersion: 1;
  projects: Record<string, { trails?: string[]; [category: string]: string[] | undefined }>;
}

const registryPath = resolve('data/trail-source-registry.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const reviewedAt = '2026-08-12T00:00:00.000Z';

function notesFor(trail: VerifiedTrail): string {
  const details = [
    'route=foot',
    `name=${trail.name}`,
    `trail_type=${trail.trailType}`,
    `visit_score=${trail.score}`,
    trail.distance ? `distance=${trail.distance}` : undefined,
    trail.timeToSpend ? `time_to_spend=${trail.timeToSpend}` : undefined,
    trail.entranceFee ? `entrance_fee=${trail.entranceFee}` : undefined,
    trail.accessibility ? `accessibility=${trail.accessibility}` : undefined,
    `description=${trail.shortDescription}`,
    `website=${trail.url}`,
  ].filter(Boolean);
  return `Current-place curation: ${details.join('; ')}.`;
}

function featureFor(trail: VerifiedTrail, project: ProjectPackage['project']): HeritageFeature {
  return {
    id: trail.featureId,
    projectId: trail.projectId,
    name: trail.name,
    alternativeNames: [],
    countryCode: project.countryCode,
    region: project.region,
    locality: project.locality,
    featureType: 'walking_route',
    significance: trail.score >= 80 ? 'recognised' : 'local',
    geometry: { type: 'Point', coordinates: trail.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: trail.shortDescription,
    sourceRecords: [{
      sourceName: trail.name,
      sourceOrganisation: trail.provider,
      sourceRecordId: trail.sourceRecordId,
      sourceUrl: trail.url,
      accessedAt: reviewedAt,
      licence: trail.licence,
      notes: notesFor(trail),
      reliability: trail.reliability,
    }],
    licence: trail.licence,
    tags: [
      'current-context',
      'curated-trail-place',
      'service-context-walk',
      'service-context-visitor',
      'visitor-context-trail',
    ],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: trail.reviewNotes,
    evidenceScope: 'related_context',
  };
}

const registry = JSON.parse(await readFile(registryPath, 'utf8')) as TrailRegistry;
const curation = JSON.parse(await readFile(curationPath, 'utf8')) as PlannerCuration;
const trailsByFile = new Map<string, VerifiedTrail[]>();
for (const trail of registry.trails) {
  const existing = trailsByFile.get(trail.projectFile) ?? [];
  existing.push(trail);
  trailsByFile.set(trail.projectFile, existing);
}

for (const [projectFile, trails] of trailsByFile) {
  const projectPath = resolve('data/projects', projectFile);
  const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
  for (const trail of trails) {
    if (pkg.project.id !== trail.projectId) {
      throw new Error(`${trail.featureId} targets ${trail.projectId}, but ${projectFile} contains ${pkg.project.id}.`);
    }
    const boundary = pkg.project.boundary as Feature<Polygon | MultiPolygon>;
    if (!booleanPointInPolygon(point(trail.coordinates), boundary)) {
      throw new Error(`${trail.featureId} representative point is outside ${trail.projectId}'s active boundary.`);
    }
    pkg.features = pkg.features.filter((feature) => feature.id !== trail.featureId);
    pkg.features.push(featureFor(trail, pkg.project));

    const projectCuration = curation.projects[trail.projectId] ?? {};
    projectCuration.trails = [...new Set([...(projectCuration.trails ?? []), trail.featureId])];
    curation.projects[trail.projectId] = projectCuration;
  }
  await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

await writeFile(curationPath, `${JSON.stringify(curation, null, 2)}\n`, 'utf8');
console.log(`Applied ${registry.trails.length} verified trails across ${trailsByFile.size} town packages.`);
