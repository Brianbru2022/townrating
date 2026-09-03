import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import auditJson from '../../data/review/peterborough-region-standalone-attractions-2026-08-08.json';
import { visitPlaceFromFeature } from '../domain/visitorExperience';
import { homePoiOverviews } from '../map/homeOverview';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { oundlePackage } from './oundle';
import { peterboroughPackage } from './peterborough';
import { sawtryPackage } from './sawtry';
import { thrapstonPackage } from './thrapston';

const auditTag = 'peterborough-region-standalone-audit-2026-08-08';
const packages = [peterboroughPackage, oundlePackage, thrapstonPackage, sawtryPackage];

const expectedIds = [
  'standalone-attraction:barnack-hills-and-holes',
  'standalone-attraction:bedford-purlieus',
  'standalone-attraction:sacrewell-farm',
  'standalone-attraction:castor-hanglands',
  'standalone-attraction:crown-lakes-country-park',
  'standalone-attraction:elton-hall',
  'standalone-attraction:fotheringhay-castle-site',
  'standalone-attraction:southwick-hall',
  'standalone-attraction:lyveden-new-bield',
  'standalone-attraction:fermyn-woods-country-park',
  'standalone-attraction:barnwell-country-park',
  'standalone-attraction:holme-fen',
  'standalone-attraction:woodwalton-fen',
  'standalone-attraction:upwood-meadows',
  'standalone-attraction:monks-wood',
  'standalone-attraction:hamerton-zoo-park',
  'standalone-attraction:stanwick-lakes',
  'standalone-attraction:hinchingbrooke-country-park',
];

const expectedTrailIds = [
  'standalone-attraction:barnack-hills-and-holes',
  'standalone-attraction:sacrewell-farm',
  'standalone-attraction:castor-hanglands',
  'standalone-attraction:crown-lakes-country-park',
  'standalone-attraction:elton-hall',
  'standalone-attraction:fotheringhay-castle-site',
  'standalone-attraction:lyveden-new-bield',
  'standalone-attraction:fermyn-woods-country-park',
  'standalone-attraction:barnwell-country-park',
  'standalone-attraction:holme-fen',
  'standalone-attraction:woodwalton-fen',
  'standalone-attraction:hamerton-zoo-park',
  'standalone-attraction:stanwick-lakes',
  'standalone-attraction:hinchingbrooke-country-park',
];

describe('Peterborough-region standalone attractions', () => {
  it('ships all 18 suitable attractions with full editorial guide data', () => {
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

  it('keeps every new point outside its assigned town planner boundary', () => {
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

  it('publishes only researched attraction trails with responsible-source links', () => {
    const features = packages.flatMap((projectPackage) => projectPackage.features);

    for (const featureId of expectedTrailIds) {
      const feature = features.find((candidate) => candidate.id === featureId);
      expect(feature?.attractionGuide?.trails?.length, featureId).toBeGreaterThan(0);
      for (const trail of feature?.attractionGuide?.trails ?? []) {
        expect(trail.name, featureId).toEqual(expect.any(String));
        expect(trail.externalUrl, `${featureId}:${trail.name}`).toMatch(/^https:\/\//);
      }
    }

    for (const feature of features.filter(
      (candidate) => candidate.tags.includes(auditTag) && !expectedTrailIds.includes(candidate.id),
    )) {
      expect(feature.attractionGuide?.trails ?? [], feature.id).toHaveLength(0);
    }
  });

  it('publishes every added place in standalone Home discovery with dog guidance', () => {
    const homePlaces = homePoiOverviews(packages, 'attraction', 50).filter((place) =>
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

  it('records the permit-only Collyweston reserve instead of promoting it', () => {
    expect(auditJson.excluded).toContainEqual(
      expect.objectContaining({
        correctName: 'Collyweston Great Wood and Easton Hornstocks',
        reason: expect.stringMatching(/permit only/i),
      }),
    );
    expect(
      packages.flatMap((projectPackage) => projectPackage.features).some((feature) =>
        /collyweston great wood|easton hornstocks/i.test(feature.name),
      ),
    ).toBe(false);
  });
});
