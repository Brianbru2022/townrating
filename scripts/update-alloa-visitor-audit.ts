import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/alloa.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-05T00:00:00Z';
const reviewedDate = '2026-08-05';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Alloa feature: ${id}`);
  return feature;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function replaceCurrentCurationSource(feature: HeritageFeature, source: SourceRecord): void {
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (record) =>
        !record.notes?.startsWith('Current-place curation') &&
        !record.notes?.startsWith('Current-context curation'),
    ),
    source,
  ];
  feature.licence ??= editorialMetadataLicence;
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

function currentSource(
  sourceName: string,
  sourceOrganisation: string,
  sourceRecordId: string,
  sourceUrl: string,
  notes: string,
  reliability: SourceRecord['reliability'] = 'official_non_statutory',
): SourceRecord {
  return {
    sourceName,
    sourceOrganisation,
    sourceRecordId,
    sourceUrl,
    accessedAt: reviewedAt,
    licence: editorialMetadataLicence,
    reliability,
    notes,
  };
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
  locationType: HeritageFeature['locationType'] = 'exact',
  locationConfidence: HeritageFeature['locationConfidence'] = 'high',
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
    locationType,
    locationConfidence,
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription,
    sourceRecords: [source],
    tags,
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-05; it is excluded from historic dating and heat-map evidence.',
    evidenceScope: 'related_context',
    licence: editorialMetadataLicence,
  };
}

function updateFood(
  id: string,
  options: {
    score: number;
    tagline: string;
    description: string;
    opening: string;
    price: string;
    cuisine: string;
    website: string;
    organisation: string;
    kind: 'cafe' | 'restaurant';
    reliability?: SourceRecord['reliability'];
    dogFriendly?: boolean;
  },
): void {
  const feature = featureById(id);
  feature.shortDescription = options.description;
  addTags(feature, 'service-context-food', 'alloa-visitor-audit', 'visitor-context-food');
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${feature.name} visitor audit`,
      options.organisation,
      `visitor-audit-food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.kind}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}${options.dogFriendly ? '; dog_friendly=yes' : ''}.`,
      options.reliability ?? 'secondary',
    ),
  );
}

pkg.project.touristAppeal = {
  rating: 2,
  label: 'Worth a planned stop',
  summary:
    'Worth a planned half-day when Alloa Tower is open, with a compact supporting mix of football history, local heritage and town-centre public art. On a Tower-closed day the visitor offer is more specialist.',
};

pkg.project.visualIdentity = {
  theme: 'tower-industrial',
  badgeImage: '/town-guides/alloa-tower-watercolour-guide.png',
  badgeAlt:
    'Editorial ink-and-watercolour illustration of Alloa Tower approached through its parkland',
  heroImage: '/town-guides/alloa-tower-watercolour-guide.png',
  heroAlt:
    'Editorial ink-and-watercolour illustration of Alloa Tower approached through its parkland',
  primaryColour: '#163F43',
  accentColour: '#B7792B',
  backgroundColour: '#EEF3E8',
  heroObjectPosition: '50% 50%',
  motifs: ['Medieval keep', 'Football heritage', 'Brewing & glass', 'Public art'],
};

pkg.project.townGuide = {
  headline: 'A medieval tower, football stories and traces of an industrial town',
  intro:
    "Alloa is at its best when Alloa Tower is open: the great medieval keep gives the town a nationally important centrepiece, while the football museum, Speirs Centre and public art reveal a quieter story of sport, brewing, glassmaking and civic life.",
  bestFor: ['Medieval history', 'Football heritage', 'Industrial stories', 'Public art'],
  perfectFor: [
    'A compact half-day with one major historic interior',
    'Football supporters and local-history enthusiasts',
    'Visitors who enjoy finding stories in working towns',
  ],
  suggestedFirstVisit: {
    title: 'Alloa Tower, then the town-centre stories',
    summary:
      'Begin at Alloa Tower, allow time for its interiors and rooftop view, then add the football museum or Speirs Centre before following the public art through the centre.',
  },
  dontMiss: [
    'Alloa Tower',
    'Alloa Athletic Football Museum',
    'Alloa Speirs Centre heritage displays',
    'Alloa town-centre public art walk',
  ],
  suggestedTime: 'Half day when Alloa Tower is open; 1-2 hours on a Tower-closed day',
  visitorMood:
    'A rewarding small-town stop with one outstanding historic anchor and several modest, characterful additions rather than a full day of headline attractions.',
  sourceUrls: [
    'https://www.nts.org.uk/visit/places/alloa-tower',
    'https://www.clacks.gov.uk/visiting/alloaathleticmuseum/',
    'https://www.clacks.gov.uk/culture/alloaspeirscentre/',
    'https://www.clacks.gov.uk/document/3588.pdf',
    'https://www.clacks.gov.uk/culture/greenfieldpark/',
    'https://www.clacks.gov.uk/transport/parking/',
    'https://alloahub.co.uk/loo-news/',
  ],
  lastReviewedAt: reviewedDate,
};

const tower = featureById('nrhe:320380');
tower.shortDescription =
  "Step inside Scotland's largest surviving medieval keep for richly furnished rooms, the timber-roofed Solar and far-reaching views from the roof.";
addTags(tower, 'service-context-visitor', 'alloa-visitor-audit');
replaceCurrentCurationSource(
  tower,
  currentSource(
    'Alloa Tower visitor information',
    'National Trust for Scotland',
    'visitor-audit:alloa-tower',
    'https://www.nts.org.uk/visit/places/alloa-tower',
    "Current-place curation: tourism=attraction; name=Alloa Tower; visit_score=84; opening_hours:description=Seasonal opening, Friday-Monday 12:00-16:00 with last entry at 15:00, check the live NTS page before travelling; entrance_fee=Adult £9.50, concession £8.50, child £5.50, family £26.50, one-adult family £18, Young Scot £1, NTS members free; time_to_spend=60-90 minutes; description=Explore Scotland's largest surviving medieval keep, its 18th-century interiors and roof-level views; website=https://www.nts.org.uk/visit/places/alloa-tower.",
  ),
);

const footballMuseum = upsertFeature(
  curatedPoint(
    'curated-attraction:alloa-athletic-football-museum',
    'Alloa Athletic Football Museum',
    'museum',
    [-3.79551, 56.11164],
    'A volunteer-run collection of programmes, strips, photographs and club memorabilia that rewards football supporters with a very personal local story.',
    currentSource(
      'Alloa Athletic Football Museum',
      'Clackmannanshire Council',
      'visitor-audit:alloa-athletic-football-museum',
      'https://www.clacks.gov.uk/visiting/alloaathleticmuseum/',
      'Current-place curation: tourism=museum; name=Alloa Athletic Football Museum; visit_score=64; opening_hours:description=Friday and Saturday 11:00-14:00, groups and arranged visits should contact the museum; entrance_fee=Free, donations welcome; time_to_spend=30-60 minutes; description=Browse decades of Alloa Athletic programmes, match-worn strips and football memorabilia in a friendly volunteer-run museum; website=https://www.clacks.gov.uk/visiting/alloaathleticmuseum/.',
      'local_authority',
    ),
    ['current-context', 'curated-visitor-place', 'service-context-visitor', 'alloa-visitor-audit'],
    'representative_point',
    'medium',
  ),
);
footballMuseum.address = 'Glasstown House, Castle Street, Alloa, FK10 1EU';

const speirs = featureById('curated-attraction:alloa-alloa-speirs-centre-heritage');
speirs.name = 'Alloa Speirs Centre heritage displays';
speirs.shortDescription =
  "A handsome former baths building with free displays, local-history resources and a useful introduction to Clackmannanshire's people and industries.";
addTags(speirs, 'service-context-visitor', 'alloa-visitor-audit');
replaceCurrentCurationSource(
  speirs,
  currentSource(
    'Alloa Speirs Centre visitor information',
    'Clackmannanshire Council',
    'visitor-audit:alloa-speirs-centre',
    'https://www.clacks.gov.uk/culture/alloaspeirscentre/',
    "Current-place curation: tourism=museum; name=Alloa Speirs Centre heritage displays; visit_score=58; opening_hours:description=Monday 09:00-19:00, Tuesday-Friday 09:00-17:00, Saturday 09:00-13:00, Sunday closed; entrance_fee=Free; time_to_spend=30-60 minutes; description=Use the heritage exhibits and local-history resources to uncover Clackmannanshire's civic and industrial past; website=https://www.clacks.gov.uk/culture/alloaspeirscentre/.",
    'local_authority',
  ),
);

const kirkyard = featureById('curated-attraction:alloa-old-alloa-kirkyard-mausoleum');
kirkyard.shortDescription =
  'A quiet fragment of old Alloa, with weathered monuments and the Mar and Kellie Mausoleum rewarding visitors interested in the Erskine family and the town before industrial expansion.';
addTags(kirkyard, 'service-context-visitor', 'alloa-visitor-audit');
replaceCurrentCurationSource(
  kirkyard,
  currentSource(
    'Old Alloa Kirkyard designation and visitor audit',
    'Historic Environment Scotland and Townscape Guides',
    'visitor-audit:old-alloa-kirkyard',
    'https://portal.historicenvironment.scot/designation/LB20952',
    'Current-place curation: tourism=attraction; name=Old Alloa Kirkyard and Mar and Kellie Mausoleum; visit_score=50; opening_hours:description=No formal tourist opening hours are published, visit respectfully in daylight; entrance_fee=Free for an exterior visit; time_to_spend=20-40 minutes; description=Pause among the old monuments and mausoleum for a quieter connection to the Erskines and pre-industrial Alloa; website=https://portal.historicenvironment.scot/designation/LB20952.',
    'official_statutory',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: tower.id,
    name: 'Alloa Tower',
    reason:
      "Alloa's clear headline attraction: a substantial medieval keep with furnished interiors, royal associations and a rooftop view that makes the climb worthwhile.",
    tagline: 'Scotland\'s largest surviving keep',
    visitorScore: 84,
    openingTimes:
      'Seasonal opening, Friday-Monday 12:00-16:00 with last entry at 15:00; check the live NTS page before travelling.',
    admission:
      'Adult £9.50; concession £8.50; child £5.50; family £26.50; one-adult family £18; Young Scot £1; NTS members free.',
    freeAdmission: false,
    organisationPills: ['NTS'],
    sourceName: 'National Trust for Scotland',
    sourceUrl: 'https://www.nts.org.uk/visit/places/alloa-tower',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: footballMuseum.id,
    name: 'Alloa Athletic Football Museum',
    reason:
      'A warm, specialist collection packed with programmes, strips and club memories; especially rewarding for football supporters rather than a general museum audience.',
    tagline: 'Club history and match memorabilia',
    visitorScore: 64,
    openingTimes: 'Friday and Saturday 11:00-14:00; arranged group visits are available.',
    admission: 'Free; donations welcome.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Clackmannanshire Council',
    sourceUrl: 'https://www.clacks.gov.uk/visiting/alloaathleticmuseum/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: speirs.id,
    name: 'Alloa Speirs Centre heritage displays',
    reason:
      "A free, easy town-centre stop for local-history displays and research resources inside one of Alloa's most distinctive civic buildings.",
    tagline: 'Local stories in the former public baths',
    visitorScore: 58,
    openingTimes:
      'Monday 09:00-19:00; Tuesday-Friday 09:00-17:00; Saturday 09:00-13:00; Sunday closed.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Clackmannanshire Council',
    sourceUrl: 'https://www.clacks.gov.uk/culture/alloaspeirscentre/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 4,
    featureId: kirkyard.id,
    name: 'Old Alloa Kirkyard and Mar & Kellie Mausoleum',
    reason:
      'A brief but atmospheric old-town stop for visitors following the Erskine family story beyond Alloa Tower.',
    tagline: 'A quiet trace of old Alloa',
    visitorScore: 50,
    openingTimes: 'No formal tourist hours are published; visit respectfully in daylight.',
    admission: 'Free for an exterior visit.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Historic Environment Scotland',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/LB20952',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const artTrail = featureById('curated:public-art-i-can-see-for-miles');
artTrail.name = 'Alloa town-centre public art walk';
artTrail.featureType = 'walking_route';
artTrail.shortDescription =
  "A short self-guided wander from the station's I Can See For Miles sculpture through Alloa's town-centre artworks, including the mirrored Sentinels and smaller street details.";
addTags(artTrail, 'service-context-walk', 'visitor-context-trail', 'alloa-visitor-audit');
replaceCurrentCurationSource(
  artTrail,
  currentSource(
    'Andy Scott Public Art Trail and Alloa town-centre art guide',
    'Clackmannanshire Council and Alloa Town Centre BID',
    'visitor-audit:alloa-town-centre-public-art-walk',
    'https://www.clacks.gov.uk/document/3588.pdf',
    'Current-place curation: route=foot; trail_type=Town-centre public art walk; visit_score=74; distance=Short town-centre circuit; time_to_spend=45-75 minutes; accessibility=Mostly level town-centre streets, with road crossings and normal urban surfaces; entrance_fee=Free; description=Follow a compact trail route from the station sculpture to the High Street Sentinels and other public artworks around central Alloa; website=https://www.clacks.gov.uk/document/3588.pdf.',
    'local_authority',
  ),
);

updateFood('osm-community:node-3249043266', {
  score: 83,
  tagline: 'Best full meal',
  description:
    'A long-established independent Italian restaurant and the strongest all-round choice for a proper sit-down lunch or evening meal in central Alloa.',
  opening: 'Monday-Saturday lunch and dinner, Sunday dinner, check current booking times',
  price: '££',
  cuisine: 'Italian',
  website: 'https://baraldosrestaurant.co.uk/',
  organisation: "Bar Aldo's",
  kind: 'restaurant',
  reliability: 'official_non_statutory',
});
updateFood('osm-community:node-13662835242', {
  score: 81,
  tagline: 'Coffee and Turkish flavours',
  description:
    'A highly rated independent cafe with a warm local following, combining coffee and baking with Turkish-influenced food.',
  opening: 'Check the current cafe listing before travelling',
  price: '££',
  cuisine: 'Cafe and Turkish',
  website:
    'https://www.tripadvisor.co.uk/Restaurants-g186511-c8-Alloa_Clackmannanshire_Scotland.html',
  organisation: 'MOCS and Tripadvisor',
  kind: 'cafe',
  dogFriendly: true,
});
updateFood('osm-community:node-13662835238', {
  score: 80,
  tagline: 'British and Polish baking',
  description:
    'A welcoming independent cafe known for homemade cakes, coffee and a distinctive mix of British and Polish breakfast and lunch dishes.',
  opening:
    'Monday 09:00-16:00, Tuesday closed, Wednesday-Friday 09:00-16:00, Saturday 09:00-17:00, Sunday closed',
  price: '££',
  cuisine: 'British and Polish cafe',
  website:
    'https://www.tripadvisor.co.uk/Restaurant_Review-g186511-d33076857-Reviews-Take_A_Break-Alloa_Clackmannanshire_Scotland.html',
  organisation: 'Take A Break and Tripadvisor',
  kind: 'cafe',
  dogFriendly: true,
});
updateFood('osm-community:node-13648474031', {
  score: 78,
  tagline: 'Community cafe',
  description:
    'A welcoming Scottish Autism cafe and community hub serving coffee and daytime food in a relaxed, inclusive setting.',
  opening: 'Monday-Friday 09:30-14:30',
  price: '£',
  cuisine: 'Cafe and light lunches',
  website: 'https://makersalloa.org/contact-us/',
  organisation: 'Scottish Autism',
  kind: 'cafe',
  reliability: 'official_non_statutory',
});
updateFood('osm-community:node-13662835233', {
  score: 76,
  tagline: 'Coffee and scones',
  description:
    'A dependable town-centre coffee stop for in-store roasted coffee, handmade scones, soup and light lunches.',
  opening: 'Monday-Saturday 08:30-17:00, Sunday 10:00-16:00',
  price: '££',
  cuisine: 'Coffee, baking and light lunches',
  website: 'https://dnisi.com/alloa/',
  organisation: "D'Nisi",
  kind: 'cafe',
  reliability: 'official_non_statutory',
  dogFriendly: true,
});
updateFood('osm-community:node-13662835255', {
  score: 74,
  tagline: 'Traditional tea room',
  description:
    'A traditional town-centre tea room for breakfast, lunch, baking and an unhurried pot of tea.',
  opening: 'Check current opening times before visiting',
  price: '££',
  cuisine: 'British cafe and tea room',
  website:
    'https://www.tripadvisor.co.uk/Restaurant_Review-g186511-d10635603-Reviews-Ladybird_Tea_Room-Alloa_Clackmannanshire_Scotland.html',
  organisation: 'Ladybird Tea Room and Tripadvisor',
  kind: 'cafe',
});
updateFood('osm-community:node-13654715148', {
  score: 73,
  tagline: 'Indian dinner choice',
  description:
    'A central Indian restaurant with a broad menu of tandoori dishes, curries, biryani and breads for a fuller evening meal.',
  opening: 'Check the current restaurant hours before visiting',
  price: '££',
  cuisine: 'Indian',
  website: 'https://jaadoo.co.uk/contact/',
  organisation: 'Jaadoo Indian Restaurant',
  kind: 'restaurant',
  reliability: 'official_non_statutory',
});
updateFood('osm-community:node-13654715144', {
  score: 72,
  tagline: 'Italian cafe lunch',
  description:
    'A casual Italian cafe for coffee, sandwiches, focaccia and an easy takeaway or light lunch in the centre.',
  opening: 'Check current opening times before visiting',
  price: '£',
  cuisine: 'Italian cafe',
  website: 'https://restaurantguru.com/Aroma-Italia-Alloa',
  organisation: 'Aroma Italia and Restaurant Guru',
  kind: 'cafe',
});

const councilParkingSourceUrl = 'https://www.clacks.gov.uk/transport/parking/';
const parkingPlaces: Array<[string, string, [number, number], string]> = [
  ['king-street', 'King Street Car Park', [-3.7908290443, 56.1167790562], 'Large public town-centre car park with spaces for adapted vehicles and overnight LGV use.'],
  ['railway-station', 'Alloa Railway Station Car Park', [-3.7893848332, 56.1175458448], 'Free public parking beside Alloa railway station and the town-centre public art starting point.'],
  ['candleriggs', 'Candleriggs Car Park', [-3.790305382, 56.1141626893], 'Free public parking close to the southern end of the town centre.'],
  ['mill-road', 'Mill Road Car Park', [-3.7884457898, 56.1156813414], 'Free public parking near Mill Road and the central shopping streets.'],
  ['east-vennel', 'East Vennel Car Park', [-3.789757839, 56.1144941291], 'Free public parking near East Vennel and the town-centre shops.'],
  ['greenside', 'Greenside Street Car Park', [-3.7916029145, 56.1137035466], 'Free public parking with marked accessible provision close to Greenside Street.'],
  ['marshill', 'Marshill Car Park', [-3.7963262037, 56.1170406824], 'Free public parking on the western side of central Alloa.'],
  ['st-mungos-wynd', "St Mungo's Wynd Car Park", [-3.7970894967, 56.1130576847], "Free public parking near St Mungo's Wynd."],
];

const parkingIds = parkingPlaces.map(([slug, name, coordinates, description]) => {
  const id = `curated-parking:alloa-${slug}`;
  upsertFeature(
    curatedPoint(
      id,
      name,
      'parking',
      coordinates,
      description,
      currentSource(
        'Alloa public car parks',
        'Clackmannanshire Council',
        `visitor-audit:parking:${slug}`,
        councilParkingSourceUrl,
        `Current-place curation: amenity=parking; name=${name}; parking=surface; access=public; price_display=Free; payment_required=no; maxstay=No time restriction published; description=${description}; website=${councilParkingSourceUrl}.`,
        'local_authority',
      ),
      ['current-context', 'service-context-parking', 'alloa-visitor-audit'],
    ),
  );
  return id;
});

const speirsToilets = upsertFeature(
  curatedPoint(
    'curated-toilets:alloa-speirs-centre',
    'Speirs Centre public toilets',
    'other',
    [-3.7904811104, 56.1170566564],
    'Public toilets inside the Speirs Centre, available during its published library opening hours.',
    currentSource(
      'Alloa Speirs Centre facilities',
      'Clackmannanshire Council',
      'visitor-audit:toilets:speirs-centre',
      'https://www.clacks.gov.uk/culture/alloaspeirscentre/',
      'Current-place curation: amenity=toilets; name=Speirs Centre public toilets; access=public; price_display=Free; opening_hours:description=Monday 09:00-19:00, Tuesday-Friday 09:00-17:00, Saturday 09:00-13:00, Sunday closed; description=Public toilets inside Alloa Speirs Centre; website=https://www.clacks.gov.uk/culture/alloaspeirscentre/.',
      'local_authority',
    ),
    ['current-context', 'service-context-toilets', 'alloa-visitor-audit'],
  ),
);

const hubToilets = upsertFeature(
  curatedPoint(
    'curated-toilets:alloa-hub',
    'Alloa Hub public toilet',
    'other',
    [-3.7883323737, 56.1165126073],
    'A free public toilet near the bus and rail stations, funded by donations and available during Alloa Hub opening hours.',
    currentSource(
      'The Loo at Alloa Hub',
      'Alloa Hub',
      'visitor-audit:toilets:alloa-hub',
      'https://alloahub.co.uk/loo-news/',
      'Current-place curation: amenity=toilets; name=Alloa Hub public toilet; access=public; price_display=Free; opening_hours:description=Monday 10:00-14:00, Tuesday-Friday 10:00-16:00, Saturday 10:00-14:00, Sunday closed; description=Free public toilet at Maple Court near the bus and rail stations, donations support the service; website=https://alloahub.co.uk/loo-news/.',
      'official_non_statutory',
    ),
    ['current-context', 'service-context-toilets', 'alloa-visitor-audit'],
  ),
);

const grangeRoadToilets = upsertFeature(
  curatedPoint(
    'curated-toilets:alloa-grange-road',
    'Grange Road public toilets',
    'other',
    [-3.8003901674, 56.1153218525],
    'Council-listed public conveniences on Grange Road; no current tourist opening timetable is published.',
    currentSource(
      'Clackmannanshire Council estates asset register',
      'Clackmannanshire Council',
      'visitor-audit:toilets:grange-road',
      'https://www.clacks.gov.uk/form/1128.pdf',
      'Current-place curation: amenity=toilets; name=Grange Road public toilets; access=public; opening_hours:description=No current public timetable is published, check locally before relying on this facility; description=Operational public conveniences listed by the council at Grange Road; website=https://www.clacks.gov.uk/form/1128.pdf.',
      'local_authority',
    ),
    ['current-context', 'service-context-toilets', 'alloa-visitor-audit'],
  ),
);

const greenfieldPicnic = upsertFeature(
  curatedPoint(
    'curated-picnic:alloa-greenfield-park-lawns',
    'Greenfield Park lawns',
    'park',
    [-3.79484, 56.11914],
    'An informal bring-a-blanket picnic stop among mature trees and open lawns; no dedicated picnic table is claimed.',
    currentSource(
      'Greenfield Park visitor information',
      'Clackmannanshire Council',
      'visitor-audit:picnic:greenfield-park',
      'https://www.clacks.gov.uk/culture/greenfieldpark/',
      'Current-place curation: tourism=picnic_site; name=Greenfield Park lawns; access=public; price_display=Free; opening_hours:description=Open park, daylight visit recommended; description=Informal bring-a-blanket picnic space on the lawns among mature trees, with no dedicated picnic table confirmed; website=https://www.clacks.gov.uk/culture/greenfieldpark/.',
      'local_authority',
    ),
    ['current-context', 'service-context-picnic', 'alloa-visitor-audit'],
  ),
);

curationLibrary.projects[pkg.project.id] = {
  ...(curationLibrary.projects[pkg.project.id] ?? {}),
  eat: [
    'osm-community:node-3249043266',
    'osm-community:node-13662835242',
    'osm-community:node-13662835238',
    'osm-community:node-13648474031',
    'osm-community:node-13662835233',
    'osm-community:node-13662835255',
    'osm-community:node-13654715148',
    'osm-community:node-13654715144',
  ],
  trails: [artTrail.id],
  picnic: [greenfieldPicnic.id],
  parking: parkingIds,
  toilets: [speirsToilets.id, hubToilets.id, grangeRoadToilets.id],
};

const visitorBoundary = pkg.project.townStudyArea?.localityBoundary;
if (!visitorBoundary) throw new Error('Alloa locality boundary is missing');
const publicFeatureIds = [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicFeatureIds)) {
  const feature = featureById(featureId);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Alloa public visitor feature is not a point: ${featureId}`);
  }
  const location = point(feature.geometry.coordinates);
  if (!booleanPointInPolygon(location, visitorBoundary)) {
    throw new Error(`Alloa public visitor feature falls outside the locality: ${featureId}`);
  }
  if (!booleanPointInPolygon(location, pkg.project.boundary)) {
    throw new Error(`Alloa public visitor feature falls outside the study boundary: ${featureId}`);
  }
}

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);

console.log(
  `Updated Alloa visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${parkingIds.length} car parks, 3 toilets, 1 picnic area and 1 trail.`,
);
