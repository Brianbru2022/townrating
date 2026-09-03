import { describe, expect, it } from 'vitest';
import auditJson from '../../data/review/bedfordshire-northamptonshire-standalone-attractions-2026-08-09.json';
import { visitPlaceFromFeature } from '../domain/visitorExperience';
import { homePoiOverviews } from '../map/homeOverview';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { highamFerrersPackage } from './highamFerrers';
import { miltonKeynesPackage } from './miltonKeynes';
import { northamptonPackage } from './northampton';
import { olneyPackage } from './olney';
import { wellingboroughPackage } from './wellingborough';

const auditTag = 'bedfordshire-northamptonshire-standalone-audit-2026-08-09';
const packages = [
  highamFerrersPackage,
  wellingboroughPackage,
  northamptonPackage,
  olneyPackage,
  miltonKeynesPackage,
];

const expectedIds = [
  'standalone-attraction:chichele-college',
  'standalone-attraction:irchester-country-park',
  'standalone-attraction:irchester-narrow-gauge-railway-museum',
  'standalone-attraction:santa-pod-raceway',
  'standalone-attraction:sywell-country-park',
  'standalone-attraction:billing-aquadrome',
  'standalone-attraction:brixworth-country-park',
  'standalone-attraction:northampton-and-lamport-railway',
  'standalone-attraction:hunsbury-hill-country-park',
  'standalone-attraction:canal-museum-stoke-bruerne',
  'standalone-attraction:castle-ashby-gardens',
  'standalone-attraction:stoke-park-pavilions',
  'standalone-attraction:emberton-country-park',
  'standalone-attraction:harrold-odell-country-park',
  'standalone-attraction:stevington-windmill',
  'standalone-attraction:stockgrove-rushmere-country-park',
  'standalone-attraction:woburn-safari-park',
];
const reclassifiedTownIds = new Set([
  'standalone-attraction:chichele-college',
  'standalone-attraction:billing-aquadrome',
  'standalone-attraction:hunsbury-hill-country-park',
]);
const expectedStandaloneIds = expectedIds.filter((id) => !reclassifiedTownIds.has(id));

describe('Bedfordshire and Northamptonshire standalone attractions', () => {
  it('ships all 17 public places as full guides and reclassifies places now inside towns', () => {
    const features = packages.flatMap((projectPackage) =>
      projectPackage.features.filter((feature) => feature.tags.includes(auditTag)),
    );

    expect(features.map((feature) => feature.id).sort()).toEqual([...expectedIds].sort());
    for (const feature of features) {
      const place = visitPlaceFromFeature(feature);
      if (reclassifiedTownIds.has(feature.id)) {
        expect(feature.tags).not.toContain('home-standalone-place');
      } else {
        expect(feature.tags).toContain('home-standalone-place');
      }
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

  it('publishes every added place as standalone Home discovery with dog guidance', () => {
    const homePlaces = homePoiOverviews(packages, 'attraction', 100).filter((place) =>
      expectedStandaloneIds.includes(place.featureId),
    );

    expect(homePlaces.map((place) => place.featureId).sort()).toEqual(
      [...expectedStandaloneIds].sort(),
    );
    for (const place of homePlaces) {
      expect(place.discoveryScope, place.featureId).toBe('standalone');
      expect(place.attractionGuide?.heroImage, place.featureId).toBeTruthy();
      expect(
        publishedDogAccessForPlace(place.projectId, 'attraction', place.featureId),
        `${place.projectId}:${place.featureId}`,
      ).toMatchObject({ rating: expect.any(Number), summary: expect.any(String) });
    }
  });

  it('keeps restricted or closed requests out of public discovery', () => {
    const allFeatures = packages.flatMap((projectPackage) => projectPackage.features);

    expect(allFeatures.some((feature) => feature.id === 'standalone-attraction:buckingham-thick-copse')).toBe(false);
    expect(allFeatures.some((feature) => feature.id === 'standalone-attraction:woburn-abbey')).toBe(false);
    expect(auditJson.deferred).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requestedName: 'Buckingham Thick Copse' }),
        expect.objectContaining({ requestedName: 'Woburn Abbey' }),
      ]),
    );
  });

  it('includes researched named trails for the outdoor attractions', () => {
    const trailIds = [
      'standalone-attraction:irchester-country-park',
      'standalone-attraction:sywell-country-park',
      'standalone-attraction:brixworth-country-park',
      'standalone-attraction:northampton-and-lamport-railway',
      'standalone-attraction:emberton-country-park',
      'standalone-attraction:harrold-odell-country-park',
      'standalone-attraction:stockgrove-rushmere-country-park',
      'standalone-attraction:woburn-safari-park',
    ];
    const features = packages.flatMap((projectPackage) => projectPackage.features);

    for (const id of trailIds) {
      const feature = features.find((candidate) => candidate.id === id);
      expect(feature?.attractionGuide?.trails?.length, id).toBeGreaterThan(0);
      expect(feature?.attractionGuide?.trails?.[0]?.externalUrl, id).toMatch(/^https:\/\//);
    }
  });
});
