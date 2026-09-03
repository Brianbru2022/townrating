import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  bbox,
  bboxClip,
  booleanPointInPolygon,
  buffer,
  point as turfPoint,
} from '@turf/turf';
import type { Feature, Geometry, MultiPolygon, Point, Polygon } from 'geojson';
import type {
  HeritageFeature,
  ProjectPackage,
  TouristAppealRating,
  VisitorHighlight,
} from '../src/domain/models';
import type { PlannerCurationLibrary } from '../src/domain/plannerCuration';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';
import { localHesDatasetFiles, localHesListedBuildingFiles } from './lib/reference-data';

const reviewedAt = '2026-08-25';
const createdAt = `${reviewedAt}T12:00:00.000Z`;
const fifeConservationAreas = 'https://www.fife.gov.uk/planning/built-heritage-and-planning/conservation-areas';
const hesDownloads = 'https://portal.historicenvironment.scot/downloads';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/enjoying-scotlands-outdoors';
const coastalTrail = 'https://www.welcometofife.com/fife-trails/fife-191';

type Area = Polygon | MultiPolygon;
type ShapeFeature = Feature<Geometry, Record<string, unknown>>;
type ShapeCollection = { features: ShapeFeature[] };

interface HighlightSeed {
  name: string;
  point: [number, number];
  type: HeritageFeature['featureType'];
  score: number;
  reason: string;
  source: string;
}

interface TownSeed {
  id: string;
  name: string;
  centre: [number, number];
  conservationArea: string;
  split?: 'east' | 'west';
  score: number;
  dogAccessRating: TouristAppealRating;
  character: string;
  headline: string;
  intro: string;
  summary: string;
  dogSummary: string;
  bestFor: string[];
  time: string;
  sourceUrls: string[];
  highlights: HighlightSeed[];
  coastal?: boolean;
}

const towns: TownSeed[] = [
  {
    id: 'crail-scotland', name: 'Crail', centre: [-2.6267118, 56.2606771], conservationArea: 'CRAIL', score: 82, dogAccessRating: 3,
    character: 'Historic harbour burgh', headline: 'A remarkably complete East Neuk harbour town',
    intro: 'Crail combines a compact old burgh, steep lanes, a small working harbour and a strong coastal setting. Its museum, pottery and shore make a coherent half-day visit.',
    summary: 'A strong small destination: the historic burgh and harbour are independently worthwhile, with museum, craft and coastal-path depth inside the settlement.',
    dogSummary: 'Excellent with a dog for harbour, shore and town walking; use normal close control around working harbour activity and wildlife.',
    bestFor: ['Historic streets', 'Harbour views', 'Coastal walking', 'Independent craft'], time: '3-5 hours', coastal: true,
    sourceUrls: ['https://www.welcometofife.com/destination/crail', coastalTrail, outdoorCode],
    highlights: [
      { name: 'Crail Harbour and Shoregate', point: [-2.6280032, 56.2573556], type: 'harbour', score: 86, reason: 'The defining East Neuk harbour scene, reached through the old burgh lanes.', source: 'https://www.welcometofife.com/destination/crail' },
      { name: 'Crail Museum and Heritage Centre', point: [-2.62647, 56.26058], type: 'civic_building', score: 72, reason: 'A focused introduction to the royal burgh, fishing and local life.', source: 'https://www.welcometofife.com/destination/crail' },
      { name: 'Crail Pottery', point: [-2.6275292, 56.2579712], type: 'commercial_building', score: 69, reason: 'A long-established working pottery that adds an independent craft stop.', source: 'https://www.welcometofife.com/destination/crail' },
    ],
  },
  {
    id: 'kilrenny-scotland', name: 'Kilrenny', centre: [-2.6890061, 56.2344466], conservationArea: 'KILRENNY', score: 62, dogAccessRating: 2,
    character: 'Quiet historic inland burgh', headline: 'A small, unusually intact East Neuk village',
    intro: 'Kilrenny rewards a short architectural walk around its church, former burgh centre and tightly grouped historic buildings. It is a quiet stop rather than a full visitor hub.',
    summary: 'A notable specialist stop for a coherent conservation village and church setting, but with limited independent visitor facilities and attraction depth.',
    dogSummary: 'Good for a calm outdoor village walk, though the compact offer and church access make this a modest dog-owner stop.',
    bestFor: ['Historic townscape', 'Church heritage', 'Quiet walks'], time: '1-2 hours',
    sourceUrls: ['https://www.fife.gov.uk/__data/assets/pdf_file/0026/155924/Kilrenny-Conservation-Area-Appraisal-and-Management-Plan.pdf', fifeConservationAreas, outdoorCode],
    highlights: [
      { name: 'Kilrenny Parish Church and Kirkyard', point: [-2.69002, 56.23424], type: 'church', score: 67, reason: 'The principal historic landmark and focus of the old burgh.', source: 'https://www.fife.gov.uk/__data/assets/pdf_file/0026/155924/Kilrenny-Conservation-Area-Appraisal-and-Management-Plan.pdf' },
      { name: 'Kilrenny historic village walk', point: [-2.68901, 56.23445], type: 'street', score: 62, reason: 'A compact walk through the conservation area and former royal-burgh townscape.', source: 'https://www.fife.gov.uk/__data/assets/pdf_file/0026/155924/Kilrenny-Conservation-Area-Appraisal-and-Management-Plan.pdf' },
    ],
  },
  {
    id: 'cellardyke-scotland', name: 'Cellardyke', centre: [-2.688596, 56.2245767], conservationArea: 'CELLARDYKE', score: 69, dogAccessRating: 3,
    character: 'Fishing village and coastal lanes', headline: 'A characterful harbour village beside Anstruther',
    intro: 'Cellardyke has its own long fishing-town identity, with a harbour, close-built historic streets, a tidal pool and direct coastal walking.',
    summary: 'A high notable-stop score for a distinctive fishing townscape, harbour and tidal-pool coast, while its attraction breadth remains below a full destination band.',
    dogSummary: 'Excellent with a dog because the strongest experiences are outdoor lanes, harbour and coast; take care near water and working harbour edges.',
    bestFor: ['Fishing heritage', 'Coastal walking', 'Historic lanes', 'Sea views'], time: '2-3 hours', coastal: true,
    sourceUrls: ['https://www.welcometofife.com/destination/anstruther-cellardyke', coastalTrail, outdoorCode],
    highlights: [
      { name: 'Cellardyke Harbour', point: [-2.68649, 56.22398], type: 'harbour', score: 75, reason: 'A compact historic fishing harbour at the heart of Cellardyke’s identity.', source: 'https://www.welcometofife.com/destination/anstruther-cellardyke' },
      { name: 'Cellardyke Tidal Pool', point: [-2.6801792, 56.2276853], type: 'other', score: 73, reason: 'A striking open-air seawater pool on the coast east of the old village.', source: 'https://www.welcometofife.com/destination/anstruther-cellardyke' },
      { name: 'Cellardyke historic streets', point: [-2.688596, 56.2245767], type: 'street', score: 65, reason: 'Close-built fishing lanes and traditional houses form a rewarding short walk.', source: 'https://www.welcometofife.com/destination/anstruther-cellardyke' },
    ],
  },
  {
    id: 'anstruther-scotland', name: 'Anstruther', centre: [-2.7005643, 56.2227638], conservationArea: 'ANSTRUTHER', score: 88, dogAccessRating: 2,
    character: 'Museum and boat-trip harbour town', headline: 'The East Neuk’s deepest all-round visitor stop',
    intro: 'Anstruther combines a busy harbour, Scotland’s national fishing museum, Isle of May sailings, coastal walking and a substantial food offer.',
    summary: 'A very strong destination with multiple independent reasons to visit: a major museum, working harbour, boat trips, waterfront and coastal trail.',
    dogSummary: 'Very good outdoors around the harbour and coast, but museum and some boat-trip access restrictions slightly reduce the shared dog-owner experience.',
    bestFor: ['Maritime history', 'Boat trips', 'Harbour food', 'Coastal walking'], time: 'Half day to a full day', coastal: true,
    sourceUrls: ['https://www.welcometofife.com/destination/anstruther-cellardyke', 'https://www.welcometofife.com/view-business/scottish-fisheries-museum', coastalTrail, outdoorCode],
    highlights: [
      { name: 'Scottish Fisheries Museum', point: [-2.69958, 56.22217], type: 'civic_building', score: 89, reason: 'A nationally important museum spread through historic harbour buildings.', source: 'https://www.welcometofife.com/view-business/scottish-fisheries-museum' },
      { name: 'Anstruther Harbour and Isle of May sailings', point: [-2.6987822, 56.2215516], type: 'harbour', score: 87, reason: 'The lively waterfront and seasonal island sailings provide a second destination-scale experience.', source: 'https://www.welcometofife.com/destination/anstruther-cellardyke' },
      { name: 'Anstruther waterfront and coastal path', point: [-2.70128, 56.22094], type: 'street', score: 80, reason: 'A broad harbourfront walk linked directly to the Fife Coastal Path.', source: coastalTrail },
    ],
  },
  {
    id: 'pittenweem-scotland', name: 'Pittenweem', centre: [-2.7298382, 56.2133977], conservationArea: 'PITTENWEEM', score: 81, dogAccessRating: 3,
    character: 'Working harbour and artists’ village', headline: 'A layered harbour village of art, caves and coast',
    intro: 'Pittenweem’s working harbour is backed by steep historic wynds, galleries, St Fillan’s Cave and West Braes recreation beside the coastal path.',
    summary: 'A strong destination whose working harbour, historic townscape, art identity, cave and coastal recreation create genuine breadth.',
    dogSummary: 'Excellent with a dog for the harbour, coastal path and outdoor townscape; individual galleries and the cave have their own access constraints.',
    bestFor: ['Working harbour', 'Art galleries', 'Historic wynds', 'Coastal walking'], time: '3-5 hours', coastal: true,
    sourceUrls: ['https://www.welcometofife.com/destination/pittenweem', 'https://www.welcometofife.com/highlight/10-reasons-to-pittenweem-arts-festival-2026', coastalTrail, outdoorCode],
    highlights: [
      { name: 'Pittenweem Harbour and historic wynds', point: [-2.72868, 56.21225], type: 'harbour', score: 83, reason: 'A working fishing harbour connected to one of the East Neuk’s strongest historic townscapes.', source: 'https://www.welcometofife.com/destination/pittenweem' },
      { name: "St Fillan's Cave", point: [-2.727393, 56.2132278], type: 'chapel', score: 75, reason: 'An unusual early-Christian cave reached from the centre of the village.', source: 'https://www.welcometofife.com/destination/pittenweem' },
      { name: 'West Braes and outdoor pool', point: [-2.7379374, 56.2102554], type: 'park', score: 72, reason: 'Coastal recreation, views and a tidal pool on the western edge of the village.', source: 'https://www.welcometofife.com/destination/pittenweem' },
    ],
  },
  {
    id: 'st-monans-scotland', name: 'St Monans', centre: [-2.7655189, 56.2051524], conservationArea: 'ST MONANS', score: 79, dogAccessRating: 3,
    character: 'Saltpans, kirk and harbour village', headline: 'A compact coastal village with exceptional visual landmarks',
    intro: 'St Monans links a working harbour, the shore-side Old Kirk, restored windmill and saltpans, tidal pool and Fife Coastal Path in a tight walking circuit.',
    summary: 'Worth a visit for an unusually coherent cluster of shore-side heritage and scenery, just short of the breadth required for the 80 band.',
    dogSummary: 'Excellent with a dog: almost every defining experience is an outdoor shore or village walk, subject to responsible control near wildlife and harbour activity.',
    bestFor: ['Coastal heritage', 'Photography', 'Harbour walks', 'Industrial history'], time: '3-4 hours', coastal: true,
    sourceUrls: ['https://www.welcometofife.com/destination/st-monans', coastalTrail, outdoorCode],
    highlights: [
      { name: 'St Monans Windmill and Saltpans', point: [-2.77393, 56.20348], type: 'mill', score: 82, reason: 'A distinctive shore-side industrial landscape and one of the East Neuk’s best photo stops.', source: 'https://www.welcometofife.com/destination/st-monans' },
      { name: 'St Monans Old Kirk', point: [-2.75865, 56.20543], type: 'church', score: 79, reason: 'A dramatically sited medieval church standing immediately above the sea.', source: 'https://www.welcometofife.com/destination/st-monans' },
      { name: 'St Monans Harbour and tidal pool', point: [-2.76565, 56.20413], type: 'harbour', score: 72, reason: 'A rewarding waterfront circuit through the working harbour and nearby tidal pool.', source: 'https://www.welcometofife.com/destination/st-monans' },
    ],
  },
  {
    id: 'kilconquhar-scotland', name: 'Kilconquhar', centre: [-2.8286159, 56.209712], conservationArea: 'KILCONQUHAR & BARNYARDS', score: 61, dogAccessRating: 2,
    character: 'Church village and wetland edge', headline: 'A quiet heritage stop around church, green and marsh',
    intro: 'Kilconquhar is a small conservation village focused on its church and historic core, with public access at Barnyards Marsh. The loch itself is not a public visitor attraction.',
    summary: 'A narrow pass at the 60 gate for the coherent historic village, church setting and accessible marsh walk; private loch views do not inflate the score.',
    dogSummary: 'Good for a short village and marsh walk, with leads and wildlife care appropriate; private loch access limits the experience.',
    bestFor: ['Village heritage', 'Church architecture', 'Quiet nature'], time: '1-2 hours',
    sourceUrls: ['https://www.fife.gov.uk/__data/assets/pdf_file/0025/155923/Kilconquhar-Conservation-Area-Appraisal-and-Management-Plan.pdf', fifeConservationAreas, outdoorCode],
    highlights: [
      { name: 'Kilconquhar Parish Church and Kirkyard', point: [-2.82911, 56.20997], type: 'church', score: 67, reason: 'The architectural and historic focus of the conservation village.', source: 'https://www.fife.gov.uk/__data/assets/pdf_file/0025/155923/Kilconquhar-Conservation-Area-Appraisal-and-Management-Plan.pdf' },
      { name: 'Kilconquhar historic village', point: [-2.8286159, 56.209712], type: 'street', score: 62, reason: 'A compact group of traditional buildings, green space and village approaches.', source: 'https://www.fife.gov.uk/__data/assets/pdf_file/0025/155923/Kilconquhar-Conservation-Area-Appraisal-and-Management-Plan.pdf' },
      { name: 'Barnyards Marsh', point: [-2.8248, 56.2109], type: 'park', score: 61, reason: 'The principal confirmed public nature access beside the village.', source: 'https://www.fife.gov.uk/__data/assets/pdf_file/0025/155923/Kilconquhar-Conservation-Area-Appraisal-and-Management-Plan.pdf' },
    ],
  },
  {
    id: 'elie-scotland', name: 'Elie', centre: [-2.8202468, 56.1904515], conservationArea: 'ELIE & EARLSFERRY', split: 'east', score: 83, dogAccessRating: 3,
    character: 'Beach, harbour and lighthouse village', headline: 'A polished coastal destination built around sea and sand',
    intro: 'Elie combines a broad sandy beach, harbour and watersports with the lighthouse, Lady’s Tower, historic streets and direct coastal walking.',
    summary: 'A strong destination with beach, harbour, watersports, landmark coast and historic townscape providing several independent reasons to spend half a day or more.',
    dogSummary: 'Excellent for dog owners outside seasonal beach-control zones; the coastal path and most landmark views are outdoor experiences.',
    bestFor: ['Sandy beach', 'Watersports', 'Coastal landmarks', 'Harbour walks'], time: 'Half day to a full day', coastal: true,
    sourceUrls: ['https://www.welcometofife.com/destination/elie--earlsferry', 'https://www.welcometofife.com/golf-course/elie-links-golf-house-club', coastalTrail, outdoorCode],
    highlights: [
      { name: 'Elie Beach and Harbour', point: [-2.81755, 56.18808], type: 'harbour', score: 87, reason: 'A broad sandy beach, active harbour and watersports base form the main destination draw.', source: 'https://www.welcometofife.com/destination/elie--earlsferry' },
      { name: "Lady's Tower and Elie Ness Lighthouse", point: [-2.8077038, 56.1850507], type: 'tower', score: 81, reason: 'A memorable pair of coastal landmarks on an easy headland walk.', source: 'https://www.welcometofife.com/destination/elie--earlsferry' },
      { name: 'Elie coastal path', point: [-2.8127528, 56.1839758], type: 'street', score: 78, reason: 'A scenic stretch of the Fife Coastal Path around Elie Ness.', source: coastalTrail },
    ],
  },
  {
    id: 'earlsferry-scotland', name: 'Earlsferry', centre: [-2.8351469, 56.1885585], conservationArea: 'ELIE & EARLSFERRY', split: 'west', score: 67, dogAccessRating: 3,
    character: 'Historic burgh beside the links', headline: 'A quiet old burgh at the western end of Elie beach',
    intro: 'Earlsferry has a distinct historic identity, traditional streets, beach access, golf links and a coastal-path approach towards the Chain Walk.',
    summary: 'A notable stop for its historic burgh character, beach and coastal walking, but with less independent attraction and service depth than neighbouring Elie.',
    dogSummary: 'Excellent for outdoor dog walking along the coast and old streets, subject to seasonal beach restrictions and normal lead control.',
    bestFor: ['Historic streets', 'Beach walks', 'Golf heritage', 'Quiet coast'], time: '2-3 hours', coastal: true,
    sourceUrls: ['https://www.welcometofife.com/destination/elie--earlsferry', 'https://www.welcometofife.com/golf-course/elie-links-golf-house-club', coastalTrail, outdoorCode],
    highlights: [
      { name: 'Earlsferry Beach and coastal path', point: [-2.83915, 56.1871], type: 'street', score: 75, reason: 'The strongest shared experience: broad beach and coast at the foot of the old burgh.', source: 'https://www.welcometofife.com/destination/elie--earlsferry' },
      { name: 'Earlsferry historic burgh and Town Hall', point: [-2.8338367, 56.1890838], type: 'civic_building', score: 65, reason: 'A compact historic street pattern with the former Town Hall as a focal point.', source: fifeConservationAreas },
      { name: 'Elie Links at Earlsferry', point: [-2.846, 56.1897], type: 'designed_landscape', score: 62, reason: 'Long-established links golf adds sporting heritage and open coastal character.', source: 'https://www.welcometofife.com/golf-course/elie-links-golf-house-club' },
    ],
  },
];

const rejected = [
  ['Drumeldrie', 'Drumeldrie', 48, 'A hamlet with limited in-boundary visitor depth.'],
  ['Colinsburgh', 'Colinsburgh', 56, 'A conservation village with local interest, but insufficient independent visitor experiences for 60.'],
  ['Arncroach', 'Arncroach', 45, 'A small village without a qualifying visitor cluster.'],
  ['Newton of Balcoma', 'Newton of Balcormo', 35, 'Corrected official place-name; a hamlet rather than a visitor town.'],
  ['Wester Pitkerie', 'West Pitkierie', 30, 'Corrected official place-name; a small rural place without a town visitor offer.'],
  ['Easter Pitcarie', 'Easter Pitcorthie', 30, 'Probable official place-name match; a farm cluster, not a qualifying visitor settlement.'],
  ['Balcomie Links', 'Balcomie Links', null, 'Ineligible: mapped as a golf course/landscape, not a settlement.'],
  ['Kingsmuir', 'Kingsmuir', 35, 'A hamlet without a qualifying visitor cluster.'],
  ['Lathones', 'Lathones', 40, 'A hamlet with roadside services but insufficient town-level visitor depth.'],
  ['New Gilston', 'New Gilston', 42, 'A hamlet with local character but insufficient visitor depth.'],
  ['Peat Inn', 'Peat Inn', 45, 'A notable restaurant cannot by itself create a qualifying town score.'],
] as const;

async function shapeFeatures(files: { shp: string; dbf: string; prj: string; cpg: string }): Promise<ShapeFeature[]> {
  Object.assign(globalThis, { self: globalThis });
  const { default: shp } = await import('shpjs');
  const parsed = (await shp({
    shp: await readFile(files.shp), dbf: await readFile(files.dbf),
    prj: await readFile(files.prj, 'utf8'), cpg: await readFile(files.cpg, 'utf8'),
  } as unknown as Buffer)) as ShapeCollection | ShapeCollection[];
  return (Array.isArray(parsed) ? parsed : [parsed]).flatMap((item) => item.features);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function areaFor(seed: TownSeed, source: Feature<Area>): Feature<Area> {
  let historicCore = source;
  if (seed.split) {
    const bounds = bbox(source);
    const splitLongitude = -2.827;
    historicCore = bboxClip(source, seed.split === 'east'
      ? [splitLongitude, bounds[1], bounds[2], bounds[3]]
      : [bounds[0], bounds[1], splitLongitude, bounds[3]]) as Feature<Area>;
  }
  return buffer(historicCore, 300, { units: 'metres' }) as Feature<Area>;
}

function sourceRecord(name: string, organisation: string, sourceUrl: string, id?: string) {
  return { sourceName: name, sourceOrganisation: organisation, sourceRecordId: id, sourceUrl, accessedAt: createdAt, licence: 'Open Government Licence v3.0 where applicable; retain source attribution.', reliability: 'official_non_statutory' as const };
}

function curatedFeature(seed: TownSeed, highlight: HighlightSeed, index: number): HeritageFeature {
  const id = `curated-attraction:${seed.id.replace('-scotland', '')}-${index + 1}`;
  return {
    id, projectId: seed.id, name: highlight.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Fife', locality: seed.name,
    featureType: highlight.type, significance: highlight.score >= 80 ? 'regional' : 'local',
    geometry: { type: 'Point', coordinates: highlight.point }, locationType: 'exact', locationConfidence: 'high',
    dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
    shortDescription: highlight.reason,
    sourceRecords: [sourceRecord('Welcome to Fife / Fife Council visitor evidence', 'Fife Council and Welcome to Fife', highlight.source)],
    licence: 'Source-linked editorial record; do not redistribute source text.', tags: ['curated-visitor-attraction', 'town-selection-inside-locality'],
    createdAt, updatedAt: createdAt, reviewed: true, evidenceScope: 'parish_evidence',
  };
}

function trailFeature(seed: TownSeed): HeritageFeature | undefined {
  if (!seed.coastal) return undefined;
  return {
    id: `curated-trail:${seed.id.replace('-scotland', '')}-fife-coastal-path`, projectId: seed.id,
    name: `Fife Coastal Path at ${seed.name}`, alternativeNames: [], countryCode: 'GB-SCT', region: 'Fife', locality: seed.name,
    featureType: 'walking_route', geometry: { type: 'Point', coordinates: seed.centre }, locationType: 'representative_point',
    locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', significance: 'regional', survival: 'substantially_intact',
    shortDescription: `The signed long-distance coast route through ${seed.name}; check current conditions before setting out.`,
    sourceRecords: [{ ...sourceRecord('Welcome to Fife trail guide', 'Welcome to Fife', coastalTrail), notes: 'Current-place curation: visitor_place_type=Walking route; trail_score=82; trail_type=coastal; access=public; description=Signed coastal route through the settlement.' }],
    licence: 'Source-linked editorial record.', tags: ['curated-visitor-trail', 'current-context'], createdAt, updatedAt: createdAt, reviewed: true, evidenceScope: 'related_context',
    visitorWebsiteUrl: coastalTrail,
    editorialReview: { status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt, scoreRationale: `A signed, responsible-body documented coastal route through ${seed.name}.`, evidenceUrls: [coastalTrail] },
  };
}

function attractionAssessment(score: number) {
  let remaining = score;
  const take = (maximum: number) => { const value = Math.min(maximum, remaining); remaining -= value; return value; };
  return {
    experienceDepth: take(30), distinctiveness: take(20), presentation: take(20),
    journeyWorth: take(15), accessAndReliability: take(10), evidenceConfidence: take(5),
    visitability: 'full_visitor_experience' as const,
  };
}

const caFiles = await localHesDatasetFiles('conservationAreas');
const lbFiles = await localHesListedBuildingFiles();
if (!caFiles || !lbFiles) throw new Error('The bundled HES conservation-area and listed-building files are required.');
const conservationAreas = await shapeFeatures(caFiles);
const listedBuildings = await shapeFeatures(lbFiles);
const planner: PlannerCurationLibrary = {};
const dogProjects: Record<string, { attraction: Record<string, object> }> = {};

for (const seed of towns) {
  const ca = conservationAreas.find((feature) => stringValue(feature.properties.DES_TITLE) === seed.conservationArea);
  if (!ca || (ca.geometry.type !== 'Polygon' && ca.geometry.type !== 'MultiPolygon')) throw new Error(`Missing HES conservation area ${seed.conservationArea}.`);
  const caBoundary: Feature<Area> = { type: 'Feature', properties: ca.properties, geometry: ca.geometry };
  const projectBoundary = areaFor(seed, caBoundary);
  const features: HeritageFeature[] = [];
  const references = new Set<string>();
  for (const record of listedBuildings) {
    if (record.geometry.type !== 'Point' || !booleanPointInPolygon(turfPoint(record.geometry.coordinates), projectBoundary)) continue;
    const reference = stringValue(record.properties.DES_REF);
    if (!reference || references.has(reference)) continue;
    references.add(reference);
    const category = stringValue(record.properties.CATEGORY);
    features.push({
      id: `hes-listed-building:${seed.id.replace('-scotland', '')}-${reference.toLowerCase()}`, projectId: seed.id,
      name: stringValue(record.properties.ENT_TITLE) ?? stringValue(record.properties.DES_TITLE) ?? reference,
      alternativeNames: [], countryCode: 'GB-SCT', region: 'Fife', locality: seed.name, featureType: 'other',
      designationType: 'Listed Building', designationCategory: category ? `Category ${category}` : undefined,
      significance: category === 'A' ? 'highest_national' : 'national', statutoryStatus: 'Listed Building',
      geometry: record.geometry as Point, locationType: 'representative_point', locationConfidence: 'high',
      dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'unknown',
      shortDescription: stringValue(record.properties.DES_TITLE),
      sourceRecords: [{ ...sourceRecord('Historic Environment Scotland Listed Buildings spatial data', 'Historic Environment Scotland', stringValue(record.properties.LINK) ?? hesDownloads, reference), reliability: 'official_statutory' }],
      licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
      tags: ['hes-listed-building', `category-${category ?? 'unknown'}`, 'town-selection-inside-locality'],
      createdAt, updatedAt: createdAt, reviewed: false, evidenceScope: 'parish_evidence',
    });
  }
  const curated = seed.highlights.map((highlight, index) => curatedFeature(seed, highlight, index));
  features.push(...curated);
  const trail = trailFeature(seed);
  if (trail) features.push(trail);
  const dogAdjustment = townDogAccessScoreAdjustment(seed.dogAccessRating);
  const band = townScoreBand(seed.score);
  const visitorHighlights: VisitorHighlight[] = curated.map((feature, index) => ({
    rank: index + 1, featureId: feature.id, name: feature.name, reason: seed.highlights[index].reason,
    visitorScore: seed.highlights[index].score,
    tagline: seed.highlights[index].name.split(/\s+/u).slice(0, 5).join(' '),
    timeToSpend: index === 0 ? '45-90 minutes' : '20-45 minutes',
    openingTimes: /museum/i.test(seed.highlights[index].name) ? 'Seasonal published opening timetable.' : 'Open-air site; daylight visit recommended.',
    admission: /museum/i.test(seed.highlights[index].name) ? 'Operator admission charges apply.' : 'Free outdoor visit.',
    freeAdmission: !/museum/i.test(seed.highlights[index].name),
    sourceName: feature.sourceRecords[0].sourceName,
    sourceUrl: seed.highlights[index].source, verifiedInBoundaryAt: reviewedAt,
    editorialReview: {
      status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1',
      reviewedAt, scoreRationale: seed.highlights[index].reason,
      evidenceUrls: [seed.highlights[index].source],
      attractionAssessment: attractionAssessment(seed.highlights[index].score),
    },
  }));
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Fife', locality: seed.name,
      centre: seed.centre, boundary: projectBoundary, boundarySource: `Historic Environment Scotland ${seed.conservationArea} Conservation Area, buffered 300m for settlement study`,
      boundaryConfidence: seed.split ? 'medium' : 'high', sourceLanguage: 'English', preferredBasemap: 'maplibre-streets', createdAt,
      methodology: defaultMethodology,
      researchNotes: `${seed.name} uses the official HES conservation area as its historic core and a 300m study buffer. The buffer supports a transparent town heat map; it is not an administrative boundary.${seed.split ? ' Elie and Earlsferry were split at longitude -2.827 within their combined official conservation area.' : ''}`,
      touristAppeal: { score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogAccessRating), dogAccessScoreAdjustment: dogAdjustment, rating: band.rating, label: band.label, summary: seed.summary, dogAccessRating: seed.dogAccessRating, dogAccessSummary: seed.dogSummary, methodVersion: '2026-08-25-strict-settlement-visitor-gate-v1', reviewedAt, sourceUrls: seed.sourceUrls },
      visitorHighlights,
      townGuide: { characterTag: seed.character, headline: seed.headline, intro: seed.intro, bestFor: seed.bestFor, perfectFor: [`A ${seed.time.toLowerCase()} East Neuk visit`, 'Visitors who prefer compact, walkable settlements'], suggestedFirstVisit: { title: `Start with ${seed.highlights[0].name}`, summary: `Begin at ${seed.highlights[0].name}, then continue through the historic core${seed.coastal ? ' and along the coast' : ''}.` }, dontMiss: seed.highlights.map((item) => item.name), suggestedTime: seed.time, visitorMood: seed.summary, sourceUrls: seed.sourceUrls, lastReviewedAt: reviewedAt },
      townStudyArea: { localityName: seed.name, sourceName: 'Historic Environment Scotland Conservation Areas spatial data', sourceUrl: hesDownloads, sourceVersion: `HES ${stringValue(ca.properties.DES_REF) ?? seed.conservationArea}`, bufferMetres: 300, localityBoundary: seed.split ? bboxClip(caBoundary, seed.split === 'east' ? [-2.827, bbox(caBoundary)[1], bbox(caBoundary)[2], bbox(caBoundary)[3]] : [bbox(caBoundary)[0], bbox(caBoundary)[1], -2.827, bbox(caBoundary)[3]]) as Feature<Area> : caBoundary, bufferedBoundary: projectBoundary, notes: `Official conservation-area geometry used as the reviewed historic core. A 300m buffer captures the immediate settlement for map selection.${seed.split ? ' The source designation covers Elie and Earlsferry jointly; this entry preserves that provenance and applies a transparent editorial split.' : ''}` },
    },
    features,
    sources: [
      { id: 'hes-conservation-area', name: 'Historic Environment Scotland Conservation Areas spatial data', organisation: 'Historic Environment Scotland', coverage: `${seed.conservationArea} official conservation area`, accessMethod: 'Bundled HES Shapefile; named-feature selection', sourceUrl: hesDownloads, licence: 'Open Government Licence v3.0.', reliability: 'official_non_statutory', limitations: 'A conservation area is a historic-core study boundary, not an administrative settlement boundary.' },
      { id: 'hes-listed-buildings', name: 'Historic Environment Scotland Listed Buildings spatial data', organisation: 'Historic Environment Scotland', coverage: `Listed-building points within the ${seed.name} study boundary`, accessMethod: 'Bundled HES Shapefile; exact point-in-polygon selection', sourceUrl: hesDownloads, licence: 'Open Government Licence v3.0.', reliability: 'official_statutory', limitations: 'Spatial data establishes designation and location, not construction dates.' },
      { id: 'fife-visitor-evidence', name: 'Welcome to Fife and Fife Council visitor evidence', organisation: 'Fife Council / Welcome to Fife', coverage: `${seed.name} visitor offer and responsible trail information`, accessMethod: 'Editorial review of official destination pages', sourceUrl: seed.sourceUrls[0], reliability: 'local_authority', limitations: 'Opening, access and seasonal conditions must be checked with operators.' },
    ], historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`${seed.name} has ${errors.length} validation errors.`);
  await writeFile(resolve('data/projects', `${seed.id.replace('-scotland', '')}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  planner[seed.id] = trail ? { trails: [trail.id] } : {};
  dogProjects[seed.id] = { attraction: Object.fromEntries(curated.map((feature, index) => [feature.id, {
    rating: 0, status: 'unconfirmed', label: 'Dog policy not confirmed',
    summary: 'No reliable current dog policy was published in the reviewed visitor source; check directly before making a dog-dependent visit.',
    sourceName: 'Reviewed official visitor information', sourceUrl: seed.highlights[index].source, reviewedAt,
  }])) };
}

await writeFile(resolve('data/east-neuk-visitor-planner-curation.json'), `${JSON.stringify({ schemaVersion: 1, projects: planner }, null, 2)}\n`, 'utf8');
await writeFile(resolve('data/east-neuk-dog-access-curation.json'), `${JSON.stringify({ schemaVersion: 1, reviewedAt, projects: dogProjects }, null, 2)}\n`, 'utf8');
await writeFile(resolve('data/review/east-neuk-fife-town-assessment-2026-08-25.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, rule: 'Publish only settlements scoring 60 or more under the strict in-boundary town visitor method.',
  assessments: [
    ...towns.map((town) => ({ requestedName: town.name, resolvedName: town.name, score: town.score, publish: true, dogAccessRating: town.dogAccessRating, rationale: town.summary, sourceUrls: town.sourceUrls })),
    ...rejected.map(([requestedName, resolvedName, score, rationale]) => ({ requestedName, resolvedName, score, publish: false, rationale })),
  ],
  nameEvidence: { source: 'Fife Place-name Data', sourceUrl: 'https://fife-placenames.glasgow.ac.uk/volume/', notes: ['Kilconghar resolved to Kilconquhar.', 'Newton of Balcoma resolved to Newton of Balcormo.', 'Wester Pitkerie resolved to West Pitkierie.', 'Easter Pitcarie treated as the probable requested match Easter Pitcorthie.', 'Balcomie Links is a golf course, not a settlement.'] },
}, null, 2)}\n`, 'utf8');

console.log(`Created ${towns.length} publishable East Neuk town packages; documented ${rejected.length} exclusions.`);
