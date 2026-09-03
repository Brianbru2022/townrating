import { describe, expect, it } from 'vitest';
import dateAudit from '../../data/review/kilconquhar-hes-date-enrichment-2026-08-26.json';
import visitorAudit from '../../data/review/kilconquhar-full-visitor-audit-2026-08-26.json';
import { validateFeatures } from '../domain/validation';
import { topVisitPlaces } from '../domain/visiting';
import { visitorFacts, visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { eastNeukPackages } from './eastNeuk';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const pkg = eastNeukPackages.find((item) => item.project.id === 'kilconquhar-scotland')!;
const curation = publishedPlannerCurationForProject(pkg.project.id);
const named = (name: string) => pkg.features.find((item) => item.name === name)!;

describe('Kilconquhar full visitor audit', () => {
  it('retains a restrained Notable Stop score and lowers the dog-owner score', () => {
    expect(pkg.project.touristAppeal).toMatchObject({
      score: 65,
      dogOwnerScore: 64,
      dogAccessScoreAdjustment: -1,
      rating: 0,
      label: 'Notable Stop',
      dogAccessRating: 2,
    });
    expect(pkg.project.touristAppeal!.dogOwnerScore).toBeLessThan(pkg.project.touristAppeal!.score!);
  });

  it('publishes only the three researched attractions above 60', () => {
    expect(visitorAudit.publicationRule).toBe('visitor score > 60 with a complete current visitor contract');
    expect(pkg.project.visitorHighlights?.map((item) => [item.name, item.visitorScore])).toEqual([
      ['Kilconquhar Parish Church, Old Kirk and Loch Viewpoint', 74],
      ['Kilconquhar Historic Village Trail', 68],
      ['Barnyards Marsh Nature Reserve', 63],
    ]);
    expect(topVisitPlaces(pkg, 10)).toHaveLength(3);
  });

  it('keeps the meal-led inn out and publishes the genuine village trail', () => {
    expect(curation.eat).toEqual([]);
    expect(visitorNeedPlaces(pkg, 'eat', 10, { curatedFeatureIds: curation.eat })).toEqual([]);
    expect(curation.trails).toEqual(['curated-trail:kilconquhar-village-marsh-circuit']);
    expect(visitorFacts(named('Kilconquhar Village Heritage and Marsh Circuit'))).toEqual(expect.arrayContaining([
      { label: 'Distance', value: 'Not published' },
      { label: 'Time to spend', value: '60-90 minutes' },
    ]));
  });

  it('shows responsible-source parking facts and does not invent toilets', () => {
    expect(curation.parking).toEqual(['osm-community:way-967273542']);
    expect(visitorFacts(named('C40 Main Street Car Park'))).toEqual(expect.arrayContaining([
      { label: 'Spaces', value: '20' },
      { label: 'Pricing', value: 'Free' },
      { label: 'Payment', value: 'No payment required' },
      { label: 'Hours', value: 'Not published' },
    ]));
    expect(curation.toilets).toEqual([]);
    expect(curation.picnic).toEqual([]);
  });

  it('keeps dog policies place-specific and the private loch out of the attraction list', () => {
    expect(publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-attraction:kilconquhar-1')).toMatchObject({ rating: 2, status: 'restricted' });
    expect(publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-attraction:kilconquhar-2')).toMatchObject({ rating: 3, status: 'welcoming' });
    expect(pkg.project.visitorHighlights?.some((item) => item.name === 'Kilconquhar Loch')).toBe(false);
  });

  it('ships dedicated artwork and dated visible heritage pins', () => {
    expect(pkg.project.visualIdentity).toMatchObject({
      theme: 'east-neuk-village-lane',
      heroImage: '/town-guides/kilconquhar-village-lane-watercolour-guide-v1.png',
    });
    expect(dateAudit).toMatchObject({ candidates: 62, enriched: 57, manuallyReviewed: 5, reviewRequired: [] });
    const visibleHeritage = pkg.features.filter((item) => item.tags.includes('hes-listed-building') && !item.tags.includes('map-hidden') && item.evidenceScope !== 'out_of_scope');
    expect(visibleHeritage).toHaveLength(61);
    expect(visibleHeritage.every((item) => Boolean(item.documentedDateText))).toBe(true);
    expect(validateFeatures(pkg.project, pkg.features).filter((item) => item.severity === 'error')).toEqual([]);
  });
});
