import plannerCurationLibrary from '../../data/visitor-planner-curation.json';
import eastNeukPlannerCurationLibrary from '../../data/east-neuk-visitor-planner-curation.json';
import cairnOMountPlannerCurationLibrary from '../../data/cairn-o-mount-visitor-planner-curation.json';
import stonehavenCoastPlannerCurationLibrary from '../../data/stonehaven-coast-visitor-planner-curation.json';
import aberdeenNorthPlannerCurationLibrary from '../../data/aberdeen-north-visitor-planner-curation.json';
import type { PlannerCurationLibrary, PlannerCurationState } from '../domain/plannerCuration';

interface PlannerCurationJson {
  schemaVersion: number;
  projects: PlannerCurationLibrary;
}

const parsedLibrary = plannerCurationLibrary as PlannerCurationJson;

const parsedEastNeukLibrary = eastNeukPlannerCurationLibrary as PlannerCurationJson;
const parsedCairnOMountLibrary = cairnOMountPlannerCurationLibrary as PlannerCurationJson;
const parsedStonehavenCoastLibrary = stonehavenCoastPlannerCurationLibrary as PlannerCurationJson;
const parsedAberdeenNorthLibrary = aberdeenNorthPlannerCurationLibrary as PlannerCurationJson;

export const publishedPlannerCuration: PlannerCurationLibrary = {
  ...parsedLibrary.projects,
  ...parsedEastNeukLibrary.projects,
  ...parsedCairnOMountLibrary.projects,
  ...parsedStonehavenCoastLibrary.projects,
  ...parsedAberdeenNorthLibrary.projects,
};

export function publishedPlannerCurationForProject(projectId: string): PlannerCurationState {
  return publishedPlannerCuration[projectId] ?? {};
}
