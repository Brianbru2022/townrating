import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import {
  booleanPointInPolygon,
  buffer,
  featureCollection,
  lineString,
  point,
  pointOnFeature,
  union,
} from '@turf/turf';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

const reviewedAt = '2026-08-07T00:00:00Z';
const reviewedDate = '2026-08-07';
const projectId = 'peterborough-england';
const onsUrl =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/main_ONS_BUA_2024_EW_V2/FeatureServer/0/query?f=geojson&where=BUA24NM%3D%27Peterborough%27&outFields=*&returnGeometry=true&outSR=4326";
const projectPath = resolve('data/projects/peterborough.json');
const auditPath = resolve('data/review/peterborough-visitor-audit-2026-08-07.json');
const plannerPath = resolve('data/visitor-planner-curation.json');
const dogPath = resolve('data/dog-access-curation.json');
const nhleRoot = resolve(
  'data/reference/england_wales_national_data_downloader/downloads/england/nhle',
);
const editorialLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.';

const scoring = {
  age: {
    before_1700: 1,
    '1700_1799': 0.9,
    '1800_1849': 0.8,
    '1850_1899': 0.65,
    '1900_1918': 0.5,
    '1919_1945': 0.4,
    '1946_1960': 0.25,
    after_1960: 0.15,
    unknown: 0.2,
  },
  significance: { highest_national: 1, national: 0.85, regional: 0.65, local: 0.45, recognised: 0.3 },
  confidence: { high: 1, medium: 0.75, low: 0.5, unknown: 0.35 },
  survival: {
    substantially_intact: 1,
    altered_recognisable: 0.75,
    heavily_altered: 0.45,
    site_only_or_demolished: 0.2,
    unknown: 0.6,
  },
} as const;

function source(
  name: string,
  organisation: string,
  id: string,
  url: string,
  notes: string,
  reliability: SourceRecord['reliability'] = 'official_non_statutory',
  licence = editorialLicence,
): SourceRecord {
  return {
    sourceName: name,
    sourceOrganisation: organisation,
    sourceRecordId: id,
    sourceUrl: url,
    accessedAt: reviewedAt,
    reliability,
    licence,
    notes,
  };
}

function place(options: {
  id: string;
  name: string;
  type: string;
  coordinates: [number, number];
  description?: string;
  currentNotes: string;
  url: string;
  sourceName: string;
  organisation: string;
  reliability?: SourceRecord['reliability'];
  significance?: HeritageFeature['significance'];
  earliest?: number;
  latest?: number;
  dateText?: string;
  tags: string[];
}): HeritageFeature {
  return {
    id: options.id,
    projectId,
    name: options.name,
    alternativeNames: [],
    countryCode: 'GB-ENG',
    region: 'Cambridgeshire',
    locality: 'Peterborough',
    featureType: options.type,
    significance: options.significance ?? 'local',
    geometry: point(options.coordinates).geometry,
    locationType: 'representative_point',
    locationConfidence: 'high',
    documentedDateText: options.dateText,
    earliestPossibleYear: options.earliest,
    latestPossibleYear: options.latest,
    dateBasis: options.earliest ? (options.latest ? 'documented_date_range' : 'documented_construction') : 'unknown',
    dateConfidence: options.earliest ? 'high' : 'unknown',
    survival: 'substantially_intact',
    shortDescription: options.description,
    sourceRecords: [
      source(
        options.sourceName,
        options.organisation,
        `visitor-audit:${options.id}`,
        options.url,
        `Current-place curation: ${options.currentNotes}.`,
        options.reliability,
        `${editorialLicence} Geometry derived from ${osmLicence}`,
      ),
    ],
    tags: [...new Set(['peterborough-visitor-audit', 'current-context', ...options.tags])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: 'Visitor information and representative location audited 2026-08-07.',
    evidenceScope: options.earliest ? 'parish_evidence' : 'related_context',
    licence: editorialLicence,
  };
}

const response = await fetch(onsUrl, { headers: { 'User-Agent': 'TownscapeGuides/1.0' } });
if (!response.ok) throw new Error(`ONS boundary request failed: ${response.status}`);
const onsCollection = (await response.json()) as FeatureCollection<Polygon | MultiPolygon>;
const onsBoundary = onsCollection.features[0];
if (!onsBoundary) throw new Error('Peterborough ONS 2024 built-up area was not returned');
onsBoundary.properties = {
  ...(onsBoundary.properties ?? {}),
  sourceDataset: 'ONS Built-up Areas (December 2024)',
  localityName: 'Peterborough',
  localityCode: 'E63009810',
};

const ferryCorridor = buffer(
  lineString([
    [-0.252, 52.568],
    [-0.280, 52.560],
    [-0.310, 52.5657],
  ]),
  0.38,
  { units: 'kilometers' },
);
const ferryCluster = buffer(point([-0.3101, 52.5657]), 1.25, { units: 'kilometers' });
const flagFenCorridor = buffer(
  lineString([
    [-0.215, 52.573],
    [-0.1893, 52.5747],
  ]),
  0.24,
  { units: 'kilometers' },
);
const flagFenCluster = buffer(point([-0.1893, 52.5747]), 0.65, { units: 'kilometers' });
if (!ferryCorridor || !ferryCluster || !flagFenCorridor || !flagFenCluster) {
  throw new Error('Could not construct Peterborough visitor extensions');
}
const visitorBoundary = union(
  featureCollection([onsBoundary, ferryCorridor, ferryCluster, flagFenCorridor, flagFenCluster]),
);
if (!visitorBoundary) throw new Error('Could not construct Peterborough visitor boundary');
const activeBoundary = visitorBoundary;
visitorBoundary.properties = {
  sourceDataset: 'Curated Peterborough visitor study boundary',
  localityName: 'Peterborough',
  originalSourceDataset: 'ONS Built-up Areas (December 2024)',
  originalLocalityCode: 'E63009810',
  visitorExtensionReviewedAt: reviewedDate,
  visitorExtensionReason:
    'The official ONS built-up area is preserved and unioned with narrow visitor corridors and clusters for Ferry Meadows, the Nene Valley Railway city-side stops and Flag Fen. This is a visitor-study boundary, not an administrative boundary.',
};

const features: HeritageFeature[] = [];
const byId = new Map<string, HeritageFeature>();
function add(feature: HeritageFeature): HeritageFeature {
  const existing = byId.get(feature.id);
  if (existing) Object.assign(existing, feature);
  else {
    byId.set(feature.id, feature);
    features.push(feature);
  }
  return feature;
}

function nhleSignificance(grade?: string): HeritageFeature['significance'] {
  if (grade === 'I') return 'highest_national';
  if (grade === 'II*') return 'national';
  return 'regional';
}

async function importNhleFolder(folder: string, designationType: string, tag: string) {
  const directory = resolve(nhleRoot, folder);
  const files = (await readdir(directory)).filter((name) => name.endsWith('.geojson'));
  for (const filename of files) {
    const collection = JSON.parse(await readFile(resolve(directory, filename), 'utf8')) as FeatureCollection;
    for (const record of collection.features) {
      if (!record.geometry) continue;
      const representative = pointOnFeature(record as Feature<Geometry>);
      if (!booleanPointInPolygon(representative, activeBoundary)) continue;
      const properties = (record.properties ?? {}) as Record<string, unknown>;
      const listEntry = String(properties.ListEntry ?? properties.LIST_ENTRY ?? `${basename(filename)}-${features.length}`);
      const name = String(properties.Name ?? properties.NAME ?? 'Historic England designation');
      const grade = properties.Grade ? String(properties.Grade) : undefined;
      const id = `historic-england:nhle:${listEntry}`;
      if (byId.has(id)) continue;
      add({
        id,
        projectId,
        name,
        alternativeNames: [],
        countryCode: 'GB-ENG',
        region: 'Cambridgeshire',
        locality: 'Peterborough',
        featureType: /cathedral/i.test(name) ? 'cathedral' : /church/i.test(name) ? 'church' : /bridge/i.test(name) ? 'bridge' : /tower/i.test(name) ? 'tower' : 'other',
        designationType,
        designationCategory: grade,
        significance: designationType === 'scheduled_monument' ? 'highest_national' : nhleSignificance(grade),
        statutoryStatus: 'National Heritage List for England',
        geometry: representative.geometry,
        locationType: record.geometry.type.includes('Polygon') ? 'site_centroid' : 'representative_point',
        locationConfidence: 'high',
        dateBasis: 'unknown',
        dateConfidence: 'unknown',
        survival: 'unknown',
        shortDescription: `${designationType.replaceAll('_', ' ')} recorded by Historic England${grade ? `, Grade ${grade}` : ''}.`,
        sourceRecords: [
          source(
            'National Heritage List for England',
            'Historic England',
            listEntry,
            String(properties.hyperlink ?? `https://historicengland.org.uk/listing/the-list/list-entry/${listEntry}`),
            'Official statutory designation. The bulk record provides designation metadata but not a defensible construction date, so the historic date remains unknown.',
            'official_statutory',
            'Open Government Licence v3.0; contains Historic England data.',
          ),
        ],
        tags: ['historic-england', 'nhle', tag],
        createdAt: reviewedAt,
        updatedAt: reviewedAt,
        reviewed: true,
        reviewNotes: 'Imported from the locally bundled Historic England national download and filtered against the active visitor boundary.',
        evidenceScope: 'parish_evidence',
        licence: 'Open Government Licence v3.0; contains Historic England data.',
      });
    }
  }
}

await importNhleFolder('00_listed_building_points', 'listed_building', 'listed-building');
await importNhleFolder('06_scheduled_monuments', 'scheduled_monument', 'scheduled-monument');
await importNhleFolder('07_parks_and_gardens', 'registered_park_and_garden', 'registered-park-and-garden');

const attractions = [
  add(place({ id: 'curated-attraction:peterborough-cathedral', name: 'Peterborough Cathedral', type: 'cathedral', coordinates: [-0.239489, 52.572481], description: 'Step beneath one of Europe’s great Norman interiors, look up at the rare painted wooden ceiling and find Katharine of Aragon’s tomb behind an unmistakable three-arched west front.', currentNotes: 'tourism=attraction; visitor_place_type=Norman cathedral; visit_score=94; opening_hours:description=Usually Monday-Saturday 10:00-16:00 and Sunday 12:00-15:00; services and events can restrict access; entrance_fee=Entry by donation; time_to_spend=60-120 minutes; website=https://peterborough-cathedral.org.uk/opening-times/', url: 'https://peterborough-cathedral.org.uk/opening-times/', sourceName: 'Peterborough Cathedral visitor information', organisation: 'Peterborough Cathedral', significance: 'highest_national', earliest: 1118, latest: 1238, dateText: 'Norman rebuilding begun 1118; major work continued into the 13th century', tags: ['service-context-visitor', 'service-context-heritage'] })),
  add(place({ id: 'curated-attraction:peterborough-flag-fen', name: 'Flag Fen Archaeology Park', type: 'archaeological_site', coordinates: [-0.189295, 52.574733], description: 'Walk beside the remains of a 3,500-year-old timber causeway and platform, then see preserved Bronze Age wood and Must Farm log boats in the landscape where they were found.', currentNotes: 'tourism=attraction; visitor_place_type=Bronze Age archaeology park; visit_score=89; opening_hours:description=Seasonal opening; check the current calendar before travel; entrance_fee=Adult £8, child £4, family £20; time_to_spend=90-150 minutes; parking=Free visitor parking; toilets=yes; picnic=yes; website=https://flagfen.org.uk/plan-your-visit', url: 'https://flagfen.org.uk/plan-your-visit', sourceName: 'Flag Fen plan your visit', organisation: 'City Culture Peterborough', significance: 'highest_national', earliest: -1350, latest: -950, dateText: 'Bronze Age timber causeway and platform, c.1350-950 BC', tags: ['service-context-visitor', 'service-context-heritage'] })),
  add(place({ id: 'curated-attraction:peterborough-ferry-meadows', name: 'Ferry Meadows and Nene Park', type: 'park', coordinates: [-0.307088, 52.562994], description: 'Trade city streets for lakes, meadows and woodland with easy waterside paths, wildlife, cycle routes, play areas and outdoor activities less than three miles from the centre.', currentNotes: 'tourism=attraction; visitor_place_type=Country park and lakes; visit_score=87; opening_hours:description=Open to pedestrians and cyclists at all times; vehicle gates use seasonal hours; entrance_fee=Free; parking=Pay; time_to_spend=2-5 hours; website=https://www.nenepark.org.uk/parks-places/ferry-meadows/', url: 'https://www.nenepark.org.uk/parks-places/ferry-meadows/', sourceName: 'Ferry Meadows visitor information', organisation: 'Nene Park Trust', tags: ['service-context-visitor', 'service-context-park'] })),
  add(place({ id: 'curated-attraction:peterborough-museum', name: 'Peterborough Museum and Art Gallery', type: 'museum', coordinates: [-0.246067, 52.571656], description: 'Meet the city through Roman finds, archaeology, local social history and changing art displays inside a handsome Georgian building close to Cathedral Square.', currentNotes: 'tourism=museum; visitor_place_type=City museum and art gallery; visit_score=82; opening_hours:description=Tuesday-Saturday 10:00-16:00, last entry 15:30; Sunday-Monday closed; entrance_fee=Free except selected exhibitions and events; time_to_spend=60-120 minutes; website=https://peterboroughmuseum.org.uk/plan-your-visit', url: 'https://peterboroughmuseum.org.uk/plan-your-visit', sourceName: 'Peterborough Museum plan your visit', organisation: 'City Culture Peterborough', significance: 'regional', earliest: 1816, dateText: 'Museum occupies a Georgian building completed in 1816', tags: ['service-context-visitor', 'service-context-heritage'] })),
  add(place({ id: 'curated-attraction:peterborough-longthorpe-tower', name: 'Longthorpe Tower', type: 'tower', coordinates: [-0.286828, 52.570857], description: 'A modest medieval tower hides one of England’s most remarkable surviving schemes of 14th-century domestic wall painting, best understood on a guided visit.', currentNotes: 'tourism=attraction; visitor_place_type=Medieval wall paintings; visit_score=80; opening_hours:description=Seasonal guided opening on selected weekends; pre-book before travel; entrance_fee=Adult £5, child £3, concession £4; English Heritage members and under-5s free; time_to_spend=45-75 minutes; operator=English Heritage; website=https://www.english-heritage.org.uk/visit/places/longthorpe-tower/', url: 'https://www.english-heritage.org.uk/visit/places/longthorpe-tower/', sourceName: 'Longthorpe Tower visitor information', organisation: 'English Heritage', significance: 'highest_national', earliest: 1300, latest: 1350, dateText: 'Early 14th-century tower and wall paintings', tags: ['service-context-visitor', 'service-context-heritage'] })),
  add(place({ id: 'curated-attraction:peterborough-railworld', name: 'Railworld Wildlife Haven', type: 'railway', coordinates: [-0.24812, 52.568047], description: 'A volunteer-built mix of railway exhibits, model engineering and an unexpectedly leafy wildlife haven beside the main line gives families an eccentric, hands-on stop.', currentNotes: 'tourism=attraction; visitor_place_type=Railway and wildlife museum; visit_score=78; opening_hours:description=Seasonal opening; check current dates before travel; entrance_fee=Adult £5, concession £4, child £3, family £12; time_to_spend=60-120 minutes; parking=Free for ticket holders; website=https://www.railworld.org.uk/', url: 'https://www.railworld.org.uk/', sourceName: 'Railworld Wildlife Haven visitor information', organisation: 'Railworld Wildlife Haven', tags: ['service-context-visitor', 'service-context-heritage'] })),
  add(place({ id: 'curated-attraction:peterborough-lido', name: 'Peterborough Lido', type: 'other', coordinates: [-0.238414, 52.570002], description: 'Swim outdoors beneath the diving stages of a handsome 1930s lido, a rare city-centre summer experience beside the river and embankment.', currentNotes: 'tourism=attraction; visitor_place_type=Historic outdoor swimming pool; visit_score=76; opening_hours:description=Seasonal opening with session times; check the current timetable; entrance_fee=Pay; time_to_spend=60-150 minutes; website=https://discoverpeterborough.co.uk/things-to-do/peterborough-lido/', url: 'https://discoverpeterborough.co.uk/things-to-do/peterborough-lido/', sourceName: 'Peterborough Lido visitor information', organisation: 'Discover Peterborough', significance: 'national', earliest: 1936, dateText: 'Grade II-listed outdoor pool opened in 1936', tags: ['service-context-visitor', 'service-context-leisure'] })),
  add(place({ id: 'curated-attraction:peterborough-central-park', name: 'Central Park', type: 'park', coordinates: [-0.235285, 52.584313], description: 'A Green Flag park with formal gardens, mature trees, aviary and play space offers a gentle local pause north of the city centre.', currentNotes: 'tourism=attraction; visitor_place_type=Historic public park; visit_score=68; opening_hours:description=Open daily; visit in daylight; entrance_fee=Free; time_to_spend=30-90 minutes; website=https://discoverpeterborough.co.uk/things-to-do/central-park/', url: 'https://discoverpeterborough.co.uk/things-to-do/central-park/', sourceName: 'Central Park visitor information', organisation: 'Discover Peterborough', tags: ['service-context-visitor', 'service-context-park'] })),
];
attractions[0].attractionGuide = {
  toilets:
    'Public toilets are available just outside the South Transept doors; ask a cathedral steward for directions.',
  thingsToDo: [
    {
      name: 'The Norman nave and painted ceiling',
      summary:
        'Walk the great Romanesque nave and look up at the rare painted wooden ceiling dating from around 1230.',
    },
    {
      name: "Katharine of Aragon's tomb",
      summary:
        "Find the Tudor queen's burial place and the former resting place of Mary, Queen of Scots.",
    },
    {
      name: 'The New Building fan vaulting',
      summary:
        "Step into the late-medieval eastern extension for some of the cathedral's finest fan vaulting.",
    },
    {
      name: 'The Hedda Stone',
      summary:
        "See the carved early medieval stone that survives from the cathedral's Saxon predecessor.",
    },
    {
      name: 'A cathedral tour',
      summary:
        'Choose the one-hour ground-level Highlights Tour or, when available, the longer Upper Levels and Tower Tour.',
    },
  ],
};

const highlightMetadata = [
  ['Cathedral icon', 'Usually Monday-Saturday 10:00-16:00; Sunday 12:00-15:00.', 'Entry by donation.', true],
  ['Bronze Age landscape', 'Seasonal opening; check the current calendar.', 'Adult £8; child £4; family £20.', false],
  ['Lakes and meadows', 'Pedestrian and cycle access at all times; seasonal vehicle gates.', 'Free; parking charges apply.', true],
  ['City story', 'Tuesday-Saturday 10:00-16:00; last entry 15:30.', 'Free except selected exhibitions and events.', true],
  ['Medieval paintings', 'Seasonal guided opening on selected weekends; pre-book.', 'Adult £5; child £3; concession £4; EH members free.', false],
  ['Railway curiosity', 'Seasonal opening; check current dates.', 'Adult £5; concession £4; child £3; family £12.', false],
  ['Open-air swim', 'Seasonal sessions; check the current timetable.', 'Paid admission.', false],
  ['Garden pause', 'Open daily; visit in daylight.', 'Free.', true],
] as const;

const food = [
  add(place({ id: 'curated-food:peterborough-tap-and-tandoor', name: 'Tap & Tandoor Peterborough', type: 'restaurant', coordinates: [-0.24077, 52.57315], description: 'Craft beer and confident Indian cooking make this city-centre gastropub a distinctive lunch or evening choice rather than a generic curry stop.', currentNotes: 'amenity=restaurant; cuisine=Indian gastropub; visit_score=86; price_band=££; opening_hours:description=Monday-Thursday 12:00-23:00, Friday-Saturday 12:00-midnight, Sunday 12:00-22:00; description=Indian gastropub: Craft beer and confident Indian cooking make this a distinctive central lunch or evening choice rather than a generic curry stop.; dog_friendly=yes; website=https://tapandtandoor.co.uk/pages/peterborough', url: 'https://tapandtandoor.co.uk/pages/peterborough', sourceName: 'Tap & Tandoor Peterborough', organisation: 'Tap & Tandoor', tags: ['service-context-food', 'visitor-context-food'] })),
  add(place({ id: 'curated-food:peterborough-black-and-bloom', name: 'Black & Bloom', type: 'cafe', coordinates: [-0.24255, 52.57218], description: 'A serious independent coffee stop with carefully sourced beans, brunch and cake, made especially useful by welcoming well-behaved dogs inside.', currentNotes: 'amenity=cafe; cuisine=Speciality coffee and brunch; visit_score=83; price_band=££; opening_hours:description=Daily 08:00-17:00; description=Speciality coffee: Carefully sourced beans, brunch and cake in an independent cafe that explicitly welcomes well-behaved dogs inside.; dog_friendly=yes; website=https://blackandbloom.co.uk/', url: 'https://blackandbloom.co.uk/', sourceName: 'Black & Bloom visitor information', organisation: 'Black & Bloom', tags: ['service-context-food', 'visitor-context-food'] })),
  add(place({ id: 'curated-food:peterborough-kathmandu-lounge', name: 'Kathmandu Lounge', type: 'restaurant', coordinates: [-0.24535, 52.57215], description: 'A polished Nepalese and Indian restaurant for momos, curries and a more substantial evening meal close to the centre.', currentNotes: 'amenity=restaurant; cuisine=Nepalese and Indian; visit_score=81; price_band=££; opening_hours:description=Evening service; check current hours when booking; description=Nepalese dining: Momos, curries and a polished setting make this a strong choice for a more substantial evening meal close to the centre.; website=https://discoverpeterborough.co.uk/things-to-do/eat-and-drink/kathmandu-lounge/', url: 'https://discoverpeterborough.co.uk/things-to-do/eat-and-drink/kathmandu-lounge/', sourceName: 'Kathmandu Lounge listing', organisation: 'Discover Peterborough', reliability: 'secondary', tags: ['service-context-food', 'visitor-context-food'] })),
  add(place({ id: 'curated-food:peterborough-embe-soul-food', name: 'Embe Soul Food', type: 'restaurant', coordinates: [-0.2459, 52.57345], description: 'Warm Afro-Caribbean cooking brings jerk flavours, slow-cooked dishes and a welcome point of difference to Peterborough’s independent food scene.', currentNotes: 'amenity=restaurant; cuisine=Afro-Caribbean; visit_score=80; price_band=££; opening_hours:description=Published Tuesday-Saturday lunch and evening, with shorter Sunday hours; confirm before travel; description=Afro-Caribbean flavours: Jerk flavours and slow-cooked dishes bring a welcome point of difference to Peterborough’s independent food scene.; website=https://www.embe2go.com/about', url: 'https://www.embe2go.com/about', sourceName: 'Embe Soul Food visitor information', organisation: 'Embe Soul Food', tags: ['service-context-food', 'visitor-context-food'] })),
  add(place({ id: 'curated-food:peterborough-bewiched-bridge-street', name: 'Bewiched Coffee - Bridge Street', type: 'cafe', coordinates: [-0.24254, 52.57056], description: 'A dependable Peterborough-born coffee house for breakfast, sandwiches, cake and a quick central pause with longer hours than many independents.', currentNotes: 'amenity=cafe; cuisine=Coffee, breakfast and light lunches; visit_score=78; price_band=££; opening_hours:description=Monday-Friday 07:30-18:30, Saturday 08:00-18:30, Sunday 09:00-17:00; description=Peterborough coffee: A dependable locally born coffee house for breakfast, sandwiches, cake and a quick central pause with useful longer hours.; website=https://discoverpeterborough.co.uk/things-to-do/eat-and-drink/bewiched-coffee-bridge-street/', url: 'https://discoverpeterborough.co.uk/things-to-do/eat-and-drink/bewiched-coffee-bridge-street/', sourceName: 'Bewiched Coffee Bridge Street listing', organisation: 'Discover Peterborough', reliability: 'secondary', tags: ['service-context-food', 'visitor-context-food'] })),
  add(place({ id: 'curated-food:peterborough-argo-lounge', name: 'Argo Lounge', type: 'restaurant', coordinates: [-0.24135, 52.57245], description: 'A relaxed all-day fallback near Cathedral Square with brunch, lighter meals, cocktails and clearly marked vegetarian, vegan and gluten-free choices.', currentNotes: 'amenity=restaurant; cuisine=All-day cafe bar; visit_score=76; price_band=££; opening_hours:description=Open daily from breakfast into the evening; check current closing time; description=Flexible all-day choice: Brunch, lighter meals, cocktails and clearly marked vegetarian, vegan and gluten-free dishes close to Cathedral Square.; website=https://thelounges.co.uk/argo/', url: 'https://thelounges.co.uk/argo/', sourceName: 'Argo Lounge visitor information', organisation: 'Loungers', tags: ['service-context-food', 'visitor-context-food'] })),
];

const trails = [
  add(place({ id: 'curated-trail:peterborough-three-lakes', name: 'Three Lakes Trail', type: 'walking_route', coordinates: [-0.313, 52.5652], description: 'An easy Ferry Meadows circuit loops Gunwade, Lynch and Overton lakes through open water, woodland and wildlife-rich parkland.', currentNotes: 'route=foot; trail_type=Easy lakeside circuit; visit_score=86; distance=4 km / 2.5 miles; time_to_spend=50-60 minutes; entrance_fee=Free; accessibility=Mostly level surfaced paths; website=https://www.nenepark.org.uk/things-to-do/walks-and-trails/', url: 'https://www.nenepark.org.uk/things-to-do/walks-and-trails/', sourceName: 'Nene Park walks and trails', organisation: 'Nene Park Trust', tags: ['service-context-walk', 'visitor-context-trail'] })),
  add(place({ id: 'curated-trail:peterborough-blue-plaque', name: 'Peterborough Blue Plaque Trail', type: 'walking_route', coordinates: [-0.2422, 52.5722], description: 'A self-guided city-centre wander uses blue plaques to connect notable people, buildings and episodes around the Cathedral Quarter.', currentNotes: 'route=foot; trail_type=Self-guided city heritage trail; visit_score=82; distance=Flexible city-centre route; time_to_spend=60-120 minutes; entrance_fee=Free; accessibility=Urban pavements and road crossings; website=https://discoverpeterborough.co.uk/things-to-do/peterborough-blue-plaque-trail/', url: 'https://discoverpeterborough.co.uk/things-to-do/peterborough-blue-plaque-trail/', sourceName: 'Peterborough Blue Plaque Trail', organisation: 'Discover Peterborough', tags: ['service-context-walk', 'visitor-context-trail'] })),
  add(place({ id: 'curated-trail:peterborough-green-wheel', name: 'Peterborough Green Wheel', type: 'walking_route', coordinates: [-0.2797, 52.5601], description: 'A signed cycle network circles Peterborough and links the centre, Nene Park, river landscapes and outlying villages for a much bigger active day.', currentNotes: 'route=bicycle; trail_type=Signed circular cycle network; visit_score=81; distance=About 45 miles / 72 km for the full circuit; time_to_spend=Full day or shorter sections; entrance_fee=Free; accessibility=Mixed traffic-free paths and road sections; website=https://www.sustrans.org.uk/find-a-route-on-the-national-cycle-network/peterborough-green-wheel/', url: 'https://www.sustrans.org.uk/find-a-route-on-the-national-cycle-network/peterborough-green-wheel/', sourceName: 'Peterborough Green Wheel route', organisation: 'Sustrans', tags: ['service-context-walk', 'visitor-context-trail'] })),
  add(place({ id: 'curated-trail:peterborough-big-tree-hunt', name: 'Big Tree Hunt', type: 'walking_route', coordinates: [-0.265, 52.567], description: 'A family-friendly route follows notable trees from the city towards Ferry Meadows, working as a walk, cycle or scooter outing with a natural-history theme.', currentNotes: 'route=foot; trail_type=Family tree trail; visit_score=78; distance=3.6 miles / 5.8 km; time_to_spend=90-150 minutes; entrance_fee=Free; accessibility=Mixed urban and park paths; website=https://www.nenepark.org.uk/the-big-tree-hunt', url: 'https://www.nenepark.org.uk/the-big-tree-hunt', sourceName: 'Big Tree Hunt', organisation: 'Nene Park Trust', tags: ['service-context-walk', 'visitor-context-trail'] })),
];

const parkingUrl = 'https://www.peterborough.gov.uk/residents/parking/car-park-locations';
const toiletsUrl = 'https://www.peterborough.gov.uk/libraries-leisure-culture-facilities/public-toilets';
const parking = [
  add(place({ id: 'curated-parking:peterborough-car-haven', name: 'Car Haven Car Park', type: 'parking', coordinates: [-0.240688, 52.570855], currentNotes: 'amenity=parking; parking=surface; access=public; capacity=214; capacity:disabled=10; capacity:charging=2; payment_required=yes; price_display=Pay - 10 minutes free, then £2.50 for 1 hour to £12 all day; opening_hours:description=Open 24 hours; charges 07:00-20:00 daily; payment:cash=yes; payment:cards=yes; payment:contactless=yes; maxstay=13 hours; operator=Peterborough City Council; website=' + parkingUrl, url: parkingUrl, sourceName: 'Peterborough car park locations and charges', organisation: 'Peterborough City Council', reliability: 'local_authority', tags: ['service-context-parking'] })),
  add(place({ id: 'curated-parking:peterborough-riverside', name: 'Riverside Car Park', type: 'parking', coordinates: [-0.239619, 52.569254], currentNotes: 'amenity=parking; parking=surface; access=public; capacity=162; capacity:disabled=7; capacity:charging=6; payment_required=yes; price_display=Pay - 10 minutes free, then £2.20 for 1 hour to £8 all day; opening_hours:description=Open 24 hours; charges 07:00-20:00 daily; payment:cash=yes; payment:cards=yes; payment:contactless=yes; maxstay=13 hours; operator=Peterborough City Council; website=' + parkingUrl, url: parkingUrl, sourceName: 'Peterborough car park locations and charges', organisation: 'Peterborough City Council', reliability: 'local_authority', tags: ['service-context-parking'] })),
  add(place({ id: 'curated-parking:peterborough-sand-martin-house', name: 'Sand Martin House Multi-storey', type: 'parking', coordinates: [-0.24705, 52.5659], currentNotes: 'amenity=parking; parking=multi-storey; covered=yes; access=public; capacity=386; capacity:disabled=14; capacity:charging=4; payment_required=yes; price_display=Pay - £2.50 for 1 hour to £12 weekday day rate, £6 weekend day rate, £3 overnight; opening_hours:description=Open and charged 24 hours daily; payment:cash=yes; payment:cards=yes; payment:contactless=yes; operator=Peterborough City Council; website=' + parkingUrl, url: parkingUrl, sourceName: 'Peterborough car park locations and charges', organisation: 'Peterborough City Council', reliability: 'local_authority', tags: ['service-context-parking'] })),
  add(place({ id: 'curated-parking:peterborough-ferry-meadows', name: 'Ferry Meadows Main Car Park', type: 'parking', coordinates: [-0.30755, 52.5629], currentNotes: 'amenity=parking; parking=surface; access=public; payment_required=yes; price_display=Pay - £2.60 up to 1 hour, £3.60 up to 2 hours, £5.20 up to 3 hours, £6.40 up to 4 hours, £7.40 up to 8 hours, £7.80 over 8 hours; opening_hours:description=Seasonal vehicle gate times; charges apply all day every day; capacity:disabled=yes; operator=Nene Park Trust; website=https://www.nenepark.org.uk/news/parking-tariff-increase-from-1st-february-2026', url: 'https://www.nenepark.org.uk/news/parking-tariff-increase-from-1st-february-2026', sourceName: 'Ferry Meadows parking tariffs', organisation: 'Nene Park Trust', tags: ['service-context-parking'] })),
];

const toilets = [
  add(place({ id: 'osm-community:node-4362725305', name: 'Peterborough railway station toilets', type: 'toilets', coordinates: [-0.250109, 52.574744], currentNotes: 'amenity=toilets; access=public; fee=no; opening_hours:description=Available during station opening hours; wheelchair=yes; description=Toilets inside Peterborough railway station', url: 'https://www.nationalrail.co.uk/stations/peterborough/', sourceName: 'Peterborough station facilities', organisation: 'National Rail', tags: ['service-context-toilets'] })),
  add(place({ id: 'curated-toilets:peterborough-car-haven', name: 'Car Haven public toilets and Changing Places', type: 'toilets', coordinates: [-0.240688, 52.570855], currentNotes: 'amenity=toilets; access=public; fee=yes; charge=20p; wheelchair=yes; changing_places=yes; opening_hours:description=Monday-Friday 08:00-17:00; Saturday-Sunday 10:00-16:00; closed Christmas Day and Easter Sunday; description=Male, female and accessible toilets at Car Haven Car Park. The council reported the Changing Places room temporarily unavailable in May 2026, so check its current status.; website=' + toiletsUrl, url: toiletsUrl, sourceName: 'Peterborough public toilets', organisation: 'Peterborough City Council', reliability: 'local_authority', tags: ['service-context-toilets'] })),
  add(place({ id: 'osm-community:node-9712420636', name: 'Central Park public toilets', type: 'toilets', coordinates: [-0.234922, 52.584943], currentNotes: 'amenity=toilets; access=public; fee=no; wheelchair=yes; opening_hours:description=May-September 08:00-19:00; October-April 08:00-16:00; description=Male, female and RADAR-key accessible toilets in Central Park; website=' + toiletsUrl, url: toiletsUrl, sourceName: 'Peterborough public toilets', organisation: 'Peterborough City Council', reliability: 'local_authority', tags: ['service-context-toilets'] })),
  add(place({ id: 'curated-toilets:peterborough-town-hall', name: 'Peterborough Town Hall public toilets', type: 'toilets', coordinates: [-0.2421, 52.5714], currentNotes: 'amenity=toilets; access=public; fee=no; wheelchair=yes; opening_hours:description=Monday-Friday 09:00-17:00, excluding public holidays; description=Male, female and RADAR-key accessible toilets inside Peterborough Town Hall on Bridge Street; website=' + toiletsUrl, url: toiletsUrl, sourceName: 'Peterborough public toilets', organisation: 'Peterborough City Council', reliability: 'local_authority', tags: ['service-context-toilets'] })),
  add(place({ id: 'osm-community:way-297362942', name: 'Ferry Meadows Visitor Centre toilets and Changing Places', type: 'toilets', coordinates: [-0.307068, 52.562264], currentNotes: 'amenity=toilets; access=public; fee=no; wheelchair=yes; changing_places=yes; opening_hours:description=Available during park facility hours; description=Visitor Centre toilets and nearby Changing Places facility at Ferry Meadows', url: 'https://www.nenepark.org.uk/ferry-meadows/visitor-centre', sourceName: 'Ferry Meadows visitor facilities', organisation: 'Nene Park Trust', tags: ['service-context-toilets'] })),
];

const picnic = [
  add(place({ id: 'curated-picnic:peterborough-central-park', name: 'Central Park picnic lawns', type: 'park', coordinates: [-0.2351, 52.5845], currentNotes: 'tourism=picnic_site; access=public; fee=no; opening_hours:description=Open daily; description=Open lawns and benches in Central Park', url: 'https://discoverpeterborough.co.uk/things-to-do/central-park/', sourceName: 'Central Park visitor information', organisation: 'Discover Peterborough', tags: ['service-context-picnic'] })),
  add(place({ id: 'curated-picnic:peterborough-ferry-meadows', name: 'Ferry Meadows lakeside picnic area', type: 'park', coordinates: [-0.3123, 52.5648], currentNotes: 'tourism=picnic_site; access=public; fee=no; opening_hours:description=Open with the park; description=Lakeside picnic lawns and tables near the visitor facilities', url: 'https://www.nenepark.org.uk/parks-places/ferry-meadows/', sourceName: 'Ferry Meadows visitor information', organisation: 'Nene Park Trust', tags: ['service-context-picnic'] })),
];

const pkg: ProjectPackage = {
  project: {
    id: projectId,
    name: 'Peterborough',
    countryCode: 'GB-ENG',
    country: 'England',
    region: 'Cambridgeshire',
    locality: 'Peterborough',
    centre: [-0.2404, 52.5726],
    boundary: visitorBoundary,
    boundarySource: 'ONS Built-up Areas (December 2024), with transparent visitor extensions to Flag Fen and the Ferry Meadows/Nene Valley visitor corridor. This is a curated visitor-town boundary, not an administrative boundary.',
    boundaryConfidence: 'high',
    sourceLanguage: 'en',
    preferredBasemap: 'openstreetmap',
    createdAt: reviewedAt,
    timelineStart: -1400,
    timelineEnd: 2026,
    methodology: scoring,
    researchNotes: 'Full visitor audit completed 2026-08-07. Statutory records come from the locally bundled Historic England NHLE download. The public planner contains only researched, named places inside the active visitor boundary.',
    touristAppeal: {
      rating: 3,
      label: 'Destination draw',
      summary: 'Peterborough earns three stars for a nationally important cathedral, exceptional Bronze Age archaeology at Flag Fen, a strong city museum and a second day of green-space, railway and outdoor options at Ferry Meadows and Railworld.',
    },
    visualIdentity: {
      theme: 'cathedral-river-city',
      badgeImage: '/town-guides/peterborough-cathedral-watercolour-guide.png',
      badgeAlt: 'Light ink-and-watercolour illustration of Peterborough Cathedral west front and precinct',
      heroImage: '/town-guides/peterborough-cathedral-watercolour-guide.png',
      heroAlt: 'Light ink-and-watercolour illustration of Peterborough Cathedral west front and precinct',
      heroObjectPosition: '50% 48%',
      primaryColour: '#173F42',
      accentColour: '#B97A2A',
      backgroundColour: '#EEF5EC',
      motifs: ['Norman cathedral', 'Bronze Age fen', 'Nene waterside', 'Railway city'],
    },
    townGuide: {
      headline: 'A monumental cathedral, Bronze Age fen and easy waterside escapes',
      intro: 'Peterborough pairs a vast Norman cathedral with Roman and local history at the city museum. Flag Fen carries the story into a Bronze Age landscape, while Ferry Meadows adds lakes, wildlife and easy waterside paths.',
      bestFor: ['Cathedral architecture', 'Archaeology', 'Family museums', 'Lakeside walking'],
      perfectFor: ['A cathedral-and-museum day', 'Families mixing history with Ferry Meadows', 'Visitors following Roman and Bronze Age stories'],
      suggestedFirstVisit: {
        title: 'Cathedral, museum and Cathedral Square',
        summary: 'Begin at the Cathedral while the precinct is quiet, cross to the museum for the wider city story, then use Cathedral Square for lunch before choosing Railworld or a drive to Flag Fen.',
      },
      dontMiss: ['Peterborough Cathedral', 'Flag Fen Archaeology Park', 'Ferry Meadows and Nene Park'],
      suggestedTime: 'A full day; two days with Flag Fen and Ferry Meadows',
      visitorMood: 'For heavyweight history, archaeology and easy green escapes in one short break.',
      sourceUrls: [
        'https://peterborough-cathedral.org.uk/',
        'https://flagfen.org.uk/plan-your-visit',
        'https://peterboroughmuseum.org.uk/plan-your-visit',
        'https://www.nenepark.org.uk/parks-places/ferry-meadows/',
        'https://www.english-heritage.org.uk/visit/places/longthorpe-tower/',
        'https://www.peterborough.gov.uk/residents/parking/car-park-locations',
      ],
      lastReviewedAt: reviewedDate,
    },
    visitorHighlights: attractions.map((feature, index) => ({
      rank: index + 1,
      featureId: feature.id,
      name: feature.name,
      reason: feature.shortDescription ?? feature.name,
      tagline: highlightMetadata[index][0],
      visitorScore: [94, 89, 87, 82, 80, 78, 76, 68][index],
      openingTimes: highlightMetadata[index][1],
      admission: highlightMetadata[index][2],
      freeAdmission: highlightMetadata[index][3],
      organisationPills: index === 4 ? ['English Heritage'] : [],
      sourceName: feature.sourceRecords[0].sourceName,
      sourceUrl: feature.sourceRecords[0].sourceUrl ?? '',
      verifiedInBoundaryAt: reviewedDate,
    })),
    townStudyArea: {
      localityName: 'Peterborough',
      localityCode: 'E63009810',
      sourceName: 'ONS Built-up Areas (December 2024)',
      sourceUrl: onsUrl,
      sourceVersion: 'December 2024 V2',
      bufferMetres: 0,
      localityBoundary: onsBoundary,
      bufferedBoundary: visitorBoundary,
      visitorBoundary,
      notes: 'The original ONS 2024 Peterborough built-up area is preserved unchanged. The active visitor boundary adds narrow, transparent corridors and clusters for Flag Fen and Ferry Meadows/Nene Valley places experienced as part of a Peterborough visit.',
    },
  },
  features,
  sources: [
    { id: 'historic-england-nhle', name: 'National Heritage List for England', organisation: 'Historic England', coverage: 'England', accessMethod: 'Locally bundled national GeoJSON download', reliability: 'official_statutory', sourceUrl: 'https://historicengland.org.uk/listing/the-list/data-downloads/', licence: 'Open Government Licence v3.0; contains Historic England data.' },
    { id: 'ons-bua-2024', name: 'Built-up Areas (December 2024)', organisation: 'Office for National Statistics', coverage: 'England and Wales', accessMethod: 'ArcGIS Feature Service', reliability: 'official_statutory', sourceUrl: onsUrl, licence: 'Open Government Licence v3.0' },
    { id: 'peterborough-visitor-audit', name: 'Peterborough visitor audit', organisation: 'Townscape Guides curation', coverage: 'Peterborough active visitor boundary', accessMethod: 'Manual research of official and operator sources', reliability: 'secondary', limitations: 'Opening times, prices and access policies can change; follow linked operator pages before a special journey.' },
  ],
  historicMaps: [],
  settlementPolygons: [],
  validation: [],
};

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { schemaVersion: number; description: string; projects: Record<string, Record<string, string[]>> };
planner.projects[projectId] = {
  eat: food.map((feature) => feature.id),
  trails: trails.map((feature) => feature.id),
  parking: parking.map((feature) => feature.id),
  toilets: toilets.map((feature) => feature.id),
  picnic: picnic.map((feature) => feature.id),
};

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { schemaVersion: number; reviewedAt: string; description: string; projects: Record<string, { attraction: Record<string, unknown>; eat: Record<string, unknown> }> };
const unconfirmed = (url: string) => ({ rating: 0, status: 'unconfirmed', label: 'Dog policy not confirmed', summary: 'No reliable current policy confirming pet-dog access was found. Check directly before making a dog-dependent journey; assistance-dog access is separate.', sourceName: 'Reviewed visitor information', sourceUrl: url, reviewedAt: reviewedDate });
dog.projects[projectId] = {
  attraction: {
    [attractions[0].id]: { rating: 0, status: 'not-allowed', label: 'Assistance dogs only indoors', summary: 'The Cathedral is a working place of worship. Plan on assistance-dog access only unless the Cathedral confirms otherwise; the precinct outside is open for a short walk.', sourceName: 'Peterborough Cathedral visitor information', sourceUrl: 'https://peterborough-cathedral.org.uk/opening-times/', reviewedAt: reviewedDate },
    [attractions[1].id]: { rating: 2, status: 'restricted', label: 'Dog friendly with restrictions', summary: 'Dogs are welcome on a short lead around much of the outdoor archaeology park, with restricted areas around livestock, reconstructed buildings and sensitive displays.', sourceName: 'Flag Fen plan your visit', sourceUrl: 'https://flagfen.org.uk/plan-your-visit', reviewedAt: reviewedDate },
    [attractions[2].id]: { rating: 3, status: 'welcoming', label: 'Excellent with a dog', summary: 'Ferry Meadows is made for a dog-inclusive day, with extensive paths, drinking bowls and a dog agility area. Leads are requested on the busiest central paths and around livestock.', sourceName: 'Nene Park dog guidance', sourceUrl: 'https://www.nenepark.org.uk/pages/faqs/default.aspx?startat=72', reviewedAt: reviewedDate },
    [attractions[3].id]: unconfirmed('https://peterboroughmuseum.org.uk/plan-your-visit'),
    [attractions[4].id]: { rating: 0, status: 'not-allowed', label: 'Assistance dogs only', summary: 'The fragile medieval interior and guided-tour format make this unsuitable for pet dogs. Contact English Heritage about assistance-dog arrangements before booking.', sourceName: 'English Heritage visitor information', sourceUrl: 'https://www.english-heritage.org.uk/visit/places/longthorpe-tower/', reviewedAt: reviewedDate },
    [attractions[5].id]: unconfirmed('https://www.railworld.org.uk/'),
    [attractions[6].id]: { rating: 0, status: 'not-allowed', label: 'Not suitable for pet dogs', summary: 'An outdoor swimming facility is not a pet-dog attraction. Ask the operator about assistance-dog arrangements in non-pool areas.', sourceName: 'Peterborough Lido visitor information', sourceUrl: 'https://discoverpeterborough.co.uk/things-to-do/peterborough-lido/', reviewedAt: reviewedDate },
    [attractions[7].id]: { rating: 3, status: 'welcoming', label: 'Excellent with a dog', summary: 'Central Park offers open lawns and paths for a relaxed dog walk. Keep dogs under control around the aviary, play areas, formal gardens and other visitors.', sourceName: 'Central Park visitor information', sourceUrl: 'https://discoverpeterborough.co.uk/things-to-do/central-park/', reviewedAt: reviewedDate },
  },
  eat: {
    [food[0].id]: { rating: 3, status: 'welcoming', label: 'Excellent with a dog', summary: 'The operator explicitly welcomes well-behaved dogs, making this one of the easiest central meal choices with a dog.', sourceName: 'Tap & Tandoor Peterborough', sourceUrl: 'https://tapandtandoor.co.uk/pages/peterborough', reviewedAt: reviewedDate },
    [food[1].id]: { rating: 3, status: 'welcoming', label: 'Excellent with a dog', summary: 'Black & Bloom explicitly welcomes well-behaved dogs inside, so dog owners are not limited to outdoor seating.', sourceName: 'Black & Bloom dog-friendly coffee shop information', sourceUrl: 'https://blackandbloom.co.uk/news/dog-friendly-coffee-shop-peterborough-black-and-bloom/', reviewedAt: reviewedDate },
    [food[2].id]: unconfirmed('https://discoverpeterborough.co.uk/things-to-do/eat-and-drink/kathmandu-lounge/'),
    [food[3].id]: unconfirmed('https://www.embe2go.com/about'),
    [food[4].id]: unconfirmed('https://discoverpeterborough.co.uk/things-to-do/eat-and-drink/bewiched-coffee-bridge-street/'),
    [food[5].id]: { rating: 2, status: 'welcoming', label: 'Dog friendly', summary: 'Lounges normally welcome dogs in designated areas. Ask the team for the most suitable table at busy times.', sourceName: 'Argo Lounge visitor information', sourceUrl: 'https://thelounges.co.uk/argo/', reviewedAt: reviewedDate },
  },
};
dog.reviewedAt = reviewedDate;

const publicIds = new Set([
  ...attractions.map((feature) => feature.id),
  ...food.map((feature) => feature.id),
  ...trails.map((feature) => feature.id),
  ...parking.map((feature) => feature.id),
  ...toilets.map((feature) => feature.id),
  ...picnic.map((feature) => feature.id),
]);
const outside = features.filter((feature) => publicIds.has(feature.id) && feature.geometry?.type === 'Point' && !booleanPointInPolygon(point(feature.geometry.coordinates), visitorBoundary));
if (outside.length) throw new Error(`Public markers outside visitor boundary: ${outside.map((feature) => feature.name).join(', ')}`);

const audit = {
  projectId,
  reviewedAt,
  boundary: { source: 'ONS Built-up Areas (December 2024)', localityCode: 'E63009810', visitorExtensions: ['Flag Fen Archaeology Park', 'Ferry Meadows and the city-side Nene Valley visitor corridor'] },
  counts: { historicEnglandRecords: features.filter((feature) => feature.tags.includes('nhle')).length, attractions: attractions.length, food: food.length, trails: trails.length, parking: parking.length, toilets: toilets.length, picnic: picnic.length },
  touristAppeal: pkg.project.touristAppeal,
  validation: { allPublicMarkersInsideActiveBoundary: true, customerOnlyParkingExcluded: true, practicalPlacesNamedByLocation: true, unknownHistoricDatesNotInvented: true },
  notes: ['ONS statistical boundary retained unchanged for provenance.', 'Flag Fen and Ferry Meadows are included only through transparent visitor extensions.', 'NHLE designation dates are not treated as construction dates.', 'Opening times and prices should be rechecked before a special journey.'],
};

await mkdir(resolve('data/projects'), { recursive: true });
await mkdir(resolve('data/review'), { recursive: true });
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify(audit, null, 2));
