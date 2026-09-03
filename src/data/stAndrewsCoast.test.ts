import { describe, expect, it } from 'vitest';
import { validateFeatures } from '../domain/validation';
import { topFoodAndDrink, visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';
import { stAndrewsCoastPackages } from './stAndrewsCoast';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const expectedScores: Record<string, number> = {
  Wormit: 74,
  'Kirkton (Balmerino)': 34,
  Bottomcraig: 36,
  Pickletillum: 20,
  Lucklawhill: 34,
  Balmullo: 54,
  Logie: 38,
  Kilmany: 62,
  Rathillet: 24,
  'Hazelton Walls': 20,
  Creich: 50,
  'Brunton (Creich)': 46,
  Dairsie: 54,
  Scotscraig: 42,
  Tayport: 84,
  Leuchars: 68,
  Guardbridge: 74,
  Rhynd: 48,
  Carrick: 22,
  Kincaple: 38,
  Strathkinness: 45,
  Newpark: 18,
  Balone: 24,
  Denhead: 40,
  'Peat Inn': 45,
  'St Andrews': 96,
  Brownhills: 22,
  Boarhills: 58,
  Kingsbarns: 72,
  'Prior Muir': 24,
  Stravithie: 30,
  Dunino: 58,
  Balcomie: 30,
  Craighead: 42,
  Kemback: 50,
  'Blebo Craigs': 44,
  Pitscottie: 56,
  Baldinnie: 22,
  'Bridgend (Ceres)': 18,
  Ceres: 86,
  'Woodside (Largo)': 18,
  'New Gilston': 30,
  'Wester Newburn': 14,
  'Lundin Links': 78,
  'Lower Largo': 86,
  Drumeldrie: 46,
  Leven: 88,
  Glenduckie: 55,
  Luthrie: 57,
  Moonzie: 47,
  'Kilmaron Castle': 20,
  Lindifferon: 22,
  'Fernie Castle': 34,
  'Letham (Fife)': 35,
  'Bow of Fife': 26,
  'Cupar Muir': 28,
  Cupar: 84,
  Craigrothie: 59,
  Pitlessie: 59,
  'Springfield (Fife)': 57,
  Ladybank: 67,
  Kingskettle: 56,
  Balmalcolm: 66,
  Kettlebridge: 48,
  Kettlehill: 34,
  Montrave: 24,
  'Rameldry Mill Bank': 12,
  Langdyke: 18,
  'Muirhead (Freuchie)': 20,
  Kennoway: 72,
  Bonnybank: 44,
  Scoonie: 48,
  Balcurvie: 51,
  Windygates: 56,
  'Milton of Balgonie': 50,
  Markinch: 84,
};

describe('Tayport to Markinch sequential full-audit gate', () => {
  it('keeps all 76 places selectable and maps only independently scoring 60+', () => {
    expect(stAndrewsCoastPackages).toHaveLength(76);
    expect(
      Object.fromEntries(
        stAndrewsCoastPackages.map((pkg) => [pkg.project.name, pkg.project.touristAppeal?.score]),
      ),
    ).toEqual(expectedScores);
    expect(homeTownOverviews(stAndrewsCoastPackages).map((town) => town.name)).toEqual([
      'St Andrews',
      'Leven',
      'Ceres',
      'Lower Largo',
      'Cupar',
      'Tayport',
      'Markinch',
      'Lundin Links',
      'Guardbridge',
      'Wormit',
      'Kingsbarns',
      'Kennoway',
      'Leuchars',
      'Ladybank',
      'Balmalcolm',
      'Kilmany',
    ]);
  });

  it('publishes the fully audited Wormit and Ceres guides without promoting attraction-only neighbours', () => {
    const wormit = byProject('wormit-scotland');
    const wormitCuration = publishedPlannerCurationForProject(wormit.project.id);
    expect(topVisitPlaces(wormit, 20)).toHaveLength(2);
    expect(topFoodAndDrink(wormit, 20)).toHaveLength(1);
    expect(
      visitorNeedPlaces(wormit, 'trails', 20, { curatedFeatureIds: wormitCuration.trails }),
    ).toHaveLength(2);
    expect(
      visitorNeedPlaces(wormit, 'parking', 20, { curatedFeatureIds: wormitCuration.parking }),
    ).toHaveLength(1);

    const ceres = byProject('ceres-scotland');
    const ceresCuration = publishedPlannerCurationForProject(ceres.project.id);
    expect(topVisitPlaces(ceres, 20)).toHaveLength(3);
    expect(topFoodAndDrink(ceres, 20)).toHaveLength(2);
    expect(
      visitorNeedPlaces(ceres, 'trails', 20, { curatedFeatureIds: ceresCuration.trails }),
    ).toHaveLength(3);
    expect(
      visitorNeedPlaces(ceres, 'picnic', 20, { curatedFeatureIds: ceresCuration.picnic }),
    ).toHaveLength(1);
    expect(
      visitorNeedPlaces(ceres, 'parking', 20, { curatedFeatureIds: ceresCuration.parking }),
    ).toHaveLength(1);
    expect(
      visitorNeedPlaces(ceres, 'toilets', 20, { curatedFeatureIds: ceresCuration.toilets }),
    ).toHaveLength(1);

    expect(
      homeTownOverviews([
        byProject('kemback-scotland'),
        byProject('pitscottie-scotland'),
        byProject('bridgend-ceres-scotland'),
      ]),
    ).toHaveLength(0);
  });

  it('publishes the complete St Andrews visitor guide', () => {
    const pkg = stAndrewsCoastPackages.find((item) => item.project.id === 'st-andrews-scotland')!;
    const curation = publishedPlannerCurationForProject(pkg.project.id);
    expect(topVisitPlaces(pkg, 30)).toHaveLength(12);
    expect(topFoodAndDrink(pkg, 30)).toHaveLength(10);
    expect(
      visitorNeedPlaces(pkg, 'trails', 30, { curatedFeatureIds: curation.trails }),
    ).toHaveLength(6);
    expect(
      visitorNeedPlaces(pkg, 'picnic', 30, { curatedFeatureIds: curation.picnic }),
    ).toHaveLength(3);
    expect(
      visitorNeedPlaces(pkg, 'parking', 30, { curatedFeatureIds: curation.parking }),
    ).toHaveLength(4);
    expect(
      visitorNeedPlaces(pkg, 'toilets', 30, { curatedFeatureIds: curation.toilets }),
    ).toHaveLength(3);
    expect(
      (curation.trails ?? []).filter((id) => id.includes('st-andrews-treasure-')),
    ).toHaveLength(3);
  });

  it('keeps attraction-only and route-only places off the Home map while retaining their useful categories', () => {
    const byName = (name: string) =>
      stAndrewsCoastPackages.find((pkg) => pkg.project.name === name)!;
    expect(topVisitPlaces(byName('Dunino'), 10)).toHaveLength(2);
    expect(publishedPlannerCurationForProject(byName('Dunino').project.id).trails).toHaveLength(1);
    expect(topVisitPlaces(byName('Balcomie'), 10)).toHaveLength(0);
    expect(topVisitPlaces(byName('Craighead'), 10).map((item) => item.name)).toEqual([
      'Craighead Links',
    ]);
    expect(publishedPlannerCurationForProject(byName('Kingsbarns').project.id).trails).toHaveLength(
      5,
    );
    expect(publishedPlannerCurationForProject(byName('Craighead').project.id).parking).toHaveLength(
      1,
    );
    expect(
      homeTownOverviews([byName('Dunino'), byName('Balcomie'), byName('Craighead')]),
    ).toHaveLength(0);
  });

  it('publishes the re-audited Kingsbarns beach and village visitor provision', () => {
    const pkg = byProject('kingsbarns-scotland');
    const curation = publishedPlannerCurationForProject(pkg.project.id);
    expect(topVisitPlaces(pkg, 10).map((place) => place.name)).toEqual([
      'Kingsbarns Beach (Cambo Sands)',
    ]);
    expect(topFoodAndDrink(pkg, 10).map((place) => place.name)).toEqual([
      'The Inn at Kingsbarns',
      'Harbour Burger Kingsbarns',
    ]);
    expect(
      visitorNeedPlaces(pkg, 'trails', 10, { curatedFeatureIds: curation.trails }),
    ).toHaveLength(5);
    expect(
      visitorNeedPlaces(pkg, 'picnic', 10, { curatedFeatureIds: curation.picnic }),
    ).toHaveLength(1);
    expect(
      visitorNeedPlaces(pkg, 'parking', 10, { curatedFeatureIds: curation.parking }),
    ).toHaveLength(1);
    expect(
      visitorNeedPlaces(pkg, 'toilets', 10, { curatedFeatureIds: curation.toilets }),
    ).toHaveLength(1);
  });

  it('publishes the complete Scotscraig-to-Guardbridge audits with attraction-only places kept off the town map', () => {
    const expectations = [
      ['scotscraig-scotland', 0, 0, 1, 0, 0, 0, false],
      ['tayport-scotland', 3, 3, 4, 2, 1, 1, true],
      ['rhynd-fife-scotland', 1, 1, 0, 0, 0, 0, false],
      ['carrick-leuchars-scotland', 0, 0, 0, 0, 0, 0, false],
      ['leuchars-scotland', 1, 0, 2, 0, 1, 0, true],
      ['guardbridge-scotland', 2, 1, 1, 0, 1, 0, true],
    ] as const;
    for (const [id, see, eat, trails, picnic, parking, toilets, mapped] of expectations) {
      const pkg = byProject(id);
      const curation = publishedPlannerCurationForProject(id);
      expect(topVisitPlaces(pkg, 20), `${id} See`).toHaveLength(see);
      expect(topFoodAndDrink(pkg, 20), `${id} Eat`).toHaveLength(eat);
      expect(visitorNeedPlaces(pkg, 'trails', 20, { curatedFeatureIds: curation.trails }), `${id} Trails`).toHaveLength(trails);
      expect(visitorNeedPlaces(pkg, 'picnic', 20, { curatedFeatureIds: curation.picnic }), `${id} Picnic`).toHaveLength(picnic);
      expect(visitorNeedPlaces(pkg, 'parking', 20, { curatedFeatureIds: curation.parking }), `${id} Parking`).toHaveLength(parking);
      expect(visitorNeedPlaces(pkg, 'toilets', 20, { curatedFeatureIds: curation.toilets }), `${id} Toilets`).toHaveLength(toilets);
      expect(homeTownOverviews([pkg]).length > 0, `${id} town-map state`).toBe(mapped);

      const heritage = pkg.features.filter((feature) =>
        feature.tags.some((tag) => (tag.startsWith('hes-') && tag !== 'hes-date-reviewed') || tag === 'nrhe'),
      );
      const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
      expect(visible.every((feature) => Boolean(feature.documentedDateText) && feature.dateBasis !== 'unknown'), `${id} heritage dates`).toBe(true);
      expect(visible.every((feature) => !feature.name.includes(feature.documentedDateText ?? '\u0000')), `${id} clean heritage labels`).toBe(true);
    }
  });

  it('retains every local HES record, dates every visible statutory pin and never appends the date to its map name', () => {
    for (const pkg of stAndrewsCoastPackages) {
      const listed = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building'));
      const visible = listed.filter((feature) => !feature.tags.includes('map-hidden'));
      expect(
        visible.every(
          (feature) => Boolean(feature.documentedDateText) && feature.dateBasis !== 'unknown',
        ),
        pkg.project.id,
      ).toBe(true);
      expect(
        visible.every((feature) => !feature.name.includes(feature.documentedDateText ?? '\u0000')),
        pkg.project.id,
      ).toBe(true);
      expect(
        validateFeatures(pkg.project, pkg.features).some((issue) => issue.severity === 'error'),
        pkg.project.id,
      ).toBe(false);
    }
    const balcomie = byProject('balcomie-scotland');
    expect(
      balcomie.features.filter(
        (feature) =>
          feature.tags.includes('hes-listed-building') &&
          feature.tags.includes('town-selection-inside-locality'),
      ),
    ).toHaveLength(6);
    expect(
      balcomie.features.filter(
        (feature) =>
          feature.tags.includes('hes-listed-building') && !feature.tags.includes('map-hidden'),
      ),
    ).toHaveLength(6);
  });
});

function byProject(id: string) {
  return stAndrewsCoastPackages.find((pkg) => pkg.project.id === id)!;
}
