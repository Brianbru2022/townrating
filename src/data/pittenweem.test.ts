import { describe, expect, it } from 'vitest';
import area from '@turf/area';
import intersect from '@turf/intersect';
import { featureCollection } from '@turf/helpers';
import dateAudit from '../../data/review/pittenweem-hes-date-enrichment-2026-08-26.json';
import overlapAudit from '../../data/review/pittenweem-boundary-overlap-audit-2026-08-26.json';
import visitorAudit from '../../data/review/pittenweem-full-visitor-audit-2026-08-26.json';
import { validateFeatures } from '../domain/validation';
import { topVisitPlaces } from '../domain/visiting';
import { visitorFacts, visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { eastNeukPackages } from './eastNeuk';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const pkg = eastNeukPackages.find((item) => item.project.id === 'pittenweem-scotland')!;
const stMonans = eastNeukPackages.find((item) => item.project.id === 'st-monans-scotland')!;
const anstruther = eastNeukPackages.find((item) => item.project.id === 'anstruther-scotland')!;
const curation = publishedPlannerCurationForProject(pkg.project.id);
const named = (name: string) => pkg.features.find((item) => item.name === name)!;

describe('Pittenweem full visitor audit', () => {
  it('keeps the dog-owner score separate and lower', () => {
    expect(pkg.project.touristAppeal).toMatchObject({ score: 85, dogOwnerScore: 84, dogAccessScoreAdjustment: -1, rating: 2, dogAccessRating: 2 });
    expect(pkg.project.touristAppeal!.dogOwnerScore).toBeLessThan(pkg.project.touristAppeal!.score!);
  });

  it('publishes only permanent researched attractions above 60', () => {
    expect(visitorAudit.publicationRule).toBe('visitor score > 60');
    expect(pkg.project.visitorHighlights?.map((item) => [item.name, item.visitorScore])).toEqual([
      ['Pittenweem Working Harbour and Wynds', 86],
      ['West Braes, Tidal Pool and Crazy Golf', 79],
      ['St Fillan’s Cave', 74],
      ['Weem Gallery and Framer', 68],
    ]);
    expect(topVisitPlaces(pkg, 10)).toHaveLength(4);
    expect(visitorAudit.exclusions[0]).toContain('Arts Festival ended');
  });

  it('uses purpose-built Pittenweem working-harbour artwork', () => {
    expect(pkg.project.visualIdentity).toMatchObject({
      theme: 'east-neuk-working-fishing-harbour',
      badgeImage: '/town-guides/pittenweem-shoreline-watercolour-guide-v2.png',
      heroImage: '/town-guides/pittenweem-shoreline-watercolour-guide-v2.png',
    });
  });

  it('publishes four café-led Eats with source-specific dog policies', () => {
    expect(curation.eat).toHaveLength(4);
    expect(visitorNeedPlaces(pkg, 'eat', 10, { curatedFeatureIds: curation.eat }).map((item) => [item.name, item.visitorScore])).toEqual([
      ['The Cocoa Tree Café and Chocolate Shop', 84],
      ['Clock Tower Café', 80],
      ['Nicholson’s Sweet and Ice Cream Shop', 73],
      ['West Braes Hut', 66],
    ]);
    expect(publishedDogAccessForPlace(pkg.project.id, 'eat', 'curated-food:pittenweem-clock-tower-cafe')).toMatchObject({ rating: 3, status: 'welcoming' });
    expect(publishedDogAccessForPlace(pkg.project.id, 'eat', 'curated-food:pittenweem-larachmhor-tavern')).toMatchObject({ rating: 0, status: 'unconfirmed' });
  });

  it('publishes three useful trails including the exact Pittenweem Treasure Trail', () => {
    expect(curation.trails).toEqual([
      'curated-trail:pittenweem-fife-coastal-path',
      'curated-trail:pittenweem-treasure-trail',
      'curated-trail:pittenweem-st-monans-abercrombie',
    ]);
    expect(visitorFacts(named('Pittenweem – Centre, Pier & Harbour Treasure Trail'))).toEqual(expect.arrayContaining([
      { label: 'Distance', value: '1.5 miles' },
      { label: 'Time to spend', value: '1.5 hours' },
      { label: 'App', value: 'Instant digital download' },
    ]));
    expect(publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-trail:pittenweem-treasure-trail')).toMatchObject({ rating: 3, status: 'welcoming' });
  });

  it('publishes honest parking and toilet detail without invented capacity', () => {
    expect(curation.parking).toHaveLength(2);
    const parkingPlaces = visitorNeedPlaces(pkg, 'parking', 10, { curatedFeatureIds: curation.parking });
    expect(parkingPlaces.find((item) => item.id === 'osm-community:way-480231093')).toMatchObject({
      parkingPriceStatus: 'paid',
      freeAdmission: false,
      admission: 'Free up to 2 hours / £2 all day / £10 overnight motorhome',
    });
    expect(visitorFacts(pkg.features.find((item) => item.id === 'curated-parking:pittenweem-market-place')!)).toEqual(expect.arrayContaining([
      { label: 'Spaces', value: '9 cars, 1 accessible, 1 coach/lorry' },
      { label: 'Pricing', value: 'Free' },
    ]));
    expect(visitorAudit.facilities.parking[1]).toMatchObject({ capacity: 'Total not published; 3 dedicated overnight motorhome bays' });
    expect(curation.toilets).toEqual(['osm-community:node-498851014', 'osm-community:way-480231095']);
    expect(visitorFacts(named('Pittenweem Harbour Public Toilets'))).toEqual(expect.arrayContaining([
      { label: 'Opening times', value: 'Daily 09:00–17:00 year-round' },
      { label: 'Price', value: 'Free' },
    ]));
  });

  it('dates all defensible HES pins and retains separate neighbouring heat maps', () => {
    expect(dateAudit).toMatchObject({ total: 198, dated: 190, undated: 8, failed: 0 });
    const visibleListed = pkg.features.filter((item) => item.tags.includes('hes-listed-building') && !item.tags.includes('map-hidden'));
    expect(visibleListed).toHaveLength(196);
    expect(visibleListed.every((item) => item.documentedDateText && !/^date:\s*\d{4}-\d{2}/i.test(item.documentedDateText))).toBe(true);
    for (const neighbour of [stMonans, anstruther]) {
      const overlap = intersect(featureCollection([pkg.project.boundary, neighbour.project.boundary]));
      expect(overlap ? area(overlap) : 0).toBeLessThan(0.5);
    }
    expect(overlapAudit.results.every((item) => item.pittenweemPointFeaturesInsideNeighbourBoundary === 0)).toBe(true);
    expect(validateFeatures(pkg.project, pkg.features).filter((item) => item.severity === 'error')).toEqual([]);
  });
});
