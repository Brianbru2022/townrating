import type { VisitorNeed } from './visitorExperience';

export type PlannerCurationState = Partial<Record<VisitorNeed, string[]>>;
export type PlannerCurationLibrary = Record<string, PlannerCurationState>;
export interface PlannerCurationDraft {
  schemaVersion: 1;
  projectId: string;
  projectName?: string;
  updatedAt: string;
  curation: PlannerCurationState;
}

export const curatablePlannerNeeds: Array<{ id: VisitorNeed; label: string }> = [
  { id: 'picnic', label: 'Picnic' },
  { id: 'parking', label: 'Parking' },
  { id: 'toilets', label: 'Toilets' },
];

export function plannerCurationStorageKey(projectId: string): string {
  return `town-guide-scotland:planner-curation:${projectId}`;
}

export function curatedFeatureIds(
  state: PlannerCurationState,
  need: VisitorNeed,
): string[] {
  return state[need] ?? [];
}

export function hasCuratedNeed(state: PlannerCurationState, need: VisitorNeed): boolean {
  return Object.prototype.hasOwnProperty.call(state, need);
}

export function isCuratedForNeed(
  state: PlannerCurationState,
  need: VisitorNeed,
  featureId: string,
): boolean {
  return curatedFeatureIds(state, need).includes(featureId);
}

export function addCuratedPlannerPlace(
  state: PlannerCurationState,
  need: VisitorNeed,
  featureId: string,
): PlannerCurationState {
  const existing = curatedFeatureIds(state, need);
  if (existing.includes(featureId)) return state;
  return { ...state, [need]: [...existing, featureId] };
}

export function removeCuratedPlannerPlace(
  state: PlannerCurationState,
  need: VisitorNeed,
  featureId: string,
): PlannerCurationState {
  const nextIds = curatedFeatureIds(state, need).filter((id) => id !== featureId);
  const next = { ...state };
  if (nextIds.length) next[need] = nextIds;
  else delete next[need];
  return next;
}

export function cleanPlannerCurationState(state: PlannerCurationState): PlannerCurationState {
  const cleaned: PlannerCurationState = {};
  for (const [need, featureIds] of Object.entries(state) as Array<[VisitorNeed, string[]]>) {
    const uniqueIds = [...new Set(featureIds)].filter(Boolean);
    if (uniqueIds.length) cleaned[need] = uniqueIds;
  }
  return cleaned;
}

export function mergePlannerCurationState(
  bundled: PlannerCurationState,
  local: PlannerCurationState,
): PlannerCurationState {
  const merged: PlannerCurationState = {};
  const needs = new Set<VisitorNeed>([
    ...(Object.keys(bundled) as VisitorNeed[]),
    ...(Object.keys(local) as VisitorNeed[]),
  ]);
  for (const need of needs) {
    const featureIds = [...new Set([...(bundled[need] ?? []), ...(local[need] ?? [])])].filter(
      Boolean,
    );
    if (featureIds.length) merged[need] = featureIds;
  }
  return merged;
}
