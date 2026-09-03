import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateFeatures } from '../src/domain/validation';
const id = 'monikie-scotland',
  date = '2026-08-30',
  at = '2026-08-30T23:59:59.000Z';
const paths = {
  p: resolve('data/projects/monikie.json'),
  pl: resolve('data/cairn-o-mount-visitor-planner-curation.json'),
  d: resolve('data/cairn-o-mount-dog-access-curation.json'),
  c: resolve('data/review/strict-settlement-score-correction-2026-08-30.json'),
  r: resolve('data/review/monikie-full-visitor-audit-2026-08-30.json'),
};
const p = JSON.parse(await readFile(paths.p, 'utf8')) as any,
  pl = JSON.parse(await readFile(paths.pl, 'utf8')) as any,
  d = JSON.parse(await readFile(paths.d, 'utf8')) as any,
  c = JSON.parse(await readFile(paths.c, 'utf8')) as any;
const u = {
  park: 'https://angusalive.scot/countryside-adventure/visit-us/monikie-country-park/',
  visit: 'https://visitangus.com/things-to-see-do/attractions/monikie-country-park/',
  toilets:
    'https://www.angus.gov.uk/directories/public_toilets_and_radar_keys/monikie_country_park',
  cafe: 'https://www.cafebyzantium.com/',
  victoria:
    'https://www.tripadvisor.co.uk/Restaurant_Review-g3181162-d32889041-Reviews-Victoria_Sponge-Monikie_Angus_Scotland.html',
  charges: 'https://angusalive.scot/countryside-adventures/countryside-adventure-charges/',
  treasure: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  osm: 'https://www.openstreetmap.org',
};
const ds: any = {
  'hes-listed-building:LB17610': ['Post-medieval, broadly 1561–1899', 1561, 1899, 'low'],
  'nrhe:33311': ['Medieval, broadly c. 1100–1599', 1100, 1599, 'low'],
  'nrhe:219560': ['19th to 20th century, c. 1800–1999', 1800, 1999, 'low'],
  'nrhe:219563': ['19th to 20th century, c. 1800–1999', 1800, 1999, 'low'],
  'nrhe:219564': ['1848', 1848, 1848, 'high'],
  'nrhe:219566': ['19th century, c. 1800–1899', 1800, 1899, 'low'],
  'nrhe:219568': ['19th century, c. 1800–1899', 1800, 1899, 'low'],
  'nrhe:289565': ['19th to 20th century, c. 1800–1999', 1800, 1999, 'low'],
  'hes-scheduled-monument:SM90007': ['Medieval, broadly c. 1100–1599', 1100, 1599, 'medium'],
};
for (const f of p.features) {
  f.tags = [...new Set([...f.tags, 'heritage-record-retained', 'date-reviewed'])];
  f.reviewed = true;
  f.updatedAt = at;
  const x = ds[f.id];
  if (!x) {
    f.tags = [...new Set([...f.tags, 'map-hidden'])];
    f.reviewNotes =
      'No defensible material or construction date found; retained intact but map-hidden.';
    continue;
  }
  f.documentedDateText = x[0];
  f.earliestPossibleYear = x[1];
  f.latestPossibleYear = x[2];
  f.dateBasis = x[1] === x[2] ? 'documented_date' : 'documented_date_range';
  f.dateConfidence = x[3];
  f.datePrecision = x[1] === x[2] ? 'year' : 'period_range';
  f.reviewNotes =
    'Material/construction period from the official HES/NRHE classification; no designation or database date used.';
  f.tags =
    f.id === 'nrhe:33311'
      ? [...new Set([...f.tags, 'map-hidden', 'duplicate-represented-by-statutory-record'])]
      : f.tags.filter((t: string) => t !== 'map-hidden');
}
const score = (n: number) => ({
  experienceDepth: Math.round(n * 0.3),
  distinctiveness: Math.round(n * 0.2),
  presentation: Math.round(n * 0.2),
  journeyWorth: Math.round(n * 0.15),
  accessAndReliability: Math.round(n * 0.1),
  evidenceConfidence:
    n -
    Math.round(n * 0.3) -
    Math.round(n * 0.2) -
    Math.round(n * 0.2) -
    Math.round(n * 0.15) -
    Math.round(n * 0.1),
  visitability: 'full_visitor_experience',
});
const mk = (s: any) => ({
  id: s.id,
  projectId: id,
  name: s.name,
  alternativeNames: [],
  countryCode: 'GB-SCT',
  region: 'Angus',
  locality: 'Monikie',
  featureType: s.type,
  significance: 'local',
  geometry: { type: 'Point', coordinates: s.xy },
  locationType: 'exact',
  locationConfidence: 'high',
  dateBasis: 'unknown',
  dateConfidence: 'unknown',
  survival: 'substantially_intact',
  shortDescription: s.desc,
  visitorWebsiteUrl: s.url,
  editorialReview: {
    status: 'editorially_researched',
    category: s.cat,
    methodVersion: '2026-08-30-researched-visitor-value-v1',
    reviewedAt: date,
    scoreRationale: s.why,
    evidenceUrls: s.ev,
    attractionAssessment: score(s.score),
  },
  sourceRecords: s.ev.map((x: string, i: number) => ({
    sourceName: i ? s.name + ' supporting evidence' : s.name,
    sourceOrganisation: i ? 'Supporting publisher' : s.org,
    sourceUrl: x,
    accessedAt: at,
    reliability: x.includes('angus.gov') ? 'local_authority' : 'official_non_statutory',
    licence: x.includes('openstreetmap')
      ? 'ODbL v1.0; © OpenStreetMap contributors.'
      : 'Source-linked editorial evidence.',
    notes: `Current-place curation: visitor_place_type=${s.place}; visit_score=${s.score}; ${s.details}`,
  })),
  tags: s.tags,
  createdAt: at,
  updatedAt: at,
  reviewed: true,
  evidenceScope: 'parish_evidence',
});
const park = mk({
  id: 'curated-attraction:monikie-country-park',
  name: 'Monikie Country Park',
  score: 84,
  xy: [-2.8053415, 56.5334003],
  type: 'park',
  cat: 'attraction',
  place: 'Attraction',
  desc: 'Year-round reservoir country park with woodland, wildlife, play, accessible facilities, self-led trails and seasonal land and water activities.',
  why: 'A substantial, well-supported family and outdoor destination with diverse activities and practical facilities; paid activities and seasonal café hours need planning.',
  url: u.park,
  org: 'ANGUSalive',
  ev: [u.park, u.visit, u.charges],
  tags: ['curated-visitor', 'current-context'],
  details: 'open=365 days; information_centre=09:00-16:30; accessible=yes; activities=seasonal',
});
const food = [
  mk({
    id: 'curated-eat:monikie-victoria-sponge',
    name: 'Victoria Sponge',
    score: 68,
    xy: [-2.8150924, 56.538015],
    type: 'commercial_building',
    cat: 'food',
    place: 'Eat',
    desc: 'Village coffee shop for coffee, homemade cake, light bites and afternoon tea.',
    why: 'A genuine village coffee-and-cake stop matching this guide’s daytime focus, with limited independent current publication evidence.',
    url: u.victoria,
    org: 'Victoria Sponge / current directory evidence',
    ev: [u.victoria, u.osm + '/node/13015440892'],
    tags: ['service-context-food', 'visitor-context-food', 'curated-visitor', 'current-context'],
    details:
      'food_score=68; price_band=£; cuisine=Coffee, cake and light bites; opening_hours:description=Wednesday–Sunday 10:00–15:30; description=Village coffee and homemade cake: Coffee, homemade cake, light bites and afternoon tea; outdoor_seating=yes',
  }),
  mk({
    id: 'curated-eat:monikie-cafe-byzantium',
    name: 'Café Byzantium',
    score: 67,
    xy: [-2.811063, 56.5340479],
    type: 'commercial_building',
    cat: 'food',
    place: 'Eat',
    desc: 'Country Park café-restaurant welcoming visitors for coffee as well as Mediterranean dishes and casual lunches.',
    why: 'A useful park café with direct operator evidence and coffee service, though it is weekend-focused and more meal-led than a tearoom.',
    url: u.cafe,
    org: 'Café Byzantium',
    ev: [u.cafe, u.park, u.osm + '/way/622083924'],
    tags: ['service-context-food', 'visitor-context-food', 'curated-visitor', 'current-context'],
    details:
      'food_score=67; price_band=££; cuisine=Coffee and casual Mediterranean lunch; opening_hours:description=Friday–Saturday 12:00–21:00; Sunday 12:00–20:00; description=Weekend coffee beside the reservoir: Coffee, Mediterranean dishes and casual lunches',
  }),
];
const trail = mk({
  id: 'curated-trails:monikie-country-park',
  name: 'Monikie Country Park Reservoir Trails',
  score: 74,
  xy: [-2.8068, 56.5338],
  type: 'walking_route',
  cat: 'trail',
  place: 'Trail',
  desc: 'Self-led walking and cycling trails around the former reservoirs, woodland and bird hides.',
  why: 'A reliable, operator-promoted trail network in an accessible country park, though individual route cards and distances are not consistently published online.',
  url: u.park,
  org: 'ANGUSalive',
  ev: [u.park, u.visit],
  tags: ['curated-visitor', 'visitor-context-trail', 'current-context'],
  details: 'walking=yes; cycling=yes; bird_hides=yes; self_led=yes; route_link_checked=2026-08-30',
});
const facilities = [
  mk({
    id: 'curated-picnic:monikie-country-park',
    name: 'Monikie Country Park Picnic Area',
    score: 64,
    xy: [-2.8108336, 56.5355012],
    type: 'park',
    cat: 'attraction',
    place: 'Picnic',
    desc: 'Reservoir-side picnic provision within the Country Park, with picnic benches and bookable BBQ facilities.',
    why: 'A practical park picnic stop with direct operator confirmation.',
    url: u.park,
    org: 'ANGUSalive',
    ev: [u.park, u.osm + '/node/5876535204'],
    tags: ['service-context-picnic', 'current-context'],
    details: 'picnic_tables=yes; bbq_hire=yes',
  }),
  mk({
    id: 'curated-parking:monikie-country-park',
    name: 'Monikie Country Park Car Park',
    score: 64,
    xy: [-2.8122033, 56.5348954],
    type: 'parking',
    cat: 'attraction',
    place: 'Parking',
    desc: 'Main Country Park visitor car park with accessible provision.',
    why: 'The exact operator-backed visitor car park.',
    url: u.park,
    org: 'ANGUSalive',
    ev: [u.park, u.osm + '/way/622083912'],
    tags: ['service-context-parking', 'current-context'],
    details:
      'fee=no; price_display=Free; operator live page checked 2026-08-30; accessible_parking=yes; no capacity invented',
  }),
  mk({
    id: 'curated-toilets:monikie-country-park',
    name: 'Monikie Country Park Public Toilets',
    score: 64,
    xy: [-2.8113946, 56.5346079],
    type: 'toilet',
    cat: 'attraction',
    place: 'Public toilets',
    desc: 'Male, female and accessible toilets beside the Country Park information area.',
    why: 'Exact official public-toilet provision with accessible facilities.',
    url: u.toilets,
    org: 'Angus Council',
    ev: [u.toilets, u.park, u.osm + '/way/622083910'],
    tags: ['service-context-toilets', 'current-context'],
    details:
      'male=yes; female=yes; wheelchair=designated; opening_hours:description=Information centre 09:00–16:30',
  }),
];
p.features = [
  ...p.features.filter((f: any) => !f.id.startsWith('curated-')),
  park,
  ...food,
  trail,
  ...facilities,
];
p.project.preferredBasemap = 'voyager';
p.project.touristAppeal = {
  score: 48,
  dogOwnerScore: 48,
  dogAccessScoreAdjustment: 0,
  rating: 0,
  label: 'Selector only',
  summary:
    'Monikie village has a useful coffee-and-cake stop and local historic records, while Monikie Country Park is an excellent separate attraction with trails and facilities. The settlement itself remains small and does not inherit the park’s destination score.',
  dogAccessRating: 2,
  dogAccessSummary:
    'The Country Park welcomes controlled dogs except in the play park; the village café policy is separately assessed.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3',
  reviewedAt: date,
  sourceUrls: Object.values(u),
};
p.project.visitorHighlights = [
  {
    rank: 1,
    featureId: park.id,
    name: park.name,
    reason: park.editorialReview.scoreRationale,
    tagline: 'Reservoir adventures, wildlife and woodland',
    visitorScore: 84,
    timeToSpend: '2–5 hours',
    openingTimes: 'Park open 365 days; information centre 09:00–16:30',
    admission: 'Free park entry; activities priced separately',
    freeAdmission: true,
    visitorWebsiteUrl: u.park,
    editorialReview: park.editorialReview,
    sourceName: 'ANGUSalive',
    sourceUrl: u.park,
    verifiedInBoundaryAt: date,
  },
];
p.project.townGuide = {
  characterTag: 'Small village beside a reservoir country park',
  headline: 'A modest village with a major nearby park',
  intro:
    'Monikie scores 48% and remains selector-only. Treat the Country Park as the main See attraction, with Victoria Sponge as the village coffee-and-cake stop.',
  bestFor: ['Country Park activities', 'Reservoir walking', 'Coffee and cake'],
  perfectFor: ['A park visit rather than a town-centre day'],
  dontMiss: ['Monikie Country Park', 'Victoria Sponge'],
  suggestedTime: '2–5 hours for the park',
  visitorMood: 'Quiet village edges and an active family country park.',
  sourceUrls: Object.values(u),
  lastReviewedAt: date,
};
p.project.researchNotes =
  'All 17 HES/NRHE/statutory records retained; eight dated pins visible, one dated duplicate NRHE castle record hidden behind the statutory castle record, and eight undated records hidden.';
pl.projects[id] = {
  eat: food.map((x: any) => x.id),
  trails: [trail.id],
  picnic: [facilities[0].id],
  parking: [facilities[1].id],
  toilets: [facilities[2].id],
};
const rec = (rating: any, status: string, label: string, summary: string, url: string) => ({
  rating,
  status,
  label,
  summary,
  sourceName: 'Monikie visitor audit',
  sourceUrl: url,
  reviewedAt: date,
});
d.reviewedAt = date;
d.projects[id] = {
  attraction: {
    [park.id]: rec(
      2,
      'restricted',
      'Dogs welcome under close control',
      'Dogs are welcomed under close control except in the children’s play park; observe restrictions and use dog bins.',
      u.park,
    ),
  },
  eat: {
    [food[0].id]: rec(
      null,
      'unconfirmed',
      'Dog policy not published',
      'No reliable current dog policy was found for this café; contact the operator before relying on access.',
      u.victoria,
    ),
    [food[1].id]: rec(
      null,
      'unconfirmed',
      'Dog policy not published',
      'No reliable current dog policy was found for this café; contact the operator before relying on access.',
      u.cafe,
    ),
  },
  trail: {
    [trail.id]: rec(
      2,
      'restricted',
      'Dogs welcome under close control',
      'Dogs are welcomed under close control except in the play park; observe signs around water, wildlife and activities.',
      u.park,
    ),
  },
};
p.validation = validateFeatures(p.project, p.features);
const h = p.features.filter(
    (f: any) =>
      f.id.startsWith('hes-') || f.id.startsWith('nrhe:') || f.id.startsWith('hes-scheduled'),
  ),
  v = h.filter((f: any) => !f.tags.includes('map-hidden'));
if (
  h.length !== 17 ||
  v.length !== 8 ||
  v.some((f: any) => !f.documentedDateText || f.name.includes(f.documentedDateText))
)
  throw new Error(`heritage ${h.length}/${v.length}`);
const report = {
  reviewedAt: at,
  projectId: id,
  status: 'verified',
  settlementScore: 48,
  previousScore: 42,
  independentlyWorthwhile: false,
  publishOnTownMap: false,
  publication: { see: 1, eat: 2, trails: 1, picnic: 1, parking: 1, toilets: 1 },
  heritage: {
    totalRecordsRetained: 17,
    visibleDatedHeritagePins: 8,
    visibleUndatedHeritagePins: 0,
    mapHiddenRecords: 9,
  },
  namedTrailSearch: {
    TreasureTrails: 'No exact Monikie product found.',
    AngusCouncil: 'Country Park self-led trail network verified.',
    retained: [trail.id],
  },
  parkingConflict:
    'The current live ANGUSalive venue page and 2026 Aqua Park FAQ explicitly say parking is free. This current operational statement is used despite a 2026/27 budget report proposing reintroduced charges.',
  exclusions: [
    'Country Park visitor value from the settlement score',
    'Affleck Castle as a public attraction because it is not open to visitors',
  ],
};
const row = {
  projectId: id,
  name: 'Monikie',
  region: 'Angus',
  previousScore: 42,
  correctedScore: 48,
  changed: true,
  publishOnTownMap: false,
  rationale: p.project.touristAppeal.summary,
  sourceUrls: p.project.touristAppeal.sourceUrls,
};
const old = c.results.find((x: any) => x.projectId === id);
if (old) Object.assign(old, row);
else c.results.push(row);
c.affectedProjects = c.results.length;
c.changedScores = c.results.filter((x: any) => x.changed).length;
c.mappedAfterCorrection = c.results
  .filter((x: any) => x.correctedScore >= 60)
  .map((x: any) => ({ projectId: x.projectId, name: x.name, score: x.correctedScore }));
for (const [k, o] of Object.entries({ p, pl, d, c, r: report }))
  await writeFile((paths as any)[k], JSON.stringify(o, null, 2) + '\n');
console.log(report);
