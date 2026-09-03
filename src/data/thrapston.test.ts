import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import dogCuration from '../../data/dog-access-curation.json';
import plannerCuration from '../../data/visitor-planner-curation.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { thrapstonPackage } from './thrapston';

const projectId = 'thrapston-england';
const planner = plannerCuration.projects[projectId as keyof typeof plannerCuration.projects];
const dog = dogCuration.projects[projectId as keyof typeof dogCuration.projects];

describe('Thrapston published visitor package', () => {
  it('preserves the ONS locality, adds a green-space visitor extent and keeps an honest rating', () => {
    expect(thrapstonPackage.project.touristAppeal).toMatchObject({
      rating: 1,
      label: 'Local detour',
    });
    expect(thrapstonPackage.project.townStudyArea).toMatchObject({
      localityCode: 'E63010130',
      bufferMetres: 0,
    });
    expect(thrapstonPackage.project.boundary).toEqual(
      thrapstonPackage.project.townStudyArea?.visitorBoundary,
    );
    expect(thrapstonPackage.project.boundary).not.toEqual(
      thrapstonPackage.project.townStudyArea?.localityBoundary,
    );
    expect(thrapstonPackage.project.boundary.properties?.sourceDataset).toBe(
      'Curated Thrapston visitor boundary',
    );
    expect(thrapstonPackage.project.researchNotes).toMatch(/Treasure Trails/i);
  });

  it('ships a complete editorial guide and place-specific artwork', () => {
    expect(thrapstonPackage.project.visualIdentity).toMatchObject({
      theme: 'nene-market-town',
      heroImage: '/town-guides/thrapston-river-market-watercolour-guide.png',
    });
    expect(thrapstonPackage.project.townGuide).toMatchObject({
      suggestedTime: 'Two to four hours',
    });
    expect(thrapstonPackage.project.townGuide?.intro).not.toMatch(/parking|toilets|evidence/i);
    expect(thrapstonPackage.project.visitorHighlights).toHaveLength(4);
    for (const highlight of thrapstonPackage.project.visitorHighlights ?? []) {
      expect(highlight.attractionGuide?.thingsToDo).toHaveLength(5);
    }
  });

  it('curates daytime food and all useful practical categories', () => {
    expect(planner.eat).toHaveLength(4);
    expect(planner.trails).toHaveLength(1);
    expect(
      visitorNeedPlaces(thrapstonPackage, 'trails', 20, { curatedFeatureIds: planner.trails }),
    ).toHaveLength(1);
    expect(planner.parking).toHaveLength(2);
    expect(planner.toilets).toEqual(['osm-community:way-697545120']);
    expect(planner.picnic).toHaveLength(1);
    const named = new Map(thrapstonPackage.features.map((feature) => [feature.id, feature.name]));
    expect(planner.parking.map((id) => named.get(id))).toEqual([
      'Chancery Lane Car Park',
      'Sackville Street Car Park',
    ]);
    expect(named.get(planner.toilets[0])).toBe('Sackville Street public toilets');
  });

  it('keeps every public planner point inside and excludes Nine Arches', () => {
    const publicPoints = thrapstonPackage.features.filter(
      (feature) =>
        feature.tags.some((tag) => tag.startsWith('service-context-')) &&
        !feature.tags.includes('home-standalone-place'),
    );
    expect(
      publicPoints.every(
        (feature) =>
          feature.geometry?.type === 'Point' &&
          booleanPointInPolygon(point(feature.geometry.coordinates), thrapstonPackage.project.boundary),
      ),
    ).toBe(true);
    expect(thrapstonPackage.features.some((feature) => /Nine Arches/i.test(feature.name))).toBe(false);
  });

  it('bundles dog-access decisions for every attraction and food stop', () => {
    expect(
      thrapstonPackage.project.visitorHighlights?.every(
        (highlight) => dog.attraction[highlight.featureId as keyof typeof dog.attraction],
      ),
    ).toBe(true);
    expect(Object.keys(dog.eat)).toHaveLength(4);
  });

  it('ships dated Historic England records for the heat map', () => {
    const nhle = thrapstonPackage.features.filter((feature) => feature.tags.includes('nhle'));
    const dated = nhle.filter(
      (feature) =>
        feature.earliestPossibleYear !== undefined || feature.latestPossibleYear !== undefined,
    );
    expect(nhle).toHaveLength(31);
    expect(dated).toHaveLength(31);
  });
});
