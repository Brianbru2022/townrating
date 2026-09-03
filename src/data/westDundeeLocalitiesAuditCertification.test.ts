import { describe, expect, it } from 'vitest';
import audit from '../../data/review/west-dundee-localities-full-audit-2026-09-02.json';
import hes from '../../data/review/west-dundee-localities-hes-date-certification-2026-09-02.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import { homeTownOverviews } from '../map/homeOverview';
import { topVisitPlaces } from '../domain/visiting';
import { topFoodAndDrink } from '../domain/visitorExperience';
import { cairnOMountPackages } from './cairnOMount';

const expected = new Map<string, number>([
  ['coldstream-tealing-scotland', 10], ['bonnyton-auchterhouse-scotland', 24],
  ['kirkton-of-auchterhouse-scotland', 59], ['leoch-auchterhouse-scotland', 16],
  ['muir-of-pert-tealing-scotland', 18], ['bridgefoot-angus-scotland', 30],
  ['downfield-dundee-scotland', 43], ['birkhill-angus-scotland', 42],
  ['muirhead-angus-scotland', 40], ['dronley-angus-scotland', 41],
  ['fowlis-easter-scotland', 62], ['liff-scotland', 52], ['denhead-of-gray-scotland', 22],
  ['benvie-scotland', 36], ['longforgan-scotland', 63], ['castle-huntly-scotland', 20],
  ['invergowrie-scotland', 59], ['kingoodie-scotland', 54], ['woodhaven-fife-scotland', 55],
]);

const packages = cairnOMountPackages.filter((pkg) => expected.has(pkg.project.id));

describe('west Dundee, Sidlaw and Carse sequential audit', () => {
  it('resolves all 19 requests without inventing Muirs of Perk or reusing Bonnyton at Barnhead', () => {
    expect(audit.requestedCount).toBe(19);
    expect(audit.distinctNewProjects).toBe(18);
    expect(audit.normalisedExistingProject).toBe('muir-of-pert-tealing-scotland');
    expect(audit.audits.map((item) => item.order)).toEqual([...Array(19)].map((_, index) => index + 1));
    expect(audit.audits.every((item) => item.status === 'completed')).toBe(true);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'bonnyton-auchterhouse-scotland')).toHaveLength(1);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'bonnyton-barnhead-scotland')).toHaveLength(1);
    expect(cairnOMountPackages.some((pkg) => /Muirs of Perk/i.test(pkg.project.name))).toBe(false);
  });

  it('stores real reviewed scores, triggers no accidental exact-58 placeholder, and maps only 60+', () => {
    expect(packages).toHaveLength(19);
    expect(packages.map((pkg) => [pkg.project.id, pkg.project.touristAppeal?.score]).sort()).toEqual([...expected.entries()].sort());
    expect(packages.every((pkg) => pkg.project.touristAppeal?.score !== 58)).toBe(true);
    expect(homeTownOverviews(packages).map((town) => town.id)).toEqual(['longforgan-scotland', 'fowlis-easter-scotland']);
  });

  it('publishes only the practical places that the audit actually verified', () => {
    const curation = (planner as any).projects;
    expect(curation['kirkton-of-auchterhouse-scotland']).toEqual({
      eat: [], trails: ['west-dundee-curated:auchterhouse-railway-path'],
      picnic: ['west-dundee-curated:auchterhouse-park-picnic'], parking: [],
      toilets: ['west-dundee-curated:auchterhouse-park-toilets'],
    });
    expect(curation['downfield-dundee-scotland'].eat).toEqual(['west-dundee-curated:downfield-tesco-cafe']);
    expect(curation['invergowrie-scotland'].eat).toEqual(['west-dundee-curated:post-house-coffee']);
    expect(curation['fowlis-easter-scotland'].parking).toEqual(['west-dundee-curated:fowlis-public-parking']);
    expect(curation['kingoodie-scotland'].parking).toEqual([]);
    expect(curation['castle-huntly-scotland']).toEqual({ eat: [], trails: [], picnic: [], parking: [], toilets: [] });
    expect(topVisitPlaces(packages.find((pkg) => pkg.project.id === 'fowlis-easter-scotland')!).map((place) => place.name)).toEqual(['Fowlis Easter Parish Church']);
    expect(topVisitPlaces(packages.find((pkg) => pkg.project.id === 'longforgan-scotland')!).map((place) => place.name)).toEqual(['Longforgan Parish Church']);
    expect(topVisitPlaces(packages.find((pkg) => pkg.project.id === 'kingoodie-scotland')!).map((place) => place.name)).toEqual(['Kingoodie Quarry']);
    expect(topFoodAndDrink(packages.find((pkg) => pkg.project.id === 'downfield-dundee-scotland')!).map((place) => place.name)).toEqual(['Tesco Café, Dundee Kingsway']);
    expect(topFoodAndDrink(packages.find((pkg) => pkg.project.id === 'invergowrie-scotland')!).map((place) => place.name)).toEqual(['Post House Coffee Co.']);
    expect(topFoodAndDrink(packages.find((pkg) => pkg.project.id === 'longforgan-scotland')!).map((place) => place.name)).toEqual(['Longforgan Pop-in Café']);
  });

  it('retains the complete local HES/NRHE extract and dates every map-visible heritage pin without label leakage', () => {
    expect(hes.projects).toHaveLength(19);
    expect(hes.totals.records).toBeGreaterThan(500);
    expect(hes.totals.visiblePinsWithoutDates).toBe(0);
    expect(hes.totals.visiblePinNamesContainingAppendedDate).toBe(0);
    for (const pkg of packages) {
      const heritage = pkg.features.filter((feature) => feature.tags.some((tag) =>
        ['hes-listed-building', 'hes-scheduled-monument', 'hes-nrhe', 'nrhe'].includes(tag),
      ));
      const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
      expect(visible.every((feature) => Boolean(feature.documentedDateText) && feature.dateBasis !== 'unknown'), pkg.project.name).toBe(true);
    }
  });

  it('records explicit provider and every practical-category result for every audit', () => {
    for (const item of audit.audits) {
      expect(Object.keys(item.categoryChecks)).toEqual(expect.arrayContaining(['see', 'eat', 'trails', 'picnic', 'parking', 'toilets', 'historicEnvironment', 'dogAccess']));
      expect(Object.keys(item.providerChecks)).toEqual(['treasureTrails', 'curiousAbout', 'mysteryGuides', 'goQuest']);
      expect(item.exact58SecondPass).toMatch(/Not required|Mandatory/);
    }
  });
});
