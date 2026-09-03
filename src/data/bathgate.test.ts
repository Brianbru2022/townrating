import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import { hasEstablishedDate, hasHistoricTimelineDate } from '../domain/timeline';
import { touristAppealLabel } from '../domain/tourism';
import {
  foodRecommendation,
  topVisitPlaces,
  trailRecommendation,
  visitRecommendation,
} from '../domain/visiting';
import { parkingPriceStatus, visitorNeedPlaces } from '../domain/visitorExperience';
import { bathgatePackage } from './bathgate';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Bathgate published package', () => {
  it('publishes the NRS locality-backed Bathgate package with reviewed non-map evidence', () => {
    expect(bathgatePackage.project.id).toBe('bathgate-scotland');
    expect(bathgatePackage.project.region).toBe('West Lothian');
    expect(bathgatePackage.features).toHaveLength(345);
    expect(bathgatePackage.validation).toHaveLength(0);
    expect(bathgatePackage.project.touristAppeal?.rating).toBe(1);
    expect(touristAppealLabel(bathgatePackage.project)).toBe('Bathgate ★');
    expect(topVisitPlaces(bathgatePackage).map((place) => place.name)).toEqual([
      'Bennie Museum',
      'Reconnect Regal Theatre',
      'Bathgate Old Parish Kirk',
    ]);

    const listedBuildings = bathgatePackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(11);
    expect(listedBuildings.every(hasEstablishedDate)).toBe(true);
    expect(listedBuildings.every(hasHistoricTimelineDate)).toBe(true);

    expect(
      bathgatePackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(52);

    const currentPlaces = bathgatePackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(202);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    const currentParks = bathgatePackage.features.filter((feature) =>
      feature.tags.includes('osm-current-park'),
    );
    expect(currentParks).toHaveLength(4);
    expect(currentParks.every((feature) => feature.reviewed)).toBe(true);

    expect(
      bathgatePackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(71);
  });

  it('publishes an honest one-star destination guide with distinctive artwork', () => {
    expect(bathgatePackage.project.touristAppeal).toMatchObject({
      rating: 1,
      label: 'Local detour',
    });
    expect(bathgatePackage.project.visualIdentity).toMatchObject({
      theme: 'weavers-cottages-and-art-deco',
      heroImage: '/town-guides/bathgate-weavers-watercolour-guide.png',
      motifs: ["Weavers' cottages", 'Town trail', 'Art Deco theatre', 'Industrial story'],
    });
    expect(bathgatePackage.project.townGuide).toMatchObject({
      headline: "Weavers' cottages, an Art Deco theatre and a town shaped by industry",
      suggestedFirstVisit: { title: 'Museum, plaques and the Regal' },
    });
    const guideCopy = [
      bathgatePackage.project.townGuide?.headline,
      bathgatePackage.project.townGuide?.intro,
      bathgatePackage.project.townGuide?.visitorMood,
    ].join(' ');
    expect(guideCopy).not.toMatch(/parking|toilets|evidence/i);

    expect(
      bathgatePackage.project.visitorHighlights?.map((highlight) => [
        highlight.name,
        highlight.visitorScore,
      ]),
    ).toEqual([
      ['Bennie Museum', 66],
      ['Reconnect Regal Theatre', 60],
      ['Bathgate Old Parish Kirk', 47],
    ]);
    expect(visitRecommendation(66)?.label).toBe('Worth a look');
    expect(visitRecommendation(47)?.label).toBe('Worth a look');
  });

  it('ships a researched trail, food list and named practical facilities', () => {
    const curation = publishedPlannerCurationForProject(bathgatePackage.project.id);
    const names = (ids: string[]) =>
      ids.map((id) => bathgatePackage.features.find((feature) => feature.id === id)?.name);

    expect(names(curation.eat ?? []).slice(0, 6)).toEqual([
      'Dnisi Bathgate',
      'CafeBar 1912',
      'Vim & Vigour',
      'El Toro Gaucho',
      'Neelam',
      'The Coffee Club',
    ]);
    expect(
      visitorNeedPlaces(bathgatePackage, 'eat', 20, {
        curatedFeatureIds: curation.eat,
      }).slice(0, 6).map((place) => place.visitorScore),
    ).toEqual([81, 79, 78, 76, 73, 66]);
    expect(curation.eat).toHaveLength(6);
    expect(foodRecommendation(81)?.label).toBe('Top food stop');
    expect(foodRecommendation(79)?.label).toBe('Great choice');
    expect(foodRecommendation(66)?.label).toBe('Good local option');

    expect(names(curation.trails ?? [])).toEqual([
      'Bathgate History Trail',
      'Bathgate Town and Park of Peace Treasure Trail',
    ]);
    expect(trailRecommendation(79)?.label).toBe('Interesting trail');
    expect(names(curation.parking ?? [])).toEqual([
      'Acredale Car Park',
      'Gardners Lane Car Park',
      'Gideon Street Car Park',
      'Hopetoun Street Car Park',
    ]);
    expect(names(curation.toilets ?? [])).toEqual([
      'Engine Lane public toilets - Acredale Car Park',
      'Jim Walker Partnership Centre toilets',
      'King Street public toilets - near Bathgate Station',
    ]);
    expect(curation.picnic).toEqual([]);
    expect(
      (curation.parking ?? []).every(
        (id) =>
          parkingPriceStatus(bathgatePackage.features.find((feature) => feature.id === id)!) ===
          'free',
      ),
    ).toBe(true);
  });

  it('keeps every public visitor marker inside the unchanged NRS locality', () => {
    const studyArea = bathgatePackage.project.townStudyArea;
    const curation = publishedPlannerCurationForProject(bathgatePackage.project.id);
    expect(studyArea?.localityCode).toBe('S52000060');
    expect(studyArea?.visitorBoundary).toBeUndefined();
    const featureIds = new Set([
      ...(bathgatePackage.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
      ...Object.values(curation).flat(),
    ]);

    for (const featureId of featureIds) {
      const feature = bathgatePackage.features.find((candidate) => candidate.id === featureId);
      expect(feature?.geometry?.type, featureId).toBe('Point');
      if (feature?.geometry?.type !== 'Point' || !studyArea) continue;
      expect(
        booleanPointInPolygon(point(feature.geometry.coordinates), studyArea.localityBoundary),
        featureId,
      ).toBe(true);
    }
  });

  it('does not pad the attraction or practical lists with weak and generic records', () => {
    for (const id of ['visitor-context:kirkton-park', 'visitor-context:bathgate-golf-club']) {
      expect(bathgatePackage.features.find((feature) => feature.id === id)?.tags, id).toContain(
        'visitor-audit-excluded',
      );
    }
    const publicNames = [
      ...(bathgatePackage.project.visitorHighlights ?? []).map((highlight) => highlight.name),
      ...Object.values(publishedPlannerCurationForProject(bathgatePackage.project.id))
        .flat()
        .map((id) => bathgatePackage.features.find((feature) => feature.id === id)?.name),
    ];
    expect(publicNames).not.toContain('Kirkton Park');
    expect(publicNames).not.toContain('Bathgate Golf Club');
    expect(publicNames).not.toContain('Parking');
    expect(publicNames).not.toContain('Public toilets');
    expect(publicNames).not.toContain('Picnic site');
  });
});
