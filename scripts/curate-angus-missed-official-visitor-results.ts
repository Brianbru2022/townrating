import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { editorialRatingMethodVersion } from '../src/domain/editorialResearch';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-09-01';
const reviewedAt = '2026-09-01T21:10:00.000Z';
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const dossierPath = resolve('data/review/angus-county-web-research-2026-09-01.json');
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
const dossier: any = JSON.parse(await readFile(dossierPath, 'utf8'));

type Category = 'attraction' | 'trail';
type PlannerCategory = 'trails' | 'picnic' | 'parking' | 'toilets';

interface PlaceSpec {
  id: string;
  name: string;
  coordinates: [number, number];
  featureType: string;
  description: string;
  website: string;
  placeType: 'Attraction' | 'Trail' | 'Picnic' | 'Parking' | 'Public toilets';
  tags: string[];
  category?: Category;
  score?: number;
  reason?: string;
  relatedContext?: boolean;
  reuseFeatureId?: string;
  freeAdmission?: boolean;
  timeToSpend?: string;
  openingTimes?: string;
  admission?: string;
  details?: string;
  attractionGuide?: Record<string, unknown>;
}

interface AuditSpec {
  stem: string;
  notes: string;
  places: PlaceSpec[];
}

const specs: AuditSpec[] = [
  {
    stem: 'aberlemno',
    notes: 'The four Pictish stones and two official routes are published independently in See and Trails. They do not raise the hamlet score.',
    places: [
      {
        id: 'hes-scheduled-monument:SM90004', reuseFeatureId: 'hes-scheduled-monument:SM90004',
        name: 'Aberlemno Sculptured Stones', coordinates: [-2.7810534359, 56.6923451877], featureType: 'archaeological_site',
        description: 'A nationally important group of four Pictish stones, including roadside symbol stones and the churchyard cross-slab, generally displayed outdoors from April to September.',
        website: 'https://visitangus.com/things-to-see-do/attractions/aberlemno-sculptured-stones/', placeType: 'Attraction',
        tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'nearby-attraction'], category: 'attraction', score: 82,
        reason: 'A nationally important and visually distinctive Pictish ensemble with free seasonal access, but the stones are scored as an attraction rather than as settlement merit.',
        relatedContext: true, freeAdmission: true, timeToSpend: '30–60 minutes',
        attractionGuide: { parking: 'A small signed visitor parking area serves the roadside stones; obey local signs.', toilets: 'No dedicated visitor toilets are confirmed at the stones.', picnic: 'No formal picnic provision is claimed.', thingsToDo: [{ name: 'Roadside symbol stones', summary: 'Study the carved Pictish symbols in their roadside recesses.' }, { name: 'Churchyard cross-slab', summary: 'Walk to the churchyard to see the separate cross-slab.' }] },
      },
      {
        id: 'curated-trails:aberlemno-pictish', name: 'The Pictish Trail: Aberlemno', coordinates: [-2.7810534359, 56.6923451877], featureType: 'walking_route',
        description: 'Official regional heritage trail placing the Aberlemno stones in the wider story of Pictish Angus.', website: 'https://visitangus.com/get-inspired/heritage-trails/the-pictish-trail/', placeType: 'Trail',
        tags: ['curated-visitor', 'visitor-context-trail', 'current-context', 'cross-boundary-route'], category: 'trail', score: 72,
        reason: 'A verified official thematic trail for which Aberlemno is a key stop; the other settlements on the route do not inflate this place score.', relatedContext: true,
      },
      {
        id: 'curated-trails:aberlemno-forfar-letham', name: 'Forfar, Aberlemno and Letham Circuit', coordinates: [-2.7810534359, 56.6923451877], featureType: 'cycling_route',
        description: 'Official cycle circuit linking Forfar, Aberlemno and Letham, with the sculptured stones as a principal stop.', website: 'https://visitangus.com/things-to-see-do/trails/forfar-aberlemno-and-letham-circuit/', placeType: 'Trail',
        tags: ['curated-visitor', 'visitor-context-trail', 'current-context', 'cross-boundary-route'], category: 'trail', score: 68,
        reason: 'A usable official route that genuinely visits Aberlemno, explicitly separated from the merit of Forfar and Letham.', relatedContext: true,
      },
    ],
  },
  {
    stem: 'letham-angus',
    notes: 'Two official cycling routes start from or pass through Letham. Their cross-boundary scenery is not transferred into the settlement score.',
    places: [
      {
        id: 'curated-trails:letham-guthrie-pitmuies', name: 'Letham, Guthrie and Pitmuies Circuit', coordinates: [-2.7690175, 56.6289073], featureType: 'cycling_route',
        description: 'Official 33.5 km moderate cycling circuit starting in The Square and visiting Guthrie and Pitmuies.', website: 'https://visitangus.com/things-to-see-do/trails/letham-guthrie-and-pitmuies-circuit/', placeType: 'Trail',
        tags: ['curated-visitor', 'visitor-context-trail', 'current-context', 'cross-boundary-route'], category: 'trail', score: 70,
        reason: 'A substantial official route with a genuine Letham start, while the attractions in Guthrie and Pitmuies remain separately scored.',
      },
      {
        id: 'curated-trails:letham-forfar-aberlemno', name: 'Forfar, Aberlemno and Letham Circuit', coordinates: [-2.7690175, 56.6289073], featureType: 'cycling_route',
        description: 'Official cycling circuit linking Letham with Forfar and the Aberlemno stones.', website: 'https://visitangus.com/things-to-see-do/trails/forfar-aberlemno-and-letham-circuit/', placeType: 'Trail',
        tags: ['curated-visitor', 'visitor-context-trail', 'current-context', 'cross-boundary-route'], category: 'trail', score: 66,
        reason: 'A verified route that passes through Letham; the attractions and facilities of the other places are excluded from the village score.',
      },
    ],
  },
  {
    stem: 'friockheim',
    notes: 'Friockheim Park and its verified facilities are now represented at their own mapped locations. The score stays below 60.',
    places: [
      {
        id: 'curated-attraction:friockheim-park', name: 'Friockheim Park', coordinates: [-2.6536195, 56.6363619], featureType: 'park',
        description: 'Community park with play areas, BMX track, barbecue space, benches, picnic provision and a botanic garden.', website: 'https://visitangus.com/things-to-see-do/attractions/friockheim-park/', placeType: 'Attraction',
        tags: ['curated-visitor', 'current-context', 'family-attraction'], category: 'attraction', score: 66,
        reason: 'A useful free family and picnic stop with supporting facilities, but not enough on its own to make the settlement a 60+ destination.', freeAdmission: true, timeToSpend: '45–90 minutes',
        attractionGuide: { parking: 'A large car park serves the park; four electric-vehicle charging spaces are listed.', toilets: 'Public toilets are available at Friockheim Bus Stance.', picnic: 'Picnic benches and a barbecue area are promoted in the park.', thingsToDo: [{ name: 'Play and BMX areas' }, { name: 'Botanic garden' }, { name: 'Picnic and barbecue stop' }] },
      },
      {
        id: 'curated-picnic:friockheim-park', name: 'Friockheim Park Picnic Area', coordinates: [-2.6536195, 56.6363619], featureType: 'picnic_site',
        description: 'Officially promoted picnic and barbecue area within Friockheim Park.', website: 'https://visitangus.com/things-to-see-do/attractions/friockheim-park/', placeType: 'Picnic', tags: ['service-context-picnic', 'current-context'],
      },
      {
        id: 'curated-parking:friockheim-park', name: 'Friockheim Park Car Park', coordinates: [-2.6547758, 56.6370027], featureType: 'parking',
        description: 'Surface visitor parking serving Friockheim Park; the official visitor page describes a large car park with four electric-vehicle charging spaces.', website: 'https://visitangus.com/things-to-see-do/attractions/friockheim-park/', placeType: 'Parking', tags: ['service-context-parking', 'current-context'],
        details: 'Location cross-checked against current OpenStreetMap geometry; obey site signs.',
      },
      {
        id: 'curated-toilets:friockheim-bus-stance', name: 'Friockheim Bus Stance Public Toilets', coordinates: [-2.6561926, 56.6376067], featureType: 'toilets',
        description: 'Public toilets at Friockheim Bus Stance, identified by the official park visitor information and current mapped building geometry.', website: 'https://www.angus.gov.uk/directories/public_toilets_and_radar_keys/all_public_toilets_listed_by_location', placeType: 'Public toilets', tags: ['service-context-toilets', 'current-context'],
      },
    ],
  },
  {
    stem: 'pitmuies',
    notes: 'Pitmuies Gardens is shown as a separate seasonal attraction with its own facilities; it does not inflate a settlement score.',
    places: [
      {
        id: 'curated-attraction:pitmuies-gardens', name: 'Pitmuies Gardens', coordinates: [-2.7064937, 56.6375909], featureType: 'garden',
        description: 'Seasonal historic gardens with woodland, lochside and walled-garden walks around Pitmuies House.', website: 'https://visitangus.com/things-to-see-do/attractions/pitmuies-gardens/', placeType: 'Attraction',
        tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'nearby-attraction'], category: 'attraction', score: 78,
        reason: 'A substantial seasonal garden visit with varied walks and useful facilities, published independently from the low settlement score.', relatedContext: true, timeToSpend: '1–2 hours',
        openingTimes: 'April to September, daily 10:00–17:00', admission: 'Adult £5; children free',
        attractionGuide: { parking: 'On-site visitor parking is available; follow estate signs.', toilets: 'Accessible visitor toilets are promoted by the operator.', picnic: 'Designated picnic areas are promoted in the gardens.', trails: [{ name: 'Garden and woodland walks', summary: 'Explore the walled garden, woodland and lochside paths.', routeType: 'Garden walk', externalUrl: 'https://visitangus.com/things-to-see-do/attractions/pitmuies-gardens/' }], thingsToDo: [{ name: 'Walled garden' }, { name: 'Woodland and lochside walks' }] },
      },
      {
        id: 'curated-picnic:pitmuies-gardens', name: 'Pitmuies Gardens Picnic Areas', coordinates: [-2.7064937, 56.6375909], featureType: 'picnic_site',
        description: 'Designated picnic provision inside the seasonal gardens; garden admission and opening arrangements apply.', website: 'https://visitangus.com/get-inspired/itineraries/dog-friendly-holidays-in-angus/', placeType: 'Picnic', tags: ['service-context-picnic', 'current-context', 'related-context'], relatedContext: true,
      },
      {
        id: 'curated-toilets:pitmuies-gardens', name: 'Pitmuies Gardens Visitor Toilets', coordinates: [-2.7064937, 56.6375909], featureType: 'toilets',
        description: 'Accessible toilets for garden visitors during seasonal opening.', website: 'https://visitangus.com/get-inspired/itineraries/dog-friendly-holidays-in-angus/', placeType: 'Public toilets', tags: ['service-context-toilets', 'current-context', 'accessible-toilet', 'related-context'], relatedContext: true,
      },
    ],
  },
  {
    stem: 'kinnordy',
    notes: 'Loch of Kinnordy is shown as a related nature-reserve attraction and is not used to make Kinnordy estate a map town.',
    places: [
      {
        id: 'curated-attraction:kinnordy-loch', name: 'Loch of Kinnordy Nature Reserve', coordinates: [-3.0410922, 56.6753212], featureType: 'natural_landmark',
        description: 'RSPB wetland reserve with three hides, paths and birdwatching from dawn to dusk.', website: 'https://visitangus.com/things-to-see-do/attractions/loch-of-kinnordy/', placeType: 'Attraction',
        tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'nearby-attraction', 'nature-reserve'], category: 'attraction', score: 76,
        reason: 'A worthwhile wildlife destination with three hides and parking, but it is independently scored and does not turn the estate locality into a destination town.', relatedContext: true, freeAdmission: true, timeToSpend: '1–3 hours',
        attractionGuide: { parking: 'A visitor car park serves the reserve.', toilets: 'No dedicated public toilets are confirmed on the official visitor page.', picnic: 'No formal picnic provision is claimed.', thingsToDo: [{ name: 'Three wildlife hides' }, { name: 'Wetland birdwatching' }] },
      },
    ],
  },
  {
    stem: 'cortachy',
    notes: 'The official Cortachy River Walk is now published as a named route. Castle-estate merit remains excluded from the place score.',
    places: [
      {
        id: 'curated-trails:cortachy-river-walk', name: 'Cortachy River Walk', coordinates: [-2.9922956, 56.7252114], featureType: 'walking_route',
        description: 'Official 4 km moderate circular walk from the car park near Cortachy Primary School, following riverside and estate paths.', website: 'https://visitangus.com/things-to-see-do/trails/walking-trail-cortachy-river-walk/', placeType: 'Trail',
        tags: ['curated-visitor', 'visitor-context-trail', 'current-context'], category: 'trail', score: 70,
        reason: 'A clearly described two-hour official walk with a genuine village start; private castle-estate merit is not transferred into the place score.',
      },
    ],
  },
  {
    stem: 'tarfside',
    notes: 'The official Glen Esk route and correctly positioned start facilities are now represented. The remote settlement remains below 60.',
    places: [
      {
        id: 'curated-trails:tarfside-badalair', name: 'Glen Esk, Tarfside and the Badalair', coordinates: [-2.8342356, 56.9054583], featureType: 'walking_route',
        description: 'Official 14.7 km difficult Glen Esk route beginning at Tarfside car park.', website: 'https://visitangus.com/things-to-see-do/trails/glen-esk-tarfside-and-the-badalair/', placeType: 'Trail',
        tags: ['curated-visitor', 'visitor-context-trail', 'current-context', 'cross-boundary-route'], category: 'trail', score: 72,
        reason: 'A substantial verified route with a genuine Tarfside start, scored as a trail without transferring the wider glen into the settlement rating.',
      },
      {
        id: 'curated-parking:tarfside', name: 'Tarfside Car Park', coordinates: [-2.8342356, 56.9054583], featureType: 'parking',
        description: 'Free surface car park at the route start, open from sunrise to sunset; obey current site signs.', website: 'https://visitangus.com/things-to-see-do/trails/glen-esk-tarfside-and-the-badalair/', placeType: 'Parking', tags: ['service-context-parking', 'current-context'],
        details: 'Current OpenStreetMap geometry confirms the mapped position, fee=no and sunrise-to-sunset opening.',
      },
      {
        id: 'curated-toilets:tarfside', name: 'Tarfside Public Toilets', coordinates: [-2.8346524, 56.9055337], featureType: 'toilets',
        description: 'Free public toilet building beside Tarfside car park at the official route start.', website: 'https://visitangus.com/things-to-see-do/trails/glen-esk-tarfside-and-the-badalair/', placeType: 'Public toilets', tags: ['service-context-toilets', 'current-context'],
        details: 'Current OpenStreetMap building geometry confirms the mapped position and public access.',
      },
    ],
  },
  {
    stem: 'balgavies',
    notes: 'Balgavies Loch is shown as an independently scored reserve, not as settlement merit.',
    places: [
      {
        id: 'curated-attraction:balgavies-loch', name: 'Balgavies Loch Nature Reserve', coordinates: [-2.7739683, 56.6501498], featureType: 'natural_landmark',
        description: 'Scottish Wildlife Trust loch reserve with a hide and viewpoint for wetland wildlife.', website: 'https://visitangus.com/things-to-see-do/attractions/balgavies-loch/', placeType: 'Attraction',
        tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'nearby-attraction', 'nature-reserve'], category: 'attraction', score: 68,
        reason: 'A worthwhile specialist wildlife stop with a hide and parking, kept separate from the low settlement score.', relatedContext: true, freeAdmission: true, timeToSpend: '45–120 minutes',
        attractionGuide: { parking: 'A visitor car park lies a few hundred metres west of the loch.', toilets: 'No dedicated public toilets are confirmed on the official visitor page.', picnic: 'No formal picnic provision is claimed.', thingsToDo: [{ name: 'Wildlife hide and viewpoint' }, { name: 'Wetland birdwatching' }] },
      },
    ],
  },
  {
    stem: 'lunan',
    notes: 'Lunan Bay is published as a separate coastal attraction with its own practical information and does not raise the hamlet score.',
    places: [
      {
        id: 'curated-attraction:lunan-bay', name: 'Lunan Bay', coordinates: [-2.5047304, 56.647539], featureType: 'natural_landmark',
        description: 'Broad sandy North Sea beach backed by dunes, with an accessible viewing platform and views towards Red Castle.', website: 'https://visitangus.com/things-to-see-do/attractions/lunan-bay/', placeType: 'Attraction',
        tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'nearby-attraction', 'coastal-access'], category: 'attraction', score: 80,
        reason: 'A strong free beach destination with substantial scenery and access information, independently scored so it does not inflate the small settlement.', relatedContext: true, freeAdmission: true, timeToSpend: '1–3 hours',
        attractionGuide: { parking: 'The signed beach car park is closed overnight and does not permit overnight parking.', toilets: 'Public toilets are available at Lunan Farm Shop; check current opening hours.', picnic: 'Informal packed-picnic use is possible at the beach, but no fixed-table provision is claimed.', thingsToDo: [{ name: 'Beach and dunes' }, { name: 'Accessible viewing platform' }, { name: 'Red Castle views' }] },
      },
    ],
  },
  {
    stem: 'redcastle-angus',
    notes: 'The ruined Red Castle is now represented only as a related See attraction. The hamlet stays selector-only and restricted access is explicit.',
    places: [
      {
        id: 'curated-attraction:redcastle-ruin', name: 'Red Castle', coordinates: [-2.5106769, 56.6504726], featureType: 'castle',
        description: 'Ruined medieval castle above Lunan Bay, best viewed from the estuary and beach because direct access is restricted by safety fencing.', website: 'https://visitangus.com/things-to-see-do/attractions/red-castle/', placeType: 'Attraction',
        tags: ['curated-visitor', 'current-context', 'nearby-attraction', 'restricted-access'], category: 'attraction', score: 60,
        reason: 'A picturesque visible ruin with real historic interest, tempered by restricted access and safety fencing; it does not support the hamlet score.', relatedContext: true, freeAdmission: true, timeToSpend: '15–30 minutes',
        attractionGuide: { parking: 'Use lawful Lunan Bay visitor parking and approach viewpoints on foot.', toilets: 'No toilets are provided at the ruin; facilities at Lunan Farm Shop depend on opening hours.', picnic: 'No picnic provision is claimed at the fenced ruin.', thingsToDo: [{ name: 'View the ruin from Lunan Bay' }, { name: 'Photograph the castle above the estuary' }] },
      },
    ],
  },
  {
    stem: 'carmyllie',
    notes: 'The dated parish church is now represented in See as an exterior heritage stop. It supports, but does not alone determine, the existing 64 settlement score.',
    places: [
      {
        id: 'hes-listed-building:LB4577', reuseFeatureId: 'hes-listed-building:LB4577',
        name: 'Carmyllie Parish Church', coordinates: [-2.7352958085, 56.5730953406], featureType: 'church',
        description: 'Historic parish church and chapel group on the Carmyllie circular route, with the present fabric incorporating work from several periods.', website: 'https://visitangus.com/things-to-see-do/trails/walking-trail-carmyllie-circular-trail/', placeType: 'Attraction',
        tags: ['curated-visitor', 'current-context', 'historic-setting'], category: 'attraction', score: 45,
        reason: 'A genuine exterior heritage point on the village walk, but limited routine interior access keeps it a brief local stop.', freeAdmission: true, timeToSpend: '15–30 minutes',
        relatedContext: true,
        attractionGuide: { parking: 'Use lawful village parking and do not obstruct church or residential access.', toilets: 'No dedicated public visitor toilets are confirmed at the church.', picnic: 'No formal picnic provision is claimed at the church.', thingsToDo: [{ name: 'Church and kirkyard exterior' }] },
      },
    ],
  },
];

function assessment(score: number, category: Category) {
  const parts = [0.30, 0.20, 0.20, 0.15, 0.10].map((part) => Math.round(score * part));
  return {
    experienceDepth: parts[0], distinctiveness: parts[1], presentation: parts[2], journeyWorth: parts[3],
    accessAndReliability: parts[4], evidenceConfidence: score - parts.reduce((sum, value) => sum + value, 0),
    visitability: 'full_visitor_experience',
  };
}

function plannerCategory(placeType: PlaceSpec['placeType']): PlannerCategory | undefined {
  if (placeType === 'Trail') return 'trails';
  if (placeType === 'Picnic') return 'picnic';
  if (placeType === 'Parking') return 'parking';
  if (placeType === 'Public toilets') return 'toilets';
  return undefined;
}

function sourceNotes(spec: PlaceSpec): string {
  return [
    `Current-place curation: visitor_place_type=${spec.placeType}`,
    ...(spec.score ? [`visit_score=${spec.score}`, `tagline=${spec.name}`] : []),
    ...(spec.category === 'attraction' ? ['opening_hours:description=Check the linked official visitor page before travel'] : []),
    ...(spec.details ? [spec.details] : []),
    `description=${spec.description}`,
  ].join('; ');
}

function makeFeature(pkg: any, spec: PlaceSpec) {
  return {
    id: spec.id, projectId: pkg.project.id, name: spec.name, alternativeNames: [], countryCode: pkg.project.countryCode,
    region: pkg.project.region, locality: pkg.project.locality, featureType: spec.featureType,
    significance: spec.score && spec.score >= 80 ? 'national' : 'local', geometry: { type: 'Point', coordinates: spec.coordinates },
    locationType: 'exact', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
    shortDescription: spec.description, visitorWebsiteUrl: spec.website, attractionGuide: spec.attractionGuide,
    editorialReview: spec.score && spec.category ? {
      status: 'editorially_researched', category: spec.category, methodVersion: editorialRatingMethodVersion,
      reviewedAt: reviewedDate, scoreRationale: spec.reason, evidenceUrls: [spec.website],
      attractionAssessment: assessment(spec.score, spec.category),
    } : undefined,
    sourceRecords: [{ sourceName: `${spec.name} current visitor evidence`, sourceOrganisation: spec.website.includes('angus.gov.uk') ? 'Angus Council' : spec.website.includes('openstreetmap') ? 'OpenStreetMap contributors' : 'VisitAngus / current operator', sourceUrl: spec.website, accessedAt: reviewedAt, reliability: spec.website.includes('angus.gov.uk') ? 'local_authority' : 'official_non_statutory', licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes: sourceNotes(spec) }],
    tags: [...new Set([...spec.tags, ...(spec.relatedContext ? ['related-context'] : [])])],
    createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true,
    evidenceScope: spec.relatedContext ? 'related_context' : 'parish_evidence',
    reviewNotes: spec.relatedContext ? 'Separately scored nearby attraction or route; excluded from the settlement score.' : 'Current visitor audit item within the place boundary.',
  };
}

function applyVisitorFields(existing: any, spec: PlaceSpec) {
  return {
    ...existing,
    visitorWebsiteUrl: spec.website,
    attractionGuide: spec.attractionGuide,
    editorialReview: {
      status: 'editorially_researched', category: spec.category, methodVersion: editorialRatingMethodVersion,
      reviewedAt: reviewedDate, scoreRationale: spec.reason, evidenceUrls: [spec.website],
      attractionAssessment: assessment(spec.score!, spec.category!),
    },
    tags: [...new Set([...(existing.tags ?? []), ...spec.tags, ...(spec.relatedContext ? ['related-context'] : [])])],
    updatedAt: reviewedAt,
    reviewed: true,
    evidenceScope: spec.relatedContext ? 'related_context' : existing.evidenceScope,
    reviewNotes: `${existing.reviewNotes ? `${existing.reviewNotes} ` : ''}Current visitor interpretation checked ${reviewedDate}; the historic date remains sourced separately from the statutory record.`,
  };
}

for (const audit of specs) {
  const projectPath = resolve(`data/projects/${audit.stem}.json`);
  const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
  const ownedIds = new Set(audit.places.map((place) => place.id));
  pkg.features = pkg.features.filter((feature: any) => !ownedIds.has(feature.id) || audit.places.some((place) => place.reuseFeatureId === feature.id));

  for (const place of audit.places) {
    if (place.reuseFeatureId) {
      const index = pkg.features.findIndex((feature: any) => feature.id === place.reuseFeatureId);
      if (index < 0) throw new Error(`${pkg.project.name}: missing reusable feature ${place.reuseFeatureId}`);
      pkg.features[index] = applyVisitorFields(pkg.features[index], place);
    } else {
      pkg.features.push(makeFeature(pkg, place));
    }
  }

  const attractionSpecs = audit.places.filter((place) => place.category === 'attraction');
  const untouchedHighlights = (pkg.project.visitorHighlights ?? []).filter((highlight: any) => !ownedIds.has(highlight.featureId));
  const addedHighlights = attractionSpecs.map((place, index) => ({
    rank: index + 1, featureId: place.id, name: place.name, reason: place.reason, tagline: place.name,
    visitorScore: place.score, timeToSpend: place.timeToSpend ?? '45–90 minutes',
    openingTimes: place.openingTimes ?? (place.freeAdmission ? 'Open access subject to site-specific and seasonal restrictions' : undefined),
    admission: place.admission ?? (place.freeAdmission ? 'Free' : undefined), freeAdmission: place.freeAdmission ?? false,
    attractionGuide: place.attractionGuide, visitorWebsiteUrl: place.website,
    editorialReview: pkg.features.find((feature: any) => feature.id === place.id)?.editorialReview,
    sourceName: `${place.name} current visitor evidence`, sourceUrl: place.website, verifiedInBoundaryAt: reviewedDate,
  }));
  pkg.project.visitorHighlights = [...untouchedHighlights, ...addedHighlights]
    .sort((left: any, right: any) => (right.visitorScore ?? 0) - (left.visitorScore ?? 0) || left.name.localeCompare(right.name))
    .map((highlight: any, index: number) => ({ ...highlight, rank: index + 1 }));

  const currentPlanner = planner.projects[pkg.project.id] ?? {};
  for (const category of ['trails', 'picnic', 'parking', 'toilets'] as PlannerCategory[]) {
    const previous = (currentPlanner[category] ?? []).filter((id: string) => !ownedIds.has(id));
    const additions = audit.places.filter((place) => plannerCategory(place.placeType) === category).map((place) => place.id);
    currentPlanner[category] = [...new Set([...previous, ...additions])];
  }
  planner.projects[pkg.project.id] = currentPlanner;

  const currentDog = dog.projects[pkg.project.id] ?? { attraction: {}, trail: {}, eat: {} };
  currentDog.attraction ??= {};
  currentDog.trail ??= {};
  for (const place of audit.places.filter((item) => item.category)) {
    const kind = place.category === 'attraction' ? 'attraction' : 'trail';
    currentDog[kind][place.id] = {
      rating: 3, status: 'outdoor_only', label: 'Responsible outdoor access',
      summary: 'Use responsible outdoor access under the Scottish Outdoor Access Code and check site-specific restrictions.',
      sourceName: 'Current operator and Scottish Outdoor Access Code review', sourceUrl: 'https://www.outdooraccess-scotland.scot/dog-owners', reviewedAt: reviewedDate,
    };
  }
  dog.projects[pkg.project.id] = currentDog;

  const sourceUrls = [...new Set(audit.places.map((place) => place.website))];
  pkg.project.touristAppeal.sourceUrls = [...new Set([...(pkg.project.touristAppeal.sourceUrls ?? []), ...sourceUrls])];
  pkg.project.touristAppeal.reviewedAt = reviewedDate;
  pkg.project.townGuide.sourceUrls = [...new Set([...(pkg.project.townGuide?.sourceUrls ?? []), ...sourceUrls])];
  pkg.project.townGuide.lastReviewedAt = reviewedDate;
  pkg.project.researchNotes = `${pkg.project.researchNotes ?? ''} Angus-wide full-audit follow-up ${reviewedDate}: ${audit.notes} Named-provider searches covered Treasure Trails, CuriousAbout, Mystery Guides and GoQuest; practical categories were checked against current official/operator pages. Scores were left unchanged because these additions do not justify transferring related-attraction merit into the settlement.`.trim();
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((result: any) => result.severity === 'error');
  if (errors.length) throw new Error(`${pkg.project.name}: ${errors.map((result: any) => result.message).join('; ')}`);
  await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  const placeRow = dossier.places.find((row: any) => row.id === pkg.project.id);
  if (placeRow) {
    placeRow.sources.currentPublishedVisitorUrls = [...new Set([...(placeRow.sources.currentPublishedVisitorUrls ?? []), ...sourceUrls])];
    const officialResults = audit.places
      .filter((place) => place.website.includes('visitangus.com'))
      .map((place) => ({ title: place.name, url: place.website, subtype: place.placeType.toLowerCase() }));
    placeRow.sources.visitAngus.exactResults = officialResults;
    placeRow.sources.visitAngus.exactResultCount = officialResults.length;
    placeRow.sources.visitAngus.recoveryNote = 'Exact results were manually reconciled against live official VisitAngus pages during the county audit follow-up.';
  }
}

await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
await writeFile(dossierPath, `${JSON.stringify(dossier, null, 2)}\n`, 'utf8');

console.log(JSON.stringify(specs.map((audit) => ({ stem: audit.stem, additions: audit.places.length })), null, 2));
