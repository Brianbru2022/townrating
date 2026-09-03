import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProjectPackage } from '../domain/models';
import { certifyFullTownAudit, type FullTownAuditReport } from '../domain/townAuditCertification';
import { homeTownOverviews } from '../map/homeOverview';
import { topFoodAndDrink, visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { stAndrewsCoastPackages } from './stAndrewsCoast';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const auditFiles = [
  'woodside-largo', 'new-gilston', 'wester-newburn', 'lundin-links',
  'lower-largo', 'drumeldrie', 'leven-fife',
] as const;

describe('Woodside-to-Leven sequential audit certification', () => {
  it.each(auditFiles)('%s passes the fail-closed full-audit gate', (file) => {
    const pkg = loadPackage(file);
    const report = JSON.parse(readFileSync(resolve('data/review', `${file}-full-visitor-audit-2026-09-02.json`), 'utf8')) as FullTownAuditReport;
    expect(certifyFullTownAudit(pkg, report, publishedPlannerCurationForProject(pkg.project.id)).issues, pkg.project.name).toEqual([]);
  });

  it.each(auditFiles)('%s dates every visible statutory pin without changing map labels', (file) => {
    const pkg = loadPackage(file);
    const statutory = pkg.features.filter((feature) => feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape'].includes(tag)));
    const visible = statutory.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(visible.every((feature) => Boolean(feature.documentedDateText) && feature.dateBasis !== 'unknown'), pkg.project.name).toBe(true);
    expect(visible.every((feature) => !feature.name.includes(feature.documentedDateText ?? '\u0000')), pkg.project.name).toBe(true);
  });

  it('publishes only the three independently scoring destinations', () => {
    const packages = auditFiles.map(loadPackage);
    expect(homeTownOverviews(packages).map((town) => town.name)).toEqual(['Leven', 'Lower Largo', 'Lundin Links']);
  });

  it('publishes the reconciled Lundin Links, Lower Largo and Leven categories', () => {
    const expectations: Record<string, [number, number, number, number, number, number]> = {
      'lundin-links': [3, 2, 3, 0, 0, 0],
      'lower-largo': [3, 1, 4, 1, 2, 1],
      'leven-fife': [5, 5, 4, 1, 2, 3],
    };
    for (const [file, [see, eat, trails, picnic, parking, toilets]] of Object.entries(expectations)) {
      const pkg = loadPackage(file);
      const curation = publishedPlannerCurationForProject(pkg.project.id);
      expect(topVisitPlaces(pkg, 30), `${pkg.project.name}: See`).toHaveLength(see);
      expect(topFoodAndDrink(pkg, 30), `${pkg.project.name}: Eat`).toHaveLength(eat);
      for (const [kind, count] of Object.entries({ trails, picnic, parking, toilets })) {
        expect(visitorNeedPlaces(pkg, kind as 'trails', 30, { curatedFeatureIds: curation[kind as keyof typeof curation] }), `${pkg.project.name}: ${kind}`).toHaveLength(count);
      }
    }
  });

  it.each(auditFiles)('%s has dog-access evidence for every published See and Eat entry', (file) => {
    const pkg = loadPackage(file);
    const curation = publishedPlannerCurationForProject(pkg.project.id);
    for (const highlight of pkg.project.visitorHighlights ?? []) expect(publishedDogAccessForPlace(pkg.project.id, 'attraction', highlight.featureId), highlight.name).toBeDefined();
    for (const featureId of curation.eat ?? []) expect(publishedDogAccessForPlace(pkg.project.id, 'eat', featureId), featureId).toBeDefined();
  });

  it('records a complete local-first HES reconciliation', () => {
    const report = JSON.parse(readFileSync(resolve('data/review/woodside-leven-hes-integrity-2026-09-02.json'), 'utf8')) as {
      projects: number; statutoryDesignationsAssigned: number; visibleHesPins: number;
      missingStatutoryDesignations: number; undatedVisiblePins: number; sourceMode: string;
    };
    expect(report).toMatchObject({ projects: 7, statutoryDesignationsAssigned: 117, visibleHesPins: 136, missingStatutoryDesignations: 0, undatedVisiblePins: 0, sourceMode: 'local-first-with-explicit-network-fallback' });
  });

  it('keeps every final score away from the provisional exact-58 trigger', () => {
    expect(auditFiles.map(loadPackage).map((pkg) => pkg.project.touristAppeal?.score)).not.toContain(58);
  });
});

function loadPackage(file: string): ProjectPackage {
  const id = file === 'leven-fife' ? 'leven-fife-scotland' : `${file}-scotland`;
  const pkg = stAndrewsCoastPackages.find((candidate) => candidate.project.id === id);
  if (!pkg) throw new Error(`Missing package ${file}`);
  return pkg;
}
