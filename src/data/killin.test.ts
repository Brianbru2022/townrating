import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import { hasHistoricTimelineDate } from '../domain/timeline';
import { validateFeatures } from '../domain/validation';
import { parkingPriceStatus, visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { killinPackage } from './killin';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Killin published package', () => {
  it('uses the NRS locality and separates statutory, NRHE and present-day sources', () => {
    expect(killinPackage.project.boundary.properties?.localityName).toBe('Killin');
    expect(killinPackage.project.boundary.properties?.localityCode).toBe('S52000349');
    expect(killinPackage.project.region).toBe('Stirling');
    const listed = killinPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listed).toHaveLength(26);
    expect(
      listed.filter((feature) => feature.tags.includes('town-selection-inside-locality')),
    ).toHaveLength(17);
    expect(
      listed.filter((feature) => feature.tags.includes('town-selection-heritage-buffer')),
    ).toHaveLength(9);
    expect(killinPackage.features.filter((feature) => feature.id.startsWith('nrhe:'))).toHaveLength(
      33,
    );
    expect(
      killinPackage.features.filter((feature) => feature.tags.includes('osm-community-place')),
    ).toHaveLength(38);
    expect(killinPackage.features.filter(hasHistoricTimelineDate)).toHaveLength(29);
    expect(
      killinPackage.features.find((feature) => feature.id === 'hes-listed-building:LB8248'),
    ).toMatchObject({
      earliestPossibleYear: 1744,
      reviewed: true,
    });
    expect(killinPackage.historicMaps).toHaveLength(0);
    expect(killinPackage.settlementPolygons).toHaveLength(0);
    expect(validateFeatures(killinPackage.project, killinPackage.features)).not.toContainEqual(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('publishes a place-led guide and rates Killin as worth a planned stop', () => {
    expect(killinPackage.project.touristAppeal).toMatchObject({
      rating: 2,
      label: 'Worth a planned stop',
    });
    expect(killinPackage.project.visualIdentity).toMatchObject({
      theme: 'waterfall-bridge-and-breadalbane',
      badgeImage: '/town-guides/killin-falls-of-dochart-watercolour-guide.png',
      heroImage: '/town-guides/killin-falls-of-dochart-watercolour-guide.png',
    });
    expect(killinPackage.project.townGuide?.headline).toBe(
      'A Highland village shaped by rushing water, old stone and big landscapes',
    );
    expect(killinPackage.project.townGuide?.intro).not.toMatch(/parking|toilet/i);
    expect(killinPackage.project.townGuide?.intro).not.toContain('Moirlanich');
  });

  it('publishes only the strongest in-town attractions with audited scores', () => {
    const attractions = topVisitPlaces(killinPackage, 10);

    expect(attractions.map((place) => place.name)).toEqual([
      'Falls of Dochart and historic bridge',
      'The Old Mill and St Fillan traditions',
      'Killin Outdoor Centre bike, canoe and kayak hire',
      'Finlarig Castle and Breadalbane Mausoleum',
    ]);
    expect(attractions.map((place) => place.visitorScore)).toEqual([89, 78, 70, 67]);
    expect(attractions.map((place) => place.freeAdmission)).toEqual([true, true, false, true]);
    expect(
      killinPackage.features.find(
        (feature) => feature.id === 'osm-community:way-386515817',
      )?.tags,
    ).toContain('visitor-audit-excluded');
  });

  it('keeps every published visitor marker inside the official NRS locality', () => {
    const featuresById = new Map(killinPackage.features.map((feature) => [feature.id, feature]));
    const curation = publishedPlannerCurationForProject('killin-scotland');
    const featureIds = new Set([
      ...(killinPackage.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
      ...Object.values(curation).flat(),
    ]);

    for (const featureId of featureIds) {
      const feature = featuresById.get(featureId);
      expect(feature, featureId).toBeDefined();
      expect(feature?.geometry?.type, featureId).toBe('Point');
      if (feature?.geometry?.type !== 'Point') {
        throw new Error(`${featureId} is not mapped as a point`);
      }
      expect(
        booleanPointInPolygon(point(feature.geometry.coordinates), killinPackage.project.boundary),
        featureId,
      ).toBe(true);
    }
  });

  it('ships the audited food and trail lists with the agreed scoring systems', () => {
    const curation = publishedPlannerCurationForProject('killin-scotland');
    const food = visitorNeedPlaces(killinPackage, 'eat', 20, {
      curatedFeatureIds: curation.eat,
    });
    expect(food.map((place) => place.name)).toEqual([
      'The Courie Inn',
      'Kula Coffee Shop',
      'Killin Hotel Riverview Restaurant',
      'The River Inn',
      'Falls of Dochart Inn and Smokehouse',
      'Secret Pizza',
    ]);
    expect(food.map((place) => place.visitorScore)).toEqual([88, 81, 78, 76, 74, 72]);
    expect(food.filter((place) => place.dogFriendly).map((place) => place.name)).toEqual([
      'The Courie Inn',
      'The River Inn',
      'Falls of Dochart Inn and Smokehouse',
    ]);

    const trails = visitorNeedPlaces(killinPackage, 'trails', 20, {
      curatedFeatureIds: curation.trails,
    });
    expect(trails.map((place) => place.name)).toEqual([
      "Sron A' Chlachain hill walk",
      'Killin Heritage Trail',
      'Killin viaducts and Loch Tay cycle meander',
      'Acharn Forest circuit',
    ]);
    expect(trails.map((place) => place.visitorScore)).toEqual([86, 84, 82, 78]);
  });

  it('ships named practical facilities and excludes customer-only parking', () => {
    const curation = publishedPlannerCurationForProject('killin-scotland');
    const parking = visitorNeedPlaces(killinPackage, 'parking', 10, {
      curatedFeatureIds: curation.parking,
    });
    expect(parking.map((place) => place.name)).toEqual([
      'McLaren Hall and Breadalbane Park car park',
      'Station Road car park',
      'Main Street public parking bays near the Falls',
    ]);
    expect(
      parking.map((place) =>
        parkingPriceStatus(killinPackage.features.find((feature) => feature.id === place.id)!),
      ),
    ).toEqual(['free', 'free', 'free']);
    expect(curation.parking).not.toContain('osm-community:way-172578588');
    expect(curation.parking).not.toContain('osm-community:way-1044483724');

    expect(
      visitorNeedPlaces(killinPackage, 'toilets', 10, {
        curatedFeatureIds: curation.toilets,
      }).map((place) => place.name),
    ).toEqual([
      'Falls of Dochart public toilets, Main Street',
      'Station Road public toilets, Main Street',
      'Killin Library toilets, Main Street',
    ]);
    expect(
      visitorNeedPlaces(killinPackage, 'picnic', 10, {
        curatedFeatureIds: curation.picnic,
      }).map((place) => place.name),
    ).toEqual(['Breadalbane Park picnic tables, Main Street']);
  });
});
