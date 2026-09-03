import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, buffer, point as turfPoint } from '@turf/turf';
import type { Feature, Geometry, MultiPolygon, Point, Polygon } from 'geojson';
import type { HeritageFeature, ProjectPackage, TouristAppealRating, VisitorHighlight } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';
import { localHesDatasetFiles, localHesListedBuildingFiles } from './lib/reference-data';

const reviewedAt = '2026-08-27';
const createdAt = `${reviewedAt}T12:00:00.000Z`;
const hesDownloads = 'https://portal.historicenvironment.scot/downloads';
const councilParking = 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks';
const councilToilets = 'https://www.aberdeenshire.gov.uk/local/public-toilets';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
type Area = Polygon | MultiPolygon;
type ShapeFeature = Feature<Geometry, Record<string, unknown>>;

interface PlaceSeed {
  id: string; name: string; centre: [number, number]; radius: number; conservationArea?: string;
  score: number; dogRating: TouristAppealRating; character: string; headline: string; intro: string;
  summary: string; dogSummary: string; bestFor: string[]; time: string; sources: string[];
  highlights: Array<{ id: string; name: string; point: [number, number]; type: string; score: number; reason: string; tagline: string; time: string; opening: string; admission: string; free: boolean; url: string; dateText?: string; start?: number; end?: number }>;
  services: Array<{ id: string; need: 'eat' | 'trails' | 'parking' | 'toilets' | 'picnic'; name: string; point: [number, number]; type: string; description: string; url: string; score?: number }>;
}

const places: PlaceSeed[] = [
  {
    id: 'fettercairn-scotland', name: 'Fettercairn', centre: [-2.5748445, 56.8518556], radius: 700, conservationArea: 'FETTERCAIRN', score: 77, dogRating: 1,
    character: 'Whisky and royal-arch village', headline: 'A handsome Mearns village with a destination distillery',
    intro: 'Fettercairn combines a bookable working-distillery visit with a remarkably intact historic centre, the Royal Arch and a useful village food stop.',
    summary: 'Worth a visit for a genuine destination-scale distillery backed by an unusually coherent historic village and the distinctive Royal Arch.',
    dogSummary: 'The outdoor village and arch are easy to share with a controlled dog, but the key distillery experience has no confirmed pet policy and cannot be assumed dog-accessible.',
    bestFor: ['Whisky tours', 'Royal architecture', 'Historic village walks'], time: '3–5 hours',
    sources: ['https://www.fettercairnwhisky.com/en-gb/visit-us/', 'https://visitabdn.com/blog/the-aberdeenshire-rail-trail', 'https://www.trove.scot/place/341757', councilParking, councilToilets],
    highlights: [
      { id: 'fettercairn-distillery', name: 'Fettercairn Distillery', point: [-2.58207, 56.85374], type: 'distillery', score: 84, reason: 'A working 1824 distillery with bookable tours and tastings gives the village a journey-worthy indoor experience.', tagline: 'Two centuries of Highland whisky', time: '1–2 hours', opening: 'Wednesday–Saturday 10am–4.30pm at review; booking advised.', admission: 'Tour and tasting charges apply; current published tastings start at £20.', free: false, url: 'https://www.fettercairnwhisky.com/en-gb/visit-us/', dateText: 'Founded 1824; largely rebuilt 1887–90', start: 1824, end: 1824 },
      { id: 'fettercairn-royal-arch', name: 'Fettercairn Royal Arch', point: [-2.57574, 56.85116], type: 'monument', score: 72, reason: 'The 1864–65 memorial arch is the village’s defining landmark and commemorates Victoria and Albert’s 1861 visit.', tagline: 'A royal gateway to the village', time: '15–25 minutes', opening: 'Always visible from the public street.', admission: 'Free.', free: true, url: 'https://visitabdn.com/places/howe-of-the-mearns', dateText: '1864–65', start: 1864, end: 1865 },
      { id: 'fettercairn-historic-core', name: 'Fettercairn Historic Village Walk', point: [-2.5747, 56.85215], type: 'street', score: 66, reason: 'The conservation area links the arch, market cross, fountain, church and traditional streets into a coherent short walk.', tagline: 'Arch, cross and village stories', time: '45–75 minutes', opening: 'Public streets; daylight recommended.', admission: 'Free.', free: true, url: 'https://visitabdn.com/blog/the-aberdeenshire-rail-trail' },
    ],
    services: [
      { id: 'fettercairn-village-circuit', need: 'trails', name: 'Fettercairn Village Heritage Circuit', point: [-2.5747, 56.85215], type: 'walking_route', score: 66, description: 'A short self-guided circuit around the Royal Arch, market cross, memorial fountain, church and conservation-area streets.', url: 'https://visitabdn.com/blog/the-aberdeenshire-rail-trail' },
      { id: 'fettercairn-arch-cafe', need: 'eat', name: 'The Arch Cafe and Bistro', point: [-2.5750, 56.8518], type: 'cafe', score: 67, description: 'Licensed village café and restaurant serving cooked food and gluten-free home baking; current hours should be checked directly.', url: 'https://visitabdn.com/businesses/the-arch-cafe-and-bistro' },
      { id: 'fettercairn-cross-car-park', need: 'parking', name: 'The Cross Car Park', point: [-2.5745, 56.8520], type: 'parking', description: 'Free council car park with 13 unmarked spaces and 1 accessible space. No payment is required.', url: councilParking },
      { id: 'fettercairn-comfort-toilet', need: 'toilets', name: 'Arch Cafe Comfort Partnership Toilet', point: [-2.5750, 56.8518], type: 'toilets', description: 'Council-listed comfort-partnership toilet at the Arch Cafe; available during the venue’s opening hours.', url: councilToilets },
    ],
  },
  {
    id: 'potarch-scotland', name: 'Potarch', centre: [-2.6495757, 57.0640467], radius: 650, score: 68, dogRating: 3,
    character: 'Riverside bridge and strongman hamlet', headline: 'A compact Deeside stop with an extraordinary sporting story',
    intro: 'Potarch brings together its granite bridge, the Dinnie Stones, riverside green, café and the Deeside Way in one small, practical visitor cluster.',
    summary: 'A notable stop rather than a town centre: the bridge and globally distinctive Dinnie Stones combine with a usable riverside green and trail access.',
    dogSummary: 'Very good with a dog because the main experiences are outdoors and the café is explicitly dog-friendly; keep dogs controlled beside the river, road and other users.',
    bestFor: ['Dinnie Stones', 'Historic bridges', 'Riverside picnics', 'Deeside Way'], time: '1–3 hours',
    sources: ['https://www.thedinniestones.com/', 'https://visitabdn.com/businesses/potarch-cafe-and-restaurant', 'https://aberdeenshire.moderngov.co.uk/Data/Infrastructure%20Services%20Committee/20230511/Agenda/%2809%29%20STIDP%20ISC%20Report.pdf', 'https://www.visitabdn.com/assets/Uploads/historic-bridges-trail.pdf'],
    highlights: [
      { id: 'potarch-bridge-dinnie-stones', name: 'Potarch Bridge and Dinnie Stones', point: [-2.6487413, 57.0651486], type: 'bridge', score: 76, reason: 'The 1811–13 granite bridge and Donald Dinnie’s famous 1860 stone carry create a rare, memorable heritage pairing.', tagline: 'The bridge of a legendary feat', time: '30–60 minutes', opening: 'Open-air bridge; stones are outside the former hotel.', admission: 'Free to view.', free: true, url: 'https://www.thedinniestones.com/', dateText: 'Bridge 1811–13; famous stone carry 1860', start: 1811, end: 1813 },
      { id: 'potarch-green', name: 'Potarch Green and River Dee', point: [-2.6495, 57.0644], type: 'park', score: 65, reason: 'A popular informal riverside recreation area with picnic tables, parking and direct access to the Deeside Way.', tagline: 'Picnic beside the River Dee', time: '30–90 minutes', opening: 'Open-air site; daylight recommended.', admission: 'Free.', free: true, url: 'https://aberdeenshire.moderngov.co.uk/Data/Infrastructure%20Services%20Committee/20230511/Agenda/%2809%29%20STIDP%20ISC%20Report.pdf' },
    ],
    services: [
      { id: 'potarch-deeside-way', need: 'trails', name: 'Deeside Way at Potarch', point: [-2.6492, 57.0642], type: 'walking_route', score: 69, description: 'A signed long-distance walking and cycling route passing directly through Potarch.', url: 'https://www.deesideway.org/' },
      { id: 'potarch-cafe', need: 'eat', name: 'Potarch Cafe and Restaurant', point: [-2.6498, 57.0642], type: 'cafe', score: 72, description: 'Dog-friendly café and restaurant on the river and Deeside Way; check current hours before travel.', url: 'https://visitabdn.com/businesses/potarch-cafe-and-restaurant' },
      { id: 'potarch-green-parking', need: 'parking', name: 'Potarch Green Car Park', point: [-2.6501, 57.0645], type: 'parking', description: 'Informal free visitor parking at Potarch Green. The council report does not publish marked capacity, accessible bays, payment methods or overnight rules.', url: 'https://aberdeenshire.moderngov.co.uk/Data/Infrastructure%20Services%20Committee/20230511/Agenda/%2809%29%20STIDP%20ISC%20Report.pdf' },
      { id: 'potarch-green-picnic', need: 'picnic', name: 'Potarch Green Picnic Area', point: [-2.6495, 57.0644], type: 'picnic_site', description: 'Council-documented picnic tables and barbecue areas beside the River Dee.', url: 'https://aberdeenshire.moderngov.co.uk/Data/Infrastructure%20Services%20Committee/20230511/Agenda/%2809%29%20STIDP%20ISC%20Report.pdf' },
      { id: 'potarch-portable-toilet', need: 'toilets', name: 'Potarch Green Seasonal Toilet Provision', point: [-2.6500, 57.0645], type: 'toilets', description: 'The permanent toilet building is out of use; the council report records portable provision. Availability should be checked before relying on it.', url: councilToilets },
    ],
  },
  {
    id: 'strachan-scotland', name: 'Strachan', centre: [-2.5374556, 57.0206434], radius: 800, score: 62, dogRating: 2,
    character: 'Feughside walking village', headline: 'A quiet village with a purposeful route into the hills',
    intro: 'Strachan clears the publication gate narrowly through a real village core, a documented Scolty circuit starting at the hall and a small appointment-only clan heritage centre.',
    summary: 'A notable specialist stop for walkers and Strachan heritage, but with limited everyday visitor services and no claim on facilities in neighbouring Banchory.',
    dogSummary: 'Good for dog owners on the outdoor routes, with leads and close control needed beside roads, livestock, forestry work and other users; indoor heritage access is unconfirmed.',
    bestFor: ['Scolty walks', 'Feughside scenery', 'Clan heritage'], time: '2–4 hours',
    sources: ['https://www.feughside.com/visiting-scolty-hill', 'https://www.garioch.info/walks/Scotland/Aberdeenshire/Strachan-Scolty%20Hill%20Circuit.pdf', 'https://www.clanstrachan.org/feughside/', outdoorCode],
    highlights: [
      { id: 'strachan-scolty-circuit', name: 'Strachan–Scolty Hill Circuit', point: [-2.5301687, 57.0223809], type: 'walking_route', score: 70, reason: 'A documented 6.75km circuit starts at Strachan Village Hall and gives the village a substantial, distinctive walking experience.', tagline: 'From village hall to Scolty', time: 'About 3½ hours', opening: 'Outdoor route; check forestry and weather conditions.', admission: 'Free; parking is not guaranteed when the hall is in use.', free: true, url: 'https://www.garioch.info/walks/Scotland/Aberdeenshire/Strachan-Scolty%20Hill%20Circuit.pdf' },
      { id: 'strachan-heritage-centre', name: 'Clan Strachan Centre for Heritage', point: [-2.5415, 57.0207], type: 'civic_building', score: 61, reason: 'A small specialist centre in the historic Feughside building adds a genuine indoor heritage reason to stop, but opens by appointment.', tagline: 'A clan story in Feughside', time: '30–60 minutes', opening: 'By appointment; contact the centre before travel.', admission: 'Confirm when booking.', free: false, url: 'https://www.clanstrachan.org/feughside/' },
    ],
    services: [
      { id: 'strachan-scolty-circuit', need: 'trails', name: 'Strachan–Scolty Hill Circuit', point: [-2.5301687, 57.0223809], type: 'walking_route', score: 70, description: '6.75km medium-grade circuit from Strachan Village Hall; allow around 3½ hours.', url: 'https://www.garioch.info/walks/Scotland/Aberdeenshire/Strachan-Scolty%20Hill%20Circuit.pdf' },
      { id: 'strachan-feughside-walks', need: 'trails', name: 'Explore Feughside Walking Links', point: [-2.5374556, 57.0206434], type: 'walking_route', score: 62, description: 'Community-curated access to local walking, including Scolty and nearby Feughside routes.', url: 'https://www.feughside.com/explore-feughside' },
    ],
  },
];

const rejected = [
  ['clattering bridge', "Clatterin' Brig", 42, 'A historic bridge and former roadside-stop location, not a settlement with a town-level visitor offer.'],
  ['glensaugh', 'Glensaugh', 34, 'A research estate and accommodation location rather than a visitor settlement.'],
  ['Bridge of Dye', 'Bridge of Dye', 45, 'A small rural hamlet centred on a historic bridge and private estate, without sufficient public visitor depth.'],
  ['Glendye Lodge', 'Glen Dye / Glendye Lodge', 32, 'A private estate accommodation cluster, not an independent visitor town.'],
  ['greendams', 'Greendams', 25, 'A rural farm or place-name without a qualifying settlement visitor offer.'],
  ['Bridge of Bogendreip', 'Bridge of Bogendreip', 38, 'A listed historic bridge, not a town or visitor settlement.'],
  ['Whitestone', 'Whitestone, Feughside', 28, 'A scattered rural locality and former droving stop without a qualifying visitor cluster.'],
  ['Deebank', 'Deebank', 30, 'A grouping of houses within Banchory’s settlement context, not a separate visitor town.'],
  ['Bridge of Dee', 'Bridge of Dee, Banchory area', 24, 'A bridge-side locality/cottage address in this route context, not a separate settlement; it must not duplicate Banchory.'],
] as const;

const manualHesDates: Record<string, { text: string; earliest: number; latest: number; basis: 'documented_construction' | 'estimated_from_authoritative_source'; confidence: 'high' | 'medium' }> = {
  LB9487: { text: 'Late Victorian', earliest: 1860, latest: 1901, basis: 'estimated_from_authoritative_source', confidence: 'medium' },
  LB16215: { text: '1867', earliest: 1867, latest: 1867, basis: 'documented_construction', confidence: 'high' },
  LB16216: { text: '1777; enlarged 1828', earliest: 1777, latest: 1777, basis: 'documented_construction', confidence: 'high' },
  LB9507: { text: 'Dated 1670; enlarged 1826–29', earliest: 1670, latest: 1670, basis: 'documented_construction', confidence: 'high' },
  LB9508: { text: 'Date not separately stated; associated with the 1670 and 1826–29 Fettercairn House phases', earliest: 1670, latest: 1829, basis: 'estimated_from_authoritative_source', confidence: 'medium' },
};

function str(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
async function shapes(files: { shp: string; dbf: string; prj: string; cpg: string }): Promise<ShapeFeature[]> {
  Object.assign(globalThis, { self: globalThis });
  const { default: shp } = await import('shpjs');
  const parsed = await shp({ shp: await readFile(files.shp), dbf: await readFile(files.dbf), prj: await readFile(files.prj, 'utf8'), cpg: await readFile(files.cpg, 'utf8') } as unknown as Buffer) as any;
  return (Array.isArray(parsed) ? parsed : [parsed]).flatMap((item: any) => item.features);
}
function source(name: string, organisation: string, url: string, reliability: 'official_statutory' | 'official_non_statutory' | 'local_authority' | 'secondary' = 'official_non_statutory', recordId?: string) {
  return { sourceName: name, sourceOrganisation: organisation, sourceRecordId: recordId, sourceUrl: url, accessedAt: createdAt, licence: 'Source-linked editorial evidence; retain attribution and verify time-sensitive details before travel.', reliability };
}
function assessment(score: number) {
  const weights = [Math.round(score * 0.3), Math.round(score * 0.2), Math.round(score * 0.2), Math.round(score * 0.15), Math.round(score * 0.1)];
  return { experienceDepth: weights[0], distinctiveness: weights[1], presentation: weights[2], journeyWorth: weights[3], accessAndReliability: weights[4], evidenceConfidence: score - weights.reduce((total, value) => total + value, 0), visitability: 'full_visitor_experience' as const };
}
function foodAssessment(score: number) {
  const weights = [Math.round(score * 0.3), Math.round(score * 0.2), Math.round(score * 0.15), Math.round(score * 0.15), Math.round(score * 0.1)];
  return { foodAndDrinkQuality: weights[0], daytimeRelevance: weights[1], distinctiveness: weights[2], consistency: weights[3], visitorFit: weights[4], evidenceConfidence: score - weights.reduce((total, value) => total + value, 0) };
}
function currentFeature(place: PlaceSeed, item: PlaceSeed['services'][number]): HeritageFeature {
  const detailType = item.need === 'eat' ? 'Cafe' : item.need === 'trails' ? 'Walking route' : item.need === 'parking' ? 'Parking' : item.need === 'toilets' ? 'Public toilets' : 'Picnic area';
  const osmDetail = item.need === 'eat' ? 'amenity=cafe' : item.need === 'parking' ? 'amenity=parking' : item.need === 'toilets' ? 'amenity=toilets' : item.need === 'picnic' ? 'tourism=picnic_site' : 'route=foot';
  const scoreDetails = item.score ? `; visit_score=${item.score}; ${item.need === 'eat' ? `food_score=${item.score}; price_band=££; cuisine=Cafe; ` : `trail_score=${item.score}; `}` : '';
  const practicalDetails = item.need === 'parking' ? '; price_display=Free; payment_required=No' : '';
  const openingDetails = item.id === 'potarch-cafe' ? '; opening_hours:description=Daily 10am–4pm at review; verify on the venue listing before travel' : item.id === 'fettercairn-arch-cafe' ? '; opening_hours:description=Thursday–Sunday 10.30am–4pm at review; Friday chippy service 4–7pm; verify before travel' : '';
  return { id: `curated-${item.need}:${item.id}`, projectId: place.id, name: item.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: place.name, featureType: item.type, significance: 'local', geometry: { type: 'Point', coordinates: item.point }, locationType: 'exact', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: item.description, sourceRecords: [{ ...source(item.name, item.need === 'parking' || item.need === 'toilets' ? 'Aberdeenshire Council' : item.name, item.url, item.need === 'parking' || item.need === 'toilets' ? 'local_authority' : 'official_non_statutory'), notes: `Current-place curation: visitor_place_type=${detailType}; ${osmDetail}${scoreDetails}${practicalDetails}${openingDetails}; description=${item.name.replace(/^The /, '')}. ${item.description}` }], licence: 'Source-linked editorial record.', tags: ['current-context', `service-context-${item.need}`, `visitor-context-${item.need}`], createdAt, updatedAt: createdAt, reviewed: true, evidenceScope: 'parish_evidence', visitorWebsiteUrl: item.url, editorialReview: item.score ? { status: 'editorially_researched', category: item.need === 'eat' ? 'food' : 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt, scoreRationale: item.description, evidenceUrls: [item.url], ...(item.need === 'eat' ? { foodAssessment: foodAssessment(item.score) } : { attractionAssessment: assessment(item.score) }) } as any : undefined };
}

const conservationFiles = await localHesDatasetFiles('conservationAreas');
const listedFiles = await localHesListedBuildingFiles();
if (!conservationFiles || !listedFiles) throw new Error('Bundled HES conservation-area or listed-building data is missing.');
const conservationAreas = await shapes(conservationFiles);
const listedBuildings = await shapes(listedFiles);
const planner: Record<string, Record<string, string[]>> = {};
const dogProjects: Record<string, any> = {};

for (const place of places) {
  let core: Feature<Area>;
  if (place.conservationArea) {
    const match = conservationAreas.find((candidate) => str(candidate.properties.DES_TITLE) === place.conservationArea);
    if (!match || (match.geometry.type !== 'Polygon' && match.geometry.type !== 'MultiPolygon')) throw new Error(`Missing conservation area ${place.conservationArea}`);
    core = { type: 'Feature', properties: match.properties, geometry: match.geometry };
  } else core = buffer(turfPoint(place.centre), place.radius * 0.45, { units: 'metres' }) as Feature<Area>;
  const boundary = buffer(core, place.conservationArea ? place.radius : place.radius * 0.55, { units: 'metres' }) as Feature<Area>;
  const features: HeritageFeature[] = [];
  const seen = new Set<string>();
  for (const record of listedBuildings) {
    if (record.geometry.type !== 'Point' || !booleanPointInPolygon(turfPoint(record.geometry.coordinates), boundary)) continue;
    const ref = str(record.properties.DES_REF); if (!ref || seen.has(ref)) continue; seen.add(ref);
    const category = str(record.properties.CATEGORY);
    const knownDate = manualHesDates[ref];
    features.push({ id: `hes-listed-building:${place.id.replace('-scotland', '')}-${ref.toLowerCase()}`, projectId: place.id, name: str(record.properties.ENT_TITLE) ?? str(record.properties.DES_TITLE) ?? ref, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: place.name, featureType: 'other', designationType: 'Listed Building', designationCategory: category ? `Category ${category}` : undefined, significance: category === 'A' ? 'highest_national' : 'national', statutoryStatus: 'Listed Building', geometry: record.geometry as Point, locationType: 'representative_point', locationConfidence: 'high', documentedDateText: knownDate?.text, earliestPossibleYear: knownDate?.earliest, latestPossibleYear: knownDate?.latest, dateBasis: knownDate?.basis ?? 'unknown', dateConfidence: knownDate?.confidence ?? 'unknown', survival: 'unknown', shortDescription: str(record.properties.DES_TITLE), sourceRecords: [source('Historic Environment Scotland Listed Buildings spatial data', 'Historic Environment Scotland', str(record.properties.LINK) ?? hesDownloads, 'official_statutory', ref)], licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.', tags: ['hes-listed-building', `category-${category ?? 'unknown'}`, 'town-selection-inside-locality', ...(knownDate ? ['hes-date-extracted'] : [])], createdAt, updatedAt: createdAt, reviewed: false, evidenceScope: 'parish_evidence' });
  }
  const curated: HeritageFeature[] = place.highlights.map((h) => ({ id: `curated-attraction:${h.id}`, projectId: place.id, name: h.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: place.name, featureType: h.type, significance: h.score >= 80 ? 'regional' : 'local', geometry: { type: 'Point', coordinates: h.point }, locationType: 'exact', locationConfidence: 'high', documentedDateText: h.dateText, earliestPossibleYear: h.start, latestPossibleYear: h.end, dateBasis: h.start ? 'documented_date_range' : 'unknown', dateConfidence: h.start ? 'high' : 'unknown', survival: 'substantially_intact', shortDescription: h.reason, sourceRecords: [source(h.name, h.url.includes('trove.scot') ? 'Historic Environment Scotland' : h.name.includes('Potarch') ? 'Aberdeenshire Council / Dinnie Stones' : h.name, h.url)], licence: 'Source-linked editorial evidence.', tags: ['curated-visitor-attraction', 'editorially-scored'], createdAt, updatedAt: createdAt, reviewed: true, evidenceScope: 'parish_evidence', visitorWebsiteUrl: h.url, editorialReview: { status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt, scoreRationale: h.reason, evidenceUrls: [h.url], attractionAssessment: assessment(h.score) } }));
  features.push(...curated, ...place.services.map((item) => currentFeature(place, item)));
  const band = townScoreBand(place.score); const adjustment = townDogAccessScoreAdjustment(place.dogRating);
  const highlights: VisitorHighlight[] = place.highlights.map((h, i) => ({ rank: i + 1, featureId: `curated-attraction:${h.id}`, name: h.name, reason: h.reason, visitorScore: h.score, tagline: h.tagline, timeToSpend: h.time, openingTimes: h.opening, admission: h.admission, freeAdmission: h.free, visitorWebsiteUrl: h.url, sourceName: h.name, sourceUrl: h.url, verifiedInBoundaryAt: reviewedAt, editorialReview: { status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt, scoreRationale: h.reason, evidenceUrls: [h.url], attractionAssessment: assessment(h.score) } }));
  const studySource = place.conservationArea ? 'Historic Environment Scotland Conservation Areas spatial data' : 'OpenStreetMap settlement point with an explicit editorial study buffer';
  const pkg: ProjectPackage = { project: { id: place.id, name: place.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Aberdeenshire', locality: place.name, centre: place.centre, boundary, boundarySource: `${studySource}; ${place.radius}m reviewed settlement study radius`, boundaryConfidence: place.conservationArea ? 'high' : 'medium', sourceLanguage: 'English', preferredBasemap: 'maplibre-streets', createdAt, methodology: defaultMethodology, researchNotes: `${place.name} uses ${place.conservationArea ? 'the official conservation area as its historic core' : 'an explicit buffer around the mapped settlement point'} for a transparent visitor and heat-map study. This is not an administrative boundary.`, touristAppeal: { score: place.score, dogOwnerScore: townScoreAfterDogAccess(place.score, place.dogRating), dogAccessScoreAdjustment: adjustment, rating: band.rating, label: band.label, summary: place.summary, dogAccessRating: place.dogRating, dogAccessSummary: place.dogSummary, methodVersion: '2026-08-27-strict-settlement-visitor-gate-v1', reviewedAt, sourceUrls: [...place.sources, outdoorCode] }, visitorHighlights: highlights, townGuide: { characterTag: place.character, headline: place.headline, intro: place.intro, bestFor: place.bestFor, perfectFor: [`A ${place.time.toLowerCase()} visit`, 'Visitors following the Cairn o’ Mount and Deeside route'], suggestedFirstVisit: { title: `Start with ${place.highlights[0].name}`, summary: `Begin with ${place.highlights[0].name}, then use the mapped visitor places to extend the stop.` }, dontMiss: place.highlights.map((h) => h.name), suggestedTime: place.time, visitorMood: place.summary, sourceUrls: place.sources, lastReviewedAt: reviewedAt }, townStudyArea: { localityName: place.name, sourceName: studySource, sourceUrl: place.conservationArea ? hesDownloads : 'https://www.openstreetmap.org/copyright', sourceVersion: reviewedAt, bufferMetres: place.radius, localityBoundary: core, bufferedBoundary: boundary, notes: `Transparent ${place.radius}m visitor-study selection; not an administrative boundary.` } }, features, sources: [{ id: 'hes-data', name: 'Historic Environment Scotland spatial data', organisation: 'Historic Environment Scotland', coverage: `${place.name} study area`, accessMethod: 'Bundled HES Shapefile and point-in-polygon selection', sourceUrl: hesDownloads, licence: 'Open Government Licence v3.0.', reliability: 'official_statutory', limitations: 'Spatial data establishes designation and location; dates are enriched separately from designation descriptions.' }, { id: 'visitor-evidence', name: `${place.name} visitor evidence`, organisation: 'Official operators and Aberdeenshire visitor bodies', coverage: `${place.name} visitor offer`, accessMethod: 'Editorial review of current published sources', sourceUrl: place.sources[0], reliability: 'official_non_statutory', limitations: 'Opening and access conditions can change.' }], historicMaps: [], settlementPolygons: [], validation: [] };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  if (pkg.validation.some((item) => item.severity === 'error')) throw new Error(`${place.name} generated validation errors.`);
  await writeFile(resolve('data/projects', `${place.id.replace('-scotland', '')}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  planner[place.id] = Object.fromEntries(['eat', 'trails', 'parking', 'toilets', 'picnic'].map((need) => [need, place.services.filter((item) => item.need === need).map((item) => `curated-${item.need}:${item.id}`)]));
  const attraction: Record<string, any> = {};
  for (const h of place.highlights) {
    const unconfirmed = h.id.includes('distillery') || h.id.includes('heritage-centre');
    attraction[`curated-attraction:${h.id}`] = { rating: unconfirmed ? 0 : place.dogRating, status: unconfirmed ? 'unconfirmed' : place.dogRating === 3 ? 'welcoming' : 'restricted', label: unconfirmed ? 'Dog policy not confirmed' : 'Outdoor access with responsible control', summary: unconfirmed ? 'No reliable current dog policy was published; confirm directly before making a dog-dependent visit.' : place.dogSummary, sourceName: unconfirmed ? h.name : 'Scottish Outdoor Access Code', sourceUrl: unconfirmed ? h.url : outdoorCode, reviewedAt };
  }
  for (const item of place.services.filter((item) => item.need === 'trails')) attraction[`curated-trails:${item.id}`] = { rating: place.dogRating, status: place.dogRating === 3 ? 'welcoming' : 'restricted', label: 'Outdoor route with responsible control', summary: place.dogSummary, sourceName: item.name, sourceUrl: item.url, reviewedAt };
  const eat: Record<string, any> = {};
  for (const item of place.services.filter((item) => item.need === 'eat')) eat[`curated-eat:${item.id}`] = { rating: item.id === 'potarch-cafe' ? 3 : 0, status: item.id === 'potarch-cafe' ? 'welcoming' : 'unconfirmed', label: item.id === 'potarch-cafe' ? 'Dog-friendly café' : 'Dog policy not confirmed', summary: item.id === 'potarch-cafe' ? 'The current destination listing explicitly describes the café as dog-friendly.' : 'No reliable current dog policy was published for indoor access; check directly.', sourceName: item.name, sourceUrl: item.url, reviewedAt };
  dogProjects[place.id] = { attraction, eat };
}

await writeFile('data/cairn-o-mount-visitor-planner-curation.json', `${JSON.stringify({ schemaVersion: 1, projects: planner }, null, 2)}\n`, 'utf8');
await writeFile('data/cairn-o-mount-dog-access-curation.json', `${JSON.stringify({ schemaVersion: 1, reviewedAt, projects: dogProjects }, null, 2)}\n`, 'utf8');
await writeFile('data/review/cairn-o-mount-deeside-town-assessment-2026-08-27.json', `${JSON.stringify({ schemaVersion: 1, reviewedAt, rule: 'Publish only Scottish settlements scoring 60 or more under the existing strict in-boundary visitor method.', assessments: [...places.map((place) => ({ requestedName: place.name, resolvedName: place.name, score: place.score, publish: true, dogAccessRating: place.dogRating, rationale: place.summary, sourceUrls: place.sources })), ...rejected.map(([requestedName, resolvedName, score, rationale]) => ({ requestedName, resolvedName, score, publish: false, rationale }))], notes: ['The request follows the B974 Cairn o’ Mount to Deeside corridor and includes bridges, estates, lodges and rural place-names as well as settlements.', 'Potarch is published accurately as a compact visitor hamlet; Strachan as a village; neither is described as a large town.', 'Bridge of Dee is resolved from route context as the Banchory-area locality, not the distinct Aberdeen bridge or the Dumfries and Galloway village.'] }, null, 2)}\n`, 'utf8');
console.log(`Created ${places.length} qualifying settlement packages and documented ${rejected.length} exclusions.`);
