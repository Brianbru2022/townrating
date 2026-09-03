import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/killin.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/killin-visitor-audit-2026-08-06.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-06T00:00:00Z';
const reviewedDate = '2026-08-06';
const auditTag = 'killin-visitor-audit';
const visitorPackTag = 'killin-scotland-visitor-pack';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'Open Database Licence (ODbL) v1.0; (c) OpenStreetMap contributors.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Killin feature: ${id}`);
  return feature;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function removeTag(feature: HeritageFeature, tag: string): void {
  feature.tags = feature.tags.filter((candidate) => candidate !== tag);
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
        !record.sourceRecordId?.startsWith('visitor-context-curation:') &&
        !record.sourceRecordId?.startsWith('killin-scotland:') &&
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

function curatedPoint(options: {
  id: string;
  name: string;
  featureType: string;
  coordinates: [number, number];
  description: string;
  source: SourceRecord;
  tags: string[];
  address?: string;
}): HeritageFeature {
  return {
    id: options.id,
    projectId: pkg.project.id,
    name: options.name,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType: options.featureType,
    significance: 'local',
    geometry: { type: 'Point', coordinates: options.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription: options.description,
    address: options.address,
    sourceRecords: [options.source],
    tags: [...new Set([...options.tags, auditTag, visitorPackTag])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-06; excluded from historic dating and heat-map evidence.',
    evidenceScope: 'related_context',
    licence: options.source.licence,
  };
}

function updateFood(
  feature: HeritageFeature,
  options: {
    name: string;
    kind: 'cafe' | 'restaurant' | 'pub' | 'fast_food';
    score: number;
    tagline: string;
    description: string;
    opening: string;
    price: string;
    cuisine: string;
    website: string;
    organisation: string;
    address: string;
    reliability?: SourceRecord['reliability'];
    dogFriendlySourceUrl?: string;
  },
): HeritageFeature {
  feature.name = options.name;
  feature.featureType = options.kind;
  feature.shortDescription = options.description;
  feature.address = options.address;
  addTags(
    feature,
    'current-context',
    'service-context-food',
    'visitor-context-food',
    auditTag,
    visitorPackTag,
  );
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${options.name} visitor information`,
      options.organisation,
      `visitor-audit:food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.kind}; name=${options.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}.`,
      options.reliability,
    ),
  );
  if (options.dogFriendlySourceUrl) {
    feature.sourceRecords.push(
      currentSource(
        `${options.name} dog-friendly evidence`,
        'Current visitor reporting',
        `visitor-audit:dog:${feature.id}`,
        options.dogFriendlySourceUrl,
        'Current-place curation: dog_friendly=yes.',
        'secondary',
      ),
    );
    feature.reviewNotes = `${feature.reviewNotes ?? ''} Dogs welcome according to the linked current visitor evidence.`.trim();
  }
  return feature;
}

function newFood(options: {
  id: string;
  name: string;
  kind: 'cafe' | 'restaurant' | 'pub' | 'fast_food';
  coordinates: [number, number];
  score: number;
  tagline: string;
  description: string;
  opening: string;
  price: string;
  cuisine: string;
  website: string;
  organisation: string;
  address: string;
  reliability?: SourceRecord['reliability'];
  dogFriendlySourceUrl?: string;
}): HeritageFeature {
  return updateFood(
    upsertFeature(
      curatedPoint({
        id: options.id,
        name: options.name,
        featureType: options.kind,
        coordinates: options.coordinates,
        description: options.description,
        address: options.address,
        source: currentSource(
          `${options.name} location`,
          'OpenStreetMap contributors',
          `visitor-audit:location:${options.id}`,
          `https://www.openstreetmap.org/?mlat=${options.coordinates[1]}&mlon=${options.coordinates[0]}#map=19/${options.coordinates[1]}/${options.coordinates[0]}`,
          `Current-place geometry for ${options.name}.`,
          'secondary',
          osmLicence,
        ),
        tags: ['current-context', 'service-context-food', 'visitor-context-food'],
      }),
    ),
    options,
  );
}

function trail(options: {
  id: string;
  name: string;
  coordinates: [number, number];
  score: number;
  trailType: string;
  description: string;
  distance: string;
  time: string;
  accessibility: string;
  website: string;
  organisation?: string;
}): HeritageFeature {
  return upsertFeature(
    curatedPoint({
      id: options.id,
      name: options.name,
      featureType: 'walking_route',
      coordinates: options.coordinates,
      description: options.description,
      source: currentSource(
        `${options.name} route information`,
        options.organisation ?? 'Loch Lomond and The Trossachs National Park Authority',
        `visitor-audit:trail:${options.id}`,
        options.website,
        `Current-place curation: route=foot; name=${options.name}; trail_type=${options.trailType}; visit_score=${options.score}; distance=${options.distance}; time_to_spend=${options.time}; accessibility=${options.accessibility}; entrance_fee=Free; description=${options.description}; website=${options.website}.`,
      ),
      tags: ['current-context', 'service-context-walk', 'visitor-context-trail'],
    }),
  );
}

pkg.project.centre = [-4.3182, 56.4682];
pkg.project.touristAppeal = {
  rating: 3,
  label: 'Destination draw',
  summary:
    'Killin earns three stars because the Falls of Dochart create a memorable national-quality landscape stop, while the Old Mill, Finlarig Castle, a strong village food cluster and several well-defined walks and cycle routes provide enough depth for a rewarding half or full day. Nearby attractions outside the settlement boundary do not contribute to this rating.',
};

pkg.project.visualIdentity = {
  theme: 'waterfall-bridge-and-breadalbane',
  badgeImage: '/town-guides/killin-falls-of-dochart-watercolour-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of the Falls of Dochart, the historic stone bridge and Killin beneath the Breadalbane hills',
  heroImage: '/town-guides/killin-falls-of-dochart-watercolour-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of the Falls of Dochart, the historic stone bridge and Killin beneath the Breadalbane hills',
  primaryColour: '#173F43',
  accentColour: '#B97A2E',
  backgroundColour: '#EFF5E9',
  heroObjectPosition: '52% 54%',
  motifs: ['Falls of Dochart', 'Stone bridge', 'Highland heritage', 'Woodland trails'],
};

pkg.project.townGuide = {
  headline: 'A Highland village shaped by rushing water, old stone and big landscapes',
  intro:
    'Killin gathers an unusually rich visitor day around one compact Main Street. The Falls of Dochart rush beneath the old bridge at the village entrance; beside them, the restored Old Mill tells local stories through its waterwheel, makers and St Fillan traditions. Woodland routes, railway viaducts and the ruins of Finlarig Castle then open the visit towards Loch Tay and Breadalbane.',
  bestFor: ['Waterfalls', 'Highland scenery', 'Local heritage', 'Walking and cycling'],
  perfectFor: [
    'A Falls-and-village stop with lunch',
    'A half-day heritage trail through Killin',
    'A full outdoor day using the village as a trail base',
  ],
  suggestedFirstVisit: {
    title: 'Falls, Old Mill and the village trail',
    summary:
      'Begin at the Falls of Dochart and old bridge, step into the Old Mill when it is open, then follow the heritage trail up Main Street and through Breadalbane Park before choosing Finlarig Castle or a longer woodland route.',
  },
  dontMiss: [
    'Falls of Dochart and historic bridge',
    'The Old Mill and St Fillan traditions',
    'Killin Heritage Trail',
  ],
  suggestedTime: 'Half a day; a full day with a longer walk, cycle or relaxed meal',
  visitorMood:
    'A lively Highland base where a famous waterfall, village history and easy access to forest and loch-side routes make it worth a journey in its own right.',
  sourceUrls: [
    'https://www.lochlomond-trossachs.org/discover-the-park/towns-villages/killin/',
    'https://www.lochlomond-trossachs.org/discover-the-park/our-heritage-culture/heritage-walks/killin-heritage-trail/',
    'https://www.lochlomond-trossachs.org/things-to-do/walking/short-moderate-walks/acharn-forest-killin/',
    'https://killincdt.co.uk/project-oldmill',
    'https://www.killincdt.co.uk/',
    'https://portal.historicenvironment.scot/designation/SM4675',
    'https://portal.historicenvironment.scot/designation/SM1557',
    'https://trustinthepark.org/tred-active-travel/cycling-routes/cycling-meanders/killin/',
    'https://www.thecourieinn.com/',
    'https://www.killinhotel.com/dining/',
    'https://theriverinn.co.uk/',
    'https://www.fallsofdochart.co.uk/food-and-drink/',
    'https://www.stirling.gov.uk/community-life-and-leisure/parks-walking-trails-and-cycle-paths/parks-in-stirling/parks-in-stirling/killin-breadalbane-park/',
    'https://www.stirling.gov.uk/community-life-and-leisure/public-toilets/list-of-the-public-toilets-in-stirling/killin-falls-of-dochart/',
    'https://www.stirling.gov.uk/community-life-and-leisure/public-toilets/list-of-the-public-toilets-in-stirling/killin-station-road/',
    'https://www.stirling.gov.uk/community-life-and-leisure/libraries-and-archives/libraries/libraries-in-stirling/list-of-libraries/killin-library/',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Killin town study area is missing');
townStudyArea.visitorBoundary = pkg.project.boundary;
townStudyArea.notes =
  'The active visitor boundary remains the official NRS 2022 Killin locality. It already includes the Falls of Dochart, Kinnell stone circle, Breadalbane Park, Finlarig Castle and the town-centre visitor services. Moirlanich Longhouse and wider Loch Tay or glen attractions remain outside the town planner. Trail markers begin inside the locality although routes may continue beyond it.';
pkg.project.researchNotes =
  'Full visitor audit completed 2026-08-06. Only named, researched places inside the NRS Killin locality are published in the town planner. Customer-only and uncertain-access parking is excluded, and Moirlanich Longhouse is retained only as wider-area context.';

const falls = featureById('osm-community:node-368979641');
falls.name = 'Falls of Dochart and historic bridge';
falls.featureType = 'waterfall';
falls.shortDescription =
  'Broad rocky cascades surge beneath Killin\'s old stone bridge and around Inchbuie, creating one of Scotland\'s most memorable village-centre landscapes.';
addTags(falls, 'current-context', 'service-context-visitor', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  falls,
  currentSource(
    'Killin visitor information',
    'Loch Lomond and The Trossachs National Park Authority',
    'visitor-audit:attraction:falls-of-dochart',
    'https://www.lochlomond-trossachs.org/discover-the-park/towns-villages/killin/',
    'Current-place curation: tourism=attraction; name=Falls of Dochart and historic bridge; visitor_place_type=Waterfall and historic bridge; visit_score=89; opening_hours:description=Open-access outdoor landmark, best seen in daylight. Water levels and spray vary; remain in safe public viewing areas and take care beside bridge traffic; entrance_fee=Free; time_to_spend=30-60 minutes; description=See the River Dochart break over broad rock shelves beneath the historic bridge, with Inchbuie and the Highland village gathered around it; website=https://www.lochlomond-trossachs.org/discover-the-park/towns-villages/killin/.',
  ),
);

const oldMill = featureById('hes-listed-building:LB8274');
oldMill.name = 'The Old Mill and St Fillan traditions';
oldMill.featureType = 'museum';
oldMill.shortDescription =
  'A restored 1840s watermill beside the Falls, now a community heritage and makers hub with a working waterwheel and the continuing story of St Fillan\'s healing stones.';
addTags(oldMill, 'current-context', 'service-context-visitor', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  oldMill,
  currentSource(
    'The Old Mill',
    'Killin and Ardeonaig Community Development Trust',
    'visitor-audit:attraction:old-mill',
    'https://killincdt.co.uk/project-oldmill',
    'Current-place curation: tourism=attraction; name=The Old Mill and St Fillan traditions; visitor_place_type=Working watermill and community heritage hub; visit_score=78; opening_hours:description=The 2026 visitor listing gives Wednesday-Saturday 10:00-17:00, but community events and seasonal hours vary; check before a special journey; entrance_fee=Free entry, purchases and donations optional; time_to_spend=45-75 minutes; description=Explore a working waterwheel, local makers and the unusual St Fillan traditions in the historic mill beside the Falls; website=https://killincdt.co.uk/project-oldmill/.',
  ),
);

const finlarig = featureById('nrhe:24194');
finlarig.name = 'Finlarig Castle and Breadalbane Mausoleum';
finlarig.featureType = 'castle_ruins';
finlarig.shortDescription =
  'Atmospheric but fragile ruins linked to the Campbells of Glenorchy, with earthworks and the later Breadalbane Mausoleum in a quiet woodland setting.';
addTags(finlarig, 'current-context', 'service-context-visitor', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  finlarig,
  currentSource(
    'Finlarig Castle, castle, earthworks and mausoleum',
    'Historic Environment Scotland',
    'visitor-audit:attraction:finlarig-castle',
    'https://portal.historicenvironment.scot/designation/SM4675',
    'Current-place curation: tourism=attraction; name=Finlarig Castle and Breadalbane Mausoleum; visitor_place_type=Castle ruins and mausoleum; visit_score=67; opening_hours:description=Unstaffed outdoor ruins, daylight visit recommended. Obey fencing and local safety signs and do not climb unstable masonry; entrance_fee=Free; time_to_spend=30-45 minutes; description=Walk to the atmospheric remains of a Campbell stronghold and its later mausoleum, valued more for setting and history than for extensive surviving interiors; website=https://portal.historicenvironment.scot/designation/SM4675.',
    'official_statutory',
  ),
);

const stoneCircle = featureById('osm-community:way-386515817');
stoneCircle.name = 'Kinnell Park stone circle';
stoneCircle.featureType = 'archaeological_site';
stoneCircle.shortDescription =
  'A compact prehistoric ring of six stones in a grazing field east of the village, with a strong relationship to the surrounding Highland landscape.';
removeTag(stoneCircle, 'service-context-visitor');
addTags(stoneCircle, 'current-context', 'visitor-audit-excluded', auditTag, visitorPackTag);
stoneCircle.reviewNotes =
  'Excluded from Killin\'s town planner because its mapped centre falls just outside the active NRS locality. It remains nearby archaeological context only, and access crosses private estate and grazing land.';
stoneCircle.updatedAt = reviewedAt;
stoneCircle.reviewed = true;

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: falls.id,
    name: falls.name,
    reason:
      'The River Dochart pours across broad rock shelves beneath the old bridge, making the first view into Killin feel dramatic, immediate and unmistakably Highland.',
    tagline: 'Highland waterfall landmark',
    visitorScore: 89,
    openingTimes:
      'Open-access outdoor landmark. Visit in daylight, remain in safe public viewing areas and take care beside bridge traffic and fast water.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Loch Lomond and The Trossachs National Park Authority',
    sourceUrl: 'https://www.lochlomond-trossachs.org/discover-the-park/towns-villages/killin/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: oldMill.id,
    name: oldMill.name,
    reason:
      'The old watermill turns the Falls into more than a photo stop, adding a working wheel, local makers and an unusual living tradition around St Fillan.',
    tagline: 'Watermill and living heritage',
    visitorScore: 78,
    openingTimes:
      'The current 2026 visitor listing gives Wednesday-Saturday 10:00-17:00. Community events and seasonal hours vary, so check before travelling specifically.',
    admission: 'Free entry; purchases and donations are optional.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Killin and Ardeonaig Community Development Trust',
    sourceUrl: 'https://killincdt.co.uk/project-oldmill',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: finlarig.id,
    name: finlarig.name,
    reason:
      'A quiet woodland walk leads to the fragile remains of a Campbell stronghold and the Breadalbane Mausoleum, adding atmosphere and clan history to the village visit.',
    tagline: 'Campbell castle ruins',
    visitorScore: 67,
    openingTimes:
      'Unstaffed outdoor ruins. Visit in daylight, obey fencing and safety signs, and do not climb unstable masonry.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: ['HES'],
    sourceName: 'Historic Environment Scotland',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/SM4675',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const courie = newFood({
  id: 'curated-food:killin-courie-inn',
  name: 'The Courie Inn',
  kind: 'restaurant',
  coordinates: [-4.3190019, 56.4656597],
  score: 88,
  tagline: 'Best evening meal',
  description:
    'A family-run bistro and bar serving polished, home-cooked Scottish food in a warm contemporary inn; the strongest destination meal in the village.',
  opening: 'Daily from 15:00; food from 17:00. Seasonal variations apply.',
  price: '££',
  cuisine: 'Modern Scottish bistro',
  website: 'https://www.thecourieinn.com/restaurant-bar/',
  organisation: 'The Courie Inn',
  address: 'Main Street, Killin, FK21 8UT',
  dogFriendlySourceUrl:
    'https://www.tripadvisor.co.uk/Restaurants-g551940-Killin_Loch_Tay_Loch_Lomond_and_The_Trossachs_National_Park_Scotland.html',
});

const kula = updateFood(featureById('osm-community:node-5459670520'), {
  name: 'Kula Coffee Shop',
  kind: 'cafe',
  score: 81,
  tagline: 'Best coffee and baking',
  description:
    'A bright town-centre cafe for coffee, generous home baking, brunch and light lunch, with strong recent praise for its scones and cakes.',
  opening:
    'Published daily hours appear to be 10:00-16:00, but the current listing is malformed; confirm before making a special journey.',
  price: '££',
  cuisine: 'Coffee, home baking and light lunches',
  website:
    'https://www.tripadvisor.co.uk/Restaurant_Review-g551940-d33264062-Reviews-Kula-Killin_Loch_Tay_Loch_Lomond_and_The_Trossachs_National_Park_Scotland.html',
  organisation: 'Kula Coffee Shop',
  address: 'Craiglea, Main Street, Killin, FK21 8UN',
  reliability: 'secondary',
});

const killinHotel = newFood({
  id: 'curated-food:killin-hotel-riverview',
  name: 'Killin Hotel Riverview Restaurant',
  kind: 'restaurant',
  coordinates: [-4.3172479, 56.4699829],
  score: 78,
  tagline: 'Reliable all-day choice',
  description:
    'A useful year-round hotel restaurant overlooking the River Lochay, covering breakfast, lunch and dinner with Scottish comfort dishes and a broad menu.',
  opening:
    'Breakfast 07:30-09:30 / lunch 12:00-15:00 / dinner 17:30-20:30. Menus and times vary seasonally; advance booking is requested.',
  price: '££',
  cuisine: 'Scottish hotel dining',
  website: 'https://www.killinhotel.com/dining/',
  organisation: 'Killin Hotel',
  address: 'Main Street, Killin, FK21 8TP',
});

const riverInn = updateFood(featureById('osm-community:node-335564591'), {
  name: 'The River Inn',
  kind: 'restaurant',
  score: 76,
  tagline: 'Riverside Mediterranean',
  description:
    'A relaxed riverside restaurant serving generous Mediterranean and European dishes, with an outlook over the River Dochart and a notably different menu from the village inns.',
  opening:
    'Current booking listings give Wednesday-Sunday 12:00-21:00, closed Monday-Tuesday. Confirm directly because published hours conflict.',
  price: '££',
  cuisine: 'Mediterranean and European',
  website: 'https://theriverinn.co.uk/',
  organisation: 'The River Inn',
  address: 'Main Street, Killin, FK21 8UT',
  dogFriendlySourceUrl:
    'https://www.tripadvisor.com/Hotel_Review-g551940-d33087539-Reviews-The_River_Inn-Killin_Loch_Tay_Loch_Lomond_and_The_Trossachs_National_Park_Scotland.html',
});

const fallsInn = updateFood(featureById('osm-community:node-1834676847'), {
  name: 'Falls of Dochart Inn and Smokehouse',
  kind: 'restaurant',
  score: 74,
  tagline: 'Best waterfall setting',
  description:
    'Scottish food, coffee, smoked salmon and tasting platters in the village\'s most dramatic setting, directly beside the Falls and historic bridge.',
  opening:
    'Coffee shop daily 09:00-17:00 / smokehouse counter daily 10:00-17:00 / restaurant weekdays 12:00-15:00 and 17:00-21:00, all day at weekends. Off-season restaurant closures can apply.',
  price: '££',
  cuisine: 'Scottish inn food and smokehouse produce',
  website: 'https://www.fallsofdochart.co.uk/food-and-drink/',
  organisation: 'Falls of Dochart Inn and Smokehouse',
  address: 'Gray Street, Killin, FK21 8SL',
  dogFriendlySourceUrl:
    'https://www.tripadvisor.co.uk/Restaurant_Review-g551940-d21343273-Reviews-Falls_of_Dochart_Smokehouse_and_Tasting_Counter-Killin_Loch_Tay_Loch_Lomond_and_.html',
});

const secretPizza = newFood({
  id: 'curated-food:killin-secret-pizza',
  name: 'Secret Pizza',
  kind: 'fast_food',
  coordinates: [-4.3186363, 56.4668777],
  score: 72,
  tagline: 'Best takeaway',
  description:
    'A small, well-regarded takeaway for freshly made pizza and occasional specials; ordering ahead is sensible because capacity is limited.',
  opening:
    'Published Thursday-Sunday 16:00-20:00, closed Monday-Wednesday. Hours can change, so order ahead.',
  price: '£',
  cuisine: 'Pizza takeaway',
  website:
    'https://www.tripadvisor.co.uk/Restaurant_Review-g551940-d28001751-Reviews-Secret_Pizza-Killin_Loch_Tay_Loch_Lomond_and_The_Trossachs_National_Park_Scotlan.html',
  organisation: 'Secret Pizza',
  address: 'Main Street, Killin, FK21 8UW',
  reliability: 'secondary',
});

const sron = trail({
  id: 'curated-trail:killin-sron-a-chlachain',
  name: "Sron A' Chlachain hill walk",
  coordinates: [-4.31862, 56.4687],
  score: 86,
  trailType: 'Steep hill walk from Breadalbane Park',
  description:
    'A short but steep climb from Breadalbane Park to the 400-metre summit above Killin, trading effort for wide views over Loch Tay, the village and Breadalbane.',
  distance: 'About 2 miles / 3 kilometres return',
  time: 'Allow 2-3 hours',
  accessibility:
    'Steep rough hill paths with sustained ascent; boots, weather awareness and normal hill-walking care are required.',
  website: 'https://www.lochlomond-trossachs.org/discover-the-park/towns-villages/killin/',
});

const heritageTrail = trail({
  id: 'curated-trail:killin-heritage-trail',
  name: 'Killin Heritage Trail',
  coordinates: [-4.32076, 56.46275],
  score: 84,
  trailType: 'Easy village heritage walk',
  description:
    'An easy signed wander connecting the Falls, Old Mill, Main Street, churches, Breadalbane Park and the stories that shaped Killin.',
  distance: '1-2 miles / 1.5-3 kilometres',
  time: '30-60 minutes, longer with stops',
  accessibility: 'Mostly pavements and firm-surfaced paths.',
  website:
    'https://www.lochlomond-trossachs.org/discover-the-park/our-heritage-culture/heritage-walks/killin-heritage-trail/',
});

const cycleMeander = featureById(
  'curated-attraction:killin-killin-viaducts-loch-tay-cycle-walk',
);
cycleMeander.name = 'Killin viaducts and Loch Tay cycle meander';
cycleMeander.featureType = 'walking_route';
cycleMeander.shortDescription =
  'A gentle village circuit from McLaren Hall across the old Dochart and Lochay railway viaducts to Pier Road and the head of Loch Tay.';
removeTag(cycleMeander, 'service-context-visitor');
addTags(
  cycleMeander,
  'current-context',
  'service-context-walk',
  'visitor-context-trail',
  auditTag,
  visitorPackTag,
);
replaceCurrentCurationSource(
  cycleMeander,
  currentSource(
    'Killin Cycle Meander Routes',
    'Loch Lomond and The Trossachs Countryside Trust',
    'visitor-audit:trail:killin-viaducts-loch-tay-meander',
    'https://trustinthepark.org/tred-active-travel/cycling-routes/cycling-meanders/killin/',
    'Current-place curation: route=bicycle; name=Killin viaducts and Loch Tay cycle meander; trail_type=Easy village and loch-side cycle circuit; visit_score=82; distance=Short local figure-of-eight circuit; time_to_spend=60-120 minutes; accessibility=Shared gravel paths, quiet roads and short Main Street sections; entrance_fee=Free; description=Ride from McLaren Hall across the former railway viaducts to Pier Road and the head of Loch Tay; website=https://trustinthepark.org/tred-active-travel/cycling-routes/cycling-meanders/killin/.',
  ),
);

const acharn = trail({
  id: 'curated-trail:killin-acharn-forest',
  name: 'Acharn Forest circuit',
  coordinates: [-4.32055, 56.4627],
  score: 78,
  trailType: 'Easy forest circuit',
  description:
    'An easy woodland circuit from the south-west edge of Killin following the old railway and National Cycle Route 7 through mixed forest.',
  distance: '4 miles / 6 kilometres',
  time: 'Allow 1.5-2.5 hours',
  accessibility: 'Well-compacted forest paths with some loose material and moderate gradients.',
  website:
    'https://www.lochlomond-trossachs.org/things-to-do/walking/short-moderate-walks/acharn-forest-killin/',
});

const mclarenParking = featureById(
  'curated-parking:killin-mclaren-hall-breadalbane-parking',
);
mclarenParking.name = 'McLaren Hall and Breadalbane Park car park';
mclarenParking.featureType = 'parking';
mclarenParking.shortDescription =
  'Free public surface parking beside McLaren Hall and Breadalbane Park, convenient for the village centre and trail starts.';
mclarenParking.address = 'Main Street, Killin, FK21 8TN';
addTags(mclarenParking, 'current-context', 'service-context-parking', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  mclarenParking,
  currentSource(
    'Killin Breadalbane Park visitor facilities',
    'Stirling Council',
    'visitor-audit:parking:mclaren-hall',
    'https://www.stirling.gov.uk/community-life-and-leisure/parks-walking-trails-and-cycle-paths/parks-in-stirling/parks-in-stirling/killin-breadalbane-park/',
    'Current-place curation: amenity=parking; name=McLaren Hall and Breadalbane Park car park; parking=surface; access=public; price_display=Free; payment_required=no; opening_hours:description=Open-access outdoor car park, observe current signs; description=Free parking beside McLaren Hall and Breadalbane Park; website=https://www.stirling.gov.uk/community-life-and-leisure/parks-walking-trails-and-cycle-paths/parks-in-stirling/parks-in-stirling/killin-breadalbane-park/.',
    'local_authority',
  ),
);

const stationParking = featureById('curated-parking:killin-station-road-turning-circle');
stationParking.name = 'Station Road car park';
stationParking.featureType = 'parking';
stationParking.shortDescription =
  'Central surface car park beside the former station site and accessible council toilet; free status is secondary-source information, so visitors should check current signs.';
stationParking.address = 'Station Road, Killin, FK21 8UT';
addTags(stationParking, 'current-context', 'service-context-parking', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  stationParking,
  currentSource(
    'Station Road car park mapping',
    'OpenStreetMap contributors',
    'visitor-audit:parking:station-road',
    'https://www.openstreetmap.org/way/34078027',
    'Current-place curation: amenity=parking; name=Station Road car park; parking=surface; access=public; capacity=Approximately 30 spaces from a current secondary listing; price_display=Free; payment_required=no; pricing_note=Free status is from a current secondary listing because OSM and the council toilet page do not publish a tariff. Check current signs; opening_hours:description=Open-access outdoor car park, observe current signs; description=Central car park beside the former station site and accessible council toilet; website=https://www.openstreetmap.org/way/34078027.',
    'secondary',
    osmLicence,
  ),
);

const mainStreetParking = upsertFeature(
  curatedPoint({
    id: 'curated-parking:killin-main-street-public-bays',
    name: 'Main Street public parking bays near the Falls',
    featureType: 'parking',
    coordinates: [-4.3186694, 56.4642908],
    description:
      'Two small free public surface parking areas on Main Street between the Falls and village centre.',
    address: 'Main Street, Killin, FK21 8UT',
    source: currentSource(
      'Main Street public parking mapping',
      'OpenStreetMap contributors',
      'visitor-audit:parking:main-street-bays',
      'https://www.openstreetmap.org/way/241940357',
      'Current-place curation: amenity=parking; name=Main Street public parking bays near the Falls; parking=surface; access=public; price_display=Free; payment_required=no; pricing_note=OSM ways 241940357 and 241940358 both record access=yes and fee=no; opening_hours:description=Open-access outdoor bays, observe current signs; description=Small free public parking areas on Main Street between the Falls and village centre; website=https://www.openstreetmap.org/way/241940357.',
      'secondary',
      osmLicence,
    ),
    tags: ['current-context', 'service-context-parking'],
  }),
);

const fallsToilets = upsertFeature(
  curatedPoint({
    id: 'curated-toilets:killin-falls-of-dochart',
    name: 'Falls of Dochart public toilets, Main Street',
    featureType: 'toilets',
    coordinates: [-4.3210669, 56.4631155],
    description:
      'Free 24-hour council public toilets beside the Falls of Dochart; no accessible toilet or baby-changing facility is listed.',
    address: 'Main Street, Killin, FK21 8XE',
    source: currentSource(
      'Killin Falls of Dochart public toilets',
      'Stirling Council',
      'visitor-audit:toilets:falls-of-dochart',
      'https://www.stirling.gov.uk/community-life-and-leisure/public-toilets/list-of-the-public-toilets-in-stirling/killin-falls-of-dochart/',
      'Current-place curation: amenity=toilets; name=Falls of Dochart public toilets, Main Street; access=public; price_display=Free; opening_hours:description=Open 24 hours; wheelchair=no; baby_changing=no; description=Council public toilets beside the Falls of Dochart; website=https://www.stirling.gov.uk/community-life-and-leisure/public-toilets/list-of-the-public-toilets-in-stirling/killin-falls-of-dochart/.',
      'local_authority',
    ),
    tags: ['current-context', 'service-context-toilets'],
  }),
);

const stationToilets = upsertFeature(
  curatedPoint({
    id: 'curated-toilets:killin-station-road',
    name: 'Station Road public toilets, Main Street',
    featureType: 'toilets',
    coordinates: [-4.3148621, 56.4700565],
    description:
      'Free 24-hour council public toilets at Station Road, including disabled access but no baby-changing facility.',
    address: 'Station Road, Main Street, Killin',
    source: currentSource(
      'Killin Station Road public toilets',
      'Stirling Council',
      'visitor-audit:toilets:station-road',
      'https://www.stirling.gov.uk/community-life-and-leisure/public-toilets/list-of-the-public-toilets-in-stirling/killin-station-road/',
      'Current-place curation: amenity=toilets; name=Station Road public toilets, Main Street; access=public; price_display=Free; opening_hours:description=Open 24 hours; wheelchair=yes; baby_changing=no; description=Council public toilets at Station Road with disabled access; website=https://www.stirling.gov.uk/community-life-and-leisure/public-toilets/list-of-the-public-toilets-in-stirling/killin-station-road/.',
      'local_authority',
    ),
    tags: ['current-context', 'service-context-toilets'],
  }),
);

const libraryToilets = upsertFeature(
  curatedPoint({
    id: 'curated-toilets:killin-library',
    name: 'Killin Library toilets, Main Street',
    featureType: 'toilets',
    coordinates: [-4.31901, 56.4677604],
    description:
      'Visitor toilets inside Killin Library, available only during staffed library opening hours.',
    address: 'Main Street, Killin, FK21 8UW',
    source: currentSource(
      'Killin Library facilities',
      'Stirling Council',
      'visitor-audit:toilets:killin-library',
      'https://www.stirling.gov.uk/community-life-and-leisure/libraries-and-archives/libraries/libraries-in-stirling/list-of-libraries/killin-library/',
      'Current-place curation: amenity=toilets; name=Killin Library toilets, Main Street; access=public during library opening hours; price_display=Free; opening_hours:description=Monday 10:00-13:00 and 14:00-17:00 / Tuesday 10:00-13:00 and 15:00-19:00 / Wednesday 14:00-17:00 / Friday 10:00-13:00 and 15:00-19:00 / closed Thursday and weekends; wheelchair=Ramp access is available; description=Visitor toilets inside Killin Library during staffed hours; website=https://www.stirling.gov.uk/community-life-and-leisure/libraries-and-archives/libraries/libraries-in-stirling/list-of-libraries/killin-library/.',
      'local_authority',
    ),
    tags: ['current-context', 'service-context-toilets'],
  }),
);

const breadalbanePicnic = upsertFeature(
  curatedPoint({
    id: 'curated-picnic:killin-breadalbane-park',
    name: 'Breadalbane Park picnic tables, Main Street',
    featureType: 'picnic_site',
    coordinates: [-4.31915, 56.46873],
    description:
      'Named public picnic tables and seating in Breadalbane Park, close to the play area, McLaren Hall and village trail starts.',
    address: 'Breadalbane Park, Main Street, Killin, FK21 8TN',
    source: currentSource(
      'Killin Breadalbane Park',
      'Stirling Council',
      'visitor-audit:picnic:breadalbane-park',
      'https://www.stirling.gov.uk/community-life-and-leisure/parks-walking-trails-and-cycle-paths/parks-in-stirling/parks-in-stirling/killin-breadalbane-park/',
      'Current-place curation: tourism=picnic_site; name=Breadalbane Park picnic tables, Main Street; access=public; price_display=Free; opening_hours:description=Open-access public park, daylight use recommended; description=Public picnic tables and seating in Breadalbane Park beside the village centre; website=https://www.stirling.gov.uk/community-life-and-leisure/parks-walking-trails-and-cycle-paths/parks-in-stirling/parks-in-stirling/killin-breadalbane-park/.',
      'local_authority',
    ),
    tags: ['current-context', 'service-context-picnic'],
  }),
);

curationLibrary.projects[pkg.project.id] = {
  ...(curationLibrary.projects[pkg.project.id] ?? {}),
  eat: [courie.id, kula.id, killinHotel.id, riverInn.id, fallsInn.id, secretPizza.id],
  trails: [sron.id, heritageTrail.id, cycleMeander.id, acharn.id],
  picnic: [breadalbanePicnic.id],
  parking: [mclarenParking.id, stationParking.id, mainStreetParking.id],
  toilets: [fallsToilets.id, stationToilets.id, libraryToilets.id],
};

const outdoorHire = featureById('curated-attraction:killin-killin-outdoor-centre-hires');
removeTag(outdoorHire, 'service-context-visitor');
addTags(outdoorHire, 'visitor-audit-excluded', auditTag);
outdoorHire.reviewNotes =
  'Excluded from the See list because it is equipment hire rather than a visitor attraction. It remains useful wider activity context.';
outdoorHire.updatedAt = reviewedAt;
outdoorHire.reviewed = true;

const excludedParkingIds = new Set([
  'osm-community:way-172578588',
  'osm-community:way-1044483724',
  'osm-community:way-330445908',
  'osm-community:way-330445909',
  'osm-community:way-698256524',
  'osm-community:way-698256634',
  'osm-community:node-409752650',
  'osm-community:node-2368964476',
  'osm-community:node-2368964478',
]);
for (const feature of pkg.features) {
  if (!excludedParkingIds.has(feature.id)) continue;
  addTags(feature, 'visitor-audit-excluded', auditTag);
  feature.reviewNotes =
    feature.id === 'osm-community:way-172578588' ||
    feature.id === 'osm-community:way-1044483724'
      ? 'Excluded from Killin\'s public planner because OSM records customer-only access.'
      : 'Excluded from Killin\'s public planner because public access, purpose or current visitor terms are not sufficiently verified.';
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

const publicFeatureIds = [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicFeatureIds)) {
  const feature = featureById(featureId);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Killin public visitor feature is not a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), pkg.project.boundary)) {
    throw new Error(`Killin public visitor feature falls outside the NRS locality: ${featureId}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    rating: pkg.project.touristAppeal.rating,
    rationale:
      'Three stars are retained. The Falls of Dochart are a genuine national-quality landscape anchor, and the Old Mill, Finlarig, food cluster and well-defined trail network give the settlement enough depth for a half or full day without relying on nearby out-of-boundary attractions.',
  },
  boundaryRule:
    'The official NRS 2022 Killin locality remains the active visitor boundary. Every published marker is inside it. Moirlanich Longhouse and wider Loch Tay or glen attractions are excluded from Killin\'s town planner. Trail routes may leave the locality after starting at an in-boundary marker.',
  published: {
    attractions: pkg.project.visitorHighlights.map((highlight) => ({
      name: highlight.name,
      score: highlight.visitorScore,
      featureId: highlight.featureId,
    })),
    eat: curationLibrary.projects[pkg.project.id].eat,
    trails: curationLibrary.projects[pkg.project.id].trails,
    parking: curationLibrary.projects[pkg.project.id].parking,
    toilets: curationLibrary.projects[pkg.project.id].toilets,
    picnic: curationLibrary.projects[pkg.project.id].picnic,
  },
  excluded: [
    {
      name: 'Moirlanich Longhouse',
      reason:
        'Outside the active NRS Killin locality. It remains a worthwhile nearby attraction but does not appear in the town planner or influence the town rating.',
    },
    {
      name: 'Kinnell Park stone circle',
      reason:
        'Its mapped centre falls just outside the active NRS Killin locality. It remains nearby archaeological context and its approach also requires care around private estate and grazing land.',
    },
    {
      name: 'Killin Outdoor Centre hire desk',
      reason:
        'Useful activity support but not an attraction in itself; route experiences are represented under Trails instead.',
    },
    {
      name: 'Falls of Dochart Inn and Co-op customer parking',
      reason: 'OSM records customer-only access, so neither is published as public visitor parking.',
    },
    {
      name: 'Golf, cemetery, Pier Road and unnamed edge parking',
      reason:
        'Excluded because public access, intended visitor use or current charging terms could not be defended.',
    },
    {
      name: 'Boathouse Kitchen, Moirlanich and wider Loch Tay businesses',
      reason: 'Outside the active settlement polygon and therefore not part of Killin\'s planner.',
    },
  ],
  artwork: {
    asset: '/town-guides/killin-falls-of-dochart-watercolour-guide.png',
    treatment:
      'Text-free original light ink-and-watercolour visitor-guide illustration centred on the Falls of Dochart and historic bridge.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Killin visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trails, ${curationLibrary.projects[pkg.project.id].parking.length} car parks, ${curationLibrary.projects[pkg.project.id].toilets.length} toilets and ${curationLibrary.projects[pkg.project.id].picnic.length} picnic location. Rating: ${pkg.project.touristAppeal.rating} stars.`,
);
