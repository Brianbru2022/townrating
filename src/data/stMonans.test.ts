import { describe, expect, it } from 'vitest';
import dateAudit from '../../data/review/st-monans-hes-date-enrichment-2026-08-26.json';
import overlapAudit from '../../data/review/st-monans-boundary-overlap-audit-2026-08-26.json';
import visitorAudit from '../../data/review/st-monans-full-visitor-audit-2026-08-26.json';
import { validateFeatures } from '../domain/validation';
import { topVisitPlaces } from '../domain/visiting';
import { visitorFacts, visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { eastNeukPackages } from './eastNeuk';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const pkg = eastNeukPackages.find((item) => item.project.id === 'st-monans-scotland')!;
const curation = publishedPlannerCurationForProject(pkg.project.id);
const named = (name: string) => pkg.features.find((item) => item.name === name)!;

describe('St Monans full visitor audit', () => {
  it('keeps the dog-owner score separate and lower', () => {
    expect(pkg.project.touristAppeal).toMatchObject({ score: 84, dogOwnerScore: 82, dogAccessScoreAdjustment: -2, rating: 2, dogAccessRating: 1 });
    expect(pkg.project.touristAppeal!.dogOwnerScore).toBeLessThan(pkg.project.touristAppeal!.score!);
  });

  it('publishes only researched attractions above 60', () => {
    expect(visitorAudit.publicationRule).toBe('visitor score > 60');
    expect(pkg.project.visitorHighlights?.map((item) => [item.name, item.visitorScore])).toEqual([
      ['St Monans Windmill and Saltpans', 84],
      ['St Monans Auld Kirk', 82],
      ['St Monans Working Harbour and Tidal Pool', 80],
    ]);
    expect(topVisitPlaces(pkg, 10)).toHaveLength(3);
  });

  it('uses purpose-built St Monans artwork', () => {
    expect(pkg.project.visualIdentity).toMatchObject({
      theme: 'st-monans-kirk-harbour-and-saltpans',
      badgeImage: '/town-guides/st-monans-auld-kirk-shore-watercolour-guide-v2.png',
      heroImage: '/town-guides/st-monans-auld-kirk-shore-watercolour-guide-v2.png',
    });
  });

  it('publishes two café-led Eats with source-specific dog policies', () => {
    expect(curation.eat).toHaveLength(2);
    expect(visitorNeedPlaces(pkg, 'eat', 10, { curatedFeatureIds: curation.eat }).map((item) => [item.name, item.visitorScore])).toEqual([
      ['Giddy Gannet', 82],
      ['Café Malo', 76],
    ]);
    expect(publishedDogAccessForPlace(pkg.project.id, 'eat', 'osm-community:node-2167574535')).toMatchObject({ rating: 2, status: 'restricted' });
    expect(publishedDogAccessForPlace(pkg.project.id, 'eat', 'osm-community:node-6567651834')).toMatchObject({ rating: 3, status: 'welcoming' });
    expect(publishedDogAccessForPlace(pkg.project.id, 'eat', 'osm-community:node-12199185697')).toMatchObject({ rating: 0, status: 'unconfirmed' });
  });

  it('publishes three useful trails and does not invent a Treasure Trail', () => {
    expect(curation.trails).toEqual([
      'curated-trail:st-monans-fife-coastal-path',
      'curated-trail:st-monans-east-neuk-circular',
      'curated-trail:st-monans-pittenweem-abercrombie',
    ]);
    expect(visitorAudit.treasureTrails).toMatchObject({ dedicatedStMonansProductFound: false });
    expect(visitorFacts(named('Fife Coastal Path: St Monans to Anstruther'))).toEqual(expect.arrayContaining([
      { label: 'Distance', value: '5.75 km / 3.5 miles' },
      { label: 'Time to spend', value: '1.5–2 hours' },
    ]));
  });

  it('publishes the official free parking capacities and accessible toilet detail', () => {
    expect(curation.parking).toHaveLength(3);
    const parkingPlaces = visitorNeedPlaces(pkg, 'parking', 10, { curatedFeatureIds: curation.parking });
    expect(parkingPlaces.every((item) => item.parkingPriceStatus === 'free' && item.freeAdmission)).toBe(true);
    expect(visitorFacts(named('The Common Car Park'))).toEqual(expect.arrayContaining([
      { label: 'Spaces', value: '22 cars, 2 accessible, 2 coach/lorry' },
      { label: 'Pricing', value: 'Free' },
      { label: 'Payment', value: 'None' },
    ]));
    expect(curation.toilets).toEqual(['osm-community:node-498854487']);
    expect(visitorFacts(named('St Monans Public Toilets'))).toEqual(expect.arrayContaining([
      { label: 'Opening times', value: 'Apr–Oct 09:00–16:30, Nov–Mar 09:00–15:30' },
      { label: 'Price', value: 'Free' },
    ]));
  });

  it('dates defensible HES pins and keeps neighbouring heat maps separate', () => {
    expect(dateAudit).toMatchObject({ total: 108, dated: 105, undated: 3, failed: 0 });
    const visibleListed = pkg.features.filter((item) => item.tags.includes('hes-listed-building') && !item.tags.includes('map-hidden'));
    expect(visibleListed).toHaveLength(108);
    expect(visibleListed.every((item) => item.documentedDateText && !/^date:\s*\d{4}-\d{2}/i.test(item.documentedDateText))).toBe(true);
    expect(visitorFacts(named('St Monans Windmill and Saltpans'))).toContainEqual({ label: 'Historic date', value: '1772' });
    expect(visitorFacts(named('St Monans Auld Kirk'))).toContainEqual({ label: 'Historic date', value: 'Fabric chiefly 1362; tower heightened in the 16th century' });
    expect(visitorFacts(named('St Monans Working Harbour and Tidal Pool'))).toContainEqual({ label: 'Historic date', value: 'Central pier pre-1828; east pier 1865; west pier rebuilt 1902' });
    expect(overlapAudit.comparisons.every((item) => item.overlapSquareMetres === 0 && item.stMonansFeaturesInsideNeighbourStudyArea === 0)).toBe(true);
    expect(validateFeatures(pkg.project, pkg.features).filter((item) => item.severity === 'error')).toEqual([]);
  });
});
