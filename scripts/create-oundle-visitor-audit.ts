import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { booleanPointInPolygon, point, pointOnFeature } from '@turf/turf';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

const reviewedAt = '2026-08-08T00:00:00Z';
const reviewedDate = '2026-08-08';
const projectId = 'oundle-england';
const onsUrl =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/main_ONS_BUA_2024_EW_V2/FeatureServer/0/query?f=geojson&where=BUA24NM%3D%27Oundle%27&outFields=*&returnGeometry=true&outSR=4326";
const projectPath = resolve('data/projects/oundle.json');
const auditPath = resolve('data/review/oundle-visitor-audit-2026-08-08.json');
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
    region: 'Northamptonshire',
    locality: 'Oundle',
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
    tags: [...new Set(['oundle-visitor-audit', 'current-context', ...options.tags])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: 'Visitor information and representative location audited 2026-08-08.',
    evidenceScope: options.earliest ? 'parish_evidence' : 'related_context',
    licence: editorialLicence,
  };
}

const response = await fetch(onsUrl, {
  headers: { 'User-Agent': 'TownscapeGuides/1.0' },
});
if (!response.ok) throw new Error(`ONS boundary request failed: ${response.status}`);
const onsCollection = (await response.json()) as FeatureCollection<Polygon | MultiPolygon>;
const onsBoundary = onsCollection.features[0];
if (!onsBoundary) throw new Error('Oundle ONS 2024 built-up area was not returned');
onsBoundary.properties = {
  ...(onsBoundary.properties ?? {}),
  sourceDataset: 'ONS Built-up Areas (December 2024)',
  localityName: 'Oundle',
  localityCode: 'E63009999',
};
const activeBoundary = onsBoundary;

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
    const collection = JSON.parse(
      await readFile(resolve(directory, filename), 'utf8'),
    ) as FeatureCollection;
    for (const record of collection.features) {
      if (!record.geometry) continue;
      const representative = pointOnFeature(record as Feature<Geometry>);
      if (!booleanPointInPolygon(representative, activeBoundary)) continue;
      const properties = (record.properties ?? {}) as Record<string, unknown>;
      const listEntry = String(
        properties.ListEntry ??
          properties.LIST_ENTRY ??
          `${basename(filename)}-${features.length}`,
      );
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
        region: 'Northamptonshire',
        locality: 'Oundle',
        featureType: /church/i.test(name)
          ? 'church'
          : /bridge/i.test(name)
            ? 'bridge'
            : /hall|town hall/i.test(name)
              ? 'civic_building'
              : /school|chapel/i.test(name)
                ? 'school'
                : 'other',
        designationType,
        designationCategory: grade,
        significance:
          designationType === 'scheduled_monument'
            ? 'highest_national'
            : nhleSignificance(grade),
        statutoryStatus: 'National Heritage List for England',
        geometry: representative.geometry,
        locationType: record.geometry.type.includes('Polygon')
          ? 'site_centroid'
          : 'representative_point',
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
            String(
              properties.hyperlink ??
                `https://historicengland.org.uk/listing/the-list/list-entry/${listEntry}`,
            ),
            'Official statutory designation. The bulk record does not provide a defensible construction date, so the historic date remains unknown pending official list-entry text enrichment.',
            'official_statutory',
            'Open Government Licence v3.0; contains Historic England data.',
          ),
        ],
        tags: ['historic-england', 'nhle', tag],
        createdAt: reviewedAt,
        updatedAt: reviewedAt,
        reviewed: true,
        reviewNotes:
          'Imported from the locally bundled Historic England national download and filtered against the unchanged ONS Oundle boundary.',
        evidenceScope: 'parish_evidence',
        licence: 'Open Government Licence v3.0; contains Historic England data.',
      });
    }
  }
}

await importNhleFolder('00_listed_building_points', 'listed_building', 'listed-building');
await importNhleFolder('06_scheduled_monuments', 'scheduled_monument', 'scheduled-monument');
await importNhleFolder(
  '07_parks_and_gardens',
  'registered_park_and_garden',
  'registered-park-and-garden',
);

const loveOundleVisit = 'https://www.loveoundle.org/visit/';
const loveOundleEat = 'https://www.loveoundle.org/eating-out/';
const attractions = [
  add(
    place({
      id: 'curated-attraction:oundle-townscape',
      name: 'Oundle historic town centre and Market Place',
      type: 'square',
      coordinates: [-0.467307, 52.480904],
      description:
        'Explore a coherent limestone townscape of Georgian fronts, medieval fabric, independent shops and the landmark church spire.',
      currentNotes:
        'tourism=attraction; visitor_place_type=Historic market-town streetscape; visit_score=84; opening_hours:description=Outdoor public streets and Market Place, best explored in daylight; entrance_fee=Free; time_to_spend=45-90 minutes; website=https://www.loveoundle.org/heritage-trail/',
      url: 'https://www.loveoundle.org/heritage-trail/',
      sourceName: 'Oundle Heritage Trail',
      organisation: 'Love Oundle',
      significance: 'national',
      tags: ['service-context-visitor', 'service-context-heritage'],
    }),
  ),
  add(
    place({
      id: 'curated-attraction:oundle-st-peters',
      name: "St Peter's Church",
      type: 'church',
      coordinates: [-0.467143, 52.481796],
      description:
        'Step into Oundle’s skyline landmark for a spacious medieval interior, carved details and the tall spire that orientates almost every town-centre view.',
      currentNotes:
        'tourism=attraction; visitor_place_type=Medieval parish church; visit_score=82; opening_hours:description=Usually open daily 10:00-16:00 for private prayer and visitors; services can restrict access; entrance_fee=Free, donations welcome; time_to_spend=30-60 minutes; website=https://www.oundlestpeters.org.uk/',
      url: 'https://www.oundlestpeters.org.uk/',
      sourceName: "St Peter's Church visitor information",
      organisation: "St Peter's Church Oundle",
      significance: 'highest_national',
      tags: ['service-context-visitor', 'service-context-heritage'],
    }),
  ),
  add(
    place({
      id: 'curated-attraction:oundle-museum',
      name: 'Oundle Museum',
      type: 'museum',
      coordinates: [-0.474797, 52.48064],
      description:
        'Use the former courthouse to connect Oundle’s elegant streets with finds and stories stretching from prehistory and Roman settlement to the modern town.',
      currentNotes:
        'tourism=museum; visitor_place_type=Local history museum; visit_score=78; opening_hours:description=28 March-1 November 2026, Saturday-Sunday 13:00-16:00; entrance_fee=Free, donations welcome; time_to_spend=45-75 minutes; website=https://www.oundlemuseum.org.uk/',
      url: 'https://www.oundlemuseum.org.uk/',
      sourceName: 'Oundle Museum visitor information',
      organisation: 'Oundle Museum',
      significance: 'regional',
      tags: ['service-context-visitor', 'service-context-heritage'],
    }),
  ),
  add(
    place({
      id: 'curated-attraction:oundle-talbot-history',
      name: 'The Talbot Hotel historic interiors and courtyard',
      type: 'commercial_building',
      coordinates: [-0.469472, 52.481326],
      description:
        'Pause in a Grade I coaching inn rebuilt in 1626, with stone linked to Fotheringhay Castle, a richly atmospheric courtyard and a staircase associated with Mary, Queen of Scots.',
      currentNotes:
        'tourism=attraction; visitor_place_type=Historic coaching inn; visit_score=74; opening_hours:description=Public hospitality areas open with the hotel; visit respectfully and combine the historic interior with food or a drink; entrance_fee=Free to enter public areas; time_to_spend=20-45 minutes; website=https://talbothotel.co.uk/',
      url: 'https://talbothotel.co.uk/',
      sourceName: 'The Talbot history and visitor information',
      organisation: 'The Talbot Hotel',
      significance: 'highest_national',
      earliest: 1626,
      dateText: 'Rebuilt in 1626 using stone associated with Fotheringhay Castle',
      tags: ['service-context-visitor', 'service-context-heritage'],
    }),
  ),
  add(
    place({
      id: 'curated-attraction:oundle-school-architecture',
      name: 'Oundle School Cloisters and Great Hall streetscape',
      type: 'school',
      coordinates: [-0.4686, 52.48195],
      description:
        'Follow the public streets around the Cloisters, Great Hall, chapel and school buildings to see how centuries of collegiate architecture shape the centre of Oundle.',
      currentNotes:
        'tourism=attraction; visitor_place_type=Historic school architecture; visit_score=70; opening_hours:description=Exterior views from public streets at all times; interiors are school or event access only; entrance_fee=Free for exterior walk; time_to_spend=20-40 minutes; website=https://www.oundleschool.org.uk/wp-content/uploads/2024/09/Map_and_Visitor_Information_-_updated_2024-1.pdf',
      url: 'https://www.oundleschool.org.uk/wp-content/uploads/2024/09/Map_and_Visitor_Information_-_updated_2024-1.pdf',
      sourceName: 'Oundle School visitor map',
      organisation: 'Oundle School',
      significance: 'national',
      tags: ['service-context-visitor', 'service-context-heritage'],
    }),
  ),
  add(
    place({
      id: 'curated-attraction:oundle-wharf',
      name: 'Oundle Wharf and River Nene',
      type: 'harbour',
      coordinates: [-0.464519, 52.486753],
      description:
        'Trade stone streets for a calm riverside pause at Oundle Wharf, where boats, the River Nene and waterside food give the town a gentler second character.',
      currentNotes:
        'tourism=attraction; visitor_place_type=Riverside wharf; visit_score=68; opening_hours:description=Outdoor riverside setting, best in daylight; entrance_fee=Free; time_to_spend=30-60 minutes; website=https://www.loveoundle.org/activities/',
      url: 'https://www.loveoundle.org/activities/',
      sourceName: 'Oundle activities and riverside information',
      organisation: 'Love Oundle',
      tags: ['service-context-visitor', 'service-context-walk'],
    }),
  ),
  add(
    place({
      id: 'curated-attraction:oundle-yarrow-gallery',
      name: 'The Yarrow Gallery',
      type: 'other',
      coordinates: [-0.47188, 52.48194],
      description:
        'Catch a public exhibition in an attractive two-storey school gallery, where contemporary work and Oundle’s educational character meet in a more intimate cultural stop.',
      currentNotes:
        'tourism=gallery; visitor_place_type=Public exhibition gallery; visit_score=60; opening_hours:description=Open to the public during advertised exhibition times only; check the current programme before travelling; entrance_fee=Usually free unless an event states otherwise; time_to_spend=30-60 minutes; website=https://www.oundleschool.org.uk/building/the-yarrow-gallery/',
      url: 'https://www.oundleschool.org.uk/building/the-yarrow-gallery/',
      sourceName: 'Yarrow Gallery visitor information',
      organisation: 'Oundle School',
      significance: 'regional',
      earliest: 1918,
      dateText: 'Gallery opened in 1918',
      tags: ['service-context-visitor', 'service-context-heritage'],
    }),
  ),
  add(
    place({
      id: 'curated-attraction:oundle-stahl-theatre',
      name: 'Stahl Theatre',
      type: 'other',
      coordinates: [-0.472441, 52.481178],
      description:
        'Book a public performance in a characterful 264-seat theatre converted from an 1865 church; it is a reason to extend an Oundle visit into the evening rather than a daytime drop-in sight.',
      currentNotes:
        'tourism=theatre; visitor_place_type=Theatre in a converted church; visit_score=56; opening_hours:description=Open for ticketed performances and advertised events only; entrance_fee=Ticket prices vary by production; time_to_spend=2-3 hours for a performance; website=https://www.oundleschool.org.uk/building/the-stahl-theatre/',
      url: 'https://www.oundleschool.org.uk/building/the-stahl-theatre/',
      sourceName: 'Stahl Theatre venue information',
      organisation: 'Oundle School',
      significance: 'regional',
      earliest: 1865,
      dateText: 'Theatre occupies a former church built in 1865',
      tags: ['service-context-visitor', 'service-context-heritage'],
    }),
  ),
];

const highlightMetadata = [
  ['Stone townscape', 'Outdoor public streets and Market Place; best in daylight.', 'Free.', true],
  ['Church spire', 'Usually daily 10:00-16:00; services can restrict access.', 'Free; donations welcome.', true],
  ['Town story', '28 March-1 November 2026, Saturday-Sunday 13:00-16:00.', 'Free; donations welcome.', true],
  ['Historic inn', 'Public hospitality areas open with the hotel.', 'Free to enter public areas.', true],
  ['Collegiate architecture', 'Exterior views from public streets; interiors restricted.', 'Free exterior walk.', true],
  ['Riverside pause', 'Outdoor setting; best in daylight.', 'Free.', true],
  ['Exhibition stop', 'Open during advertised exhibitions only.', 'Usually free.', true],
  ['Evening culture', 'Ticketed performances and advertised events only.', 'Ticket prices vary.', false],
] as const;
const attractionScores = [84, 82, 78, 74, 70, 68, 60, 56];

const food = [
  add(place({ id: 'osm-community:node-4530964991', name: 'The Lemon Tree', type: 'cafe', coordinates: [-0.468771, 52.480742], description: 'A polished independent café for brunch, lunch and cakes, with a bright refurbished interior and a menu that makes this more than a quick coffee stop.', currentNotes: 'amenity=cafe; cuisine=cafe brunch; visit_score=84; price_band=££; opening_hours:description=Monday-Saturday 08:00-17:00, Sunday 09:00-16:00; description=Top food stop: a polished independent cafe for brunch, lunch and cakes; dog_friendly=yes; website=https://www.loveoundle.org/business/food-drink/the-lemon-tree/', url: 'https://www.loveoundle.org/business/food-drink/the-lemon-tree/', sourceName: 'The Lemon Tree visitor listing', organisation: 'Love Oundle', tags: ['service-context-food'] })),
  add(place({ id: 'osm-community:node-3007384947', name: 'The Coffee Tavern', type: 'cafe', coordinates: [-0.466739, 52.480957], description: 'A long-standing Market Place café serving proper breakfasts, homemade lunches, barista coffee and cakes in the most central people-watching position.', currentNotes: 'amenity=cafe; cuisine=breakfast lunch coffee cakes; visit_score=83; price_band=£; opening_hours:description=Monday-Saturday cafe 08:30-18:00 with kitchen until 17:30; Sunday cafe 09:00-17:00 with kitchen until 16:00; description=Top food stop: traditional central cafe with broad daytime choice; website=https://oundlecoffeetavern.com/', url: 'https://oundlecoffeetavern.com/', sourceName: 'Coffee Tavern visitor information', organisation: 'The Coffee Tavern', tags: ['service-context-food'] })),
  add(place({ id: 'osm-community:node-3007399749', name: 'Beans Coffee Stop', type: 'cafe', coordinates: [-0.46898, 52.480857], description: 'Settle beside New Street for Fairtrade coffee, milkshakes, homemade soup, cakes and light snacks while watching the centre of Oundle go by.', currentNotes: 'amenity=cafe; cuisine=coffee cakes light lunch; visit_score=79; price_band=£; opening_hours:description=Monday-Saturday 08:00-18:00, Sunday 09:00-17:00; description=Great choice: central coffee, cakes and light lunch with outdoor seating; website=https://www.beanscoffeestop.co.uk/oundle/', url: 'https://www.beanscoffeestop.co.uk/oundle/', sourceName: 'Beans Oundle visitor information', organisation: 'Beans Coffee Stop', tags: ['service-context-food'] })),
  add(place({ id: 'osm-community:node-4530507757', name: 'Dexters Mediterranean', type: 'cafe', coordinates: [-0.467583, 52.480525], description: 'A lively all-day café and Mediterranean kitchen where coffee, brunch and a proper town-centre lunch work equally well, with courtyard seating in good weather.', currentNotes: 'amenity=cafe; cuisine=Mediterranean brunch lunch; visit_score=78; price_band=££; opening_hours:description=Daytime service Tuesday-Sunday, generally 10:00-15:00; check the current day before travel; description=Great choice: Mediterranean brunch and lunch in a central cafe-bar; website=https://www.dextersmediterranean.com/', url: 'https://www.dextersmediterranean.com/', sourceName: 'Dexters visitor information', organisation: 'Dexters Mediterranean', tags: ['service-context-food'] })),
  add(place({ id: 'curated-food:oundle-talbot', name: 'The Talbot Coffee House and Eatery', type: 'cafe', coordinates: [-0.469472, 52.481326], description: 'Combine a relaxed brunch, lunch, barista coffee or bookable afternoon tea with Oundle’s most atmospheric historic interior and courtyard.', currentNotes: 'amenity=cafe; cuisine=British brunch lunch afternoon tea; visit_score=77; price_band=££; opening_hours:description=Food service daily 07:30-21:00; brunch and lunch in the daytime; afternoon tea 14:00-17:00 by advance booking; description=Great choice: historic setting, broad daytime menu and afternoon tea; dog_friendly=yes; website=https://talbothotel.co.uk/food-and-drinks/', url: 'https://talbothotel.co.uk/food-and-drinks/', sourceName: 'The Talbot food and drink information', organisation: 'The Talbot Hotel', tags: ['service-context-food'] })),
  add(place({ id: 'osm-community:way-143146909', name: 'Tap & Kitchen', type: 'restaurant', coordinates: [-0.46403, 52.486968], description: 'Make lunch part of the riverside experience at Oundle Wharf, with locally minded cooking, coffee and a waterside terrace beside the brewery.', currentNotes: 'amenity=restaurant; cuisine=seasonal British lunch; visit_score=76; price_band=££; opening_hours:description=Lunch generally daily 12:00-15:00; check current service before travel; description=Great choice: waterside lunch at Oundle Wharf; website=https://www.tapandkitchen.com/', url: 'https://www.tapandkitchen.com/', sourceName: 'Tap & Kitchen visitor information', organisation: 'Tap & Kitchen', tags: ['service-context-food'] })),
  add(place({ id: 'osm-community:node-4530507760', name: 'The Greedy Piglet', type: 'cafe', coordinates: [-0.466575, 52.481258], description: 'A relaxed North Street café for breakfasts, generous light lunches, milkshakes, coffee and cake, with an easy-going interior that welcomes dogs.', currentNotes: 'amenity=cafe; cuisine=breakfast lunch coffee cakes; visit_score=74; price_band=£; opening_hours:description=Monday-Saturday 08:00-16:00, Sunday 09:00-15:00; description=Great choice: relaxed all-day cafe with generous portions; dog_friendly=yes; website=https://www.loveoundle.org/eating-out/', url: 'https://www.loveoundle.org/eating-out/', sourceName: 'Oundle food and drink guide', organisation: 'Love Oundle', tags: ['service-context-food'] })),
  add(place({ id: 'osm-community:node-4530964990', name: "Salerno's", type: 'cafe', coordinates: [-0.469157, 52.4807], description: 'A family-run Italian restaurant and café deli that serves lunch from midday on Friday and Saturday, with Italian ingredients and deli goods to take away.', currentNotes: 'amenity=cafe; cuisine=Italian lunch deli; visit_score=71; price_band=££; opening_hours:description=Friday-Saturday from 12:00; Monday-Thursday from 17:00; Sunday closed; description=Great choice when its daytime lunch service is running; website=https://www.salernosoundle.co.uk/findus-salernos', url: 'https://www.salernosoundle.co.uk/findus-salernos', sourceName: "Salerno's opening information", organisation: "Salerno's", tags: ['service-context-food'] })),
  add(place({ id: 'curated-food:oundle-george-inn', name: 'The George Inn', type: 'restaurant', coordinates: [-0.47661, 52.48972], description: 'A traditional pub option for a straightforward cooked lunch, sandwiches and Sunday roast when you want something more substantial than a café.', currentNotes: 'amenity=restaurant; cuisine=British pub lunch; visit_score=68; price_band=££; opening_hours:description=Lunch Wednesday-Saturday 12:00-14:30; Sunday roast 12:00-18:00; description=Good local stop: dependable pub lunch north of the centre; website=https://georgeinnoundle.com/food-drink/', url: 'https://georgeinnoundle.com/food-drink/', sourceName: 'George Inn food and drink information', organisation: 'The George Inn', tags: ['service-context-food'] })),
];

const trails = [
  add(place({ id: 'curated-trail:oundle-heritage-trail', name: 'Oundle Heritage Trail', type: 'street', coordinates: [-0.467307, 52.480904], description: 'A free self-guided circuit through the historic core, linking the Market Place, church, old town hall and some of Oundle’s most revealing listed buildings.', currentNotes: 'route=walking; trail_type=heritage trail; visit_score=88; distance=Town-centre circuit; duration=60-90 minutes; entrance_fee=Free; download_url=https://www.loveoundle.org/heritage-trail/; website=https://www.loveoundle.org/heritage-trail/', url: 'https://www.loveoundle.org/heritage-trail/', sourceName: 'Oundle Heritage Trail', organisation: 'Love Oundle', significance: 'regional', tags: ['service-context-walk'] })),
  add(place({ id: 'curated-trail:oundle-tree-trail', name: 'Oundle Tree Trail', type: 'park', coordinates: [-0.47195, 52.48495], description: 'Use the free map and audio commentary to notice notable specimen trees woven through the market town, adding a quieter green layer to an architectural walk.', currentNotes: 'route=walking; trail_type=tree trail; visit_score=80; distance=Town-centre circuit; duration=45-60 minutes; entrance_fee=Free; download_url=https://www.loveoundle.org/walking-tours/; website=https://www.loveoundle.org/walking-tours/', url: 'https://www.loveoundle.org/walking-tours/', sourceName: 'Oundle Walking Tour App and Tree Trail', organisation: 'Love Oundle', significance: 'local', tags: ['service-context-walk'] })),
];

const parkingUrl = 'https://www.oundle.gov.uk/car-parks';
const parking = [
  add(place({ id: 'osm-community:way-134392572', name: 'Drill Hall Car Park', type: 'parking', coordinates: [-0.475791, 52.481626], currentNotes: 'amenity=parking; parking=surface; access=public; capacity=35; payment_required=no; price_display=Free; maxstay=Long stay; opening_hours:description=Open 24 hours; operator=Oundle Town Council; website=' + parkingUrl, url: parkingUrl, sourceName: 'Oundle car parks', organisation: 'Oundle Town Council', reliability: 'local_authority', tags: ['service-context-parking'] })),
  add(place({ id: 'osm-community:way-142904592', name: "St Osyth's Lane / Co-op Car Park", type: 'parking', coordinates: [-0.465551, 52.480585], currentNotes: 'amenity=parking; parking=surface; access=public; capacity=120 including disabled bays; payment_required=no; price_display=Free; maxstay=2 hours; opening_hours:description=Open with the town-centre Co-op; operator=Co-op; description=Free public short-stay car park leased to and managed by the Co-op; check the current signs before leaving the vehicle; website=' + parkingUrl, url: parkingUrl, sourceName: 'Oundle car parks and transport study', organisation: 'Oundle Town Council', reliability: 'local_authority', tags: ['service-context-parking'] })),
  add(place({ id: 'osm-community:way-142904372', name: 'East Road Long Stay Car Park', type: 'parking', coordinates: [-0.462631, 52.482378], currentNotes: 'amenity=parking; parking=surface; access=public; capacity=85 including disabled bays; payment_required=no; price_display=Free; maxstay=Long stay; opening_hours:description=Open daily; operator=Oundle Town Council; website=' + parkingUrl, url: parkingUrl, sourceName: 'Oundle car parks and transport study', organisation: 'Oundle Town Council', reliability: 'local_authority', tags: ['service-context-parking'] })),
  add(place({ id: 'curated-parking:oundle-fletton-house', name: 'Fletton House Car Park', type: 'parking', coordinates: [-0.472489, 52.48522], currentNotes: 'amenity=parking; parking=surface; access=public; payment_required=no; price_display=Free; opening_hours:description=Available with Fletton House and public events; event use can affect availability; operator=Oundle Town Council; website=https://www.oundlefestivalofliterature.co.uk/venues', url: 'https://www.oundlefestivalofliterature.co.uk/venues', sourceName: 'Oundle festival venues and parking', organisation: 'Oundle Festival of Literature', tags: ['service-context-parking'] })),
];

const toilets = [
  add(place({ id: 'osm-community:way-502096235', name: "St Osyth's Lane public toilets", type: 'toilets', coordinates: [-0.465814, 52.480653], currentNotes: 'amenity=toilets; access=public; fee=no; wheelchair=yes; baby_changing=yes; opening_hours:description=Daily 07:00-18:00; description=Male, female and accessible public toilets beside the Co-op car park off St Osyth\'s Lane; website=https://www.oundle.gov.uk/public-convienances', url: 'https://www.oundle.gov.uk/public-convienances', sourceName: 'Oundle public conveniences', organisation: 'Oundle Town Council', reliability: 'local_authority', tags: ['service-context-toilets'] })),
  add(place({ id: 'curated-toilets:oundle-library', name: 'Oundle Library accessible public toilet', type: 'toilets', coordinates: [-0.472017, 52.485112], currentNotes: 'amenity=toilets; access=public; fee=no; wheelchair=yes; baby_changing=yes; opening_hours:description=Monday-Friday 09:00-17:00, Saturday 10:00-14:00, Sunday closed; description=Disabled public toilet with baby-changing facilities inside Oundle Library on Glapthorn Road; website=https://www.northnorthants.gov.uk/our-libraries/oundle-library', url: 'https://www.northnorthants.gov.uk/our-libraries/oundle-library', sourceName: 'Oundle Library facilities', organisation: 'North Northamptonshire Council', reliability: 'local_authority', tags: ['service-context-toilets'] })),
];

const picnic: HeritageFeature[] = [];

const pkg: ProjectPackage = {
  project: {
    id: projectId,
    name: 'Oundle',
    countryCode: 'GB-ENG',
    country: 'England',
    region: 'Northamptonshire',
    locality: 'Oundle',
    centre: [-0.468, 52.4816],
    boundary: activeBoundary,
    boundarySource:
      'ONS Built-up Areas (December 2024). The official Oundle built-up-area polygon is used unchanged as the active visitor boundary.',
    boundaryConfidence: 'high',
    sourceLanguage: 'en',
    preferredBasemap: 'openstreetmap',
    createdAt: reviewedAt,
    timelineStart: 900,
    timelineEnd: 2026,
    methodology: scoring,
    researchNotes:
      'Full visitor audit completed 2026-08-08. Statutory records come from the locally bundled Historic England NHLE download. Every public planner item is inside the unchanged ONS Oundle boundary. Barnwell Country Park and other nearby countryside attractions remain outside the town planner.',
    touristAppeal: {
      rating: 2,
      label: 'Worth a planned stop',
      summary:
        'Oundle earns two stars for an unusually coherent limestone townscape, a landmark medieval church, a compact museum, excellent self-guided heritage walking and a strong cluster of daytime cafés. It rewards a planned half-day but lacks the heavyweight single attraction needed for a destination-draw rating.',
    },
    visualIdentity: {
      theme: 'stone-market-town-river',
      badgeImage: '/town-guides/oundle-market-town-watercolour-guide.png',
      badgeAlt:
        "Light ink-and-watercolour illustration of Oundle's limestone streets and St Peter's Church spire",
      heroImage: '/town-guides/oundle-market-town-watercolour-guide.png',
      heroAlt:
        "Light ink-and-watercolour illustration of Oundle's limestone streets and St Peter's Church spire",
      heroObjectPosition: '50% 48%',
      primaryColour: '#173F42',
      accentColour: '#C88A32',
      backgroundColour: '#F2F5EC',
      motifs: ['Market town', 'Church spire', 'Stone streets', 'River Nene'],
    },
    townGuide: {
      headline: 'Honey-stone streets, a soaring spire and an easy riverside pause',
      intro:
        "Begin in the Market Place, follow the church spire through warm limestone lanes and use the heritage trail to spot medieval fabric behind Georgian fronts. Add the museum, then pause at the Wharf or one of Oundle's cafés.",
      bestFor: ['Historic streets', 'Church architecture', 'Heritage trails', 'Coffee-and-cake stops'],
      perfectFor: ['A half-day market-town wander', 'Visitors who enjoy architecture without crowds', 'A church, museum and riverside lunch'],
      suggestedFirstVisit: {
        title: "Market Place, St Peter's and the Heritage Trail",
        summary:
          "Start in the Market Place, step inside St Peter's, then use the Heritage Trail through West Street and the school quarter. Add the museum on a weekend or finish with lunch at Oundle Wharf.",
      },
      dontMiss: ['Oundle historic town centre and Market Place', "St Peter's Church", 'Oundle Museum'],
      suggestedTime: 'Half a day; a full day with an exhibition or show',
      visitorMood:
        'Best for handsome streets, quiet history and independent cafés.',
      sourceUrls: [
        loveOundleVisit,
        'https://www.loveoundle.org/heritage-trail/',
        'https://www.oundlemuseum.org.uk/',
        'https://www.oundlestpeters.org.uk/',
        'https://www.oundle.gov.uk/car-parks',
      ],
      lastReviewedAt: reviewedDate,
    },
    visitorHighlights: attractions.map((feature, index) => ({
      rank: index + 1,
      featureId: feature.id,
      name: feature.name,
      reason: feature.shortDescription ?? feature.name,
      tagline: highlightMetadata[index][0],
      visitorScore: attractionScores[index],
      openingTimes: highlightMetadata[index][1],
      admission: highlightMetadata[index][2],
      freeAdmission: highlightMetadata[index][3],
      organisationPills: [],
      sourceName: feature.sourceRecords[0].sourceName,
      sourceUrl: feature.sourceRecords[0].sourceUrl ?? '',
      verifiedInBoundaryAt: reviewedDate,
    })),
    townStudyArea: {
      localityName: 'Oundle',
      localityCode: 'E63009999',
      sourceName: 'ONS Built-up Areas (December 2024)',
      sourceUrl: onsUrl,
      sourceVersion: 'December 2024 V2',
      bufferMetres: 0,
      localityBoundary: onsBoundary,
      bufferedBoundary: onsBoundary,
      visitorBoundary: onsBoundary,
      notes:
        'The official ONS 2024 Oundle built-up area is preserved unchanged and is also the active visitor boundary. Nearby Barnwell Country Park, the Boxwood Cafe and the Treasure Trail start are outside it and are not counted in Oundle planner totals.',
    },
  },
  features,
  sources: [
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
      id: 'oundle-visitor-audit',
      name: 'Oundle visitor audit',
      organisation: 'Townscape Guides curation',
      coverage: 'Oundle ONS built-up area',
      accessMethod: 'Manual research of official, operator and local visitor sources',
      reliability: 'secondary',
      limitations:
        'Opening times, prices, exhibitions, performances and pet policies can change; follow linked operator pages before a special journey.',
    },
  ],
  historicMaps: [],
  settlementPolygons: [],
  validation: [],
};

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as {
  schemaVersion: number;
  description: string;
  projects: Record<string, Record<string, string[]>>;
};
planner.projects[projectId] = {
  eat: food.map((feature) => feature.id),
  trails: trails.map((feature) => feature.id),
  parking: parking.map((feature) => feature.id),
  toilets: toilets.map((feature) => feature.id),
  picnic: picnic.map((feature) => feature.id),
};

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as {
  schemaVersion: number;
  reviewedAt: string;
  description: string;
  projects: Record<
    string,
    { attraction: Record<string, unknown>; eat: Record<string, unknown> }
  >;
};
const unconfirmed = (url: string) => ({
  rating: 0,
  status: 'unconfirmed',
  label: 'Dog policy not confirmed',
  summary:
    'No reliable current policy confirming pet-dog access was found. Check directly before making a dog-dependent journey; assistance-dog access is separate.',
  sourceName: 'Reviewed visitor information',
  sourceUrl: url,
  reviewedAt: reviewedDate,
});
dog.projects[projectId] = {
  attraction: {
    [attractions[0].id]: { rating: 3, status: 'welcoming', label: 'Excellent with a dog', summary: 'The historic centre is an outdoor street wander with plenty of scope to pause. Keep dogs close around traffic, the market and busy shop entrances.', sourceName: 'Love Oundle visitor information', sourceUrl: 'https://www.loveoundle.org/visit/', reviewedAt: reviewedDate },
    [attractions[1].id]: unconfirmed('https://www.oundlestpeters.org.uk/'),
    [attractions[2].id]: unconfirmed('https://www.oundlemuseum.org.uk/'),
    [attractions[3].id]: { rating: 3, status: 'welcoming', label: 'Excellent with a dog', summary: 'The Talbot explicitly welcomes dogs in its public areas and bar dining spaces, with pet-friendly tables and a strong dog-inclusive hospitality offer.', sourceName: 'The Talbot pet-friendly dining information', sourceUrl: 'https://talbothotel.co.uk/food-and-drinks/', reviewedAt: reviewedDate },
    [attractions[4].id]: { rating: 2, status: 'restricted', label: 'Good outdoor dog stop', summary: 'The architecture is viewed from public streets, so dogs can join the walk. School interiors and grounds are not treated as public dog-access areas.', sourceName: 'Oundle School visitor map', sourceUrl: 'https://www.oundleschool.org.uk/wp-content/uploads/2024/09/Map_and_Visitor_Information_-_updated_2024-1.pdf', reviewedAt: reviewedDate },
    [attractions[5].id]: { rating: 3, status: 'welcoming', label: 'Excellent with a dog', summary: 'The Wharf and riverside paths make an easy dog-inclusive pause. Use a lead around boats, wildlife, roads and the busiest hospitality areas.', sourceName: 'Love Oundle activities', sourceUrl: 'https://www.loveoundle.org/activities/', reviewedAt: reviewedDate },
    [attractions[6].id]: unconfirmed('https://www.oundleschool.org.uk/building/the-yarrow-gallery/'),
    [attractions[7].id]: unconfirmed('https://www.oundleschool.org.uk/building/the-stahl-theatre/'),
  },
  eat: {
    [food[0].id]: { rating: 3, status: 'welcoming', label: 'Excellent with a dog', summary: 'Current visitor information describes the cafe as dog friendly throughout, making it one of Oundle’s easiest indoor cafe choices with a dog.', sourceName: 'The Lemon Tree current visitor listing', sourceUrl: 'https://www.tripadvisor.co.uk/Restaurant_Review-g504024-d27984063-Reviews-The_Lemon_Tree_Oundle-Oundle_Northamptonshire_England.html', reviewedAt: reviewedDate },
    [food[1].id]: unconfirmed('https://oundlecoffeetavern.com/'),
    [food[2].id]: { rating: 1, status: 'restricted', label: 'Outdoor seating only confirmed', summary: 'Outdoor seating is mapped at Beans, but a current indoor pet policy was not found. Check with the cafe before relying on an indoor table.', sourceName: 'OpenStreetMap current place record', sourceUrl: 'https://www.openstreetmap.org/node/3007399749', reviewedAt: reviewedDate },
    [food[3].id]: unconfirmed('https://www.dextersmediterranean.com/'),
    [food[4].id]: { rating: 3, status: 'welcoming', label: 'Excellent with a dog', summary: 'Dogs are explicitly welcomed at selected dining tables and in the bar. Choose pet-friendly dining when booking.', sourceName: 'The Talbot pet-friendly dining information', sourceUrl: 'https://talbothotel.co.uk/food-and-drinks/', reviewedAt: reviewedDate },
    [food[5].id]: unconfirmed('https://www.tapandkitchen.com/'),
    [food[6].id]: { rating: 3, status: 'welcoming', label: 'Excellent with a dog', summary: 'Recent visitors consistently confirm that dogs are welcomed inside this relaxed cafe, not merely on pavement tables.', sourceName: 'Recent Greedy Piglet visitor reports', sourceUrl: 'https://wanderlog.com/place/details/1587306/the-greedy-piglet', reviewedAt: reviewedDate },
    [food[7].id]: unconfirmed('https://www.salernosoundle.co.uk/findus-salernos'),
    [food[8].id]: { rating: 2, status: 'welcoming', label: 'Dog-friendly pub lunch', summary: 'Love Oundle describes the venue as family and dog friendly. Check the preferred dog-friendly seating area at busy service times.', sourceName: 'Love Oundle eating out guide', sourceUrl: loveOundleEat, reviewedAt: reviewedDate },
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
const outside = features.filter(
  (feature) =>
    publicIds.has(feature.id) &&
    feature.geometry?.type === 'Point' &&
    !booleanPointInPolygon(point(feature.geometry.coordinates), activeBoundary),
);
if (outside.length) {
  throw new Error(
    `Public markers outside Oundle boundary: ${outside.map((feature) => feature.name).join(', ')}`,
  );
}

const audit = {
  projectId,
  reviewedAt,
  boundary: {
    source: 'ONS Built-up Areas (December 2024)',
    localityCode: 'E63009999',
    visitorExtensions: [],
  },
  counts: {
    historicEnglandRecords: features.filter((feature) => feature.tags.includes('nhle')).length,
    attractions: attractions.length,
    food: food.length,
    trails: trails.length,
    parking: parking.length,
    toilets: toilets.length,
    picnic: picnic.length,
  },
  touristAppeal: pkg.project.touristAppeal,
  validation: {
    allPublicMarkersInsideActiveBoundary: true,
    customerOnlyParkingExcluded: true,
    practicalPlacesNamedByLocation: true,
    duplicatePicnicNodesGrouped: true,
    unknownHistoricDatesNotInvented: true,
    treasureTrailsChecked: true,
  },
  excludedNearbyPlaces: [
    {
      name: 'Barnwell Country Park and Kingfisher Cafe',
      reason: 'South of the unchanged ONS Oundle built-up-area boundary.',
    },
    {
      name: 'Oundle Treasure Trail',
      reason:
        'Exact town match found, but the official route starts at Barnwell Country Park outside the active boundary and is therefore not counted in the strict town planner.',
      sourceUrl: 'https://www.treasuretrails.co.uk/products/things-to-do-oundle-northants',
    },
    {
      name: 'Boxwood Cafe',
      reason: 'Outside the active Oundle boundary.',
    },
    {
      name: 'Oundle Recreation Ground picnic tables',
      reason:
        'The two adjacent OSM picnic-table nodes form one real facility, but both sit outside the unchanged ONS boundary and are excluded.',
    },
  ],
  notes: [
    'The ONS statistical boundary is retained unchanged as the active visitor boundary.',
    'NHLE designation dates are not treated as construction dates; official list-entry text enrichment follows this creation step.',
    'Opening times, prices, exhibitions and access policies should be rechecked before a special journey.',
  ],
};

await mkdir(resolve('data/projects'), { recursive: true });
await mkdir(resolve('data/review'), { recursive: true });
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify(audit, null, 2));
