import { describe, expect, it } from 'vitest';
import hesCertification from '../../data/review/east-neuk-radernie-drumeldrie-reaudit-hes-date-certification-2026-09-03.json';
import linkCheck from '../../data/review/east-neuk-radernie-drumeldrie-reaudit-published-link-check-2026-09-03.json';
import sequentialAudit from '../../data/review/east-neuk-radernie-drumeldrie-reaudit-sequential-audit-summary-2026-09-03.json';
import { topVisitPlaces } from '../domain/visiting';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { homeTownOverviews } from '../map/homeOverview';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';
import { publishedProjectPackages } from './publishedProjects';

const expected = [
  ['radernie-scotland', 28, 0, 0, 1, 0, 0, 0, false],
  ['lathones-scotland', 42, 0, 0, 0, 0, 0, 0, false],
  ['largoward-scotland', 46, 0, 0, 1, 0, 0, 0, false],
  ['colinsburgh-scotland', 64, 2, 0, 1, 0, 0, 0, true],
  ['balchrystie-scotland', 22, 0, 0, 0, 0, 0, 0, false],
  ['earlsferry-scotland', 78, 3, 0, 3, 1, 1, 0, true],
  ['elie-scotland', 86, 2, 3, 3, 1, 3, 3, true],
  ['drumeldrie-scotland', 46, 1, 0, 0, 0, 0, 0, false],
] as const;

function project(id: string) {
  const pkg = publishedProjectPackages.find((candidate) => candidate.project.id === id);
  if (!pkg) throw new Error(`Missing published project ${id}`);
  return pkg;
}

describe('Radernie-to-Drumeldrie sequential full re-audit', () => {
  it('keeps every place in the Fife selector and maps only genuine 60+ settlements', () => {
    for (const [id, score, see, eat, trails, picnic, parking, toilets, mapped] of expected) {
      const pkg = project(id);
      const curation = publishedPlannerCurationForProject(id);
      expect(pkg.project.region).toBe('Fife');
      expect(pkg.project.touristAppeal?.score, `${id} score`).toBe(score);
      expect(topVisitPlaces(pkg, 30), `${id} See`).toHaveLength(see);
      expect(visitorNeedPlaces(pkg, 'eat', 30, { curatedFeatureIds: curation.eat }), `${id} Eat`).toHaveLength(eat);
      expect(visitorNeedPlaces(pkg, 'trails', 30, { curatedFeatureIds: curation.trails }), `${id} Trails`).toHaveLength(trails);
      expect(visitorNeedPlaces(pkg, 'picnic', 30, { curatedFeatureIds: curation.picnic }), `${id} Picnic`).toHaveLength(picnic);
      expect(visitorNeedPlaces(pkg, 'parking', 30, { curatedFeatureIds: curation.parking }), `${id} Parking`).toHaveLength(parking);
      expect(visitorNeedPlaces(pkg, 'toilets', 30, { curatedFeatureIds: curation.toilets }), `${id} Toilets`).toHaveLength(toilets);
      expect(homeTownOverviews([pkg]).length > 0, `${id} Home-map state`).toBe(mapped);
    }
    expect(sequentialAudit.completedSequentially).toBe(true);
    expect(sequentialAudit.audits.map((audit) => audit.projectId)).toEqual(expected.map(([id]) => id));
    expect(publishedProjectPackages.filter((pkg) => pkg.project.id === 'colinsburgh-scotland')).toHaveLength(1);
  });

  it('retains every local HES/NRHE record while exposing only materially dated, clean map pins', () => {
    expect(hesCertification.projects).toHaveLength(8);
    expect(hesCertification.totals).toMatchObject({
      records: 677,
      removedOutOfScope: 0,
      visiblePins: 339,
      visiblePinsWithoutDates: 0,
      visiblePinNamesContainingDate: 0,
    });
    for (const [id] of expected) {
      const heritage = project(id).features.filter((feature) =>
        feature.tags.some((tag) => (tag.startsWith('hes-') && tag !== 'hes-date-reviewed') || tag === 'nrhe'),
      );
      const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
      expect(visible.every((feature) => Boolean(feature.documentedDateText) && feature.dateBasis !== 'unknown'), id).toBe(true);
      expect(heritage.every((feature) => !/^date:\s*\d{4}-\d{2}\b/i.test(feature.documentedDateText ?? '')), id).toBe(true);
      expect(visible.every((feature) => !feature.name.includes(feature.documentedDateText ?? '\u0000')), id).toBe(true);
    }
  });

  it('records dog-policy results for every published See, Eat and Trail', () => {
    for (const [id] of expected) {
      const pkg = project(id);
      const curation = publishedPlannerCurationForProject(id);
      for (const featureId of curation.eat ?? []) {
        expect(publishedDogAccessForPlace(id, 'eat', featureId), `${id} Eat ${featureId}`).toBeDefined();
      }
      for (const featureId of curation.trails ?? []) {
        expect(publishedDogAccessForPlace(id, 'attraction', featureId), `${id} Trail ${featureId}`).toBeDefined();
      }
      for (const highlight of pkg.project.visitorHighlights ?? []) {
        expect(publishedDogAccessForPlace(id, 'attraction', highlight.featureId), `${id} See ${highlight.featureId}`).toBeDefined();
      }
    }
  });

  it('contains no exact-58 placeholder and no broken published or trail links', () => {
    expect(expected.some(([, score]) => score === 58)).toBe(false);
    expect(linkCheck.totals).toMatchObject({ checked: 20, failed: 0, trailsChecked: 7, trailsFailed: 0 });
  });
});
