import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  PlannerCurationDraft,
  PlannerCurationLibrary,
  PlannerCurationState,
} from '../src/domain/plannerCuration';
import { cleanPlannerCurationState } from '../src/domain/plannerCuration';

interface PlannerCurationFile {
  schemaVersion: 1;
  description: string;
  projects: PlannerCurationLibrary;
}

const draftPath = process.argv[2];
if (!draftPath) {
  throw new Error(
    'Usage: tsx scripts/apply-visitor-planner-curation.ts <downloaded-planner-curation.json>',
  );
}

const libraryPath = resolve('data/visitor-planner-curation.json');

function isPlannerCurationDraft(value: unknown): value is PlannerCurationDraft {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PlannerCurationDraft).schemaVersion === 1 &&
    typeof (value as PlannerCurationDraft).projectId === 'string' &&
    typeof (value as PlannerCurationDraft).curation === 'object'
  );
}

function cleanedStateFromDraft(draft: PlannerCurationDraft): PlannerCurationState {
  return cleanPlannerCurationState(draft.curation);
}

const draft = JSON.parse(await readFile(resolve(draftPath), 'utf8')) as unknown;
if (!isPlannerCurationDraft(draft)) {
  throw new Error('Planner curation draft must include schemaVersion, projectId and curation.');
}

const library = JSON.parse(await readFile(libraryPath, 'utf8')) as PlannerCurationFile;
if (library.schemaVersion !== 1 || typeof library.projects !== 'object') {
  throw new Error(`${libraryPath} is not a recognised visitor planner curation library.`);
}

const cleaned = cleanedStateFromDraft(draft);
if (Object.keys(cleaned).length) {
  library.projects[draft.projectId] = cleaned;
} else {
  delete library.projects[draft.projectId];
}

await writeFile(libraryPath, `${JSON.stringify(library, null, 2)}\n`);
console.log(`Applied visitor planner curation for ${draft.projectId} to ${libraryPath}`);
