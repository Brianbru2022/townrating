import type { ProjectPackage, TownProject } from './models';

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Public catalogue order: country, region, then the town/locality name. */
export function comparePublishedProjects(a: TownProject, b: TownProject): number {
  return (
    collator.compare(a.country, b.country) ||
    collator.compare(a.region ?? '', b.region ?? '') ||
    collator.compare(a.locality, b.locality) ||
    collator.compare(a.name, b.name)
  );
}

export function sortPublishedProjects<T extends TownProject>(projects: readonly T[]): T[] {
  return [...projects].sort(comparePublishedProjects);
}

export function sortPublishedPackages(packages: readonly ProjectPackage[]): ProjectPackage[] {
  return [...packages].sort((a, b) => comparePublishedProjects(a.project, b.project));
}
