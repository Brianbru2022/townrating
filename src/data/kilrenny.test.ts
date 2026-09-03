import { describe, expect, it } from 'vitest';
import hesCertification from '../../data/review/east-neuk-balcomie-lochty-reaudit-hes-date-certification-2026-09-03.json';
import visitorAudit from '../../data/review/kilrenny-full-visitor-audit-2026-08-25.json';
import { dogOwnerAttractionScore } from '../domain/dogAccess';
import { validateFeatures } from '../domain/validation';
import { topVisitPlaces } from '../domain/visiting';
import { visitorFacts, visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { eastNeukPackages } from './eastNeuk';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const pkg = eastNeukPackages.find((item) => item.project.id === 'kilrenny-scotland')!;
const curation = publishedPlannerCurationForProject(pkg.project.id);
const named = (name: string) => pkg.features.find((feature) => feature.name === name)!;

describe('Kilrenny full visitor audit', () => {
  it('keeps a restrained town score and never raises the dog-owner score', () => {
    expect(pkg.project.touristAppeal).toMatchObject({
      score: 62,
      dogOwnerScore: 61,
      dogAccessScoreAdjustment: -1,
      dogAccessRating: 2,
    });
  });

  it('publishes only the two researched attractions above 60', () => {
    expect(visitorAudit.publicationRule).toBe('visitor score > 60');
    expect(pkg.project.visitorHighlights?.map((place) => [place.name, place.visitorScore])).toEqual([
      ['Kilrenny Parish Church and Kirkyard', 77],
      ['Kilrenny Conservation Village and Common', 64],
    ]);
    expect(pkg.project.visitorHighlights?.every((place) => (place.visitorScore ?? 0) > 60)).toBe(true);
    expect(topVisitPlaces(pkg, 10).map((place) => place.name)).toEqual([
      'Kilrenny Parish Church and Kirkyard',
      'Kilrenny Conservation Village and Common',
    ]);
  });

  it('uses the generated church artwork', () => {
    expect(pkg.project.visualIdentity).toMatchObject({
      theme: 'east-neuk-church',
      badgeImage: '/town-guides/kilrenny-parish-church-watercolour-guide.png',
      heroImage: '/town-guides/kilrenny-parish-church-watercolour-guide.png',
    });
  });

  it('publishes the real Walk Fife loop and no invented Eats or toilets', () => {
    expect(curation.eat).toEqual([]);
    expect(curation.toilets).toEqual([]);
    expect(curation.trails).toEqual(['curated-trail:kilrenny-walking-loop']);
    const trails = visitorNeedPlaces(pkg, 'trails', 10, { curatedFeatureIds: curation.trails });
    expect(trails.map((place) => [place.name, place.visitorScore])).toEqual([
      ['Kilrenny Walking Loop', 78],
    ]);
    expect(visitorFacts(named('Kilrenny Walking Loop'))).toEqual(expect.arrayContaining([
      { label: 'Distance', value: '5.46 km' },
      { label: 'Time to spend', value: '1 hour 22 minutes' },
    ]));
  });

  it('publishes one cautious parking area and two picnic tables', () => {
    expect(curation.parking).toEqual(['osm-community:way-635445353']);
    expect(curation.picnic).toHaveLength(2);
    const parking = named('Kilrenny Common Parking Area');
    expect(parking.reviewNotes).toContain('no spaces, price or payment claims');
    expect(visitorFacts(parking).map((fact) => fact.label)).not.toEqual(
      expect.arrayContaining(['Spaces', 'Pricing', 'Payment']),
    );
  });

  it('keeps attraction and dog-owner ratings separate', () => {
    const church = publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-attraction:kilrenny-1')!;
    const village = publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-attraction:kilrenny-2')!;
    expect(church).toMatchObject({ rating: 0, status: 'unconfirmed' });
    expect(village).toMatchObject({ rating: 3, status: 'welcoming' });
    expect(dogOwnerAttractionScore(77, church)).toBe(65);
    expect(dogOwnerAttractionScore(64, village)).toBe(64);
  });

  it('retains the expanded HES set and displays only materially dated pins', () => {
    const certification = hesCertification.projects.find((item) => item.projectId === pkg.project.id);
    expect(certification).toMatchObject({
      localRecords: 60,
      visibleHeritagePins: 45,
      visiblePinsWithoutDates: 0,
      visiblePinNamesContainingDate: 0,
    });
    const listed = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building'));
    const visible = listed.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(visible.every((feature) => Boolean(feature.documentedDateText) && feature.dateBasis !== 'unknown')).toBe(true);
  });

  it('has no validation errors', () => {
    expect(validateFeatures(pkg.project, pkg.features).filter((item) => item.severity === 'error')).toEqual([]);
  });
});
