import { describe, expect, it } from 'vitest';
import { townScoreBand } from '../domain/tourism';
import { topVisitPlaces } from '../domain/visiting';
import { homePoiOverviews, homeTownOverviews } from '../map/homeOverview';
import { aberdeenNorthPackages } from './aberdeenNorth';
import { publishedProjectPackages } from './publishedProjects';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';
import { visitorNeedPlaces } from '../domain/visitorExperience';

describe('Aberdeen north settlement publication gate', () => {
  it('keeps every resolved locality selectable with a canonical score', () => {
    expect(aberdeenNorthPackages).toHaveLength(200);
    expect(aberdeenNorthPackages.every((pkg) => Number.isFinite(pkg.project.touristAppeal?.score))).toBe(true);
    expect(aberdeenNorthPackages.every((pkg) =>
      publishedProjectPackages.some((candidate) => candidate.project.id === pkg.project.id),
    )).toBe(true);
  });

  it('adds the Banchory and Strachan localities without duplicating existing projects', () => {
    const ids = [
      'tillydrine-scotland', 'brathens-scotland', 'backhill-of-trustach-scotland',
      'bridge-of-canny-scotland', 'east-mains-banchory-scotland', 'arbeadie-scotland',
      'auchattie-scotland', 'belts-of-collonach-scotland', 'tillygarmond-scotland',
    ];
    const additions = aberdeenNorthPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining([
      'Tillydrine', 'Brathens', 'Backhill of Trustach', 'Bridge of Canny', 'East Mains',
      'Arbeadie', 'Auchattie', 'Belts of Collonach', 'Tillygarmond',
    ]));
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(publishedProjectPackages.filter((pkg) => pkg.project.id === 'deebank-scotland')).toHaveLength(1);
    expect(publishedProjectPackages.filter((pkg) => pkg.project.id === 'strachan-scotland')).toHaveLength(1);
    expect(publishedProjectPackages.filter((pkg) => pkg.project.id === 'woodside-of-arbeadie-scotland')).toHaveLength(1);
  });

  it('retains the Banchory and Strachan local heritage import without exposing undated heat pins', () => {
    const ids = new Set([
      'tillydrine-scotland', 'brathens-scotland', 'backhill-of-trustach-scotland',
      'bridge-of-canny-scotland', 'east-mains-banchory-scotland', 'arbeadie-scotland',
      'auchattie-scotland', 'belts-of-collonach-scotland', 'tillygarmond-scotland',
    ]);
    const heritage = aberdeenNorthPackages.filter((pkg) => ids.has(pkg.project.id)).flatMap((pkg) =>
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

  it('adds the Dinnet to Finzean cluster with canonical names and conservative scores', () => {
    const ids = [
      'dinnet-scotland', 'glen-tanar-house-scotland', 'aboyne-scotland', 'birsemore-scotland',
      'birse-scotland', 'kincardine-oneil-scotland', 'marywell-birse-scotland', 'finzean-scotland',
      'percie-scotland', 'ballochan-scotland',
    ];
    const additions = aberdeenNorthPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining([
      'Dinnet', 'Glen Tanar House', 'Aboyne', 'Birsemore', 'Birse', "Kincardine O'Neil",
      'Marywell', 'Finzean', 'Percie', 'Ballochan',
    ]));
    expect(additions.filter((pkg) => !['aboyne-scotland', 'kincardine-oneil-scotland', 'finzean-scotland'].includes(pkg.project.id))
      .every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Aboyne', "Kincardine O'Neil", 'Finzean']);
    expect(additions.find((pkg) => pkg.project.id === 'aboyne-scotland')?.project.touristAppeal?.score).toBe(86);
    expect(additions.find((pkg) => pkg.project.id === 'kincardine-oneil-scotland')?.project.touristAppeal?.score).toBe(79);
    expect(additions.find((pkg) => pkg.project.id === 'finzean-scotland')?.project.touristAppeal?.score).toBe(66);
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.name === 'Marywell')).toHaveLength(2);
    expect(publishedProjectPackages.filter((pkg) => pkg.project.id.includes('kincardine')).map((pkg) => pkg.project.id)).toEqual(expect.arrayContaining([
      'kincardine-on-forth-scotland', 'kincardine-oneil-scotland',
    ]));
  });

  it('retains the Dinnet to Finzean local heritage import without exposing undated heat pins', () => {
    const ids = new Set([
      'dinnet-scotland', 'glen-tanar-house-scotland', 'aboyne-scotland', 'birsemore-scotland',
      'birse-scotland', 'kincardine-oneil-scotland', 'marywell-birse-scotland', 'finzean-scotland',
      'percie-scotland', 'ballochan-scotland',
    ]);
    const heritage = aberdeenNorthPackages.filter((pkg) => ids.has(pkg.project.id)).flatMap((pkg) =>
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

  it('adds the Torphins and Midmar cluster with distinct nearby localities and conservative scores', () => {
    const ids = [
      'milton-of-corsindae-scotland', 'bankhead-midmar-scotland', 'corsindae-scotland',
      'comers-midmar-scotland', 'drumlasie-scotland', 'tillybirloch-scotland',
      'milton-of-campfield-scotland', 'torphins-scotland', 'mid-beltie-scotland', 'midmar-scotland',
    ];
    const additions = aberdeenNorthPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining([
      'Milton of Corsindae', 'Bankhead', 'Corsindae', 'Comers', 'Drumlasie', 'Tillybirloch',
      'Milton of Campfield', 'Torphins', 'Mid Beltie', 'Midmar',
    ]));
    expect(additions.filter((pkg) => pkg.project.id !== 'torphins-scotland')
      .every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Torphins']);
    expect(additions.find((pkg) => pkg.project.id === 'torphins-scotland')?.project.touristAppeal?.score).toBe(68);
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.name === 'Bankhead')).toHaveLength(2);
  });

  it('retains the Torphins and Midmar local heritage import without exposing undated heat pins', () => {
    const ids = new Set([
      'milton-of-corsindae-scotland', 'bankhead-midmar-scotland', 'corsindae-scotland',
      'comers-midmar-scotland', 'drumlasie-scotland', 'tillybirloch-scotland',
      'milton-of-campfield-scotland', 'torphins-scotland', 'mid-beltie-scotland', 'midmar-scotland',
    ]);
    const heritage = aberdeenNorthPackages.filter((pkg) => ids.has(pkg.project.id)).flatMap((pkg) =>
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

  it('retains Leochel-Cushnie and promotes Lumphanan only after its rounded village audit', () => {
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.id === 'leochel-cushnie-scotland')).toHaveLength(1);
    expect(aberdeenNorthPackages.find((pkg) => pkg.project.id === 'leochel-cushnie-scotland')?.project.touristAppeal?.score).toBe(38);
    const ids = [
      'kintocher-scotland', 'findrack-house-scotland', 'lumphanan-scotland', 'craskins-scotland',
      'milton-of-auchinhove-scotland', 'auchlossan-scotland',
    ];
    const additions = aberdeenNorthPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining([
      'Kintocher', 'Findrack House', 'Lumphanan', 'Craskins', 'Milton of Auchinhove', 'Auchlossan',
    ]));
    expect(additions.filter((pkg) => pkg.project.id !== 'lumphanan-scotland')
      .every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Lumphanan']);
    expect(additions.find((pkg) => pkg.project.id === 'lumphanan-scotland')?.project.touristAppeal?.score).toBe(76);
  });

  it('retains the Lumphanan-area local heritage import without exposing undated heat pins', () => {
    const ids = new Set([
      'kintocher-scotland', 'findrack-house-scotland', 'lumphanan-scotland', 'craskins-scotland',
      'milton-of-auchinhove-scotland', 'auchlossan-scotland',
    ]);
    const heritage = aberdeenNorthPackages.filter((pkg) => ids.has(pkg.project.id)).flatMap((pkg) =>
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

  it('adds the Tarland to Ordie cluster without promoting attraction-supported localities', () => {
    const ids = [
      'migvie-scotland', 'easter-davoch-scotland', 'douneside-scotland', 'tarland-scotland',
      'coynach-scotland', 'logie-coldstone-scotland', 'milton-of-logie-scotland',
      'glendavan-house-scotland', 'ordie-scotland',
    ];
    const additions = aberdeenNorthPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining([
      'Migvie', 'Easter Davoch', 'Douneside', 'Tarland', 'Coynach', 'Logie Coldstone',
      'Milton of Logie', 'Glendavan House', 'Ordie',
    ]));
    expect(additions.filter((pkg) => pkg.project.id !== 'tarland-scotland')
      .every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Tarland']);
    expect(additions.find((pkg) => pkg.project.id === 'tarland-scotland')?.project.touristAppeal?.score).toBe(82);
    expect(additions.find((pkg) => pkg.project.id === 'douneside-scotland')?.project.townGuide?.intro).toContain('do not support a town rating');
  });

  it('retains the Tarland to Ordie local heritage import without exposing undated heat pins', () => {
    const ids = new Set([
      'migvie-scotland', 'easter-davoch-scotland', 'douneside-scotland', 'tarland-scotland',
      'coynach-scotland', 'logie-coldstone-scotland', 'milton-of-logie-scotland',
      'glendavan-house-scotland', 'ordie-scotland',
    ]);
    const heritage = aberdeenNorthPackages.filter((pkg) => ids.has(pkg.project.id)).flatMap((pkg) =>
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

  it('adds the Mossat to Towie cluster without promoting attraction-supported localities', () => {
    const ids = [
      'mossat-scotland', 'rinmore-glenkindie-scotland', 'kildrummy-scotland', 'sinnahard-scotland',
      'milltown-of-towie-scotland', 'towie-scotland', 'glenkindie-scotland', 'boultenstone-scotland',
    ];
    const additions = aberdeenNorthPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining([
      'Mossat', 'Rinmore', 'Kildrummy', 'Sinnahard', 'Milltown of Towie', 'Towie', 'Glenkindie', 'Boultenstone',
    ]));
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
    expect(additions.find((pkg) => pkg.project.id === 'kildrummy-scotland')?.project.townGuide?.intro).toContain('Kildrummy Castle is a separate See attraction');
  });

  it('retains the Mossat to Towie local heritage import without exposing undated heat pins', () => {
    const ids = new Set([
      'mossat-scotland', 'rinmore-glenkindie-scotland', 'kildrummy-scotland', 'sinnahard-scotland',
      'milltown-of-towie-scotland', 'towie-scotland', 'glenkindie-scotland', 'boultenstone-scotland',
    ]);
    const heritage = aberdeenNorthPackages.filter((pkg) => ids.has(pkg.project.id)).flatMap((pkg) =>
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

  it('adds the Alford and Cushnie cluster with normalised names and conservative publication scores', () => {
    const ids = [
      'tullynessle-scotland', 'montgarrie-scotland', 'bridge-of-alford-scotland',
      'auchintoul-alford-scotland', 'alford-aberdeenshire-scotland', 'asloun-scotland',
      'hillockhead-glenkindie-scotland', 'ley-glenkindie-scotland', 'little-lynturk-scotland',
      'bridgend-muir-of-fowlis-scotland', 'tillyfour-tough-scotland', 'muir-of-fowlis-scotland',
      'leochel-cushnie-scotland', 'milton-of-cushnie-scotland',
    ];
    const additions = aberdeenNorthPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining([
      'Tullynessle', 'Montgarrie', 'Bridge of Alford', 'Auchintoul', 'Alford', 'Asloun',
      'Hillockhead', 'Ley', 'Little Lynturk', 'Bridgend', 'Tillyfour', 'Muir of Fowlis',
      'Leochel-Cushnie', 'Milton of Cushnie',
    ]));
    expect(additions.filter((pkg) => pkg.project.id !== 'alford-aberdeenshire-scotland')
      .every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Alford']);
    expect(additions.find((pkg) => pkg.project.id === 'alford-aberdeenshire-scotland')?.project.touristAppeal?.score).toBe(84);
  });

  it('retains the Alford and Cushnie local heritage import without exposing undated heat pins', () => {
    const ids = new Set([
      'tullynessle-scotland', 'montgarrie-scotland', 'bridge-of-alford-scotland',
      'auchintoul-alford-scotland', 'alford-aberdeenshire-scotland', 'asloun-scotland',
      'hillockhead-glenkindie-scotland', 'ley-glenkindie-scotland', 'little-lynturk-scotland',
      'bridgend-muir-of-fowlis-scotland', 'tillyfour-tough-scotland', 'muir-of-fowlis-scotland',
      'leochel-cushnie-scotland', 'milton-of-cushnie-scotland',
    ]);
    const heritage = aberdeenNorthPackages.filter((pkg) => ids.has(pkg.project.id)).flatMap((pkg) =>
      pkg.features.filter((feature) => feature.id.startsWith('hes-') || feature.id.startsWith('nrhe:')),
    );
    expect(heritage).toHaveLength(165);
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(visible.every((feature) => Boolean(
      feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null,
    ))).toBe(true);
    expect(visible.filter((feature) => !feature.documentedDateText?.trim())).toHaveLength(0);
  });

  it('adds the Keig and Pitfichie cluster without promoting attraction-supported localities', () => {
    const ids = [
      'keig-scotland',
      'castle-forbes-scotland',
      'upper-woodend-scotland',
      'rorandle-scotland',
      'pitfichie-scotland',
      'gateside-keig-scotland',
      'pitmunie-scotland',
      'todlachie-scotland',
      'ordhead-scotland',
      'tillyfourie-scotland',
      'kirkton-of-tough-scotland',
      'whitehouse-tough-scotland',
    ];
    const additions = aberdeenNorthPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(ids.length);
    expect(additions.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining([
      'Keig', 'Castle Forbes', 'Upper Woodend', 'Rorandle', 'Pitfichie', 'Gateside',
      'Pitmunie', 'Todlachie', 'Ordhead', 'Tillyfourie', 'Kirkton of Tough', 'Whitehouse',
    ]));
    expect(additions.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(additions)).toEqual([]);
  });

  it('retains the complete local HES and NRHE import while exposing no undated heat pins', () => {
    const ids = new Set([
      'keig-scotland', 'castle-forbes-scotland', 'upper-woodend-scotland', 'rorandle-scotland',
      'pitfichie-scotland', 'gateside-keig-scotland', 'pitmunie-scotland', 'todlachie-scotland',
      'ordhead-scotland', 'tillyfourie-scotland', 'kirkton-of-tough-scotland', 'whitehouse-tough-scotland',
    ]);
    const additions = aberdeenNorthPackages.filter((pkg) => ids.has(pkg.project.id));
    const heritage = additions.flatMap((pkg) => pkg.features.filter((feature) =>
      feature.id.startsWith('hes-') || feature.id.startsWith('nrhe:'),
    ));
    expect(heritage).toHaveLength(102);
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(visible.every((feature) => Boolean(
      feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null,
    ))).toBe(true);
    expect(visible.filter((feature) => !feature.documentedDateText?.trim())).toHaveLength(0);
  });

  it('normalises the confirmed Pottorton spelling correction without duplicating Potterton', () => {
    expect(aberdeenNorthPackages.map((pkg) => pkg.project.name)).toEqual(
      expect.arrayContaining(['Parkhill House', 'Stoneywood', 'Potterton']),
    );
    expect(aberdeenNorthPackages.some((pkg) => /pottorton/i.test(pkg.project.name))).toBe(false);
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.id === 'potterton-scotland')).toHaveLength(1);
  });

  it('publishes only independently qualifying settlements at the 60+ town-map threshold', () => {
    const mapped = aberdeenNorthPackages.filter((pkg) => (pkg.project.touristAppeal?.score ?? 0) >= 60);
    expect(mapped.map((pkg) => pkg.project.name)).toEqual([
      'Aberdeen',
      'Bridge of Don',
      'Cove Bay',
      'Kemnay',
      'Kintore',
      'Monymusk',
      'Old Aberdeen',
      'Peterculter',
      'Torry',
      'Findon',
      'Newtonhill',
      'Muchalls',
      'Banchory',
      'Alford',
      'Tarland',
      'Lumphanan',
      'Torphins',
      'Aboyne',
      "Kincardine O'Neil",
      'Finzean',
    ]);
    expect(townScoreBand(mapped[0].project.touristAppeal!.score!)).toMatchObject({
      label: 'Exceptional Destination',
    });
    expect(homeTownOverviews(aberdeenNorthPackages).map((town) => town.name)).toEqual(expect.arrayContaining([
      'Aberdeen',
      'Old Aberdeen',
      'Torry',
      'Bridge of Don',
      'Kemnay',
      'Peterculter',
      'Kintore',
      'Monymusk',
      'Cove Bay',
      'Findon',
      'Muchalls',
      'Banchory',
    ]));
  });

  it('adds the Banchory and Durris batch while keeping attraction-supported localities below 60', () => {
    const additions = [
      'Drumoak',
      'Myrebird',
      'The Neuk',
      'Banchory',
      'Upper Lochton',
      'Woodside of Arbeadie',
      'Bridge of Feugh',
      'Crathes',
      'Kirkton of Durris',
      'Woodlands of Durris',
      'Crossroads',
      'Lochton',
    ];
    const packages = aberdeenNorthPackages.filter((pkg) => additions.includes(pkg.project.name));
    expect(packages).toHaveLength(additions.length);
    expect(packages.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining(additions));
    expect(packages.filter((pkg) => (pkg.project.touristAppeal?.score ?? 0) >= 60).map((pkg) => pkg.project.name))
      .toEqual(['Banchory']);
    expect(homeTownOverviews(packages).map((town) => town.name)).toEqual(['Banchory']);
  });

  it('keeps the major castles and Falls of Feugh as separate See attractions', () => {
    const batch = aberdeenNorthPackages.filter((pkg) =>
      ['drumoak-scotland', 'banchory-scotland', 'crathes-scotland'].includes(pkg.project.id),
    );
    expect(homePoiOverviews(batch, 'attraction').map((place) => place.name)).toEqual(expect.arrayContaining([
      'Drum Castle, Garden & Estate',
      'Falls of Feugh',
      'Crathes Castle, Garden & Estate',
    ]));
    expect(batch.find((pkg) => pkg.project.id === 'drumoak-scotland')?.project.touristAppeal?.score).toBeLessThan(60);
    expect(batch.find((pkg) => pkg.project.id === 'crathes-scotland')?.project.touristAppeal?.score).toBeLessThan(60);
  });

  it('publishes Banchory only after its full visitor and practical audit', () => {
    const pkg = aberdeenNorthPackages.find((candidate) => candidate.project.id === 'banchory-scotland')!;
    const curation = publishedPlannerCurationForProject(pkg.project.id);
    expect(pkg.project.touristAppeal).toMatchObject({ score: 74, dogOwnerScore: 72, dogAccessRating: 2 });
    expect(pkg.project.preferredBasemap).toBe('voyager');
    expect(pkg.project.visitorHighlights?.map((place) => [place.name, place.visitorScore])).toEqual([
      ['Falls of Feugh', 82],
      ['Banchory Museum', 73],
      ['Banchory-Ternan Old Church and Kirkyard', 68],
    ]);
    expect(topVisitPlaces(pkg, 10).map((place) => place.name)).toEqual([
      'Falls of Feugh',
      'Banchory Museum',
      'Banchory-Ternan Old Church and Kirkyard',
    ]);
    expect(curation.trails).toEqual([
      'curated-trails:banchory-town-park-riverside-treasure-trail',
      'curated-trails:banchory-council-treasure-trail',
      'curated-trails:banchory-walking-routes',
      'curated-trails:deeside-way-banchory',
    ]);
    expect(pkg.features.find((feature) => feature.id === curation.trails![0])?.visitorWebsiteUrl)
      .toBe('https://www.treasuretrails.co.uk/products/things-to-do-banchory-aberdeenshire');
    expect(curation.eat).toHaveLength(5);
    expect(curation.parking).toHaveLength(7);
    expect(curation.toilets).toHaveLength(2);
    expect(curation.picnic).toEqual([]);
    expect(visitorNeedPlaces(pkg, 'eat', 10, { curatedFeatureIds: curation.eat })).toHaveLength(5);
  });

  it('retains Banchory’s complete local HES set and publishes no undated heritage heat pin', () => {
    const pkg = aberdeenNorthPackages.find((candidate) => candidate.project.id === 'banchory-scotland')!;
    const listed = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building'));
    const nrhe = pkg.features.filter((feature) => feature.id.startsWith('nrhe:'));
    const visibleHistoric = pkg.features.filter((feature) =>
      (feature.tags.includes('hes-listed-building') || feature.id.startsWith('nrhe:')) &&
      !feature.tags.includes('map-hidden'),
    );
    expect(listed).toHaveLength(24);
    expect(nrhe).toHaveLength(42);
    expect(pkg.features.some((feature) => feature.tags.includes('hes-scheduled-monument'))).toBe(false);
    expect(visibleHistoric).toHaveLength(46);
    expect(visibleHistoric.every((feature) => Boolean(
      feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null &&
      feature.dateBasis !== 'unknown',
    ))).toBe(true);
    expect(pkg.features.filter((feature) => feature.tags.includes('town-selection-heritage-buffer'))
      .every((feature) => feature.tags.includes('map-hidden') || feature.evidenceScope === 'related_context')).toBe(true);
  });

  it('adds the Portlethen corridor localities without borrowing neighbouring attractions', () => {
    const names = aberdeenNorthPackages.map((pkg) => pkg.project.name);
    expect(names).toEqual(expect.arrayContaining([
      'Marywell',
      'Hillside',
      'Findon',
      'Portlethen',
      'Downies',
      'Newtonhill',
      'Muchalls',
      'Auchlunies',
    ]));
    expect(aberdeenNorthPackages.filter((pkg) => ['Findon', 'Muchalls'].includes(pkg.project.name))
      .every((pkg) => (pkg.project.touristAppeal?.score ?? 0) >= 60)).toBe(true);
    expect(aberdeenNorthPackages.filter((pkg) => ['Marywell', 'Hillside', 'Portlethen', 'Downies', 'Auchlunies'].includes(pkg.project.name))
      .every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
  });

  it('adds the Maryculter, Muchalls and Netherley corridor localities below the town-map threshold', () => {
    const additions = [
      'Mains of Drum',
      'Kirkton of Maryculter',
      'Auchlee',
      'Cammachmore',
      'Chapelton of Elsick',
      'Bridge of Muchalls',
      'Cookney',
      'Muirskie',
      'Upper Burnhaugh',
      'Borrowfield',
      'Netherley',
      'Union Cottage',
      'Denside of Durris',
    ];
    const packages = aberdeenNorthPackages.filter((pkg) => additions.includes(pkg.project.name));
    expect(packages.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining(additions));
    expect(packages).toHaveLength(additions.length);
    expect(packages.every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
    expect(homeTownOverviews(packages)).toEqual([]);
  });

  it('publishes Muchalls only after its full visitor and practical audit', () => {
    const pkg = aberdeenNorthPackages.find((candidate) => candidate.project.id === 'muchalls-scotland')!;
    const curation = publishedPlannerCurationForProject(pkg.project.id);
    expect(pkg.project.touristAppeal).toMatchObject({ score: 65, dogOwnerScore: 64 });
    expect(pkg.project.preferredBasemap).toBe('voyager');
    expect(pkg.project.visualIdentity).toMatchObject({
      theme: 'muchalls-red-rock-cliffs-watercolour',
      heroImage: '/town-guides/muchalls-cliffs-grim-haven-watercolour-guide-v1.png',
      heroObjectPosition: '58% 55%',
    });
    expect(pkg.project.visitorHighlights?.map((place) => place.name)).toEqual([
      '1–7 Monduff Road Fisher Cottages',
      'Muchalls Cliffs and Grim Haven View',
    ]);
    expect(topVisitPlaces(pkg, 10).map((place) => place.name)).toEqual([
      '1–7 Monduff Road Fisher Cottages',
      'Muchalls Cliffs and Grim Haven View',
    ]);
    expect(curation).toEqual({
      eat: ['curated-eat:the-stack-muchalls'],
      trails: ['curated-trails:muchalls-meander'],
      parking: [],
      toilets: [],
      picnic: [],
    });
    expect(visitorNeedPlaces(pkg, 'eat', 10, { curatedFeatureIds: curation.eat }).map((place) => place.name))
      .toEqual(['The Stack Restaurant and Bar']);
    expect(pkg.features.some((place) => /Muchalls Castle|Newtonhill|Stonehaven/i.test(place.name))).toBe(false);
  });

  it('retains Muchalls’ complete imported heritage set while dating every visible historic pin', () => {
    const pkg = aberdeenNorthPackages.find((candidate) => candidate.project.id === 'muchalls-scotland')!;
    const imported = pkg.features.filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-designation', 'nrhe'].includes(tag)),
    );
    const visibleHistoric = pkg.features.filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'historic-place', 'local-heritage-record', 'nrhe'].includes(tag)) &&
      !feature.tags.includes('map-hidden'),
    );
    expect(imported).toHaveLength(18);
    expect(visibleHistoric).toHaveLength(8);
    expect(visibleHistoric.every((feature) => Boolean(
      feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null &&
      feature.dateBasis !== 'unknown',
    ))).toBe(true);
    expect(pkg.features.find((feature) => feature.id === 'hes-conservation-area:CA441')?.tags)
      .toContain('map-hidden');
    expect(pkg.features.filter((feature) => ['nrhe:37229', 'nrhe:244152', 'nrhe:244154'].includes(feature.id))
      .every((feature) => feature.tags.includes('map-hidden'))).toBe(true);
  });

  it('publishes Findon only on its own village and coastal merits', () => {
    const pkg = aberdeenNorthPackages.find((candidate) => candidate.project.id === 'findon-aberdeenshire-scotland')!;
    const curation = publishedPlannerCurationForProject(pkg.project.id);
    expect(pkg.project.touristAppeal).toMatchObject({ score: 61, dogOwnerScore: 60, dogAccessRating: 2 });
    expect(pkg.project.preferredBasemap).toBe('voyager');
    expect(pkg.project.visualIdentity).toMatchObject({
      theme: 'findon-fishing-cove-watercolour',
      heroImage: '/town-guides/findon-fishing-cove-watercolour-guide-v1.png',
      heroObjectPosition: '50% 58%',
    });
    expect(pkg.project.visitorHighlights?.map((place) => [place.name, place.visitorScore])).toEqual([
      ['Findon Fishing Village and Finnan Haddie Story', 67],
      ['Findon Moor Coastal View', 64],
    ]);
    expect(topVisitPlaces(pkg, 10).map((place) => place.name)).toEqual([
      'Findon Fishing Village and Finnan Haddie Story',
      'Findon Moor Coastal View',
    ]);
    expect(curation).toEqual({
      eat: [],
      trails: ['curated-trails:old-portlethen-findon-moor-circuit'],
      parking: [],
      toilets: [],
      picnic: [],
    });
    expect(pkg.features.some((place) => /Chapelton|Cove Bay|Downies/i.test(place.name))).toBe(false);
  });

  it('retains every local Findon NRHE record while publishing no undated heat pins', () => {
    const pkg = aberdeenNorthPackages.find((candidate) => candidate.project.id === 'findon-aberdeenshire-scotland')!;
    const nrhe = pkg.features.filter((feature) => feature.id.startsWith('nrhe:'));
    const visibleHistoric = pkg.features.filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'historic-place', 'local-heritage-record', 'nrhe'].includes(tag)) &&
      !feature.tags.includes('map-hidden'),
    );
    expect(nrhe.map((feature) => feature.id).sort()).toEqual([
      'nrhe:118805', 'nrhe:118806', 'nrhe:183769', 'nrhe:183772', 'nrhe:183773', 'nrhe:37204',
    ]);
    expect(visibleHistoric.map((feature) => feature.id)).toEqual(['nrhe:183772']);
    expect(visibleHistoric.every((feature) => Boolean(
      feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null &&
      feature.tags.includes('date-reviewed'),
    ))).toBe(true);
    expect(nrhe.filter((feature) => feature.id !== 'nrhe:183772')
      .every((feature) => feature.tags.includes('map-hidden'))).toBe(true);
  });

  it('adds the Aberdeen city batch once and normalises Ruthrieston', () => {
    const names = aberdeenNorthPackages.map((pkg) => pkg.project.name);
    expect(names).toEqual(expect.arrayContaining([
      'Kittybrewster',
      'Hayton',
      'Old Aberdeen',
      'Ferryhill',
      'Ruthrieston',
      'Kincorth',
      'Torry',
      'Nigg',
      'Garthdee',
      'Banchory-Devenick',
      'Charlestown',
      'Cove Bay',
      'Aberdeen',
    ]));
    expect(names.some((name) => /Ruthrileston/i.test(name))).toBe(false);
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.name === 'Woodside')).toHaveLength(1);
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.name === 'Bridge of Don')).toHaveLength(1);
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.name === 'Mannofield')).toHaveLength(1);
    expect(aberdeenNorthPackages.find((pkg) => pkg.project.id === 'aberdeen-scotland')?.project.touristAppeal)
      .toMatchObject({ score: 94, dogOwnerScore: 88 });
    expect(aberdeenNorthPackages.find((pkg) => pkg.project.id === 'old-aberdeen-scotland')?.project.touristAppeal)
      .toMatchObject({ score: 86, dogOwnerScore: 80 });
    expect(aberdeenNorthPackages.find((pkg) => pkg.project.id === 'torry-aberdeen-scotland')?.project.touristAppeal)
      .toMatchObject({ score: 76, dogOwnerScore: 75 });
    expect(aberdeenNorthPackages.find((pkg) => pkg.project.id === 'ferryhill-aberdeen-scotland')?.project.touristAppeal?.score).toBe(52);
  });

  it('publishes the full Old Aberdeen audit with no undated heritage pins', () => {
    const pkg = aberdeenNorthPackages.find((candidate) => candidate.project.id === 'old-aberdeen-scotland')!;
    const curation = publishedPlannerCurationForProject(pkg.project.id);
    expect(pkg.project.preferredBasemap).toBe('voyager');
    expect(pkg.project.visualIdentity).toMatchObject({
      theme: 'old-aberdeen-cobbled-granite-quarter',
      heroImage: '/town-guides/old-aberdeen-cobbled-lane-watercolour-guide-v1.png',
      heroObjectPosition: '50% 54%',
    });
    expect(pkg.project.visitorHighlights).toHaveLength(7);
    expect(topVisitPlaces(pkg, 10)).toHaveLength(7);
    expect(visitorNeedPlaces(pkg, 'eat', 12, { curatedFeatureIds: curation.eat })).toHaveLength(8);
    expect(visitorNeedPlaces(pkg, 'trails', 10, { curatedFeatureIds: curation.trails })).toHaveLength(4);
    expect(visitorNeedPlaces(pkg, 'parking', 10, { curatedFeatureIds: curation.parking })).toHaveLength(2);
    expect(visitorNeedPlaces(pkg, 'toilets', 10, { curatedFeatureIds: curation.toilets })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg, 'picnic', 10, { curatedFeatureIds: curation.picnic })).toHaveLength(1);
    const historicPins = pkg.features.filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument'].includes(tag))
      && !feature.tags.includes('map-hidden'));
    expect(historicPins).toHaveLength(158);
    expect(historicPins.some((feature) => feature.id === 'hes-scheduled-monument:SM1907')).toBe(true);
    expect(historicPins.some((feature) => feature.id === 'hes-scheduled-monument:SM90001')).toBe(true);
    expect(historicPins.every((feature) =>
      Boolean(feature.documentedDateText?.trim())
      && feature.earliestPossibleYear != null
      && feature.latestPossibleYear != null
      && feature.dateBasis !== 'unknown')).toBe(true);
    expect(pkg.features.some((feature) => /zoology museum|king.s museum/i.test(feature.name))).toBe(false);
  });

  it('publishes the full Torry audit without borrowing Nigg or central Aberdeen sights', () => {
    const pkg = aberdeenNorthPackages.find((candidate) => candidate.project.id === 'torry-aberdeen-scotland')!;
    const curation = publishedPlannerCurationForProject(pkg.project.id);
    expect(pkg.project.preferredBasemap).toBe('voyager');
    expect(pkg.project.visitorHighlights).toHaveLength(3);
    expect(topVisitPlaces(pkg, 10)).toHaveLength(3);
    expect(visitorNeedPlaces(pkg, 'eat', 10, { curatedFeatureIds: curation.eat })).toHaveLength(4);
    expect(visitorNeedPlaces(pkg, 'trails', 10, { curatedFeatureIds: curation.trails })).toHaveLength(4);
    expect(visitorNeedPlaces(pkg, 'parking', 10, { curatedFeatureIds: curation.parking })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg, 'toilets', 10, { curatedFeatureIds: curation.toilets })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg, 'picnic', 10, { curatedFeatureIds: curation.picnic })).toHaveLength(1);
    expect(pkg.features.some((feature) => !feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument'].includes(tag)) && /girdle ness|st fittick|nigg kirk|footdee/i.test(feature.name))).toBe(false);
    const historicPins = pkg.features.filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument'].includes(tag))
      && !feature.tags.includes('map-hidden'));
    expect(historicPins).toHaveLength(41);
    expect(historicPins.some((feature) => feature.id === 'hes-scheduled-monument:SM10403')).toBe(true);
    expect(historicPins.every((feature) =>
      Boolean(feature.documentedDateText?.trim())
      && feature.earliestPossibleYear != null
      && feature.latestPossibleYear != null
      && feature.dateBasis !== 'unknown')).toBe(true);
  });

  it('publishes Aberdeen only after the full practical and dated-heritage audit', () => {
    const pkg = aberdeenNorthPackages.find((candidate) => candidate.project.id === 'aberdeen-scotland');
    expect(pkg).toBeDefined();
    expect(pkg!.project.preferredBasemap).toBe('voyager');
    expect(pkg!.project.visitorHighlights).toHaveLength(7);
    expect(pkg!.project.visitorHighlights!.every((item) => (item.visitorScore ?? 0) >= 60)).toBe(true);
    const curation = publishedPlannerCurationForProject('aberdeen-scotland');
    expect(topVisitPlaces(pkg!, 10)).toHaveLength(7);
    expect(visitorNeedPlaces(pkg!, 'eat', 10, { curatedFeatureIds: curation.eat })).toHaveLength(4);
    expect(visitorNeedPlaces(pkg!, 'trails', 10, { curatedFeatureIds: curation.trails })).toHaveLength(5);
    expect(visitorNeedPlaces(pkg!, 'parking', 10, { curatedFeatureIds: curation.parking })).toHaveLength(4);
    expect(visitorNeedPlaces(pkg!, 'toilets', 10, { curatedFeatureIds: curation.toilets })).toHaveLength(4);
    expect(visitorNeedPlaces(pkg!, 'picnic', 10, { curatedFeatureIds: curation.picnic })).toHaveLength(1);

    const ids = new Set(pkg!.features.map((feature) => feature.id));
    expect([
      'curated-trails:aberdeen-treasure-trail',
      'curated-trails:aberdeen-granite-trail',
      'curated-eat:aberdeen-foodstory',
      'curated-parking:aberdeen-union-square-college-street',
      'curated-toilets:aberdeen-art-gallery',
      'curated-picnic:aberdeen-duthie-park',
    ].every((id) => ids.has(id))).toBe(true);

    const historicPins = pkg!.features.filter((feature) =>
      feature.tags.includes('hes-listed-building') && !feature.tags.includes('map-hidden'));
    expect(historicPins).toHaveLength(543);
    expect(historicPins.every((feature) =>
      Boolean(feature.documentedDateText?.trim())
      && feature.earliestPossibleYear != null
      && feature.latestPossibleYear != null
      && feature.dateBasis !== 'unknown')).toBe(true);
    expect(pkg!.features.find((feature) => feature.id === 'hes-listed-building:LB19990')?.additionalPointLocations).toHaveLength(1);
    expect(pkg!.features.find((feature) => feature.id === 'hes-listed-building:LB19966')?.additionalPointLocations).toHaveLength(1);
  });

  it('adds the south-west Aberdeen batch once and keeps non-destinations below 60', () => {
    const names = aberdeenNorthPackages.map((pkg) => pkg.project.name);
    expect(names).toEqual(expect.arrayContaining([
      'East Auchronie',
      'Kirkton of Skene',
      'Bucksburn',
      'Woodside',
      'Northfield',
      'Mastrick',
      'Kingswells',
      'Westhill',
      'Cairnie',
      'Elrick',
      'Easter Ord',
      'Blacktop',
      'Mannofield',
      'Cults',
      'Bieldside',
      'Milltimber',
      'Peterculter',
      'Milton of Murtle',
      'Contlaw',
      'Craigton',
    ]));
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.name === 'East Auchronie')).toHaveLength(1);
    expect(aberdeenNorthPackages.find((pkg) => pkg.project.id === 'cairnie-westhill-scotland')?.project.touristAppeal?.score).toBe(18);
    expect(aberdeenNorthPackages.find((pkg) => pkg.project.id === 'peterculter-scotland')?.project.touristAppeal)
      .toMatchObject({ score: 68, dogOwnerScore: 67 });
    expect(
      aberdeenNorthPackages
        .filter((pkg) => [
          'westhill-scotland',
          'cults-scotland',
          'kirkton-of-skene-scotland',
          'milltimber-scotland',
        ].includes(pkg.project.id))
        .every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60),
    ).toBe(true);
  });

  it('normalises the west Aberdeenshire batch and keeps the private or rural localities below 60', () => {
    const names = aberdeenNorthPackages.map((pkg) => pkg.project.name);
    expect(names).toEqual(expect.arrayContaining([
      'Old Kinnernie',
      'Sauchen',
      'Monymusk',
      'Blairdaff',
      'Bograxie',
      'Dunecht',
      'Skene House',
      'Marionburgh',
      'Echt',
      'Garlogie',
      'Redhill',
      'South Kirkton',
      'Landerberry',
      'West Cullerlie',
      'Benthoul',
      'Hardgate',
    ]));
    expect(names.some((name) => /Moneymosk|Dunect|Garlogiue|West Cullery|Benthout/.test(name))).toBe(false);
    expect(aberdeenNorthPackages.find((pkg) => pkg.project.id === 'monymusk-scotland')?.project.touristAppeal)
      .toMatchObject({ score: 67, dogOwnerScore: 64 });
    expect(
      aberdeenNorthPackages
        .filter((pkg) => [
          'dunecht-scotland',
          'garlogie-scotland',
          'echt-scotland',
          'skene-house-scotland',
        ].includes(pkg.project.id))
        .every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60),
    ).toBe(true);
  });

  it('publishes the fully audited Monymusk visitor offer without inflating the town score', () => {
    const monymusk = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'monymusk-scotland')!;
    expect(monymusk.project.touristAppeal).toMatchObject({
      score: 67,
      dogOwnerScore: 64,
      dogAccessRating: 2,
    });
    expect(monymusk.project.visualIdentity?.heroImage)
      .toBe('/town-guides/monymusk-memorial-flowers-watercolour-guide-v2.png');
    expect(monymusk.project.visitorHighlights?.map((place) => [place.name, place.visitorScore])).toEqual([
      ['St Mary’s Parish Church and Monymusk Priory story', 74],
      ['Monymusk Square Heritage Ensemble', 70],
    ]);
    const curation = publishedPlannerCurationForProject(monymusk.project.id);
    expect(curation).toEqual({
      eat: ['curated-eat:monymusk-grant-arms', 'curated-eat:monymusk-thrift-shop'],
      trails: ['curated-trails:monymusk-core-paths', 'curated-trails:monymusk-dam-river-loop'],
      parking: ['curated-parking:monymusk-recreation-south', 'curated-parking:monymusk-recreation-north'],
      toilets: [],
      picnic: ['curated-picnic:monymusk-play-park'],
    });
    expect(topVisitPlaces(monymusk, 10).map((place) => [place.name, place.visitorScore])).toEqual([
      ['St Mary’s Parish Church and Monymusk Priory story', 74],
      ['Monymusk Square Heritage Ensemble', 70],
    ]);
    expect(visitorNeedPlaces(monymusk, 'eat', 10, { curatedFeatureIds: curation.eat })
      .map((place) => [place.name, place.visitorScore])).toEqual([
      ['Grant Arms Café', 72],
      ['Monymusk Village Thrift Shop Tea and Cake', 62],
    ]);
  });

  it('dates every visible Monymusk historic pin with construction evidence', () => {
    const monymusk = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'monymusk-scotland')!;
    const historicPins = monymusk.features.filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument'].includes(tag)) &&
      !feature.tags.includes('map-hidden'),
    );
    expect(historicPins).toHaveLength(31);
    expect(historicPins.every((feature) => Boolean(
      feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null &&
      feature.tags.includes('date-reviewed'),
    ))).toBe(true);
    expect(historicPins.every((feature) =>
      !/listed on|designation date/i.test(feature.documentedDateText ?? ''),
    )).toBe(true);
  });

  it('publishes the fully audited Peterculter visitor offer within the River Dee boundary', () => {
    const peterculter = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'peterculter-scotland')!;
    expect(peterculter.project.touristAppeal).toMatchObject({
      score: 68,
      dogOwnerScore: 67,
      dogAccessRating: 2,
    });
    expect(peterculter.project.visitorHighlights?.map((place) => [place.name, place.visitorScore])).toEqual([
      ['St Peter’s Heritage Centre, Church and Churchyard', 76],
      ['Rob Roy Statue and Culter Burn', 70],
    ]);
    const curation = publishedPlannerCurationForProject(peterculter.project.id);
    expect(curation).toEqual({
      eat: ['curated-eat:peterculter-neil-selbie', 'curated-eat:peterculter-crust'],
      trails: [
        'curated-trails:peterculter-explorer',
        'curated-trails:peterculter-community-paths',
        'curated-trails:peterculter-deeside-way',
      ],
      parking: ['curated-parking:peterculter-st-marys-place', 'curated-parking:peterculter-millside'],
      toilets: [],
      picnic: [],
    });
    expect(topVisitPlaces(peterculter, 10).map((place) => [place.name, place.visitorScore])).toEqual([
      ['St Peter’s Heritage Centre, Church and Churchyard', 76],
      ['Rob Roy Statue and Culter Burn', 70],
    ]);
    expect(visitorNeedPlaces(peterculter, 'eat', 10, { curatedFeatureIds: curation.eat })
      .map((place) => [place.name, place.visitorScore])).toEqual([
      ['Neil Selbie Coffee Shop', 76],
      ['Crust', 70],
    ]);
    expect(peterculter.features.some((feature) => /Maryculter|Belskavie|Waulkmill/.test(feature.name))).toBe(false);
  });

  it('dates every visible Peterculter heritage pin and records parking unknowns explicitly', () => {
    const peterculter = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'peterculter-scotland')!;
    const historicPins = peterculter.features.filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument'].includes(tag)) &&
      !feature.tags.includes('map-hidden'),
    );
    expect(historicPins).toHaveLength(10);
    expect(historicPins.every((feature) => Boolean(
      feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null &&
      feature.tags.includes('date-reviewed'),
    ))).toBe(true);
    expect(historicPins.every((feature) => !/designation date|listed on/i.test(feature.documentedDateText ?? ''))).toBe(true);
    const parking = peterculter.features.filter((feature) => feature.featureType === 'parking');
    expect(parking).toHaveLength(2);
    expect(parking.every((feature) => /capacity=Not published.*fee=no.*payment_methods=Not applicable.*maxstay=Not published/.test(feature.sourceRecords[0].notes ?? ''))).toBe(true);
  });

  it('publishes the deduplicated local Peterculter NRHE coverage with a date on every heat pin', () => {
    const peterculter = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'peterculter-scotland')!;
    const nrhe = peterculter.features.filter((feature) => feature.id.startsWith('nrhe:'));
    expect(nrhe.map((feature) => feature.id).sort()).toEqual([
      'nrhe:112875', 'nrhe:114571', 'nrhe:114572', 'nrhe:175038', 'nrhe:184183',
      'nrhe:19424', 'nrhe:19431', 'nrhe:298161', 'nrhe:331394', 'nrhe:332369',
    ]);
    expect(nrhe.every((feature) =>
      Boolean(feature.documentedDateText?.trim()) &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null,
    )).toBe(true);
    expect(peterculter.features.some((feature) => /MARYCULTER/.test(feature.name))).toBe(false);
    expect(peterculter.project.visualIdentity?.heroImage)
      .toBe('/town-guides/peterculter-st-peters-village-watercolour-guide-v1.png');
  });

  it('normalises this batch without merging distinct Balbithan places or the wrong Cottown', () => {
    expect(aberdeenNorthPackages.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining([
      'Kemnay',
      'Lyne of Skene',
      'Dalmadilly',
      'Balbithan',
      'Balbithan House',
      'Cottown',
    ]));
    expect(aberdeenNorthPackages.some((pkg) => /Kenmay|Skyne|Dalmadily/.test(pkg.project.name))).toBe(false);
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.name === 'Cottown')).toHaveLength(1);
  });

  it('keeps Dalmadilly Ponds in See without lifting Dalmadilly above the town threshold', () => {
    const dalmadilly = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'dalmadilly-scotland')!;
    expect(dalmadilly.project.touristAppeal?.score).toBe(43);
    expect(homeTownOverviews([dalmadilly])).toEqual([]);
    expect(topVisitPlaces(dalmadilly, 10).map((place) => [place.name, place.visitorScore])).toEqual([
      ['Dalmadilly Ponds', 67],
    ]);
    expect(homePoiOverviews([dalmadilly], 'attraction', 10).map((place) => [place.name, place.visitorScore])).toEqual([
      ['Dalmadilly Ponds', 67],
    ]);
  });

  it('publishes the fully audited Kemnay visitor offer', () => {
    const kemnay = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'kemnay-scotland')!;
    expect(kemnay.project.touristAppeal).toMatchObject({ score: 72, dogOwnerScore: 68 });
    expect(kemnay.project.visualIdentity?.heroImage).toBe('/town-guides/kemnay-place-of-origin-watercolour-guide-v2.png');
    const kintore = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'kintore-scotland')!;
    expect(kemnay.project.visualIdentity?.heroImage).not.toBe(kintore.project.visualIdentity?.heroImage);
    expect(publishedPlannerCurationForProject(kemnay.project.id).trails).toEqual([
      'curated-trails:kemnay-council-treasure-trail',
      'curated-trails:kemnay-place-of-origin-steens',
      'curated-trails:kemnay-walking-cycling-map',
    ]);
    expect(publishedPlannerCurationForProject(kemnay.project.id)).toMatchObject({
      eat: ['curated-eat:kemnay-cafe-83', 'curated-eat:kemnay-bennachie-lodge'],
      parking: ['curated-parking:kemnay-aquithie-road'],
      toilets: ['curated-toilets:kemnay-bennachie-lodge'],
      picnic: [],
    });
    expect(visitorNeedPlaces(kemnay, 'trails', 10, {
      curatedFeatureIds: publishedPlannerCurationForProject(kemnay.project.id).trails,
    }).map((place) => [place.name, place.visitorScore])).toEqual([
      ['Place of Origin and Kemnay Steens Circuit', 72],
      ['Kemnay Council Treasure Trail', 70],
      ['Kemnay Walking and Cycling Map', 68],
    ]);
    expect(kemnay.project.visitorHighlights?.map((place) => place.name)).toEqual([
      'Place of Origin',
      'Kemnay House Open Days',
      'Kemnay Parish Church and Morthouse',
    ]);
    expect(topVisitPlaces(kemnay, 10).map((place) => place.name)).toEqual([
      'Place of Origin',
      'Kemnay House Open Days',
      'Kemnay Parish Church and Morthouse',
    ]);
    expect(visitorNeedPlaces(kemnay, 'eat', 10, {
      curatedFeatureIds: publishedPlannerCurationForProject(kemnay.project.id).eat,
    }).map((place) => place.name)).toEqual(['Café 83', 'Bennachie Lodge Afternoon Tea']);
    expect(kemnay.features).toHaveLength(18);
  });

  it('dates every visible Kemnay heritage pin and records complete known parking fields', () => {
    const kemnay = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'kemnay-scotland')!;
    const heritage = kemnay.features.filter((feature) => feature.tags.includes('hes-listed-building'));
    expect(heritage).toHaveLength(10);
    expect(heritage.every((feature) => Boolean(
      feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null
    ))).toBe(true);
    const parking = kemnay.features.find((feature) => feature.id === 'curated-parking:kemnay-aquithie-road')!;
    expect(parking.sourceRecords[0].notes).toMatch(/capacity=30.*capacity:disabled=2.*fee=no.*payment_methods=Not applicable/);
    expect(kemnay.features.some((feature) => /farm shop/i.test(feature.name) && feature.editorialReview?.category === 'food')).toBe(false);
  });

  it('normalises the new rural place names and preserves existing duplicates once', () => {
    expect(aberdeenNorthPackages.map((pkg) => pkg.project.name)).toEqual(expect.arrayContaining([
      'Balbithan House',
      'Cothal',
      'Wester Fintrae',
      'East Auchronie',
    ]));
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.name === 'Stoneywood')).toHaveLength(1);
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.id === 'bankhead-aberdeen-scotland')).toHaveLength(1);
    expect(aberdeenNorthPackages.filter((pkg) => pkg.project.id === 'bankhead-midmar-scotland')).toHaveLength(1);
  });

  it('publishes the fully audited Kintore offer without lending nearby attractions to its score', () => {
    const kintore = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'kintore-scotland')!;
    expect(kintore.project.touristAppeal).toMatchObject({ score: 68, dogOwnerScore: 65 });
    expect(publishedPlannerCurationForProject(kintore.project.id).trails).toEqual([
      'curated-trails:kintore-walking-routes',
    ]);
    expect(publishedPlannerCurationForProject(kintore.project.id)).toMatchObject({
      eat: ['curated-eat:kintore-crafty-cafe', 'curated-eat:kintore-hummingbird-cafe'],
      parking: ['curated-parking:kintore-square', 'curated-parking:kintore-station'],
      toilets: ['curated-toilets:kintore-crafty-cafe'],
      picnic: [],
    });
    expect(kintore.project.visitorHighlights?.map((place) => place.name)).toEqual([
      'Kintore Town House',
      'Kintore Parish Church and Pictish Stone',
    ]);
    expect(visitorNeedPlaces(kintore, 'eat', 10, {
      curatedFeatureIds: publishedPlannerCurationForProject(kintore.project.id).eat,
    }).map((place) => place.name)).toEqual(['Hummingbird Café', 'The Crafty Café']);
    expect(kintore.features).toHaveLength(17);
  });

  it('dates every visible Kintore historic pin and merges designation duplicates', () => {
    const kintore = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'kintore-scotland')!;
    const heritage = kintore.features.filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument'].includes(tag)),
    );
    expect(heritage).toHaveLength(11);
    expect(heritage.every((feature) => Boolean(feature.documentedDateText?.trim()))).toBe(true);
    expect(heritage.map((feature) => feature.id)).toEqual(expect.arrayContaining([
      'hes-listed-building:kintore-lb36314-lb36315',
      'hes-listed-building:kintore-lb49868',
    ]));
  });

  it('records complete known Kintore parking fields without inventing unknown rules', () => {
    const kintore = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'kintore-scotland')!;
    const square = kintore.features.find((feature) => feature.id === 'curated-parking:kintore-square')!;
    const station = kintore.features.find((feature) => feature.id === 'curated-parking:kintore-station')!;
    expect(square.sourceRecords[0].notes).toMatch(/capacity=15.*capacity:disabled=1.*fee=no.*maxstay=Not published/);
    expect(station.sourceRecords[0].notes).toMatch(/capacity=168.*capacity:disabled=12.*ev_charging=24 bays/);
  });

  it('keeps every dog-owner score separate and no higher than the town score', () => {
    for (const pkg of aberdeenNorthPackages) {
      expect(pkg.project.touristAppeal?.dogOwnerScore).toBeLessThanOrEqual(
        pkg.project.touristAppeal?.score ?? 0,
      );
    }
  });

  it('publishes the fully audited Cove Bay offer without borrowing nearby attractions', () => {
    const cove = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'cove-bay-scotland')!;
    expect(cove.project.touristAppeal).toMatchObject({ score: 64, dogOwnerScore: 63, dogAccessRating: 2 });
    expect(cove.project.visitorHighlights?.map((place) => [place.name, place.visitorScore])).toEqual([
      ['Cove Harbour and Old Fishing Village', 74],
      ['Isie Caie Fishwife Sculpture', 62],
    ]);
    expect(publishedPlannerCurationForProject(cove.project.id)).toEqual({
      eat: ['curated-eat:cove-bay-hotel'],
      trails: [
        'curated-trails:cove-bay-coastal-community-woodlands',
        'curated-trails:cove-aberdeen-coastal-trail',
      ],
      parking: ['curated-parking:cove-road-walk-start'],
      toilets: [],
      picnic: [],
    });
    expect(visitorNeedPlaces(cove, 'eat', 10, {
      curatedFeatureIds: publishedPlannerCurationForProject(cove.project.id).eat,
    }).map((place) => place.name)).toEqual(['Cove Bay Hotel Public House']);
    expect(cove.features.some((feature) => /Torry|Greyhope|Doonies|Nigg Bay|Portlethen/i.test(feature.name))).toBe(false);
  });

  it('dates every visible Cove Bay historic pin and records practical unknowns explicitly', () => {
    const cove = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'cove-bay-scotland')!;
    const historicPins = cove.features.filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'historic-place', 'local-heritage-record', 'nrhe'].includes(tag)) &&
      !feature.tags.includes('map-hidden'),
    );
    expect(historicPins).toHaveLength(31);
    expect(historicPins.every((feature) => Boolean(
      feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null &&
      feature.tags.includes('date-reviewed'),
    ))).toBe(true);
    expect(historicPins.every((feature) => !/designation date|listed on/i.test(feature.documentedDateText ?? ''))).toBe(true);
    const parking = cove.features.find((feature) => feature.id === 'curated-parking:cove-road-walk-start')!;
    expect(parking.sourceRecords[0].notes).toMatch(/capacity=Not published.*fee=no.*payment_methods=Not applicable.*maxstay=Not published/);
  });

  it('publishes Cove Bay’s deduplicated local NRHE coverage and distinct guide artwork', () => {
    const cove = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'cove-bay-scotland')!;
    const nrhe = cove.features.filter((feature) => feature.id.startsWith('nrhe:'));
    expect(nrhe.map((feature) => feature.id).sort()).toEqual([
      'nrhe:112540', 'nrhe:173305', 'nrhe:173306', 'nrhe:173448', 'nrhe:173715', 'nrhe:230569',
      'nrhe:230571', 'nrhe:230720', 'nrhe:230721', 'nrhe:378675', 'nrhe:379201', 'nrhe:382114',
    ]);
    expect(nrhe.every((feature) =>
      Boolean(feature.documentedDateText?.trim()) &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null &&
      feature.tags.includes('date-reviewed'),
    )).toBe(true);
    expect(cove.project.visualIdentity?.heroImage)
      .toBe('/town-guides/cove-bay-granite-harbour-watercolour-guide-v1.png');
  });

  it('keeps Kincorth off the town map while publishing its nature reserve under See', () => {
    const kincorth = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'kincorth-aberdeen-scotland')!;
    expect(kincorth.project.touristAppeal).toMatchObject({ score: 48, dogOwnerScore: 47, dogAccessRating: 2 });
    expect(homeTownOverviews(aberdeenNorthPackages).map((town) => town.id)).not.toContain(kincorth.project.id);
    expect(kincorth.project.visitorHighlights?.map((place) => [place.name, place.visitorScore])).toEqual([
      ['Kincorth Hill Local Nature Reserve and Viewpoint', 74],
    ]);
    expect(kincorth.project.visitorHighlights?.[0].attractionGuide?.heroImage).toBe('/town-guides/kincorth-hill-heather-watercolour-guide-v1.png');
    expect(publishedPlannerCurationForProject(kincorth.project.id)).toEqual({
      eat: ['curated-eat:kincorth-community-hub-cafe'],
      trails: [
        'curated-trails:kincorth-hill-walking-routes',
        'curated-trails:kincorth-hill-sculpture-orienteering',
      ],
      parking: [
        'curated-parking:kincorth-hill-nigg-way-north',
        'curated-parking:kincorth-hill-nigg-way-south',
        'curated-parking:kincorth-hill-abbotswells-accessible',
      ],
      toilets: [],
      picnic: ['curated-picnic:kincorth-hill-picnic-sites'],
    });
    expect(visitorNeedPlaces(kincorth, 'eat', 10, {
      curatedFeatureIds: publishedPlannerCurationForProject(kincorth.project.id).eat,
    }).map((place) => place.name)).toEqual(['Kincorth Community Hub Café']);
    expect(kincorth.features.some((feature) => !feature.tags.includes('hes-listed-building') && /Duthie|Bridge of Dee|Tullos|Torry|Cove Bay|Loirston/i.test(feature.name))).toBe(false);
  });

  it('finishes the Kincorth practical and historic-pin audit without inventing missing data', () => {
    const kincorth = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'kincorth-aberdeen-scotland')!;
    const historicPins = kincorth.features.filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'historic-place', 'local-heritage-record'].includes(tag)) &&
      !feature.tags.includes('map-hidden'),
    );
    expect(historicPins).toHaveLength(0);
    const parking = kincorth.features.filter((feature) => feature.tags.includes('service-context-parking'));
    expect(parking).toHaveLength(3);
    expect(parking.every((feature) => /capacity=.*capacity:disabled=.*fee=.*payment_methods=.*maxstay=.*overnight=/.test(feature.sourceRecords[0]?.notes ?? ''))).toBe(true);
    expect(kincorth.features.find((feature) => feature.id === 'curated-picnic:kincorth-hill-picnic-sites')?.sourceRecords[0].notes).toMatch(/mapped_sites=3/);
  });

  it('publishes the source-backed Bridge of Don community trail', () => {
    const bridge = aberdeenNorthPackages.find(
      (pkg) => pkg.project.id === 'bridge-of-don-aberdeen-scotland',
    )!;
    expect(publishedPlannerCurationForProject(bridge.project.id).trails).toEqual([
      'curated-trails:bridge-of-don-community-heritage-trail',
      'curated-trails:bridge-of-don-donside-heritage-trail',
      'curated-trails:bridge-of-don-donmouth-balgownie-loop',
      'curated-trails:bridge-of-don-scotstown-moor-circuit',
    ]);
    expect(bridge.features.find((feature) =>
      feature.id === 'curated-trails:bridge-of-don-community-heritage-trail',
    )?.visitorWebsiteUrl).toContain('aberdeencity.gov.uk');
  });

  it('keeps coastal attractions in See without inflating their settlements', () => {
    const balmedie = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'balmedie-scotland')!;
    const blackdog = aberdeenNorthPackages.find((pkg) => pkg.project.id === 'blackdog-scotland')!;
    expect(topVisitPlaces(balmedie, 10)).toEqual([]);
    expect(topVisitPlaces(blackdog, 10)).toEqual([]);
    expect(
      homePoiOverviews(aberdeenNorthPackages, 'attraction', 100)
        .filter((place) => ['balmedie-scotland', 'blackdog-scotland'].includes(place.projectId))
        .map((place) => [place.name, place.discoveryScope, place.visitorScore]),
    ).toEqual([
      ['Balmedie Beach and Country Park', 'standalone', 84],
      ['Blackdog Beach and Links', 'standalone', 64],
    ]);
  });
});
