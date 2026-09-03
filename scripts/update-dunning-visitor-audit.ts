import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, buffer, featureCollection, point, union } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/dunning.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/dunning-visitor-audit-2026-08-06.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-06T00:00:00Z';
const reviewedDate = '2026-08-06';
const auditTag = 'dunning-visitor-audit';
const visitorPackTag = 'dunning-scotland-visitor-pack';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Dunning feature: ${id}`);
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
        !record.sourceRecordId?.startsWith('visitor-context-curation:') &&
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
    kind: 'cafe' | 'restaurant' | 'pub';
    address: string;
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
      `${feature.name} visitor information`,
      options.organisation,
      `visitor-audit:food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.kind}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}.`,
    ),
  );
  if (options.dogFriendlySourceUrl) {
    feature.sourceRecords.push(
      currentSource(
        `${feature.name} dog policy`,
        'CAMRA',
        `visitor-audit:dog:${feature.id}`,
        options.dogFriendlySourceUrl,
        'Current-place curation: dog_friendly=yes.',
        'secondary',
      ),
    );
  }
  return feature;
}

pkg.project.centre = [-3.58579, 56.31272];
pkg.project.touristAppeal = {
  rating: 1,
  label: 'Local detour',
  summary:
    'Dunning earns one star for a compact but genuine heritage visit. The nationally important Dupplin Cross and medieval St Serf\'s Church are a strong specialist anchor, while the Thorn Tree, village streets, food and walking add enough for a rewarding short detour. The offer is not broad enough for a planned general-tourist stop.',
};

pkg.project.visualIdentity = {
  theme: 'pictish-cross-and-perthshire-village',
  badgeImage: '/town-guides/dunning-st-serfs-2026-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of St Serf\'s Church and its clock tower in Dunning',
  heroImage: '/town-guides/dunning-st-serfs-2026-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of St Serf\'s Church and its clock tower in Dunning',
  primaryColour: '#244A46',
  accentColour: '#B8752D',
  backgroundColour: '#F2F5E9',
  heroObjectPosition: '48% 48%',
  motifs: ['Pictish carving', 'Medieval kirk', 'Thorn Tree', 'Village walks'],
};

pkg.project.townGuide = {
  headline: 'A Pictish cross, a medieval kirk and a village full of stories',
  intro:
    'Dunning is a small Perthshire village with one exceptional historic surprise. Inside St Serf\'s Church stands the finely carved ninth-century Dupplin Cross; beyond the churchyard, the Thorn Tree and old lanes recall the village\'s Jacobite-era story and lead naturally into short country walks.',
  bestFor: ['Pictish art', 'Medieval churches', 'Village history', 'Short country walks'],
  perfectFor: [
    'A focused heritage detour between larger Perthshire stops',
    'Visitors who enjoy quiet historic villages',
    'A church visit followed by lunch and an easy walk',
  ],
  suggestedFirstVisit: {
    title: 'St Serf\'s, the Thorn Tree and the burn-side village',
    summary:
      'Begin with the Dupplin Cross inside St Serf\'s Church, pause at the Thorn Tree in Thorntree Square, then follow the older village streets and Dunning Burn before choosing lunch or a signed local route.',
  },
  dontMiss: [
    'St Serf\'s Church and Dupplin Cross',
    'Dunning Thorn Tree',
    'Thorntree Square and the historic village centre',
  ],
  suggestedTime: '1-2 hours; half a day with lunch or a walk',
  visitorMood:
    'A quiet specialist detour for Pictish carving, village history and an unhurried Perthshire wander.',
  sourceUrls: [
    'https://www.historicenvironment.scot/visit/all/st-serfs-church-and-dupplin-cross/',
    'https://www.historicenvironment.scot/visit/all/st-serfs-church-and-dupplin-cross/plan-your-visit/',
    'https://dunning.uk.net/',
    'https://dunning.uk.net/news/1to36/mag33.html',
    'https://www.pkc.gov.uk/media/37632/Dunning-appraisal/pdf/Dunning_appraisal.pdf?m=1475146475947',
    'https://www.thekirkstyleinn.co.uk/',
    'https://www.thekirkstyleinn.co.uk/general',
    'https://www.dunninggolfclub.co.uk/catering.php',
    'https://dunninghall.org.uk/rollo-park',
    'https://www.pkc.gov.uk/article/19424/Auchterarder-Dunning-public-toilets',
    'https://www.pkc.gov.uk/media/49518/Walking-the-Perth-Kinross-Council-Core-paths/pdf/WalkPKCPBookFINAL.pdf?m=637858801155000000',
    'https://www.walkingwithbrian.com/copy-of-flanders-moss-circuit-1',
    'https://www.geograph.org.uk/photo/7288270',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Dunning town study area is missing');
const rolloParkFeature = featureById('osm-park:way-1085882196');
if (rolloParkFeature.geometry?.type !== 'Polygon') {
  throw new Error('Rollo Park polygon is missing');
}
const rolloParkExtension = buffer(
  {
    type: 'Feature',
    properties: {},
    geometry: rolloParkFeature.geometry,
  },
  0.04,
  { units: 'kilometers' },
);
if (!rolloParkExtension) throw new Error('Could not build the Rollo Park visitor extension');
const visitorBoundary = union(
  featureCollection([townStudyArea.localityBoundary, rolloParkExtension]),
);
if (!visitorBoundary) throw new Error('Could not build the Dunning visitor boundary');
visitorBoundary.properties = {
  sourceDataset: 'Curated Dunning visitor boundary',
  originalSourceDataset: townStudyArea.sourceName,
  basis: 'NRS Dunning locality with a narrow Rollo Park public-facilities extension',
  reviewedAt: reviewedDate,
  reason:
    'The statistical locality is retained unchanged. The visitor extension follows the public Rollo Park boundary so its pavilion cafe and council public toilet are not incorrectly excluded.',
};
townStudyArea.visitorBoundary = visitorBoundary;
townStudyArea.notes =
  'The original NRS 2022 Dunning locality is preserved unchanged. The tourist-facing boundary adds only Rollo Park, a public Dunning park whose pavilion cafe and council toilet are clipped by the statistical polygon. Maggie Wall, Kincladie Wood Roman camp, Dun Knock, Broadslap and other nearby countryside places remain wider-area context only. Curated trail markers begin inside the visitor boundary, although their signed routes may continue beyond it.';

const stSerfs = featureById('hes-property-in-care:pic066');
stSerfs.name = 'St Serf\'s Church and Dupplin Cross';
stSerfs.featureType = 'historic_church';
stSerfs.shortDescription =
  'Dunning\'s essential visit pairs an early medieval church with the superb ninth-century Dupplin Cross, one of Scotland\'s most important surviving Pictish carvings.';
addTags(
  stSerfs,
  'current-context',
  'service-context-heritage',
  'service-context-visitor',
  auditTag,
  visitorPackTag,
);
replaceCurrentCurationSource(
  stSerfs,
  currentSource(
    'St Serf\'s Church and Dupplin Cross visitor information',
    'Historic Environment Scotland',
    'visitor-audit:st-serfs-dupplin-cross',
    'https://www.historicenvironment.scot/visit/all/st-serfs-church-and-dupplin-cross/plan-your-visit/',
    'Current-place curation: tourism=attraction; name=St Serf\'s Church and Dupplin Cross; visitor_place_type=Pictish cross and medieval church; visit_score=82; opening_hours:description=16 April-26 September 2026, Thursday and Saturday 10:00-16:30, closed 12:30-13:30 for lunch, last entry 30 minutes before closing; entrance_fee=Free, donations welcome; time_to_spend=45-75 minutes; dogs=Assistance dogs only; description=See the superb ninth-century Dupplin Cross inside a church with Romanesque work and an eight-hundred-year story; website=https://www.historicenvironment.scot/visit/all/st-serfs-church-and-dupplin-cross/plan-your-visit/.',
  ),
);

const duplicateChurchRecord = featureById('hes-listed-building:LB6019');
addTags(duplicateChurchRecord, 'visitor-audit-combined', auditTag);
duplicateChurchRecord.reviewNotes =
  'Retained as a statutory historic record but combined with the Dupplin Cross property-in-care point for one clear public visitor card.';
duplicateChurchRecord.updatedAt = reviewedAt;
duplicateChurchRecord.reviewed = true;

const thornTree = featureById('osm-community:node-4802470557');
thornTree.name = 'Dunning Thorn Tree';
thornTree.featureType = 'memorial';
thornTree.shortDescription =
  'A replacement for the thorn planted after the village was burned in 1716, preserving a small but distinctive symbol of Dunning\'s survival and renewal.';
addTags(
  thornTree,
  'current-context',
  'service-context-heritage',
  'service-context-visitor',
  auditTag,
  visitorPackTag,
);
replaceCurrentCurationSource(
  thornTree,
  currentSource(
    'The Thorn Tree',
    'Dunning Parish Historical Society',
    'visitor-audit:dunning-thorn-tree',
    'https://dunning.uk.net/news/1to36/mag33.html',
    'Current-place curation: tourism=attraction; historic=memorial; name=Dunning Thorn Tree; visitor_place_type=Village memorial tree; visit_score=48; opening_hours:description=Open-access outdoor memorial, best seen in daylight; entrance_fee=Free; time_to_spend=10-20 minutes; description=Pause at the village symbol planted after the 1716 burning and renewed in 2000; website=https://dunning.uk.net/news/1to36/mag33.html.',
    'secondary',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: stSerfs.id,
    name: stSerfs.name,
    reason:
      'The superb ninth-century Dupplin Cross gives this small Perthshire village a genuinely national-quality heritage stop, displayed inside atmospheric St Serf\'s Church.',
    tagline: 'Pictish masterpiece',
    visitorScore: 82,
    openingTimes:
      '16 April-26 September 2026: Thursday and Saturday 10:00-16:30, with a 12:30-13:30 lunch closure. Last entry is 30 minutes before closing.',
    admission: 'Free; donations welcome.',
    freeAdmission: true,
    organisationPills: ['HES'],
    sourceName: 'Historic Environment Scotland',
    sourceUrl:
      'https://www.historicenvironment.scot/visit/all/st-serfs-church-and-dupplin-cross/plan-your-visit/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: thornTree.id,
    name: thornTree.name,
    reason:
      'This modest village-centre memorial carries Dunning\'s story of destruction in 1716 and the community\'s later renewal.',
    tagline: 'Jacobite-era village story',
    visitorScore: 48,
    openingTimes: 'Open-access outdoor memorial. Daylight gives the clearest context.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Dunning Parish Historical Society',
    sourceUrl: 'https://dunning.uk.net/news/1to36/mag33.html',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const kirkstyle = updateFood(featureById('osm-community:way-488053718'), {
  name: 'Kirkstyle Inn',
  score: 82,
  tagline: 'Best village meal',
  description:
    'A polished village inn beside St Serf\'s, serving lunch and evening dishes with tea, coffee and cakes through the afternoon. Dogs are welcome.',
  opening:
    'Monday dinner 17:00-20:00 / Tuesday-Thursday kitchen 12:00-20:00 / Friday-Saturday 12:00-20:30 / Sunday 12:00-20:00. Tea and cakes Tuesday-Sunday 11:00-17:00.',
  price: '££',
  cuisine: 'Scottish and British inn dining',
  website: 'https://www.thekirkstyleinn.co.uk/',
  organisation: 'The Kirkstyle Inn',
  kind: 'pub',
  address: 'Kirkstyle Square, Dunning, PH2 0RR',
  dogFriendlySourceUrl: 'https://camra.org.uk/pubs/kirkstyle-inn-dunning-138273',
});

const teeRoom = upsertFeature(
  curatedPoint(
    'curated-food:dunning-tee-room',
    'The Tee Room at Rollo Park',
    'cafe',
    [-3.59102, 56.31311],
    'A community cafe in the pavilion serving all-day breakfast, lunch, cakes and hot drinks beside Rollo Park and Dunning Golf Club.',
    currentSource(
      'The Tee Room catering information',
      'Dunning Golf Club',
      'visitor-audit:food:dunning-tee-room',
      'https://www.dunninggolfclub.co.uk/catering.php',
      'Current-place curation: amenity=cafe; name=The Tee Room at Rollo Park; cuisine=Breakfasts, lunches, cakes and hot drinks; visit_score=68; price_band=£; opening_hours:description=Opening hours vary, call 07708 584407 before travelling specifically; description=Breakfast & lunch hub: A community cafe in the pavilion serving all-day breakfast, lunch, cakes and hot drinks beside Rollo Park; website=https://www.dunninggolfclub.co.uk/catering.php.',
    ),
    ['current-context', 'service-context-food', 'visitor-context-food'],
  ),
);
teeRoom.address = 'Community Pavilion, Rollo Park, Station Road, Dunning, PH2 0RH';

const dunningCircular = upsertFeature(
  curatedPoint(
    'curated-trail:dunning-circular',
    'Dunning Circular',
    'walking_route',
    [-3.58945, 56.31299],
    'The council\'s signed village-and-countryside circuit links Dunning Burn, Kincladie Wood and core paths back to the village.',
    currentSource(
      'Dunning Circular',
      'Perth and Kinross Council',
      'visitor-audit:trail:dunning-circular',
      'https://www.pkc.gov.uk/media/49518/Walking-the-Perth-Kinross-Council-Core-paths/pdf/WalkPKCPBookFINAL.pdf?m=637858801155000000',
      'Current-place curation: route=foot; name=Dunning Circular; trail_type=Village and countryside core-path circuit; visit_score=82; best_for=A varied circular from the village; distance=Roughly 6 kilometres, based on the council route sections; time_to_spend=Allow 2-3 hours; accessibility=Village pavements, roadside sections, woodland and rural core paths that may be muddy; entrance_fee=Free; description=Follow the council route from Rollo Park through the village, beside Dunning Burn and around Kincladie Wood before returning on the core-path network; website=https://www.pkc.gov.uk/media/49518/Walking-the-Perth-Kinross-Council-Core-paths/pdf/WalkPKCPBookFINAL.pdf?m=637858801155000000.',
      'local_authority',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const witchTrail = upsertFeature(
  curatedPoint(
    'curated-trail:dunning-witch-trail',
    'Dunning Witch Trail',
    'walking_route',
    [-3.5874, 56.31198],
    'A short out-and-back heritage walk from Dunning to the enigmatic Maggie Wall monument west of the village.',
    currentSource(
      'Dunning Witch Trail',
      'Walking with Brian',
      'visitor-audit:trail:dunning-witch-trail',
      'https://www.walkingwithbrian.com/copy-of-flanders-moss-circuit-1',
      'Current-place curation: route=foot; name=Dunning Witch Trail; trail_type=Short heritage out-and-back; visit_score=76; best_for=Local folklore and a short walk; distance=1.6 miles / 2.6 kilometres; time_to_spend=60-90 minutes; accessibility=The route leaves the active town polygon and follows the B8062 towards the monument, take care beside traffic and turn back if conditions feel unsuitable; entrance_fee=Free; description=Walk from St Serf\'s through Dunning and west to the enigmatic Maggie Wall monument, which remains outside the town attraction list; website=https://www.walkingwithbrian.com/copy-of-flanders-moss-circuit-1.',
      'secondary',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const picnic = upsertFeature(
  curatedPoint(
    'curated-picnic:dunning-thorntree-square',
    'Thorntree Square picnic benches',
    'picnic_site',
    [-3.58728, 56.31196],
    'Named public picnic benches in Thorntree Square beside the village memorial tree and historic centre.',
    currentSource(
      'Dunning Conservation Area Appraisal',
      'Perth and Kinross Council',
      'visitor-audit:picnic:dunning-thorntree-square',
      'https://www.pkc.gov.uk/media/37632/Dunning-appraisal/pdf/Dunning_appraisal.pdf?m=1475146475947',
      'Current-place curation: tourism=picnic_site; name=Thorntree Square picnic benches; access=public; price_display=Free; opening_hours:description=Open public seating, daylight use recommended; description=Public picnic benches beside Dunning Thorn Tree in Thorntree Square; website=https://www.pkc.gov.uk/media/37632/Dunning-appraisal/pdf/Dunning_appraisal.pdf?m=1475146475947.',
      'local_authority',
    ),
    ['current-context', 'service-context-picnic'],
  ),
);

const parking = featureById('osm-community:way-1085882188');
parking.name = 'Rollo Park visitor car park';
parking.featureType = 'parking';
parking.shortDescription =
  'Public surface parking at the Station Road entrance to Rollo Park, convenient for the pavilion, village centre and council circular walk.';
parking.address = 'Rollo Park, Station Road, Dunning, PH2 0RH';
addTags(parking, 'current-context', 'service-context-parking', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  parking,
  currentSource(
    'Rollo Park visitor facilities',
    'Dunning Hall Group and Perth and Kinross Council',
    'visitor-audit:parking:rollo-park',
    'https://dunninghall.org.uk/rollo-park',
    'Current-place curation: amenity=parking; name=Rollo Park visitor car park; parking=surface; access=public; price_display=Free; payment_required=no; pricing_note=No charge is published by the park operator, observe any current entrance signs; opening_hours:description=Open-access outdoor car park, observe any current signs; description=Public car park at the Station Road entrance to Rollo Park and the official Dunning Circular start; website=https://dunninghall.org.uk/rollo-park.',
  ),
);

const toilets = featureById('pkc-public-toilet:124080925');
toilets.name = 'Rollo Recreation Ground public toilets, Station Road';
toilets.featureType = 'toilets';
toilets.shortDescription =
  'Council-listed unisex and accessible public toilets at Rollo Recreation Ground on Station Road.';
toilets.address = 'Rollo Recreation Ground, Station Road, Dunning, PH2 0RH';
addTags(toilets, 'current-context', 'service-context-toilets', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  toilets,
  currentSource(
    'Dunning public toilets',
    'Perth and Kinross Council',
    'visitor-audit:toilets:rollo-recreation-ground',
    'https://www.pkc.gov.uk/article/19424/Auchterarder-Dunning-public-toilets',
    'Current-place curation: amenity=toilets; name=Rollo Recreation Ground public toilets, Station Road; access=public; price_display=Free; opening_hours:description=Monday-Friday and Saturday 07:00-15:00, open all year; wheelchair=yes; toilets=Unisex and suitable for disabled use; description=Council public toilets at Rollo Recreation Ground on Station Road; website=https://www.pkc.gov.uk/article/19424/Auchterarder-Dunning-public-toilets.',
    'local_authority',
  ),
);

curationLibrary.projects[pkg.project.id] = {
  ...(curationLibrary.projects[pkg.project.id] ?? {}),
  eat: [kirkstyle.id, teeRoom.id],
  trails: [dunningCircular.id, witchTrail.id],
  picnic: [picnic.id],
  parking: [parking.id],
  toilets: [toilets.id],
};

const excludedIds = new Set([
  'osm-community:node-12022637366',
  'osm-community:node-12022638574',
  'osm-community:node-2553037364',
]);
for (const feature of pkg.features) {
  const outsideVisitorContext = excludedIds.has(feature.id);
  const uncuratedParking =
    feature.featureType === 'parking' && feature.id !== parking.id;
  if (!outsideVisitorContext && !uncuratedParking) continue;
  addTags(feature, 'visitor-audit-excluded', auditTag);
  feature.reviewNotes = outsideVisitorContext
    ? 'Excluded from Dunning\'s public town planner because the point falls outside the active NRS locality. It remains wider-area context only.'
    : 'Excluded from Dunning\'s public planner because it is outside the active locality, customer-only or lacks verified public visitor access.';
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

const activeVisitorBoundary = townStudyArea.visitorBoundary;
if (!activeVisitorBoundary) throw new Error('Dunning visitor boundary is missing');
const publicFeatureIds = [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicFeatureIds)) {
  const feature = featureById(featureId);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Dunning public visitor feature is not a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), activeVisitorBoundary)) {
    throw new Error(`Dunning public visitor feature falls outside NRS locality: ${featureId}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    rating: pkg.project.touristAppeal.rating,
    rationale:
      'One star is retained after a fresh visitor audit. St Serf\'s Church and the nationally important Dupplin Cross create a genuine niche detour, with the Thorn Tree, village character, food and walks adding depth. The town does not have the breadth or all-day attraction cluster required for two stars.',
  },
  boundaryRule:
    'The official NRS 2022 Dunning locality is preserved unchanged. The active visitor boundary adds only public Rollo Park so its pavilion cafe and council toilet are not lost to a statistical edge. Every public planner marker is inside this boundary. Maggie Wall, Kincladie Wood Roman camp, Dun Knock, Broadslap and other nearby places are excluded. Trail routes may leave the locality after starting in Dunning.',
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
      name: 'Maggie Wall monument',
      reason:
        'Outside the active Dunning locality. It is a destination on the Witch Trail but not a Dunning attraction card.',
    },
    {
      name: 'Kincladie Wood Roman camp and information board',
      reason: 'Outside the active Dunning locality and retained only as wider historic context.',
    },
    {
      name: 'Dun Knock and wider countryside sites',
      reason: 'Outside the active town polygon and unsuitable for the town planner.',
    },
    {
      name: 'Broadslap Fruit Farm and other nearby food businesses',
      reason: 'Outside the active town polygon and therefore excluded from Dunning\'s Eat list.',
    },
    {
      name: 'Generic or customer-only parking and picnic pins',
      reason:
        'Only the named Rollo Park visitor car park and Thorntree Square picnic benches are published.',
    },
  ],
  artwork: {
    asset: '/town-guides/dunning-st-serfs-2026-guide.png',
    referenceSource: 'St Serf\'s Church by Scott Cormie, Geograph image 7288270',
    referenceUrl: 'https://www.geograph.org.uk/photo/7288270',
    referenceLicence: 'CC BY-SA 2.0',
    treatment: 'Text-free original ink-and-watercolour visitor-guide illustration.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Dunning visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trails, 1 car park, 1 toilet and 1 picnic area. Town rating: ${pkg.project.touristAppeal.rating} star.`,
);
