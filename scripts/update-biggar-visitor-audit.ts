import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/biggar.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/biggar-visitor-audit-2026-08-06.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-06T00:00:00Z';
const reviewedDate = '2026-08-06';
const auditTag = 'biggar-visitor-audit';
const visitorPackTag = 'biggar-scotland-visitor-pack';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Biggar feature: ${id}`);
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

function replaceCurrentCurationSource(feature: HeritageFeature, source: SourceRecord): void {
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (record) =>
        !record.sourceRecordId?.startsWith('visitor-audit:') &&
        !record.sourceRecordId?.startsWith('visitor-pack:') &&
        !record.notes?.startsWith('Current-place curation'),
    ),
    source,
  ];
  feature.licence ??= editorialMetadataLicence;
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
    tags: [...new Set([...tags, auditTag, visitorPackTag])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-06; excluded from historic dating and heat-map evidence.',
    evidenceScope: 'related_context',
    licence: editorialMetadataLicence,
  };
}

function updateFood(
  feature: HeritageFeature,
  options: {
    name: string;
    score: number;
    tagline: string;
    description: string;
    opening: string;
    price: string;
    cuisine: string;
    website: string;
    organisation: string;
    kind: 'cafe' | 'restaurant' | 'pub' | 'fast_food';
    address: string;
    reliability?: SourceRecord['reliability'];
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
      `${feature.name} visitor information`,
      options.organisation,
      `visitor-audit:food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.kind}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}.`,
      options.reliability,
    ),
  );
  return feature;
}

pkg.project.touristAppeal = {
  rating: 2,
  label: 'Worth a planned stop',
  summary:
    'Biggar earns two stars for an unusually varied compact-town visit. Its modern local museum, Scotland\'s only preserved gasworks and the distinctive Purves Puppet Theatre form a credible half-day attraction cluster, supported by a historic High Street, Biggar Kirk, independent food and short walks. Seasonal and performance-led opening limits keep it below destination-draw status.',
};

pkg.project.visualIdentity = {
  theme: 'market-town-museums-and-puppetry',
  badgeImage: '/town-guides/biggar-high-street-watercolour-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of Biggar High Street, its sandstone buildings and Biggar Kirk spire',
  heroImage: '/town-guides/biggar-high-street-watercolour-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of Biggar High Street, its sandstone buildings and Biggar Kirk spire',
  primaryColour: '#173F43',
  accentColour: '#B7782A',
  backgroundColour: '#EEF3E8',
  heroObjectPosition: '50% 54%',
  motifs: ['Market street', 'Industrial heritage', 'Puppet theatre', 'Border hills'],
};

pkg.project.townGuide = {
  headline: 'Three unusual museums in a handsome Borders market town',
  intro:
    'Biggar pairs an unusually strong trio of visitor attractions with an easy High Street wander: a polished Upper Clydesdale museum, Scotland\'s only preserved gasworks and the distinctive Purves Puppets theatre. Add the old kirk, sandstone shopfronts and independent cafes for a rewarding half day.',
  bestFor: ['Local history', 'Industrial heritage', 'Family theatre', 'Market-town wandering'],
  perfectFor: [
    'A museum-led half day between Edinburgh and the Borders',
    'Families combining a puppet show with an easy town wander',
    'Visitors who enjoy distinctive small museums and independent food',
  ],
  suggestedFirstVisit: {
    title: 'Museum, High Street and the gasworks',
    summary:
      'Begin at Biggar Museum, walk west along the High Street to Biggar Kirk and the motte, then continue to the gasworks if its seasonal weekend opening aligns. Book the Puppet Theatre separately when a performance is running.',
  },
  dontMiss: [
    'Biggar and Upper Clydesdale Museum',
    'Biggar Puppet Theatre',
    'Biggar Gasworks Museum',
  ],
  suggestedTime: 'Half a day; a full day with a puppet performance',
  visitorMood:
    'For visitors who like unusual museums, family theatre and an unhurried market-town wander.',
  sourceUrls: [
    'https://www.biggarmuseumtrust.co.uk/visit-us/plan-your-visit/',
    'https://www.historicenvironment.scot/visit/all/biggar-gasworks-museum/plan-your-visit/',
    'https://purvespuppets.com/',
    'https://purvespuppets.com/biggar-puppet-theatre-pricing/',
    'https://www.biggarkirk.com/our-history',
    'https://www.biggarheritage.co.uk/biggar-town-trail/',
    'https://www.biggarheritage.co.uk/biggar-rural-path-network/',
    'https://www.southlanarkshire.gov.uk/directory_record/656838/biggar_burnbraes_park',
    'https://www.biggarcornexchange.org.uk/community-toilets-appeal/',
    'https://www.southlanarkshire.gov.uk/directory/11/council_car_parks/category/270',
    'https://www.geograph.org.uk/photo/39900',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Biggar town study area is missing');
delete townStudyArea.visitorBoundary;
townStudyArea.notes =
  'The active tourist boundary is the original NRS 2022 Biggar locality, preserved unchanged. Biggar Public Park, Little Sparta, Tinto Hill, Brownsbank Cottage, Coulter Motte and other nearby attractions fall outside it and are excluded from the town planner. Trail markers start inside the locality even where a route continues into the surrounding countryside.';

const museum = featureById('osm-community:node-4342554235');
museum.name = 'Biggar and Upper Clydesdale Museum';
museum.featureType = 'museum';
museum.shortDescription =
  'A polished five-star VisitScotland museum tracing 14,000 years of Upper Clydesdale life in a modern, accessible town-centre building.';
museum.address = '156 High Street, Biggar, ML12 6DH';
addTags(museum, 'current-context', 'service-context-heritage', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  museum,
  currentSource(
    'Biggar Museum plan your visit',
    'Biggar Museum Trust',
    'visitor-audit:attraction:biggar-museum',
    'https://www.biggarmuseumtrust.co.uk/visit-us/plan-your-visit/',
    'Current-place curation: tourism=museum; name=Biggar and Upper Clydesdale Museum; visitor_place_type=Local history museum; visit_score=82; opening_hours:description=7 January-end of March Saturday 10:00-17:00 and Sunday 13:00-17:00, last entry 16:00. 3 April-20 December 2026 Tuesday-Saturday 10:00-17:00 and Sunday 13:00-17:00; entrance_fee=Adult £7, concession £6, child £3, family £16, ML12 residents free with proof; time_to_spend=60-120 minutes; accessibility=Fully wheelchair accessible, hearing loop, accessible toilet and dedicated parking; description=Explore 14,000 years of rural and small-town life through a strong modern collection; website=https://www.biggarmuseumtrust.co.uk/visit-us/plan-your-visit/.',
  ),
);

const puppet = featureById('curated-attraction:biggar-biggar-puppet-theatre');
puppet.name = 'Biggar Puppet Theatre';
puppet.featureType = 'theatre';
puppet.shortDescription =
  'The permanent home of the International Purves Puppets, pairing scheduled family shows with a puppet museum, garden, tearoom and play area.';
puppet.address = '8 Broughton Road, Biggar, ML12 6JJ';
addTags(puppet, 'current-context', 'service-context-heritage', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  puppet,
  currentSource(
    'Biggar Puppet Theatre shows and pricing',
    'Purves Puppets',
    'visitor-audit:attraction:biggar-puppet-theatre',
    'https://purvespuppets.com/',
    'Current-place curation: tourism=attraction; name=Biggar Puppet Theatre; visitor_place_type=Family puppet theatre; visit_score=80; opening_hours:description=Open for scheduled performances and pre-arranged museum or backstage tours, check the live programme and book before travelling; entrance_fee=Performance adult £12 and child £10, museum or backstage tour £6 per person by arrangement for groups of four or more; time_to_spend=90-150 minutes; description=See traditional Scottish puppetry in a purpose-built permanent theatre, with a museum, garden, tearoom and play area adding to the family visit; website=https://purvespuppets.com/.',
  ),
);

const gasworks = featureById('osm-community:way-87262038');
gasworks.name = 'Biggar Gasworks Museum';
gasworks.featureType = 'museum';
gasworks.shortDescription =
  'Scotland\'s only preserved gasworks retains its retort house, machinery and industrial atmosphere at the west end of town.';
gasworks.address = 'Gas Works Road, Biggar, ML12 6BZ';
addTags(gasworks, 'current-context', 'service-context-heritage', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  gasworks,
  currentSource(
    'Biggar Gasworks plan your visit',
    'Historic Environment Scotland',
    'visitor-audit:attraction:biggar-gasworks',
    'https://www.historicenvironment.scot/visit/all/biggar-gasworks-museum/plan-your-visit/',
    'Current-place curation: tourism=museum; name=Biggar Gasworks Museum; visitor_place_type=Preserved industrial gasworks; visit_score=78; opening_hours:description=1 April-30 September Saturday and Sunday 13:00-17:00, last entry 16:30. Closed 1 October-31 March; entrance_fee=Free, donations encouraged; time_to_spend=45-90 minutes; description=Walk through Scotland\'s only preserved gasworks and see the buildings and machinery that once supplied the town; website=https://www.historicenvironment.scot/visit/all/biggar-gasworks-museum/plan-your-visit/.',
    'official_statutory',
  ),
);

const kirk = featureById('hes-listed-building:LB22257');
kirk.name = 'Biggar Kirk';
kirk.featureType = 'church';
kirk.shortDescription =
  'A rare late pre-Reformation collegiate church begun in 1545, with a slender spire that anchors the west end of the High Street.';
addTags(kirk, 'current-context', 'service-context-heritage', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  kirk,
  currentSource(
    'Biggar Kirk history and visitor information',
    'Biggar Kirk',
    'visitor-audit:attraction:biggar-kirk',
    'https://www.biggarkirk.com/our-history',
    'Current-place curation: tourism=attraction; historic=church; name=Biggar Kirk; visitor_place_type=Historic collegiate church; visit_score=58; opening_hours:description=Sunday worship normally 11:15-12:30. For a heritage visit outside services, contact the church before travelling; entrance_fee=Free; time_to_spend=20-40 minutes; description=Pause at one of Scotland\'s last great pre-Reformation church foundations and the architectural landmark at the west end of the town; website=https://www.biggarkirk.com/our-history.',
  ),
);

const motte = featureById('osm-community:node-13671694543');
motte.name = 'Biggar Motte';
motte.featureType = 'archaeological_site';
motte.shortDescription =
  'A modest but genuine medieval motte surviving beside the west end of the historic High Street.';
addTags(motte, 'current-context', 'service-context-heritage', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  motte,
  currentSource(
    'Gillespie Moat scheduled monument record',
    'Historic Environment Scotland',
    'visitor-audit:attraction:biggar-motte',
    'https://portal.historicenvironment.scot/designation/SM2643',
    'Current-place curation: tourism=attraction; historic=archaeological_site; name=Biggar Motte; visitor_place_type=Medieval motte; visit_score=43; opening_hours:description=Open-air landmark best viewed respectfully in daylight; entrance_fee=Free; time_to_spend=10-20 minutes; description=Add a brief medieval layer to the west-end heritage walk at the surviving earthwork of Gillespie Moat; website=https://portal.historicenvironment.scot/designation/SM2643.',
    'official_statutory',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: museum.id,
    name: museum.name,
    reason:
      'The strongest all-weather Biggar attraction turns Upper Clydesdale\'s long story into an accessible, polished museum visit with enough depth for more than a quick look.',
    tagline: 'Best all-round attraction',
    visitorScore: 82,
    openingTimes:
      '7 January-end of March: Saturday 10:00-17:00 and Sunday 13:00-17:00. 3 April-20 December 2026: Tuesday-Saturday 10:00-17:00 and Sunday 13:00-17:00.',
    admission: 'Adult £7; concession £6; child £3; family £16; ML12 residents free.',
    freeAdmission: false,
    organisationPills: [],
    sourceName: 'Biggar Museum Trust',
    sourceUrl: 'https://www.biggarmuseumtrust.co.uk/visit-us/plan-your-visit/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: puppet.id,
    name: puppet.name,
    reason:
      'A rare purpose-built permanent puppet theatre gives Biggar a distinctive family experience rather than another interchangeable small-town stop.',
    tagline: 'Distinctive family theatre',
    visitorScore: 80,
    openingTimes:
      'Open for scheduled performances and pre-arranged tours. Check the current programme and book before travelling.',
    admission:
      'Performance adult £12 and child £10; museum or backstage tours £6 per person by arrangement.',
    freeAdmission: false,
    organisationPills: [],
    sourceName: 'Purves Puppets',
    sourceUrl: 'https://purvespuppets.com/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: gasworks.id,
    name: gasworks.name,
    reason:
      'Scotland\'s only preserved gasworks is a compact but memorable industrial-history visit, especially when its machinery and buildings can be explored together.',
    tagline: 'Unique industrial survivor',
    visitorScore: 78,
    openingTimes:
      '1 April-30 September: Saturday and Sunday 13:00-17:00, last entry 16:30. Closed October-March.',
    admission: 'Free; donations encouraged.',
    freeAdmission: true,
    organisationPills: ['HES'],
    sourceName: 'Historic Environment Scotland',
    sourceUrl:
      'https://www.historicenvironment.scot/visit/all/biggar-gasworks-museum/plan-your-visit/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 4,
    featureId: kirk.id,
    name: kirk.name,
    reason:
      'The late medieval kirk supplies Biggar\'s strongest architectural landmark and a valuable pre-Reformation chapter, although reliable tourist access is limited.',
    tagline: 'Pre-Reformation landmark',
    visitorScore: 58,
    openingTimes:
      'Sunday worship normally 11:15-12:30. Contact the church before travelling for a heritage visit outside services.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Biggar Kirk',
    sourceUrl: 'https://www.biggarkirk.com/our-history',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 5,
    featureId: motte.id,
    name: motte.name,
    reason:
      'The surviving motte is a genuine medieval point of interest on the west-end walk, but it is an earthwork to notice rather than a standalone attraction.',
    tagline: 'Medieval earthwork',
    visitorScore: 43,
    openingTimes: 'Open-air landmark; visit respectfully in daylight.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Historic Environment Scotland',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/SM2643',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const barony = updateFood(featureById('osm-community:node-10550528510'), {
  name: 'The Barony Restaurant',
  score: 82,
  tagline: 'Best dinner',
  description:
    'A polished independent restaurant serving freshly prepared classic dishes with a contemporary twist in a comfortable High Street setting.',
  opening:
    'Wednesday-Saturday lunch and dinner, Sunday lunch. Seasonal hours vary, so check the current booking page before travelling specifically.',
  price: '£££',
  cuisine: 'Scottish, British and European restaurant dining',
  website: 'https://www.barony-biggar.co.uk/',
  organisation: 'The Barony Restaurant',
  kind: 'restaurant',
  address: '55 High Street, Biggar, ML12 6DA',
});

const crown = updateFood(
  upsertFeature(
    curatedPoint(
      'curated-food:biggar-crown-inn',
      'The Crown Inn',
      'pub',
      [-3.5231836, 55.6246017],
      'A traditional coaching inn serving hearty pub and gastro food from midday, with real ales and a Sunday carvery.',
      currentSource(
        'The Crown Inn visitor information',
        'The Crown Inn',
        'visitor-audit:food:biggar-crown-inn',
        'https://thecrownbiggar.co.uk/',
        'Current-place curation: amenity=pub; name=The Crown Inn; cuisine=Scottish and British pub food; visit_score=80; price_band=££; opening_hours:description=Food served daily from 12:00, check the live booking page for final orders; description=Best pub meal: A traditional coaching inn serving hearty pub and gastro food, real ales and a Sunday carvery; website=https://thecrownbiggar.co.uk/.',
      ),
      ['current-context', 'service-context-food', 'visitor-context-food'],
    ),
  ),
  {
    name: 'The Crown Inn',
    score: 80,
    tagline: 'Best pub meal',
    description:
      'A traditional coaching inn serving hearty pub and gastro food from midday, with real ales and a Sunday carvery.',
    opening: 'Food served daily from 12:00; check the live booking page for final orders.',
    price: '££',
    cuisine: 'Scottish and British pub food',
    website: 'https://thecrownbiggar.co.uk/',
    organisation: 'The Crown Inn',
    kind: 'pub',
    address: '109-111 High Street, Biggar, ML12 6DL',
  },
);

const oliveTree = updateFood(
  upsertFeature(
    curatedPoint(
      'curated-food:biggar-olive-tree-deli',
      'The Olive Tree Deli',
      'cafe',
      [-3.5224171, 55.6243347],
      'An independent deli and cafe for coffee, baking, light lunches, local cheeses and picnic provisions.',
      currentSource(
        'The Olive Tree Deli visitor information',
        'The Olive Tree Deli',
        'visitor-audit:food:biggar-olive-tree-deli',
        'https://theolivetreedeli.co.uk/',
        'Current-place curation.',
      ),
      ['current-context', 'service-context-food', 'visitor-context-food'],
    ),
  ),
  {
    name: 'The Olive Tree Deli',
    score: 78,
    tagline: 'Best deli lunch',
    description:
      'An independent deli and cafe for coffee, home baking, light lunches, local cheeses and useful picnic provisions.',
    opening: 'Monday-Saturday 08:00-17:00; Sunday closed.',
    price: '££',
    cuisine: 'Deli, cafe, light lunches and home baking',
    website: 'https://theolivetreedeli.co.uk/',
    organisation: 'The Olive Tree Deli',
    kind: 'cafe',
    address: '114 High Street, Biggar, ML12 6DH',
  },
);

const gillespie = updateFood(
  upsertFeature(
    curatedPoint(
      'curated-food:biggar-gillespie-centre-cafe',
      'Gillespie Centre Cafe',
      'cafe',
      [-3.5242831, 55.6239298],
      'A welcoming community cafe for inexpensive homemade soup, filled rolls, baked potatoes, cakes and hot drinks.',
      currentSource(
        'Gillespie Centre cafe information',
        'Gillespie Centre',
        'visitor-audit:food:biggar-gillespie-centre-cafe',
        'https://gillespiecentre.co.uk/',
        'Current-place curation.',
      ),
      ['current-context', 'service-context-food', 'visitor-context-food'],
    ),
  ),
  {
    name: 'Gillespie Centre Cafe',
    score: 76,
    tagline: 'Best-value lunch',
    description:
      'A welcoming community cafe for inexpensive homemade soup, filled rolls, baked potatoes, cakes and hot drinks.',
    opening: 'Monday-Saturday 10:00-14:30; last orders for hot food 14:15.',
    price: '£',
    cuisine: 'Community cafe, light lunches and home baking',
    website: 'https://gillespiecentre.co.uk/',
    organisation: 'Gillespie Centre',
    kind: 'cafe',
    address: '74 High Street, Biggar, ML12 6BJ',
  },
);

const aroma = updateFood(featureById('osm-community:node-10934143056'), {
  name: 'Aroma Cafe',
  score: 74,
  tagline: 'Best all-day cafe',
  description:
    'A convenient central cafe for breakfast, lunch, coffee and cakes, with one of the town\'s broadest daytime opening patterns.',
  opening: 'Daily 08:00-17:00; confirm current hours before a special journey.',
  price: '££',
  cuisine: 'Cafe, breakfast, lunch and home baking',
  website: 'https://www.openstreetmap.org/node/10934143056',
  organisation: 'OpenStreetMap contributors and current business listings',
  kind: 'cafe',
  address: '86-88 High Street, Biggar, ML12 6DH',
  reliability: 'secondary',
});

const elphinstone = updateFood(featureById('osm-community:node-10553226217'), {
  name: 'The Elphinstone Hotel',
  score: 73,
  tagline: 'Traditional inn',
  description:
    'A long-established coaching inn with a full lunch and dinner menu, useful when daytime cafes have closed.',
  opening:
    'Monday-Friday 12:00-14:30 and 17:00-20:30; Saturday 12:00-21:00; Sunday 12:00-20:30. Last orders are earlier than closing.',
  price: '££',
  cuisine: 'Scottish and British inn dining',
  website: 'https://www.elphinstonehotel.co.uk/',
  organisation: 'The Elphinstone Hotel',
  kind: 'restaurant',
  address: '145 High Street, Biggar, ML12 6DL',
});

const coffeeSpot = updateFood(featureById('osm-community:node-10550530110'), {
  name: 'The Coffee Spot',
  score: 70,
  tagline: 'Breakfast stop',
  description:
    'A straightforward High Street cafe for breakfast rolls, coffee, home baking and an inexpensive light lunch.',
  opening: 'Daily 08:00-16:00; confirm current hours before travelling specifically.',
  price: '£',
  cuisine: 'Cafe, breakfast and home baking',
  website: 'https://www.openstreetmap.org/node/10550530110',
  organisation: 'OpenStreetMap contributors and current business listings',
  kind: 'cafe',
  address: '152 High Street, Biggar, ML12 6DH',
  reliability: 'secondary',
});

const townhead = updateFood(
  upsertFeature(
    curatedPoint(
      'curated-food:biggar-townhead-fish-and-chips',
      'Townhead Fish & Chips',
      'fast_food',
      [-3.5204562, 55.625223],
      'A central sit-in and takeaway option for fish and chips, pizza and familiar quick meals into the evening.',
      currentSource(
        'Townhead Fish & Chips visitor information',
        'Townhead Fish & Chips and current business listings',
        'visitor-audit:food:biggar-townhead-fish-and-chips',
        'https://www.townhead-cafe.co.uk/',
        'Current-place curation.',
        'secondary',
      ),
      ['current-context', 'service-context-food', 'visitor-context-food'],
    ),
  ),
  {
    name: 'Townhead Fish & Chips',
    score: 64,
    tagline: 'Fish & chips',
    description:
      'A central sit-in and takeaway option for fish and chips, pizza and familiar quick meals into the evening.',
    opening: 'Current business listings show daily service around 12:00-22:00; confirm before travelling.',
    price: '£',
    cuisine: 'Fish and chips, pizza and takeaway food',
    website: 'https://www.townhead-cafe.co.uk/',
    organisation: 'Townhead Fish & Chips and current business listings',
    kind: 'fast_food',
    address: '187 High Street, Biggar, ML12 6DJ',
    reliability: 'secondary',
  },
);

const heritageTrail = upsertFeature(
  curatedPoint(
    'curated-trail:biggar-town-trail',
    'Biggar Town Trail',
    'walking_route',
    [-3.5237, 55.6242],
    'A downloadable self-guided town trail linking the High Street, kirk, motte, Cadger\'s Brig and other historic details.',
    currentSource(
      'Biggar Town Trail',
      'Biggar and District Community Heritage',
      'visitor-audit:trail:biggar-town-trail',
      'https://www.biggarheritage.co.uk/wp-content/uploads/2020/10/Biggar-leaflet-2020-sml.pdf',
      'Current-place curation: route=foot; name=Biggar Town Trail; trail_type=Self-guided heritage walk; visit_score=84; best_for=Historic streets and local stories; distance=Compact town-centre circuit with optional diversions; time_to_spend=Allow 75-120 minutes; accessibility=Mostly town pavements with road crossings and short uneven historic-site approaches; entrance_fee=Free; description=Use the downloadable heritage leaflet to connect the High Street, kirk, motte, Cadger\'s Brig and Biggar\'s market-town stories; website=https://www.biggarheritage.co.uk/wp-content/uploads/2020/10/Biggar-leaflet-2020-sml.pdf.',
      'secondary',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const bizzyberry = upsertFeature(
  curatedPoint(
    'curated-trail:biggar-bizzyberry-path',
    'Bizzyberry Path',
    'walking_route',
    [-3.51875, 55.62785],
    'A popular local path climbing from Biggar towards open country and a wider view, improved by the community heritage group.',
    currentSource(
      'Biggar Country Path Network',
      'Biggar and District Community Heritage',
      'visitor-audit:trail:biggar-bizzyberry-path',
      'https://www.biggarheritage.co.uk/biggar-rural-path-network/',
      'Current-place curation: route=foot; name=Bizzyberry Path; trail_type=Out-and-back country path; visit_score=74; best_for=A short climb and wider landscape; distance=Flexible out-and-back from Biggar, turn around to suit conditions; time_to_spend=Allow 60-120 minutes; accessibility=Improved path sections but rural ground can be wet, muddy and uneven, with livestock nearby and dogs requiring close control; entrance_fee=Free; description=Follow one of Biggar\'s most popular local paths from the town edge towards the open slopes and wider Upper Clydesdale landscape; website=https://www.biggarheritage.co.uk/biggar-rural-path-network/.',
      'secondary',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const burnbraesPicnic = upsertFeature(
  curatedPoint(
    'curated-picnic:biggar-burnbraes-park',
    'Burnbraes Park picnic area, Biggar Mill Road',
    'picnic_site',
    [-3.5271683, 55.6252263],
    'Council-listed picnic facilities beside the burn and children\'s play area in Burnbraes Park.',
    currentSource(
      'Biggar Burnbraes Park',
      'South Lanarkshire Council',
      'visitor-audit:picnic:biggar-burnbraes-park',
      'https://www.southlanarkshire.gov.uk/directory_record/656838/biggar_burnbraes_park',
      'Current-place curation: tourism=picnic_site; name=Burnbraes Park picnic area, Biggar Mill Road; access=public; price_display=Free; opening_hours:description=Open public park, daylight use recommended; description=Council-listed picnic facilities beside the picturesque burn and children\'s play area; website=https://www.southlanarkshire.gov.uk/directory_record/656838/biggar_burnbraes_park.',
      'local_authority',
    ),
    ['current-context', 'service-context-picnic'],
  ),
);

function updateParking(
  id: string,
  name: string,
  address: string,
  sourceUrl: string,
  details: string,
): HeritageFeature {
  const feature = featureById(id);
  feature.name = name;
  feature.featureType = 'parking';
  feature.shortDescription = details;
  feature.address = address;
  addTags(feature, 'current-context', 'service-context-parking', auditTag, visitorPackTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${name} council car-park record`,
      'South Lanarkshire Council',
      `visitor-audit:parking:${id}`,
      sourceUrl,
      `Current-place curation: amenity=parking; name=${name}; parking=surface; access=public; price_display=Free; payment_required=no; pricing_note=No visitor charge is published for this council car park, observe current entrance signs; opening_hours:description=Monday-Sunday, all day; description=${details}; website=${sourceUrl}.`,
      'local_authority',
    ),
  );
  return feature;
}

const highStreetParking = updateParking(
  'osm-community:way-1177176537',
  'High Street car park',
  '1 High Street, Biggar, ML12 6DA',
  'https://www.southlanarkshire.gov.uk/directory_record/91877/high_street_biggar',
  'Free council parking beside Biggar High Street, convenient for the west end, gasworks and town trail.',
);
const kirkstyleParking = updateParking(
  'osm-community:way-1184417011',
  'Kirkstyle car park',
  'Off Kirkstyle, Biggar, ML12 6DT',
  'https://www.southlanarkshire.gov.uk/directory_record/91880/kirkstyle_biggar',
  'Free council parking north of the High Street beside the community hall, with two Blue Badge bays.',
);
const marketRoadParking = updateParking(
  'osm-community:way-1131821390',
  'Market Road car park',
  'Market Road, Biggar, ML12 6AG',
  'https://www.southlanarkshire.gov.uk/directory_record/91888/market_road_biggar',
  'Free council surface parking on Market Road, convenient for the east end of the High Street and museum.',
);

const toilets = featureById('osm-community:node-10937125705');
toilets.name = 'Biggar Community Toilets, High Street';
toilets.featureType = 'toilets';
toilets.shortDescription =
  'Community-run public toilets near the Corn Exchange and High Street, supported by an honesty box and donations.';
toilets.address = 'High Street, Biggar, ML12 6BJ';
addTags(toilets, 'current-context', 'service-context-toilets', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  toilets,
  currentSource(
    'Biggar Community Toilets',
    'Biggar Corn Exchange',
    'visitor-audit:toilets:biggar-community-toilets',
    'https://www.biggarcornexchange.org.uk/community-toilets-appeal/',
    'Current-place curation: amenity=toilets; name=Biggar Community Toilets, High Street; access=public; price_display=Donation; opening_hours:description=Daily 09:00-20:00, locked overnight; toilets=Community-run public toilets supported by an honesty box and donations; description=Community public toilets near the Corn Exchange and High Street; website=https://www.biggarcornexchange.org.uk/community-toilets-appeal/.',
    'secondary',
  ),
);

curationLibrary.projects[pkg.project.id] = {
  ...(curationLibrary.projects[pkg.project.id] ?? {}),
  eat: [
    barony.id,
    crown.id,
    oliveTree.id,
    gillespie.id,
    aroma.id,
    elphinstone.id,
    coffeeSpot.id,
    townhead.id,
  ],
  trails: [heritageTrail.id, bizzyberry.id],
  picnic: [burnbraesPicnic.id],
  parking: [highStreetParking.id, kirkstyleParking.id, marketRoadParking.id],
  toilets: [toilets.id],
};

const activeVisitorBoundary = townStudyArea.localityBoundary;
const publicFeatureIds = [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicFeatureIds)) {
  const feature = featureById(featureId);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Biggar public visitor feature is not a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), activeVisitorBoundary)) {
    throw new Error(`Biggar public visitor feature falls outside NRS locality: ${featureId}`);
  }
}

const explicitlyExcluded = [
  ['osm-community:way-785402367', 'Biggar Public Park parking lies outside the NRS locality.'],
  ['osm-community:way-785402369', 'Biggar Public Park picnic site lies outside the NRS locality.'],
  ['osm-community:node-11149711532', 'The generic picnic-table point is not used because a named, council-verified Burnbraes stop is available.'],
] as const;
for (const [id, reason] of explicitlyExcluded) {
  const feature = featureById(id);
  addTags(feature, 'visitor-audit-excluded', auditTag);
  feature.reviewNotes = reason;
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    rating: pkg.project.touristAppeal.rating,
    rationale:
      'Two stars are retained. Biggar has a credible and unusual half-day cluster in the modern local museum, preserved gasworks and permanent puppet theatre, with historic streets, food and walks adding depth. Seasonal and performance-led access prevents a three-star destination rating.',
  },
  boundaryRule:
    'The original NRS 2022 Biggar locality remains the active visitor polygon. Every public attraction, food, trail-start and practical marker is inside it. Biggar Public Park and all other nearby attractions outside the polygon are excluded from the town planner.',
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
      name: 'Biggar Public Park',
      reason:
        'The park, car park, play area and picnic point are outside the active NRS town polygon and are not counted as Biggar planner places.',
    },
    {
      name: 'Little Sparta, Tinto Hill, Brownsbank Cottage and Coulter Motte',
      reason: 'Nearby visitor context only; all lie outside the active town polygon.',
    },
    {
      name: 'Albion Museum',
      reason: 'Currently closed to the public while its collection is relocated.',
    },
    {
      name: 'Biggar Corn Exchange',
      reason:
        'An active event venue rather than a reliably open drop-in attraction; retained as town context, not a ranked See card.',
    },
    {
      name: 'Private, customer-only and unnamed parking',
      reason: 'Only the three named council public car parks are published.',
    },
  ],
  artwork: {
    asset: '/town-guides/biggar-high-street-watercolour-guide.png',
    referenceSource: 'Biggar High Street by Kevin Rae, Geograph image 39900',
    referenceUrl: 'https://www.geograph.org.uk/photo/39900',
    referenceLicence: 'CC BY-SA 2.0',
    treatment: 'Text-free original ink-and-watercolour visitor-guide illustration.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Biggar visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trails, ${curationLibrary.projects[pkg.project.id].parking.length} car parks, 1 toilet and 1 picnic area. Town rating: ${pkg.project.touristAppeal.rating} stars.`,
);
