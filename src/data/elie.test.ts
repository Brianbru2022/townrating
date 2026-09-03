import { describe, expect, it } from 'vitest';
import dateAudit from '../../data/review/elie-hes-date-enrichment-2026-08-26.json';
import overlapAudit from '../../data/review/elie-boundary-overlap-audit-2026-08-26.json';
import visitorAudit from '../../data/review/elie-full-visitor-audit-2026-08-26.json';
import { validateFeatures } from '../domain/validation';
import { topVisitPlaces } from '../domain/visiting';
import { visitorFacts, visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { eastNeukPackages } from './eastNeuk';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const pkg = eastNeukPackages.find((item) => item.project.id === 'elie-scotland')!;
const curation = publishedPlannerCurationForProject(pkg.project.id);
const named = (name: string) => pkg.features.find((item) => item.name === name)!;

describe('Elie full visitor audit', () => {
  it('keeps the researched dog-owner score separate and lower', () => {
    expect(pkg.project.touristAppeal).toMatchObject({ score: 86, dogOwnerScore: 85, dogAccessScoreAdjustment: -1, rating: 2, label: 'Strong Destination', dogAccessRating: 2 });
    expect(pkg.project.touristAppeal!.dogOwnerScore).toBeLessThan(pkg.project.touristAppeal!.score!);
  });

  it('publishes only the two qualifying, non-duplicated attractions', () => {
    expect(visitorAudit.publicationRule).toBe('visitor score > 60');
    expect(pkg.project.visitorHighlights?.map((item) => [item.name, item.visitorScore])).toEqual([
      ['Elie Harbour and Beach', 88],
      ['Elie Ness, Lady’s Tower and Ruby Bay', 85],
    ]);
    expect(topVisitPlaces(pkg, 10)).toHaveLength(2);
    expect(named('Elie coastal path').tags).not.toContain('curated-visitor-attraction');
  });

  it('uses purpose-built Elie artwork', () => {
    expect(pkg.project.visualIdentity).toMatchObject({ theme: 'elie-harbour-beach-and-ness', heroImage: '/town-guides/elie-shoreline-watercolour-guide-v2.png' });
  });

  it('publishes three café-led Eats and source-specific dog policies', () => {
    expect(curation.eat).toHaveLength(3);
    expect(visitorNeedPlaces(pkg, 'eat', 10, { curatedFeatureIds: curation.eat }).map((item) => [item.name, item.visitorScore])).toEqual([
      ['Elie Deli', 84], ['Elie Coffee Hatch', 80], ['G.H. Barnett', 74],
    ]);
    expect(publishedDogAccessForPlace(pkg.project.id, 'eat', 'curated-food:elie-deli')).toMatchObject({ rating: 1, status: 'restricted' });
  });

  it('publishes the genuine Treasure Trail and two standard routes', () => {
    expect(curation.trails).toEqual(['curated-trail:elie-fife-coastal-path', 'curated-trail:elie-ruby-bay-treasure-trail', 'curated-trail:elie-ness-ruby-bay-circular']);
    expect(visitorFacts(named('Elie & Earlsferry – Ruby Bay & Back Treasure Trail'))).toEqual(expect.arrayContaining([
      { label: 'Distance', value: '2.5 miles' }, { label: 'Time to spend', value: '2.5 hours' }, { label: 'Price', value: '£9.99 per trail booklet/download' },
    ]));
  });

  it('publishes explicit parking prices, payments and toilet details', () => {
    expect(curation.parking).toHaveLength(3);
    expect(visitorFacts(named('Ruby Bay Upper Car Park'))).toEqual(expect.arrayContaining([
      { label: 'Spaces', value: 'General daytime capacity not published' },
      { label: 'Pricing', value: 'First 2 hours free, then £2 daytime' },
      { label: 'Payment', value: 'Cash or card machine daytime, RingGo overnight' },
    ]));
    expect(visitorFacts(named('Stenton Row Public Toilets'))).toEqual(expect.arrayContaining([{ label: 'Price', value: 'Free' }]));
  });

  it('dates the visible HES pins and keeps neighbouring study areas separate', () => {
    expect(dateAudit).toMatchObject({ total: 119, dated: 118, undated: 1, failed: 0 });
    const visibleListed = pkg.features.filter((item) => item.tags.includes('hes-listed-building') && !item.tags.includes('map-hidden'));
    expect(visibleListed).toHaveLength(126);
    expect(visibleListed.every((item) => item.documentedDateText && !/^date:\s*\d{4}-\d{2}/i.test(item.documentedDateText))).toBe(true);
    expect(overlapAudit.comparisons.every((item) => item.overlapSquareMetres === 0 && item.elieFeaturesInsideNeighbourStudyArea === 0)).toBe(true);
    expect(validateFeatures(pkg.project, pkg.features).filter((item) => item.severity === 'error')).toEqual([]);
  });
});
