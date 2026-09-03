import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import { foodRecommendation, trailRecommendation, visitRecommendation } from '../domain/visiting';
import { culrossPackage } from './culross';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Culross published package', () => {
  it('preserves the combined NRS locality but publishes a compact Culross visitor boundary', () => {
    const studyArea = culrossPackage.project.townStudyArea;
    expect(studyArea?.localityCode).toBe('S52000313');
    expect(studyArea?.localityBoundary.properties).toMatchObject({
      name: 'High Valleyfield, Low Valleyfield and Culross',
    });
    expect(studyArea?.visitorBoundary?.properties).toMatchObject({
      sourceDataset: 'Curated Culross visitor boundary',
      originalSourceDataset: studyArea?.sourceName,
    });
    expect(
      booleanPointInPolygon(point([-3.629, 56.0558]), studyArea!.visitorBoundary!),
    ).toBe(true);
    expect(
      booleanPointInPolygon(point([-3.64016, 56.06025]), studyArea!.visitorBoundary!),
    ).toBe(true);
    expect(
      booleanPointInPolygon(point([-3.601, 56.061]), studyArea!.visitorBoundary!),
    ).toBe(false);
  });

  it('publishes a visitor-first five-place attraction list', () => {
    expect(
      culrossPackage.project.visitorHighlights?.map((highlight) => [
        highlight.name,
        highlight.visitorScore,
      ]),
    ).toEqual([
      ['Royal Burgh of Culross townscape', 88],
      ['Culross Palace and garden', 86],
      ['Culross Abbey ruins and churchyard', 76],
      ['Culross Pottery and Gallery', 58],
      ['Culross harbour, community pier and West Green', 57],
    ]);
    expect(visitRecommendation(88)?.label).toBe('Highly recommended');
    expect(visitRecommendation(76)?.label).toBe('Recommended');
    expect(visitRecommendation(58)?.label).toBe('Worth a look');
    expect(
      culrossPackage.project.visitorHighlights?.find(
        (highlight) => highlight.name === 'Culross Palace and garden',
      )?.organisationPills,
    ).toEqual(['NTS']);
  });

  it('ships complete curated planner categories in deliberate order', () => {
    const curation = publishedPlannerCurationForProject(culrossPackage.project.id);
    const eat = curation.eat ?? [];
    const trails = curation.trails ?? [];
    expect(eat).toHaveLength(6);
    expect(
      eat.map(
        (id) => culrossPackage.features.find((feature) => feature.id === id)?.name,
      ),
    ).toEqual([
      'The Mercat',
      'Cobbled Lane',
      'Red Lion Inn',
      "Bessie's Cafe",
      'Tealeaf at Kirkbrae House',
      'Stickman Tacos at The Stables',
    ]);
    expect(trails).toHaveLength(5);
    expect(
      trails.map(
        (id) => culrossPackage.features.find((feature) => feature.id === id)?.name,
      ),
    ).toEqual([
      'Royal Burgh of Culross townscape',
      'Culross Centre, Abbey and Palace Treasure Trail',
      'Fife Coastal Path from Culross',
      'Fife Pilgrim Way from Culross',
      'West Kirk and Plague Grave walk',
    ]);
    expect(curation.parking).toEqual([
      'osm-community:way-89947778',
      'osm-community:way-89947779',
    ]);
    expect(curation.toilets).toEqual([
      'osm-community:way-876320125',
      'osm-community:node-4995290458',
    ]);
    expect(curation.picnic).toEqual([
      'curated-picnic:culross-low-causeway-seafront',
    ]);
  });

  it('uses category-specific scores and current visitor metadata', () => {
    expect(foodRecommendation(83)?.label).toBe('Top food stop');
    expect(foodRecommendation(76)?.label).toBe('Great choice');
    expect(foodRecommendation(68)?.label).toBe('Good local option');
    expect(trailRecommendation(88)?.label).toBe('Recommended');
    expect(trailRecommendation(78)?.label).toBe('Interesting trail');

    const treasureTrail = culrossPackage.features.find(
      (feature) => feature.id === 'curated-trail:culross-centre-abbey-palace-treasure-trail',
    );
    expect(
      treasureTrail?.sourceRecords.some(
        (source) =>
          source.notes?.includes('visit_score=88') &&
          source.notes.includes('distance=1.5 miles circular') &&
          source.notes.includes('dog_friendly=yes') &&
          source.notes.includes('Not suitable for wheelchairs or pushchairs'),
      ),
    ).toBe(true);

    const bessies = culrossPackage.features.find(
      (feature) => feature.id === 'osm-community:node-4995290461',
    );
    expect(bessies?.sourceRecords.some((source) => source.notes?.includes('dog_friendly=yes'))).toBe(
      true,
    );
    const palace = culrossPackage.features.find((feature) => feature.id === 'nrhe:48021');
    expect(
      palace?.sourceRecords.some(
        (source) =>
          source.notes?.includes('time_to_spend=75-120 minutes') &&
          source.notes.includes('Adult £14'),
      ),
    ).toBe(true);
  });

  it('publishes only named, defensible practical places', () => {
    const curation = publishedPlannerCurationForProject(culrossPackage.project.id);
    const practical = [
      ...(curation.parking ?? []),
      ...(curation.toilets ?? []),
      ...(curation.picnic ?? []),
    ].map(
      (id) => culrossPackage.features.find((feature) => feature.id === id),
    );
    expect(practical.map((feature) => feature?.name)).toEqual([
      'Balgownie West Car Park',
      'East Low Causeway Car Park',
      'Lower Causeway public toilets',
      "Bessie's Bar Steps public toilets",
      'Low Causeway seafront picnic area',
    ]);
    expect(practical.every((feature) => feature?.name !== 'Public toilets')).toBe(true);
    expect(practical.every((feature) => feature?.name !== 'Picnic table')).toBe(true);

    const westParking = practical[0];
    expect(
      westParking?.sourceRecords.some((source) => source.notes?.includes('price_display=Free')),
    ).toBe(true);
    const toilets = practical[2];
    expect(
      toilets?.sourceRecords.some(
        (source) =>
          source.notes?.includes('price_display=30p') &&
          source.notes.includes('09:00-17:00'),
      ),
    ).toBe(true);
  });

  it('keeps every public planner point inside the active visitor and parish boundaries', () => {
    const curation = publishedPlannerCurationForProject(culrossPackage.project.id);
    const visitorBoundary = culrossPackage.project.townStudyArea?.visitorBoundary;
    expect(visitorBoundary).toBeDefined();
    const ids = [
      ...(culrossPackage.project.visitorHighlights ?? []).map(
        (highlight) => highlight.featureId,
      ),
      ...Object.values(curation).flat(),
    ];
    for (const id of new Set(ids)) {
      const feature = culrossPackage.features.find((candidate) => candidate.id === id);
      const coordinates =
        feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : undefined;
      expect(coordinates, id).toBeDefined();
      expect(booleanPointInPolygon(point(coordinates!), visitorBoundary!), id).toBe(true);
      expect(booleanPointInPolygon(point(coordinates!), culrossPackage.project.boundary), id).toBe(
        true,
      );
    }
  });

  it('uses a place-specific guide identity without practical-first copy', () => {
    expect(culrossPackage.project.touristAppeal).toMatchObject({
      rating: 2,
      label: 'Worth a planned stop',
    });
    expect(culrossPackage.project.visualIdentity).toMatchObject({
      theme: 'royal-burgh-and-forth',
      heroImage: '/town-guides/culross-royal-burgh-watercolour-guide.png',
    });
    expect(culrossPackage.project.visualIdentity?.motifs).toEqual([
      'Culross Palace',
      'Cobbled wynds',
      'Abbey ruins',
      'Forth shoreline',
    ]);
    const guideCopy = [
      culrossPackage.project.townGuide?.headline,
      culrossPackage.project.townGuide?.intro,
      culrossPackage.project.townGuide?.visitorMood,
    ].join(' ');
    expect(guideCopy).not.toMatch(/parking|toilets/i);
  });
});
