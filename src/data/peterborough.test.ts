import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import { parkingPriceStatus, visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { peterboroughPackage } from './peterborough';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Peterborough published package', () => {
  it('ships source-backed dates for the Historic England heat-map records', () => {
    const nhle = peterboroughPackage.features.filter((feature) => feature.tags.includes('nhle'));
    const dated = nhle.filter((feature) => feature.earliestPossibleYear !== undefined);
    expect(nhle).toHaveLength(294);
    expect(dated.length / nhle.length).toBeGreaterThan(0.7);
    expect(
      peterboroughPackage.features.find(
        (feature) => feature.id === 'historic-england:nhle:1126990',
      ),
    ).toMatchObject({
      name: 'OLD GUILD HALL',
      earliestPossibleYear: 1671,
      latestPossibleYear: 1671,
      dateBasis: 'documented_construction',
    });
    expect(
      peterboroughPackage.features.find(
        (feature) => feature.id === 'historic-england:nhle:1126946',
      ),
    ).toMatchObject({
      earliestPossibleYear: 1842,
      latestPossibleYear: 1842,
    });
    expect(
      peterboroughPackage.features.find(
        (feature) => feature.id === 'historic-england:nhle:1126896',
      ),
    ).toMatchObject({
      earliestPossibleYear: 1936,
      latestPossibleYear: 1936,
    });
  });

  it('preserves the official ONS boundary and exposes a transparent visitor boundary', () => {
    expect(peterboroughPackage.project).toMatchObject({
      countryCode: 'GB-ENG',
      country: 'England',
      region: 'Cambridgeshire',
      touristAppeal: { rating: 3, label: 'Destination draw' },
    });
    expect(peterboroughPackage.project.townStudyArea).toMatchObject({
      localityCode: 'E63009810',
      sourceName: 'ONS Built-up Areas (December 2024)',
    });
    expect(peterboroughPackage.project.boundary.properties).toMatchObject({
      sourceDataset: 'Curated Peterborough visitor study boundary',
      originalLocalityCode: 'E63009810',
      visitorExtensionReviewedAt: '2026-08-07',
    });
    expect(peterboroughPackage.project.visualIdentity).toMatchObject({
      theme: 'cathedral-river-city',
      heroImage: '/town-guides/peterborough-cathedral-watercolour-guide.png',
    });
  });

  it('publishes the researched attraction scores in order', () => {
    const attractions = topVisitPlaces(peterboroughPackage, 20);
    expect(attractions.map((place) => place.name)).toEqual([
      'Peterborough Cathedral',
      'Flag Fen Archaeology Park',
      'Ferry Meadows and Nene Park',
      'Peterborough Museum and Art Gallery',
      'Longthorpe Tower',
      'Railworld Wildlife Haven',
      'Peterborough Lido',
      'New Theatre Peterborough',
      'Key Theatre',
      'Peterborough Guildhall and Cathedral Square',
      'Central Park',
      "Bishop's Gardens",
      'Metal',
      'Thorpe Wood Nature Reserve',
      'Roman Golf',
      "St.John's Park",
      'Flip Out',
    ]);
    expect(attractions.map((place) => place.visitorScore)).toEqual([
      94, 89, 87, 82, 80, 78, 76, 74, 72, 70, 68, 64, 59, 58, 55, 54, 54,
    ]);
    expect(attractions[0]?.attractionGuide).toMatchObject({
      toilets: expect.stringContaining('South Transept'),
      thingsToDo: expect.arrayContaining([
        expect.objectContaining({ name: 'The Norman nave and painted ceiling' }),
      ]),
    });
    expect(attractions[0]?.attractionGuide?.thingsToDo).toHaveLength(5);
  });

  it('keeps every public planner marker inside the active boundary', () => {
    const featureById = new Map(peterboroughPackage.features.map((feature) => [feature.id, feature]));
    const curation = publishedPlannerCurationForProject('peterborough-england');
    const ids = new Set([
      ...(peterboroughPackage.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
      ...Object.values(curation).flat(),
    ]);
    for (const id of ids) {
      const feature = featureById.get(id);
      expect(feature, id).toBeDefined();
      expect(feature?.geometry?.type, id).toBe('Point');
      if (feature?.geometry?.type !== 'Point') throw new Error(`${id} is not a point`);
      expect(booleanPointInPolygon(point(feature.geometry.coordinates), peterboroughPackage.project.boundary), id).toBe(true);
    }
  });

  it('ships curated food, trails and clearly priced public parking', () => {
    const curation = publishedPlannerCurationForProject('peterborough-england');
    expect(
      visitorNeedPlaces(peterboroughPackage, 'eat', 20, {
        curatedFeatureIds: curation.eat,
      }).map((place) => place.visitorScore),
    ).toEqual([86, 85, 84, 83, 82, 81, 80, 80, 79, 78, 77, 76, 73, 72, 66]);
    expect(visitorNeedPlaces(peterboroughPackage, 'trails', 20, { curatedFeatureIds: curation.trails }).map((place) => place.visitorScore)).toEqual([88, 86, 82, 81, 78]);
    const parking = visitorNeedPlaces(peterboroughPackage, 'parking', 20, { curatedFeatureIds: curation.parking });
    expect(parking.map((place) => place.name)).toEqual([
      'Car Haven Car Park',
      'Riverside Car Park',
      'Bishops Road Car Park',
      'Peterborough Station Car Park',
      'Brook Street Council Car Park',
      'Dickens Street Car Park',
      'Wellington Street Car Park',
      'Trinity Street Car Park',
      'Pleasure Fair Meadow Car Park',
      'Railway Sidings Car Park',
      'Sand Martin House Multi-storey',
      'Regional Pool Car Park',
      'Ferry Meadows Main Car Park',
    ]);
    expect(
      parking.map((place) => parkingPriceStatus(featureById(peterboroughPackage, place.id))),
    ).toEqual(Array.from({ length: 13 }, () => 'paid' as const));
    expect(visitorNeedPlaces(peterboroughPackage, 'toilets', 20, { curatedFeatureIds: curation.toilets }).map((place) => place.name)).toEqual([
      'Peterborough railway station toilets',
      'Car Haven public toilets and Changing Places',
      'Central Park public toilets',
      'Peterborough Town Hall public toilets',
      'Ferry Meadows Visitor Centre toilets and Changing Places',
      'Ferry Meadows public toilets',
    ]);
    expect(
      visitorNeedPlaces(peterboroughPackage, 'picnic', 20, {
        curatedFeatureIds: curation.picnic,
      }).map((place) => place.name),
    ).toEqual([
      'Central Park picnic lawns',
      'Peterborough Embankment picnic area',
      'Pleasure Fair Meadow picnic tables',
      'Railworld Wildlife Haven picnic area',
      'Ferry Meadows lakeside picnic area',
      'Ferry Meadows picnic area',
    ]);
  });
});

function featureById(pkg: typeof peterboroughPackage, id: string) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing feature ${id}`);
  return feature;
}
