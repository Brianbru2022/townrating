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
import { kirknewtonPackage } from './kirknewton';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Kirknewton published package', () => {
  it('publishes the NRS locality-backed Kirknewton package with reviewed non-map evidence', () => {
    expect(kirknewtonPackage.project.id).toBe('kirknewton-scotland');
    expect(kirknewtonPackage.project.region).toBe('West Lothian');
    expect(kirknewtonPackage.project.name).toBe('Kirknewton');
    expect(kirknewtonPackage.project.boundary.properties?.localityName).toBe('Kirknewton');
    expect(kirknewtonPackage.project.boundary.properties?.localityCode).toBe('S52000377');
    expect(touristAppealLabel(kirknewtonPackage.project)).toBe('Kirknewton ⊘');
    expect(kirknewtonPackage.features).toHaveLength(54);
    expect(kirknewtonPackage.validation).toHaveLength(0);

    const listedBuildings = kirknewtonPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(14);
    expect(listedBuildings.every(hasEstablishedDate)).toBe(true);
    expect(listedBuildings.filter(hasHistoricTimelineDate)).toHaveLength(9);

    expect(
      kirknewtonPackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(11);

    const currentPlaces = kirknewtonPackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(21);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    const currentParks = kirknewtonPackage.features.filter((feature) =>
      feature.tags.includes('osm-current-park'),
    );
    expect(currentParks).toHaveLength(1);
    expect(currentParks.every((feature) => feature.reviewed)).toBe(true);

    expect(
      kirknewtonPackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(5);
  });

  it('publishes an honest zero-rated guide with a place-specific visual identity', () => {
    expect(kirknewtonPackage.project.touristAppeal).toMatchObject({
      rating: 0,
      label: 'Not a tourist town',
    });
    expect(kirknewtonPackage.project.visualIdentity).toMatchObject({
      theme: 'quiet-village-and-country-paths',
      heroImage: '/town-guides/kirknewton-main-street-watercolour-guide.png',
      motifs: ['Old kirk', 'Stone cottages', 'Village park', 'Country paths'],
    });
    expect(kirknewtonPackage.project.townGuide).toMatchObject({
      headline: 'An old kirkyard, stone cottages and paths into open country',
      suggestedFirstVisit: { title: 'Old kirk, Main Street and the park' },
    });
    const guideCopy = [
      kirknewtonPackage.project.townGuide?.headline,
      kirknewtonPackage.project.townGuide?.intro,
      kirknewtonPackage.project.townGuide?.visitorMood,
    ].join(' ');
    expect(guideCopy).not.toMatch(/parking|toilets|evidence/i);

    expect(topVisitPlaces(kirknewtonPackage).map((place) => [place.name, place.visitorScore])).toEqual([
      ['Kirknewton Old Parish Church and churchyard', 43],
    ]);
    expect(visitRecommendation(43)?.label).toBe('Point of interest');
  });

  it('ships only the defensible food, trail and practical curation', () => {
    const curation = publishedPlannerCurationForProject(kirknewtonPackage.project.id);
    const names = (ids: string[]) =>
      ids.map((id) => kirknewtonPackage.features.find((feature) => feature.id === id)?.name);

    expect(names(curation.eat ?? [])).toEqual(['Marmaris Inn']);
    expect(
      visitorNeedPlaces(kirknewtonPackage, 'eat', 20, {
        curatedFeatureIds: curation.eat,
      }).map((place) => place.visitorScore),
    ).toEqual([61]);
    expect(foodRecommendation(61)?.label).toBe('Good local option');

    expect(names(curation.trails ?? [])).toEqual(['Kirknewton Pavilion walking routes']);
    expect(trailRecommendation(68)?.label).toBe('Interesting trail');
    expect(names(curation.picnic ?? [])).toEqual(['Kirknewton Park picnic area']);
    expect(names(curation.toilets ?? [])).toEqual([
      'Kirknewton Park Pavilion public toilets',
    ]);
    expect(names(curation.parking ?? [])).toEqual([
      'Kirknewton Park Pavilion car park',
      'Old Kirk and cemetery car park',
    ]);
    expect(
      (curation.parking ?? []).map((id) =>
        parkingPriceStatus(
          kirknewtonPackage.features.find((feature) => feature.id === id)!,
        ),
      ),
    ).toEqual(['free', 'unknown']);
  });

  it('keeps every public visitor marker inside the unchanged NRS locality', () => {
    const studyArea = kirknewtonPackage.project.townStudyArea;
    const curation = publishedPlannerCurationForProject(kirknewtonPackage.project.id);
    expect(studyArea?.localityCode).toBe('S52000377');
    expect(studyArea?.visitorBoundary).toBeUndefined();
    const featureIds = new Set([
      ...(kirknewtonPackage.project.visitorHighlights ?? []).map(
        (highlight) => highlight.featureId,
      ),
      ...Object.values(curation).flat(),
    ]);

    for (const featureId of featureIds) {
      const feature = kirknewtonPackage.features.find((candidate) => candidate.id === featureId);
      expect(feature?.geometry?.type, featureId).toBe('Point');
      if (feature?.geometry?.type !== 'Point' || !studyArea) continue;
      expect(
        booleanPointInPolygon(point(feature.geometry.coordinates), studyArea.localityBoundary),
        featureId,
      ).toBe(true);
    }
  });

  it('excludes duplicate, uncertain and out-of-boundary records', () => {
    for (const id of [
      'osm-community:way-96189975',
      'osm-community:way-389738972',
      'osm-community:way-909351246',
      'osm-community:node-10792942516',
      'osm-community:node-10792942518',
      'osm-community:node-10792942519',
      'osm-community:node-10792942521',
      'osm-community:node-11099992869',
      'osm-community:node-9044936859',
    ]) {
      expect(kirknewtonPackage.features.find((feature) => feature.id === id)?.tags, id).toContain(
        'visitor-audit-excluded',
      );
    }

    const publicNames = [
      ...(kirknewtonPackage.project.visitorHighlights ?? []).map((highlight) => highlight.name),
      ...Object.values(publishedPlannerCurationForProject(kirknewtonPackage.project.id))
        .flat()
        .map((id) => kirknewtonPackage.features.find((feature) => feature.id === id)?.name),
    ];
    expect(publicNames).not.toContain('Potter Around');
    expect(publicNames).not.toContain('Public toilets');
    expect(publicNames).not.toContain('Picnic table');
    expect(publicNames).not.toContain('Parking');
  });
});
