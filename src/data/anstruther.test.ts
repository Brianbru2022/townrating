import { describe, expect, it } from 'vitest';
import area from '@turf/area';
import intersect from '@turf/intersect';
import { featureCollection } from '@turf/helpers';
import dateAudit from '../../data/review/anstruther-hes-date-enrichment-2026-08-26.json';
import visitorAudit from '../../data/review/anstruther-full-visitor-audit-2026-08-26.json';
import { dogOwnerAttractionScore } from '../domain/dogAccess';
import { validateFeatures } from '../domain/validation';
import { topVisitPlaces } from '../domain/visiting';
import { visitorFacts, visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { eastNeukPackages } from './eastNeuk';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const pkg = eastNeukPackages.find((item) => item.project.id === 'anstruther-scotland')!;
const cellardyke = eastNeukPackages.find((item) => item.project.id === 'cellardyke-scotland')!;
const curation = publishedPlannerCurationForProject(pkg.project.id);
const named = (name: string) => pkg.features.find((feature) => feature.name === name)!;

describe('Anstruther full visitor audit', () => {
  it('rates the destination and dog-owner visit separately without dog inflation', () => {
    expect(pkg.project.touristAppeal).toMatchObject({ score: 90, dogOwnerScore: 89, dogAccessScoreAdjustment: -1, rating: 3, dogAccessRating: 2 });
    expect(pkg.project.touristAppeal!.dogOwnerScore).toBeLessThan(pkg.project.touristAppeal!.score!);
  });

  it('publishes only researched attractions above 60', () => {
    expect(visitorAudit.publicationRule).toBe('visitor score > 60');
    expect(pkg.project.visitorHighlights?.map((place) => [place.name, place.visitorScore])).toEqual([
      ['Scottish Fisheries Museum', 92],
      ['Isle of May Ferry – May Princess', 91],
      ['Anstruther Harbour and Waterfront', 84],
    ]);
    expect(pkg.project.visitorHighlights?.every((place) => (place.visitorScore ?? 0) > 60)).toBe(true);
    expect(topVisitPlaces(pkg, 10)).toHaveLength(3);
  });

  it('uses distinct Anstruther working-harbour artwork', () => {
    expect(pkg.project.visualIdentity).toMatchObject({
      theme: 'east-neuk-maritime-harbour',
      badgeImage: '/town-guides/anstruther-working-harbour-watercolour-guide.png',
      heroImage: '/town-guides/anstruther-working-harbour-watercolour-guide.png',
    });
  });

  it('publishes four café-led Eats with source-specific dog-policy checks', () => {
    expect(curation.eat).toHaveLength(4);
    expect(visitorNeedPlaces(pkg, 'eat', 10, { curatedFeatureIds: curation.eat }).map((place) => [place.name, place.visitorScore])).toEqual([
      ['Waves Café', 82],
      ['Coast Coffee', 75],
      ['The Fudge Lass', 72],
      ['Scoop', 70],
    ]);
    expect(publishedDogAccessForPlace(pkg.project.id, 'eat', 'osm-community:node-7134353166')).toMatchObject({ rating: 2, status: 'restricted' });
    expect(publishedDogAccessForPlace(pkg.project.id, 'eat', 'curated-food:anstruther-fudge-lass')).toMatchObject({ rating: 0, status: 'unconfirmed' });
  });

  it('publishes four researched trails including the current Treasure Trails product', () => {
    expect(curation.trails).toEqual([
      'curated-trail:anstruther-treasure-trail',
      'curated-trail:anstruther-fife-coastal-path',
      'curated-trail:anstruther-town-trail',
      'curated-trail:anstruther-coast-country-circular',
    ]);
    expect(visitorFacts(named('Anstruther – Old Castle & Harbour Treasure Trail'))).toEqual(expect.arrayContaining([
      { label: 'Distance', value: '1.75 miles' },
      { label: 'Time to spend', value: '1.5 hours' },
      { label: 'App', value: 'Instant digital download' },
    ]));
    expect(visitorNeedPlaces(pkg, 'trails', 10, { curatedFeatureIds: curation.trails }).find((place) => place.id === 'curated-trail:anstruther-treasure-trail')?.timeToSpend).toBe('1.5 hours');
    expect(publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-trail:anstruther-treasure-trail')).toMatchObject({ rating: 3, status: 'welcoming' });
    expect(visitorFacts(named('Fife Coastal Path: Anstruther to Crail'))).toEqual(expect.arrayContaining([
      { label: 'Distance', value: '6.75 km / 4.25 miles' },
      { label: 'Time to spend', value: '1.5–2 hours one way' },
    ]));
    expect(visitorFacts(named('Anstruther Town Trail'))).toEqual(expect.arrayContaining([{ label: 'App', value: 'Downloadable web map' }]));
    expect(visitorFacts(named('Anstruther Coast and Country Circular'))).toEqual(expect.arrayContaining([
      { label: 'Distance', value: '14.08 km / about 9 miles' },
      { label: 'App', value: 'GPX and KML downloads' },
    ]));
    expect(visitorAudit.trails[0]).toMatchObject({ score: 82, dogFriendly: true });
  });

  it('publishes the three current council car parks with useful pricing and payment data', () => {
    expect(curation.parking).toHaveLength(3);
    expect(visitorFacts(named('East Basin Car Park'))).toEqual(expect.arrayContaining([
      { label: 'Spaces', value: 'About 20 during RNLI works (79 published normal capacity)' },
      { label: 'Pricing', value: '80p for 1 hour / £1.00 for 2 hours' },
      { label: 'Payment', value: 'Coins or RingGo' },
    ]));
    expect(visitorFacts(named('The Folly Car Park'))).toEqual(expect.arrayContaining([{ label: 'Spaces', value: '32' }]));
    expect(visitorFacts(named('St Andrews Road Car Park'))).toEqual(expect.arrayContaining([
      { label: 'Spaces', value: '60' },
      { label: 'Pricing', value: 'Free' },
      { label: 'Payment', value: 'None' },
    ]));
  });

  it('publishes the official harbour toilet and three mapped picnic tables', () => {
    expect(curation.toilets).toEqual(['osm-community:node-11417818487']);
    expect(curation.picnic).toHaveLength(3);
    expect(visitorFacts(named('Anstruther Harbour Public Toilets'))).toEqual(expect.arrayContaining([
      { label: 'Opening times', value: '1 April–31 October 09:00–20:00' },
      { label: 'Price', value: '30p' },
    ]));
  });

  it('applies the researched dog penalty per attraction', () => {
    const museum = publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-attraction:anstruther-1')!;
    const ferry = publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-attraction:anstruther-2')!;
    const harbour = publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-attraction:anstruther-3')!;
    expect(dogOwnerAttractionScore(92, museum)).toBe(82);
    expect(dogOwnerAttractionScore(91, ferry)).toBe(66);
    expect(dogOwnerAttractionScore(84, harbour)).toBe(84);
  });

  it('dates all defensible visible HES pins from official descriptions', () => {
    expect(dateAudit).toMatchObject({ total: 160, dated: 151, undated: 9, failed: 0 });
    const visibleListed = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building') && !feature.tags.includes('map-hidden'));
    expect(visibleListed).toHaveLength(155);
    expect(visibleListed.every((feature) => feature.documentedDateText && !/^date:\s*\d{4}-\d{2}/i.test(feature.documentedDateText))).toBe(true);
  });

  it('retains a zero-overlap heat-map boundary with Cellardyke and has no validation errors', () => {
    const overlap = intersect(featureCollection([pkg.project.townStudyArea!.visitorBoundary!, cellardyke.project.townStudyArea!.visitorBoundary!]));
    expect(overlap ? area(overlap) : 0).toBeLessThan(0.5);
    expect(validateFeatures(pkg.project, pkg.features).filter((item) => item.severity === 'error')).toEqual([]);
  });
});
