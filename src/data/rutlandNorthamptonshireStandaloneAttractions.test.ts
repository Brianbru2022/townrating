import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import auditJson from '../../data/review/rutland-northamptonshire-standalone-attractions-2026-08-09.json';
import { visitPlaceFromFeature } from '../domain/visitorExperience';
import { homePoiOverviews } from '../map/homeOverview';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { corbyPackage } from './corby';
import { ketteringPackage } from './kettering';
import { oakhamPackage } from './oakham';
import { thrapstonPackage } from './thrapston';
import { uppinghamPackage } from './uppingham';

const auditTag = 'rutland-northamptonshire-standalone-audit-2026-08-09';
const packages = [oakhamPackage, uppinghamPackage, corbyPackage, ketteringPackage];

const expectedIds = [
  'standalone-attraction:burrough-hill-country-park',
  'standalone-attraction:barnsdale-gardens',
  'standalone-attraction:rutland-wildlife-sanctuary',
  'standalone-attraction:rutland-water',
  'standalone-attraction:lyddington-bede-house',
  'standalone-attraction:deene-park',
  'standalone-attraction:kirby-hall',
  'standalone-attraction:rockingham-castle',
  'standalone-attraction:east-carlton-country-park',
  'standalone-attraction:boughton-house',
  'standalone-attraction:geddington-eleanor-cross',
  'standalone-attraction:rushton-triangular-lodge',
  'standalone-attraction:cottesbrooke-hall-and-gardens',
  'standalone-attraction:lamport-hall',
];

describe('Rutland and Northamptonshire standalone attractions', () => {
  it('ships all 14 new places as full Home-only attraction guides', () => {
    const features = packages.flatMap((projectPackage) =>
      projectPackage.features.filter((feature) => feature.tags.includes(auditTag)),
    );

    expect(features.map((feature) => feature.id).sort()).toEqual([...expectedIds].sort());
    for (const feature of features) {
      const place = visitPlaceFromFeature(feature);
      expect(feature.tags).toContain('home-standalone-place');
      expect(feature.evidenceScope).toBe('related_context');
      expect(feature.homeMapEligible).toBe(true);
      expect(place.visitorScore, feature.id).toBeGreaterThanOrEqual(75);
      expect(place.openingTimes, feature.id).toEqual(expect.any(String));
      expect(place.admission, feature.id).toEqual(expect.any(String));
      expect(feature.attractionGuide, feature.id).toMatchObject({
        heroImage: expect.stringMatching(/^\/attraction-guides\/.+\.png$/),
        heroAlt: expect.any(String),
        headline: expect.any(String),
        intro: expect.any(String),
        toilets: expect.any(String),
        picnic: expect.any(String),
        motifs: expect.arrayContaining([expect.any(String)]),
        bestFor: expect.arrayContaining([expect.any(String)]),
      });
      expect(feature.attractionGuide?.thingsToDo?.length, feature.id).toBeGreaterThanOrEqual(3);
      expect(feature.attractionGuide?.thingsToDo?.length, feature.id).toBeLessThanOrEqual(5);
    }
  });

  it('keeps each new attraction outside its host town planner boundary', () => {
    for (const projectPackage of packages) {
      const boundary =
        projectPackage.project.townStudyArea?.visitorBoundary ?? projectPackage.project.boundary;
      for (const feature of projectPackage.features.filter((candidate) =>
        candidate.tags.includes(auditTag),
      )) {
        expect(feature.geometry?.type, feature.id).toBe('Point');
        if (feature.geometry?.type !== 'Point') continue;
        expect(
          booleanPointInPolygon(point(feature.geometry.coordinates), boundary),
          `${projectPackage.project.id}:${feature.id}`,
        ).toBe(false);
      }
    }
  });

  it('publishes every new place on Home with a score, guide and dog-access record', () => {
    const homePlaces = homePoiOverviews(packages, 'attraction', 100).filter((place) =>
      expectedIds.includes(place.featureId),
    );

    expect(homePlaces.map((place) => place.featureId).sort()).toEqual([...expectedIds].sort());
    for (const place of homePlaces) {
      expect(place.discoveryScope, place.featureId).toBe('standalone');
      expect(place.attractionGuide?.heroImage, place.featureId).toBeTruthy();
      expect(
        publishedDogAccessForPlace(place.projectId, 'attraction', place.featureId),
        `${place.projectId}:${place.featureId}`,
      ).toMatchObject({ rating: expect.any(Number), summary: expect.any(String) });
    }
  });

  it('records duplicate, corrected and already-present requests without duplicating Fermyn Woods', () => {
    expect(auditJson.duplicates).toContainEqual(
      expect.objectContaining({ requestedName: 'East Carlton Country Park', addedOnce: true }),
    );
    expect(auditJson.corrections).toMatchObject({
      'Bede House': 'Lyddington Bede House',
      'Kirkby Hall': 'Kirby Hall',
      'Broughton House': 'Boughton House',
      'Eleanor Cross': 'Geddington Eleanor Cross',
    });
    expect(auditJson.alreadyPresent).toContainEqual(
      expect.objectContaining({ id: 'standalone-attraction:fermyn-woods-country-park' }),
    );
    expect(
      thrapstonPackage.features.filter(
        (feature) => feature.id === 'standalone-attraction:fermyn-woods-country-park',
      ),
    ).toHaveLength(1);
  });
});
