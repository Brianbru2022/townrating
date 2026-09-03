import assessment from '../../data/review/cairn-o-mount-deeside-town-assessment-2026-08-27.json';
import fettercairnAudit from '../../data/review/fettercairn-full-visitor-audit-2026-08-27.json';
import potarchAudit from '../../data/review/potarch-full-visitor-audit-2026-08-27.json';
import strachanAudit from '../../data/review/strachan-full-visitor-audit-2026-08-27.json';
import scoreCorrection from '../../data/review/strict-settlement-score-correction-2026-08-30.json';
import { describe, expect, it } from 'vitest';
import { validateFeatures } from '../domain/validation';
import { topFoodAndDrink } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homePoiOverviews, homeTownOverviews } from '../map/homeOverview';
import { cairnOMountPackages } from './cairnOMount';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { publishedProjectPackages } from './publishedProjects';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Cairn o’ Mount to Deeside settlement audit', () => {
  it('removes the artificial sub-60 gate from every affected settlement score', () => {
    expect(scoreCorrection.affectedProjects).toBe(scoreCorrection.results.length);
    expect(scoreCorrection.changedScores).toBe(scoreCorrection.results.filter((row) => row.changed).length);
    expect(scoreCorrection.mappedAfterCorrection).toHaveLength(scoreCorrection.results.filter((row) => row.correctedScore >= 60).length);
    const newGateIds = new Set([
      'craigton-of-monikie-scotland', 'muirdrum-scotland', 'east-haven-scotland', 'panbride-scotland',
      'carnoustie-scotland', 'newbigging-monifieth-scotland', 'barry-angus-scotland', 'mains-of-ardestie-scotland',
      'monifieth-scotland', 'wellbank-scotland', 'drumsturdy-scotland', 'kellas-angus-scotland',
      'baldovie-dundee-scotland', 'barnhill-dundee-scotland', 'west-ferry-dundee-scotland',
      'broughty-ferry-scotland', 'bucklerheads-scotland', 'east-march-angus-scotland',
    ]);
    expect(publishedProjectPackages
      .filter((pkg) => pkg.project.touristAppeal?.methodVersion === '2026-08-30-strict-settlement-gate-v1')
      .every((pkg) => newGateIds.has(pkg.project.id))).toBe(true);
  });

  it('keeps all 12 requested names selectable but maps only 60+ settlements', () => {
    expect(assessment.assessments).toHaveLength(12);
    expect(cairnOMountPackages).toHaveLength(254);
    expect(homeTownOverviews(cairnOMountPackages).map((town) => town.name)).toEqual([
      'Dundee', 'Montrose', 'Broughty Ferry', 'Arbroath', 'Brechin', 'Carnoustie', 'Forfar', 'Monifieth',
      'Kirriemuir', 'Auchmithie', 'Edzell', 'East Haven', 'Fettercairn', 'Auchenblae',
      'Johnshaven', 'Benholm', 'Carmyllie', 'Longforgan', 'St Vigeans', 'Fowlis Easter',
    ]);
  });

  it('reconciles the Elliot to East March request without duplicate records or premature town markers', () => {
    const existingIds = [
      'elliot-arbroath-scotland', 'balmirmer-scotland',
      'kirkton-of-monikie-scotland', 'monikie-scotland',
    ];
    const addedIds = [
      'salmonds-muir-scotland', 'craigton-of-monikie-scotland', 'muirdrum-scotland',
      'east-haven-scotland', 'panbride-scotland', 'carnoustie-scotland',
      'newbigging-monifieth-scotland', 'barry-angus-scotland', 'mains-of-ardestie-scotland',
      'monifieth-scotland', 'wellbank-scotland', 'drumsturdy-scotland',
      'kellas-angus-scotland', 'baldovie-dundee-scotland', 'barnhill-dundee-scotland',
      'west-ferry-dundee-scotland', 'broughty-ferry-scotland', 'bucklerheads-scotland',
      'east-march-angus-scotland',
    ];
    const resolved = cairnOMountPackages.filter((pkg) => [...existingIds, ...addedIds].includes(pkg.project.id));
    expect(resolved).toHaveLength(23);
    expect(addedIds.every((id) => cairnOMountPackages.filter((pkg) => pkg.project.id === id).length === 1)).toBe(true);
    expect(homeTownOverviews(resolved).map((town) => town.name)).toEqual([
      'Broughty Ferry', 'Carnoustie', 'Monifieth', 'East Haven',
    ]);
    expect(resolved.find((pkg) => pkg.project.id === 'craigton-of-monikie-scotland')?.project.name).toBe('Craigton of Monikie');
    expect(resolved.find((pkg) => pkg.project.id === 'baldovie-dundee-scotland')?.project.region).toBe('Dundee City');
    expect(resolved.find((pkg) => pkg.project.id === 'bucklerheads-scotland')?.project.name).toBe('Bucklerheads');
  });

  it('adds the Montrose to Lunan cluster without borrowing estate or neighbouring value', () => {
    const ids = [
      'montrose-scotland', 'inchbraoch-scotland', 'ferryden-scotland',
      'kirkton-of-craig-scotland', 'dunninald-scotland', 'fishtown-of-usan-scotland',
      'braehead-of-lunan-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(7);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Montrose']);
    expect(additions.filter((pkg) => pkg.project.id !== 'montrose-scotland').every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(additions.find((pkg) => pkg.project.id === 'fishtown-of-usan-scotland')?.project.name).toBe('Fishtown of Usan');
  });

  it('adds the resolved Bridge of Dun to Bolshan places without duplicates or attraction inflation', () => {
    const ids = [
      'bridge-of-dun-scotland', 'barnhead-angus-scotland', 'bonnyton-barnhead-scotland',
      'carcary-scotland', 'westerton-of-rossie-scotland', 'lunan-scotland',
      'redcastle-angus-scotland', 'bolshan-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'braehead-of-lunan-scotland')).toHaveLength(1);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'westerton-of-rossie-scotland')).toHaveLength(1);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'dun-angus-scotland')).toHaveLength(1);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'bridge-of-dun-scotland')).toHaveLength(1);
    const heritage = [...additions, cairnOMountPackages.find((pkg) => pkg.project.id === 'braehead-of-lunan-scotland')!]
      .flatMap((pkg) => pkg.features)
      .filter((feature) => feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)));
    expect(heritage.length).toBeGreaterThan(0);
    expect(heritage.filter((feature) => !feature.documentedDateText?.trim() && !feature.tags.includes('map-hidden'))).toEqual([]);
  });

  it('adds the Friockheim to Chapeltown batch with contextual names and strict map gating', () => {
    const ids = [
      'friockheim-scotland', 'boysack-scotland', 'inverkeilor-scotland',
      'ethie-mains-scotland', 'ethie-castle-scotland', 'drunkendub-scotland',
      'auchmithie-scotland', 'marywell-arbroath-scotland', 'hayshead-arbroath-scotland',
      'cliffburn-arbroath-scotland', 'arbroath-scotland', 'elliot-arbroath-scotland',
      'st-vigeans-scotland', 'letham-grange-scotland', 'cauldcots-scotland',
      'leysmill-scotland', 'chapeltown-inverkeilor-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Arbroath', 'Auchmithie', 'St Vigeans']);
    expect(additions.filter((pkg) => !['arbroath-scotland', 'auchmithie-scotland', 'st-vigeans-scotland'].includes(pkg.project.id)).every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(additions.find((pkg) => pkg.project.id === 'friockheim-scotland')?.project.name).toBe('Friockheim');
    expect(additions.find((pkg) => pkg.project.id === 'arbroath-scotland')?.project.name).toBe('Arbroath');
    expect(publishedProjectPackages.filter((pkg) => pkg.project.name === 'Marywell')).toHaveLength(3);
    expect(additions.find((pkg) => pkg.project.id === 'chapeltown-inverkeilor-scotland')?.project.boundaryConfidence).toBe('low');
    const heritage = additions.flatMap((pkg) => pkg.features).filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)),
    );
    expect(heritage.length).toBeGreaterThan(0);
    expect(heritage.filter((feature) => !feature.documentedDateText?.trim() && !feature.tags.includes('map-hidden'))).toEqual([]);
  });

  it('adds the Dykelands to Pathhead batch without duplicating contextual Redford', () => {
    const ids = [
      'dykelands-scotland', 'benholm-scotland', 'johnshaven-scotland', 'st-cyrus-scotland',
      'ecclesgreig-scotland', 'lochside-st-cyrus-scotland', 'morphie-scotland',
      'pathhead-st-cyrus-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(8);
    expect(additions.every((pkg) => pkg.project.region === 'Aberdeenshire')).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Johnshaven', 'Benholm']);
    expect(additions.filter((pkg) => !['johnshaven-scotland', 'benholm-scotland'].includes(pkg.project.id)).every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'redford-garvock-scotland')).toHaveLength(1);
    expect(additions.find((pkg) => pkg.project.id === 'pathhead-st-cyrus-scotland')?.project.boundaryConfidence).toBe('low');
  });

  it('adds the Sauchieburn to Brechin batch with contextual names kept distinct', () => {
    const ids = [
      'sauchieburn-scotland', 'luthermuir-scotland', 'north-water-bridge-scotland',
      'edzell-scotland', 'pert-angus-scotland', 'marykirk-scotland', 'craigo-angus-scotland',
      'logie-craigo-scotland', 'hillside-montrose-scotland', 'kirkhill-montrose-scotland',
      'dun-angus-scotland', 'brechin-scotland', 'keithock-scotland', 'logie-pert-scotland',
      'muirton-of-ballochy-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(15);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Brechin', 'Edzell']);
    expect(additions.filter((pkg) => !['brechin-scotland', 'edzell-scotland'].includes(pkg.project.id)).every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(additions.find((pkg) => pkg.project.id === 'marykirk-scotland')?.project.name).toBe('Marykirk');
    expect(cairnOMountPackages.filter((pkg) => pkg.project.name === 'Logie')).toHaveLength(1);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.name === 'Hillside')).toHaveLength(1);
  });

  it('adds the Auchenblae-Garvock batch with contextual duplicate names separated', () => {
    const ids = [
      'auchenblae-scotland', 'monboddo-house-scotland', 'mondynes-scotland',
      'brownmuir-fordoun-scotland', 'fordoun-scotland', 'parkneuk-arbuthnott-scotland',
      'arbuthnott-scotland', 'scotston-laurencekirk-scotland',
      'garvock-laurencekirk-scotland', 'redford-garvock-scotland',
      'tulloch-garvock-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.every((pkg) => pkg.project.region === 'Aberdeenshire')).toBe(true);
    expect(additions.filter((pkg) => pkg.project.id !== 'auchenblae-scotland').every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Auchenblae']);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.name === 'Redford')).toHaveLength(2);
    expect(additions.find((pkg) => pkg.project.id === 'monboddo-house-scotland')?.project.name).toBe('Monboddo House');
    expect(additions.find((pkg) => pkg.project.id === 'scotston-laurencekirk-scotland')?.project.name).toBe('Scotston');
    const heritage = additions.flatMap((pkg) => pkg.features).filter((feature) => feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)));
    expect(heritage.length).toBeGreaterThan(0);
    expect(heritage.filter((feature) => !feature.documentedDateText?.trim() && !feature.tags.includes('map-hidden'))).toEqual([]);
  });

  it('adds the Laurencekirk-Fettercairn batch without duplicating existing places', () => {
    const ids = [
      'east-cairnbeg-scotland', 'thainston-scotland', 'mains-of-balnakettle-scotland',
      'bent-laurencekirk-scotland', 'laurencekirk-scotland',
      'mains-of-thornton-laurencekirk-scotland', 'meikle-strath-scotland',
      'inch-of-arnhall-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.every((pkg) => pkg.project.region === 'Aberdeenshire')).toBe(true);
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'clatterin-brig-scotland')).toHaveLength(1);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'glensaugh-scotland')).toHaveLength(1);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'fettercairn-scotland')).toHaveLength(1);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'thainston-scotland')).toHaveLength(1);
    expect(additions.find((pkg) => pkg.project.id === 'meikle-strath-scotland')?.project.name).toBe('Meikle Strath');
    const heritage = additions.flatMap((pkg) => pkg.features).filter((feature) => feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)));
    expect(heritage.length).toBeGreaterThan(0);
    expect(heritage.filter((feature) => !feature.documentedDateText?.trim() && !feature.tags.includes('map-hidden'))).toEqual([]);
  });

  it('adds the Dunnichen to Monikie batch while omitting unresolved Friodell', () => {
    const ids = [
      'dunnichen-scotland', 'letham-angus-scotland', 'pitmuies-scotland', 'idvies-scotland',
      'tulloes-scotland', 'mosston-angus-scotland', 'redford-carmyllie-scotland',
      'greystone-angus-scotland', 'hayhillock-scotland', 'carmyllie-scotland',
      'denhead-of-arbirlot-scotland', 'balmirmer-scotland', 'monikie-scotland',
      'kirkton-of-monikie-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(additions.find((pkg) => pkg.project.id === 'carmyllie-scotland')?.project.touristAppeal?.score).toBe(64);
    expect(additions.filter((pkg) => pkg.project.id !== 'carmyllie-scotland').every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Carmyllie']);
    expect(additions.find((pkg) => pkg.project.id === 'pitmuies-scotland')?.project.name).toBe('Pitmuies');
    expect(additions.find((pkg) => pkg.project.id === 'denhead-of-arbirlot-scotland')?.project.name).toBe('Denhead of Arbirlot');
    expect(additions.find((pkg) => pkg.project.id === 'kirkton-of-monikie-scotland')?.project.name).toBe('Kirkton of Monikie');
    expect(cairnOMountPackages.some((pkg) => /friodell/i.test(pkg.project.name))).toBe(false);
    const heritage = additions.flatMap((pkg) => pkg.features).filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)),
    );
    expect(heritage.length).toBeGreaterThan(0);
    expect(heritage.filter((feature) => !feature.documentedDateText?.trim() && !feature.tags.includes('map-hidden'))).toEqual([]);
  });

  it('adds the Inverarity to Douglastown batch with contextual name resolution', () => {
    const ids = [
      'caldhame-scotland', 'kingsmuir-scotland', 'muir-of-lownie-scotland',
      'craichie-scotland', 'whigstreet-scotland', 'kirkbuddo-scotland',
      'gallowfauld-scotland', 'inverarity-scotland', 'gateside-inverarity-scotland',
      'wester-foffarty-scotland', 'kirkton-glamis-scotland', 'thornton-glamis-scotland',
      'douglastown-angus-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(additions.find((pkg) => pkg.project.id === 'kingsmuir-scotland')?.project.name).toBe('Kingsmuir');
    expect(additions.find((pkg) => pkg.project.id === 'muir-of-lownie-scotland')?.project.name).toBe('Muir of Lownie');
    expect(additions.find((pkg) => pkg.project.id === 'gallowfauld-scotland')?.project.name).toBe('Gallowfauld');
    expect(additions.find((pkg) => pkg.project.id === 'wester-foffarty-scotland')?.project.name).toBe('Wester Foffarty');
    const heritage = additions.flatMap((pkg) => pkg.features).filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)),
    );
    expect(heritage.length).toBeGreaterThan(0);
    expect(heritage.filter((feature) => feature.tags.includes('hes-scheduled-monument')).length).toBeGreaterThan(0);
    expect(heritage.filter((feature) => !feature.documentedDateText?.trim() && !feature.tags.includes('map-hidden'))).toEqual([]);
  });

  it('adds the Glamis to Newtyle batch without borrowing attraction scores', () => {
    const ids = [
      'ruthven-house-angus-scotland', 'leys-of-cossans-scotland', 'glamis-scotland',
      'charleston-glamis-scotland', 'castleton-of-eassie-scotland', 'balkeerie-scotland',
      'kirkinch-scotland', 'eassie-scotland', 'wester-denoon-scotland',
      'nether-handwick-scotland', 'newtyle-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(additions.filter((pkg) => pkg.project.id !== 'glamis-scotland').every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(additions.find((pkg) => pkg.project.id === 'ruthven-house-angus-scotland')?.project.name).toBe('Ruthven House');
    expect(additions.find((pkg) => pkg.project.id === 'castleton-of-eassie-scotland')?.project.name).toBe('Castleton of Eassie');
    expect(additions.find((pkg) => pkg.project.id === 'wester-denoon-scotland')?.project.name).toBe('Wester Denoon');
    const heritage = additions.flatMap((pkg) => pkg.features).filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)),
    );
    expect(heritage.length).toBeGreaterThan(0);
    expect(heritage.filter((feature) => feature.tags.includes('hes-scheduled-monument')).length).toBeGreaterThan(0);
    expect(heritage.filter((feature) => !feature.documentedDateText?.trim() && !feature.tags.includes('map-hidden'))).toEqual([]);
  });

  it('adds the Aberlemno to Guthrie batch without promoting attraction-supported places', () => {
    const ids = [
      'careston-castle-scotland', 'aldbar-castle-scotland', 'netherton-melgund-scotland',
      'mains-of-melgund-scotland', 'aberlemno-scotland', 'pitkennedy-scotland',
      'turin-angus-scotland', 'rescobie-scotland', 'reswallie-scotland',
      'burnside-rescobie-scotland', 'balgavies-scotland', 'milldens-scotland',
      'middle-drums-scotland', 'dubton-guthrie-scotland', 'glasterlaw-scotland',
      'guthrie-angus-scotland', 'kinnell-angus-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(additions.find((pkg) => pkg.project.id === 'rescobie-scotland')?.project.name).toBe('Rescobie');
    expect(additions.find((pkg) => pkg.project.id === 'middle-drums-scotland')?.project.name).toBe('Middle Drums');
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'millden-lodge-scotland')).toHaveLength(1);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.id === 'milldens-scotland')).toHaveLength(1);
    const heritage = additions.flatMap((pkg) => pkg.features).filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)),
    );
    expect(heritage.length).toBeGreaterThan(0);
    expect(heritage.filter((feature) => feature.tags.includes('hes-scheduled-monument')).length).toBeGreaterThan(0);
    expect(heritage.filter((feature) => !feature.documentedDateText?.trim() && !feature.tags.includes('map-hidden'))).toEqual([]);
  });

  it('adds the Glen Clova and Glen Esk locality batch without publishing sub-60 town markers', () => {
    const ids = [
      'clova-angus-scotland', 'wheen-angus-scotland', 'inchgrundle-scotland',
      'tarfside-scotland', 'huntlyhill-scotland', 'millden-lodge-scotland',
      'auchmull-scotland', 'dalbog-scotland', 'gannochy-angus-scotland',
      'witton-angus-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(additions.find((pkg) => pkg.project.id === 'auchmull-scotland')?.project.name).toBe('Auchmull');
    expect(additions.find((pkg) => pkg.project.id === 'huntlyhill-scotland')?.project.name).toBe('Huntlyhill');
  });

  it('adds nine unique Glen Prosen localities and de-duplicates Kilburn', () => {
    const ids = [
      'glenprosen-lodge-scotland', 'kilburn-angus-scotland', 'balnaboth-scotland',
      'prosen-village-scotland', 'easter-lednathie-scotland', 'rottal-scotland',
      'clachnabrain-scotland', 'horniehaugh-scotland', 'dykehead-glen-prosen-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.name === 'Kilburn')).toHaveLength(1);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(additions.find((pkg) => pkg.project.id === 'glenprosen-lodge-scotland')?.project.name).toBe('Glenprosen Lodge');
    expect(additions.find((pkg) => pkg.project.id === 'prosen-village-scotland')?.project.name).toBe('Prosen Village');
  });

  it('adds twenty unique Menmuir and Angus localities and de-duplicates Tigerton', () => {
    const ids = [
      'glenmoy-angus-scotland', 'glenquiech-scotland', 'glenogil-scotland', 'auchnacree-scotland',
      'ogil-angus-scotland', 'fern-angus-scotland', 'newmill-of-inshewan-scotland', 'bridgend-menmuir-scotland',
      'balfield-angus-scotland', 'dunlappie-scotland', 'tillyarblet-scotland', 'kirkton-of-menmuir-scotland',
      'tigerton-scotland', 'mains-of-balhall-scotland', 'lochty-menmuir-scotland', 'belliehill-scotland',
      'little-brechin-scotland', 'west-muir-little-brechin-scotland', 'newtonmill-inchbare-scotland', 'inchbare-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(cairnOMountPackages.filter((pkg) => pkg.project.name === 'Tigerton')).toHaveLength(1);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(additions.find((pkg) => pkg.project.id === 'glenquiech-scotland')?.project.name).toBe('Glenquiech');
    expect(additions.find((pkg) => pkg.project.id === 'dunlappie-scotland')?.project.name).toBe('Dunlappie');
    expect(additions.find((pkg) => pkg.project.id === 'inchbare-scotland')?.project.name).toBe('Inchbare');
  });

  it('adds nine Kirriemuir and Cortachy localities while reusing audited Kirriemuir', () => {
    const ids = [
      'pearsie-scotland', 'cortachy-scotland', 'balloch-rottal-scotland',
      'kirkton-of-kingoldrum-scotland', 'kinnordy-scotland', 'northmuir-scotland',
      'mains-of-ballindarg-scotland', 'westmuir-kirriemuir-scotland', 'kirkton-of-airlie-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(publishedProjectPackages.filter((pkg) => pkg.project.id === 'kirriemuir-scotland')).toHaveLength(1);
    expect(additions.find((pkg) => pkg.project.id === 'pearsie-scotland')?.project.name).toBe('Pearsie');
    expect(additions.find((pkg) => pkg.project.id === 'westmuir-kirriemuir-scotland')?.project.name).toBe('Westmuir');
  });

  it('adds thirteen Forfar-area places and publishes only independently qualifying Forfar', () => {
    const ids = [
      'memus-scotland', 'tannadice-scotland', 'inverquharity-scotland', 'murthill-scotland',
      'finavon-scotland', 'oathlaw-scotland', 'shielhill-memus-scotland', 'carse-gray-scotland',
      'mosside-ballinshoe-scotland', 'lunanhead-scotland', 'forfar-scotland', 'padanaram-scotland',
      'drumgley-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.every((pkg) => pkg.project.region === 'Angus')).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Forfar']);
    expect(additions.find((pkg) => pkg.project.id === 'forfar-scotland')?.project.touristAppeal?.score).toBe(78);
    expect(additions.find((pkg) => pkg.project.id === 'shielhill-memus-scotland')?.project.name).toBe('Shielhill');
    expect(additions.find((pkg) => pkg.project.id === 'mosside-ballinshoe-scotland')?.project.name).toBe('Mosside');
  });

  it('adds the Glen Esk and Drumtochty properties without duplicating existing places', () => {
    const ids = [
      'invermark-lodge-scotland', 'auchronie-glenesk-scotland',
      'cairncross-glenesk-scotland', 'drumtochty-castle-scotland',
    ];
    const additions = cairnOMountPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining([
      'Invermark Lodge', 'Auchronie', 'Cairncross', 'Drumtochty Castle',
    ]));
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(publishedProjectPackages.filter((pkg) => pkg.project.id === 'bridge-of-dye-scotland')).toHaveLength(1);
    expect(publishedProjectPackages.filter((pkg) => pkg.project.id === 'glendye-lodge-scotland')).toHaveLength(1);
    expect(publishedProjectPackages.filter((pkg) => pkg.project.name === 'Auchronie')).toHaveLength(1);
    expect(publishedProjectPackages.filter((pkg) => pkg.project.name === 'East Auchronie')).toHaveLength(1);
  });

  it('retains the Glen Esk and Drumtochty heritage import without exposing undated heat pins', () => {
    const ids = new Set([
      'invermark-lodge-scotland', 'auchronie-glenesk-scotland',
      'cairncross-glenesk-scotland', 'drumtochty-castle-scotland',
    ]);
    const heritage = cairnOMountPackages.filter((pkg) => ids.has(pkg.project.id)).flatMap((pkg) =>
      pkg.features.filter((feature) => feature.id.startsWith('hes-') || feature.id.startsWith('nrhe:')),
    );
    expect(heritage.length).toBeGreaterThan(0);
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(visible.every((feature) => Boolean(
      feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null,
    ))).toBe(true);
    expect(visible.filter((feature) => !feature.documentedDateText?.trim())).toHaveLength(0);
  });

  it('keeps every reviewed locality in the regional selector catalogue', () => {
    const published = new Set(publishedProjectPackages.map((pkg) => pkg.project.id));
    for (const pkg of cairnOMountPackages) expect(published.has(pkg.project.id)).toBe(true);
  });

  it('ships boundaries, heat-map evidence and separate dog-owner scores', () => {
    for (const pkg of cairnOMountPackages) {
      expect(pkg.project.touristAppeal?.dogOwnerScore).toBeLessThanOrEqual(
        pkg.project.touristAppeal?.score ?? 0,
      );
      expect(
        validateFeatures(pkg.project, pkg.features).some((result) => result.severity === 'error'),
      ).toBe(false);
    }
  });

  it('keeps facility evidence precise and confirms only sourced dog friendliness', () => {
    expect(publishedPlannerCurationForProject('fettercairn-scotland').parking).toEqual([
      'curated-parking:fettercairn-cross-car-park',
    ]);
    expect(
      cairnOMountPackages
        .find((pkg) => pkg.project.id === 'fettercairn-scotland')
        ?.features.find((feature) => feature.id === 'curated-parking:fettercairn-cross-car-park')
        ?.shortDescription,
    ).toContain('13 unmarked spaces');
    expect(
      publishedDogAccessForPlace('potarch-scotland', 'eat', 'curated-eat:potarch-cafe'),
    ).toMatchObject({ rating: 3, status: 'welcoming' });
    expect(
      publishedDogAccessForPlace(
        'fettercairn-scotland',
        'attraction',
        'curated-attraction:fettercairn-distillery',
      ),
    ).toMatchObject({ rating: 0, status: 'unconfirmed' });
  });

  it('publishes the complete Fettercairn visitor contract without inflating uncertain places', () => {
    const fettercairn = cairnOMountPackages.find(
      (pkg) => pkg.project.id === 'fettercairn-scotland',
    );
    const planner = publishedPlannerCurationForProject('fettercairn-scotland');
    expect(fettercairn?.project.touristAppeal).toMatchObject({
      score: 67,
      dogOwnerScore: 66,
      dogAccessRating: 1,
    });
    expect(fettercairn?.project.visualIdentity?.heroImage).toBe(
      '/town-guides/fettercairn-royal-arch-watercolour-guide-v1.png',
    );
    expect(topVisitPlaces(fettercairn!, 10).map((place) => place.name)).toEqual([
      'Fettercairn Royal Arch',
      'Fettercairn Historic Village Walk',
    ]);
    expect(
      homePoiOverviews(cairnOMountPackages, 'attraction', 100).find(
        (place) => place.name === 'Fettercairn Distillery',
      ),
    ).toMatchObject({ discoveryScope: 'standalone', visitorScore: 84 });
    expect(topFoodAndDrink(fettercairn!, 10).map((place) => place.name)).toEqual([
      'The Arch Cafe and Bistro',
    ]);
    expect(planner).toMatchObject({
      eat: ['curated-eat:fettercairn-arch-cafe'],
      parking: ['curated-parking:fettercairn-cross-car-park'],
      toilets: ['curated-toilets:fettercairn-comfort-toilet'],
    });
    expect(planner.trails).toEqual([
      'curated-trails:fettercairn-village-circuit',
      'curated-trails:fettercairn-laurencekirk-cycle-loop',
    ]);
    expect(fettercairnAudit.exclusions.some((item) => item.includes('Treasure Trails'))).toBe(true);
    expect(fettercairnAudit.heritageDateAudit).toMatchObject({ pins: 26, dated: 26, undated: [] });
  });

  it('keeps Strachan below 60 and moves its visitor reasons to standalone See', () => {
    const strachan = cairnOMountPackages.find((pkg) => pkg.project.id === 'strachan-scotland');
    const planner = publishedPlannerCurationForProject('strachan-scotland');
    expect(strachan?.project.touristAppeal).toMatchObject({ score: 44, dogOwnerScore: 43 });
    expect(strachan?.project.visualIdentity?.heroImage).toBe(
      '/town-guides/strachan-kirk-feughside-watercolour-guide-v1.png',
    );
    expect(topVisitPlaces(strachan!, 10)).toEqual([]);
    expect(
      homePoiOverviews(cairnOMountPackages, 'attraction', 100)
        .filter((place) => place.projectId === 'strachan-scotland')
        .map((place) => place.name),
    ).toEqual(['Strachan–Scolty Hill Circuit']);
    expect(topFoodAndDrink(strachan!, 10)).toEqual([]);
    expect(planner).toEqual({
      eat: [],
      trails: ['curated-trails:strachan-scolty-circuit', 'curated-trails:strachan-core-paths'],
      parking: [],
      toilets: [],
      picnic: [],
    });
    expect(
      publishedDogAccessForPlace(
        'strachan-scotland',
        'attraction',
        'curated-attraction:strachan-scolty-circuit',
      ),
    ).toMatchObject({ rating: 2, status: 'restricted' });
    expect(
      publishedDogAccessForPlace(
        'strachan-scotland',
        'attraction',
        'curated-attraction:strachan-heritage-centre',
      ),
    ).toMatchObject({ rating: 0, status: 'unconfirmed' });
    expect(strachanAudit.exclusions.some((item) => item.includes('Treasure Trails'))).toBe(true);
    expect(strachanAudit.heritageDateAudit).toMatchObject({ pins: 2, dated: 2, undated: [] });
  });

  it('keeps Potarch below 60 while retaining its bridge and green under See', () => {
    const potarch = cairnOMountPackages.find((pkg) => pkg.project.id === 'potarch-scotland');
    const planner = publishedPlannerCurationForProject('potarch-scotland');
    expect(potarch?.project.touristAppeal).toMatchObject({
      score: 42,
      dogOwnerScore: 41,
      dogAccessScoreAdjustment: -1,
      dogAccessRating: 3,
    });
    expect(potarch?.project.visualIdentity?.heroImage).toBe(
      '/town-guides/potarch-bridge-river-dee-watercolour-guide-v1.png',
    );
    expect(topVisitPlaces(potarch!, 10)).toEqual([]);
    expect(
      homePoiOverviews(cairnOMountPackages, 'attraction', 100)
        .filter((place) => place.projectId === 'potarch-scotland')
        .map((place) => place.name),
    ).toEqual(['Potarch Bridge and Dinnie Stones', 'Potarch Green and River Dee']);
    expect(topFoodAndDrink(potarch!, 10).map((place) => place.name)).toEqual([
      'Potarch Cafe and Restaurant',
    ]);
    expect(planner).toEqual({
      eat: ['curated-eat:potarch-cafe'],
      trails: ['curated-trails:potarch-craigmore-circular', 'curated-trails:potarch-deeside-way'],
      parking: ['curated-parking:potarch-green-parking', 'curated-parking:potarch-cafe-parking'],
      toilets: ['curated-toilets:potarch-green-public-toilet'],
      picnic: ['curated-picnic:potarch-green-picnic'],
    });
    expect(
      publishedDogAccessForPlace(
        'potarch-scotland',
        'attraction',
        'curated-attraction:potarch-bridge-dinnie-stones',
      ),
    ).toMatchObject({ rating: 2, status: 'restricted' });
    expect(
      publishedDogAccessForPlace(
        'potarch-scotland',
        'attraction',
        'curated-trails:potarch-craigmore-circular',
      ),
    ).toMatchObject({ rating: 3, status: 'welcoming' });
    expect(
      publishedDogAccessForPlace('potarch-scotland', 'eat', 'curated-eat:potarch-cafe'),
    ).toMatchObject({ rating: 3, status: 'welcoming' });
    expect(potarchAudit.exclusions.some((item) => item.includes('Treasure Trails'))).toBe(true);
    expect(potarchAudit.heritageDateAudit).toMatchObject({ pins: 1, dated: 1, undated: [] });
  });
});
