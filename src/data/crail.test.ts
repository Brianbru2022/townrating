import { describe, expect, it } from 'vitest';
import { validateFeatures } from '../domain/validation';
import {
  parkingPriceStatus,
  visitorFacts,
  visitorNeedPlaces,
} from '../domain/visitorExperience';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { eastNeukPackages } from './eastNeuk';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';
import crailAttractionAssessmentJson from '../../data/review/crail-attraction-assessment-2026-08-25.json';

const crailPackage = eastNeukPackages.find((pkg) => pkg.project.id === 'crail-scotland')!;
const curation = publishedPlannerCurationForProject(crailPackage.project.id);

function featureNames(ids: string[] | undefined): string[] {
  return (ids ?? []).map(
    (id) => crailPackage.features.find((feature) => feature.id === id)?.name ?? id,
  );
}

function featureNamed(name: string) {
  return crailPackage.features.find((feature) => feature.name === name)!;
}

function feature(id: string) {
  return crailPackage.features.find((item) => item.id === id)!;
}

describe('Crail visitor guide', () => {
  it('uses the generated Crail harbour artwork for the town guide', () => {
    expect(crailPackage.project.visualIdentity).toMatchObject({
      theme: 'east-neuk-harbour',
      badgeImage: '/town-guides/crail-harbour-watercolour-guide.png',
      heroImage: '/town-guides/crail-harbour-watercolour-guide.png',
      heroObjectPosition: '50% 56%',
    });
  });

  it('assesses all supplied attraction candidates and publishes only See scores above 60', () => {
    const assessment = crailAttractionAssessmentJson as {
      candidateCount: number;
      publicationRule: string;
      candidates: Array<{
        candidate: string;
        score: number;
        status: string;
        publishedAs?: string;
      }>;
    };
    expect(assessment.candidateCount).toBe(44);
    expect(assessment.candidates).toHaveLength(44);
    expect(assessment.publicationRule).toBe('visitor score > 60');

    const highlights = crailPackage.project.visitorHighlights ?? [];
    expect(highlights).toHaveLength(9);
    expect(highlights.every((place) => (place.visitorScore ?? 0) > 60)).toBe(true);
    expect(highlights.map((place) => [place.name, place.visitorScore])).toEqual([
      ['Crail Harbour and Shoregate', 86],
      ['Roome Bay and Rock Pools', 83],
      ['Crail Parish Church and Kirkyard', 80],
      ['Crail Harbour Gallery', 78],
      ['Castle Walk and Viewpoint', 75],
      ['Crail Priory Doocot', 74],
      ['Crail Museum and Heritage Centre', 72],
      ['Crail Pottery', 69],
      ['Crail Tolbooth and Marketgate', 65],
    ]);

    expect(
      assessment.candidates.find((item) => item.candidate === 'Site of Crail Castle'),
    ).toMatchObject({
      score: 44,
      status: 'combined',
      publishedAs: 'Castle Walk and Viewpoint',
    });
    expect(
      assessment.candidates.find((item) => item.candidate === 'Fife Coastal Path – Crail'),
    ).toMatchObject({ score: 84, status: 'kept_in_trails' });
    expect(
      highlights.find((place) => place.name === 'Roome Bay and Rock Pools')?.attractionGuide,
    ).toMatchObject({
      parking: expect.stringContaining('Free parking'),
      toilets: expect.stringContaining('Public toilets'),
      trails: [expect.objectContaining({ name: 'Fife Coastal Path at Roome Bay' })],
    });
  });

  it('publishes researched food and trail choices in score order', () => {
    expect(featureNames(curation.eat)).toEqual([
      'Crail Harbour Gallery and Tearoom',
      'Nook Crail',
      'The Beehive Crail',
    ]);
    expect(
      visitorNeedPlaces(crailPackage, 'eat', 10, { curatedFeatureIds: curation.eat }).map(
        (place) => place.visitorScore,
      ),
    ).toEqual([84, 78, 74]);

    expect(featureNames(curation.trails)).toEqual([
      'Crail Heritage Walk',
      'Fife Coastal Path at Crail',
      'Crail Castle Walk & Harbour Treasure Trail',
    ]);
    expect(
      visitorNeedPlaces(crailPackage, 'trails', 10, {
        curatedFeatureIds: curation.trails,
      }).map((place) => place.visitorScore),
    ).toEqual([86, 84, 84]);
    const treasureTrail = featureNamed('Crail Castle Walk & Harbour Treasure Trail');
    expect(treasureTrail.visitorWebsiteUrl).toContain('treasuretrails.co.uk');
    expect(visitorFacts(treasureTrail)).toEqual(
      expect.arrayContaining([
        { label: 'Distance', value: '1.5-mile circular route' },
        { label: 'Time to spend', value: '1.5 hours' },
        { label: 'Price', value: '£10.99 per Trail' },
        { label: 'App', value: 'Treasure Trails app' },
        {
          label: 'How the app works',
          value: 'Buy on the website, then sync to the app',
        },
        { label: 'Offline use', value: 'Works offline after download' },
      ]),
    );
  });

  it('publishes only the two car parks returned by the live Parkopedia Crail search', () => {
    expect(featureNames(curation.parking)).toEqual([
      'Nethergate Car Park',
      'Marketgate North Car Park',
    ]);

    const nethergate = featureNamed('Nethergate Car Park');
    const marketgate = featureNamed('Marketgate North Car Park');
    expect(parkingPriceStatus(nethergate)).toBe('free');
    expect(parkingPriceStatus(marketgate)).toBe('free');
    const nethergateCouncil = nethergate.sourceRecords.find(
      (source) => source.sourceName === 'Crail parking re-audit',
    );
    const nethergateParkopedia = nethergate.sourceRecords.find(
      (source) => source.sourceName === 'Parkopedia Crail scrape',
    );
    expect(nethergateCouncil?.notes).toContain('capacity=15');
    expect(nethergateCouncil?.notes).toContain(
      'payment_methods=No payment required',
    );
    expect(nethergateParkopedia?.notes).toContain('parkopedia_capacity=16');
    expect(visitorFacts(nethergate)).toEqual(
      expect.arrayContaining([
        { label: 'Spaces', value: '15' },
        { label: 'Parkopedia spaces', value: '16' },
        { label: 'Hours', value: 'Open all day, Monday-Sunday' },
      ]),
    );
    expect(visitorFacts(marketgate)).toEqual(
      expect.arrayContaining([
        { label: 'Spaces', value: '50' },
        { label: 'Pricing', value: 'Free' },
        { label: 'Hours', value: 'Open all day, Monday-Sunday' },
        { label: 'Height restriction', value: 'None' },
        { label: 'EV charging price', value: '40p/kWh' },
        {
          label: 'EV payment',
          value: 'Zap-Pay or ChargePlace Scotland app',
        },
      ]),
    );

    const harbour = featureNamed('Crail Harbour — no visitor parking');
    expect(harbour.tags).toContain('visitor-parking-prohibited');
    expect(harbour.tags).not.toContain('service-context-parking');
    expect(curation.parking).not.toContain(harbour.id);
    expect(curation.parking).not.toContain('osm-community:way-306292353');
  });

  it('records a specific dog-access search for every Crail food stop', () => {
    const expected = [
      ['osm-community:node-7657404154', 3, 'welcoming'],
      ['osm-community:node-7657367379', 0, 'unconfirmed'],
      ['osm-community:node-6566572497', 0, 'unconfirmed'],
    ] as const;
    for (const [id, rating, status] of expected) {
      expect(publishedDogAccessForPlace('crail-scotland', 'eat', id)).toMatchObject({
        rating,
        status,
        sourceName: expect.any(String),
        sourceUrl: expect.stringMatching(/^https:\/\//),
      });
    }
  });

  it('publishes attraction-specific dog evidence and a reduced dog-owner town score', () => {
    const expected = [
      ['curated-attraction:crail-1', 3, 'welcoming'],
      ['curated-attraction:crail-2', 0, 'unconfirmed'],
      ['curated-attraction:crail-3', 1, 'restricted'],
      ['osm-community:node-7657404154', 3, 'welcoming'],
    ] as const;
    for (const [id, rating, status] of expected) {
      const dogAccess = publishedDogAccessForPlace('crail-scotland', 'attraction', id);
      expect(dogAccess).toMatchObject({ rating, status });
      expect(feature(id).sourceRecords.filter(
        (source) => source.sourceName === 'Crail attraction dog-access audit',
      ).length).toBeGreaterThanOrEqual(2);
    }

    expect(crailPackage.project.touristAppeal).toMatchObject({
      score: 82,
      dogOwnerScore: 81,
      dogAccessScoreAdjustment: -1,
      dogAccessRating: 2,
    });
  });

  it('uses only the two confirmed public toilets and retains accessibility details', () => {
    expect(featureNames(curation.toilets)).toEqual([
      'Crail Harbour Public Toilets',
      'Crail Westgate Public Toilets',
    ]);

    const harbour = featureNamed('Crail Harbour Public Toilets');
    const westgate = featureNamed('Crail Westgate Public Toilets');
    expect(harbour.sourceRecords.at(-1)?.notes).toContain('price_display=Free');
    expect(harbour.sourceRecords.at(-1)?.notes).toContain('09:00-17:00');
    expect(westgate.sourceRecords.at(-1)?.notes).toContain('price_display=30p');
    expect(westgate.sourceRecords.at(-1)?.notes).toContain('RADAR key');
  });

  it('adds Crail art and dates nearly every HES heritage pin from official descriptions', () => {
    expect(crailPackage.project.visitorHighlights?.map((place) => place.name)).toContain(
      'Crail Harbour Gallery',
    );
    expect(featureNamed('Crail Harbour Gallery and Tearoom').tags).toContain(
      'service-context-art',
    );
    expect(featureNamed('Crail Pottery').tags).toContain('service-context-art');

    const listed = crailPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    const dated = listed.filter(
      (feature) =>
        feature.documentedDateText &&
        feature.earliestPossibleYear !== undefined &&
        feature.latestPossibleYear !== undefined,
    );
    expect(listed).toHaveLength(234);
    expect(dated).toHaveLength(234);
    expect(listed.length - dated.length).toBeLessThanOrEqual(9);
  });

  it('has no data validation errors', () => {
    expect(
      validateFeatures(crailPackage.project, crailPackage.features).filter(
        (result) => result.severity === 'error',
      ),
    ).toEqual([]);
  });
});
