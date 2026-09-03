import { describe, expect, it } from 'vitest';
import hesCertification from '../../data/review/east-neuk-balcomie-lochty-reaudit-hes-date-certification-2026-09-03.json';
import linkCheck from '../../data/review/east-neuk-balcomie-lochty-reaudit-published-link-check-2026-09-03.json';
import sequentialAudit from '../../data/review/east-neuk-balcomie-lochty-reaudit-sequential-audit-summary-2026-09-03.json';
import { topVisitPlaces } from '../domain/visiting';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { homeTownOverviews } from '../map/homeOverview';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';
import { publishedProjectPackages } from './publishedProjects';

const expected = [
  ['balcomie-scotland', 30, 0, 0, 0, 0, 0, 0, false],
  ['crail-scotland', 82, 9, 3, 3, 0, 2, 2, true],
  ['pitcorthie-kilrenny-scotland', 28, 0, 0, 0, 0, 0, 0, false],
  ['kilrenny-scotland', 62, 2, 0, 1, 2, 1, 0, true],
  ['anstruther-scotland', 90, 3, 4, 4, 3, 3, 1, true],
  ['pitkierie-scotland', 26, 0, 0, 0, 0, 0, 0, false],
  ['pittenweem-scotland', 85, 4, 4, 3, 1, 2, 2, true],
  ['st-monans-scotland', 84, 3, 2, 3, 1, 3, 1, true],
  ['ardross-fife-scotland', 48, 1, 0, 1, 0, 0, 0, false],
  ['abercrombie-fife-scotland', 56, 1, 0, 1, 0, 0, 0, false],
  ['arncroach-scotland', 49, 0, 0, 0, 0, 0, 0, false],
  ['carnbee-scotland', 50, 1, 0, 0, 0, 0, 0, false],
  ['kingsmuir-fife-scotland', 20, 0, 0, 0, 0, 0, 0, false],
  ['lochty-fife-scotland', 24, 0, 0, 0, 0, 0, 0, false],
] as const;

function project(id: string) {
  const pkg = publishedProjectPackages.find((candidate) => candidate.project.id === id);
  if (!pkg) throw new Error(`Missing published project ${id}`);
  return pkg;
}

describe('Balcomie-to-Lochty 2026-09-03 sequential re-audit', () => {
  it('keeps all fourteen places selectable and maps only the five qualifying settlements', () => {
    for (const [id, score, see, eat, trails, picnic, parking, toilets, mapped] of expected) {
      const pkg = project(id);
      const curation = publishedPlannerCurationForProject(id);
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
  });

  it('keeps the Fife Kingsmuir and Lochty records distinct from names elsewhere', () => {
    expect(project('kingsmuir-fife-scotland').project.region).toBe('Fife');
    expect(project('lochty-fife-scotland').project.region).toBe('Fife');
    expect(publishedProjectPackages.some((pkg) => pkg.project.id === 'kingsmuir-scotland')).toBe(true);
    expect(publishedProjectPackages.some((pkg) => pkg.project.id === 'lochty-menmuir-scotland')).toBe(true);
  });

  it('retains the local HES and NRHE evidence while showing only materially dated pins', () => {
    expect(hesCertification.projects).toHaveLength(14);
    expect(hesCertification.totals).toMatchObject({
      records: 1354,
      visiblePins: 1023,
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

  it('records dog access for every published See, Eat and Trail place', () => {
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

  it('contains no exact-58 placeholder and has no broken published links', () => {
    expect(expected.some(([, score]) => score === 58)).toBe(false);
    expect(linkCheck.totals).toMatchObject({ checked: 39, failed: 0, trailsChecked: 11, trailsFailed: 0 });
  });
});
