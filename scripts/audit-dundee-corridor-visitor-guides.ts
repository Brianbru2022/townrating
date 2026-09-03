import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  EditorialRecordReview,
  HeritageFeature,
  ProjectPackage,
  Reliability,
  SourceRecord,
  VisitorHighlight,
} from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-09-01';
const reviewedAt = '2026-09-01T18:30:00.000Z';
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');

const placeFiles = {
  'tealing-scotland': 'tealing.json',
  'kirkton-dundee-scotland': 'kirkton-dundee.json',
  'newbigging-monifieth-scotland': 'newbigging-monifieth.json',
  'muir-of-pert-tealing-scotland': 'muir-of-pert-tealing.json',
  'inveraldie-scotland': 'inveraldie.json',
  'bucklerheads-scotland': 'bucklerheads.json',
  'burnside-of-duntrune-scotland': 'burnside-of-duntrune.json',
  'fintry-dundee-scotland': 'fintry-dundee.json',
  'douglas-and-angus-dundee-scotland': 'douglas-and-angus-dundee.json',
  'craigie-dundee-scotland': 'craigie-dundee.json',
  'stannergate-dundee-scotland': 'stannergate-dundee.json',
  'dundee-scotland': 'dundee.json',
} as const;

const scores: Record<string, number> = {
  'tealing-scotland': 56,
  'kirkton-dundee-scotland': 34,
  'newbigging-monifieth-scotland': 46,
  'muir-of-pert-tealing-scotland': 18,
  'inveraldie-scotland': 26,
  'bucklerheads-scotland': 24,
  'burnside-of-duntrune-scotland': 26,
  'fintry-dundee-scotland': 48,
  'douglas-and-angus-dundee-scotland': 32,
  'craigie-dundee-scotland': 32,
  'stannergate-dundee-scotland': 28,
  'dundee-scotland': 93,
};

const urls = {
  hesEarthHouse: 'https://www.historicenvironment.scot/visit/all/tealing-earth-house/',
  hesDovecot: 'https://www.historicenvironment.scot/visit/all/tealing-dovecot/plan-your-visit/',
  tealingCommunity: 'https://www.tealingvillage.org/image/catalog/Tealing%205%20Year%20Community%20Action%20Plan_23-28_compressed-PDF.pdf',
  tealingClosure: 'https://www.tealingvillage.org/image/catalog/Tealing%20Forward%20June%202024%20PDF%20Condensed.pdf',
  airfield: 'https://www.abct.org.uk/airfields/tealing-kirkton-of-tealing/',
  muirOfPert: 'https://www.trove.scot/site/94183',
  kirkton: 'https://www.dundeecity.gov.uk/news/article?article_ref=4796',
  parks: 'https://www.dundeecity.gov.uk/service-area/neighbourhood-services/environment/parks-and-environment',
  fintryWalk: 'https://www.dundeecity.gov.uk/sites/default/files/publications/fintryfinlathenwalk.pdf',
  parking: 'https://www.dundeecity.gov.uk/parking-information/parking-charges-and-locations',
  parkingCapacity: 'https://www.dundeecity.gov.uk/parking-information/car-park-capacities',
  dundeeSee: 'https://www.dundee.com/see-do',
  va: 'https://www.vam.ac.uk/dundee/visit',
  vaAccess: 'https://www.vam.ac.uk/dundee/info/accessibility',
  discovery: 'https://www.dundeeheritagetrust.co.uk/attraction/discovery-point-and-r-r-s-discovery/',
  mcmanus: 'https://www.mcmanus.co.uk/visit',
  verdant: 'https://www.dundeeheritagetrust.co.uk/attraction/verdant-works/',
  unicorn: 'https://www.hmsunicorn.org.uk/',
  science: 'https://www.dundeesciencecentre.org.uk/visits/',
  dca: 'https://www.dca.org.uk/experience-dca/',
  law: 'https://www.dundeelaw.info/visit',
  tatha: 'https://www.vam.ac.uk/dundee/info/tatha-bar-and-kitchen',
  eh9: 'https://www.eh9espresso.com/',
  empire: 'https://empirestatecoffee.co.uk/about-us/',
  coffeeCo: 'https://coffeeandcodundee.co.uk/',
  espressoLab: 'https://www.dundeeespressolab.co.uk/',
  towerCafe: 'https://www.dundee.ac.uk/locations/top-tower-cafe',
  treasureDundee: 'https://www.treasuretrails.co.uk/products/things-to-do-dundee-angus',
  treasureCatalogue: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  curious: 'https://curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/',
  goquest: 'https://goquestadventures.com/',
  vaTrails: 'https://www.vam.ac.uk/dundee/info/tours-and-trails',
  breakingChains: 'https://discovery.dundee.ac.uk/en/publications/breaking-the-chains-a-walking-trail-exploring-dundees-connections/',
  publicArt: 'https://publicartdundee.org/wp-content/uploads/2023/06/Public_Art_Walking_Trails_revised.pdf',
  questo: 'https://questoapp.com/dundee-uk',
  magdalen: 'https://www.dundee.com/see-do/magdalen-green',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const source = (
  sourceName: string,
  sourceOrganisation: string,
  sourceUrl: string,
  notes: string,
  reliability: Reliability = 'official_non_statutory',
): SourceRecord => ({
  sourceName,
  sourceOrganisation,
  sourceUrl,
  accessedAt: reviewedAt,
  licence: 'Source-linked editorial evidence; check time-sensitive details before travel.',
  reliability,
  notes,
});

const projects = new Map<string, ProjectPackage>();
for (const [projectId, file] of Object.entries(placeFiles)) {
  const pkg = JSON.parse(await readFile(resolve(`data/projects/${file}`), 'utf8')) as ProjectPackage;
  if (pkg.project.id !== projectId) throw new Error(`${file} has unexpected project id ${pkg.project.id}`);
  pkg.features = pkg.features.filter((feature) =>
    !feature.tags.includes('town-selection-heritage-buffer') &&
    !feature.id.startsWith('dundee-corridor-curated:'),
  );
  projects.set(projectId, pkg);
}

const ratingForScore = (score: number) => score >= 90 ? 3 : score >= 80 ? 3 : score >= 70 ? 2 : score >= 60 ? 1 : 0;
const labelForScore = (score: number) => score >= 90 ? 'Exceptional Destination' : score >= 80 ? 'Top Place' : score >= 70 ? 'Strong Destination' : score >= 60 ? 'Notable Stop' : 'Selector only';

const summaries: Record<string, string> = {
  'tealing-scotland': 'Tealing has two genuine, free HES visitor sites—the Iron Age earth house and 1595 dovecot—but no current café, named public trail, public toilet or rounded settlement-level visitor offer. The attractions remain in See while the village stays selector-only.',
  'kirkton-dundee-scotland': 'Kirkton is a residential Dundee district with community provision in transition, but no verified visitor attraction, café stop, named visitor trail, picnic site, visitor car park or public toilet inside its strict boundary.',
  'newbigging-monifieth-scotland': 'Newbigging retains village character and complete local heritage records, but no verified current café or sufficiently broad visitor offer; Monikie’s café and country park are not transferred across the boundary.',
  'muir-of-pert-tealing-scotland': 'Muir of Pert preserves locally important former-airfield and prisoner-of-war-camp evidence, but it is not a public visitor attraction and has no verified visitor facilities.',
  'inveraldie-scotland': 'Inveraldie is a small residential settlement shaped by the former Tealing airfield. Its village hall is community provision, not a general visitor attraction, and no qualifying visitor facilities were verified.',
  'bucklerheads-scotland': 'Bucklerheads is a small roadside settlement whose local heritage is retained, but no independent attraction or complete visitor facility was verified inside the boundary.',
  'burnside-of-duntrune-scotland': 'Burnside of Duntrune is a residential edge settlement. Nearby parks and gardens are not used to inflate its town score, and no complete public visitor stop was verified inside its boundary.',
  'fintry-dundee-scotland': 'Fintry has useful access to Finlathen Park and a council-published riverside circuit, but the park is the attraction; the district itself lacks the breadth required for map publication.',
  'douglas-and-angus-dundee-scotland': 'Douglas and Angus is a residential Dundee district. Claypotts Castle and Dawson Park sit in separately bounded places and are not borrowed into this score.',
  'craigie-dundee-scotland': 'Craigie is a residential Dundee district with local historic fabric but no verified visitor attraction and no rounded public visitor facility set inside its strict boundary.',
  'stannergate-dundee-scotland': 'Stannergate is an urban and industrial waterfront district. City-centre museums, cafés and parking are excluded rather than being transferred into this locality.',
  'dundee-scotland': 'Dundee is a major cultural city break: internationally important design, polar and industrial museums, a historic ship, science and contemporary arts venues, a strong daytime café scene, multiple verified trails and substantial visitor infrastructure.',
};

for (const [projectId, pkg] of projects) {
  const score = scores[projectId];
  const sourceUrls = projectId === 'dundee-scotland'
    ? [urls.dundeeSee, urls.va, urls.mcmanus, urls.parking, urls.treasureDundee, urls.outdoorCode]
    : [pkg.project.touristAppeal?.sourceUrls?.[0] ?? 'https://www.openstreetmap.org/copyright', urls.treasureCatalogue, urls.outdoorCode];
  pkg.project.touristAppeal = {
    score,
    dogOwnerScore: Math.max(0, score - 2),
    dogAccessScoreAdjustment: -2,
    rating: ratingForScore(score),
    label: labelForScore(score),
    summary: summaries[projectId],
    dogAccessRating: projectId === 'dundee-scotland' ? 2 : 1,
    dogAccessSummary: projectId === 'dundee-scotland'
      ? 'Outdoor walks and parks are useful with a dog; most indoor cultural venues admit assistance dogs only, and café policies vary.'
      : 'No general dog-friendly visitor circuit is promoted; use the Scottish Outdoor Access Code on any lawful paths.',
    methodVersion: '2026-09-01-full-settlement-visitor-audit-v2',
    reviewedAt: reviewedDate,
    sourceUrls,
  };
  pkg.project.townGuide = {
    characterTag: projectId === 'dundee-scotland' ? 'Design, ships, industry and the Tay' : 'Strictly bounded local settlement audit',
    headline: projectId === 'dundee-scotland' ? 'Scotland’s compact design-and-discovery city' : `${pkg.project.name}: independently audited`,
    intro: summaries[projectId],
    bestFor: projectId === 'dundee-scotland' ? ['Design and museums', 'Maritime and industrial history', 'Independent coffee and city trails'] : ['Local context', 'Complete heritage records'],
    perfectFor: projectId === 'dundee-scotland' ? ['A full cultural city break'] : ['Visitors already passing through the immediate locality'],
    suggestedFirstVisit: {
      title: projectId === 'dundee-scotland' ? 'Waterfront to city centre' : 'Use the verified See and practical cards only',
      summary: projectId === 'dundee-scotland' ? 'Start with V&A Dundee and Discovery Point, then walk into the centre for The McManus, coffee and a self-guided trail.' : 'Do not assume neighbouring attractions or facilities belong to this place; the cards publish only in-boundary evidence.',
    },
    dontMiss: projectId === 'dundee-scotland' ? ['V&A Dundee', 'Discovery Point and RRS Discovery', 'The McManus'] : [],
    suggestedTime: projectId === 'dundee-scotland' ? '1–3 days' : 'A brief stop if already nearby',
    visitorMood: projectId === 'dundee-scotland' ? 'Confident, creative and rewarding on foot.' : 'Local context without borrowed destination value.',
    sourceUrls,
    lastReviewedAt: reviewedDate,
  };
  pkg.project.visitorHighlights = [];
}

function upsert(pkg: ProjectPackage, feature: HeritageFeature): HeritageFeature {
  pkg.features = pkg.features.filter((item) => item.id !== feature.id).concat(feature);
  return feature;
}

function currentFeature(
  pkg: ProjectPackage,
  input: {
    id: string;
    name: string;
    featureType: string;
    coordinates: [number, number];
    description: string;
    website: string;
    details: string;
    tags: string[];
    sources?: SourceRecord[];
  },
): HeritageFeature {
  return {
    id: `dundee-corridor-curated:${input.id}`,
    projectId: pkg.project.id,
    name: input.name,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType: input.featureType,
    significance: 'local',
    geometry: { type: 'Point', coordinates: input.coordinates },
    locationType: 'exact',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: input.description,
    visitorWebsiteUrl: input.website,
    sourceRecords: [
      source(input.name, new URL(input.website).hostname, input.website, `Current-place curation: ${input.details}`),
      ...(input.sources ?? []),
    ],
    tags: ['current-context', ...input.tags],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    evidenceScope: 'parish_evidence',
  };
}

function attractionReview(score: number, url: string, rationale: string, visitability: 'full_visitor_experience' | 'substantial_visible_remains' = 'full_visitor_experience'): EditorialRecordReview {
  const confidence = 5;
  const access = Math.min(10, Math.max(5, score - 80));
  const journey = Math.min(15, Math.max(8, score - 65));
  const presentation = Math.min(20, Math.max(12, score - 55));
  const distinctiveness = Math.min(20, Math.max(12, score - 45));
  const depth = score - confidence - access - journey - presentation - distinctiveness;
  return {
    status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: rationale, evidenceUrls: [url], visitability,
    attractionAssessment: { experienceDepth: depth, distinctiveness, presentation, journeyWorth: journey, accessAndReliability: access, evidenceConfidence: confidence, visitability },
  };
}

function foodReview(score: number, url: string, rationale: string): EditorialRecordReview {
  let remaining = score;
  const foodAndDrinkQuality = Math.min(30, remaining); remaining -= foodAndDrinkQuality;
  const daytimeRelevance = Math.min(20, remaining); remaining -= daytimeRelevance;
  const distinctiveness = Math.min(15, remaining); remaining -= distinctiveness;
  const consistency = Math.min(15, remaining); remaining -= consistency;
  const visitorFit = Math.min(10, remaining); remaining -= visitorFit;
  const evidenceConfidence = Math.min(10, remaining);
  return {
    status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: rationale, evidenceUrls: [url],
    foodAssessment: { foodAndDrinkQuality, daytimeRelevance, distinctiveness, consistency, visitorFit, evidenceConfidence },
  };
}

function highlight(feature: HeritageFeature, input: Omit<VisitorHighlight, 'featureId' | 'name'>): VisitorHighlight {
  feature.editorialReview = input.editorialReview;
  return { ...input, featureId: feature.id, name: feature.name };
}

function setScheduledDate(pkg: ProjectPackage, id: string, date: { text: string; earliest: number; latest: number; url: string; note: string }) {
  const feature = pkg.features.find((item) => item.id === id);
  if (!feature) throw new Error(`Missing scheduled monument ${id} in ${pkg.project.name}`);
  feature.documentedDateText = date.text;
  feature.earliestPossibleYear = date.earliest;
  feature.latestPossibleYear = date.latest;
  feature.dateBasis = date.earliest === date.latest ? 'documented_construction' : 'documented_date_range';
  feature.datePrecision = date.earliest === date.latest ? 'year' : 'period';
  feature.dateConfidence = 'high';
  feature.tags = [...new Set(feature.tags.filter((tag) => tag !== 'map-hidden').concat('hes-date-reviewed', 'date-reviewed'))];
  feature.sourceRecords.push(source(id, 'Historic Environment Scotland', date.url, date.note, 'official_statutory'));
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
  return feature;
}

const tealing = projects.get('tealing-scotland')!;
const dovecot = setScheduledDate(tealing, 'hes-scheduled-monument:SM90298', { text: '1595', earliest: 1595, latest: 1595, url: urls.hesDovecot, note: 'Official HES visitor history gives the construction year 1595; this is not the scheduling date.' });
const earthHouse = setScheduledDate(tealing, 'hes-scheduled-monument:SM90299', { text: 'First and second centuries AD', earliest: 1, latest: 200, url: urls.hesEarthHouse, note: 'Official HES visitor history dates the souterrain to the first and second centuries AD.' });
tealing.project.visitorHighlights = [
  highlight(earthHouse, { rank: 1, reason: 'A substantial, free-to-enter Iron Age souterrain with a reused Bronze Age cup-and-ring stone and dependable HES visitor information.', tagline: 'Enter an Iron Age souterrain', visitorScore: 82, timeToSpend: '30–45 minutes', openingTimes: 'Open all year; outdoor access across working farmland.', admission: 'Free', freeAdmission: true, visitorWebsiteUrl: urls.hesEarthHouse, sourceName: 'Historic Environment Scotland', sourceUrl: urls.hesEarthHouse, verifiedInBoundaryAt: reviewedDate, editorialReview: attractionReview(82, urls.hesEarthHouse, 'A distinctive, substantial and freely accessible ancient site; farmland access and limited facilities temper the score.', 'substantial_visible_remains') }),
  highlight(dovecot, { rank: 2, reason: 'An unusually refined estate dovecot built in 1595 and presented by HES a few hundred metres from the souterrain.', tagline: 'See the dated 1595 dovecot', visitorScore: 74, timeToSpend: '15–30 minutes', openingTimes: '1 April–30 September, daily 09:30–17:30; closed in winter.', admission: 'Free', freeAdmission: true, visitorWebsiteUrl: urls.hesDovecot, sourceName: 'Historic Environment Scotland', sourceUrl: urls.hesDovecot, verifiedInBoundaryAt: reviewedDate, editorialReview: attractionReview(74, urls.hesDovecot, 'A well-preserved and precisely dated HES property that pairs naturally with the earth house.', 'substantial_visible_remains') }),
];
earthHouse.attractionGuide = { headline: 'Explore below ground in Iron Age Angus', intro: earthHouse.shortDescription ?? 'Iron Age souterrain.', parking: 'A small signed parking area by the dovecot serves both sites; it is not a general village car park.', toilets: 'No visitor toilet is advertised by HES.', picnic: 'No formal picnic facility is advertised.', foodNote: 'The Speckled Hen closed in June 2024; no current qualifying café was verified.' };
dovecot.attractionGuide = { headline: 'Pair the dovecot with the earth house', intro: dovecot.shortDescription ?? 'Dated dovecot.', parking: 'Use the small signed HES parking area and follow site signs.', toilets: 'No visitor toilet is advertised by HES.', picnic: 'No formal picnic facility is advertised.', foodNote: 'Bring refreshments; no current café was verified.' };
const tealingParking = upsert(tealing, currentFeature(tealing, { id: 'tealing-hes-parking', name: 'Tealing Dovecot and Earth House parking', featureType: 'parking', coordinates: [-2.95163, 56.53267], description: 'A small signed parking area for the two HES sites; capacity, disabled bays and surface details are not published.', website: urls.hesDovecot, details: 'amenity=parking; parking=surface; fee=no; price_display=Free; capacity=Not published; opening_hours:description=Available during site opening; description=Small signed HES-site parking area; check farm and site signs.', tags: ['service-context-parking', 'visitor-context-parking'] }));

const fintry = projects.get('fintry-dundee-scotland')!;
const finlathenPark = upsert(fintry, currentFeature(fintry, { id: 'finlathen-park', name: 'Finlathen Park', featureType: 'park', coordinates: [-2.9423395, 56.4859802], description: 'A substantial riverside public park with paths, play and skating facilities; the council’s circular route uses made paths but includes steps.', website: urls.fintryWalk, details: 'visit_score=68; opening_hours:description=Open public park; entrance_fee=Free; description=Riverside park with paths, play and skating; some route sections have steps.', tags: ['service-context-park', 'curated-visitor-attraction'] }));
fintry.project.visitorHighlights = [highlight(finlathenPark, { rank: 1, reason: 'Fintry’s one complete public visitor asset: a large riverside park with a council-published circular walk.', tagline: 'Riverside park and local circuit', visitorScore: 68, timeToSpend: '45–90 minutes', openingTimes: 'Open public park; use daylight and observe local notices.', admission: 'Free', freeAdmission: true, visitorWebsiteUrl: urls.fintryWalk, sourceName: 'Dundee City Council', sourceUrl: urls.fintryWalk, verifiedInBoundaryAt: reviewedDate, editorialReview: attractionReview(68, urls.fintryWalk, 'A useful local park and verified route, but not a journey-making attraction in its own right.') })];
finlathenPark.attractionGuide = { headline: 'Use Fintry’s verified riverside green space', intro: finlathenPark.shortDescription ?? 'Riverside park.', parking: 'Free surface parking is reached from Fountainbleau Drive; capacity and marked accessible bays are not published.', toilets: 'No public toilet is documented in the park access guide.', picnic: 'Informal park picnicking is possible, but dedicated picnic tables are not verified.', foodNote: 'No destination café inside the strict Fintry boundary was verified.' };
const fintryTrail = upsert(fintry, currentFeature(fintry, { id: 'fintry-finlathen-circular-walk', name: 'Fintry and Finlathen circular walk', featureType: 'walking_route', coordinates: [-2.9428, 56.4887], description: 'A council-published 1.25-mile / roughly 35-minute circular walk through Fintry and Finlathen Park on generally well-made paths, with some steps.', website: urls.fintryWalk, details: 'trail_score=66; opening_hours:description=Open route; use daylight and current path conditions; entrance_fee=Free; time_to_spend=About 35 minutes; description=1.25-mile Grade 2 circular route with some steps.', tags: ['service-context-trail', 'visitor-context-trail'] }));
fintryTrail.editorialReview = { status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: 'A concise official local circuit with distance, duration, surface and steps documented.', evidenceUrls: [urls.fintryWalk] };
const fintryParking = upsert(fintry, currentFeature(fintry, { id: 'finlathen-park-parking', name: 'Finlathen Park car park', featureType: 'parking', coordinates: [-2.94091, 56.48638], description: 'Free surface car park accessed from Fountainbleau Drive; capacity and designated disabled bays are not published.', website: urls.fintryWalk, details: 'amenity=parking; parking=surface; fee=no; price_display=Free; capacity=Not published; capacity:disabled=No marked bays documented; opening_hours:description=Park access; check entrance signs; description=Free park car park from Fountainbleau Drive.', tags: ['service-context-parking', 'visitor-context-parking'] }));

const dundee = projects.get('dundee-scotland')!;
setScheduledDate(dundee, 'hes-scheduled-monument:SM164', { text: 'Early 16th century', earliest: 1500, latest: 1533, url: 'https://portal.historicenvironment.scot/designation/SM164', note: 'Official HES description states that initial construction probably dates to the early 16th century.' });
const dundeeLawMonument = setScheduledDate(dundee, 'hes-scheduled-monument:SM2878', { text: 'Prehistoric and late medieval', earliest: -2000, latest: 1600, url: 'https://portal.historicenvironment.scot/designation/SM2878', note: 'Official HES statement identifies evidence for prehistoric and late-medieval defended settlement; the broad material span is retained rather than using the scheduling date.' });

const attractionSpecs = [
  { id: 'va-dundee', name: 'V&A Dundee', type: 'museum', c: [-2.9670358, 56.4572225] as [number, number], desc: 'Scotland’s design museum in Kengo Kuma’s landmark waterfront building, with free Scottish Design Galleries and changing exhibitions.', url: urls.va, score: 95, tagline: 'Scotland’s landmark design museum', time: '1.5–3 hours', opening: 'Daily 10:00–17:00; closed 1, 25 and 26 December.', admission: 'Free general admission; some exhibitions are ticketed.' },
  { id: 'discovery-point', name: 'Discovery Point and RRS Discovery', type: 'museum', c: [-2.9680963, 56.4568151] as [number, number], desc: 'Dundee’s Antarctic visitor experience centred on Captain Scott’s historic ship RRS Discovery and a modern museum.', url: urls.discovery, score: 93, tagline: 'Board Dundee’s polar icon', time: '2–3 hours', opening: 'Open daily; current seasonal hours are published by Dundee Heritage Trust.', admission: 'Paid admission; joint heritage tickets are available.' },
  { id: 'mcmanus', name: 'The McManus: Dundee’s Art Gallery & Museum', type: 'museum', c: [-2.9713920, 56.4626320] as [number, number], desc: 'Eight galleries of Dundee art, archaeology, natural history and social history in a richly restored Gothic Revival building.', url: urls.mcmanus, score: 91, tagline: 'Meet Dundee through eight galleries', time: '1.5–2.5 hours', opening: 'Monday–Saturday 10:00–17:00 and Sunday 12:30–16:30; check holiday changes.', admission: 'Free', free: true },
  { id: 'verdant-works', name: 'Verdant Works', type: 'museum', c: [-2.9833511, 56.4615976] as [number, number], desc: 'An award-winning museum in a restored jute mill telling the human and industrial story of Dundee’s “juteopolis”.', url: urls.verdant, score: 89, tagline: 'Step inside Dundee’s jute story', time: '1.5–2.5 hours', opening: 'Current seasonal opening days and times are published by Dundee Heritage Trust.', admission: 'Paid admission; joint heritage tickets are available.' },
  { id: 'hms-unicorn', name: 'HMS Unicorn', type: 'museum', c: [-2.9584357, 56.4616206] as [number, number], desc: 'One of the world’s oldest surviving warships, preserved in Victoria Dock with four decks to explore.', url: urls.unicorn, score: 87, tagline: 'Explore a rare historic warship', time: '1–2 hours', opening: 'Current opening days and last entry are published by HMS Unicorn.', admission: 'Paid admission; concessions and family tickets available.' },
  { id: 'science-centre', name: 'Dundee Science Centre', type: 'museum', c: [-2.9752341, 56.4563431] as [number, number], desc: 'A hands-on science centre with interactive galleries and family-focused sessions close to the waterfront.', url: urls.science, score: 85, tagline: 'Hands-on science for families', time: '2–3 hours', opening: 'Timed sessions and opening dates vary; use the official visit calendar.', admission: 'Paid admission; online booking recommended.' },
  { id: 'dca', name: 'Dundee Contemporary Arts', type: 'art_gallery', c: [-2.9746525, 56.4571558] as [number, number], desc: 'A lively contemporary arts centre combining galleries, independent cinema, print studio, shop and café-bar.', url: urls.dca, score: 83, tagline: 'Contemporary art, film and making', time: '1–3 hours', opening: 'The building opens daily; gallery, cinema and print-studio hours vary by programme.', admission: 'Gallery admission is free; cinema and workshops are ticketed.' },
] as const;

const dundeeHighlights: VisitorHighlight[] = [];
for (const [index, spec] of attractionSpecs.entries()) {
  const feature = upsert(dundee, currentFeature(dundee, { id: spec.id, name: spec.name, featureType: spec.type, coordinates: spec.c, description: spec.desc, website: spec.url, details: `visit_score=${spec.score}; opening_hours:description=${spec.opening}; entrance_fee=${spec.admission}; description=${spec.desc}`, tags: ['service-context-visitor', 'curated-visitor-attraction'] }));
  feature.attractionGuide = { headline: spec.tagline, intro: spec.desc, parking: 'Use the audited city-centre car parks and current council tariffs; do not rely on attraction forecourts.', toilets: 'Visitor toilets are available during venue opening; they are not 24-hour public conveniences.', picnic: 'Use Slessor Gardens, Magdalen Green or Dundee Law for an outdoor break.', foodNote: 'The Dundee Eat list prioritises coffee, cake and light lunch rather than dinner-led restaurants.' };
  dundeeHighlights.push(highlight(feature, { rank: index + 1, reason: spec.desc, tagline: spec.tagline, visitorScore: spec.score, timeToSpend: spec.time, openingTimes: spec.opening, admission: spec.admission, freeAdmission: 'free' in spec ? spec.free : undefined, visitorWebsiteUrl: spec.url, sourceName: spec.name, sourceUrl: spec.url, verifiedInBoundaryAt: reviewedDate, editorialReview: attractionReview(spec.score, spec.url, `Current operator information supports a complete, distinctive Dundee visitor experience with usable planning details.`) }));
}
dundeeLawMonument.visitorWebsiteUrl = urls.law;
dundeeLawMonument.shortDescription = 'Dundee’s volcanic landmark and panoramic viewpoint, with signed Town to Top and hidden-treasures routes linking the summit to the city.';
dundeeLawMonument.editorialReview = attractionReview(82, urls.law, 'A free, distinctive city viewpoint with official route information and strong orientation value.', 'substantial_visible_remains');
dundeeLawMonument.attractionGuide = { headline: 'See Dundee and the Tay from above', intro: dundeeLawMonument.shortDescription, parking: 'A small summit car park exists, but the signed walk from the city centre is the stronger visitor experience.', toilets: 'Do not rely on a summit public toilet; use audited city-centre facilities.', picnic: 'Informal picnicking and seating are possible at the Law; take litter away.', foodNote: 'No summit café; combine with the city-centre Eat list.' };
dundeeHighlights.push(highlight(dundeeLawMonument, { rank: 8, reason: dundeeLawMonument.shortDescription, tagline: 'Panorama from Dundee’s volcanic hill', visitorScore: 82, timeToSpend: '45–90 minutes', openingTimes: 'Open outdoor viewpoint; use daylight and weather-appropriate conditions.', admission: 'Free', freeAdmission: true, visitorWebsiteUrl: urls.law, sourceName: 'Dundee Law', sourceUrl: urls.law, verifiedInBoundaryAt: reviewedDate, editorialReview: dundeeLawMonument.editorialReview }));
dundee.project.visitorHighlights = dundeeHighlights;

const foodSpecs = [
  { id: 'eh9-espresso', name: 'EH9 Espresso', c: [-2.9914799, 56.4558350] as [number, number], desc: 'Independent West End coffee shop for carefully made coffee, cakes, breakfast and light lunch.', url: urls.eh9, score: 88, tagline: 'Speciality coffee in the West End', hours: 'Monday–Friday 08:00–16:30, Saturday 09:00–16:00, Sunday 10:00–16:00', price: '££', style: 'speciality coffee, cakes and light lunch' },
  { id: 'empire-state-coffee', name: 'Empire State Coffee Artisan Roasters', c: [-2.9697914, 56.4590273] as [number, number], desc: 'City-centre artisan roaster and café focused on coffee, bakes and daytime food.', url: urls.empire, score: 84, tagline: 'Coffee from a Dundee roaster', hours: 'Monday–Friday 07:30–16:30, Saturday 07:30–17:00, Sunday 09:00–16:30', price: '££', style: 'artisan coffee, bakes and light lunch' },
  { id: 'coffee-and-co', name: 'Coffee & Co', c: [-2.9719598, 56.4618536] as [number, number], desc: 'Central Reform Street coffee shop for espresso drinks, cakes and a straightforward light lunch.', url: urls.coffeeCo, score: 79, tagline: 'Central coffee and cake stop', hours: 'Monday–Friday 07:00–16:00, Saturday 08:00–15:00, Sunday 10:00–14:00', price: '££', style: 'coffee, cakes and light lunch' },
  { id: 'dundee-espresso-lab', name: 'Dundee Espresso Lab', c: [-2.9672362, 56.4612720] as [number, number], desc: 'Compact independent espresso bar close to the waterfront route, with coffee and baked treats.', url: urls.espressoLab, score: 78, tagline: 'Independent espresso near the waterfront', hours: 'Monday–Saturday 09:30–17:30, Sunday 09:30–16:30', price: '££', style: 'speciality coffee and bakes' },
  { id: 'tatha', name: 'Tatha Bar & Kitchen', c: [-2.9670807, 56.4568951] as [number, number], desc: 'V&A Dundee’s river-view café for coffee, sweet treats, scones, pastries, lunch and afternoon tea.', url: urls.tatha, score: 77, tagline: 'River views with coffee and scones', hours: 'Daily 10:00–17:00 with V&A Dundee.', price: '££', style: 'coffee, pastries and light lunch' },
  { id: 'mcmanus-cafe', name: 'The McManus Café', c: [-2.97134, 56.46257] as [number, number], desc: 'Museum café for coffee, cakes and a convenient light lunch during a city-centre gallery visit.', url: urls.mcmanus, score: 72, tagline: 'Museum coffee and cake pause', hours: 'Monday–Saturday 10:00–16:00, Sunday 12:30–16:00', price: '££', style: 'coffee, cakes and light lunch' },
  { id: 'top-tower-cafe', name: 'Top of the Tower Café', c: [-2.9785940, 56.4571967] as [number, number], desc: 'University café with elevated city views, hot drinks, baking and affordable light meals.', url: urls.towerCafe, score: 68, tagline: 'Campus café with a city view', hours: 'Monday–Thursday 08:30–16:00, Friday 08:30–16:00', price: '£', style: 'coffee, baking and light lunch' },
] as const;
const dundeeFoodIds: string[] = [];
for (const spec of foodSpecs) {
  const feature = upsert(dundee, currentFeature(dundee, { id: spec.id, name: spec.name, featureType: 'cafe', coordinates: spec.c, description: spec.desc, website: spec.url, details: `amenity=cafe; visit_score=${spec.score}; opening_hours:description=${spec.hours}; price_band=${spec.price}; cuisine=${spec.style}; description=${spec.tagline}. ${spec.desc}`, tags: ['service-context-food', 'visitor-context-food'] }));
  feature.editorialReview = foodReview(spec.score, spec.url, 'Scored for daytime coffee, cake and light-lunch relevance from current operator evidence, not dinner prestige.');
  dundeeFoodIds.push(feature.id);
}

const trailSpecs = [
  { id: 'treasure-trail', name: 'Dundee Discovery Trail', c: [-2.9687, 56.4588] as [number, number], desc: 'Treasure Trails’ 1.5-mile / roughly 1.5-hour self-guided Dundee puzzle trail, starting at Yeaman Shore and described as accessible and dog friendly.', url: urls.treasureDundee, score: 86, time: 'About 1.5 hours', fee: 'Paid downloadable trail pack' },
  { id: 'town-to-top', name: 'Dundee Law Town to Top', c: [-2.9710, 56.4602] as [number, number], desc: 'A signed route from the city centre to Dundee Law, turning the panoramic summit into a proper urban walk.', url: urls.law, score: 82, time: 'About 1.5–2 hours return', fee: 'Free' },
  { id: 'law-hidden-treasures', name: 'Dundee Law Hidden Treasures Trail', c: [-2.9893945, 56.4701037] as [number, number], desc: 'An official self-guided heritage route revealing overlooked details around Dundee Law.', url: urls.law, score: 76, time: 'About 45–75 minutes', fee: 'Free' },
  { id: 'va-trails', name: 'V&A Dundee self-guided tours and trails', c: [-2.9670358, 56.4572225] as [number, number], desc: 'Free museum and waterfront trails, including family-friendly and Smartify material published by V&A Dundee.', url: urls.vaTrails, score: 78, time: '45–90 minutes', fee: 'Free' },
  { id: 'breaking-chains', name: 'Breaking the Chains walking trail', c: [-2.9785940, 56.4571967] as [number, number], desc: 'A University of Dundee walking trail exploring the city’s connections to slavery and abolition through researched sites and stories.', url: urls.breakingChains, score: 80, time: 'About 1.5–2 hours', fee: 'Free' },
  { id: 'public-art', name: 'Dundee Public Art Walking Trails', c: [-2.9667990, 56.4590326] as [number, number], desc: 'Downloadable themed walking routes linking Dundee’s substantial collection of public art.', url: urls.publicArt, score: 77, time: 'Choose a 1–2 hour route', fee: 'Free' },
  { id: 'questo', name: 'Questo Dundee city game', c: [-2.9702, 56.4606] as [number, number], desc: 'A current app-led Dundee exploration game for visitors who prefer a structured puzzle walk.', url: urls.questo, score: 68, time: 'Duration varies by chosen game', fee: 'Paid app experience' },
] as const;
const dundeeTrailIds: string[] = [];
for (const spec of trailSpecs) {
  const feature = upsert(dundee, currentFeature(dundee, { id: spec.id, name: spec.name, featureType: 'walking_route', coordinates: spec.c, description: spec.desc, website: spec.url, details: `trail_score=${spec.score}; opening_hours:description=Self-guided route; use daylight and current access conditions; entrance_fee=${spec.fee}; time_to_spend=${spec.time}; description=${spec.desc}`, tags: ['service-context-trail', 'visitor-context-trail'] }));
  feature.editorialReview = { status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: 'A current, named and source-linked Dundee route with enough practical detail to follow.', evidenceUrls: [spec.url] };
  dundeeTrailIds.push(feature.id);
}

const picnicSpecs = [
  { id: 'slessor-gardens-picnic', name: 'Slessor Gardens', c: [-2.9667990, 56.4590326] as [number, number], desc: 'Large waterfront lawns for an informal picnic close to V&A Dundee and Discovery Point.', url: urls.dundeeSee },
  { id: 'magdalen-green-picnic', name: 'Magdalen Green', c: [-2.9964099, 56.4534992] as [number, number], desc: 'Historic riverside green with open lawns and Tay views, well suited to an informal picnic.', url: urls.magdalen },
  { id: 'dundee-law-picnic', name: 'Dundee Law viewpoint lawns', c: [-2.9893945, 56.4701037] as [number, number], desc: 'Informal picnic and rest space beside the panoramic summit viewpoint; take all litter away.', url: urls.law },
] as const;
const dundeePicnicIds = picnicSpecs.map((spec) => upsert(dundee, currentFeature(dundee, { id: spec.id, name: spec.name, featureType: 'picnic_site', coordinates: spec.c, description: spec.desc, website: spec.url, details: `tourism=picnic_site; opening_hours:description=Open outdoor space; entrance_fee=Free; description=${spec.desc}`, tags: ['service-context-picnic', 'visitor-context-picnic'] })).id);

const parkingSpecs = [
  { id: 'greenmarket-parking', name: 'Greenmarket Multi Storey Car Park', c: [-2.9734373, 56.4565851] as [number, number], capacity: 548 },
  { id: 'olympia-parking', name: 'Olympia Car Park', c: [-2.9625632, 56.4634334] as [number, number], capacity: 501 },
  { id: 'gellatly-parking', name: 'Gellatly Street Car Park', c: [-2.9662611, 56.4613630] as [number, number], capacity: 430 },
  { id: 'bell-street-parking', name: 'Bell Street Hub', c: [-2.97555, 56.46455] as [number, number], capacity: 447 },
] as const;
const dundeeParkingIds = parkingSpecs.map((spec) => upsert(dundee, currentFeature(dundee, { id: spec.id, name: spec.name, featureType: 'parking', coordinates: spec.c, description: `${spec.capacity}-space variable-stay council car park. Charging is 08:00–20:00 daily; entry and exit are available 24/7. Check current boards, meters and signs.`, website: urls.parking, details: `amenity=parking; parking=multi-storey; capacity=${spec.capacity}; fee=yes; payment_required=yes; price_display=Paid - current tariff on council page and site boards; opening_hours:description=Entry and exit 24/7; charging hours 08:00–20:00 daily; description=${spec.capacity}-space variable-stay council car park; check signs and current tariff.`, tags: ['service-context-parking', 'visitor-context-parking'], sources: [source('Car Park Capacities', 'Dundee City Council', urls.parkingCapacity, `Current council capacity: ${spec.capacity} spaces.`, 'local_authority')] })).id);

const toiletSpecs = [
  { id: 'va-toilets', name: 'V&A Dundee visitor toilets', c: [-2.9670358, 56.4572225] as [number, number], desc: 'Accessible toilets on every level plus a Changing Places toilet on Level 1; available during museum opening only.', url: urls.vaAccess, hours: 'Daily 10:00–17:00 with the museum' },
  { id: 'mcmanus-toilets', name: 'The McManus visitor toilets', c: [-2.9713920, 56.4626320] as [number, number], desc: 'Museum visitor toilets available during published gallery opening; not a 24-hour street facility.', url: urls.mcmanus, hours: 'During The McManus published opening hours' },
  { id: 'discovery-toilets', name: 'Discovery Point visitor toilets', c: [-2.9680963, 56.4568151] as [number, number], desc: 'Visitor toilets inside Discovery Point, available to venue visitors during opening hours only.', url: urls.discovery, hours: 'During Discovery Point published opening hours' },
  { id: 'science-toilets', name: 'Dundee Science Centre visitor toilets', c: [-2.9752341, 56.4563431] as [number, number], desc: 'Visitor toilet provision inside the science centre during booked/open sessions; not a 24-hour public convenience.', url: urls.science, hours: 'During Dundee Science Centre visitor sessions' },
] as const;
const dundeeToiletIds = toiletSpecs.map((spec) => upsert(dundee, currentFeature(dundee, { id: spec.id, name: spec.name, featureType: 'toilets', coordinates: spec.c, description: spec.desc, website: spec.url, details: `amenity=toilets; access=customers; opening_hours:description=${spec.hours}; fee=no; description=${spec.desc}`, tags: ['service-context-toilets', 'visitor-context-toilets'] })).id);

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
planner.reviewedAt = reviewedDate;
for (const projectId of Object.keys(placeFiles)) planner.projects[projectId] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
planner.projects['tealing-scotland'].parking = [tealingParking.id];
planner.projects['fintry-dundee-scotland'] = { eat: [], trails: [fintryTrail.id], picnic: [], parking: [fintryParking.id], toilets: [] };
planner.projects['dundee-scotland'] = { eat: dundeeFoodIds, trails: dundeeTrailIds, picnic: dundeePicnicIds, parking: dundeeParkingIds, toilets: dundeeToiletIds };
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
dog.reviewedAt = reviewedDate;
const unconfirmed = (label: string, url: string) => ({ rating: 0, status: 'unconfirmed', label, summary: 'No reliable current dog policy is published; assistance-dog access may differ, so check the linked operator page before relying on indoor access.', sourceName: 'Current operator visitor information', sourceUrl: url, reviewedAt: reviewedDate });
const restricted = (label: string, summary: string, url: string, rating = 1) => ({ rating, status: 'restricted', label, summary, sourceName: 'Current visitor information and Scottish Outdoor Access Code', sourceUrl: url, reviewedAt: reviewedDate });
for (const projectId of Object.keys(placeFiles)) dog.projects[projectId] = { attraction: {}, eat: {} };
dog.projects['tealing-scotland'].attraction[earthHouse.id] = restricted('Working farmland: leads required', 'HES requires dogs to be kept on leads through the working farmland around the earth house and dovecot.', urls.hesDovecot);
dog.projects['tealing-scotland'].attraction[dovecot.id] = dog.projects['tealing-scotland'].attraction[earthHouse.id];
dog.projects['fintry-dundee-scotland'].attraction[finlathenPark.id] = restricted('Public park: responsible close control', 'Dogs can use the public park under responsible access, with close control around paths, play areas and other users.', urls.outdoorCode, 2);
for (const highlightItem of dundeeHighlights) {
  const feature = dundee.features.find((item) => item.id === highlightItem.featureId)!;
  dog.projects['dundee-scotland'].attraction[feature.id] = feature.id === dundeeLawMonument.id
    ? restricted('Outdoor viewpoint and paths', 'Dogs can use the Law paths under responsible access; keep them controlled around roads, memorials, wildlife and other visitors.', urls.outdoorCode, 2)
    : unconfirmed('Indoor venue policy requires checking', highlightItem.visitorWebsiteUrl!);
}
for (const spec of foodSpecs) dog.projects['dundee-scotland'].eat[`dundee-corridor-curated:${spec.id}`] = unconfirmed('Café pet policy not confirmed', spec.url);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');

for (const [projectId, pkg] of projects) {
  for (const feature of pkg.features.filter((item) => item.tags.some((tag) =>
    ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape', 'hes-nrhe', 'nrhe'].includes(tag),
  ))) {
    const hasMaterialDate = Boolean(
      feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null &&
      feature.dateBasis !== 'unknown',
    );
    feature.tags = hasMaterialDate
      ? [...new Set(feature.tags.filter((tag) => tag !== 'map-hidden'))]
      : [...new Set(feature.tags.concat('map-hidden'))];
  }
  const visibleHeritage = pkg.features.filter((feature) => feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape', 'hes-nrhe', 'nrhe'].includes(tag)) && !feature.tags.includes('map-hidden'));
  const badHeritage = visibleHeritage.filter((feature) => !feature.documentedDateText || feature.dateBasis === 'unknown' || feature.name.includes(feature.documentedDateText));
  if (badHeritage.length) throw new Error(`${pkg.project.name}: ${badHeritage.length} visible heritage pins lack clean dates.`);
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((entry) => entry.severity === 'error');
  if (errors.length) throw new Error(`${pkg.project.name}: ${errors.map((entry) => entry.message).join('; ')}`);
  await writeFile(resolve(`data/projects/${placeFiles[projectId as keyof typeof placeFiles]}`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

console.log('Dundee corridor visitor-guide data written: 12 strict-boundary projects; Dundee 8 See / 7 Eat / 7 Trails / 3 Picnic / 4 Parking / 4 Toilets; Tealing and Fintry attractions kept separate from town-map eligibility.');
