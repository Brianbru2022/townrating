import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import { hasHistoricTimelineDate } from '../domain/timeline';
import { validateFeatures } from '../domain/validation';
import { foodRecommendation, trailRecommendation, visitRecommendation } from '../domain/visiting';
import { parkingPriceStatus, visitorNeedPlaces } from '../domain/visitorExperience';
import { biggarPackage } from './biggar';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Biggar published package', () => {
  it('uses the NRS locality and keeps official and current-place sources distinct', () => {
    expect(biggarPackage.project.boundary.properties?.localityName).toBe('Biggar');
    expect(biggarPackage.project.boundary.properties?.localityCode).toBe('S52000066');
    expect(biggarPackage.project.region).toBe('South Lanarkshire');
    const listedBuildings = biggarPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(108);
    expect(
      listedBuildings.filter((feature) => feature.tags.includes('town-selection-inside-locality')),
    ).toHaveLength(100);
    expect(
      listedBuildings.filter((feature) => feature.tags.includes('town-selection-heritage-buffer')),
    ).toHaveLength(8);
    expect(
      new Set(
        listedBuildings.flatMap((feature) =>
          feature.sourceRecords
            .map((source) => source.sourceRecordId)
            .filter((sourceId): sourceId is string => /^LB\d+$/i.test(sourceId ?? '')),
        ),
      ).size,
    ).toBe(108);
    expect(biggarPackage.features.filter((feature) => feature.id.startsWith('nrhe:'))).toHaveLength(
      162,
    );
    expect(
      biggarPackage.features.filter((feature) => feature.tags.includes('osm-community-place')),
    ).toHaveLength(68);
    expect(
      biggarPackage.features.find((feature) => feature.id === 'hes-conservation-area:CA391'),
    ).toBeDefined();
    expect(
      biggarPackage.features.find((feature) => feature.id === 'hes-scheduled-monument:SM2643'),
    ).toBeDefined();
    expect(biggarPackage.features.filter(hasHistoricTimelineDate)).toHaveLength(210);
    expect(
      biggarPackage.features.find((feature) => feature.id === 'hes-listed-building:LB22172'),
    ).toMatchObject({
      featureType: 'factory',
      earliestPossibleYear: 1839,
      latestPossibleYear: 1839,
      reviewed: true,
    });
    expect(biggarPackage.features.find((feature) => feature.id === 'nrhe:199159')?.tags).toContain(
      'community-memorial',
    );
    expect(biggarPackage.features.find((feature) => feature.id === 'nrhe:296342')?.tags).toContain(
      'community-memorial',
    );
    expect(biggarPackage.settlementPolygons).toHaveLength(0);
    expect(validateFeatures(biggarPackage.project, biggarPackage.features)).not.toContainEqual(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('publishes a selective local-detour Biggar visitor guide', () => {
    expect(biggarPackage.project.touristAppeal).toMatchObject({
      rating: 1,
      label: 'Local detour',
    });
    expect(biggarPackage.project.visualIdentity).toMatchObject({
      theme: 'market-town-museums-and-puppetry',
      heroImage: '/town-guides/biggar-high-street-watercolour-guide.png',
      motifs: ['Market street', 'Industrial heritage', 'Puppet theatre', 'Border hills'],
    });
    expect(biggarPackage.project.townGuide).toMatchObject({
      headline: 'Three unusual museums in a handsome Borders market town',
      suggestedFirstVisit: {
        title: 'Museum, High Street and the gasworks',
      },
    });
    const guideCopy = [
      biggarPackage.project.townGuide?.headline,
      biggarPackage.project.townGuide?.intro,
      biggarPackage.project.townGuide?.visitorMood,
    ].join(' ');
    expect(guideCopy).not.toMatch(/parking|toilets|evidence/i);

    expect(
      biggarPackage.project.visitorHighlights?.map((highlight) => [
        highlight.name,
        highlight.visitorScore,
      ]),
    ).toEqual([
      ['Biggar and Upper Clydesdale Museum', 82],
      ['Biggar Puppet Theatre', 80],
      ['Biggar Gasworks Museum', 78],
      ['Biggar Kirk', 58],
      ['Biggar Motte', 43],
    ]);
    expect(visitRecommendation(82)?.label).toBe('Recommended');
    expect(visitRecommendation(58)?.label).toBe('Worth a look');
    expect(visitRecommendation(43)?.label).toBe('Point of interest');
  });

  it('ships researched food, trail and named practical lists', () => {
    const curation = publishedPlannerCurationForProject(biggarPackage.project.id);
    const names = (ids: string[]) =>
      ids.map((id) => biggarPackage.features.find((feature) => feature.id === id)?.name);

    expect(names(curation.eat ?? []).slice(0, 8)).toEqual([
      'The Barony Restaurant',
      'The Crown Inn',
      'The Olive Tree Deli',
      'Gillespie Centre Cafe',
      'Aroma Cafe',
      'The Elphinstone Hotel',
      'The Coffee Spot',
      'Townhead Fish & Chips',
    ]);
    expect(
      visitorNeedPlaces(biggarPackage, 'eat', 20, {
        curatedFeatureIds: curation.eat,
      }).slice(0, 8).map((place) => place.visitorScore),
    ).toEqual([82, 80, 78, 76, 74, 73, 70, 64]);
    expect(curation.eat).toHaveLength(8);
    expect(foodRecommendation(82)?.label).toBe('Top food stop');
    expect(foodRecommendation(78)?.label).toBe('Great choice');
    expect(foodRecommendation(64)?.label).toBe('Good local option');

    expect(names(curation.trails ?? [])).toEqual([
      'Biggar Town Trail',
      'Bizzyberry Path',
      'Biggar Puppet Theatre and Square Treasure Trail',
    ]);
    expect(trailRecommendation(84)?.label).toBe('Recommended');
    expect(trailRecommendation(74)?.label).toBe('Interesting trail');
    expect(names(curation.parking ?? [])).toEqual([
      'High Street car park',
      'Kirkstyle car park',
      'Market Road car park',
    ]);
    expect(names(curation.toilets ?? [])).toEqual(['Biggar Community Toilets, High Street']);
    expect(names(curation.picnic ?? [])).toEqual([
      'Burnbraes Park picnic area, Biggar Mill Road',
    ]);
    expect(
      (curation.parking ?? []).every((id) =>
        parkingPriceStatus(biggarPackage.features.find((feature) => feature.id === id)!) ===
        'free',
      ),
    ).toBe(true);
  });

  it('keeps every public recommendation inside the unchanged NRS locality', () => {
    const studyArea = biggarPackage.project.townStudyArea;
    const curation = publishedPlannerCurationForProject(biggarPackage.project.id);
    expect(studyArea?.localityCode).toBe('S52000066');
    expect(studyArea?.visitorBoundary).toBeUndefined();
    const featureIds = new Set([
      ...(biggarPackage.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
      ...Object.values(curation).flat(),
    ]);

    for (const featureId of featureIds) {
      const feature = biggarPackage.features.find((candidate) => candidate.id === featureId);
      expect(feature?.geometry?.type, featureId).toBe('Point');
      if (feature?.geometry?.type !== 'Point' || !studyArea) continue;
      expect(
        booleanPointInPolygon(point(feature.geometry.coordinates), studyArea.localityBoundary),
        featureId,
      ).toBe(true);
    }
  });

  it('excludes the out-of-boundary public park and generic practical pins', () => {
    for (const id of [
      'osm-community:way-785402367',
      'osm-community:way-785402369',
      'osm-community:node-11149711532',
    ]) {
      expect(biggarPackage.features.find((feature) => feature.id === id)?.tags, id).toContain(
        'visitor-audit-excluded',
      );
    }
    const publicNames = [
      ...(biggarPackage.project.visitorHighlights ?? []).map((highlight) => highlight.name),
      ...Object.values(publishedPlannerCurationForProject(biggarPackage.project.id))
        .flat()
        .map((id) => biggarPackage.features.find((feature) => feature.id === id)?.name),
    ];
    expect(publicNames).not.toContain('Biggar Public Park');
    expect(publicNames).not.toContain('Albion Museum');
    expect(publicNames).not.toContain('Parking');
    expect(publicNames).not.toContain('Public toilets');
    expect(publicNames).not.toContain('Picnic site');
  });
});
