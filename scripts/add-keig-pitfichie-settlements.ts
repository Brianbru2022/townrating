import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-28';
const createdAt = `${reviewedAt}T23:50:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');

interface Seed {
  id: string;
  requestedName: string;
  name: string;
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  summary: string;
  rationale: string;
  sourceUrl: string;
  boundarySource: string;
  boundaryConfidence: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'keig-scotland', requestedName: 'Keig', name: 'Keig', centre: [-2.6453673, 57.2597263], radius: 700, score: 48, dogRating: 2, character: 'Small Donside village', summary: 'A quiet historic village with local character but limited verified visitor depth and facilities.', rationale: 'Keig remains independently selectable, but Castle Forbes, Pitfichie Forest and wider Donside attractions are not borrowed into its score.', sourceUrl: 'https://www.openstreetmap.org/node/1279051928', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'castle-forbes-scotland', requestedName: 'Castle Forbes', name: 'Castle Forbes', centre: [-2.6289739, 57.2611522], radius: 420, score: 18, dogRating: 1, character: 'Private castle-estate locality', summary: 'A named private estate rather than a public visitor settlement.', rationale: 'The castle is retained as a selector locality. Architectural significance alone does not make a town, and no assumed public access is scored.', sourceUrl: 'https://www.openstreetmap.org/way/390958280', boundarySource: 'OpenStreetMap castle footprint with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'upper-woodend-scotland', requestedName: 'Upper Woodend', name: 'Upper Woodend', centre: [-2.5502256, 57.2612616], radius: 360, score: 14, dogRating: 1, character: 'Rural house locality', summary: 'A named rural property rather than an independently visitable settlement.', rationale: 'Nearby forest routes and historic sites remain separate attractions and do not inflate Upper Woodend.', sourceUrl: 'https://www.openstreetmap.org/way/655247186', boundarySource: 'OpenStreetMap property footprint with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'rorandle-scotland', requestedName: 'Rorandle', name: 'Rorandle', centre: [-2.57345, 57.25407], radius: 430, score: 18, dogRating: 1, character: 'Forest-edge farm locality', summary: 'A tiny rural locality without a verified town-scale visitor offer.', rationale: 'Pitfichie Forest is treated as a separate See attraction rather than as evidence that Rorandle is a tourist town.', sourceUrl: 'https://www.geograph.org.uk/photo/283788', boundarySource: 'Geograph subject location with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'pitfichie-scotland', requestedName: 'Pitfichie', name: 'Pitfichie', centre: [-2.5383193, 57.2380911], radius: 500, score: 30, dogRating: 2, character: 'Forest-edge hamlet', summary: 'A small hamlet beside a major recreation forest, but not itself a complete visitor destination.', rationale: 'Pitfichie Forest and its trails belong under See and Trails. They are not used to turn the hamlet into a 60+ town.', sourceUrl: 'https://www.openstreetmap.org/node/1333897161', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'gateside-keig-scotland', requestedName: 'Gateside', name: 'Gateside', centre: [-2.631904, 57.235048], radius: 420, score: 18, dogRating: 1, character: 'Dispersed rural locality', summary: 'A small Keig-area locality without a verified public visitor experience.', rationale: 'Resolved to the AB33 8DR Gateside in the requested Donside cluster, not similarly named places elsewhere. The postcode centre warrants a cautious boundary.', sourceUrl: 'https://api.postcodes.io/postcodes/AB338DR', boundarySource: 'Office for National Statistics postcode centroid supplied through Postcodes.io with an editorial study buffer', boundaryConfidence: 'low' },
  { id: 'pitmunie-scotland', requestedName: 'Pitmunie', name: 'Pitmunie', centre: [-2.556499, 57.228996], radius: 420, score: 18, dogRating: 1, character: 'Rural settlement', summary: 'A small mapped settlement without a documented independent visitor offer.', rationale: 'The settlement is resolved from OS grid reference NJ665155. Adjacent Pitfichie recreation and heritage remain separate.', sourceUrl: 'https://britishplacenames.uk/pitmunie-aberdeenshire-nj665155', boundarySource: 'Ordnance Survey grid reference NJ665155 converted to WGS84 with an editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'todlachie-scotland', requestedName: 'Todlachie', name: 'Todlachie', centre: [-2.572327, 57.212211], radius: 420, score: 16, dogRating: 1, character: 'Dispersed farm locality', summary: 'A dispersed rural locality rather than a visitor settlement.', rationale: 'The coordinate uses the AB51 7SS postcode centroid and therefore remains deliberately conservative. Forest and neighbouring-village attractions are not borrowed.', sourceUrl: 'https://api.postcodes.io/postcodes/AB517SS', boundarySource: 'Office for National Statistics postcode centroid supplied through Postcodes.io with an editorial study buffer', boundaryConfidence: 'low' },
  { id: 'ordhead-scotland', requestedName: 'Ordhead', name: 'Ordhead', centre: [-2.5492332, 57.185909], radius: 460, score: 20, dogRating: 1, character: 'Small rural hamlet', summary: 'A small mapped hamlet with limited independently visitable interest.', rationale: 'Resolved from OS grid reference NJ669107. Nearby Tillyfourie and forest heritage remain distinct.', sourceUrl: 'https://britishplacenames.uk/ordhead-aberdeenshire-nj669107', boundarySource: 'Ordnance Survey grid reference NJ669107 converted to WGS84 with an editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'tillyfourie-scotland', requestedName: 'Tillyfourie', name: 'Tillyfourie', centre: [-2.5906056, 57.2004059], radius: 650, score: 45, dogRating: 2, character: 'Historic railway and quarry hamlet', summary: 'A distinctive rural hamlet with industrial and landscape context, but limited visitor services and depth.', rationale: 'Its own historic fabric is recognised while Pitfichie Forest and other regional attractions remain separate. A full audit would be required before any 60+ publication.', sourceUrl: 'https://www.openstreetmap.org/node/1333930602', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'kirkton-of-tough-scotland', requestedName: 'Kirkton of Touch', name: 'Kirkton of Tough', centre: [-2.6388328, 57.2063625], radius: 700, score: 52, dogRating: 2, character: 'Small historic Howe of Alford village', summary: 'A recognisable historic village, though its currently verified visitor offer remains too slight for the tourist-town map.', rationale: 'The requested spelling is normalised to official Kirkton of Tough. Village history counts, but private properties and neighbouring attractions do not.', sourceUrl: 'https://publications.aberdeenshire.gov.uk/acblobstorage/26828a67-468f-453a-bb40-fb1704051708/marr-kirkton-of-tough--to-whitehouse.pdf', boundarySource: 'Official Aberdeenshire settlement identification centred on the OpenStreetMap village node with an editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'whitehouse-tough-scotland', requestedName: 'Wakehouse', name: 'Whitehouse', centre: [-2.6335447, 57.2244242], radius: 600, score: 38, dogRating: 2, character: 'Small Howe of Alford village', summary: 'A small rural village with local character but little verified visitor depth.', rationale: 'No Wakehouse was found in this requested cluster; the official connected settlement is Whitehouse. It remains below the map threshold pending a full audit.', sourceUrl: 'https://publications.aberdeenshire.gov.uk/acblobstorage/26828a67-468f-453a-bb40-fb1704051708/marr-kirkton-of-tough--to-whitehouse.pdf', boundarySource: 'Official Aberdeenshire settlement identification centred on the OpenStreetMap village node with an editorial study buffer', boundaryConfidence: 'medium' },
];

function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Aberdeenshire', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: seed.boundarySource, boundaryConfidence: seed.boundaryConfidence,
      sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, neighbouring settlements and private properties do not inflate the settlement score.',
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating, label: band.label, summary: seed.summary, dogAccessRating: seed.dogRating,
        dogAccessSummary: seed.dogRating >= 2 ? 'Local outdoor access may support a dog walk, with close control around roads, livestock and wildlife.' : 'No destination-scale dog visit or dedicated dog facilities are verified.',
        methodVersion: '2026-08-28-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: 'A recorded locality rather than a tourist destination', intro: seed.rationale,
        bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider route'], dontMiss: [],
        suggestedTime: 'Pass-through or local-purpose visit', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: seed.boundarySource, sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt,
        bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary. HES records are selected from the bundled local Scotland datasets against this transparent boundary.',
      },
    },
    features: [],
    sources: [{ id: `${seed.id}-locality`, name: `${seed.name} settlement gate`, organisation: 'OpenStreetMap contributors / official gazetteer evidence', coverage: seed.name, accessMethod: 'Mapped locality identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap data under ODbL where used; source-linked editorial evidence.', reliability: 'secondary', limitations: 'Preliminary catalogue gate. A later full visitor audit may add verified facilities, trails and artwork without borrowing neighbouring attractions.' }],
    historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

const packages = seeds.map(packageFor);
for (const pkg of packages) {
  await writeFile(resolve('data/projects', `${pkg.project.id.replace(/-scotland$/, '')}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

const planner = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog = JSON.parse(await readFile(dogPath, 'utf8'));
for (const seed of seeds) {
  planner.projects[seed.id] = {};
  dog.projects[seed.id] = {};
}
planner.reviewedAt = reviewedAt;
dog.reviewedAt = reviewedAt;
await Promise.all([
  writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'),
  writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8'),
]);

await writeFile(resolve('data/review/keig-pitfichie-settlement-additions-2026-08-28.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions never inflate settlement scores.',
  namingDecisions: [
    'Kirkton of Touch is normalised to the official settlement name Kirkton of Tough.',
    'Wakehouse could not be substantiated in this cluster and is resolved to the official connected settlement Whitehouse.',
    'Gateside resolves to the AB33 8DR Keig/Alford-area locality, not similarly named places elsewhere in Aberdeenshire.',
    'Castle Forbes is catalogued as a private estate locality; no public access is assumed.',
  ],
  attractionSeparation: [
    'Pitfichie Forest and its recreation trails remain See/Trails material and do not inflate Pitfichie, Rorandle, Pitmunie or Tillyfourie.',
    'Castle Forbes architectural interest does not convert the private estate locality or Keig into a tourist-town marker.',
  ],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl, boundaryConfidence: seed.boundaryConfidence })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Keig–Pitfichie catalogue places; none publish on the town map before a full 60+ audit.`);
