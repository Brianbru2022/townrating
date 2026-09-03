import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/livingston.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/livingston-visitor-audit-2026-08-07.json');
const artworkSource =
  'C:/Users/brian/.codex/generated_images/019fba10-c165-7452-808e-8d335a7365f4/exec-bb095efc-3ff7-4365-9a82-3fec57b67feb.png';
const artworkPath = resolve('public/town-guides/livingston-river-almond-watercolour-guide.png');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};

const reviewedAt = '2026-08-07T00:00:00Z';
const reviewedDate = '2026-08-07';
const auditTag = 'livingston-visitor-audit';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'OpenStreetMap contributors, Open Database Licence.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Livingston feature: ${id}`);
  return feature;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
  feature.tags = feature.tags.filter(
    (tag) => tag !== 'map-hidden' && tag !== 'visitor-audit-excluded',
  );
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
  feature: HeritageFeature,
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
  feature.name = options.name;
  feature.featureType = options.type;
  feature.address = options.address;
  feature.shortDescription = options.description;
  addTags(
    feature,
    'current-context',
    'service-context-heritage',
    'service-context-visitor',
    auditTag,
  );
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
    type: 'cafe' | 'restaurant' | 'pub';
    description: string;
    score: number;
    tagline: string;
    opening: string;
    price: string;
    cuisine: string;
    website: string;
    organisation: string;
    reliability?: SourceRecord['reliability'];
  },
): HeritageFeature {
  if (options.name) feature.name = options.name;
  feature.featureType = options.type;
  feature.shortDescription = options.description;
  addTags(feature, 'current-context', 'service-context-food', 'visitor-context-food', auditTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${feature.name} visitor information`,
      options.organisation,
      `visitor-audit:food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.type === 'cafe' ? 'cafe' : 'restaurant'}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}.`,
      options.reliability,
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
  rating: 1,
  label: 'Local detour',
  summary:
    'Livingston remains a one-star visitor town. Almond Valley is a substantial family attraction and the designer outlet is a genuine regional draw; public art, the pioneering skatepark, River Almond parks and Livingston Village add rewarding specialist layers. The offer is dispersed rather than a coherent destination centre, and Five Sisters Zoo, Almondell and Calderwood, Jupiter Artland and other places marketed as near Livingston sit outside the active town polygon and do not inflate the rating.',
};

pkg.project.visualIdentity = {
  theme: 'river-almond-new-town-and-village',
  badgeImage: '/town-guides/livingston-river-almond-watercolour-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of the River Almond, historic mill buildings and public art in Livingston',
  heroImage: '/town-guides/livingston-river-almond-watercolour-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of the River Almond, historic mill buildings and public art in Livingston',
  heroObjectPosition: '52% 50%',
  primaryColour: '#17464A',
  accentColour: '#B47728',
  backgroundColour: '#EDF5E9',
  motifs: ['Almond Valley', 'Public art', 'New-town story', 'River parks'],
};

pkg.project.townGuide = {
  headline: 'Family heritage, bold public art and green routes through a new-town story',
  intro:
    "Livingston rewards visitors who look beyond the shopping centre. Almond Valley turns the area's farm and shale-oil past into an absorbing family day out, while the listed Livi skatepark and a remarkable collection of public art reveal the ambition of Scotland's post-war new towns. The River Almond links parks and paths through the centre, and Livingston Village preserves an older Main Street of cottages and a historic inn.",
  bestFor: ['Family days out', 'Shopping breaks', 'Public art', 'Easy green walks'],
  perfectFor: [
    'A family day at Almond Valley',
    "Visitors curious about Scotland's new towns",
    'Combining outlet shopping with a park or public-art walk',
  ],
  suggestedFirstVisit: {
    title: 'Almond Valley, then the town-centre art trail',
    summary:
      'Give Almond Valley the larger part of the day, then use the self-guided public-art walk around Almondvale and Howden to see the skatepark, civic centre and sculptures that make Livingston distinctive.',
  },
  dontMiss: [
    'Almond Valley Heritage Centre',
    'Livingston Public Art Walk',
    "Livingston 'Livi' Skatepark",
  ],
  suggestedTime: 'Half day to full day',
  visitorMood:
    'Best for families, shoppers and visitors interested in post-war design who enjoy finding unexpected heritage among parks, paths and modern civic spaces.',
  sourceUrls: [
    'https://www.visitwestlothian.co.uk/explore/livingston/',
    'https://www.almondvalley.co.uk/plan-your-visit/prices-and-times/',
    'https://livingston-designer-outlet.co.uk/plan-your-visit-to-livingston',
    'https://www.westlothian.gov.uk/almondvalepark',
    'https://www.westlothian.gov.uk/media/5349/Livingston-Public-Art-Walk-Map/pdf/Livingston_Public_Art_Walk_Map.pdf',
    'https://portal.historicenvironment.scot/designation/LB52626',
    'https://www.livingmemory.org.uk/westLothian.php',
    'https://www.westlothian.gov.uk/article/34238/Eliburn-Park',
    'https://www.westlothian.gov.uk/toilets',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Livingston town study area is missing');
delete townStudyArea.visitorBoundary;
townStudyArea.notes =
  'The active visitor boundary is the original NRS 2022 Livingston locality, preserved unchanged and including Livingston Village. Every public town-planner marker is validated inside it. Five Sisters Zoo, Almondell and Calderwood Country Park, Jupiter Artland and other wider-area attractions are outside the locality and excluded from the town planner and rating.';

const auditResearchNote =
  ' Visitor audit 2026-08-07: the original NRS 2022 Livingston locality remains the active boundary and includes Livingston Village; all public planner records were point-checked inside it.';
const researchNotes = pkg.project.researchNotes ?? '';
if (!researchNotes.includes(auditResearchNote.trim())) {
  pkg.project.researchNotes = `${researchNotes.trim()}${auditResearchNote}`;
}

const almondValley = updateAttraction(featureById('osm-community:way-244075641'), {
  name: 'Almond Valley Heritage Centre',
  type: 'museum_and_family_attraction',
  address: 'Millfield, Livingston, EH54 7AR',
  description:
    "A full family day of farm animals, indoor and outdoor play, historic mill buildings and Scotland's nationally important shale-oil story beside the River Almond.",
  score: 86,
  opening:
    'Daily 10:00-17:00; last entry 16:00 for non-members and 16:30 for members. Closed 25-26 December and 1-2 January.',
  admission:
    'Paid admission with dynamic online pricing; check the official booking page before visiting.',
  time: '3-5 hours',
  accessibility:
    'Most visitor areas are accessible, but the historic site includes varied outdoor surfaces; check the current access guide for specific needs.',
  website: 'https://www.almondvalley.co.uk/plan-your-visit/prices-and-times/',
  organisation: 'Almond Valley Heritage Trust',
});

const designerOutlet = updateAttraction(
  upsertFeature(
    curatedPoint(
      'visitor-context:livingston-designer-outlet',
      'Livingston Designer Outlet',
      'shopping_destination',
      [-3.52175, 55.88282],
      "Scotland's largest designer outlet combines more than 80 stores with restaurants, a cinema, adventure golf and a broad indoor leisure offer.",
      currentSource(
        'Livingston Designer Outlet visitor information',
        'Livingston Designer Outlet',
        'visitor-audit:attraction:livingston-designer-outlet',
        'https://livingston-designer-outlet.co.uk/plan-your-visit-to-livingston',
        'Current-place curation: curated visitor destination within the Livingston locality.',
      ),
      ['current-context', 'service-context-visitor'],
    ),
  ),
  {
    name: 'Livingston Designer Outlet',
    type: 'shopping_destination',
    address: 'Almondvale Avenue, Livingston, EH54 6QX',
    description:
      "Scotland's largest designer outlet combines more than 80 stores with restaurants, a cinema, adventure golf and a broad indoor leisure offer.",
    score: 81,
    opening:
      'Monday-Wednesday, Friday and Saturday 09:00-18:00; Thursday 09:00-20:00; Sunday 10:00-18:00. Restaurant and leisure hours vary.',
    admission: 'Free entry; individual shopping, dining and leisure costs apply.',
    time: '2-4 hours',
    accessibility:
      'Step-free centre with 77 disabled spaces, accessible toilets, a Changing Places facility and free wheelchair hire.',
    website: 'https://livingston-designer-outlet.co.uk/plan-your-visit-to-livingston',
    organisation: 'Livingston Designer Outlet',
  },
);

const publicArt = updateAttraction(
  upsertFeature(
    curatedPoint(
      'visitor-context:livingston-almondvale-public-art',
      'Almondvale Park and Livingston Public Art',
      'public_art_and_park',
      [-3.51145, 55.88772],
      "A free central green corridor and self-guided sculpture trail that makes Livingston's ambitious new-town design visible on foot.",
      currentSource(
        'Livingston Public Art Walk and Almondvale Park',
        'West Lothian Council',
        'visitor-audit:attraction:livingston-public-art',
        'https://www.westlothian.gov.uk/media/5349/Livingston-Public-Art-Walk-Map/pdf/Livingston_Public_Art_Walk_Map.pdf',
        'Current-place curation: public art and park destination inside the active locality.',
        'local_authority',
      ),
      ['current-context', 'service-context-visitor', 'visitor-context-art'],
    ),
  ),
  {
    name: 'Almondvale Park and Livingston Public Art',
    type: 'public_art_and_park',
    address: 'Almondvale and Howden, Livingston',
    description:
      "Follow the River Almond through a free central park and a striking collection of sculptures created for Livingston's post-war new-town landscape.",
    score: 78,
    opening: 'Open-air park and public-art route; visit in daylight.',
    admission: 'Free.',
    time: '90-120 minutes',
    accessibility:
      'The central park has surfaced paths; the full 5.63 km art route includes streets, crossings and some gradients.',
    website:
      'https://www.westlothian.gov.uk/media/5349/Livingston-Public-Art-Walk-Map/pdf/Livingston_Public_Art_Walk_Map.pdf',
    organisation: 'West Lothian Council',
    reliability: 'local_authority',
  },
);

const skatepark = updateAttraction(featureById('hes-listed-building:LB52626'), {
  name: "Livingston 'Livi' Skatepark",
  type: 'listed_skatepark',
  address: 'Almondside, Livingston, EH54 6QU',
  description:
    "Scotland's earliest surviving purpose-built skatepark is both an active place to ride and a rare listed landmark of international skate culture.",
  score: 72,
  opening: 'Outdoor skatepark with open access; daylight use is most appropriate.',
  admission: 'Free.',
  time: '30-60 minutes to look around; longer if skating',
  accessibility:
    'Level approach from Almondside; the concrete skating surface is designed for active use.',
  website:
    'https://portal.historicenvironment.scot/apex/f?p=1505:300:::::VIEWTYPE,VIEWREF:designation,LB52626',
  organisation: 'Historic Environment Scotland',
  reliability: 'official_statutory',
});

const livingstonVillage = updateAttraction(
  upsertFeature(
    curatedPoint(
      'visitor-context:livingston-village-historic-core',
      'Livingston Village historic core',
      'historic_village',
      [-3.53942, 55.88572],
      'The original village survives as a conservation-area Main Street of cottages, the 1760 Livingston Inn and a quieter pre-new-town identity.',
      currentSource(
        'Livingston visitor guide',
        'Visit West Lothian',
        'visitor-audit:attraction:livingston-village',
        'https://www.visitwestlothian.co.uk/explore/livingston/',
        'Current-place curation: historic village core inside the NRS Livingston locality.',
        'official_non_statutory',
      ),
      ['current-context', 'service-context-visitor', 'visitor-context-heritage'],
    ),
  ),
  {
    name: 'Livingston Village historic core',
    type: 'historic_village',
    address: 'Main Street, Livingston Village, EH54 7AF',
    description:
      "See the town before the new town: a short conservation-area wander past miners' cottages and the 1760 inn associated with Robert Burns.",
    score: 66,
    opening: 'Public streets with open access; visit in daylight.',
    admission: 'Free.',
    time: '30-45 minutes',
    accessibility:
      'Main Street pavements and public roads; historic premises have their own access arrangements.',
    website: 'https://www.visitwestlothian.co.uk/explore/livingston/',
    organisation: 'Visit West Lothian',
  },
);

const weeMuseum = updateAttraction(featureById('osm-community:node-10090364864'), {
  name: 'The Wee Museum of Memory',
  type: 'museum',
  address: 'The Centre, Almondvale Boulevard, Livingston, EH54 6HR',
  description:
    'A small, friendly museum of everyday Scottish objects and shared memories, offering an unexpectedly personal pause inside the town centre.',
  score: 64,
  opening:
    'Tuesday-Saturday 11:00-15:00; volunteer availability can cause short-notice changes, so check before a special journey.',
  admission: 'Free.',
  time: '30-45 minutes',
  accessibility: 'Level indoor shopping-centre access.',
  website: 'https://www.livingmemory.org.uk/westLothian.php',
  organisation: 'Living Memory Association',
});

const eliburn = updateAttraction(
  upsertFeature(
    curatedPoint(
      'visitor-context:livingston-eliburn-park',
      'Eliburn Park and Reservoir',
      'park',
      [-3.55107, 55.89484],
      'A relaxed local park combining reservoir views, woodland, wildlife, play space and short surfaced circuits.',
      currentSource(
        'Eliburn Park visitor information',
        'West Lothian Council',
        'visitor-audit:attraction:livingston-eliburn',
        'https://www.westlothian.gov.uk/article/34238/Eliburn-Park',
        'Current-place curation: public park inside the active Livingston locality.',
        'local_authority',
      ),
      ['current-context', 'service-context-visitor', 'visitor-context-park'],
    ),
  ),
  {
    name: 'Eliburn Park and Reservoir',
    type: 'park',
    address: 'Eliburn Park, Livingston',
    description:
      'Take an easy waterside pause among woodland and wildlife, with surfaced paths, a play area and a choice of short circuits around the reservoir.',
    score: 62,
    opening: 'Open park; visit in daylight.',
    admission: 'Free.',
    time: '45-90 minutes',
    accessibility: 'Surfaced paths around the reservoir; gradients and woodland links vary.',
    website: 'https://www.westlothian.gov.uk/article/34238/Eliburn-Park',
    organisation: 'West Lothian Council',
    reliability: 'local_authority',
  },
);

const livingstonHighlights = [
  [almondValley, 86, 'Family heritage day', false, false],
  [designerOutlet, 81, 'Shopping and leisure', true, true],
  [publicArt, 78, 'New-town art trail', true, true],
  [skatepark, 72, 'Skate-culture landmark', true, true],
  [livingstonVillage, 66, 'Original village', true, false],
  [weeMuseum, 64, 'Everyday memories', true, false],
  [eliburn, 62, 'Reservoir and woodland', true, false],
].map(([feature, score, tagline, freeAdmission, homeMapEligible], index) => {
  const item = feature as HeritageFeature;
  const source = item.sourceRecords.at(-1);
  const notes = source?.notes ?? '';
  const openingTimes = notes.match(
    /opening_hours:description=([^;]+(?:; (?!entrance_fee=)[^;]+)*)/,
  )?.[1];
  const admission = notes.match(/entrance_fee=([^;]+)/)?.[1];
  return {
    rank: index + 1,
    featureId: item.id,
    name: item.name,
    reason: item.shortDescription ?? '',
    tagline: tagline as string,
    visitorScore: score as number,
    openingTimes,
    admission,
    freeAdmission: freeAdmission as boolean,
    homeMapEligible: homeMapEligible as boolean,
    sourceName: source?.sourceName ?? 'Livingston visitor audit',
    sourceUrl: source?.sourceUrl ?? 'https://www.visitwestlothian.co.uk/explore/livingston/',
    verifiedInBoundaryAt: reviewedDate,
  };
});
pkg.project.visitorHighlights = livingstonHighlights;

const livingstonInn = updateFood(featureById('hes-listed-building:LB7413'), {
  name: 'The Livingston Inn',
  type: 'pub',
  description:
    'A refurbished 1760 village inn for traditional pub classics, grills and a drink in the oldest-feeling part of Livingston.',
  score: 81,
  tagline: 'Historic village inn',
  opening:
    'Food service varies by day; check the current menu or telephone before travelling specifically for a meal.',
  price: '££',
  cuisine: 'modern British and traditional pub food',
  website: 'https://thelivingstoninn.co.uk/',
  organisation: 'The Livingston Inn',
});

const cafe1962 = updateFood(
  upsertFeature(
    curatedPoint(
      'curated-food:livingston-cafebar-1962',
      'Cafebar 1962',
      'cafe',
      [-3.52145, 55.88258],
      'A lively all-day outlet cafe-bar with butcher-supplied food, house baking, coffee, cocktails and regular free live music.',
      currentSource(
        'Cafebar 1962 store information',
        'Livingston Designer Outlet',
        'visitor-audit:food:livingston-cafebar-1962',
        'https://livingston-designer-outlet.co.uk/stores/cafebar-1962',
        'Current-place curation: official outlet listing for current food and entertainment.',
      ),
      ['current-context', 'service-context-food', 'visitor-context-food'],
    ),
  ),
  {
    type: 'cafe',
    description:
      'A lively all-day outlet cafe-bar with butcher-supplied food, house baking, coffee, cocktails and regular free live music.',
    score: 80,
    tagline: 'Food and live music',
    opening:
      "Open daily; hours can extend beyond outlet shopping times. Check the current store page for today's service.",
    price: '££',
    cuisine: 'cafe-bar food and home baking',
    website: 'https://livingston-designer-outlet.co.uk/stores/cafebar-1962',
    organisation: 'Cafebar 1962 / Livingston Designer Outlet',
  },
);

const oscars = updateFood(featureById('osm-community:node-7147338914'), {
  name: 'Oscars Pizza Pasta Burgers',
  type: 'restaurant',
  description:
    'A family-run neighbourhood restaurant for handmade pizza, pasta and burgers, useful for an informal evening meal away from the shopping malls.',
  score: 76,
  tagline: 'Family Italian-American',
  opening: 'Monday-Friday 17:00-22:00; Saturday-Sunday 12:00-22:00.',
  price: '££',
  cuisine: 'pizza pasta and burgers',
  website: 'https://oscarsbarandgrill.com/',
  organisation: 'Oscars Pizza Pasta Burgers',
});

const reconnectKitchen = updateFood(
  upsertFeature(
    curatedPoint(
      'curated-food:livingston-kitchen-reconnect',
      'The Kitchen at Reconnect',
      'cafe',
      [-3.51275, 55.88855],
      'A park-side arts-centre cafe for breakfast, lunch, cakes and a quieter pause beside Howden Park and the public-art route.',
      currentSource(
        'The Kitchen at Reconnect food and drink information',
        'Reconnect Theatres',
        'visitor-audit:food:livingston-kitchen-reconnect',
        'https://www.reconnecttheatres.com/howden-park/the-bar/',
        'Current-place curation: official venue food-and-drink information.',
      ),
      ['current-context', 'service-context-food', 'visitor-context-food'],
    ),
  ),
  {
    type: 'cafe',
    description:
      'A park-side arts-centre cafe for breakfast, lunch, cakes and a quieter pause beside Howden Park and the public-art route.',
    score: 74,
    tagline: 'Park-side cafe',
    opening:
      'Monday-Saturday 10:00-16:00; Sunday 11:00-15:00. Pre-theatre service operates on selected show nights.',
    price: '££',
    cuisine: 'breakfast lunch salads and cakes',
    website: 'https://www.reconnecttheatres.com/howden-park/the-bar/',
    organisation: 'Reconnect Theatres',
  },
);

const topiary = updateFood(featureById('osm-community:way-214810944'), {
  name: 'Topiary Coffee Shop',
  type: 'cafe',
  description:
    'A bright garden-centre cafe with cooked breakfasts, homemade lunches, scones and cakes, plus easy access and free customer parking.',
  score: 72,
  tagline: 'Homemade cafe food',
  opening:
    'Monday-Saturday 09:00-16:30; Sunday 10:00-16:30; last food orders 16:00. Closed 25-26 December and 1 January.',
  price: '££',
  cuisine: 'breakfast lunch and home baking',
  website: 'https://www.klondyke.co.uk/store-locator/klondyke-garden-centre-livingston/',
  organisation: 'Klondyke Garden Centre',
});

const publicArtTrail = upsertFeature(
  curatedPoint(
    'visitor-context:livingston-public-art-walk',
    'Livingston Public Art Walk',
    'walking_route',
    [-3.51131, 55.88745],
    "A self-guided 5.63 km route through Livingston's distinctive new-town sculptures, civic spaces and River Almond landscape.",
    currentSource(
      'Livingston Public Art Walk map',
      'West Lothian Council',
      'visitor-audit:trail:livingston-public-art-walk',
      'https://www.westlothian.gov.uk/media/5349/Livingston-Public-Art-Walk-Map/pdf/Livingston_Public_Art_Walk_Map.pdf',
      "Current-place curation: route=walking; name=Livingston Public Art Walk; visit_score=86; distance=5.63 km; time_to_spend=Approximately 1 hour 45 minutes; accessibility=Urban paths, park routes and road crossings with some gradients; entrance_fee=Free; description=Explore the strongest concentration of Livingston's new-town public art on a signed self-guided route; website=https://www.westlothian.gov.uk/media/5349/Livingston-Public-Art-Walk-Map/pdf/Livingston_Public_Art_Walk_Map.pdf.",
      'local_authority',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const howdenTrail = upsertFeature(
  curatedPoint(
    'visitor-context:livingston-howden-heritage-walk',
    'Howden Heritage Walk',
    'walking_route',
    [-3.51325, 55.88878],
    "A compact route linking Howden Park, the listed skatepark, River Almond paths, civic buildings and Livingston's new-town story.",
    currentSource(
      'Howden Long Route',
      'West Lothian Council',
      'visitor-audit:trail:livingston-howden-heritage-walk',
      'https://www.westlothian.gov.uk/article/78923/Howden-Long-Route',
      'Current-place curation: route=walking; name=Howden Heritage Walk; visit_score=78; distance=3.2 km; time_to_spend=Approximately 55 minutes; accessibility=Mostly urban park paths and pavements with crossings; entrance_fee=Free; description=Link the skatepark, stadium, River Almond and Howden Park in one concise new-town heritage circuit; website=https://www.westlothian.gov.uk/article/78923/Howden-Long-Route.',
      'local_authority',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const muriestonTrail = upsertFeature(
  curatedPoint(
    'visitor-context:livingston-murieston-trail',
    'Murieston Trail',
    'walking_route',
    [-3.50134, 55.87186],
    'A 4 km south-Livingston circuit from the railway station through Murieston woodland, Campbridge Pond and neighbourhood green space.',
    currentSource(
      'Murieston Trail',
      'West Lothian Council',
      'visitor-audit:trail:livingston-murieston-trail',
      'https://www.westlothian.gov.uk/article/78927/Murieston-Trail',
      'Current-place curation: route=walking; name=Murieston Trail; visit_score=74; distance=4 km; time_to_spend=Approximately 60 minutes; accessibility=Mixed surfaced neighbourhood paths and woodland sections; entrance_fee=Free; description=An easy local circuit through woodland and pond-side green space from Livingston South; website=https://www.westlothian.gov.uk/article/78927/Murieston-Trail.',
      'local_authority',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const almondValleyParking = updatePractical(featureById('osm-community:way-129460986'), {
  name: 'Almond Valley visitor car park',
  type: 'parking',
  address: 'Millfield, Livingston, EH54 7AR',
  description: 'Free on-site surface parking for Almond Valley visitors.',
  category: 'parking',
  detail:
    'parking=surface; access=customers; payment_required=no; price_display=Free; opening_hours:description=Available during Almond Valley opening hours',
  sourceName: 'Almond Valley visitor information',
  organisation: 'Almond Valley Heritage Trust',
  sourceUrl: 'https://www.almondvalley.co.uk/plan-your-visit/prices-and-times/',
});

const outletParking = updatePractical(featureById('osm-community:way-176819736'), {
  name: 'Livingston Designer Outlet multi-storey car park',
  type: 'parking',
  address: 'Almondvale Avenue, Livingston, EH54 6QX',
  description:
    "The outlet's main 1,500-space multi-storey car park, with disabled, parent-and-child and EV spaces.",
  category: 'parking',
  detail:
    'parking=multi-storey; access=public; payment_required=yes; price_display=Pay; capacity=1500; fee=50p per hour; payment=pay on foot; ev_charging=yes',
  sourceName: 'Livingston Designer Outlet parking',
  organisation: 'Livingston Designer Outlet',
  sourceUrl: 'https://livingston-designer-outlet.co.uk/parking',
});

const centreParking = updatePractical(featureById('osm-community:way-44000111'), {
  name: 'The Centre Livingston car park',
  type: 'parking',
  address: 'Almondvale Boulevard, Livingston, EH54 6HR',
  description:
    "One of The Centre's linked town-centre car parks, useful for the shops, Wee Museum and Almondvale Park.",
  category: 'parking',
  detail:
    'parking=multi-storey; access=public; payment_required=yes; price_display=Pay; capacity:site_total=2116; fee=50p per hour up to £6 for 24 hours; opening_hours:description=08:00-midnight; charging hours 08:00-18:00; free after 18:00',
  sourceName: 'The Centre parking information',
  organisation: 'The Centre Livingston',
  sourceUrl: 'https://thecentrelivingston.com/parking/',
});

const eliburnParking = updatePractical(featureById('osm-community:way-543190593'), {
  name: 'Eliburn Park visitor car park',
  type: 'parking',
  address: 'Eliburn Park Pavilion, Livingston',
  description: 'Free surface parking beside Eliburn Park, the reservoir and play area.',
  category: 'parking',
  detail:
    'parking=surface; access=public; payment_required=no; price_display=Free; opening_hours:description=Open access; observe current signs and any pavilion restrictions',
  sourceName: 'Eliburn Park visitor information',
  organisation: 'West Lothian Council',
  sourceUrl: 'https://www.westlothian.gov.uk/article/34238/Eliburn-Park',
  reliability: 'local_authority',
});

const howdenParking = updatePractical(featureById('osm-community:way-150079217'), {
  name: 'Howden Park Centre visitor car park',
  type: 'parking',
  address: 'Howden Park Centre, Livingston, EH54 6AE',
  description:
    'Venue parking beside Howden Park, the public-art walk and The Kitchen at Reconnect.',
  category: 'parking',
  detail:
    'parking=surface; access=customers; payment_required=no; price_display=Free for venue users; capacity:site_total=115; restriction=Register at the venue before 18:00 on weekdays; free after 18:00 and at weekends; observe current signs',
  sourceName: 'Howden Park Centre visitor information',
  organisation: 'Reconnect Theatres',
  sourceUrl: 'https://www.howdenparkcentre.co.uk/',
});

const southStationToilet = updatePractical(featureById('osm-community:node-251319369'), {
  name: 'Livingston South station automated public toilet',
  type: 'toilets',
  address: 'Livingston South railway station, Murieston',
  description:
    'Automated public convenience at Livingston South station and the start of the Murieston Trail.',
  category: 'toilets',
  detail:
    'access=public; price_display=Charge may apply; opening_hours:description=Automated public convenience; check the door notice for current access',
  sourceName: 'Public Toilet Facilities',
  organisation: 'West Lothian Council',
  sourceUrl: 'https://www.westlothian.gov.uk/toilets',
  reliability: 'local_authority',
});

const almondbankToilet = updatePractical(featureById('osm-community:node-2280121671'), {
  name: 'Almondbank Library public toilets',
  type: 'toilets',
  address: 'Almondbank Library, Craigshill, Livingston',
  description: 'Public toilets inside Almondbank Library in Craigshill.',
  category: 'toilets',
  detail:
    'access=public; price_display=Free; opening_hours:description=Available during current library opening hours',
  sourceName: 'Public Toilet Facilities',
  organisation: 'West Lothian Council',
  sourceUrl: 'https://www.westlothian.gov.uk/toilets',
  reliability: 'local_authority',
});

const northPartnershipToilet = updatePractical(featureById('osm-community:node-2466788799'), {
  name: 'Livingston North Partnership Centre public toilets',
  type: 'toilets',
  address: 'Livingston North Partnership Centre, Carmondean',
  description: 'Public toilets inside the partnership centre beside Carmondean Library.',
  category: 'toilets',
  detail:
    'access=public; price_display=Free; opening_hours:description=Available during current partnership-centre opening hours',
  sourceName: 'Public Toilet Facilities',
  organisation: 'West Lothian Council',
  sourceUrl: 'https://www.westlothian.gov.uk/toilets',
  reliability: 'local_authority',
});

const outletToilet = upsertFeature(
  curatedPoint(
    'visitor-context:livingston-designer-outlet-toilets',
    'Livingston Designer Outlet public toilets',
    'toilets',
    [-3.5209, 55.88262],
    'Three sets of public toilets inside the outlet, including accessible, family and Changing Places facilities.',
    currentSource(
      'Livingston Designer Outlet guest services',
      'Livingston Designer Outlet',
      'visitor-audit:toilets:livingston-designer-outlet',
      'https://livingston-designer-outlet.co.uk/guest-services',
      'Current-place curation: amenity=toilets; name=Livingston Designer Outlet public toilets; access=public; price_display=Free; wheelchair=yes; changing_places=yes; opening_hours:description=Available during outlet opening hours; description=Three sets of public toilets inside the outlet, including accessible, family and Changing Places facilities.',
    ),
    ['current-context', 'service-context-toilets'],
  ),
);

const centreToilet = upsertFeature(
  curatedPoint(
    'visitor-context:livingston-centre-toilets',
    'The Centre Livingston public toilets',
    'toilets',
    [-3.51072, 55.8842],
    'Public toilets within The Centre, convenient for the shops, Wee Museum and Almondvale Park.',
    currentSource(
      'The Centre visitor facilities',
      'The Centre Livingston',
      'visitor-audit:toilets:livingston-centre',
      'https://thecentrelivingston.com/centre-info/accessibility/',
      'Current-place curation: amenity=toilets; name=The Centre Livingston public toilets; access=public; price_display=Free; wheelchair=yes; opening_hours:description=Available during centre opening hours; description=Public toilets within The Centre, convenient for the shops, Wee Museum and Almondvale Park.',
    ),
    ['current-context', 'service-context-toilets'],
  ),
);

const eliburnPicnic = updatePractical(featureById('osm-community:node-943038192'), {
  name: 'Eliburn Reservoir picnic area',
  type: 'picnic_site',
  address: 'Eliburn Park, beside the reservoir',
  description: 'Picnic tables beside the reservoir, play area and surfaced park paths.',
  category: 'picnic',
  detail:
    'access=public; price_display=Free; opening_hours:description=Open park; daylight use recommended',
  sourceName: 'Eliburn Park visitor information and OpenStreetMap survey',
  organisation: 'West Lothian Council / OpenStreetMap contributors',
  sourceUrl: 'https://www.westlothian.gov.uk/article/34238/Eliburn-Park',
  reliability: 'local_authority',
});

const howdenPicnic = updatePractical(featureById('osm-community:node-9162440017'), {
  name: 'Howden Park picnic tables',
  type: 'picnic_site',
  address: 'Howden Park, near Howden Park Centre',
  description: 'Picnic tables in Howden Park beside the public-art and heritage walking routes.',
  category: 'picnic',
  detail:
    'access=public; price_display=Free; opening_hours:description=Open park; daylight use recommended',
  sourceName: 'Howden Park OpenStreetMap survey and heritage route',
  organisation: 'West Lothian Council / OpenStreetMap contributors',
  sourceUrl: 'https://www.westlothian.gov.uk/article/78923/Howden-Long-Route',
  reliability: 'local_authority',
});

curationLibrary.projects[pkg.project.id] = {
  eat: [livingstonInn.id, cafe1962.id, oscars.id, reconnectKitchen.id, topiary.id],
  trails: [publicArtTrail.id, howdenTrail.id, muriestonTrail.id],
  picnic: [eliburnPicnic.id, howdenPicnic.id],
  parking: [outletParking.id, centreParking.id, eliburnParking.id],
  toilets: [
    southStationToilet.id,
    almondbankToilet.id,
    northPartnershipToilet.id,
    outletToilet.id,
    centreToilet.id,
  ],
};

const excludedRecords: Array<[string, string]> = [
  [
    almondValleyParking.id,
    'This is customer-only attraction parking and is therefore kept in the research data but excluded from the public parking category.',
  ],
  [
    howdenParking.id,
    'This is venue-user parking with registration restrictions and is therefore kept in the research data but excluded from the public parking category.',
  ],
  [
    'nrhe:275507',
    'The Scottish Shale Oil Museum is part of Almond Valley and is not published as a separate ranked visitor attraction.',
  ],
  [
    'osm-community:node-9162440018',
    'Individual Howden Park table duplicated by the single location-led Howden Park picnic entry.',
  ],
];
for (const [id, reason] of excludedRecords) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) continue;
  feature.tags = [...new Set([...feature.tags, auditTag, 'visitor-audit-excluded'])];
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = `Reviewed on 2026-08-07 and excluded from the public Livingston planner. ${reason}`;
}

const activeBoundary = townStudyArea.localityBoundary;
const publishedFeatureIds = [
  ...(pkg.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publishedFeatureIds)) {
  const feature = pkg.features.find((candidate) => candidate.id === featureId);
  if (!feature || feature.geometry?.type !== 'Point') {
    throw new Error(`Livingston public visitor feature is missing a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), activeBoundary)) {
    throw new Error(
      `Livingston public visitor feature falls outside the active boundary: ${featureId}`,
    );
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    previous: 1,
    rating: 1,
    rationale:
      'One star is retained. Almond Valley, outlet shopping, public art, the listed skatepark, parks and Livingston Village provide a worthwhile specialist visit, but the offer is dispersed and does not make Livingston a coherent destination town.',
  },
  boundary: {
    active: 'Original NRS 2022 Livingston locality, unchanged and including Livingston Village.',
    rule: 'Every public town-planner marker is a point inside the active locality polygon.',
  },
  published: {
    attractions: livingstonHighlights.map((highlight) => ({
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
      name: 'Five Sisters Zoo, Almondell and Calderwood Country Park, Jupiter Artland and Dechmont Law summit',
      reason:
        'These are valid wider-area attractions or walks but lie outside the active Livingston locality and do not count in the town planner or rating.',
    },
    {
      name: 'Scottish Shale Oil Museum as a separate attraction',
      reason:
        'The museum is included within the Almond Valley visit and was removed as a duplicate ranked place.',
    },
    {
      name: 'Raw mall toilet and parking nodes',
      reason:
        'Consolidated into named destination-level records so the public planner does not expose duplicate or anonymous OSM points.',
    },
  ],
  practicalCorrections: {
    parking:
      'Three genuinely public visitor car parks are named and marked free or paid. Customer-only Almond Valley and Howden Park Centre parking remain in the evidence but are excluded from the public parking category.',
    toilets: 'Five location-led facilities replace generic and duplicate OSM toilet names.',
    picnic: 'Individual table nodes are consolidated into Eliburn Reservoir and Howden Park areas.',
  },
  artwork: {
    path: '/town-guides/livingston-river-almond-watercolour-guide.png',
    method:
      'Generated as a text-free editorial ink-and-watercolour guide illustration in the established Townscape Guides style.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await copyFile(artworkSource, artworkPath);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Livingston: ${livingstonHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trails, ${curationLibrary.projects[pkg.project.id].parking.length} car parks, ${curationLibrary.projects[pkg.project.id].toilets.length} toilets and ${curationLibrary.projects[pkg.project.id].picnic.length} picnic areas. Rating: 1 star.`,
);
