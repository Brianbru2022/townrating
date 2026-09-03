import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/brechin.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import dog from '../../data/cairn-o-mount-dog-access-curation.json';
import report from '../../data/review/brechin-full-visitor-audit-2026-08-30.json';
import { homeTownOverviews } from '../map/homeOverview';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';

describe('Brechin full visitor audit', () => {
  it('publishes the independently worthwhile settlement at the verified score', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 86, dogOwnerScore: 78, rating: 3, label: 'Strong Destination' });
    expect(homeTownOverviews([pkg as any]).map((town) => town.name)).toEqual(['Brechin']);
    expect((pkg.project as any).visitorHighlights).toHaveLength(5);
    expect((pkg.project as any).visitorHighlights.map((item: any) => item.name)).toEqual([
      'Glencadam Distillery Visitor Centre',
      'Caledonian Railway',
      'Brechin Cathedral and Round Tower',
      'Maison Dieu Chapel',
      'Inch Park and River South Esk',
    ]);
  });

  it('publishes a complete cafe-led planner and practical audit', () => {
    expect((planner as any).projects['brechin-scotland']).toEqual({
      eat: [
        'curated-food:brechin-glencadam-cafe',
        'curated-food:brechin-maison-dieu-coffee',
        'curated-food:brechin-whistle-stop',
        'curated-food:brechin-auld-bakehouse',
        'curated-food:brechin-gourmet-grocer',
      ],
      trails: [
        'curated-trails:brechin-town-circuit',
        'curated-trails:brechin-burghill-circuit',
        'curated-trails:brechin-trinity-circuit',
        'curated-trails:brechin-maisondieu-circuit',
      ],
      picnic: ['curated-picnic:brechin-inch-park'],
      parking: [
        'curated-parking:brechin-church-street',
        'curated-parking:brechin-maisondieu-east',
        'curated-parking:brechin-market-street',
        'curated-parking:brechin-city-road-south',
        'curated-parking:brechin-maisondieu-west',
        'curated-parking:brechin-city-road-west',
        'curated-parking:brechin-railway',
        'curated-parking:brechin-glencadam',
      ],
      toilets: [
        'curated-toilets:brechin-church-street',
        'curated-toilets:brechin-railway',
        'curated-toilets:brechin-glencadam',
      ],
    });
    expect(report.publication).toEqual({ see: 5, eat: 5, trails: 4, picnic: 1, parking: 6, toilets: 3 });
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(5);
    for (const [need, expected] of [['eat', 5], ['trails', 4], ['picnic', 1], ['parking', 6], ['toilets', 3]] as const) {
      expect(visitorNeedPlaces(pkg as any, need, 20, { curatedFeatureIds: (planner as any).projects['brechin-scotland'][need] })).toHaveLength(expected);
    }
    expect(report.practicalAudit.parking).toContain('All six current council car parks');
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Brechin product');
    expect((dog as any).projects['brechin-scotland'].eat['curated-food:brechin-whistle-stop'].status).toBe('welcoming');
  });

  it('keeps every statutory HES record visible and construction-dated without labels in names', () => {
    const statutory = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
    const listed = statutory.filter((feature) => feature.tags.includes('hes-listed-building'));
    const scheduled = statutory.filter((feature) => feature.tags.includes('hes-scheduled-monument'));
    expect(listed).toHaveLength(186);
    expect(scheduled).toHaveLength(2);
    expect(statutory.every((feature) => !feature.tags.includes('map-hidden'))).toBe(true);
    expect(statutory.every((feature) => feature.documentedDateText?.trim() && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown')).toBe(true);
    expect(statutory.every((feature) => !feature.name.includes(feature.documentedDateText))).toBe(true);
    expect(report.heritage).toMatchObject({ representedListedBuildings: 186, representedScheduledMonuments: 2, visibleDatedStatutoryPins: 188, visibleUndatedStatutoryPins: 0, hiddenStatutoryPins: 0 });
    expect(statutorilyDated('hes-listed-building:LB5036')).toBe('c. 1777');
    expect(statutorilyDated('hes-listed-building:LB5040')).toBe('19th century');
    expect(statutorilyDated('hes-scheduled-monument:SM90040')).toBe('1256 / 1260s');
    expect(statutorilyDated('hes-scheduled-monument:SM90041')).toBe('c. 1100; 15th-century spire');

    function statutorilyDated(id: string) {
      return statutory.find((feature) => feature.id === id)?.documentedDateText;
    }
  });

  it('excludes closed and out-of-boundary attractions from the score and cards', () => {
    const curatedNames = (pkg.features as any[]).filter((feature) => feature.id.startsWith('curated-')).map((feature) => feature.name);
    expect(curatedNames).not.toContain('Brechin Town House Museum');
    expect(curatedNames).not.toContain('Brechin Castle Centre');
    expect(report.exclusions).toContain('Brechin Town House Museum: closed since October 2023');
    expect(report.exclusions).toContain('Brechin Castle Centre: outside the strict project boundary');
    expect(report.verification).toMatchObject({ allCuratedCouncilParkingPinsUseOfficialPolygonCentroids: true, allStatutoryHesRecordsVisibleAndDated: true });
  });
});
