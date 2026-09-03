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
import type {
  AttractionGuide,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
  TouristAppealRating,
} from '../src/domain/models';

const reviewedAt = '2026-08-08T00:00:00Z';
const reviewedDate = '2026-08-08';
const nhleRoot = resolve(
  'data/reference/england_wales_national_data_downloader/downloads/england/nhle',
);
const plannerPath = resolve('data/visitor-planner-curation.json');
const dogPath = resolve('data/dog-access-curation.json');
const treasureTrailsAuditPath = resolve(
  'data/review/treasure-trails-town-audit-2026-08-08.json',
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
  significance: {
    highest_national: 1,
    national: 0.85,
    regional: 0.65,
    local: 0.45,
    recognised: 0.3,
  },
  confidence: { high: 1, medium: 0.75, low: 0.5, unknown: 0.35 },
  survival: {
    substantially_intact: 1,
    altered_recognisable: 0.75,
    heavily_altered: 0.45,
    site_only_or_demolished: 0.2,
    unknown: 0.6,
  },
} as const;

interface PlaceDefinition {
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
  attractionGuide?: AttractionGuide;
}

interface HighlightDefinition {
  feature: HeritageFeature;
  score: number;
  tagline: string;
  openingTimes: string;
  admission: string;
  freeAdmission: boolean;
  organisationPills?: string[];
}

interface DogEntry {
  rating: number;
  status: string;
  label: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  reviewedAt: string;
}

interface TownContext {
  projectId: string;
  locality: string;
  region: string;
  localityCode: string;
  centre: [number, number];
  boundary: Feature<Polygon | MultiPolygon>;
  features: HeritageFeature[];
  byId: Map<string, HeritageFeature>;
}

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

function add(context: TownContext, feature: HeritageFeature) {
  const existing = context.byId.get(feature.id);
  if (existing) Object.assign(existing, feature);
  else {
    context.byId.set(feature.id, feature);
    context.features.push(feature);
  }
  return feature;
}

function place(context: TownContext, options: PlaceDefinition): HeritageFeature {
  if (!booleanPointInPolygon(point(options.coordinates), context.boundary)) {
    throw new Error(`${context.locality}: ${options.name} falls outside the active ONS boundary`);
  }
  return add(context, {
    id: options.id,
    projectId: context.projectId,
    name: options.name,
    alternativeNames: [],
    countryCode: 'GB-ENG',
    region: context.region,
    locality: context.locality,
    featureType: options.type,
    significance: options.significance ?? 'local',
    geometry: point(options.coordinates).geometry,
    locationType: 'representative_point',
    locationConfidence: 'high',
    documentedDateText: options.dateText,
    earliestPossibleYear: options.earliest,
    latestPossibleYear: options.latest,
    dateBasis: options.earliest
      ? options.latest
        ? 'documented_date_range'
        : 'documented_construction'
      : 'unknown',
    dateConfidence: options.earliest ? 'high' : 'unknown',
    survival: 'substantially_intact',
    shortDescription: options.description,
    attractionGuide: options.attractionGuide,
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
    tags: [...new Set([`${context.locality.toLowerCase()}-visitor-audit`, 'current-context', ...options.tags])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: 'Visitor information and representative location audited 2026-08-08.',
    evidenceScope: options.earliest ? 'parish_evidence' : 'related_context',
    licence: editorialLicence,
  });
}

function nhleSignificance(grade?: string): HeritageFeature['significance'] {
  if (grade === 'I') return 'highest_national';
  if (grade === 'II*') return 'national';
  return 'regional';
}

async function importNhleFolder(context: TownContext, folder: string, designationType: string, tag: string) {
  const directory = resolve(nhleRoot, folder);
  const files = (await readdir(directory)).filter((name) => name.endsWith('.geojson'));
  for (const filename of files) {
    const collection = JSON.parse(await readFile(resolve(directory, filename), 'utf8')) as FeatureCollection;
    for (const record of collection.features) {
      if (!record.geometry) continue;
      const representative = pointOnFeature(record as Feature<Geometry>);
      if (!booleanPointInPolygon(representative, context.boundary)) continue;
      const properties = (record.properties ?? {}) as Record<string, unknown>;
      const listEntry = String(
        properties.ListEntry ?? properties.LIST_ENTRY ?? `${basename(filename)}-${context.features.length}`,
      );
      const name = String(properties.Name ?? properties.NAME ?? 'Historic England designation');
      const grade = properties.Grade ? String(properties.Grade) : undefined;
      const id = `historic-england:nhle:${listEntry}`;
      if (context.byId.has(id)) continue;
      add(context, {
        id,
        projectId: context.projectId,
        name,
        alternativeNames: [],
        countryCode: 'GB-ENG',
        region: context.region,
        locality: context.locality,
        featureType: /church/i.test(name)
          ? 'church'
          : /bridge/i.test(name)
            ? 'bridge'
            : /lock-?up/i.test(name)
              ? 'civic_building'
              : /memorial/i.test(name)
                ? 'memorial'
                : 'other',
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
            'Official statutory designation. Date remains unknown pending official list-entry text enrichment.',
            'official_statutory',
            'Open Government Licence v3.0; contains Historic England data.',
          ),
        ],
        tags: ['historic-england', 'nhle', tag],
        createdAt: reviewedAt,
        updatedAt: reviewedAt,
        reviewed: true,
        reviewNotes: `Imported from the bundled Historic England download and filtered against the unchanged ONS ${context.locality} boundary.`,
        evidenceScope: 'parish_evidence',
        licence: 'Open Government Licence v3.0; contains Historic England data.',
      });
    }
  }
}

async function fetchBoundary(locality: string, localityCode: string) {
  const where = encodeURIComponent(`BUA24CD='${localityCode}'`);
  const url = `https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/main_ONS_BUA_2024_EW_V2/FeatureServer/0/query?f=geojson&where=${where}&outFields=*&returnGeometry=true&outSR=4326`;
  const response = await fetch(url, { headers: { 'User-Agent': 'TownscapeGuides/1.0' } });
  if (!response.ok) throw new Error(`${locality} ONS boundary request failed: ${response.status}`);
  const collection = (await response.json()) as FeatureCollection<Polygon | MultiPolygon>;
  const boundary = collection.features[0];
  if (!boundary) throw new Error(`${locality} ONS 2024 built-up area was not returned`);
  boundary.properties = {
    ...(boundary.properties ?? {}),
    sourceDataset: 'ONS Built-up Areas (December 2024)',
    localityName: locality,
    localityCode,
  };
  return { boundary, url };
}

function dogEntry(
  rating: number,
  status: string,
  label: string,
  summary: string,
  sourceName: string,
  sourceUrl: string,
): DogEntry {
  return { rating, status, label, summary, sourceName, sourceUrl, reviewedAt: reviewedDate };
}

function unconfirmedDog(url: string) {
  return dogEntry(
    0,
    'unconfirmed',
    'Dog policy not confirmed',
    'No reliable current policy confirming pet-dog access was found. Check directly before a dog-dependent journey; assistance-dog access is separate.',
    'Reviewed visitor information',
    url,
  );
}

async function baseContext(locality: string, projectId: string, region: string, localityCode: string, centre: [number, number]) {
  const { boundary, url } = await fetchBoundary(locality, localityCode);
  const context: TownContext = {
    projectId,
    locality,
    region,
    localityCode,
    centre,
    boundary,
    features: [],
    byId: new Map(),
  };
  await importNhleFolder(context, '00_listed_building_points', 'listed_building', 'listed-building');
  await importNhleFolder(context, '06_scheduled_monuments', 'scheduled_monument', 'scheduled-monument');
  await importNhleFolder(context, '07_parks_and_gardens', 'registered_park_and_garden', 'registered-park-and-garden');
  return { context, onsUrl: url };
}

function sources(locality: string, onsUrl: string): ProjectPackage['sources'] {
  return [
    {
      id: 'historic-england-nhle',
      name: 'National Heritage List for England',
      organisation: 'Historic England',
      coverage: 'England',
      accessMethod: 'Locally bundled national GeoJSON download',
      reliability: 'official_statutory',
      sourceUrl: 'https://historicengland.org.uk/listing/the-list/data-downloads/',
      licence: 'Open Government Licence v3.0; contains Historic England data.',
    },
    {
      id: 'ons-bua-2024',
      name: 'Built-up Areas (December 2024)',
      organisation: 'Office for National Statistics',
      coverage: 'England and Wales',
      accessMethod: 'ArcGIS Feature Service',
      reliability: 'official_statutory',
      sourceUrl: onsUrl,
      licence: 'Open Government Licence v3.0',
    },
    {
      id: `${locality.toLowerCase()}-visitor-audit`,
      name: `${locality} visitor audit`,
      organisation: 'Townscape Guides curation',
      coverage: `${locality} ONS built-up area`,
      accessMethod: 'Manual research of official, operator and current visitor sources',
      reliability: 'secondary',
      limitations: 'Opening times, prices, food service and pet policies can change; follow linked sources before a special journey.',
    },
  ];
}

async function createThrapston() {
  const { context, onsUrl } = await baseContext(
    'Thrapston',
    'thrapston-england',
    'Northamptonshire',
    'E63010130',
    [-0.52881, 52.39626],
  );
  const churchUrl = 'https://www.achurchnearyou.com/church/16629/';
  const historyUrl = 'https://discover-northamptonshire.co.uk/destination/thrapston/';
  const councilHistoryUrl = 'https://www.thrapstontowncouncil.gov.uk/history-of-thrapston';
  const parksUrl = 'https://www.thrapstontowncouncil.gov.uk/parks-and-gardens';
  const attractions: HighlightDefinition[] = [];
  const pushAttraction = (definition: PlaceDefinition, score: number, tagline: string, opening: string, admission: string, free: boolean) => {
    const feature = place(context, definition);
    attractions.push({ feature, score, tagline, openingTimes: opening, admission, freeAdmission: free });
    return feature;
  };

  const stJames = pushAttraction(
    {
      id: 'curated-attraction:thrapston-st-james',
      name: 'St James Church',
      type: 'church',
      coordinates: [-0.536029, 52.397238],
      description: 'Look up beneath Thrapston’s defining medieval spire, then explore a church with thirteenth-century fabric and unusually strong links to the Washington family.',
      currentNotes: 'tourism=attraction; visitor_place_type=Medieval parish church; visit_score=73; opening_hours:description=Church opening can vary around worship and events; check before relying on interior access; entrance_fee=Free, donations welcome; time_to_spend=30-45 minutes',
      url: churchUrl,
      sourceName: 'St James Church visitor information',
      organisation: 'Church of England',
      significance: 'national',
      earliest: 1200,
      latest: 1299,
      dateText: 'Church retains substantial thirteenth-century fabric',
      tags: ['service-context-visitor', 'service-context-heritage'],
      attractionGuide: {
        headline: 'A graceful spire with a transatlantic family story',
        intro: 'St James gives Thrapston its strongest skyline moment. Its medieval fabric rewards a close look, while Washington-family heraldry adds an unexpected connection for visitors.',
        motifs: ['Medieval church', 'Washington arms', 'Town skyline'],
        bestFor: ['Church architecture', 'Local history', 'A quiet town-centre pause'],
        toilets: 'No visitor toilet is advertised at the church; Sackville Street public toilets are a short walk away.',
        thingsToDo: [
          { name: 'Study the medieval nave and arcades' },
          { name: 'Look for Washington-family heraldry' },
          { name: 'Step back for the full spire view' },
          { name: 'Notice later memorials and stained glass' },
          { name: 'Continue into the High Street conservation area' },
        ],
      },
    },
    73,
    'Medieval spire',
    'Opening varies around worship and events; check before relying on interior access.',
    'Free; donations welcome.',
    true,
  );
  const townscape = pushAttraction(
    {
      id: 'curated-attraction:thrapston-historic-centre',
      name: 'Thrapston historic High Street and Bull Ring',
      type: 'street',
      coordinates: [-0.53747, 52.39692],
      description: 'Wander the conservation area from the Bull Ring through the High Street, reading a small market town shaped by its 1205 charter, coaching routes and independent frontages.',
      currentNotes: 'tourism=attraction; visitor_place_type=Historic market-town streetscape; visit_score=64; opening_hours:description=Outdoor public streets, best explored in daylight; entrance_fee=Free; time_to_spend=30-60 minutes',
      url: historyUrl,
      sourceName: 'Thrapston destination guide',
      organisation: 'Discover Northamptonshire',
      significance: 'regional',
      earliest: 1205,
      dateText: 'Market charter granted in 1205',
      tags: ['service-context-visitor', 'service-context-heritage'],
      attractionGuide: {
        headline: 'A compact charter-market centre made for a gentle wander',
        intro: 'The pleasure is in the sequence rather than one grand building: church views, old plots, shopfronts, inns and the historic route down towards the river.',
        motifs: ['Market charter', 'High Street', 'Independent shops'],
        bestFor: ['Street history', 'Coffee-and-cake stops', 'Slow exploration'],
        toilets: 'Sackville Street public toilets are open daily except the stated festive closures.',
        food: [
          { name: 'Bennett’s', visitorScore: 81, summary: 'Breakfast, lunch and homemade cakes.', priceBand: '££' },
          { name: 'Berry’s', visitorScore: 79, summary: 'Friendly café-bistro close to the Bull Ring.', priceBand: '£' },
          { name: 'Simply Tea-licious', visitorScore: 77, summary: 'Traditional homemade cakes and savoury bakes.', priceBand: '££' },
        ],
        thingsToDo: [
          { name: 'Start at the Bull Ring' },
          { name: 'Follow the conservation-area High Street' },
          { name: 'Look for old coaching and market buildings' },
          { name: 'Frame the church spire between rooftops' },
          { name: 'Finish with an independent café' },
        ],
      },
    },
    64,
    'Charter town',
    'Outdoor public streets; best explored in daylight.',
    'Free.',
    true,
  );
  const townWalk = pushAttraction(
    {
      id: 'curated-attraction:thrapston-town-walk',
      name: 'Town Walk and Nene Valley green corridor',
      type: 'park',
      coordinates: [-0.5323, 52.3936],
      description: 'Take the public green corridor from the town towards the river for an easy nature break, with woodland edges and the Nene Valley landscape close to the centre.',
      currentNotes: 'tourism=attraction; visitor_place_type=Public riverside green walk; visit_score=60; opening_hours:description=Public footpath, best in daylight and suitable ground conditions; entrance_fee=Free; time_to_spend=30-75 minutes',
      url: parksUrl,
      sourceName: 'Thrapston parks and open spaces',
      organisation: 'Thrapston Town Council',
      tags: ['service-context-visitor', 'service-context-walk'],
      attractionGuide: {
        headline: 'A green breather between town and river',
        intro: 'Town Walk broadens a compact heritage visit with a low-key ribbon of trees, waterside habitat and local paths rather than a formal visitor attraction.',
        motifs: ['Woodland edge', 'River corridor', 'Local path'],
        bestFor: ['Dog walking', 'Fresh air', 'Extending a town wander'],
        thingsToDo: [
          { name: 'Follow the public footpath' },
          { name: 'Listen for riverside birds' },
          { name: 'Return through the compact High Street' },
          { name: 'Notice the transition from town to meadow' },
          { name: 'Return through the historic centre' },
        ],
      },
    },
    60,
    'Green corridor',
    'Public footpath; best in daylight and suitable ground conditions.',
    'Free.',
    true,
  );
  const peacePark = pushAttraction(
    {
      id: 'curated-attraction:thrapston-peace-park',
      name: 'Peace Memorial Park',
      type: 'park',
      coordinates: [-0.534103, 52.395948],
      description: 'Pause in the central memorial park for gardens, seating and a well-equipped play area that makes the heritage circuit easier with children.',
      currentNotes: 'tourism=attraction; visitor_place_type=Memorial park and play area; visit_score=52; opening_hours:description=Public park, best used in daylight; entrance_fee=Free; time_to_spend=20-60 minutes',
      url: 'https://www.thrapstontowncouncil.gov.uk/playgrounds',
      sourceName: 'Thrapston playgrounds and parks',
      organisation: 'Thrapston Town Council',
      tags: ['service-context-visitor', 'service-context-park'],
      attractionGuide: {
        headline: 'A useful family pause in the heart of town',
        intro: 'Peace Park mixes remembrance gardens, seating and a substantial play area, making it a practical breather rather than a reason for a special journey.',
        motifs: ['Memorial gardens', 'Play area', 'Town-centre pause'],
        bestFor: ['Families', 'A short rest', 'Garden details'],
        picnic: 'Public seating and park space are available; no dedicated bookable picnic facility is advertised.',
        thingsToDo: [
          { name: 'Pause in the memorial gardens' },
          { name: 'Use the children’s play area' },
          { name: 'Look for the sensory and poppy gardens' },
          { name: 'Rest between the High Street and river' },
          { name: 'Continue towards St James Church' },
        ],
      },
    },
    52,
    'Family pause',
    'Public park; best used in daylight.',
    'Free.',
    true,
  );

  const food = [
    place(context, {
      id: 'curated-food:thrapston-bennetts', name: 'Bennett’s', type: 'cafe', coordinates: [-0.537634, 52.3969],
      description: 'A popular High Street café for breakfast, homemade lunches, cakes and daily specials, with a broad daytime menu and an established local following.',
      currentNotes: 'amenity=cafe; cuisine=breakfast lunch coffee cakes; visit_score=81; price_band=££; opening_hours:description=Monday-Friday 09:00-17:00, Saturday 09:00-16:00, Sunday 10:00-14:00; description=Top food stop: dependable all-round daytime cafe',
      url: 'https://www.tripadvisor.co.uk/Restaurant_Review-g504022-d16857204-Reviews-Bennett_s-Kettering_Northamptonshire_England.html', sourceName: 'Bennett’s current visitor listing', organisation: 'Bennett’s', tags: ['service-context-food'],
    }),
    place(context, {
      id: 'curated-food:thrapston-berrys', name: 'Berry’s', type: 'cafe', coordinates: [-0.53645, 52.39718],
      description: 'A friendly café-bistro near the Bull Ring with fresh breakfasts, lunches, cakes and a notably welcoming local atmosphere.',
      currentNotes: 'amenity=cafe; cuisine=breakfast lunch coffee cakes; visit_score=79; price_band=£; opening_hours:description=Monday-Friday 09:00-17:00, Saturday 09:00-16:00, Sunday closed; description=Great choice: friendly independent cafe-bistro; dog_friendly=yes',
      url: 'https://www.tripadvisor.co.uk/Restaurant_Review-g504029-d25303178-Reviews-Berry_s-Thrapston_Northamptonshire_England.html', sourceName: 'Berry’s current visitor listing', organisation: 'Berry’s', tags: ['service-context-food'],
    }),
    place(context, {
      id: 'curated-food:thrapston-tea-licious', name: 'Simply Tea-licious', type: 'cafe', coordinates: [-0.541279, 52.396421],
      description: 'A traditional Bridge Street tearoom built around handmade scones, cakes, savoury bakes, sandwiches and bookable afternoon tea.',
      currentNotes: 'amenity=cafe; cuisine=tea cakes light lunch; visit_score=77; price_band=££; opening_hours:description=Monday-Friday 09:00-15:30, Saturday 09:00-14:00, Sunday closed; description=Great choice: traditional homemade tearoom',
      url: 'https://tea-licioustearoom.co.uk/', sourceName: 'Simply Tea-licious visitor information', organisation: 'Simply Tea-licious', tags: ['service-context-food'],
    }),
    place(context, {
      id: 'osm-community:node-14046167501', name: 'Haven Play Café', type: 'cafe', coordinates: [-0.536056, 52.396734],
      description: 'A practical family café combining daytime drinks and food with indoor play, useful when younger children need more than a conventional coffee stop.',
      currentNotes: 'amenity=cafe; cuisine=coffee light lunch; visit_score=66; price_band=££; opening_hours:description=OpenStreetMap records daily 08:00-17:00; confirm current sessions before travel; description=Good local stop: family play cafe',
      url: 'https://www.openstreetmap.org/node/14046167501', sourceName: 'OpenStreetMap current place record', organisation: 'OpenStreetMap contributors', reliability: 'discovery_only', tags: ['service-context-food'],
    }),
  ];

  const trails = [
    place(context, { id: 'curated-trail:thrapston-town-and-river', name: 'Thrapston town and Town Walk circuit', type: 'street', coordinates: [-0.53747, 52.39692], description: 'Link the High Street, Bull Ring, St James and the in-town section of Town Walk for a compact self-guided introduction to Thrapston.', currentNotes: 'route=walking; trail_type=town and local walking circuit; visit_score=76; distance=Approximately 2-3 km depending on links; duration=45-75 minutes; entrance_fee=Free; no_direct_treasure_trail_match=true', url: councilHistoryUrl, sourceName: 'Thrapston history and public-path audit', organisation: 'Thrapston Town Council and Townscape Guides', tags: ['service-context-walk', 'visitor-context-trail'] }),
  ];
  const parking = [
    place(context, { id: 'curated-parking:thrapston-chancery-lane', name: 'Chancery Lane Car Park', type: 'parking', coordinates: [-0.534455, 52.397185], currentNotes: 'amenity=parking; parking=surface; access=public; capacity=38; payment_required=no; price_display=Free; maxstay=Monday-Saturday 12 hours, Sunday 24 hours; opening_hours:description=Open 24 hours daily; operator=North Northamptonshire Council', url: 'https://www.northnorthants.gov.uk/car-parks-north-northamptonshire/council-car-parks-thrapston', sourceName: 'Council car parks in Thrapston', organisation: 'North Northamptonshire Council', reliability: 'local_authority', tags: ['service-context-parking'] }),
    place(context, { id: 'curated-parking:thrapston-sackville-street', name: 'Sackville Street Car Park', type: 'parking', coordinates: [-0.537624, 52.39912], currentNotes: 'amenity=parking; parking=surface; access=public; capacity=44; payment_required=no; price_display=Free; maxstay=24 hours; opening_hours:description=Open 24 hours daily; operator=North Northamptonshire Council', url: 'https://www.northnorthants.gov.uk/car-parks-north-northamptonshire/council-car-parks-thrapston', sourceName: 'Council car parks in Thrapston', organisation: 'North Northamptonshire Council', reliability: 'local_authority', tags: ['service-context-parking'] }),
  ];
  const toilets = [
    place(context, { id: 'osm-community:way-697545120', name: 'Sackville Street public toilets', type: 'toilets', coordinates: [-0.53696, 52.39742], currentNotes: 'amenity=toilets; access=public; fee=no; wheelchair=RADAR key; opening_hours:description=Daily 08:00-18:00 all year, closed Christmas Day, Boxing Day and New Year’s Day; description=Refurbished male, female and accessible public toilets on Sackville Street', url: 'https://www.thrapstontowncouncil.gov.uk/public-toilets', sourceName: 'Thrapston public toilets', organisation: 'Thrapston Town Council', reliability: 'local_authority', tags: ['service-context-toilets'] }),
  ];
  const picnic = [
    place(context, { id: 'curated-picnic:thrapston-peace-park', name: 'Peace Memorial Park seating and picnic stop', type: 'park', coordinates: [-0.534103, 52.395948], currentNotes: 'tourism=picnic_site; access=public; fee=no; description=Central park seating and open space beside the memorial gardens and play area; use existing seating and take litter home', url: parksUrl, sourceName: 'Thrapston parks and open spaces', organisation: 'Thrapston Town Council', reliability: 'local_authority', tags: ['service-context-picnic'] }),
  ];

  const rating: TouristAppealRating = 1;
  const pkg: ProjectPackage = {
    project: {
      id: context.projectId, name: 'Thrapston', countryCode: 'GB-ENG', country: 'England', region: context.region, locality: context.locality,
      centre: context.centre, boundary: context.boundary, boundarySource: 'ONS Built-up Areas (December 2024). The official Thrapston polygon is used unchanged as the visitor boundary.', boundaryConfidence: 'high', sourceLanguage: 'en', preferredBasemap: 'openstreetmap', createdAt: reviewedAt, timelineStart: 1200, timelineEnd: 2026, methodology: scoring,
      researchNotes: 'Full visitor audit completed 2026-08-08. Bundled Historic England data and every public planner point were filtered against the unchanged ONS boundary. Dinner-only venues, customer parking and nearby villages were excluded. No exact Thrapston match was found in the reviewed Treasure Trails catalogue.',
      touristAppeal: { rating, label: 'Local detour', summary: 'Thrapston earns one star for a pleasant but modest combination of medieval church, charter-market streets, River Nene scenery, local walking and good independent daytime cafés. It is rewarding when nearby rather than a destination-scale journey.' },
      visualIdentity: { theme: 'nene-market-town', badgeImage: '/town-guides/thrapston-river-market-watercolour-guide.png', badgeAlt: 'Light ink-and-watercolour illustration of Thrapston, St James spire and the River Nene', heroImage: '/town-guides/thrapston-river-market-watercolour-guide.png', heroAlt: 'Light ink-and-watercolour illustration of Thrapston, St James spire and the River Nene', heroObjectPosition: '52% 48%', primaryColour: '#173F42', accentColour: '#C98A2D', backgroundColour: '#F2F6EE', motifs: ['Church spire', 'Town Walk', 'Market charter', 'Nene Valley'] },
      townGuide: { headline: 'A graceful church spire, charter-market streets and an easy green wander', intro: 'Thrapston works best as a relaxed half-day pause. Start beneath St James’s spire, trace the compact High Street and Bull Ring, then follow Town Walk before choosing an independent café. Nine Arches is associated with Thrapston but lies outside the strict town polygon and is not counted here.', bestFor: ['Church architecture', 'Small-town history', 'Independent cafés', 'Gentle local walking'], perfectFor: ['A two-to-four-hour local detour', 'Visitors passing through the Nene Valley', 'A church, town and café circuit'], suggestedFirstVisit: { title: 'St James, the Bull Ring and Town Walk', summary: 'Begin at St James, wander through the conservation-area centre, stop for coffee or lunch, then finish with the in-boundary section of Town Walk.' }, dontMiss: [stJames.name, townscape.name, townWalk.name], suggestedTime: 'Two to four hours', visitorMood: 'Best for an unhurried local detour rather than a special journey.', sourceUrls: [historyUrl, councilHistoryUrl, parksUrl, 'https://www.northnorthants.gov.uk/car-parks-north-northamptonshire/council-car-parks-thrapston'], lastReviewedAt: reviewedDate },
      visitorHighlights: attractions.map((item, index) => ({ rank: index + 1, featureId: item.feature.id, name: item.feature.name, reason: item.feature.shortDescription ?? item.feature.name, tagline: item.tagline, visitorScore: item.score, openingTimes: item.openingTimes, admission: item.admission, freeAdmission: item.freeAdmission, organisationPills: item.organisationPills ?? [], attractionGuide: item.feature.attractionGuide, sourceName: item.feature.sourceRecords[0].sourceName, sourceUrl: item.feature.sourceRecords[0].sourceUrl ?? '', verifiedInBoundaryAt: reviewedDate })),
      townStudyArea: { localityName: context.locality, localityCode: context.localityCode, sourceName: 'ONS Built-up Areas (December 2024)', sourceUrl: onsUrl, sourceVersion: 'December 2024 V2', bufferMetres: 0, localityBoundary: context.boundary, bufferedBoundary: context.boundary, visitorBoundary: context.boundary, notes: 'The official ONS 2024 Thrapston built-up area is preserved unchanged and is the active visitor boundary.' },
    },
    features: context.features, sources: sources(context.locality, onsUrl), historicMaps: [], settlementPolygons: [], validation: [],
  };
  const dogAttractions: Record<string, DogEntry> = {
    [stJames.id]: unconfirmedDog(churchUrl),
    [townscape.id]: dogEntry(2, 'welcoming', 'Good with a dog', 'Dogs can join the public-street circuit, though traffic and narrow pavements make a close lead sensible.', 'Thrapston conservation-area information', 'https://www.thrapstontowncouncil.gov.uk/conservation-areas'),
    [townWalk.id]: dogEntry(3, 'welcoming', 'Excellent with a dog', 'Town Council records identify Town Walk and the river area as established public paths used by dog walkers.', 'Thrapston Town Council path information', parksUrl),
    [peacePark.id]: dogEntry(1, 'restricted', 'Limited dog access', 'The open park can support a brief dog pause, but signed play and garden areas may restrict dogs. Keep to permitted paths and respect local signs.', 'Thrapston Town Council parks information', parksUrl),
  };
  const dogFood: Record<string, DogEntry> = {
    [food[0].id]: unconfirmedDog(food[0].sourceRecords[0].sourceUrl ?? ''),
    [food[1].id]: dogEntry(3, 'welcoming', 'Excellent with a dog', 'Recent visitor evidence confirms a welcoming dog bowl and dog-friendly atmosphere.', 'Berry’s current visitor reports', food[1].sourceRecords[0].sourceUrl ?? ''),
    [food[2].id]: unconfirmedDog(food[2].sourceRecords[0].sourceUrl ?? ''),
    [food[3].id]: unconfirmedDog(food[3].sourceRecords[0].sourceUrl ?? ''),
  };
  return { pkg, lists: { eat: food, trails, parking, toilets, picnic }, dogAttractions, dogFood, exclusions: ['Dinner-only restaurants and takeaways', 'Customer and private car parks', 'Places beyond the ONS Thrapston boundary', 'No exact Treasure Trails town match'] };
}

async function createSawtry() {
  const { context, onsUrl } = await baseContext('Sawtry', 'sawtry-england', 'Cambridgeshire', 'E63010066', [-0.28205, 52.4363]);
  const onsBoundary = context.boundary;
  const communityCorridor = buffer(
    lineString([
      [-0.2805, 52.4338],
      [-0.281, 52.4321],
      [-0.28267, 52.43132],
    ]),
    0.16,
    { units: 'kilometers' },
  );
  const stJudithsCluster = buffer(point([-0.28267, 52.43132]), 0.28, {
    units: 'kilometers',
  });
  if (!communityCorridor || !stJudithsCluster) {
    throw new Error('Could not construct Sawtry community visitor extension');
  }
  const visitorBoundary = union(
    featureCollection([onsBoundary, communityCorridor, stJudithsCluster]),
  );
  if (!visitorBoundary) throw new Error('Could not construct Sawtry visitor boundary');
  visitorBoundary.properties = {
    sourceDataset: 'Curated Sawtry visitor boundary',
    originalSourceDataset: 'ONS Built-up Areas (December 2024)',
    originalLocalityCode: context.localityCode,
    visitorExtensionReviewedAt: reviewedDate,
    visitorExtensionReason:
      'A narrow extension joins the built-up area to the directly adjoining St Judith’s Field, CARESCO community facilities, public car park and picnic tables. It does not include the medieval moat, woods or abbey remains.',
  };
  context.boundary = visitorBoundary;
  const historyUrl = 'https://www.sawtryhistory.co.uk/sawtry';
  const communityUrl = 'https://www.huntingdonshire.gov.uk/people-communities/community-spaces/community-spaces-locations/';
  const landscapeUrl = 'https://huntingdonshire.gov.uk/media/6104/15-chapter-12-sawtry.pdf';
  const attractions: HighlightDefinition[] = [];
  const pushAttraction = (definition: PlaceDefinition, score: number, tagline: string, opening: string, admission: string, free: boolean) => {
    const feature = place(context, definition);
    attractions.push({ feature, score, tagline, openingTimes: opening, admission, freeAdmission: free });
    return feature;
  };
  const allSaints = pushAttraction({ id: 'curated-attraction:sawtry-all-saints', name: 'All Saints Church and war memorial', type: 'church', coordinates: [-0.277478, 52.440896], description: 'Visit Sawtry’s Victorian parish church, rebuilt in 1880 with stone from the village’s older churches, and use its churchyard setting to connect the three historic parishes.', currentNotes: 'tourism=attraction; visitor_place_type=Victorian parish church; visit_score=52; opening_hours:description=Interior opening varies around worship and events; exterior and war memorial can be viewed from public approaches; entrance_fee=Free; time_to_spend=20-40 minutes', url: historyUrl, sourceName: 'Sawtry village history', organisation: 'Sawtry History Society', significance: 'regional', earliest: 1880, dateText: 'Church rebuilt in 1880 using stone from older parish churches', tags: ['service-context-visitor', 'service-context-heritage'], attractionGuide: { headline: 'One church carrying the memory of three old Sawtry parishes', intro: 'All Saints is modest but historically revealing: its Victorian rebuilding reused stone from the village’s lost churches and preserves the memory of an older three-parish settlement.', motifs: ['Victorian church', 'Three parishes', 'War memorial'], bestFor: ['Local history', 'Church exteriors', 'A quiet village pause'], toilets: 'No general visitor toilet is advertised at the church.', thingsToDo: [{ name: 'Study the church’s reused stonework' }, { name: 'Pause at the war memorial' }, { name: 'Read the setting against Sawtry’s three-parish story' }, { name: 'Look for Victorian details and memorials' }, { name: 'Continue to the Green and lock-up' }] } }, 52, 'Village church', 'Interior opening varies; exterior and memorial are visible from public approaches.', 'Free.', true);
  const green = pushAttraction({ id: 'curated-attraction:sawtry-green-lockup', name: 'The Green and historic village lock-up', type: 'square', coordinates: [-0.28045, 52.43382], description: 'Pause on the village green beside Sawtry’s small Grade II lock-up, a two-cell reminder of local policing and weekend misbehaviour in the old village.', currentNotes: 'tourism=attraction; visitor_place_type=Village green and historic lock-up exterior; visit_score=45; opening_hours:description=Outdoor public green and exterior view, best in daylight; lock-up interior is not advertised as regularly open; entrance_fee=Free; time_to_spend=15-25 minutes', url: historyUrl, sourceName: 'Sawtry village history', organisation: 'Sawtry History Society', significance: 'regional', tags: ['service-context-visitor', 'service-context-heritage'], attractionGuide: { headline: 'A tiny lock-up with a memorable village story', intro: 'Sawtry’s Green is a simple orientation point, but the surviving two-cell lock-up gives it a distinctive historical detail and an easy story to remember.', motifs: ['Village green', 'Two-cell lock-up', 'Local stories'], bestFor: ['A quick heritage stop', 'Village history', 'An outdoor pause'], thingsToDo: [{ name: 'Find the historic lock-up' }, { name: 'Inspect its small two-cell form from outside' }, { name: 'Read the Green as Sawtry’s civic centre' }, { name: 'Look for surrounding older buildings' }, { name: 'Continue along Green End Road' }] } }, 45, 'Village lock-up', 'Outdoor public green; lock-up interior is not regularly advertised as open.', 'Free.', true);
  const field = pushAttraction({ id: 'curated-attraction:sawtry-st-judiths-field', name: 'St Judith’s Field', type: 'park', coordinates: [-0.282666, 52.431322], description: 'Use Sawtry’s main recreation ground for a family pause, play equipment, picnic tables and open space at the village edge.', currentNotes: 'tourism=attraction; visitor_place_type=Public recreation ground; visit_score=38; opening_hours:description=Public outdoor recreation ground, best in daylight; entrance_fee=Free; time_to_spend=20-60 minutes', url: landscapeUrl, sourceName: 'Sawtry landscape and townscape assessment', organisation: 'Huntingdonshire District Council', reliability: 'local_authority', tags: ['service-context-visitor', 'service-context-park'], attractionGuide: { headline: 'Sawtry’s useful family and picnic pause', intro: 'St Judith’s Field is practical rather than destination-scale, offering play, picnic tables and open space for visitors already passing through the village.', motifs: ['Recreation ground', 'Play area', 'Picnic tables'], bestFor: ['Families', 'A picnic stop', 'Dog exercise'], picnic: 'Public picnic tables are provided at St Judith’s Field.', thingsToDo: [{ name: 'Use the play area' }, { name: 'Pause at the picnic tables' }, { name: 'Walk the edge of the recreation ground' }, { name: 'Use the dog-training area considerately' }, { name: 'Combine with the Green and village centre' }] } }, 38, 'Family pause', 'Public outdoor recreation ground; best in daylight.', 'Free.', true);

  const food = [
    place(context, { id: 'curated-food:sawtry-greystones-lunch', name: 'The Greystones', type: 'restaurant', coordinates: [-0.284075, 52.438869], description: 'Sawtry’s most dependable conventional lunch option on Thursday to Sunday, serving home-cooked pub classics, lighter plates and Sunday roast.', currentNotes: 'amenity=restaurant; cuisine=British pub lunch; visit_score=64; price_band=££; opening_hours:description=Lunch Thursday 12:00-14:00, Friday-Saturday 12:00-15:00, Sunday 12:00-15:00; Monday-Wednesday evening only; description=Good local stop: home-cooked village pub lunch', url: 'https://www.thegreystonessawtry.co.uk/our-menu', sourceName: 'The Greystones menus and kitchen hours', organisation: 'The Greystones', tags: ['service-context-food'] }),
    place(context, { id: 'curated-food:sawtry-caresco-coffee-room', name: 'CARESCO Community Coffee Room', type: 'cafe', coordinates: [-0.2809, 52.43195], description: 'A low-cost Friday community coffee room for hot drinks, bacon rolls and cake, useful as a friendly local stop when its short weekly session is running.', currentNotes: 'amenity=cafe; cuisine=coffee bacon rolls cake; visit_score=60; price_band=£; opening_hours:description=Friday 09:30-11:30; community session only; description=Good local stop: very limited weekly community coffee room', url: communityUrl, sourceName: 'Sawtry community spaces and activities', organisation: 'Huntingdonshire District Council and CARESCO', reliability: 'local_authority', tags: ['service-context-food'] }),
  ];
  const trails = [
    place(context, { id: 'curated-trail:sawtry-village-history', name: 'Sawtry village history walk', type: 'street', coordinates: [-0.28045, 52.43382], description: 'Use the local history guide to link the Green, village lock-up, All Saints and St Judith’s Field in a compact self-guided village circuit.', currentNotes: 'route=walking; trail_type=self-guided village heritage walk; visit_score=68; distance=Approximately 2.5-3.5 km depending on links; duration=45-75 minutes; entrance_fee=Free; no_direct_treasure_trail_match=true', url: historyUrl, sourceName: 'Sawtry village history', organisation: 'Sawtry History Society', tags: ['service-context-walk', 'visitor-context-trail'] }),
  ];
  const parking = [
    place(context, { id: 'osm-community:way-93660267', name: 'St Judith’s Field public car park', type: 'parking', coordinates: [-0.280284, 52.431452], currentNotes: 'amenity=parking; parking=surface; access=public; payment_required=no; price_display=Free; opening_hours:description=Available with the public recreation ground; check signs and event restrictions; description=Public parking associated with St Judith’s Field', url: landscapeUrl, sourceName: 'Sawtry landscape assessment and OpenStreetMap audit', organisation: 'Huntingdonshire District Council', reliability: 'local_authority', tags: ['service-context-parking'] }),
  ];
  const toilets = [
    place(context, { id: 'curated-toilets:sawtry-caresco', name: 'CARESCO Centre accessible toilet', type: 'toilets', coordinates: [-0.2809, 52.43195], currentNotes: 'amenity=toilets; access=customers; wheelchair=yes; fee=no; opening_hours:description=Available to people attending CARESCO activities during published opening sessions; not a general 24-hour public toilet; description=Accessible toilet inside the CARESCO Centre on Green End Road', url: communityUrl, sourceName: 'Sawtry community spaces facilities', organisation: 'Huntingdonshire District Council and CARESCO', reliability: 'local_authority', tags: ['service-context-toilets'] }),
  ];
  const picnic = [
    place(context, { id: 'curated-picnic:sawtry-st-judiths-field', name: 'St Judith’s Field picnic tables', type: 'park', coordinates: [-0.282666, 52.431322], currentNotes: 'tourism=picnic_site; access=public; fee=no; description=Public picnic tables at St Judith’s Field beside the play and recreation areas', url: landscapeUrl, sourceName: 'Sawtry landscape and townscape assessment', organisation: 'Huntingdonshire District Council', reliability: 'local_authority', tags: ['service-context-picnic'] }),
  ];

  const pkg: ProjectPackage = {
    project: {
      id: context.projectId, name: 'Sawtry', countryCode: 'GB-ENG', country: 'England', region: context.region, locality: context.locality,
      centre: context.centre, boundary: context.boundary, boundarySource: 'Curated Sawtry visitor boundary: the original ONS 2024 built-up area plus a narrow extension to the directly adjoining St Judith’s Field and CARESCO community cluster.', boundaryConfidence: 'high', sourceLanguage: 'en', preferredBasemap: 'openstreetmap', createdAt: reviewedAt, timelineStart: 1066, timelineEnd: 2026, methodology: scoring,
      researchNotes: 'Full visitor audit completed 2026-08-08. Bundled Historic England data was filtered against the unchanged ONS locality. Public planner points use a transparent narrow visitor extension for St Judith’s Field and CARESCO. Sawtry Abbey, the medieval moat, Aversley Wood, Archers Wood, Old St Andrew’s churchyard, private/customer parking and dinner-only venues were excluded. No exact Sawtry match was found in the reviewed Treasure Trails catalogue.',
      touristAppeal: { rating: 0, label: 'Not a tourist town', summary: 'Sawtry has genuine local interest in All Saints, the Green and lock-up, but the visitor offer is small, lightly interpreted and has limited daytime food and facilities. The medieval moat, nearby woods and abbey remains lie beyond the town boundary and do not raise its rating.' },
      visualIdentity: { theme: 'fenland-village-history', badgeImage: '/town-guides/sawtry-all-saints-watercolour-guide.png', badgeAlt: 'Light ink-and-watercolour illustration of All Saints Church and the village green in Sawtry', heroImage: '/town-guides/sawtry-all-saints-watercolour-guide.png', heroAlt: 'Light ink-and-watercolour illustration of All Saints Church and the village green in Sawtry', heroObjectPosition: '55% 48%', primaryColour: '#24464A', accentColour: '#A87B32', backgroundColour: '#F1F5EE', motifs: ['Three parishes', 'All Saints', 'Village lock-up', 'Fenland edge'] },
      townGuide: { headline: 'A quiet village green, a tiny lock-up and the story of three old parishes', intro: 'Sawtry is a local-history pause rather than a tourist destination. Link the Green and its two-cell lock-up with All Saints, then use St Judith’s Field for a picnic or family break. The medieval moat is outside the strict town polygon and is not counted in this guide.', bestFor: ['Local history', 'A short village walk', 'Church and civic details', 'A family picnic pause'], perfectFor: ['An hour or two while passing nearby', 'Visitors interested in overlooked village history', 'A compact outdoor heritage circuit'], suggestedFirstVisit: { title: 'The Green, the lock-up and All Saints', summary: 'Begin at the Green and lock-up, walk north to All Saints, then return to St Judith’s Field if you need play space or picnic tables.' }, dontMiss: [allSaints.name, green.name, field.name], suggestedTime: 'One to two hours', visitorMood: 'Best approached as a quiet local-history stop, with modest facilities and no major visitor attraction.', sourceUrls: [historyUrl, landscapeUrl, communityUrl], lastReviewedAt: reviewedDate },
      visitorHighlights: attractions.map((item, index) => ({ rank: index + 1, featureId: item.feature.id, name: item.feature.name, reason: item.feature.shortDescription ?? item.feature.name, tagline: item.tagline, visitorScore: item.score, openingTimes: item.openingTimes, admission: item.admission, freeAdmission: item.freeAdmission, organisationPills: [], attractionGuide: item.feature.attractionGuide, sourceName: item.feature.sourceRecords[0].sourceName, sourceUrl: item.feature.sourceRecords[0].sourceUrl ?? '', verifiedInBoundaryAt: reviewedDate })),
      townStudyArea: { localityName: context.locality, localityCode: context.localityCode, sourceName: 'ONS Built-up Areas (December 2024)', sourceUrl: onsUrl, sourceVersion: 'December 2024 V2', bufferMetres: 0, localityBoundary: onsBoundary, bufferedBoundary: onsBoundary, visitorBoundary, notes: 'The official ONS 2024 Sawtry built-up area is preserved unchanged for provenance. A narrow curated visitor extension includes the directly adjoining St Judith’s Field recreation ground, picnic tables, public parking and CARESCO facilities; it does not reach the medieval moat, woods, abbey remains or Old St Andrew’s churchyard.' },
    },
    features: context.features, sources: sources(context.locality, onsUrl), historicMaps: [], settlementPolygons: [], validation: [],
  };
  const dogAttractions: Record<string, DogEntry> = {
    [allSaints.id]: unconfirmedDog(historyUrl),
    [green.id]: dogEntry(2, 'welcoming', 'Good with a dog', 'The outdoor village green can be included in a dog walk. Keep a close lead around roads and homes.', 'Sawtry village history and public-space audit', historyUrl),
    [field.id]: dogEntry(3, 'welcoming', 'Excellent with a dog', 'The council assessment records a dog-training area at St Judith’s Field alongside its recreation facilities.', 'Sawtry landscape and townscape assessment', landscapeUrl),
  };
  const dogFood: Record<string, DogEntry> = {
    [food[0].id]: unconfirmedDog(food[0].sourceRecords[0].sourceUrl ?? ''),
    [food[1].id]: unconfirmedDog(food[1].sourceRecords[0].sourceUrl ?? ''),
  };
  return { pkg, lists: { eat: food, trails, parking, toilets, picnic }, dogAttractions, dogFood, exclusions: ['Sawtry Abbey, Aversley Wood, Archers Wood and Old St Andrew’s churchyard outside the ONS boundary', 'Dinner-only and takeaway venues', 'School, customer and private parking', 'No exact Treasure Trails town match'] };
}

async function writeTown(
  result: Awaited<ReturnType<typeof createThrapston>>,
  planner: { schemaVersion: number; description: string; projects: Record<string, Record<string, string[]>> },
  dog: { schemaVersion: number; reviewedAt: string; description: string; projects: Record<string, { attraction: Record<string, unknown>; eat: Record<string, unknown> }> },
) {
  const id = result.pkg.project.id;
  const slug = id.replace(/-england$/, '');
  const publicPoints = result.pkg.features.filter((feature) => feature.tags.some((tag) => tag.startsWith('service-context-')));
  const outside = publicPoints.filter((feature) => feature.geometry?.type !== 'Point' || !booleanPointInPolygon(feature.geometry, result.pkg.project.boundary));
  if (outside.length) throw new Error(`${id}: ${outside.map((item) => item.name).join(', ')} outside boundary`);
  planner.projects[id] = Object.fromEntries(
    Object.entries(result.lists).map(([category, features]) => [category, features.map((feature) => feature.id)]),
  );
  dog.projects[id] = { attraction: result.dogAttractions, eat: result.dogFood };
  await writeFile(resolve(`data/projects/${slug}.json`), `${JSON.stringify(result.pkg, null, 2)}\n`, 'utf8');
  await writeFile(
    resolve(`data/review/${slug}-visitor-audit-2026-08-08.json`),
    `${JSON.stringify({ projectId: id, reviewedAt, boundary: { source: result.pkg.project.boundarySource, localityCode: result.pkg.project.townStudyArea?.localityCode, unchanged: result.pkg.project.boundary === result.pkg.project.townStudyArea?.localityBoundary }, touristAppeal: result.pkg.project.touristAppeal, counts: { nhle: result.pkg.features.filter((feature) => feature.tags.includes('nhle')).length, highlights: result.pkg.project.visitorHighlights?.length ?? 0, ...Object.fromEntries(Object.entries(result.lists).map(([key, features]) => [key, features.length])) }, exclusions: result.exclusions, checks: { allPlannerPointsInsideBoundary: true, treasureTrailsExactTownMatch: false, customerParkingExcluded: true, dinnerOnlyFoodExcluded: true } }, null, 2)}\n`,
    'utf8',
  );
}

await mkdir(resolve('data/review'), { recursive: true });
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { schemaVersion: number; description: string; projects: Record<string, Record<string, string[]>> };
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { schemaVersion: number; reviewedAt: string; description: string; projects: Record<string, { attraction: Record<string, unknown>; eat: Record<string, unknown> }> };
const treasureTrailsAudit = JSON.parse(await readFile(treasureTrailsAuditPath, 'utf8')) as {
  towns: Array<{ projectId: string; locality: string; status: string }>;
};
const thrapston = await createThrapston();
const sawtry = await createSawtry();
await writeTown(thrapston, planner, dog);
await writeTown(sawtry, planner, dog);
dog.reviewedAt = reviewedDate;
treasureTrailsAudit.towns = treasureTrailsAudit.towns
  .filter((town) => !['thrapston-england', 'sawtry-england'].includes(town.projectId))
  .concat([
    { projectId: 'sawtry-england', locality: 'Sawtry', status: 'no_direct_town_match' },
    { projectId: 'thrapston-england', locality: 'Thrapston', status: 'no_direct_town_match' },
  ])
  .sort((left, right) => left.projectId.localeCompare(right.projectId));
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
await writeFile(
  treasureTrailsAuditPath,
  `${JSON.stringify(treasureTrailsAudit, null, 2)}\n`,
  'utf8',
);
console.log(`Created ${thrapston.pkg.project.id}: ${thrapston.pkg.features.length} features`);
console.log(`Created ${sawtry.pkg.project.id}: ${sawtry.pkg.features.length} features`);
