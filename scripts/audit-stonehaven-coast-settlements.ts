import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const reviewedDate = '2026-08-27';
const reviewedAt = `${reviewedDate}T18:00:00Z`;
const methodVersion = '2026-08-13-researched-visitor-value-v1';
const settlementMethod = '2026-08-27-strict-settlement-visitor-gate-v1';

const methodology = {
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
};

const urls = {
  stonehaven: 'https://visitabdn.com/places/stonehaven',
  stonehavenCoast: 'https://visitabdn.com/places/stonehaven-the-mearns',
  harbour: 'https://visitabdn.com/businesses/stonehaven-harbour',
  pool: 'https://www.stonehavenopenairpool.co.uk/',
  poolOfficial:
    'https://livelifeaberdeenshire.org.uk/sport-and-physical-activity/venues/stonehaven-open-air-swimming-pool/',
  poolTimetable:
    'https://www.stunningstonehaven.com/home/news/read/the-stonehaven-open-air-pool-opens-this-weekend-30-may_1561',
  tolbooth: 'https://stonehaventolbooth.co.uk/',
  tolboothHes: 'https://portal.historicenvironment.scot/designation/LB41655',
  sundialHes: 'https://portal.historicenvironment.scot/designation/LB41656',
  parking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  ship: 'https://visitabdn.com/businesses/the-ship-inn',
  shipBar: 'https://shipinnstonehaven.com/lounge-bar/',
  treasure: 'https://www.treasuretrails.co.uk/products/what-to-do-stonehaven-aberdeenshire',
  castle: 'https://www.dunnottarcastle.co.uk/',
  castleBook: 'https://www.dunnottarcastle.co.uk/book-now',
  castleAccess: 'https://www.dunnottarcastle.co.uk/accessibility',
  castleFacilities: 'https://www.dunnottarcastle.co.uk/faciltities',
  castleHes: 'https://portal.historicenvironment.scot/designation/SM986',
  kirktownHistory: 'https://www.fetteresso.org.uk/welcome/our-local-history',
  kirktownHesContext: 'https://portal.historicenvironment.scot/designation/LB41576',
  kirktownVisit: 'https://www.britainexpress.com/attractions.htm?attraction=5031',
  catterlineArt:
    'https://www.nationalgalleries.org/art-and-artists/features/joan-eardley-land-sea-life-catterline-patrick-elliott',
  catterlinePainting:
    'https://www.nationalgalleries.org/art-and-artists/496/sea-and-snow-catterline',
  catterlineHes: 'https://portal.historicenvironment.scot/designation/LB9511',
  creel: 'https://www.creelinn.co.uk/contact',
  creelDog: 'https://camra.org.uk/pubs/creel-inn-catterline-112810',
  coastalTrail: 'https://www.visitabdn.com/assets/Uploads/aberdeenshire-coastal-trail2.pdf',
  fowlsheugh: 'https://www.rspb.org.uk/days-out/reserves/fowlsheugh',
  fowlsheughCharges: 'https://www.rspb.org.uk/days-out/reserves/fowlsheugh/charges',
  fowlsheughLocal:
    'https://group.rspb.org.uk/aberdeen/local-wild-places/pick-out-a-puffin-visit-fowlsheugh/',
  fawsydeHes: 'https://portal.historicenvironment.scot/designation/LB48021',
  roadsideHes: 'https://portal.historicenvironment.scot/designation/LB9534',
  publicRoads: 'https://publications.aberdeenshire.gov.uk/list-of-public-roads',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  osmCopyright: 'https://www.openstreetmap.org/copyright',
};

function circle(lon: number, lat: number, radiusMetres: number) {
  const points: [number, number][] = [];
  const latStep = radiusMetres / 111_320;
  const lonStep = radiusMetres / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let index = 0; index <= 32; index += 1) {
    const angle = (index / 32) * Math.PI * 2;
    points.push([lon + Math.cos(angle) * lonStep, lat + Math.sin(angle) * latStep]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [points] } };
}

function source(
  name: string,
  organisation: string,
  sourceUrl: string,
  notes: string,
  reliability = 'official_non_statutory',
) {
  return {
    sourceName: name,
    sourceOrganisation: organisation,
    sourceUrl,
    accessedAt: reviewedAt,
    notes,
    reliability,
  };
}

function attractionReview(
  scoreRationale: string,
  evidenceUrls: string[],
  parts: number[],
  visitability = 'full_visitor_experience',
) {
  const [
    experienceDepth,
    distinctiveness,
    presentation,
    journeyWorth,
    accessAndReliability,
    evidenceConfidence,
  ] = parts;
  return {
    status: 'editorially_researched',
    category: 'attraction',
    methodVersion,
    reviewedAt: reviewedDate,
    scoreRationale,
    evidenceUrls,
    attractionAssessment: {
      experienceDepth,
      distinctiveness,
      presentation,
      journeyWorth,
      accessAndReliability,
      evidenceConfidence,
      visitability,
    },
  };
}

function foodReview(scoreRationale: string, evidenceUrls: string[], parts: number[]) {
  const [
    foodAndDrinkQuality,
    daytimeRelevance,
    distinctiveness,
    consistency,
    visitorFit,
    evidenceConfidence,
  ] = parts;
  return {
    status: 'editorially_researched',
    category: 'food',
    methodVersion,
    reviewedAt: reviewedDate,
    scoreRationale,
    evidenceUrls,
    foodAssessment: {
      foodAndDrinkQuality,
      daytimeRelevance,
      distinctiveness,
      consistency,
      visitorFit,
      evidenceConfidence,
    },
  };
}

function trailReview(scoreRationale: string, evidenceUrls: string[]) {
  return {
    status: 'editorially_researched',
    category: 'trail',
    methodVersion,
    reviewedAt: reviewedDate,
    scoreRationale,
    evidenceUrls,
  };
}

function feature(projectId: string, input: any) {
  return {
    id: input.id,
    projectId,
    name: input.name,
    alternativeNames: input.alternativeNames ?? [],
    countryCode: 'GB-SCT',
    region: 'Aberdeenshire',
    locality: input.locality,
    featureType: input.featureType ?? 'other',
    significance: input.significance ?? 'local',
    designationType: input.designationType,
    designationCategory: input.designationCategory,
    statutoryStatus: input.statutoryStatus,
    geometry: { type: 'Point', coordinates: input.coordinates },
    locationType: 'exact',
    documentedDateText: input.documentedDateText,
    earliestPossibleYear: input.earliestPossibleYear,
    latestPossibleYear: input.latestPossibleYear,
    datePrecision: input.datePrecision,
    dateBasis:
      input.dateBasis ?? (input.earliestPossibleYear ? 'documented_date_range' : 'unknown'),
    dateConfidence: input.dateConfidence ?? (input.earliestPossibleYear ? 'high' : 'unknown'),
    locationConfidence: 'high',
    survival: input.survival ?? 'substantially_intact',
    shortDescription: input.shortDescription,
    fullDescription: input.fullDescription,
    sourceRecords: input.sourceRecords,
    licence: input.licence,
    tags: input.tags ?? ['curated-visitor'],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: input.reviewNotes,
    evidenceScope: input.evidenceScope ?? 'parish_evidence',
    homeMapEligible: input.homeMapEligible,
    attractionGuide: input.attractionGuide,
    visitorWebsiteUrl: input.visitorWebsiteUrl,
    editorialReview: input.editorialReview,
  };
}

function highlight(rank: number, item: any) {
  return {
    rank,
    featureId: item.id,
    name: item.name,
    reason: item.reason,
    tagline: item.tagline,
    visitorScore: item.score,
    timeToSpend: item.timeToSpend,
    openingTimes: item.openingTimes,
    admission: item.admission,
    freeAdmission: item.freeAdmission,
    visitorWebsiteUrl: item.visitorWebsiteUrl,
    editorialReview: item.editorialReview,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    verifiedInBoundaryAt: reviewedDate,
  };
}

function projectPackage(input: any) {
  const [lon, lat] = input.centre;
  const boundary = circle(lon, lat, input.radius);
  return {
    project: {
      id: input.id,
      name: input.name,
      countryCode: 'GB-SCT',
      country: 'Scotland',
      region: 'Aberdeenshire',
      locality: input.name,
      centre: input.centre,
      boundary,
      boundarySource: `OpenStreetMap settlement point with an explicit ${input.radius}m non-overlapping editorial study buffer`,
      boundaryConfidence: 'medium',
      sourceLanguage: 'English',
      preferredBasemap: 'maplibre-streets',
      createdAt: reviewedAt,
      methodology,
      researchNotes: `${input.name} uses a deliberately non-overlapping visitor-study boundary. Nearby settlements and attractions are not borrowed into this score.`,
      touristAppeal: input.touristAppeal,
      visitorHighlights: input.highlights,
      townGuide: input.townGuide,
      townStudyArea: {
        localityName: input.name,
        sourceName: 'OpenStreetMap settlement point with an explicit editorial study buffer',
        sourceUrl: urls.osmCopyright,
        sourceVersion: reviewedDate,
        bufferMetres: input.radius,
        localityBoundary: boundary,
        bufferedBoundary: boundary,
        notes:
          'Transparent visitor-study selection; not an administrative boundary and deliberately kept separate from neighbouring guides.',
      },
    },
    features: input.features,
    sources: [
      {
        id: `${input.id}-boundary`,
        name: `${input.name} editorial study boundary`,
        organisation: 'OpenStreetMap contributors',
        coverage: `${input.name} settlement`,
        accessMethod: 'Nominatim settlement point and editorial buffer',
        licence: 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.',
        sourceUrl: urls.osmCopyright,
        reliability: 'discovery_only',
        limitations: 'The buffer is a transparent study tool, not an administrative boundary.',
      },
      {
        id: `${input.id}-visitor`,
        name: `${input.name} visitor audit evidence`,
        organisation: 'Official operators, statutory bodies and local authority',
        coverage: `${input.name} visitor offer`,
        accessMethod: 'Current editorial review',
        sourceUrl: input.townGuide.sourceUrls[0],
        reliability: 'official_non_statutory',
        limitations: 'Opening, access, prices and natural conditions can change.',
      },
    ],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };
}

const packages: any[] = [];
const plannerProjects: Record<string, any> = {};
const dogProjects: Record<string, any> = {};

// Stonehaven: Dunnottar Castle is deliberately excluded and receives its own guide.
{
  const projectId = 'stonehaven-scotland';
  const poolReview = attractionReview(
    'A rare, operational 1934 Art Deco Olympic-size heated seawater lido with a full summer programme, strong family value and current official prices.',
    [urls.pool, urls.poolOfficial, urls.poolTimetable],
    [27, 18, 18, 13, 8, 4],
  );
  const harbourReview = attractionReview(
    'A substantial working and recreational harbour with a strong historic townscape, food cluster and direct museum context.',
    [urls.harbour, urls.stonehaven],
    [26, 17, 17, 12, 8, 5],
  );
  const beachReview = attractionReview(
    'A long, accessible town beach and promenade that materially broadens a Stonehaven visit, but remains weather and water-condition dependent.',
    [urls.stonehaven, urls.stonehavenCoast],
    [23, 16, 15, 11, 8, 5],
  );
  const tolboothReview = attractionReview(
    'A free volunteer museum in a late-16th-century Category A tolbooth, with specific prison and burgh collections and current six-day opening.',
    [urls.tolbooth, urls.tolboothHes],
    [22, 15, 15, 11, 8, 5],
  );
  const pool = feature(projectId, {
    id: 'curated-attraction:stonehaven-open-air-pool',
    name: 'Stonehaven Open Air Pool',
    locality: 'Stonehaven',
    featureType: 'other',
    significance: 'national',
    coordinates: [-2.2044797, 56.9697802],
    documentedDateText: 'Opened 1934',
    earliestPossibleYear: 1934,
    latestPossibleYear: 1934,
    dateBasis: 'documented_construction',
    shortDescription:
      'The UK’s only Art Deco Olympic-size heated seawater lido, open for the 2026 summer season with family, quiet, lane and midnight sessions.',
    fullDescription:
      'The 50m seawater pool opened in 1934 and remains a distinctive working visitor attraction. The official 2026 day tariff is £10.40 adult, £6.90 discounted and £28.10 family, with low-income prices also published.',
    sourceRecords: [
      source(
        'Stonehaven Open Air Pool',
        'Friends of Stonehaven Open Air Pool',
        urls.pool,
        'Current operator overview and 1934 opening date.',
      ),
      source(
        '2026 pool timetable and prices',
        'Live Life Aberdeenshire',
        urls.poolOfficial,
        '2026 season 30 May–6 September; adult day £10.40, discounted £6.90, family £28.10; evening and low-income tariffs also published.',
        'local_authority',
      ),
    ],
    visitorWebsiteUrl: urls.poolOfficial,
    editorialReview: poolReview,
    attractionGuide: {
      headline: 'Swim in a heated 1934 Art Deco seawater lido',
      intro:
        'Plan around the current session timetable; daytime visits are generally walk-in, while midnight swims require booking.',
      bestFor: ['Families', 'Outdoor swimming', 'Art Deco', 'Summer events'],
      parking:
        'Beach Promenade car park has 41 spaces plus 4 disabled spaces; voluntary cashless charges use RingGo or PayByPhone code 985533.',
      toilets:
        'Pool changing and toilet facilities are for customers. The nearby leisure centre has a Changing Places facility.',
      picnic: 'Picnics are welcome at the lido; the Splash Café operates on site.',
      food: [
        {
          name: 'Splash Café',
          visitorScore: 68,
          summary: 'Poolside hot and cold snacks and drinks.',
          openingTimes: 'During pool sessions.',
          priceBand: '£',
          externalUrl: urls.pool,
        },
      ],
      thingsToDo: [
        {
          name: 'Choose the right session',
          summary: 'Quiet, casual, lane and family sessions have distinct times.',
        },
        {
          name: 'Try a moonlight swim',
          summary: 'The peak-season Wednesday sessions require advance booking.',
        },
      ],
    },
  });
  const harbour = feature(projectId, {
    id: 'curated-attraction:stonehaven-harbour-auld-toon',
    name: 'Stonehaven Harbour and Auld Toon',
    locality: 'Stonehaven',
    featureType: 'harbour',
    significance: 'regional',
    coordinates: [-2.2015432, 56.959681],
    documentedDateText: 'Harbour rebuilt to Robert Stevenson’s plan, completed 1825',
    earliestPossibleYear: 1825,
    latestPossibleYear: 1825,
    dateBasis: 'documented_construction',
    shortDescription:
      'A colourful three-basin working and recreational harbour framed by the late-medieval Auld Toon, museum and seafood stops.',
    sourceRecords: [
      source(
        'Stonehaven Harbour',
        'VisitAberdeenshire',
        urls.harbour,
        'Current visitor and operational account: reconstruction completed in 1825 to Robert Stevenson’s plan; three basins, 140 regular moorings and continuing fishing use.',
      ),
      source(
        'Stonehaven destination guide',
        'VisitAberdeenshire',
        urls.stonehaven,
        'Official tourism guide identifies the harbour, cafés, seafood and Tolbooth as a core town experience.',
      ),
    ],
    visitorWebsiteUrl: urls.harbour,
    editorialReview: harbourReview,
    attractionGuide: {
      headline: 'Read the working harbour from Stevenson’s 1825 basins to today',
      intro:
        'Walk Shorehead and the piers, watch harbour operations from safe public areas, then pair the waterfront with the Tolbooth Museum.',
      bestFor: ['Harbour atmosphere', 'Maritime history', 'Photography', 'Seafood'],
      parking:
        'Backies car park has 42 free spaces and 2 disabled spaces. Do not obstruct harbour operations.',
      toilets:
        'Old Pier harbour public toilets are current; the council reports disabled access and baby changing.',
      food: [
        {
          name: 'The Ship Inn',
          visitorScore: 84,
          summary:
            'Harbour seafood, pub meals and more than 100 malt whiskies; dogs are welcome in the bar.',
          openingTimes:
            'Bar currently opens daily from breakfast until midnight or 1am; last food orders 8.30pm.',
          priceBand: '££',
          externalUrl: urls.shipBar,
        },
      ],
      thingsToDo: [
        {
          name: 'Circle the public harbour edge',
          summary:
            'Compare the three basins and working berths without entering operational areas.',
        },
        {
          name: 'Add the Tolbooth Museum',
          summary: 'The free museum occupies the oldest surviving harbour building.',
        },
      ],
    },
  });
  const beach = feature(projectId, {
    id: 'curated-attraction:stonehaven-beach-promenade',
    name: 'Stonehaven Beach and Promenade',
    locality: 'Stonehaven',
    featureType: 'other',
    significance: 'regional',
    coordinates: [-2.2064926, 56.964235],
    shortDescription:
      'A broad shingle-and-sand bay with a long promenade, harbour views, recreation park and direct access to the open-air pool.',
    sourceRecords: [
      source(
        'Stonehaven destination guide',
        'VisitAberdeenshire',
        urls.stonehaven,
        'Official tourism evidence for the seafront, coastal activities and outdoor pool.',
      ),
    ],
    visitorWebsiteUrl: urls.stonehaven,
    editorialReview: beachReview,
    attractionGuide: {
      headline: 'A broad town bay linking the harbour, promenade and pool',
      intro:
        'Use the promenade for an easy coastal overview; treat the shore and sea as weather-dependent and follow local safety signage.',
      bestFor: ['Seafront walks', 'Families', 'Sunrise', 'Dog walks'],
      parking:
        'Beach Promenade car park has 41 spaces plus 4 disabled spaces, with voluntary cashless charges.',
      toilets:
        'Public facilities are available at Stonehaven Leisure Centre; the former beach toilet remains closed.',
      picnic:
        'Queen Elizabeth Park and the promenade provide outdoor stopping space; remove all litter.',
      thingsToDo: [
        {
          name: 'Walk the full bay',
          summary: 'Link the harbour end to the pool and recreation ground.',
        },
        {
          name: 'Check sea conditions',
          summary: 'A static guide cannot replace current bathing-water and weather advice.',
        },
      ],
    },
  });
  const tolbooth = feature(projectId, {
    id: 'curated-attraction:stonehaven-tolbooth-museum',
    name: 'Stonehaven Tolbooth Museum',
    locality: 'Stonehaven',
    featureType: 'civic_building',
    significance: 'national',
    designationType: 'Listed Building',
    designationCategory: 'Category A',
    statutoryStatus: 'Listed Building',
    coordinates: [-2.2020797, 56.960782],
    documentedDateText:
      'Late 16th century; used as tolbooth from 1600; restored 1963; museum from 1975',
    earliestPossibleYear: 1550,
    latestPossibleYear: 1599,
    dateBasis: 'documented_date_range',
    shortDescription:
      'A free harbour-front museum inside Stonehaven’s late-16th-century Category A tolbooth and former prison.',
    sourceRecords: [
      source(
        'Stonehaven Tolbooth Museum',
        'Stonehaven Tolbooth Association',
        urls.tolbooth,
        'Current opening: Wednesday–Monday 1.30pm–4.30pm, closed Tuesday; free entry; prison and local-history collections.',
      ),
      source(
        'Old Tolbooth LB41655',
        'Historic Environment Scotland',
        urls.tolboothHes,
        'Category A; late 16th century, north wing added 17th century, restored 1963; used as courthouse and prison after 1600.',
        'official_statutory',
      ),
    ],
    visitorWebsiteUrl: urls.tolbooth,
    editorialReview: tolboothReview,
    attractionGuide: {
      headline: 'Enter Stonehaven’s late-16th-century courthouse and prison',
      intro:
        'The volunteer museum is compact but specific: original prison material, local artefacts and a building whose civic use began in 1600.',
      bestFor: ['Local history', 'Free museums', 'Families', 'Rainy-day interest'],
      parking:
        'Backies car park is the practical public option: 42 free spaces and 2 disabled spaces.',
      toilets:
        'Old Pier public toilets are on the harbour. Museum-specific visitor toilet provision is not published.',
      food: [
        {
          name: 'The Ship Inn',
          visitorScore: 84,
          summary: 'Dog-friendly harbour bar and seafood restaurant nearby.',
          openingTimes: 'Daily; food orders currently end at 8.30pm.',
          priceBand: '££',
          externalUrl: urls.shipBar,
        },
      ],
      thingsToDo: [
        {
          name: 'See the original cell material',
          summary: 'Look for the cell door, stocks and prison crank.',
        },
        {
          name: 'Find the 1710 sundial outside',
          summary: 'The separately listed harbour sundial is a useful dated companion object.',
        },
      ],
    },
  });
  const trail = feature(projectId, {
    id: 'curated-trails:stonehaven-parks-harbour-treasure-trail',
    name: 'Stonehaven Parks and Harbour Treasure Trail',
    locality: 'Stonehaven',
    coordinates: [-2.2049, 56.9693],
    shortDescription:
      'A current dog-friendly 3.7-mile circular treasure hunt through parks, Market Square and the harbour; allow about three hours.',
    tags: ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context'],
    sourceRecords: [
      source(
        'Stonehaven Parks & Harbour Treasure Trail',
        'Treasure Trails',
        urls.treasure,
        'Current-place curation: visitor_place_type=Walking route; route=foot; visit_score=72; trail_score=72; trail_type=Self-guided treasure hunt; distance=3.7 miles / 6 km; duration=3 hours; difficulty=Town streets and parks; wheelchair=no; pushchair=no; dog_friendly=yes; price_display=£9.99 booklet/download; description=Current circular Stonehaven clue trail.',
      ),
    ],
    visitorWebsiteUrl: urls.treasure,
    editorialReview: trailReview(
      'A complete, purchasable and dog-friendly self-guided route that connects Stonehaven’s parks and harbour, reduced for accessibility limits and road crossings.',
      [urls.treasure],
    ),
    attractionGuide: {
      headline: 'Solve a three-hour harbour and parks circuit',
      intro:
        'The route starts at Beach Road and uses permanent town clues. It is not wheelchair or pushchair accessible.',
      bestFor: ['Families', 'Dog owners', 'Local history', 'Puzzle walks'],
    },
  });
  const ship = feature(projectId, {
    id: 'curated-eat:stonehaven-ship-inn',
    name: 'The Ship Inn',
    locality: 'Stonehaven',
    featureType: 'commercial_building',
    coordinates: [-2.2037571, 56.9605263],
    documentedDateText: 'Inn established 1771',
    earliestPossibleYear: 1771,
    latestPossibleYear: 1771,
    dateBasis: 'documented_construction',
    shortDescription:
      'Harbour-front Scottish seafood and pub food with a broad drinks list; dogs are explicitly welcome in the bar.',
    tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'],
    sourceRecords: [
      source(
        'The Ship Inn',
        'VisitAberdeenshire',
        urls.ship,
        'Current-place curation: visitor_place_type=Eat; visit_score=84; price_band=££; cuisine=Scottish seafood, pub meals and local produce; opening_hours:description=Daily from breakfast until midnight or 1am; food orders to 8.30pm; dog_friendly=Yes, bar; description=Harbour seafood and whisky: Established 1771 harbour inn with seafood and more than 100 malt whiskies.',
      ),
      source(
        'Ship Inn lounge bar',
        'The Ship Inn',
        urls.shipBar,
        'Current operator hours and explicit dog welcome in the bar.',
      ),
    ],
    visitorWebsiteUrl: urls.shipBar,
    editorialReview: foodReview(
      'A highly useful destination food stop with harbour setting, local seafood, broad opening and an explicit indoor dog-friendly area.',
      [urls.ship, urls.shipBar],
      [25, 17, 13, 12, 9, 8],
    ),
  });
  const parkingFeatures = [
    [
      'curated-parking:stonehaven-beach-promenade',
      'Beach Promenade Car Park',
      [-2.2052, 56.9702],
      '41 spaces; 4 disabled spaces; voluntary cashless charge; RingGo or PayByPhone code 985533.',
    ],
    [
      'curated-parking:stonehaven-market-square',
      'Market Square Car Park',
      [-2.2114, 56.9636],
      '66 pay-and-display spaces; 6 disabled spaces; charged Monday–Saturday 8am–5pm; cash, card, RingGo or PayByPhone code 985573.',
    ],
    [
      'curated-parking:stonehaven-railway-station',
      'Stonehaven Railway Station Car Park',
      [-2.225283, 56.9668616],
      '75 free spaces; 2 disabled spaces.',
    ],
    [
      'curated-parking:stonehaven-backies',
      'Backies Car Park',
      [-2.2015, 56.9612],
      '42 free spaces; 2 disabled spaces.',
    ],
  ].map(([id, name, coordinates, detail]) =>
    feature(projectId, {
      id,
      name,
      locality: 'Stonehaven',
      featureType: 'other',
      coordinates,
      shortDescription: detail,
      sourceRecords: [
        source(
          'Aberdeenshire car parks',
          'Aberdeenshire Council',
          urls.parking,
          `Current-place curation: visitor_place_type=Parking; amenity=parking; access=public; description=${detail}`,
          'local_authority',
        ),
      ],
    }),
  );
  const toilets = [
    [
      'curated-toilets:stonehaven-old-pier',
      'Stonehaven Old Pier Public Toilets',
      [-2.2017, 56.9607],
      'Harbour public toilets with disabled access and baby changing; use current council opening information.',
    ],
    [
      'curated-toilets:stonehaven-margaret-street',
      'Stonehaven Margaret Street Public Toilets',
      [-2.2103, 56.9637],
      'Town-centre public toilets; use current council opening information.',
    ],
    [
      'curated-toilets:stonehaven-leisure-centre',
      'Stonehaven Leisure Centre Public Toilets',
      [-2.2061, 56.9694],
      'Publicly available toilets with Changing Places provision during leisure-centre opening.',
    ],
  ].map(([id, name, coordinates, detail]) =>
    feature(projectId, {
      id,
      name,
      locality: 'Stonehaven',
      coordinates,
      shortDescription: detail,
      sourceRecords: [
        source(
          'Aberdeenshire public toilets',
          'Aberdeenshire Council',
          urls.toilets,
          `Current-place curation: visitor_place_type=Public toilets; amenity=toilets; access=public; description=${detail}`,
          'local_authority',
        ),
      ],
    }),
  );
  const sundial = feature(projectId, {
    id: 'hes-listed-building:LB41656',
    name: 'Old Pier Tolbooth Sundial',
    locality: 'Stonehaven',
    featureType: 'monument',
    significance: 'national',
    designationType: 'Listed Building',
    designationCategory: 'Category B',
    coordinates: [-2.2019, 56.9606],
    documentedDateText: 'Dated 1710',
    earliestPossibleYear: 1710,
    latestPossibleYear: 1710,
    dateBasis: 'documented_construction',
    shortDescription: 'A free-standing sandstone sundial dated 1710 opposite the Tolbooth.',
    sourceRecords: [
      source(
        'Old Pier sundial LB41656',
        'Historic Environment Scotland',
        urls.sundialHes,
        'Category B; dated 1710.',
        'official_statutory',
      ),
    ],
  });
  const features = [
    pool,
    harbour,
    beach,
    tolbooth,
    trail,
    ship,
    ...parkingFeatures,
    ...toilets,
    sundial,
  ];
  const highlights = [
    highlight(1, {
      id: pool.id,
      name: pool.name,
      reason:
        'A working 1934 Art Deco heated seawater lido with a full summer programme is a rare destination experience in its own right.',
      tagline: 'Art Deco seawater lido',
      score: 88,
      timeToSpend: '2–5 hours',
      openingTimes: '2026 summer season 30 May–6 September; session times vary by date.',
      admission: 'Adult day £10.40; discounted £6.90; family £28.10; low-income tariffs available.',
      freeAdmission: false,
      visitorWebsiteUrl: urls.poolOfficial,
      editorialReview: poolReview,
      sourceName: 'Live Life Aberdeenshire',
      sourceUrl: urls.poolOfficial,
    }),
    highlight(2, {
      id: harbour.id,
      name: harbour.name,
      reason:
        'The active three-basin harbour, historic Shorehead and dense food-and-museum cluster form Stonehaven’s strongest free all-season experience.',
      tagline: 'Working harbour and old town',
      score: 85,
      timeToSpend: '1–3 hours',
      openingTimes:
        'Open-air public waterfront; harbour operations and severe weather can restrict access.',
      admission: 'Free public waterfront.',
      freeAdmission: true,
      visitorWebsiteUrl: urls.harbour,
      editorialReview: harbourReview,
      sourceName: 'VisitAberdeenshire',
      sourceUrl: urls.harbour,
    }),
    highlight(3, {
      id: beach.id,
      name: beach.name,
      reason:
        'The broad bay, long promenade and recreation ground give the town a substantial seaside visit without borrowing Dunnottar Castle.',
      tagline: 'Bay, promenade and pool views',
      score: 78,
      timeToSpend: '45 minutes–3 hours',
      openingTimes:
        'Open-air shore and promenade; use daylight and suitable sea/weather conditions.',
      admission: 'Free.',
      freeAdmission: true,
      visitorWebsiteUrl: urls.stonehaven,
      editorialReview: beachReview,
      sourceName: 'VisitAberdeenshire',
      sourceUrl: urls.stonehaven,
    }),
    highlight(4, {
      id: tolbooth.id,
      name: tolbooth.name,
      reason:
        'A volunteer-run museum inside the late-16th-century Category A courthouse and prison adds a specific, free indoor heritage visit.',
      tagline: 'Prison stories in the old tolbooth',
      score: 76,
      timeToSpend: '30–60 minutes',
      openingTimes: 'Wednesday–Monday 1.30pm–4.30pm; closed Tuesday.',
      admission: 'Free; donations appreciated.',
      freeAdmission: true,
      visitorWebsiteUrl: urls.tolbooth,
      editorialReview: tolboothReview,
      sourceName: 'Stonehaven Tolbooth Association',
      sourceUrl: urls.tolbooth,
    }),
  ];
  packages.push(
    projectPackage({
      id: projectId,
      name: 'Stonehaven',
      centre: [-2.2087993, 56.9640234],
      radius: 1250,
      touristAppeal: {
        score: 88,
        dogOwnerScore: 85,
        dogAccessScoreAdjustment: -3,
        rating: 0,
        label: 'Strong Destination',
        summary:
          'A complete seaside town with a working harbour, a rare Art Deco seawater lido, beach, free museum, strong food and a dedicated clue trail—scored without borrowing Dunnottar Castle.',
        dogAccessRating: 3,
        dogAccessSummary:
          'The beach, promenade, outdoor town and Treasure Trail work well with a dog, and the Ship Inn welcomes dogs in the bar. The score is lower because the pool and museum are not ordinary dog visits and busy harbour roads require control.',
        methodVersion: settlementMethod,
        reviewedAt: reviewedDate,
        sourceUrls: [
          urls.stonehaven,
          urls.poolOfficial,
          urls.harbour,
          urls.tolbooth,
          urls.treasure,
          urls.parking,
          urls.toilets,
          urls.shipBar,
        ],
      },
      highlights,
      townGuide: {
        characterTag: 'Working harbour, Art Deco lido and long town bay',
        headline: 'A full seaside day without needing to borrow its famous castle',
        intro:
          'Stonehaven earns a strong score on its own boundary: swim in the 1934 seawater lido, circle the harbour and Auld Toon, explore the free Tolbooth Museum, walk the bay and use the three-hour Treasure Trail to join the pieces.',
        bestFor: [
          'Harbour atmosphere',
          'Outdoor swimming',
          'Family seaside days',
          'Dog-friendly walks',
        ],
        perfectFor: ['A full independent day trip', 'A rail-accessible coastal break'],
        suggestedFirstVisit: {
          title: 'Start at the harbour, then walk the bay',
          summary: 'Allow a full day when adding the pool or Treasure Trail.',
        },
        dontMiss: [pool.name, harbour.name, tolbooth.name, trail.name],
        suggestedTime: 'A full day; longer with swimming and food',
        visitorMood:
          'Lively but characterful, with enough indoor, outdoor, food and family variety for changing weather.',
        sourceUrls: [
          urls.stonehaven,
          urls.stonehavenCoast,
          urls.poolOfficial,
          urls.harbour,
          urls.tolbooth,
          urls.treasure,
          urls.parking,
          urls.toilets,
        ],
        lastReviewedAt: reviewedDate,
      },
      features,
    }),
  );
  plannerProjects[projectId] = {
    eat: [ship.id],
    trails: [trail.id],
    parking: parkingFeatures.map((item) => item.id),
    toilets: toilets.map((item) => item.id),
    picnic: [],
  };
  dogProjects[projectId] = {
    attraction: {
      [pool.id]: {
        rating: 0,
        status: 'restricted',
        label: 'Not a normal dog visit',
        summary:
          'Dogs are not part of ordinary public swim sessions. Separate, bookable dog-swim events may run after the summer season; do not infer general pool access.',
        sourceName: 'Stonehaven pool current programme review',
        sourceUrl: urls.poolOfficial,
        reviewedAt: reviewedDate,
      },
      [harbour.id]: {
        rating: 2,
        status: 'restricted',
        label: 'Dog-suitable waterfront with working hazards',
        summary:
          'Dogs can share the public harbour walk on a short lead. Vehicles, boats, quay edges, food areas and crowds require close control.',
        sourceName: 'Stonehaven harbour audit and Outdoor Access Code',
        sourceUrl: urls.outdoorCode,
        reviewedAt: reviewedDate,
      },
      [beach.id]: {
        rating: 3,
        status: 'welcoming',
        label: 'Strong dog-walking seafront',
        summary:
          'The beach and promenade give a substantial outdoor dog visit. Keep close control around wildlife, children, food, roads and rough water, and obey any current signs.',
        sourceName: 'Stonehaven beach audit and Outdoor Access Code',
        sourceUrl: urls.outdoorCode,
        reviewedAt: reviewedDate,
      },
      [tolbooth.id]: {
        rating: 0,
        status: 'unconfirmed',
        label: 'Museum dog policy not published',
        summary:
          'No reliable current dog policy is published for the small museum interior. Confirm directly rather than assuming pet-dog access.',
        sourceName: 'Tolbooth Museum policy review',
        sourceUrl: urls.tolbooth,
        reviewedAt: reviewedDate,
      },
      [trail.id]: {
        rating: 3,
        status: 'welcoming',
        label: 'Explicitly dog-friendly clue trail',
        summary:
          'Treasure Trails marks the route dog-friendly. Use a lead beside roads and harbour edges and close control in parks and busy public spaces.',
        sourceName: 'Treasure Trails',
        sourceUrl: urls.treasure,
        reviewedAt: reviewedDate,
      },
    },
    eat: {
      [ship.id]: {
        rating: 3,
        status: 'welcoming',
        label: 'Dogs welcome in the bar',
        summary:
          'The current operator and official destination listing explicitly welcome well-behaved dogs in the bar.',
        sourceName: 'The Ship Inn',
        sourceUrl: urls.shipBar,
        reviewedAt: reviewedDate,
      },
    },
  };
}

// Dunnottar Castle: a standalone See/Attractions place, not a qualifying town.
{
  const projectId = 'stonehaven-scotland';
  const castleReview = attractionReview(
    'One of Scotland’s most dramatically situated and historically consequential castles, with extensive ruins, interpretation and a fully managed paid visit.',
    [urls.castle, urls.castleBook, urls.castleAccess, urls.castleHes],
    [29, 19, 19, 14, 7, 4],
    'substantial_visible_remains',
  );
  const castle = feature(projectId, {
    id: 'curated-attraction:dunnottar-castle',
    name: 'Dunnottar Castle',
    locality: 'Dunnottar',
    featureType: 'castle',
    significance: 'highest_national',
    designationType: 'Scheduled Monument',
    statutoryStatus: 'Scheduled Monument',
    coordinates: [-2.1970568, 56.9459963],
    documentedDateText:
      'Medieval origins; principal surviving ranges 14th–17th centuries; scheduled 1920',
    earliestPossibleYear: 1300,
    latestPossibleYear: 1699,
    dateBasis: 'documented_date_range',
    survival: 'substantially_intact',
    shortDescription:
      'A vast and iconic fortress ruin isolated on a 160-foot coastal rock, with managed entry, extensive interiors and Crown Jewels history.',
    tags: ['curated-visitor', 'service-context-visitor', 'home-standalone-place', 'current-context'],
    evidenceScope: 'related_context',
    homeMapEligible: true,
    sourceRecords: [
      source(
        'Dunnottar Castle visitor information',
        'Dunnottar Castle / Dunecht Estates',
        urls.castleBook,
        'Current-place curation: visitor_place_type=Attraction; visit_score=84; time_to_spend=1½–3 hours; opening_hours:description=April–September 09:00–18:00; October shoulder dates 10:00–17:00; winter closing varies from 15:00 to 17:00; last entry one hour before closing; weather closures possible; entrance_fee=Adult £13.50, concession £12, child 5–15 £6.25, family £36 or £24; card only; description=Scotland’s cliff-top fortress: Extensive nationally important ruins on an isolated coastal rock.',
      ),
      source(
        'Dunnottar Castle SM986',
        'Historic Environment Scotland',
        urls.castleHes,
        'Nationally important scheduled castle; designation added 28 April 1920.',
        'official_statutory',
      ),
    ],
    visitorWebsiteUrl: urls.castleBook,
    editorialReview: castleReview,
    attractionGuide: {
      headline: 'Descend to Scotland’s great cliff-top fortress',
      intro:
        'Allow enough time for 218 steps across the approach and the extensive internal ruins. High winds, snow or ice can close the site at short notice.',
      bestFor: ['Castles', 'Scottish history', 'Coastal drama', 'Photography'],
      parking:
        'Free for castle patrons; 2 designated disabled spaces. No EV charging. Vehicles are left at owners’ risk.',
      toilets: 'Toilets are inside the paid castle grounds for ticket holders.',
      picnic:
        'No formal picnic provision is advertised inside the monument; protect the archaeology and remove all litter.',
      foodNote:
        'C&L Catering beside the car park serves hot and cold drinks, snacks and hot food; detailed hours and prices are not published.',
      thingsToDo: [
        {
          name: 'Cross the defensive approach',
          summary:
            'The 180 concrete steps, earth path and 38 uneven entrance steps reveal the natural defence.',
        },
        {
          name: 'Explore the keep and quadrangle',
          summary: 'The ruins span medieval fortification and later noble residence.',
        },
        {
          name: 'Follow the Honours of Scotland story',
          summary: 'Dunnottar sheltered the Scottish Crown Jewels from Cromwell’s army.',
        },
      ],
    },
  });
  const parking = feature(projectId, {
    id: 'curated-parking:dunnottar-castle',
    name: 'Dunnottar Castle Customer Car Park',
    locality: 'Dunnottar',
    coordinates: [-2.2062, 56.9471],
    shortDescription:
      'Free for castle patrons with 2 designated disabled spaces; no EV charging; capacity, maximum stay and overnight policy are not published.',
    sourceRecords: [
      source(
        'Dunnottar Castle facilities',
        'Dunnottar Castle / Dunecht Estates',
        urls.castleFacilities,
        'Current-place curation: visitor_place_type=Customer parking; amenity=parking; access=customers; price_display=Free for Castle patrons; capacity=Not published; capacity:disabled=2; payment_methods=Not applicable; ev_charging=no; maxstay=Not published; overnight_parking=Not published; description=Official castle car park.',
        'official_non_statutory',
      ),
    ],
  });
  const stonehaven = packages.find((pkg) => pkg.project.id === projectId);
  if (!stonehaven) throw new Error('Stonehaven package missing before Dunnottar attachment');
  stonehaven.features.push(castle, parking);
  dogProjects[projectId].attraction[castle.id] = {
    rating: 2,
    status: 'restricted',
    label: 'Dogs welcome on a short lead',
    summary:
      'The operator explicitly welcomes dogs on short leads. The steep steps, uneven ruins, sheer drops, crowds and requirement to carry waste back to the car-park bins make close control essential.',
    sourceName: 'Dunnottar Castle access guide',
    sourceUrl: urls.castleAccess,
    reviewedAt: reviewedDate,
  };
}

// Kirktown of Fetteresso: one modest but complete open-access medieval church stop.
{
  const projectId = 'kirktown-of-fetteresso-scotland';
  const kirkReview = attractionReview(
    'A genuine open-access medieval churchyard with a documented 1246 dedication and visible lancets, doorway, memorials and graveyard, but a compact and lightly interpreted visit.',
    [urls.kirktownHistory, urls.kirktownHesContext, urls.kirktownVisit],
    [19, 14, 13, 8, 7, 3],
    'substantial_visible_remains',
  );
  const kirk = feature(projectId, {
    id: 'curated-attraction:kirktown-fetteresso-st-ciarans',
    name: 'St Ciaran’s Old Church and Churchyard',
    locality: 'Kirktown of Fetteresso',
    featureType: 'church',
    significance: 'regional',
    coordinates: [-2.2434, 56.9624],
    documentedDateText: 'Dedicated 25 May 1246; later rebuilding and 18th-century memorial fabric',
    earliestPossibleYear: 1246,
    latestPossibleYear: 1246,
    dateBasis: 'documented_construction',
    survival: 'substantial_visible_remains',
    shortDescription:
      'An open-access medieval churchyard whose surviving east gable and doorway preserve a site dedicated in 1246.',
    sourceRecords: [
      source(
        'Fetteresso local history',
        'Fetteresso Parish Church',
        urls.kirktownHistory,
        'Detailed local church history: David de Bernham dedicated the church on 25 May 1246; surviving east gable has three lancets and the north-west doorway survives.',
      ),
      source(
        'Fetteresso Church LB41576 historical context',
        'Historic Environment Scotland',
        urls.kirktownHesContext,
        'Statutory history confirms the old church at Kirktown was dedicated in 1246.',
        'official_statutory',
      ),
      source(
        'St Ciaran’s Old Church visitor account',
        'Britain Express',
        urls.kirktownVisit,
        'Responsible visitor account describes open access at reasonable times and the surviving churchyard fabric.',
        'secondary',
      ),
    ],
    visitorWebsiteUrl: urls.kirktownVisit,
    editorialReview: kirkReview,
    attractionGuide: {
      headline: 'Read a 1246 parish site in its quiet churchyard',
      intro:
        'This is a focused outdoor heritage stop rather than a staffed attraction. Respect graves, residents and any active maintenance.',
      bestFor: ['Medieval churches', 'Quiet heritage', 'Genealogy', 'Short stops'],
      parking:
        'No dedicated public visitor car park with defensible capacity or terms is published. Arrive without obstructing residents, farm access or the narrow road.',
      toilets: 'No council-listed public toilet in Kirktown of Fetteresso.',
      picnic: 'No formal public picnic facility is verified.',
      foodNote: 'No current in-boundary café or pub clears the evidence gate.',
      thingsToDo: [
        {
          name: 'Find the three lancets',
          summary: 'The east gable is the strongest surviving medieval visual feature.',
        },
        {
          name: 'Read the rebuilt church plan',
          summary: 'Most walls record later repair and rebuilding around the medieval core.',
        },
      ],
    },
  });
  const highlights = [
    highlight(1, {
      id: kirk.id,
      name: kirk.name,
      reason:
        'The documented 1246 dedication, surviving medieval fabric and reasonable open access justify a focused heritage stop, without borrowing Stonehaven facilities.',
      tagline: 'A 1246 churchyard survival',
      score: 64,
      timeToSpend: '30–60 minutes',
      openingTimes:
        'Open-access churchyard, normally at reasonable times; respect any closure or service notices.',
      admission: 'Free outdoor site.',
      freeAdmission: true,
      visitorWebsiteUrl: urls.kirktownVisit,
      editorialReview: kirkReview,
      sourceName: 'Fetteresso Parish Church and Historic Environment Scotland',
      sourceUrl: urls.kirktownHistory,
    }),
  ];
  packages.push(
    projectPackage({
      id: projectId,
      name: 'Kirktown of Fetteresso',
      centre: [-2.242382, 56.9624039],
      radius: 500,
      touristAppeal: {
        score: 62,
        dogOwnerScore: 60,
        dogAccessScoreAdjustment: -2,
        rating: 0,
        label: 'Notable Stop',
        summary:
          'A narrow but defensible medieval heritage stop centred on St Ciaran’s documented 1246 churchyard; no Stonehaven attractions or private Fetteresso estate grounds are borrowed.',
        dogAccessRating: 2,
        dogAccessSummary:
          'The outdoor churchyard can be visited with a dog under close control, but graves, narrow roads, residents and the absence of facilities make it a restrained visit.',
        methodVersion: settlementMethod,
        reviewedAt: reviewedDate,
        sourceUrls: [urls.kirktownHistory, urls.kirktownHesContext, urls.kirktownVisit],
      },
      highlights,
      townGuide: {
        characterTag: 'A quiet 1246 churchyard settlement',
        headline: 'One strong medieval fragment in a remarkably small kirktown',
        intro:
          'The guide is deliberately focused: inspect the surviving lancets and doorway of St Ciaran’s Old Church, understand the 1246 dedication, and avoid treating nearby Stonehaven or private estate land as Kirktown attractions.',
        bestFor: ['Medieval church history', 'Genealogy', 'Quiet detours'],
        perfectFor: ['A 30–60 minute focused stop'],
        suggestedFirstVisit: {
          title: 'Start at St Ciaran’s Old Church',
          summary: 'The churchyard is the only place that clears the visitor threshold.',
        },
        dontMiss: [kirk.name],
        suggestedTime: '30–60 minutes',
        visitorMood:
          'Quiet, residential and lightly serviced; worthwhile for the church rather than as a general destination.',
        sourceUrls: [urls.kirktownHistory, urls.kirktownHesContext, urls.kirktownVisit],
        lastReviewedAt: reviewedDate,
      },
      features: [kirk],
    }),
  );
  plannerProjects[projectId] = { eat: [], trails: [], parking: [], toilets: [], picnic: [] };
  dogProjects[projectId] = {
    attraction: {
      [kirk.id]: {
        rating: 2,
        status: 'restricted',
        label: 'Churchyard visit under close control',
        summary:
          'Dogs can accompany a respectful outdoor visit, but should be kept on a short lead around graves, visitors, residents and the narrow access road.',
        sourceName: 'Kirktown access audit and Outdoor Access Code',
        sourceUrl: urls.outdoorCode,
        reviewedAt: reviewedDate,
      },
    },
    eat: {},
  };
}

// Catterline: corrected from the likely typo "Vaterline".
{
  const projectId = 'catterline-scotland';
  const villageReview = attractionReview(
    'A highly distinctive, well-preserved fishing-village view bound directly to Joan Eardley’s nationally important art, with harbour, cliff and listed South Row fabric.',
    [urls.catterlineArt, urls.catterlinePainting, urls.catterlineHes, urls.coastalTrail],
    [23, 16, 15, 10, 7, 3],
  );
  const village = feature(projectId, {
    id: 'curated-attraction:catterline-harbour-eardley-landscape',
    name: 'Catterline Harbour and Joan Eardley Landscape',
    locality: 'Catterline',
    featureType: 'harbour',
    significance: 'national',
    coordinates: [-2.2148, 56.8959],
    documentedDateText:
      'South Row mainly early 19th century; Joan Eardley worked here from 1951 until 1963',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1830,
    dateBasis: 'documented_date_range',
    shortDescription:
      'A tiny cliff-backed harbour and listed fisher row whose weather, cottages and sea became central to Joan Eardley’s mature art.',
    sourceRecords: [
      source(
        'Joan Eardley: a life in Catterline',
        'National Galleries of Scotland',
        urls.catterlineArt,
        'Authoritative curatorial account: Eardley first visited in 1951 and Catterline became central to her most celebrated work.',
        'academic',
      ),
      source(
        'Sea and Snow, Catterline',
        'National Galleries of Scotland',
        urls.catterlinePainting,
        'The c.1958 painting documents the exact cliff-top view toward the pier.',
        'academic',
      ),
      source(
        '1–10 South Row LB9511',
        'Historic Environment Scotland',
        urls.catterlineHes,
        'Category B row of whitewashed fisher cottages, probably early 19th century.',
        'official_statutory',
      ),
    ],
    visitorWebsiteUrl: urls.catterlineArt,
    editorialReview: villageReview,
    attractionGuide: {
      headline: 'Stand inside one of modern Scottish art’s defining landscapes',
      intro:
        'Walk carefully from South Row toward the harbour and compare the cliff, pier and weather with Eardley’s Catterline works. This is a living residential village, not an open-air museum.',
      bestFor: ['Joan Eardley', 'Fishing villages', 'Coastal scenery', 'Photography'],
      parking:
        'No council-published Catterline capacity or tariff was found. Use only clearly signed public parking and never block residents, harbour access or emergency routes.',
      toilets:
        'Catterline is absent from the current council public-toilet directory; do not rely on a public facility.',
      food: [
        {
          name: 'The Creel Inn & Grill',
          visitorScore: 82,
          summary:
            'Current seafood, pub-classic and Indian menus; CAMRA marks the bar area dog-friendly.',
          openingTimes: 'Mon–Thu 4–10pm; Fri 4–11pm; Sat 2.30–11pm; Sun 2.30pm–midnight.',
          priceBand: '££',
          externalUrl: urls.creel,
        },
      ],
      trails: [
        {
          name: 'Aberdeenshire Coastal Trail at Catterline',
          summary:
            'Use the official coastal-trail material to understand Catterline’s place on the Mearns coast; cliff edges and route conditions require care.',
          routeType: 'Coastal walking context',
          distance: 'Variable',
          duration: 'Variable',
          difficulty: 'Uneven coastal paths and exposed cliffs.',
          externalUrl: urls.coastalTrail,
        },
      ],
      thingsToDo: [
        {
          name: 'Frame Eardley’s pier view',
          summary: 'The National Galleries identifies the view from South Row toward the pier.',
        },
        {
          name: 'Read the fisher cottages',
          summary: 'The listed row preserves the compact working-village form.',
        },
        {
          name: 'Descend only on safe public routes',
          summary: 'Steep slopes, harbour work and weather can change conditions quickly.',
        },
      ],
    },
  });
  const trail = feature(projectId, {
    id: 'curated-trails:catterline-coastal-village-walk',
    name: 'Catterline Coastal Village Walk',
    locality: 'Catterline',
    coordinates: [-2.2174, 56.8968],
    shortDescription:
      'A short village-and-clifftop exploration joining South Row, Eardley viewpoints and the harbour; distance varies with safe access and conditions.',
    tags: ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context'],
    sourceRecords: [
      source(
        'Aberdeenshire Coastal Trail',
        'VisitAberdeenshire',
        urls.coastalTrail,
        'Current-place curation: visitor_place_type=Walking route; route=foot; visit_score=69; trail_score=69; trail_type=Coastal village walk; distance=Variable short circuit; duration=45–90 minutes; difficulty=Uneven paths, steep slopes and exposed cliff edges; dog_friendly=Responsible access on lead near cliffs, livestock and harbour activity; description=Catterline harbour, South Row and Eardley landscape walk.',
      ),
    ],
    visitorWebsiteUrl: urls.coastalTrail,
    editorialReview: trailReview(
      'A distinctive short coastal exploration with nationally meaningful art context, reduced because no single official turn-by-turn circuit or universal accessibility specification is published.',
      [urls.coastalTrail, urls.catterlineArt],
    ),
  });
  const creel = feature(projectId, {
    id: 'curated-eat:catterline-creel-inn',
    name: 'The Creel Inn & Grill',
    locality: 'Catterline',
    featureType: 'commercial_building',
    coordinates: [-2.2174954, 56.8948078],
    shortDescription:
      'A destination pub and restaurant above Catterline Bay serving seafood, pub classics and Indian dishes; CAMRA marks the bar area dog-friendly.',
    tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'],
    sourceRecords: [
      source(
        'The Creel Inn & Grill',
        'The Creel Inn & Grill',
        urls.creel,
        'Current-place curation: visitor_place_type=Eat; visit_score=82; price_band=££; cuisine=Seafood, pub classics and Indian dishes; opening_hours:description=Monday–Thursday 16:00–22:00; Friday 16:00–23:00; Saturday 14:30–23:00; Sunday 14:30–00:00; dog_friendly=CAMRA marks bar area dog friendly; description=Cliff-top pub and grill: Current evening and weekend food stop in Catterline.',
      ),
      source(
        'Creel Inn pub record',
        'CAMRA',
        urls.creelDog,
        'Updated January 2026; marks the bar area dog-friendly and parking very limited.',
        'secondary',
      ),
    ],
    visitorWebsiteUrl: urls.creel,
    editorialReview: foodReview(
      'A distinctive village food anchor with a strong coastal setting, current operator hours and current dog-friendly secondary evidence.',
      [urls.creel, urls.creelDog],
      [24, 15, 13, 12, 9, 9],
    ),
  });
  const highlights = [
    highlight(1, {
      id: village.id,
      name: village.name,
      reason:
        'The harbour, listed South Row and exact landscape of Joan Eardley’s major paintings create a nationally distinctive sense-of-place visit.',
      tagline: 'Eardley’s fishing-village landscape',
      score: 74,
      timeToSpend: '1–2 hours',
      openingTimes:
        'Open-air living village and harbour; use daylight and safe weather, tide and path conditions.',
      admission: 'Free public viewpoints and streets.',
      freeAdmission: true,
      visitorWebsiteUrl: urls.catterlineArt,
      editorialReview: villageReview,
      sourceName: 'National Galleries of Scotland and Historic Environment Scotland',
      sourceUrl: urls.catterlineArt,
    }),
  ];
  packages.push(
    projectPackage({
      id: projectId,
      name: 'Catterline',
      centre: [-2.2178874, 56.8979509],
      radius: 700,
      touristAppeal: {
        score: 72,
        dogOwnerScore: 69,
        dogAccessScoreAdjustment: -3,
        rating: 0,
        label: 'Worth a Visit',
        summary:
          'A small but unusually distinctive fishing village: Joan Eardley’s nationally important landscape, listed fisher cottages, harbour, coastal walking and a destination seafood inn reinforce one another.',
        dogAccessRating: 2,
        dogAccessSummary:
          'Outdoor village exploration and the dog-friendly pub help, but cliff edges, steep routes, harbour activity, livestock and uncertain off-lead suitability reduce the dog-owner score.',
        methodVersion: settlementMethod,
        reviewedAt: reviewedDate,
        sourceUrls: [
          urls.catterlineArt,
          urls.catterlinePainting,
          urls.catterlineHes,
          urls.coastalTrail,
          urls.creel,
          urls.creelDog,
        ],
      },
      highlights,
      townGuide: {
        characterTag: 'Joan Eardley’s harbour and fisher-cottage landscape',
        headline: 'A tiny village with an outsized place in modern Scottish art',
        intro:
          'Use Eardley’s paintings to read the harbour, South Row and weather rather than treating the village as generic coastal scenery. Add the cliff-top inn and a careful short walk for a complete visit.',
        bestFor: ['Joan Eardley', 'Fishing-village character', 'Seafood', 'Coastal walking'],
        perfectFor: ['A focused 2–4 hour art-and-coast visit'],
        suggestedFirstVisit: {
          title: 'Start at South Row and the harbour view',
          summary: 'Allow time to compare the real landscape with Eardley’s paintings.',
        },
        dontMiss: [village.name, creel.name, trail.name],
        suggestedTime: '2–4 hours with food',
        visitorMood:
          'Small, exposed and residential, yet exceptionally strong in art, landscape and atmosphere.',
        sourceUrls: [
          urls.catterlineArt,
          urls.catterlinePainting,
          urls.catterlineHes,
          urls.coastalTrail,
          urls.creel,
        ],
        lastReviewedAt: reviewedDate,
      },
      features: [village, trail, creel],
    }),
  );
  plannerProjects[projectId] = {
    eat: [creel.id],
    trails: [trail.id],
    parking: [],
    toilets: [],
    picnic: [],
  };
  dogProjects[projectId] = {
    attraction: {
      [village.id]: {
        rating: 2,
        status: 'restricted',
        label: 'Dog-suitable with cliff and harbour care',
        summary:
          'Dogs can accompany the outdoor village visit under close control. Use a lead beside cliff edges, livestock, working harbour areas, roads and residential frontages.',
        sourceName: 'Catterline access audit and Outdoor Access Code',
        sourceUrl: urls.outdoorCode,
        reviewedAt: reviewedDate,
      },
      [trail.id]: {
        rating: 2,
        status: 'restricted',
        label: 'Coastal route needs a lead',
        summary:
          'The coastal setting is dog-suitable, but exposed cliffs, livestock, wildlife, narrow paths and harbour activity call for a lead and conservative route choices.',
        sourceName: 'Catterline coastal audit and Outdoor Access Code',
        sourceUrl: urls.outdoorCode,
        reviewedAt: reviewedDate,
      },
    },
    eat: {
      [creel.id]: {
        rating: 3,
        status: 'welcoming',
          label: 'Dog-friendly in the bar area',
        summary:
            'The current CAMRA listing marks the Creel Inn bar area dog-friendly. Confirm arrangements when booking because the operator site does not publish a detailed pet policy.',
        sourceName: 'CAMRA',
        sourceUrl: urls.creelDog,
        reviewedAt: reviewedDate,
      },
    },
  };
}

// Crawton: its public visitor value is the RSPB reserve reached from the hamlet.
{
  const projectId = 'crawton-scotland';
  const reserveReview = attractionReview(
    'The largest mainland seabird colony on Scotland’s east coast, with more than 115,000 breeding birds, a defined trail, shelter and exact current facility/access guidance.',
    [urls.fowlsheugh, urls.fowlsheughCharges, urls.fowlsheughLocal],
    [27, 18, 17, 12, 7, 3],
  );
  const reserve = feature(projectId, {
    id: 'curated-attraction:crawton-fowlsheugh',
    name: 'RSPB Fowlsheugh Nature Reserve',
    locality: 'Crawton',
    featureType: 'other',
    significance: 'national',
    coordinates: [-2.1977463, 56.9151874],
    shortDescription:
      'A free one-mile cliff-top reserve trail above Scotland’s east-coast mainland’s largest seabird colony, with more than 115,000 breeding birds in season.',
    sourceRecords: [
      source(
        'Fowlsheugh Nature Reserve',
        'RSPB',
        urls.fowlsheugh,
        'Current official evidence: more than 115,000 breeding seabirds; main spectacle May–early August; one-mile / 1.5 km uneven trail; 12-space council car park; no toilets; dogs on lead at all times; BBQs prohibited.',
      ),
      source(
        'Fowlsheugh charges',
        'RSPB',
        urls.fowlsheughCharges,
        'Current free admission for adults, children, members and non-members.',
      ),
    ],
    visitorWebsiteUrl: urls.fowlsheugh,
    editorialReview: reserveReview,
    attractionGuide: {
      headline: 'Walk above 115,000 breeding seabirds',
      intro:
        'The colony is strongest from May to early August, but the coastal trail remains worthwhile year-round. Expect steps, uneven ground, exposed cliffs and no toilets.',
      bestFor: ['Seabirds', 'Puffin chances', 'Coastal cliffs', 'Wildlife photography'],
      parking:
        'Crawton car park has 12 free spaces with voluntary cashless donations via RingGo or PayByPhone code 985538. It is unsuitable for coaches and caravans; never verge-park.',
      toilets:
        'There are no toilets. The RSPB identifies Stonehaven, 5 miles / 8 km away, as the nearest option.',
      picnic:
        'No BBQs are allowed. No formal picnic facility is published; protect the reserve and remove all waste.',
      foodNote:
        'No in-boundary public food venue is verified; bring provisions without feeding wildlife.',
      trails: [
        {
          name: 'Fowlsheugh Cliff-top Trail',
          summary:
            'A one-mile / 1.5 km out-and-back nature trail with two flights of steps at the start, uneven unsurfaced ground, a 1m gate and a shelter overlooking the ledges.',
          routeType: 'Coastal wildlife trail',
          distance: '1 mile / 1.5 km',
          duration: 'Allow 1–2 hours for wildlife watching',
          difficulty: 'Uneven and unsurfaced with steps and cliff exposure.',
          externalUrl: urls.fowlsheugh,
        },
      ],
      thingsToDo: [
        {
          name: 'Time the breeding colony',
          summary: 'May to early August gives the strongest massed-bird experience.',
        },
        {
          name: 'Use the viewing shelter',
          summary: 'The shelter at the trail end overlooks the breeding ledges.',
        },
        {
          name: 'Scan the water',
          summary: 'Grey seals and dolphins are possible as well as seabirds.',
        },
      ],
    },
  });
  const trail = feature(projectId, {
    id: 'curated-trails:crawton-fowlsheugh-cliff-trail',
    name: 'Fowlsheugh Cliff-top Trail',
    locality: 'Crawton',
    coordinates: [-2.2, 56.9101],
    shortDescription:
      'A one-mile / 1.5 km uneven out-and-back trail from Crawton to the seabird viewing shelter; allow 1–2 hours.',
    tags: ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context'],
    sourceRecords: [
      source(
        'Fowlsheugh trail and access',
        'RSPB',
        urls.fowlsheugh,
        'Current-place curation: visitor_place_type=Walking route; route=foot; visit_score=76; trail_score=76; trail_type=Coastal wildlife out-and-back; distance=1 mile / 1.5 km; duration=1–2 hours; difficulty=Two flights of steps at the start, unsurfaced uneven path, 1m entrance gate and exposed cliffs; dog_friendly=Yes, on a lead at all times; parking=12 spaces; toilets=None; description=Official reserve trail to a viewing shelter.',
      ),
    ],
    visitorWebsiteUrl: urls.fowlsheugh,
    editorialReview: trailReview(
      'A short but exceptionally wildlife-rich official route with exact access data and a destination viewing shelter, reduced for steps, uneven surface and severe cliff exposure.',
      [urls.fowlsheugh],
    ),
  });
  const parking = feature(projectId, {
    id: 'curated-parking:crawton-car-park',
    name: 'Crawton Car Park',
    locality: 'Crawton',
    coordinates: [-2.201, 56.9098],
    shortDescription:
      '12 free spaces with voluntary cashless donations; RingGo or PayByPhone code 985538. Not suitable for coaches or caravans; never verge-park.',
    sourceRecords: [
      source(
        'Crawton car park',
        'Aberdeenshire Council',
        urls.parking,
        'Current-place curation: visitor_place_type=Parking; amenity=parking; access=public; capacity=12; price_display=Free with voluntary charge; payment_required=no; payment_methods=RingGo or PayByPhone; payment_location_code=985538; coaches=no; caravans=no; description=Council car park serving Crawton and Fowlsheugh.',
        'local_authority',
      ),
      source(
        'Fowlsheugh parking restrictions',
        'RSPB',
        urls.fowlsheugh,
        'Official reserve page confirms 12 spaces, no height restriction, no bike racks, no coaches or caravans, and asks visitors not to park on verges.',
      ),
    ],
  });
  const highlights = [
    highlight(1, {
      id: reserve.id,
      name: reserve.name,
      reason:
        'A free official trail reaches the largest mainland seabird colony on Scotland’s east coast, giving Crawton a clear nationally significant reason to visit.',
      tagline: 'Cliffs alive with seabirds',
      score: 84,
      timeToSpend: '1½–3 hours',
      openingTimes:
        'Open year-round; breeding spectacle strongest May–early August. Daylight, suitable weather and safe cliff conditions essential.',
      admission: 'Free.',
      freeAdmission: true,
      visitorWebsiteUrl: urls.fowlsheugh,
      editorialReview: reserveReview,
      sourceName: 'RSPB',
      sourceUrl: urls.fowlsheugh,
    }),
  ];
  packages.push(
    projectPackage({
      id: projectId,
      name: 'Crawton',
      centre: [-2.2000668, 56.9094004],
      radius: 750,
      touristAppeal: {
        score: 74,
        dogOwnerScore: 71,
        dogAccessScoreAdjustment: -3,
        rating: 0,
        label: 'Worth a Visit',
        summary:
          'A tiny hamlet with one nationally strong reason to stop: direct access to RSPB Fowlsheugh, Scotland’s east-coast mainland’s largest seabird colony, on a complete free cliff-top trail.',
        dogAccessRating: 2,
        dogAccessSummary:
          'Dogs are welcome only on a lead at all times. The trail is usable but the breeding birds, sheer cliffs, steps, narrow gate, uneven ground and absence of water, bins and toilets materially reduce the dog-owner score.',
        methodVersion: settlementMethod,
        reviewedAt: reviewedDate,
        sourceUrls: [urls.fowlsheugh, urls.fowlsheughCharges, urls.fowlsheughLocal, urls.parking],
      },
      highlights,
      townGuide: {
        characterTag: 'Gateway to the Fowlsheugh seabird cliffs',
        headline: 'A tiny hamlet with one outstanding wildlife walk',
        intro:
          'Crawton qualifies because the official reserve entrance, car park and trail begin here. Park responsibly, follow the one-mile cliff-top route, use the viewing shelter and bring everything out again.',
        bestFor: ['Seabirds', 'Puffin chances', 'Cliff scenery', 'Wildlife photography'],
        perfectFor: ['A 2–3 hour seasonal wildlife stop'],
        suggestedFirstVisit: {
          title: 'Go straight to the RSPB trail',
          summary: 'May to early August gives the strongest colony spectacle.',
        },
        dontMiss: [reserve.name, trail.name],
        suggestedTime: '1½–3 hours',
        visitorMood:
          'Wild, exposed and minimally serviced; the reserve is excellent but demands self-sufficiency and cliff awareness.',
        sourceUrls: [urls.fowlsheugh, urls.fowlsheughCharges, urls.parking],
        lastReviewedAt: reviewedDate,
      },
      features: [reserve, trail, parking],
    }),
  );
  plannerProjects[projectId] = {
    eat: [],
    trails: [trail.id],
    parking: [parking.id],
    toilets: [],
    picnic: [],
  };
  dogProjects[projectId] = {
    attraction: {
      [reserve.id]: {
        rating: 2,
        status: 'restricted',
        label: 'Dogs on leads at all times',
        summary:
          'RSPB explicitly welcomes responsible access but requires dogs to remain on a lead throughout to protect the breeding colony and manage cliff risk.',
        sourceName: 'RSPB Fowlsheugh',
        sourceUrl: urls.fowlsheugh,
        reviewedAt: reviewedDate,
      },
      [trail.id]: {
        rating: 2,
        status: 'restricted',
        label: 'Lead-only coastal wildlife trail',
        summary:
          'Dogs may use the trail on a lead at all times. Steps, uneven ground, a narrow gate, breeding birds and exposed cliff edges require sustained close control.',
        sourceName: 'RSPB Fowlsheugh',
        sourceUrl: urls.fowlsheugh,
        reviewedAt: reviewedDate,
      },
    },
    eat: {},
  };
}

const review = {
  reviewedAt: reviewedDate,
  methodVersion: settlementMethod,
  namingDecisions: [
    'Dunnattar normalised to Dunnottar.',
    'Vaterline interpreted as Catterline because no Scottish settlement or OSM result was found for Vaterline and Catterline fits the supplied geographic sequence.',
    'Mowtie normalised to Mill of Mowtie, the mapped nearby hamlet.',
    'Redcloack House normalised to Redcloak House.',
  ],
  threshold: 60,
  results: [
    {
      suppliedName: 'Redcloack house',
      normalisedName: 'Redcloak House',
      score: 34,
      publish: false,
      rationale:
        'Historic/private residential locality with no verified general public attraction, trailhead or visitor facilities. Nearby Stonehaven assets are outside scope.',
    },
    {
      suppliedName: 'Stonehaven',
      normalisedName: 'Stonehaven',
      score: 88,
      dogOwnerScore: 85,
      publish: true,
      projectId: 'stonehaven-scotland',
      rationale:
        'Independent full-day offer: harbour, 1934 lido, beach, Tolbooth Museum, food, parking, toilets and Treasure Trail; Dunnottar excluded.',
    },
    {
      suppliedName: 'Kirktown of fetteresso',
      normalisedName: 'Kirktown of Fetteresso',
      score: 62,
      dogOwnerScore: 60,
      publish: true,
      projectId: 'kirktown-of-fetteresso-scotland',
      rationale:
        'The open-access 1246 St Ciaran churchyard narrowly clears the gate as a focused medieval heritage stop.',
    },
    {
      suppliedName: 'Dunnattar',
      normalisedName: 'Dunnottar',
      score: 28,
      publish: false,
      rationale:
        'The hamlet has no independently verified public visitor offer clearing the town gate. Dunnottar Castle is outside the hamlet assessment and is published separately under See/Attractions.',
    },
    {
      suppliedName: 'Mill of Uras',
      normalisedName: 'Mill of Uras',
      score: 28,
      publish: false,
      rationale:
        'Residential/agricultural hamlet; no verified public attraction or complete visitor experience. Dunnottar and Fowlsheugh are outside its boundary.',
    },
    {
      suppliedName: 'Midtown of Barras',
      normalisedName: 'Midtown of Barras',
      score: 24,
      publish: false,
      rationale:
        'Scattered residential/agricultural locality with no verified public visitor offer.',
    },
    {
      suppliedName: 'Vaterline',
      normalisedName: 'Catterline',
      score: 72,
      dogOwnerScore: 69,
      publish: true,
      projectId: 'catterline-scotland',
      rationale:
        'Joan Eardley landscape, harbour, listed fisher row, coastal walking and the Creel Inn make a coherent visit.',
    },
    {
      suppliedName: 'Crawton',
      normalisedName: 'Crawton',
      score: 74,
      dogOwnerScore: 71,
      publish: true,
      projectId: 'crawton-scotland',
      rationale:
        'Direct gateway to the free RSPB Fowlsheugh trail and nationally important seabird colony, with exact 12-space parking data.',
    },
    {
      suppliedName: 'Slains Park',
      normalisedName: 'Slains Park',
      score: 30,
      publish: false,
      rationale:
        'Farm/residential locality and road-end name; no verified public visitor experience. Kinneff Old Kirk is not borrowed.',
    },
    {
      suppliedName: 'Fawsyde',
      normalisedName: 'Fawsyde',
      score: 36,
      publish: false,
      rationale:
        'Listed private house and later-19th-century folly do not establish public access or a visitor experience.',
    },
    {
      suppliedName: 'Roadside of Kinneff',
      normalisedName: 'Roadside of Kinneff',
      score: 43,
      publish: false,
      rationale:
        'Linear village with limited services; the late-18th-century former Rob Roy Inn and converted church do not form a current public attraction. Kinneff Old Kirk lies elsewhere.',
    },
    {
      suppliedName: 'Mowtie',
      normalisedName: 'Mill of Mowtie',
      score: 26,
      publish: false,
      rationale:
        'Mapped rural hamlet with no verified public attraction, food, trailhead or visitor facilities.',
    },
  ],
  boundaryRules: [
    'Stonehaven does not receive Dunnottar Castle points.',
    'Dunnottar hamlet is below the town threshold; Dunnottar Castle is a standalone See/Attractions place and does not create or raise a town score.',
    'Catterline and Crawton use non-overlapping study buffers; Fowlsheugh belongs to the Crawton guide because its official approach and car park are there.',
    'Private houses, farms, estate grounds and residential conversions never score as public attractions without current access evidence.',
  ],
  sources: Object.values(urls),
};

await mkdir(resolve('data/projects'), { recursive: true });
await mkdir(resolve('data/review'), { recursive: true });
for (const pkg of packages) {
  const slug = pkg.project.id.replace(/-scotland$/, '');
  await writeFile(
    resolve(`data/projects/${slug}.json`),
    `${JSON.stringify(pkg, null, 2)}\n`,
    'utf8',
  );
}
await writeFile(
  resolve('data/review/stonehaven-coast-12-settlement-gate-audit-2026-08-27.json'),
  `${JSON.stringify(review, null, 2)}\n`,
  'utf8',
);

const plannerPath = resolve('data/stonehaven-coast-visitor-planner-curation.json');
await writeFile(
  plannerPath,
  `${JSON.stringify({ schemaVersion: 1, projects: plannerProjects }, null, 2)}\n`,
  'utf8',
);
const dogPath = resolve('data/stonehaven-coast-dog-access-curation.json');
await writeFile(
  dogPath,
  `${JSON.stringify({ schemaVersion: 1, reviewedAt: reviewedDate, projects: dogProjects }, null, 2)}\n`,
  'utf8',
);

console.log(
  `Reviewed 12 settlements: published ${packages.map((pkg) => `${pkg.project.name} ${pkg.project.touristAppeal.score}`).join(', ')}; rejected 8 below 60. Dunnottar Castle published separately under See/Attractions.`,
);
