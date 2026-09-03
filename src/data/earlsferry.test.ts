import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import dateAudit from '../../data/review/earlsferry-hes-date-enrichment-2026-08-26.json';
import visitorAudit from '../../data/review/earlsferry-full-visitor-audit-2026-08-26.json';
import { validateFeatures } from '../domain/validation';
import { topVisitPlaces } from '../domain/visiting';
import { visitorFacts, visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { eastNeukPackages } from './eastNeuk';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const pkg = eastNeukPackages.find((item) => item.project.id === 'earlsferry-scotland')!;
const curation = publishedPlannerCurationForProject(pkg.project.id);
const named = (name: string) => pkg.features.find((item) => item.name === name)!;

describe('Earlsferry full visitor audit', () => {
  it('keeps the dog-owner score separate and lower', () => {
    expect(pkg.project.touristAppeal).toMatchObject({ score: 78, dogOwnerScore: 77, dogAccessScoreAdjustment: -1, rating: 1, label: 'Worth a Visit', dogAccessRating: 2 });
    expect(pkg.project.touristAppeal!.dogOwnerScore).toBeLessThan(pkg.project.touristAppeal!.score!);
  });

  it('publishes only the three qualifying attractions', () => {
    expect(visitorAudit.publicationRule).toBe('visitor score > 60 with a complete current visitor contract');
    expect(pkg.project.visitorHighlights?.map((item) => [item.name, item.visitorScore])).toEqual([
      ['Elie Links and Golf House Club', 84],
      ['Earlsferry Beach and Historic Waterfront', 80],
      ['Earlsferry Old Burgh and Town Hall', 69],
    ]);
    expect(topVisitPlaces(pkg, 10)).toHaveLength(3);
  });

  it('keeps pub-led food out and publishes the researched trail contracts', () => {
    expect(curation.eat).toEqual([]);
    expect(visitorNeedPlaces(pkg, 'eat', 10, { curatedFeatureIds: curation.eat })).toEqual([]);
    expect(curation.trails).toEqual([
      'curated-trail:earlsferry-fife-coastal-path',
      'curated-trail:earlsferry-chain-walk-loop',
      'curated-trail:earlsferry-ruby-bay-treasure-trail',
    ]);
    expect(publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-trail:earlsferry-chain-walk-loop')).toMatchObject({ rating: 0, status: 'prohibited' });
  });

  it('does not invent parking or toilet data', () => {
    expect(curation.parking).toHaveLength(1);
    expect(visitorFacts(named('Earlsferry West End Beach Parking'))).toEqual(expect.arrayContaining([
      { label: 'Spaces', value: 'Not published' },
      { label: 'Pricing', value: 'Free in current OpenStreetMap data' },
      { label: 'Payment', value: 'None' },
    ]));
    expect(curation.toilets).toEqual([]);
  });

  it('uses dedicated artwork and removes the former Elie heritage overlap', () => {
    expect(pkg.project.visualIdentity).toMatchObject({ theme: 'earlsferry-stone-waterfront-and-beach', heroImage: '/town-guides/earlsferry-waterfront-watercolour-guide-v1.png' });
    expect(dateAudit).toMatchObject({ candidates: 54, enriched: 54, reviewRequired: [] });
    const visibleHeritage = pkg.features.filter((item) => item.tags.includes('hes-listed-building') && !item.tags.includes('map-hidden') && item.evidenceScope !== 'out_of_scope');
    const localityBoundary = pkg.project.townStudyArea?.localityBoundary;
    if (!localityBoundary) throw new Error('Earlsferry locality boundary is missing.');
    expect(visibleHeritage).toHaveLength(73);
    expect(visibleHeritage.every((item) => Boolean(item.documentedDateText))).toBe(true);
    expect(visibleHeritage.every((item) => item.geometry?.type === 'Point' && booleanPointInPolygon(point(item.geometry.coordinates), localityBoundary))).toBe(true);
    expect(validateFeatures(pkg.project, pkg.features).filter((item) => item.severity === 'error')).toEqual([]);
  });
});
