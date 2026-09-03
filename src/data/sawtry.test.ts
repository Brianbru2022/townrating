import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import dogCuration from '../../data/dog-access-curation.json';
import plannerCuration from '../../data/visitor-planner-curation.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { sawtryPackage } from './sawtry';

const projectId = 'sawtry-england';
const planner = plannerCuration.projects[projectId as keyof typeof plannerCuration.projects];
const dog = dogCuration.projects[projectId as keyof typeof dogCuration.projects];

describe('Sawtry published visitor package', () => {
  it('preserves the ONS locality and uses a narrow documented visitor extension', () => {
    expect(sawtryPackage.project.touristAppeal).toMatchObject({
      rating: 0,
      label: 'Not a tourist town',
    });
    expect(sawtryPackage.project.townStudyArea).toMatchObject({
      localityCode: 'E63010066',
      bufferMetres: 0,
    });
    expect(sawtryPackage.project.boundary.properties?.sourceDataset).toBe(
      'Curated Sawtry visitor boundary',
    );
    expect(sawtryPackage.project.townStudyArea?.localityBoundary).not.toEqual(
      sawtryPackage.project.boundary,
    );
  });

  it('includes St Judith’s Field but not the out-of-boundary moat or nearby woods', () => {
    const visitorBoundary = sawtryPackage.project.townStudyArea?.visitorBoundary;
    const localityBoundary = sawtryPackage.project.townStudyArea?.localityBoundary;
    expect(visitorBoundary).toBeDefined();
    expect(localityBoundary).toBeDefined();
    expect(booleanPointInPolygon(point([-0.282666, 52.431322]), visitorBoundary!)).toBe(true);
    expect(booleanPointInPolygon(point([-0.282666, 52.431322]), localityBoundary!)).toBe(false);
    expect(booleanPointInPolygon(point([-0.275259, 52.440914]), visitorBoundary!)).toBe(false);
    expect(sawtryPackage.features.some((feature) => /moat|abbey|Aversley|Archers/i.test(feature.name))).toBe(false);
  });

  it('ships honest guide copy, illustration and attraction guides', () => {
    expect(sawtryPackage.project.visualIdentity).toMatchObject({
      theme: 'fenland-village-history',
      heroImage: '/town-guides/sawtry-all-saints-watercolour-guide.png',
    });
    expect(sawtryPackage.project.townGuide?.intro).not.toMatch(/parking|toilets|evidence/i);
    expect(sawtryPackage.project.visitorHighlights).toHaveLength(3);
    for (const highlight of sawtryPackage.project.visitorHighlights ?? []) {
      expect(highlight.attractionGuide?.thingsToDo).toHaveLength(5);
    }
  });

  it('keeps the limited planner accurate rather than padding it', () => {
    expect(planner.eat).toHaveLength(2);
    expect(planner.trails).toHaveLength(1);
    expect(
      visitorNeedPlaces(sawtryPackage, 'trails', 20, { curatedFeatureIds: planner.trails }),
    ).toHaveLength(1);
    expect(planner.parking).toHaveLength(1);
    expect(planner.toilets).toHaveLength(0);
    expect(planner.picnic).toHaveLength(1);
    const named = new Map(sawtryPackage.features.map((feature) => [feature.id, feature.name]));
    expect(named.get(planner.parking[0])).toBe('St Judith’s Field public car park');
  });

  it('keeps every public planner point inside the active visitor boundary', () => {
    const publicPoints = sawtryPackage.features.filter(
      (feature) =>
        feature.tags.some((tag) => tag.startsWith('service-context-')) &&
        !feature.tags.includes('home-standalone-place'),
    );
    expect(
      publicPoints.every(
        (feature) =>
          feature.geometry?.type === 'Point' &&
          booleanPointInPolygon(point(feature.geometry.coordinates), sawtryPackage.project.boundary),
      ),
    ).toBe(true);
    expect(
      sawtryPackage.project.visitorHighlights?.every(
        (highlight) => dog.attraction[highlight.featureId as keyof typeof dog.attraction],
      ),
    ).toBe(true);
    expect(Object.keys(dog.eat)).toHaveLength(2);
  });

  it('ships every defensible Historic England date for the heat map', () => {
    const nhle = sawtryPackage.features.filter((feature) => feature.tags.includes('nhle'));
    const dated = nhle.filter(
      (feature) =>
        feature.earliestPossibleYear !== undefined || feature.latestPossibleYear !== undefined,
    );
    expect(nhle).toHaveLength(13);
    expect(dated).toHaveLength(12);
  });
});
