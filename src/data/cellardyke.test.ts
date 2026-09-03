import { describe, expect, it } from 'vitest';
import area from '@turf/area';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import intersect from '@turf/intersect';
import { featureCollection, point } from '@turf/helpers';
import dateAudit from '../../data/review/cellardyke-hes-date-enrichment-2026-08-26.json';
import overlapAudit from '../../data/review/cellardyke-anstruther-overlap-resolution-2026-08-26.json';
import visitorAudit from '../../data/review/cellardyke-full-visitor-audit-2026-08-26.json';
import { dogOwnerAttractionScore } from '../domain/dogAccess';
import { validateFeatures } from '../domain/validation';
import { topVisitPlaces } from '../domain/visiting';
import { visitorFacts, visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { eastNeukPackages } from './eastNeuk';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const pkg = eastNeukPackages.find((item) => item.project.id === 'cellardyke-scotland')!;
const anstruther = eastNeukPackages.find((item) => item.project.id === 'anstruther-scotland')!;
const curation = publishedPlannerCurationForProject(pkg.project.id);
const named = (name: string) => pkg.features.find((feature) => feature.name === name)!;

describe('Cellardyke full visitor audit', () => {
  it('keeps the town and dog-owner scores separate and never inflates for dogs', () => {
    expect(pkg.project.touristAppeal).toMatchObject({
      score: 78,
      dogOwnerScore: 74,
      dogAccessScoreAdjustment: -4,
      dogAccessRating: 2,
    });
  });

  it('publishes only researched attractions above 60', () => {
    expect(visitorAudit.publicationRule).toBe('visitor score > 60');
    expect(pkg.project.visitorHighlights?.map((place) => [place.name, place.visitorScore])).toEqual([
      ['Cellardyke Tidal Pool', 84],
      ['East Neuk Outdoors', 82],
      ['Cellardyke Harbour (Skinfast Haven)', 78],
      ['Cellardyke Seaside Sauna', 76],
      ['Cellardyke Historic Streets and Boards', 68],
      ['Gallery 495', 63],
    ]);
    expect(pkg.project.visitorHighlights?.every((place) => (place.visitorScore ?? 0) > 60)).toBe(true);
    expect(topVisitPlaces(pkg, 10)).toHaveLength(6);
  });

  it('uses distinct Cellardyke harbour artwork', () => {
    expect(pkg.project.visualIdentity).toMatchObject({
      theme: 'east-neuk-harbour',
      badgeImage: '/town-guides/cellardyke-harbour-watercolour-guide.png',
      heroImage: '/town-guides/cellardyke-harbour-watercolour-guide.png',
    });
  });

  it('publishes four researched Eats and keeps dog evidence cautious', () => {
    expect(curation.eat).toHaveLength(4);
    const eats = visitorNeedPlaces(pkg, 'eat', 10, { curatedFeatureIds: curation.eat });
    expect(eats.map((place) => [place.name, place.visitorScore])).toEqual([
      ['The Grind', 82],
      ['The Haven Bar & Restaurant', 78],
      ['G. H. Barnett Bakery', 68],
      ['Fortune House', 63],
    ]);
    expect(publishedDogAccessForPlace(pkg.project.id, 'eat', 'curated-food:cellardyke-the-grind')).toMatchObject({ rating: 3, status: 'welcoming' });
    expect(publishedDogAccessForPlace(pkg.project.id, 'eat', 'osm-community:node-2803322114')).toMatchObject({ rating: 2, status: 'restricted' });
  });

  it('publishes the coastal path and real six-board heritage walk, not an invented Treasure Trails listing', () => {
    expect(curation.trails).toEqual([
      'curated-trail:cellardyke-fife-coastal-path',
      'curated-trail:cellardyke-historical-boards',
    ]);
    expect(visitorFacts(named('Fife Coastal Path: Cellardyke to Crail'))).toEqual(expect.arrayContaining([
      { label: 'Distance', value: '6.75 km / 4.25 miles' },
      { label: 'Time to spend', value: '2–2.5 hours one way' },
    ]));
    expect(visitorFacts(named('Cellardyke Historical Boards Walk'))).toEqual(expect.arrayContaining([
      { label: 'App', value: 'Mobile web interpretation' },
    ]));
    expect(visitorAudit.trails[1].treasureTrailsApp).toContain('No Cellardyke-specific');
  });

  it('publishes three official seven-space free car parks with no payment required', () => {
    expect(curation.parking).toHaveLength(3);
    for (const name of ['George Street Car Park', 'James Street Car Park', 'John Street Car Park']) {
      expect(visitorFacts(named(name))).toEqual(expect.arrayContaining([
        { label: 'Spaces', value: '7' },
        { label: 'Pricing', value: 'Free' },
        { label: 'Payment', value: 'None' },
      ]));
    }
  });

  it('publishes only the corroborated pool toilet block and three picnic tables', () => {
    expect(curation.toilets).toEqual(['osm-community:way-361665173']);
    expect(curation.picnic).toHaveLength(3);
    expect(named('Cellardyke Tidal Pool Public Toilets').reviewNotes).toContain('operational details remain cautious');
  });

  it('keeps attraction score and dog-owner score separate for each place', () => {
    const poolDog = publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-attraction:cellardyke-2')!;
    const harbourDog = publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-attraction:cellardyke-1')!;
    expect(poolDog).toMatchObject({ rating: 0, status: 'unconfirmed' });
    expect(harbourDog).toMatchObject({ rating: 3, status: 'welcoming' });
    expect(dogOwnerAttractionScore(84, poolDog)).toBe(72);
    expect(dogOwnerAttractionScore(78, harbourDog)).toBe(78);
  });

  it('dates the HES pins from official descriptions', () => {
    expect(dateAudit).toMatchObject({ total: 92, dated: 90, undated: 2, failed: 0 });
    const listed = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building'));
    expect(listed.filter((feature) => feature.documentedDateText)).toHaveLength(90);
  });

  it('has no validation errors', () => {
    expect(validateFeatures(pkg.project, pkg.features).filter((item) => item.severity === 'error')).toEqual([]);
  });

  it('does not overlap Anstruther or publish Anstruther-locality records', () => {
    const cellardykeBoundary = pkg.project.townStudyArea?.visitorBoundary!;
    const anstrutherBoundary = anstruther.project.townStudyArea?.visitorBoundary!;
    const anstrutherLocality = anstruther.project.townStudyArea?.localityBoundary!;
    const overlap = intersect(featureCollection([cellardykeBoundary, anstrutherBoundary]));
    expect(overlap ? area(overlap) : 0).toBeLessThan(0.5);
    expect(overlapAudit).toMatchObject({ excludedFromCellardyke: 54, resolvedBoundaryOverlapSquareMetres: 0 });
    expect(
      pkg.features.filter(
        (feature) =>
          feature.geometry?.type === 'Point' &&
          booleanPointInPolygon(point(feature.geometry.coordinates), anstrutherLocality) &&
          !feature.tags.includes('map-hidden'),
      ),
    ).toEqual([]);
    for (const highlight of pkg.project.visitorHighlights ?? []) {
      const feature = pkg.features.find((candidate) => candidate.id === highlight.featureId)!;
      if (feature.geometry?.type !== 'Point') throw new Error(`${highlight.name} is not a mappable point`);
      expect(booleanPointInPolygon(point(feature.geometry.coordinates), cellardykeBoundary), highlight.name).toBe(true);
    }
  });
});
