import { describe, expect, it } from 'vitest';
import audit from '../../data/review/broughty-ferry-full-visitor-audit-2026-09-02.json';
import project from '../../data/projects/broughty-ferry.json';
import { homeTownOverviews } from '../map/homeOverview';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const pkg = project as any;
const curation = publishedPlannerCurationForProject(pkg.project.id);
const heritageTags = new Set([
  'hes-listed-building',
  'hes-scheduled-monument',
  'hes-garden-designed-landscape',
  'hes-nrhe',
  'nrhe',
]);

describe('Broughty Ferry full visitor audit', () => {
  it('publishes the independently audited settlement at the verified score', () => {
    expect(pkg.project.touristAppeal).toMatchObject({
      score: 87,
      dogOwnerScore: 81,
      dogAccessScoreAdjustment: -6,
      rating: 2,
      label: 'Strong Destination',
      dogAccessRating: 2,
    });
    expect(homeTownOverviews([pkg])).toHaveLength(1);
    expect(audit.score.secondPass58).toContain('mandatory complete second pass');
  });

  it('publishes every audited visitor-planner category with useful depth', () => {
    expect(curation).toEqual({
      eat: expect.arrayContaining(Array(9).fill(expect.stringMatching(/^broughty-ferry-curated:eat-/))),
      trails: expect.arrayContaining(Array(5).fill(expect.stringMatching(/^broughty-ferry-curated:trail-/))),
      picnic: expect.arrayContaining(Array(2).fill(expect.stringMatching(/^broughty-ferry-curated:picnic-/))),
      parking: expect.arrayContaining(Array(5).fill(expect.stringMatching(/^broughty-ferry-curated:parking-/))),
      toilets: expect.arrayContaining(Array(3).fill(expect.stringMatching(/^broughty-ferry-curated:toilets-/))),
    });
    expect(pkg.project.visitorHighlights).toHaveLength(7);
    expect(visitorNeedPlaces(pkg, 'see', 20)).toHaveLength(7);
    expect(visitorNeedPlaces(pkg, 'eat', 20, { curatedFeatureIds: curation.eat })).toHaveLength(9);
    expect(audit.publication).toEqual({ see: 7, eat: 9, trails: 5, picnic: 2, parking: 5, toilets: 3 });
  });

  it('retains the complete local heritage set while hiding only records without defensible dates', () => {
    const heritage = pkg.features.filter((feature: any) => feature.tags.some((tag: string) => heritageTags.has(tag)));
    const visible = heritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
    expect(heritage).toHaveLength(367);
    expect(heritage.filter((feature: any) => feature.tags.includes('hes-listed-building'))).toHaveLength(160);
    expect(heritage.filter((feature: any) => feature.id.startsWith('nrhe:'))).toHaveLength(207);
    expect(visible).toHaveLength(281);
    expect(visible.every((feature: any) =>
      feature.documentedDateText &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null &&
      feature.dateBasis !== 'unknown' &&
      !feature.name.includes(feature.documentedDateText),
    )).toBe(true);
    expect(audit.heritage).toMatchObject({
      visibleDatedPins: 281,
      hiddenUndatedRecords: 86,
      visibleUndatedPins: 0,
      missingStatutoryDesignations: 0,
    });
  });

  it('uses the local NRHE castle record as the visitor attraction instead of duplicating it', () => {
    const castles = pkg.features.filter((feature: any) => feature.name === 'Broughty Castle Museum');
    expect(castles).toHaveLength(1);
    expect(castles[0]).toMatchObject({
      id: 'nrhe:33391',
      documentedDateText: '1490',
      earliestPossibleYear: 1490,
      latestPossibleYear: 1490,
    });
    expect(pkg.project.visitorHighlights[0].featureId).toBe('nrhe:33391');
  });

  it('records explicit named-trail provider checks and does not borrow nearby attractions', () => {
    expect(audit.categories.trails.providerChecks).toMatchObject({
      TreasureTrails: expect.stringContaining('no exact product'),
      CuriousAbout: expect.stringContaining('no exact route'),
      MysteryGuides: expect.stringContaining('no exact route'),
      GoQuestAdventures: expect.stringContaining('no exact route'),
    });
    expect(audit.boundary.nearbyExcluded).toEqual(expect.arrayContaining([
      'Barnhill Rock Garden',
      'Broughty Ferry Local Nature Reserve',
      'Dundee city-centre museums and trails',
    ]));
  });
});
