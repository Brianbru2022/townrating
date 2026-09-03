import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/linlithgow.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/linlithgow-visitor-audit-2026-08-07.json');
const artworkSource =
  'C:/Users/brian/.codex/generated_images/019fba10-c165-7452-808e-8d335a7365f4/exec-b150d813-3ec6-44f6-a40d-c29f53d42b66.png';
const artworkPath = resolve('public/town-guides/linlithgow-palace-loch-watercolour-guide.png');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-07T00:00:00Z';
const reviewedDate = '2026-08-07';
const auditTag = 'linlithgow-visitor-audit';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'OpenStreetMap contributors, Open Database Licence.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Linlithgow feature: ${id}`);
  return feature;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function currentSource(
  sourceName: string,
  sourceOrganisation: string,
  sourceRecordId: string,
  sourceUrl: string,
  notes: string,
  reliability: SourceRecord['reliability'] = 'official_non_statutory',
  licence = editorialMetadataLicence,
): SourceRecord {
  return {
    sourceName,
    sourceOrganisation,
    sourceRecordId,
    sourceUrl,
    accessedAt: reviewedAt,
    licence,
    reliability,
    notes,
  };
}

function replaceCurrentCurationSource(feature: HeritageFeature, source: SourceRecord): void {
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (record) =>
        !record.sourceRecordId?.startsWith('visitor-audit:') &&
        !record.notes?.startsWith('Current-place curation'),
    ),
    source,
  ];
  feature.licence ??= source.licence;
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

function upsertFeature(feature: HeritageFeature): HeritageFeature {
  const index = pkg.features.findIndex((candidate) => candidate.id === feature.id);
  if (index === -1) pkg.features.push(feature);
  else pkg.features[index] = feature;
  return feature;
}

function curatedPoint(
  id: string,
  name: string,
  featureType: string,
  coordinates: [number, number],
  shortDescription: string,
  source: SourceRecord,
  tags: string[],
): HeritageFeature {
  return {
    id,
    projectId: pkg.project.id,
    name,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType,
    significance: 'local',
    geometry: { type: 'Point', coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription,
    sourceRecords: [source],
    tags: [...new Set([...tags, auditTag])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-07; excluded from historic dating and heat-map evidence.',
    evidenceScope: 'related_context',
    licence: editorialMetadataLicence,
  };
}

function updateAttraction(
  id: string,
  options: {
    name: string;
    type: string;
    address: string;
    description: string;
    score: number;
    opening: string;
    admission: string;
    time: string;
    accessibility: string;
    website: string;
    organisation: string;
    reliability?: SourceRecord['reliability'];
  },
): HeritageFeature {
  const feature = featureById(id);
  feature.name = options.name;
  feature.featureType = options.type;
  feature.address = options.address;
  feature.shortDescription = options.description;
  addTags(feature, 'current-context', 'service-context-heritage', 'service-context-visitor', auditTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${options.name} visitor information`,
      options.organisation,
      `visitor-audit:attraction:${feature.id}`,
      options.website,
      `Current-place curation: tourism=attraction; name=${options.name}; visitor_place_type=${options.type}; visit_score=${options.score}; opening_hours:description=${options.opening}; entrance_fee=${options.admission}; time_to_spend=${options.time}; accessibility=${options.accessibility}; description=${options.description}; website=${options.website}.`,
      options.reliability,
    ),
  );
  return feature;
}

function updateFood(
  feature: HeritageFeature,
  options: {
    name?: string;
    description: string;
    score: number;
    tagline: string;
    opening: string;
    price: string;
    cuisine: string;
    website: string;
    organisation: string;
    dogFriendly?: boolean;
    reliability?: SourceRecord['reliability'];
  },
): HeritageFeature {
  if (options.name) feature.name = options.name;
  feature.shortDescription = options.description;
  addTags(feature, 'current-context', 'service-context-food', 'visitor-context-food', auditTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${feature.name} visitor information`,
      options.organisation,
      `visitor-audit:food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${feature.featureType === 'restaurant' ? 'restaurant' : 'cafe'}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}${options.dogFriendly ? '; dog_friendly=yes' : ''}.`,
      options.reliability ?? 'official_non_statutory',
    ),
  );
  return feature;
}

function updatePractical(
  feature: HeritageFeature,
  options: {
    name: string;
    type: 'parking' | 'toilets' | 'picnic_site';
    address: string;
    description: string;
    category: 'parking' | 'toilets' | 'picnic';
    detail: string;
    sourceName: string;
    organisation: string;
    sourceUrl: string;
    reliability?: SourceRecord['reliability'];
  },
): HeritageFeature {
  feature.name = options.name;
  feature.featureType = options.type;
  feature.address = options.address;
  feature.shortDescription = options.description;
  addTags(feature, 'current-context', `service-context-${options.category}`, auditTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      options.sourceName,
      options.organisation,
      `visitor-audit:${options.category}:${feature.id}`,
      options.sourceUrl,
      `Current-place curation: amenity=${options.type}; name=${options.name}; ${options.detail}; description=${options.description}`,
      options.reliability ?? 'official_non_statutory',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
  );
  return feature;
}

pkg.project.touristAppeal = {
  rating: 3,
  label: 'Destination draw',
  summary:
    'Linlithgow remains a three-star destination: the palace and loch form one of Scotland\'s strongest compact historic settings, supported by St Michael\'s, a handsome High Street, the museum and canal centre. The train station makes it especially convincing as a full-day trip. House of the Binns, Blackness Castle, Beecraigs and the Avon Aqueduct lie outside the active town polygon and do not inflate this rating.',
};

pkg.project.visualIdentity = {
  theme: 'royal-palace-loch-and-canal',
  badgeImage: '/town-guides/linlithgow-palace-loch-watercolour-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of Linlithgow Palace and St Michael\'s Church seen across Linlithgow Loch',
  heroImage: '/town-guides/linlithgow-palace-loch-watercolour-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of Linlithgow Palace and St Michael\'s Church seen across Linlithgow Loch',
  heroObjectPosition: '50% 48%',
  primaryColour: '#173F43',
  accentColour: '#A86C27',
  backgroundColour: '#EEF4E7',
  motifs: ['Palace story', 'Loch waterfront', 'Canal boats', 'Historic walk'],
};

pkg.project.townGuide = {
  headline: 'A royal palace, lochside walks and a High Street made for wandering',
  intro:
    'Linlithgow brings a remarkable amount into one easy day: explore the birthplace of Mary, Queen of Scots, step into the great parish kirk beside it, circle the loch through the Peel, then wander a High Street of historic closes, independent cafes and civic landmarks. The museum and canal basin add rewarding second chapters without pulling the visit away from the town centre.',
  bestFor: ['Royal history', 'Lochside walks', 'Historic streets', 'Easy rail day trips'],
  perfectFor: [
    'A palace-and-loch day out',
    'Visitors combining architecture, walking and cafes',
    'A car-free historic-town trip from Edinburgh or Glasgow',
  ],
  suggestedFirstVisit: {
    title: 'Palace, kirk, loch and High Street',
    summary:
      'Begin at Linlithgow Palace and St Michael\'s, walk through the Peel for the classic loch view, then return by The Cross and High Street. Add the museum or canal centre according to opening days and season.',
  },
  dontMiss: ['Linlithgow Palace', 'Linlithgow Loch and the Peel', "St Michael's Parish Church"],
  suggestedTime: 'Full day',
  visitorMood:
    'For visitors who want a visually memorable Scottish historic town with one major monument, an easy scenic walk and plenty to fill the rest of a day.',
  currentAdvisory: {
    title: 'Palace access',
    summary:
      'The palace is open, but the North Range, King\'s Bed Chamber and Court Kitchen are currently inaccessible. Check Historic Environment Scotland before travelling.',
    sourceUrl: 'https://www.historicenvironment.scot/visit-a-place/places/linlithgow-palace/plan-your-visit/',
    linkLabel: 'Check palace access',
  },
  sourceUrls: [
    'https://www.visitwestlothian.co.uk/explore/linlithgow/',
    'https://www.historicenvironment.scot/visit-a-place/places/linlithgow-palace/plan-your-visit/',
    'https://www.stmichaelsparish.org.uk/visit/opening-hours/',
    'https://www.linlithgowmuseum.org/visit',
    'https://www.lucs.org.uk/opening-times-and-dates/',
    'https://www.linlithgowburghhalls.co.uk/',
    'https://linlithgow.co.uk/heritagetrail/',
    'https://linlithgow.co.uk/perambulation/',
    'https://www.westlothian.gov.uk/toilets',
    'https://linlithgow.co.uk/parking/',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Linlithgow town study area is missing');
delete townStudyArea.visitorBoundary;
townStudyArea.notes =
  'The active visitor boundary is the original NRS 2022 Linlithgow locality, preserved unchanged. All town-planner markers are validated inside it. House of the Binns, Blackness Castle, Beecraigs Country Park, the Avon Aqueduct and other wider Linlithgow-area attractions are outside the locality and excluded from the town planner and rating.';

const palace = updateAttraction('nrhe:49261', {
  name: 'Linlithgow Palace',
  type: 'palace',
  address: 'Kirkgate, Linlithgow, EH49 7AL',
  description:
    'Climb through the roofless royal apartments where Mary, Queen of Scots was born, with views over the loch and the elaborate Renaissance fountain in the courtyard.',
  score: 93,
  opening:
    'April-September daily 09:30-17:00; October-March daily 10:00-16:00. Last entry 45 minutes before closing. Closed 25-26 December and 1-2 January.',
  admission:
    'Online: adult £10, concession £8, child £6; walk-up adult £11, concession £9, child £6.50. Historic Scotland members free.',
  time: '90-120 minutes',
  accessibility:
    'Historic surfaces and stairs restrict access to upper levels. The North Range, King\'s Bed Chamber and Court Kitchen are currently inaccessible.',
  website: 'https://www.historicenvironment.scot/visit-a-place/places/linlithgow-palace/plan-your-visit/',
  organisation: 'Historic Environment Scotland',
});

const loch = updateAttraction('nrhe:293918', {
  name: 'Linlithgow Loch and the Peel',
  type: 'park',
  address: 'The Peel and Linlithgow Loch, Linlithgow',
  description:
    'The palace rises directly above this easy lochside circuit, giving changing water, wildlife and skyline views within minutes of the High Street.',
  score: 89,
  opening: 'Open-air park and loch path; visit in daylight.',
  admission: 'Free.',
  time: '60-90 minutes for the loch circuit; shorter for the Peel only',
  accessibility:
    'Much of the circular is surfaced and buggy-friendly, with some road pavement and sections that can be wet after poor weather.',
  website: 'https://www.westlothian.gov.uk/media/2637/DCPP-10-Map-D-WL3-Linlithgow-Loch-Circular-WL7-Fisher-s-Brae-and-WL35-Linlithgow-Loch-to-Union-Canal/pdf/dcpp-map-d.pdf',
  organisation: 'West Lothian Council',
  reliability: 'local_authority',
});

const church = updateAttraction('hes-listed-building:LB37499', {
  name: "St Michael's Parish Church",
  type: 'church',
  address: 'Kirkgate, Linlithgow, EH49 7AL',
  description:
    'The great medieval burgh church beside the palace rewards a quieter visit with soaring stonework, stained glass and an extraordinary shared royal setting.',
  score: 83,
  opening:
    'April-September Monday-Saturday 10:30-16:00 and Sunday 11:00-16:00; October-April Monday-Saturday 10:30-13:00. Worship and events can affect access.',
  admission: 'Free; donations welcome.',
  time: '30-45 minutes',
  accessibility: 'Contact the church for current access arrangements if step-free access is essential.',
  website: 'https://www.stmichaelsparish.org.uk/visit/opening-hours/',
  organisation: "St Michael's Parish Church",
});

const canal = updateAttraction('hes-listed-building:LB37479', {
  name: 'Linlithgow Canal Centre and boat trips',
  type: 'canal',
  address: 'Manse Road Basin, Linlithgow, EH49 6AJ',
  description:
    'A volunteer-run canal basin with a free museum, tea room and seasonal boat trips ranging from a short town cruise to the Avon Aqueduct.',
  score: 82,
  opening:
    '2026 season: weekends 4 April-27 September and weekdays 29 June-7 August; museum and tea room generally 13:30-16:30. Boat departures vary.',
  admission:
    'Museum free. Town trip: adult £6, concession £5, child £4, family £18. Longer aqueduct trips cost more.',
  time: '45-60 minutes for the centre; 90-180 minutes with a boat trip',
  accessibility: 'Contact the Canal Society before travelling for current boat and site accessibility.',
  website: 'https://www.lucs.org.uk/opening-times-and-dates/',
  organisation: 'Linlithgow Union Canal Society',
});

const museum = updateAttraction('osm-community:node-192309908', {
  name: 'Linlithgow Museum',
  type: 'museum',
  address: 'Tam Dalyell House, 93 High Street, Linlithgow, EH49 7EZ',
  description:
    'A compact, well-presented museum that turns the town\'s royal, civic and everyday stories into a useful introduction before exploring the streets.',
  score: 78,
  opening: 'Thursday-Saturday 10:00-16:00; Sunday 13:00-16:00. Closed Monday-Wednesday.',
  admission: 'Free.',
  time: '45-60 minutes',
  accessibility: 'First-floor museum with lift access.',
  website: 'https://www.linlithgowmuseum.org/visit',
  organisation: 'Linlithgow Heritage Trust',
});

const burghHalls = updateAttraction('hes-listed-building:LB37362', {
  name: 'Linlithgow Burgh Halls and Rose Garden',
  type: 'civic_building',
  address: 'The Cross, Linlithgow, EH49 7AH',
  description:
    'Step into the historic civic building for its changing gallery, visitor information and cafe, then slip through to the sheltered Rose Garden below the palace.',
  score: 72,
  opening: 'Monday-Sunday 09:00-17:00; events can affect access.',
  admission: 'Free exhibitions; events may be ticketed.',
  time: '30-45 minutes',
  accessibility: 'Public areas have ramps, a lift and an adapted toilet.',
  website: 'https://www.linlithgowburghhalls.co.uk/',
  organisation: 'West Lothian Council',
  reliability: 'local_authority',
});

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: palace.id,
    name: palace.name,
    reason: palace.shortDescription ?? '',
    tagline: 'Royal centrepiece',
    visitorScore: 93,
    openingTimes:
      'April-September daily 09:30-17:00; October-March daily 10:00-16:00. Last entry 45 minutes before closing. Closed 25-26 December and 1-2 January.',
    admission:
      'Online: adult £10, concession £8, child £6; walk-up adult £11, concession £9, child £6.50. Historic Scotland members free.',
    freeAdmission: false,
    organisationPills: ['HES'],
    homeMapEligible: true,
    sourceName: 'Historic Environment Scotland',
    sourceUrl: 'https://www.historicenvironment.scot/visit-a-place/places/linlithgow-palace/plan-your-visit/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: loch.id,
    name: loch.name,
    reason: loch.shortDescription ?? '',
    tagline: 'Palace and loch views',
    visitorScore: 89,
    openingTimes: 'Open-air park and loch path; visit in daylight.',
    admission: 'Free.',
    freeAdmission: true,
    homeMapEligible: true,
    sourceName: 'West Lothian Council',
    sourceUrl: 'https://www.westlothian.gov.uk/media/2637/DCPP-10-Map-D-WL3-Linlithgow-Loch-Circular-WL7-Fisher-s-Brae-and-WL35-Linlithgow-Loch-to-Union-Canal/pdf/dcpp-map-d.pdf',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: church.id,
    name: church.name,
    reason: church.shortDescription ?? '',
    tagline: 'Medieval kirk',
    visitorScore: 83,
    openingTimes: 'Seasonal daytime opening; worship and events can affect access.',
    admission: 'Free; donations welcome.',
    freeAdmission: true,
    homeMapEligible: false,
    sourceName: "St Michael's Parish Church",
    sourceUrl: 'https://www.stmichaelsparish.org.uk/visit/opening-hours/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 4,
    featureId: canal.id,
    name: canal.name,
    reason: canal.shortDescription ?? '',
    tagline: 'Museum and cruises',
    visitorScore: 82,
    openingTimes:
      '2026 season: weekends 4 April-27 September and weekdays 29 June-7 August; museum and tea room generally 13:30-16:30. Boat departures vary.',
    admission:
      'Museum free. Town trip: adult £6, concession £5, child £4, family £18. Longer aqueduct trips cost more.',
    freeAdmission: false,
    homeMapEligible: false,
    sourceName: 'Linlithgow Union Canal Society',
    sourceUrl: 'https://www.lucs.org.uk/opening-times-and-dates/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 5,
    featureId: museum.id,
    name: museum.name,
    reason: museum.shortDescription ?? '',
    tagline: 'Town stories',
    visitorScore: 78,
    openingTimes: 'Thursday-Saturday 10:00-16:00; Sunday 13:00-16:00.',
    admission: 'Free.',
    freeAdmission: true,
    homeMapEligible: false,
    sourceName: 'Linlithgow Museum',
    sourceUrl: 'https://www.linlithgowmuseum.org/visit',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 6,
    featureId: burghHalls.id,
    name: burghHalls.name,
    reason: burghHalls.shortDescription ?? '',
    tagline: 'Gallery and garden',
    visitorScore: 72,
    openingTimes: 'Monday-Sunday 09:00-17:00; events can affect access.',
    admission: 'Free exhibitions; events may be ticketed.',
    freeAdmission: true,
    homeMapEligible: false,
    sourceName: 'Linlithgow Burgh Halls',
    sourceUrl: 'https://www.linlithgowburghhalls.co.uk/',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const cafe1807 = upsertFeature(
  curatedPoint(
    'curated-food:linlithgow-cafebar-1807',
    'Cafebar 1807',
    'restaurant',
    [-3.59998, 55.97708],
    'A relaxed all-day High Street cafe-bar for lunch, dinner, coffee or cocktails, named after the reconstruction date of Linlithgow Cross Well.',
    currentSource(
      'Cafebar 1807 visitor information',
      'Cafebar 1807',
      'visitor-audit:food:linlithgow-cafebar-1807',
      'https://www.cafebar1807.org.uk/',
      'Current-place curation: amenity=restaurant; name=Cafebar 1807; cuisine=modern Scottish cafe-bar; visit_score=82; price_band=££; opening_hours:description=Monday-Thursday 12:00-21:00; Friday 11:00-23:00; Saturday 10:30-23:00; Sunday 11:00-21:00; description=All-day choice: A relaxed High Street cafe-bar for lunch, dinner, coffee or cocktails; website=https://www.cafebar1807.org.uk/; dog_friendly=yes.',
    ),
    ['current-context', 'service-context-food', 'visitor-context-food'],
  ),
);

const aran = updateFood(featureById('osm-community:node-4592926618'), {
  name: 'Aran Cafe',
  description:
    'A bright independent cafe at The Cross known for carefully made coffee, breakfast, brunch, sandwiches and cakes in the heart of the old town.',
  score: 85,
  tagline: 'Best for brunch',
  opening: 'Open daily for breakfast and lunch; confirm current daily hours before a special journey.',
  price: '££',
  cuisine: 'breakfast, brunch and speciality coffee',
  website: 'https://linlithgow.co.uk/businessdirectory/foodanddrink/dogfriendly/',
  organisation: 'One Linlithgow',
  dogFriendly: true,
});
const soStrawberry = updateFood(featureById('osm-community:node-549303928'), {
  name: 'So Strawberry Caffe',
  description:
    'A dependable central cafe for breakfast, lunch, home baking and afternoon coffee, with a dog-friendly welcome beside The Cross.',
  score: 84,
  tagline: 'Best all-round cafe',
  opening: 'Monday 09:30-16:30; Tuesday-Saturday 09:00-16:30; Sunday 10:00-16:30.',
  price: '££',
  cuisine: 'cafe lunches and home baking',
  website: 'https://linlithgow.co.uk/businessdirectory/sostrawberrycaffe/',
  organisation: 'So Strawberry Caffe / One Linlithgow',
  dogFriendly: true,
});
const barLeo = updateFood(featureById('osm-community:node-3644699531'), {
  description:
    'A long-established Italian restaurant for pizza, pasta and a fuller sit-down meal, useful when the daytime cafes have closed.',
  score: 78,
  tagline: 'Italian dinner',
  opening: 'Monday closed; Tuesday-Thursday 12:00-15:00 and 17:00-21:00; Friday-Sunday 12:00-22:00.',
  price: '££',
  cuisine: 'Italian',
  website: 'https://www.barleo.co.uk/',
  organisation: 'Bar Leo',
});
const taste = updateFood(featureById('osm-community:node-192347019'), {
  name: 'Taste Deli Cafe',
  description:
    'A dog-friendly deli cafe in a former bakery, with breakfasts, fresh lunches, deli produce and room to pause over coffee near the east High Street.',
  score: 76,
  tagline: 'Deli lunches',
  opening: 'Check the current business listing before travelling specifically for a meal.',
  price: '££',
  cuisine: 'deli cafe',
  website: 'https://linlithgow.co.uk/businessdirectory/tastecafedeli/',
  organisation: 'Taste Deli Cafe / One Linlithgow',
  dogFriendly: true,
});
const crannog = updateFood(featureById('osm-community:node-5126658386'), {
  name: 'Crannog Cafe',
  description:
    'A friendly dog-welcoming cafe for soup, filled rolls, scones and home baking, with a distinctly local and unhurried feel.',
  score: 74,
  tagline: 'Home baking',
  opening: 'Check the current business listing before travelling specifically for a meal.',
  price: '£',
  cuisine: 'Scottish cafe food and home baking',
  website: 'https://mylinlithgow.com/directory/listing/all-businesses/crannog-cafe/',
  organisation: 'Crannog Cafe / My Linlithgow',
  dogFriendly: true,
});
const hallsCafe = updateFood(featureById('osm-community:node-4592926619'), {
  name: 'Linlithgow Burgh Halls Cafe',
  description:
    'Fresh soups, sandwiches and home baking with a terrace leading into the Rose Garden below St Michael\'s and the palace.',
  score: 71,
  tagline: 'Garden cafe',
  opening: 'Monday-Friday 10:00-15:00; Saturday-Sunday 10:00-16:00.',
  price: '££',
  cuisine: 'cafe lunches and home baking',
  website: 'https://www.linlithgowburghhalls.co.uk/article/72524/Caf%C3%A9',
  organisation: 'West Lothian Council',
  reliability: 'local_authority',
});

const heritageTrail = upsertFeature(
  curatedPoint(
    'visitor-context:linlithgow-heritage-trail',
    'Linlithgow Heritage Trail',
    'walking_route',
    [-3.6006073, 55.97713],
    'A self-guided town-centre trail beginning at The Cross and linking 49 royal, civic and architectural points across historic Linlithgow.',
    currentSource(
      'Linlithgow Heritage Trail',
      'Linlithgow Civic Trust / One Linlithgow',
      'visitor-audit:trail:linlithgow-heritage-trail',
      'https://linlithgow.co.uk/heritagetrail/',
      'Current-place curation: route=walking; name=Linlithgow Heritage Trail; visit_score=88; distance=Town-centre route with 49 numbered points; time_to_spend=90-150 minutes; accessibility=Mostly streets and pavements with some slopes, cobbles and historic surfaces; entrance_fee=Free; description=Follow the royal burgh story from The Cross through closes, wynds and civic landmarks; website=https://linlithgow.co.uk/heritagetrail/; download_url=https://mylinlithgow.com/wp-content/uploads/2019/02/linlithgow-heritage-trail-visitor-guide.pdf.',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);
const lochTrail = upsertFeature(
  curatedPoint(
    'visitor-context:linlithgow-loch-circular',
    'Linlithgow Loch Circular',
    'walking_route',
    [-3.6071735, 55.9770501],
    'An easy family-friendly circuit of the loch with waterbirds, woodland and repeated views back to the palace and St Michael\'s skyline.',
    currentSource(
      'Linlithgow Loch Circular WL3',
      'West Lothian Council',
      'visitor-audit:trail:linlithgow-loch-circular',
      'https://www.westlothian.gov.uk/media/2637/DCPP-10-Map-D-WL3-Linlithgow-Loch-Circular-WL7-Fisher-s-Brae-and-WL35-Linlithgow-Loch-to-Union-Canal/pdf/dcpp-map-d.pdf',
      'Current-place curation: route=walking; name=Linlithgow Loch Circular; visit_score=86; distance=Approximately 3.5 km; time_to_spend=60-90 minutes; accessibility=Mostly surfaced and suitable for buggies, with a short road-pavement section and possible wet ground; entrance_fee=Free; description=Circle the loch for the classic palace-and-water views without leaving the town boundary; website=https://www.westlothian.gov.uk/media/2637/DCPP-10-Map-D-WL3-Linlithgow-Loch-Circular-WL7-Fisher-s-Brae-and-WL35-Linlithgow-Loch-to-Union-Canal/pdf/dcpp-map-d.pdf.',
      'local_authority',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);
const perambulation = upsertFeature(
  curatedPoint(
    'visitor-context:linlithgow-perambulation',
    'Linlithgow Marches Perambulation',
    'walking_route',
    [-3.6137185, 55.9760026],
    'A 4-mile route around the historic 1832 parliamentary burgh boundary, marked by 32 points and rooted in Linlithgow\'s Marches tradition.',
    currentSource(
      'Linlithgow Marches and Deacons Court Perambulation',
      'Linlithgow Marches and Deacons Court / One Linlithgow',
      'visitor-audit:trail:linlithgow-perambulation',
      'https://linlithgow.co.uk/perambulation/',
      'Current-place curation: route=walking; name=Linlithgow Marches Perambulation; visit_score=78; distance=4 miles / 6.5 km; time_to_spend=120-180 minutes; accessibility=Mixed urban paths and boundary sections; check the route notes and weather; entrance_fee=Free; description=Trace the old burgh boundary and the living Marches tradition through 32 waypoints; website=https://linlithgow.co.uk/perambulation/.',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const vennelParking = updatePractical(featureById('osm-community:way-32087630'), {
  name: 'The Vennel Car Park',
  type: 'parking',
  address: 'The Vennel / Kirkgate, Linlithgow, EH49 7EY',
  description: 'Central pay-and-display parking one minute from The Cross, Burgh Halls and the route to the palace.',
  category: 'parking',
  detail: 'parking=surface; access=public; payment_required=yes; price_display=Pay; payment=coins and PayByPhone; fee=09:00-17:30: £1 up to 2 hours, £2 up to 3 hours, £3 up to 4 hours, £5 all day; Sunday free in council-owned car parks; ev_charging=yes',
  sourceName: 'Linlithgow visitor parking information',
  organisation: 'One Linlithgow / West Lothian Council',
  sourceUrl: 'https://linlithgow.co.uk/parking/',
});
const waterYettParking = updatePractical(featureById('osm-community:way-195407103'), {
  name: 'Water Yett Car Park',
  type: 'parking',
  address: 'Water Yett, Linlithgow, EH49 7EY',
  description: 'Free surface parking beside the loch, play area and public toilet, convenient for the circular walk and palace views.',
  category: 'parking',
  detail: 'parking=surface; access=public; payment_required=no; price_display=Free; capacity=42; ev_charging=yes; opening_hours:description=Open access; observe current signs and any marked resident or medical-practice spaces',
  sourceName: 'Water Yett parking audit',
  organisation: 'West Lothian Council / OpenStreetMap contributors',
  sourceUrl: 'https://www.westlothian.gov.uk/media/59800/EV-Infrastructure-Plan/pdf/West_Lothian_EVI_Plan.pdf',
  reliability: 'local_authority',
});
const stationParking = updatePractical(featureById('osm-community:way-18751664'), {
  name: 'Linlithgow Station car park',
  type: 'parking',
  address: 'Station Road, Linlithgow, EH49 7DH',
  description: 'Free railway-station parking with 96 spaces across the station site, about five minutes from the High Street.',
  category: 'parking',
  detail: 'parking=surface; access=public; payment_required=no; price_display=Free; capacity=96; capacity:disabled=2; cctv=yes; opening_hours=24/7',
  sourceName: 'Linlithgow Station facilities',
  organisation: 'ScotRail',
  sourceUrl: 'https://www.scotrail.co.uk/plan-your-journey/stations-and-facilities/lin',
});
updatePractical(featureById('osm-community:way-209064147'), {
  name: 'Regent Centre shoppers car park',
  type: 'parking',
  address: 'Blackness Road, Linlithgow, EH49 7HU',
  description: 'Free short-stay shoppers parking around seven minutes from The Cross; useful for a brief town-centre visit.',
  category: 'parking',
  detail: 'parking=surface; access=customers; payment_required=no; price_display=Free; maxstay=2 hours; opening_hours:description=Observe the current Regent Centre signs and maximum stay',
  sourceName: 'Linlithgow Burgh Halls visitor information',
  organisation: 'West Lothian Council',
  sourceUrl: 'https://www.linlithgowburghhalls.co.uk/article/72845/Visitor-Information',
  reliability: 'local_authority',
});
const longTermParking = updatePractical(featureById('osm-community:way-209064143'), {
  name: 'Regent Centre long-stay car park',
  type: 'parking',
  address: 'Blackness Road, Linlithgow, EH49 7HU',
  description: 'Long-stay surface parking on the east side of the centre, within an easy walk of the High Street.',
  category: 'parking',
  detail: 'parking=surface; access=public; payment_required=no; price_display=Free; opening_hours:description=Open access; observe current entrance signs and any marked restrictions',
  sourceName: 'Linlithgow parking directory and OpenStreetMap survey',
  organisation: 'One Linlithgow / OpenStreetMap contributors',
  sourceUrl: 'https://linlithgow.co.uk/parking/',
  reliability: 'official_non_statutory',
});

const waterYettToilet = updatePractical(featureById('osm-community:node-2425689741'), {
  name: 'Water Yett automated public toilet',
  type: 'toilets',
  address: 'Water Yett Car Park, Linlithgow, EH49 7EY',
  description: 'Wheelchair-accessible automated public toilet beside Water Yett car park and the loch path.',
  category: 'toilets',
  detail: 'access=public; wheelchair=yes; price_display=Charge applies; opening_hours:description=Automated public convenience; check the door notice for current access and charge',
  sourceName: 'Public Toilet Facilities',
  organisation: 'West Lothian Council',
  sourceUrl: 'https://www.westlothian.gov.uk/toilets',
  reliability: 'local_authority',
});
const burghHallsToilet = upsertFeature(
  curatedPoint(
    'visitor-context:linlithgow-burgh-halls-toilets',
    'Linlithgow Burgh Halls public toilets',
    'toilets',
    [-3.6005554, 55.9774143],
    'Accessible public toilets inside Linlithgow Burgh Halls at The Cross.',
    currentSource(
      'Linlithgow Burgh Halls visitor information',
      'West Lothian Council',
      'visitor-audit:toilets:linlithgow-burgh-halls',
      'https://www.linlithgowburghhalls.co.uk/article/72845/Visitor-Information',
      'Current-place curation: amenity=toilets; name=Linlithgow Burgh Halls public toilets; access=public; price_display=Free; wheelchair=yes; opening_hours:description=Available during Burgh Halls opening, Monday-Sunday 09:00-17:00; description=Accessible public toilets inside the Burgh Halls at The Cross.',
      'local_authority',
    ),
    ['current-context', 'service-context-toilets'],
  ),
);
const tamDalyellToilet = upsertFeature(
  curatedPoint(
    'visitor-context:linlithgow-tam-dalyell-house-toilets',
    'Tam Dalyell House public toilets',
    'toilets',
    [-3.6007769, 55.9766484],
    'Public toilets inside Linlithgow Partnership Centre on the High Street.',
    currentSource(
      'Public Toilet Facilities',
      'West Lothian Council',
      'visitor-audit:toilets:linlithgow-tam-dalyell-house',
      'https://www.westlothian.gov.uk/toilets',
      'Current-place curation: amenity=toilets; name=Tam Dalyell House public toilets; access=public; price_display=Free; opening_hours:description=Available during the partnership centre opening: Monday, Wednesday and Friday 09:00-17:00; Tuesday and Thursday 09:00-19:00; Saturday 10:00-13:00; description=Public toilets inside Linlithgow Partnership Centre on the High Street.',
      'local_authority',
    ),
    ['current-context', 'service-context-toilets'],
  ),
);

const waterYettPicnic = updatePractical(featureById('osm-community:node-11265111759'), {
  name: 'Water Yett lochside picnic tables',
  type: 'picnic_site',
  address: 'Linlithgow Loch Park, beside Water Yett Car Park',
  description: 'Picnic tables beside the play area and loch path at the western end of Linlithgow Loch Park.',
  category: 'picnic',
  detail: 'access=public; price_display=Free; opening_hours:description=Open park; daylight use recommended',
  sourceName: 'Linlithgow Loch Park consultation and OpenStreetMap survey',
  organisation: 'West Lothian Council / OpenStreetMap contributors',
  sourceUrl: 'https://www.westlothian.gov.uk/media/59476/Community-Choices-Linlithgow-Loch-Consultation-Report/pdf/Linlithgow_Loch_Consultation_Report.pdf',
  reliability: 'local_authority',
});
const vennelPicnic = updatePractical(featureById('osm-community:node-2058518872'), {
  name: 'Vennel Gardens loch-view picnic area',
  type: 'picnic_site',
  address: 'Vennel Gardens, Linlithgow',
  description: 'Small picnic area in Vennel Gardens between the High Street and Linlithgow Loch.',
  category: 'picnic',
  detail: 'access=public; price_display=Free; opening_hours:description=Open garden; daylight use recommended',
  sourceName: 'OpenStreetMap current survey',
  organisation: 'OpenStreetMap contributors',
  sourceUrl: 'https://www.openstreetmap.org/node/2058518872',
  reliability: 'discovery_only',
});

curationLibrary.projects[pkg.project.id] = {
  eat: [aran.id, soStrawberry.id, cafe1807.id, barLeo.id, taste.id, crannog.id, hallsCafe.id],
  trails: [heritageTrail.id, lochTrail.id, perambulation.id],
  picnic: [waterYettPicnic.id, vennelPicnic.id],
  parking: [vennelParking.id, waterYettParking.id, stationParking.id, longTermParking.id],
  toilets: [waterYettToilet.id, burghHallsToilet.id, tamDalyellToilet.id],
};

const excludedRecords: Array<[string, string]> = [
  ['osm-community:way-209064147', 'Customer-only Regent Centre shoppers parking is not published as general visitor parking.'],
  ['osm-community:node-192309913', 'Former Vennel public-toilet data is stale; the official facility moved to Tam Dalyell House.'],
  ['osm-community:node-6820230568', 'The palace toilet marker is not on the current West Lothian public-toilet list and is not published as a general town facility.'],
  ['osm-community:node-2058519014', 'Individual table duplicated by the single named Vennel Gardens picnic-area record.'],
  ['osm-community:way-358191344', 'Individual picnic geometry duplicated by the curated Burgh Halls/Rose Garden visitor context.'],
];
for (const [id, reason] of excludedRecords) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) continue;
  addTags(feature, auditTag, 'visitor-audit-excluded', 'map-hidden');
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = `Reviewed on 2026-08-07 and excluded from the public Linlithgow planner. ${reason}`;
}

const activeBoundary = townStudyArea.localityBoundary;
const publishedFeatureIds = [
  ...(pkg.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publishedFeatureIds)) {
  const feature = pkg.features.find((candidate) => candidate.id === featureId);
  if (!feature || feature.geometry?.type !== 'Point') {
    throw new Error(`Linlithgow public visitor feature is missing a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), activeBoundary)) {
    throw new Error(`Linlithgow public visitor feature falls outside the active boundary: ${featureId}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    previous: 3,
    rating: 3,
    rationale:
      'Three stars is retained. Linlithgow Palace, the loch and Peel, St Michael\'s, the High Street, museum and canal make a coherent full-day destination with unusually easy rail access.',
  },
  boundary: {
    active: 'Original NRS 2022 Linlithgow locality, unchanged.',
    rule: 'Every public town-planner marker is inside the active locality polygon.',
  },
  published: {
    attractions: pkg.project.visitorHighlights.map((highlight) => ({
      name: highlight.name,
      score: highlight.visitorScore,
      featureId: highlight.featureId,
    })),
    eat: curationLibrary.projects[pkg.project.id].eat,
    trails: curationLibrary.projects[pkg.project.id].trails,
    picnic: curationLibrary.projects[pkg.project.id].picnic,
    parking: curationLibrary.projects[pkg.project.id].parking,
    toilets: curationLibrary.projects[pkg.project.id].toilets,
  },
  excluded: [
    {
      name: 'House of the Binns, Blackness Castle and Beecraigs Country Park',
      reason: 'Official visitor sources present them as nearby excursions, but they are outside the active Linlithgow locality and excluded from the town planner and rating.',
    },
    {
      name: 'Avon Aqueduct and the longer Visit West Lothian canal walk',
      reason: 'The route leaves the town polygon. The canal centre remains in-town, but the aqueduct is not counted as a Linlithgow town attraction.',
    },
    {
      name: 'Former Vennel and unverified palace toilet markers',
      reason: 'Replaced by the current official West Lothian list: Water Yett, Burgh Halls and Tam Dalyell House.',
    },
    {
      name: 'Private, residents-only and customer-only parking',
      reason: 'Excluded unless current visitor access and restrictions were defensible.',
    },
  ],
  practicalCorrections: {
    parking: 'Four useful public visitor car parks are named and explicitly marked free or paid, with restrictions where known.',
    toilets: 'Stale and duplicate OSM records are replaced by the three currently listed West Lothian public facilities.',
    picnic: 'Individual OSM table nodes are consolidated into two location-led picnic areas.',
  },
  artwork: {
    path: '/town-guides/linlithgow-palace-loch-watercolour-guide.png',
    method: 'Generated as a text-free editorial ink-and-watercolour town guide illustration using the established Townscape Guides visual style.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await copyFile(artworkSource, artworkPath);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Linlithgow: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trails, ${curationLibrary.projects[pkg.project.id].parking.length} car parks, ${curationLibrary.projects[pkg.project.id].toilets.length} toilets and ${curationLibrary.projects[pkg.project.id].picnic.length} picnic areas. Rating: 3 stars.`,
);
