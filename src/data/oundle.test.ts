import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import { parkingPriceStatus, visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { oundlePackage } from './oundle';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Oundle published package', () => {
  it('ships source-backed dates for the Historic England heat-map records', () => {
    const nhle = oundlePackage.features.filter((feature) => feature.tags.includes('nhle'));
    const dated = nhle.filter((feature) => feature.earliestPossibleYear !== undefined);
    expect(nhle).toHaveLength(170);
    expect(dated.length / nhle.length).toBeGreaterThan(0.7);
  });

  it('preserves the official ONS boundary and publishes a reviewed green-space visitor extent', () => {
    expect(oundlePackage.project).toMatchObject({
      countryCode: 'GB-ENG',
      country: 'England',
      region: 'Northamptonshire',
      touristAppeal: { rating: 1, label: 'Local detour' },
    });
    expect(oundlePackage.project.townStudyArea).toMatchObject({
      localityCode: 'E63009999',
      sourceName: 'ONS Built-up Areas (December 2024)',
      bufferMetres: 0,
    });
    expect(oundlePackage.project.boundary).toEqual(
      oundlePackage.project.townStudyArea?.visitorBoundary,
    );
    expect(oundlePackage.project.boundary).not.toEqual(
      oundlePackage.project.townStudyArea?.localityBoundary,
    );
    expect(oundlePackage.project.boundary.properties?.sourceDataset).toBe(
      'Curated Oundle visitor boundary',
    );
    expect(oundlePackage.project.visualIdentity).toMatchObject({
      theme: 'stone-market-town-river',
      badgeImage: '/town-guides/oundle-talbot-courtyard-watercolour-guide.png',
      heroImage: '/town-guides/oundle-talbot-courtyard-watercolour-guide.png',
      heroAlt:
        'Light ink-and-watercolour illustration of an Oundle limestone courtyard and formal garden',
    });
  });

  it('publishes the researched attraction scores in order', () => {
    const attractions = topVisitPlaces(oundlePackage, 20);
    expect(attractions.map((place) => place.name)).toEqual([
      'Oundle historic town centre and Market Place',
      "St Peter's Church",
      'Oundle Museum',
      'The Talbot Hotel historic interiors and courtyard',
      'Oundle School Cloisters and Great Hall streetscape',
      'Oundle Wharf and River Nene',
      'The Yarrow Gallery',
      'Stahl Theatre',
    ]);
    expect(attractions.map((place) => place.visitorScore)).toEqual([
      84, 82, 78, 74, 70, 68, 60, 56,
    ]);
  });

  it('keeps every public planner marker inside the active boundary', () => {
    const featureById = new Map(oundlePackage.features.map((feature) => [feature.id, feature]));
    const curation = publishedPlannerCurationForProject('oundle-england');
    const ids = new Set([
      ...(oundlePackage.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
      ...Object.values(curation).flat(),
    ]);
    for (const id of ids) {
      const feature = featureById.get(id);
      expect(feature, id).toBeDefined();
      expect(feature?.geometry?.type, id).toBe('Point');
      if (feature?.geometry?.type !== 'Point') throw new Error(`${id} is not a point`);
      expect(
        booleanPointInPolygon(point(feature.geometry.coordinates), oundlePackage.project.boundary),
        id,
      ).toBe(true);
    }
  });

  it('ships daytime food, rated trails and clearly priced practical stops', () => {
    const curation = publishedPlannerCurationForProject('oundle-england');
    expect(
      visitorNeedPlaces(oundlePackage, 'eat', 20, { curatedFeatureIds: curation.eat }).map(
        (place) => place.visitorScore,
      ),
    ).toEqual([84, 83, 79, 78, 77, 76, 74, 71, 68]);
    expect(
      visitorNeedPlaces(oundlePackage, 'trails', 20, {
        curatedFeatureIds: curation.trails,
      }).map((place) => place.visitorScore),
    ).toEqual([88, 80]);

    const parking = visitorNeedPlaces(oundlePackage, 'parking', 20, {
      curatedFeatureIds: curation.parking,
    });
    expect(parking.map((place) => place.name)).toEqual([
      'Drill Hall Car Park',
      "St Osyth's Lane / Co-op Car Park",
      'East Road Long Stay Car Park',
      'Fletton House Car Park',
    ]);
    expect(parking.map((place) => parkingPriceStatus(featureById(place.id)))).toEqual([
      'free',
      'free',
      'free',
      'free',
    ]);
    expect(
      visitorNeedPlaces(oundlePackage, 'toilets', 20, {
        curatedFeatureIds: curation.toilets,
      }).map((place) => place.name),
    ).toEqual(["St Osyth's Lane public toilets", 'Oundle Library accessible public toilet']);
    expect(
      visitorNeedPlaces(oundlePackage, 'picnic', 20, {
        curatedFeatureIds: curation.picnic,
      }),
    ).toEqual([]);
  });
});

function featureById(id: string) {
  const feature = oundlePackage.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing feature ${id}`);
  return feature;
}
