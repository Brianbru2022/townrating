import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { northamptonPackage } from './northampton';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Northampton published package', () => {
  it('ships source-backed dates for the Historic England heat-map records', () => {
    const nhle = northamptonPackage.features.filter((feature) => feature.tags.includes('nhle'));
    const dated = nhle.filter((feature) => feature.earliestPossibleYear !== undefined);
    expect(nhle).toHaveLength(416);
    expect(dated.length / nhle.length).toBeGreaterThan(0.89);
    expect(
      northamptonPackage.features.find(
        (feature) => feature.id === 'historic-england:nhle:1052417',
      ),
    ).toMatchObject({
      name: 'CHURCH OF ST PETER',
      earliestPossibleYear: 1160,
      latestPossibleYear: 1160,
      documentedDateText: 'circa 1160',
    });
    expect(
      northamptonPackage.features.find(
        (feature) => feature.id === 'historic-england:nhle:1031518',
      ),
    ).toMatchObject({
      earliestPossibleYear: 1980,
      latestPossibleYear: 1982,
      dateBasis: 'documented_date_range',
    });
  });

  it('preserves the official ONS geometry and uses a transparent visitor boundary', () => {
    const studyArea = northamptonPackage.project.townStudyArea;
    expect(studyArea?.localityBoundary.geometry.type).toBe('MultiPolygon');
    if (studyArea?.localityBoundary.geometry.type !== 'MultiPolygon') return;
    expect(studyArea.localityBoundary.geometry.coordinates).toHaveLength(45);
    expect(studyArea.visitorBoundary?.properties).toMatchObject({
      sourceDataset: 'Curated Northampton visitor boundary',
      originalSourceDataset: 'ONS Built-up Areas (December 2024)',
      originalLocalityCode: 'E63010463',
      notAdministrativeBoundary: true,
    });
    expect(northamptonPackage.project.boundary).toEqual(studyArea.visitorBoundary);
  });

  it('includes Northampton visitor green spaces in the active boundary', () => {
    const activeBoundary = northamptonPackage.project.townStudyArea?.visitorBoundary;
    expect(activeBoundary).toBeDefined();
    if (!activeBoundary) return;

    const greenSpaces: Array<[string, [number, number]]> = [
      ['Abington Park', [-0.8478, 52.2428]],
      ['The Racecourse', [-0.8928, 52.2497]],
      ['Delapre Park', [-0.889, 52.2252]],
      ["Becket's Park", [-0.8901, 52.2332]],
      ['Hunsbury Hill Country Park', [-0.9195, 52.2133]],
      ['Kingsthorpe Recreation Ground', [-0.8976, 52.2687]],
    ];

    for (const [name, coordinates] of greenSpaces) {
      expect(booleanPointInPolygon(point(coordinates), activeBoundary), name).toBe(true);
    }
  });

  it('publishes a stronger in-city visitor list rather than generic padding', () => {
    const attractions = topVisitPlaces(northamptonPackage, 20);
    expect(attractions).toHaveLength(20);
    expect(attractions.slice(0, 6).map((place) => place.name)).toEqual([
      '78 Derngate',
      'Delapré Abbey',
      'Northampton Museum and Art Gallery',
      'Abington Park Museum',
      'The Holy Sepulchre Church',
      'Queen Eleanor Cross',
    ]);
    expect(attractions.map((place) => place.name)).toEqual(
      expect.arrayContaining([
        'Hunsbury Hill Country Park',
        'Abington Park',
        'The Racecourse',
        "Becket's Park",
        "Storton's Pits Local Nature Reserve",
        'Berserk',
        'Boost Trampoline Parks',
        'Museum of Leathercraft',
        'Kingsthorpe Meadow Nature Reserve',
      ]),
    );
    expect(attractions.map((place) => place.name)).not.toEqual(
      expect.arrayContaining(['Statue', 'Worship place']),
    );
  });

  it('ships curated daytime food and named picnic locations', () => {
    const curation = publishedPlannerCurationForProject('northampton-england');
    const food = visitorNeedPlaces(northamptonPackage, 'eat', 20, {
      curatedFeatureIds: curation.eat,
    });
    expect(food).toHaveLength(15);
    expect(food.slice(0, 5).map((place) => place.name)).toEqual([
      'The Good Loaf',
      'Saints on St Giles',
      'Matchbox Cafe',
      'The Orangery',
      'The Park Café',
    ]);
    expect(
      visitorNeedPlaces(northamptonPackage, 'picnic', 20, {
        curatedFeatureIds: curation.picnic,
      }).map((place) => place.name),
    ).toEqual([
      "St Crispin's Square picnic tables",
      'Marina Park picnic tables',
      'York Way and Harlestone picnic table',
    ]);
  });

  it('keeps every public town-planner marker inside the active boundary', () => {
    const activeBoundary = northamptonPackage.project.townStudyArea?.visitorBoundary;
    expect(activeBoundary).toBeDefined();
    if (!activeBoundary) return;
    const curation = publishedPlannerCurationForProject('northampton-england');
    const publicIds = new Set([
      ...(northamptonPackage.project.visitorHighlights ?? []).map(
        (highlight) => highlight.featureId,
      ),
      ...Object.values(curation).flat(),
    ]);

    for (const id of publicIds) {
      const feature = northamptonPackage.features.find((candidate) => candidate.id === id);
      expect(feature?.geometry?.type, id).toBe('Point');
      if (feature?.geometry?.type !== 'Point') continue;
      expect(
        booleanPointInPolygon(point(feature.geometry.coordinates), activeBoundary),
        id,
      ).toBe(true);
    }
  });
});
