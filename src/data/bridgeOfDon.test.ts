import { describe, expect, it } from 'vitest';
import bridgeOfDon from '../../data/projects/bridge-of-don-aberdeen.json';
import planner from '../../data/aberdeen-north-visitor-planner-curation.json';
import dog from '../../data/aberdeen-north-dog-access-curation.json';
import audit from '../../data/review/bridge-of-don-full-visitor-audit-2026-08-27.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const projectId = 'bridge-of-don-aberdeen-scotland';
const projectPlanner = planner.projects[projectId];
const dogAttractions = dog.projects[projectId].attraction;
const dogEats = dog.projects[projectId].eat;

describe('Bridge of Don full destination audit', () => {
  it('publishes the revised town and separate dog-owner scores', () => {
    expect(bridgeOfDon.project.touristAppeal).toMatchObject({
      score: 74,
      dogOwnerScore: 71,
      dogAccessScoreAdjustment: -3,
      label: 'Worth a Visit',
    });
  });

  it('uses the generated granite bridge artwork', () => {
    expect(bridgeOfDon.project.visualIdentity).toMatchObject({
      theme: 'bridge-of-don-granite-arches-and-river',
      heroImage: '/town-guides/bridge-of-don-granite-bridge-watercolour-guide-v1.png',
    });
  });

  it('publishes the complete audited visitor categories', () => {
    expect(bridgeOfDon.project.visitorHighlights).toHaveLength(5);
    expect(projectPlanner.eat).toHaveLength(4);
    expect(projectPlanner.trails).toHaveLength(4);
    expect(projectPlanner.parking).toHaveLength(3);
    expect(projectPlanner.toilets).toHaveLength(1);
    expect(projectPlanner.picnic).toHaveLength(1);
  });

  it('passes all four researched Eats through the live publication gate', () => {
    const curation = publishedPlannerCurationForProject(projectId);
    const eats = visitorNeedPlaces(bridgeOfDon, 'eat', 10, { curatedFeatureIds: curation.eat });
    expect(eats.map((place) => place.name)).toEqual([
      'Smoke and Soul at The Old Smiddy',
      'Crema Bridge of Don',
      "The Coffee Bar at King's",
      "Alba's Sweet Bake",
    ]);
  });

  it('dates every included heritage designation', () => {
    const historicPins = bridgeOfDon.features.filter((feature) =>
      feature.tags.includes('hes-listed-building') &&
      !feature.tags.includes('map-hidden') &&
      feature.evidenceScope !== 'out_of_scope');
    expect(historicPins).toHaveLength(49);
    expect(audit).toMatchObject({
      heritagePins: 49,
      datedHeritagePins: 49,
      heritagePinsInsideBoundary: 38,
      heritagePinsInContextBuffer: 11,
      undatedHeritagePinIds: [],
    });
    for (const pin of historicPins) {
      expect(pin.documentedDateText, pin.id).toBeTruthy();
      expect(pin.dateBasis, pin.id).not.toBe('unknown');
      expect(pin.earliestPossibleYear, pin.id).toBeTypeOf('number');
      expect(pin.latestPossibleYear, pin.id).toBeTypeOf('number');
    }
  });

  it('records completed provider, food and facilities searches', () => {
    expect(audit.trailProviderAudit.map((item) => item.provider)).toEqual([
      'Treasure Trails',
      'Curious About',
      'Mystery Guides',
      'Go Quest Adventures',
      'Aberdeen City Council',
      'VisitAberdeenshire',
    ]);
    expect(audit.foodAudit.published).toHaveLength(4);
    expect(audit.foodAudit.excluded).toHaveLength(5);
    expect(audit.facilitiesAudit.parking.published).toBe(3);
    expect(audit.facilitiesAudit.toilets.published).toBe(1);
    expect(audit.facilitiesAudit.picnic.published).toBe(1);
  });

  it('keeps the Seaton Park Treasure Trail outside Bridge of Don', () => {
    expect(bridgeOfDon.features.some((feature) => feature.visitorWebsiteUrl?.includes('treasuretrails.co.uk'))).toBe(false);
  });

  it('uses the verified council PDF destinations for every published trail', () => {
    const trailLinks = Object.fromEntries(
      bridgeOfDon.features
        .filter((feature) => projectPlanner.trails.includes(feature.id))
        .map((feature) => [feature.id, feature.visitorWebsiteUrl]),
    );
    expect(trailLinks).toEqual({
      'curated-trails:bridge-of-don-community-heritage-trail':
        'https://sites.aberdeencity.gov.uk/sites/default/files/2020-09/Bridge%20of%20Don%20Trail.pdf',
      'curated-trails:bridge-of-don-donside-heritage-trail':
        'https://sites.aberdeencity.gov.uk/sites/default/files/2020-10/Donside%20Heritage%20Trail.pdf',
      'curated-trails:bridge-of-don-donmouth-balgownie-loop':
        'https://sites.aberdeencity.gov.uk/sites/default/files/2020-09/Bridge%20of%20Don%20Trail.pdf',
      'curated-trails:bridge-of-don-scotstown-moor-circuit':
        'https://sites.aberdeencity.gov.uk/sites/default/files/2020-09/Bridge%20of%20Don%20Trail.pdf',
    });
  });

  it('records attraction-specific dog evidence without increasing the town score', () => {
    expect(dogAttractions['curated-attraction:bridge-of-don-donmouth-local-nature-reserve']).toMatchObject({ rating: 2 });
    expect(dogEats['curated-eat:bridge-of-don-old-smiddy']).toMatchObject({ rating: 3 });
    expect(dogEats['curated-eat:bridge-of-don-crema']).toMatchObject({ status: 'unknown' });
    expect(bridgeOfDon.project.touristAppeal.dogOwnerScore).toBeLessThanOrEqual(bridgeOfDon.project.touristAppeal.score);
  });

  it('publishes detailed Park and Ride information', () => {
    const parking = bridgeOfDon.features.find((feature) => feature.id === 'curated-parking:bridge-of-don-park-and-ride');
    expect(parking?.shortDescription).toContain('650 free spaces');
    expect(parking?.shortDescription).toContain('2.1 m height limit');
    expect(parking?.shortDescription).toContain('accessible toilet');
  });
});
