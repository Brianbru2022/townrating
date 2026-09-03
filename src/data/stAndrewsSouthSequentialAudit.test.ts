import { describe, expect, it } from 'vitest';
import boarhillsAudit from '../../data/review/boarhills-full-visitor-audit-2026-09-02.json';
import duninoAudit from '../../data/review/dunino-full-visitor-audit-2026-09-02.json';
import hesCertification from '../../data/review/st-andrews-south-hes-date-certification-2026-09-02.json';
import linkCheck from '../../data/review/st-andrews-south-published-link-check-2026-09-02.json';
import sequentialAudit from '../../data/review/st-andrews-south-sequential-audit-summary-2026-09-02.json';
import { homeTownOverviews } from '../map/homeOverview';
import { topFoodAndDrink, visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { stAndrewsCoastPackages } from './stAndrewsCoast';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const expected = [
  ['kincaple-scotland', 38, 0, 0, 1, 0, 0, 0, false],
  ['peat-inn-scotland', 45, 0, 0, 1, 0, 0, 0, false],
  ['newpark-st-andrews-scotland', 18, 0, 0, 0, 0, 0, 0, false],
  ['balone-scotland', 24, 0, 0, 0, 0, 0, 0, false],
  ['denhead-st-andrews-scotland', 40, 0, 0, 1, 0, 0, 0, false],
  ['st-andrews-scotland', 96, 12, 10, 6, 3, 4, 3, true],
  ['prior-muir-scotland', 24, 0, 0, 0, 0, 0, 0, false],
  ['brownhills-st-andrews-scotland', 22, 0, 0, 0, 0, 0, 0, false],
  ['boarhills-scotland', 58, 1, 0, 2, 1, 0, 0, false],
  ['kingsbarns-scotland', 72, 1, 2, 5, 1, 1, 1, true],
  ['balcomie-scotland', 30, 0, 0, 0, 0, 0, 0, false],
  ['dunino-scotland', 58, 2, 0, 1, 0, 1, 0, false],
  ['stravithie-scotland', 30, 0, 0, 0, 0, 0, 0, false],
] as const;

function project(id: string) {
  return stAndrewsCoastPackages.find((pkg) => pkg.project.id === id)!;
}

describe('Kincaple-to-Stravithie sequential full audit', () => {
  it('publishes the reconciled category counts and only maps 60+ towns', () => {
    for (const [id, score, see, eat, trails, picnic, parking, toilets, mapped] of expected) {
      const pkg = project(id);
      const curation = publishedPlannerCurationForProject(id);
      expect(pkg.project.touristAppeal?.score, `${id} score`).toBe(score);
      expect(topVisitPlaces(pkg, 30), `${id} See`).toHaveLength(see);
      expect(topFoodAndDrink(pkg, 30), `${id} Eat`).toHaveLength(eat);
      expect(visitorNeedPlaces(pkg, 'trails', 30, { curatedFeatureIds: curation.trails }), `${id} Trails`).toHaveLength(trails);
      expect(visitorNeedPlaces(pkg, 'picnic', 30, { curatedFeatureIds: curation.picnic }), `${id} Picnic`).toHaveLength(picnic);
      expect(visitorNeedPlaces(pkg, 'parking', 30, { curatedFeatureIds: curation.parking }), `${id} Parking`).toHaveLength(parking);
      expect(visitorNeedPlaces(pkg, 'toilets', 30, { curatedFeatureIds: curation.toilets }), `${id} Toilets`).toHaveLength(toilets);
      expect(homeTownOverviews([pkg]).length > 0, `${id} map state`).toBe(mapped);
    }
    expect(sequentialAudit.completedSequentially).toBe(true);
    expect(sequentialAudit.audits).toHaveLength(13);
  });

  it('replaces Kincaple’s false coastal-path label with related route context', () => {
    const pkg = project('kincaple-scotland');
    expect(pkg.features.some((feature) => feature.id === 'curated-trail:fife-coastal-path-kincaple')).toBe(false);
    const route = pkg.features.find((feature) => feature.id === 'curated-trail:st-andrews-local-walk-kincaple')!;
    expect(route.name).toBe('St Andrews Local Walk via Easter Kincaple');
    expect(route.evidenceScope).toBe('related_context');
  });

  it('retains all in-scope local HES/NRHE records while hiding every undated or contextual pin', () => {
    expect(hesCertification.projects).toHaveLength(13);
    expect(hesCertification.totals.visiblePinsWithoutDates).toBe(0);
    expect(hesCertification.totals.visiblePinNamesContainingDate).toBe(0);
    for (const [id] of expected) {
      const heritage = project(id).features.filter((feature) =>
        feature.tags.some((tag) => (tag.startsWith('hes-') && tag !== 'hes-date-reviewed') || tag === 'nrhe'),
      );
      const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
      expect(visible.every((feature) => Boolean(feature.documentedDateText) && feature.dateBasis !== 'unknown'), id).toBe(true);
      expect(visible.every((feature) => !feature.name.includes(feature.documentedDateText ?? '\u0000')), id).toBe(true);
    }
  });

  it('records the mandatory exact-58 second passes and verifies all published links', () => {
    expect(boarhillsAudit.scoreReanalysis).toMatchObject({ required: true, completed: true, resultScore: 58 });
    expect(duninoAudit.scoreReanalysis).toMatchObject({ required: true, completed: true, resultScore: 58 });
    expect(linkCheck.totals).toMatchObject({ checked: 49, failed: 0 });
  });
});
