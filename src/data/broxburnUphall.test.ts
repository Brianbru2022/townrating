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
import { broxburnUphallPackage } from './broxburnUphall';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Broxburn and Uphall published package', () => {
  it('publishes the NRS Broxburn locality-backed package with reviewed non-map evidence', () => {
    expect(broxburnUphallPackage.project.id).toBe('broxburn-and-uphall-scotland');
    expect(broxburnUphallPackage.project.region).toBe('West Lothian');
    expect(broxburnUphallPackage.project.name).toBe('Broxburn and Uphall');
    expect(broxburnUphallPackage.project.boundary.properties?.localityName).toBe('Broxburn');
    expect(broxburnUphallPackage.features).toHaveLength(274);
    expect(broxburnUphallPackage.validation).toHaveLength(0);
    expect(broxburnUphallPackage.project.touristAppeal?.rating).toBe(1);
    expect(touristAppealLabel(broxburnUphallPackage.project)).toBe('Broxburn and Uphall ★');
    expect(topVisitPlaces(broxburnUphallPackage).map((place) => place.name)).toEqual([
      'Bridge 19-40 Union Canal boat trips',
      'Broxburn and Uphall Community Museum',
      'Uphall and Broxburn Heritage Art Trail',
    ]);

    const listedBuildings = broxburnUphallPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(22);
    expect(listedBuildings.every(hasEstablishedDate)).toBe(true);
    expect(listedBuildings.filter(hasHistoricTimelineDate)).toHaveLength(16);

    expect(
      broxburnUphallPackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(66);

    const currentPlaces = broxburnUphallPackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(112);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    const currentParks = broxburnUphallPackage.features.filter((feature) =>
      feature.tags.includes('osm-current-park'),
    );
    expect(currentParks).toHaveLength(7);
    expect(currentParks.every((feature) => feature.reviewed)).toBe(true);

    expect(
      broxburnUphallPackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(57);
  });

  it('publishes an honest one-star guide with place-specific canal artwork', () => {
    expect(broxburnUphallPackage.project.touristAppeal).toMatchObject({
      rating: 1,
      label: 'Local detour',
    });
    expect(broxburnUphallPackage.project.visualIdentity).toMatchObject({
      theme: 'union-canal-and-shale-story',
      heroImage: '/town-guides/broxburn-uphall-union-canal-watercolour-guide.png',
      motifs: ['Union Canal', 'Shale heritage', 'Public art', 'Woodland paths'],
    });
    expect(broxburnUphallPackage.project.townGuide).toMatchObject({
      headline: 'Canal boats, shale stories and a trail of public art',
      suggestedFirstVisit: { title: 'Museum, canal and heritage artworks' },
    });
    const guideCopy = [
      broxburnUphallPackage.project.townGuide?.headline,
      broxburnUphallPackage.project.townGuide?.intro,
      broxburnUphallPackage.project.townGuide?.visitorMood,
    ].join(' ');
    expect(guideCopy).not.toMatch(/parking|toilets|evidence/i);

    expect(
      broxburnUphallPackage.project.visitorHighlights?.map((highlight) => [
        highlight.name,
        highlight.visitorScore,
      ]),
    ).toEqual([
      ['Bridge 19-40 Union Canal boat trips', 68],
      ['Broxburn and Uphall Community Museum', 62],
      ['Uphall and Broxburn Heritage Art Trail', 56],
    ]);
    expect(visitRecommendation(68)?.label).toBe('Worth a look');
  });

  it('ships researched food, trail and practical curation without filler', () => {
    const curation = publishedPlannerCurationForProject(broxburnUphallPackage.project.id);
    const names = (ids: string[]) =>
      ids.map((id) => broxburnUphallPackage.features.find((feature) => feature.id === id)?.name);

    expect(names(curation.eat ?? []).slice(0, 6)).toEqual([
      "Giannino's",
      'Oatridge Hotel Restaurant',
      'Aroma Restaurant & Bar',
      'The Dine',
      "Dotty's Sandwich & Coffee Shop",
      'Cafe at Strathbrock',
    ]);
    expect(
      visitorNeedPlaces(broxburnUphallPackage, 'eat', 20, {
        curatedFeatureIds: curation.eat,
      }).slice(0, 6).map((place) => place.visitorScore),
    ).toEqual([82, 78, 77, 76, 72, 66]);
    expect(curation.eat).toHaveLength(6);
    expect(foodRecommendation(82)?.label).toBe('Top food stop');
    expect(foodRecommendation(78)?.label).toBe('Great choice');
    expect(foodRecommendation(66)?.label).toBe('Good local option');

    expect(names(curation.trails ?? [])).toEqual([
      'Uphall and Broxburn Heritage Art Trail',
      'Broxburn Community Woodland paths',
    ]);
    expect(trailRecommendation(79)?.label).toBe('Interesting trail');
    expect(names(curation.parking ?? [])).toEqual([
      'Greendykes Road Car Park',
      'Argyle Court Car Park',
      'Galloway Crescent woodland layby',
    ]);
    expect(names(curation.toilets ?? [])).toEqual([
      'Greendykes Road public toilets',
      'Xcite Broxburn Sports Centre toilets',
      'Strathbrock Partnership Centre toilets',
    ]);
    expect(curation.picnic).toEqual([]);
    expect(
      (curation.parking ?? []).every(
        (id) =>
          parkingPriceStatus(
            broxburnUphallPackage.features.find((feature) => feature.id === id)!,
          ) === 'free',
      ),
    ).toBe(true);
  });

  it('keeps every public visitor marker inside the unchanged NRS locality', () => {
    const studyArea = broxburnUphallPackage.project.townStudyArea;
    const curation = publishedPlannerCurationForProject(broxburnUphallPackage.project.id);
    expect(studyArea?.localityCode).toBe('S52000100');
    expect(studyArea?.visitorBoundary).toBeUndefined();
    const featureIds = new Set([
      ...(broxburnUphallPackage.project.visitorHighlights ?? []).map(
        (highlight) => highlight.featureId,
      ),
      ...Object.values(curation).flat(),
    ]);

    for (const featureId of featureIds) {
      const feature = broxburnUphallPackage.features.find(
        (candidate) => candidate.id === featureId,
      );
      expect(feature?.geometry?.type, featureId).toBe('Point');
      if (feature?.geometry?.type !== 'Point' || !studyArea) continue;
      expect(
        booleanPointInPolygon(point(feature.geometry.coordinates), studyArea.localityBoundary),
        featureId,
      ).toBe(true);
    }
  });

  it('excludes closed, weak and out-of-boundary visitor records', () => {
    for (const id of [
      'osm-community:node-10550596197',
      'osm-community:node-5399030897',
      'osm-community:node-6437939561',
    ]) {
      expect(broxburnUphallPackage.features.find((feature) => feature.id === id)?.tags, id).toContain(
        'visitor-audit-excluded',
      );
    }
    const publicNames = [
      ...(broxburnUphallPackage.project.visitorHighlights ?? []).map(
        (highlight) => highlight.name,
      ),
      ...Object.values(publishedPlannerCurationForProject(broxburnUphallPackage.project.id))
        .flat()
        .map((id) => broxburnUphallPackage.features.find((feature) => feature.id === id)?.name),
    ];
    expect(publicNames).not.toContain('The Bulldog Bistro');
    expect(publicNames).not.toContain('Parking');
    expect(publicNames).not.toContain('Public toilets');
    expect(publicNames).not.toContain('Picnic site');
  });
});
