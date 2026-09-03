import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProjectPackage } from '../domain/models';
import { certifyFullTownAudit, type FullTownAuditReport } from '../domain/townAuditCertification';
import { topFoodAndDrink, visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { stAndrewsCoastPackages } from './stAndrewsCoast';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const auditFiles = [
  'glenduckie',
  'luthrie',
  'moonzie',
  'kilmaron-castle',
  'lindifferon',
  'fernie-castle',
  'letham-fife',
  'bow-of-fife',
  'cupar-muir',
  'cupar',
  'craigrothie',
  'pitlessie',
  'springfield-fife',
  'ladybank',
] as const;
const projectIds: Record<(typeof auditFiles)[number], string> = {
  glenduckie: 'glenduckie-scotland',
  luthrie: 'luthrie-scotland',
  moonzie: 'moonzie-scotland',
  'kilmaron-castle': 'kilmaron-castle-scotland',
  lindifferon: 'lindifferon-scotland',
  'fernie-castle': 'fernie-castle-scotland',
  'letham-fife': 'letham-fife-scotland',
  'bow-of-fife': 'bow-of-fife-scotland',
  'cupar-muir': 'cupar-muir-scotland',
  cupar: 'cupar-scotland',
  craigrothie: 'craigrothie-scotland',
  pitlessie: 'pitlessie-scotland',
  'springfield-fife': 'springfield-fife-scotland',
  ladybank: 'ladybank-scotland',
};

describe('Glenduckie-to-Ladybank sequential audit certification', () => {
  it.each(auditFiles)('%s passes the fail-closed full-audit gate', (file) => {
    const pkg = loadPackage(file);
    const report = JSON.parse(
      readFileSync(resolve('data/review', `${file}-full-visitor-audit-2026-09-02.json`), 'utf8'),
    ) as FullTownAuditReport;
    expect(
      certifyFullTownAudit(pkg, report, publishedPlannerCurationForProject(pkg.project.id)).issues,
      pkg.project.name,
    ).toEqual([]);
  });

  it.each(auditFiles)(
    '%s keeps every visible HES/NRHE pin dated without changing its map name',
    (file) => {
      const pkg = loadPackage(file);
      const heritage = pkg.features.filter((feature) =>
        feature.tags.some((tag) =>
          ['hes-listed-building', 'hes-scheduled-monument', 'hes-nrhe', 'nrhe'].includes(tag),
        ),
      );
      const visible = heritage.filter(
        (feature) =>
          feature.evidenceScope !== 'related_context' &&
          !feature.tags.includes('town-selection-heritage-buffer') &&
          !feature.tags.includes('map-hidden'),
      );
      expect(
        visible.every(
          (feature) =>
            Boolean(feature.documentedDateText) &&
            feature.earliestPossibleYear != null &&
            feature.latestPossibleYear != null &&
            feature.dateBasis !== 'unknown',
        ),
        pkg.project.name,
      ).toBe(true);
      expect(
        visible.every(
          (feature) =>
            !/\s[—–-]\s(?:c\.?\s*)?(?:\d{3,4}|\d{1,2}(?:st|nd|rd|th) century)$/i.test(feature.name),
        ),
        pkg.project.name,
      ).toBe(true);
    },
  );

  it('publishes only Cupar and Ladybank as 60+ town markers', () => {
    const published = auditFiles
      .map(loadPackage)
      .filter((pkg) => (pkg.project.touristAppeal?.score ?? 0) >= 60)
      .map((pkg) => pkg.project.name);
    expect(published).toEqual(['Cupar', 'Ladybank']);
  });

  it('publishes the reconciled Cupar and Ladybank categories', () => {
    const expectations: Record<string, [number, number, number, number, number, number]> = {
      cupar: [1, 6, 6, 1, 3, 2],
      ladybank: [1, 2, 1, 1, 2, 0],
    };
    for (const [file, [see, eat, trails, picnic, parking, toilets]] of Object.entries(
      expectations,
    )) {
      const pkg = loadPackage(file as keyof typeof projectIds);
      const curation = publishedPlannerCurationForProject(pkg.project.id);
      expect(topVisitPlaces(pkg, 30), `${pkg.project.name}: See`).toHaveLength(see);
      expect(topFoodAndDrink(pkg, 30), `${pkg.project.name}: Eat`).toHaveLength(eat);
      for (const [kind, count] of Object.entries({ trails, picnic, parking, toilets }))
        expect(
          visitorNeedPlaces(pkg, kind as 'trails', 30, {
            curatedFeatureIds: curation[kind as keyof typeof curation],
          }),
          `${pkg.project.name}: ${kind}`,
        ).toHaveLength(count);
    }
  });

  it.each(auditFiles)('%s has a dog-policy record for every published See and Eat card', (file) => {
    const pkg = loadPackage(file);
    const curation = publishedPlannerCurationForProject(pkg.project.id);
    for (const highlight of pkg.project.visitorHighlights ?? [])
      expect(
        publishedDogAccessForPlace(pkg.project.id, 'attraction', highlight.featureId),
        highlight.name,
      ).toBeDefined();
    for (const featureId of curation.eat ?? [])
      expect(publishedDogAccessForPlace(pkg.project.id, 'eat', featureId), featureId).toBeDefined();
  });

  it('keeps all scores away from the exact-58 second-pass trigger', () => {
    expect(
      auditFiles.map(loadPackage).map((pkg) => pkg.project.touristAppeal?.score),
    ).not.toContain(58);
  });
});

function loadPackage(file: keyof typeof projectIds): ProjectPackage {
  const pkg = stAndrewsCoastPackages.find((candidate) => candidate.project.id === projectIds[file]);
  if (!pkg) throw new Error(`Missing package ${file}`);
  return pkg;
}
