import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { editorialRatingMethodVersion } from '../src/domain/editorialResearch';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'arbuthnott-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T18:20:00Z';
const projectPath = resolve('data/projects/arbuthnott.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/arbuthnott-full-visitor-audit-2026-08-30.json');
type Feature = HeritageFeature & Record<string, any>;
type Package = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: Feature[] };

const urls = {
  centre: 'https://www.grassicgibbon.com/',
  exhibition: 'https://www.grassicgibbon.com/grassic-gibbon-exhibition/',
  visitAberdeenshire: 'https://visitabdn.com/businesses/the-grassic-gibbon-centre',
  church: 'https://www.scotlandschurchestrust.org.uk/church/st-ternans-church-arbuthnott/',
  churchHes: 'https://portal.historicenvironment.scot/designation/LB2876',
  churchHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB41869',
  estateVisit: 'https://www.arbuthnott.co.uk/house-opening',
  estateGarden: 'https://www.arbuthnott.co.uk/garden',
  cycle: 'https://www.aberdeenshire.gov.uk/media/25046/stonehavenandmearns.pdf',
  councilTrails: 'https://www.aberdeenshire.gov.uk/roads-and-travel/transportation/cycling/commuter-routes',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  treasureSearch: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=arbuthnott',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as Package;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;

const scoreParts = (score: number, food = false) => food
  ? {
      foodAndDrinkQuality: Math.round(score * 0.29),
      daytimeRelevance: Math.round(score * 0.21),
      distinctiveness: Math.round(score * 0.15),
      consistency: Math.round(score * 0.14),
      visitorFit: Math.round(score * 0.11),
      evidenceConfidence:
        score -
        Math.round(score * 0.29) -
        Math.round(score * 0.21) -
        Math.round(score * 0.15) -
        Math.round(score * 0.14) -
        Math.round(score * 0.11),
    }
  : {
      experienceDepth: Math.round(score * 0.3),
      distinctiveness: Math.round(score * 0.2),
      presentation: Math.round(score * 0.2),
      journeyWorth: Math.round(score * 0.15),
      accessAndReliability: Math.round(score * 0.1),
      evidenceConfidence:
        score -
        Math.round(score * 0.3) -
        Math.round(score * 0.2) -
        Math.round(score * 0.2) -
        Math.round(score * 0.15) -
        Math.round(score * 0.1),
      visitability: 'full_visitor_experience' as const,
    };

function source(name: string, organisation: string, url: string, notes: string, reliability: any = 'official_non_statutory', recordId?: string) {
  return {
    sourceName: name,
    sourceOrganisation: organisation,
    sourceUrl: url,
    sourceRecordId: recordId,
    accessedAt: reviewedAt,
    reliability,
    licence: url.includes('openstreetmap.org')
      ? 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.'
      : 'Source-linked editorial evidence; verify time-sensitive details before travel.',
    notes,
  };
}

function make(spec: Record<string, any>): Feature {
  const placeType = spec.placeType === 'Toilets' ? 'Public toilets' : spec.placeType;
  const foodDetails = spec.category === 'food'
    ? `amenity=cafe; food_score=${spec.score}; cuisine=coffee, cake and light lunches; price_band=££; opening_hours:description=${spec.opening}; description=${spec.tagline}. ${spec.description}; `
    : '';
  return {
    id: spec.id,
    projectId,
    name: spec.name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    region: 'Aberdeenshire',
    locality: 'Arbuthnott',
    featureType: spec.featureType,
    significance: spec.significance ?? 'local',
    geometry: { type: 'Point', coordinates: spec.coordinates },
    locationType: 'exact',
    locationConfidence: spec.locationConfidence ?? 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: spec.description,
    visitorWebsiteUrl: spec.website,
    editorialReview: spec.score
      ? {
          status: 'editorially_researched',
          category: spec.category,
          methodVersion: editorialRatingMethodVersion,
          reviewedAt: reviewedDate,
          scoreRationale: spec.reason,
          evidenceUrls: spec.evidenceUrls,
          ...(spec.category === 'food'
            ? { foodAssessment: scoreParts(spec.score, true) }
            : { attractionAssessment: scoreParts(spec.score) }),
        }
      : undefined,
    sourceRecords: spec.evidenceUrls.map((url: string, index: number) =>
      source(
        index ? `${spec.name} supporting evidence` : spec.sourceName,
        index ? (url.includes('openstreetmap.org') ? 'OpenStreetMap contributors' : 'Supporting publisher') : spec.sourceOrganisation,
        url,
        `Current-place curation: visitor_place_type=${placeType}; ${spec.score ? `visit_score=${spec.score}; ` : ''}${foodDetails}${spec.details ?? ''}`,
        url.includes('historicenvironment.scot') ? 'official_statutory' : url.includes('aberdeenshire.gov.uk') ? 'local_authority' : url.includes('openstreetmap.org') ? 'discovery_only' : 'official_non_statutory',
        spec.sourceRecordIds?.[index],
      ),
    ),
    tags: [...new Set([...spec.tags, ...(spec.category === 'food' ? ['service-context-food', 'visitor-context-food'] : [])])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    evidenceScope: 'parish_evidence',
  } as Feature;
}

for (const feature of pkg.features.filter((item) => item.tags.includes('hes-listed-building'))) {
  const dated = Boolean(
    feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null &&
      feature.dateBasis !== 'unknown',
  );
  feature.tags = [...new Set([
    ...feature.tags.filter((tag: string) => tag !== 'map-hidden'),
    'heritage-record-retained',
    ...(dated ? [] : ['map-hidden']),
  ])];
}

const attractions = [
  make({
    id: 'curated-attraction:arbuthnott-grassic-gibbon-centre',
    name: 'The Grassic Gibbon Centre',
    score: 72,
    coordinates: [-2.328097825, 56.8687494],
    featureType: 'museum',
    description: 'Community-run literary centre with storyboards, audio-visual interpretation, books and personal material relating to Lewis Grassic Gibbon and the Mearns.',
    reason: 'Arbuthnott’s clearest public draw and a nationally relevant literary collection, though seasonal and specialist rather than a broad museum.',
    website: urls.centre,
    sourceName: 'The Grassic Gibbon Centre',
    sourceOrganisation: 'The Grassic Gibbon Centre',
    evidenceUrls: [urls.centre, urls.exhibition, urls.visitAberdeenshire, 'https://www.openstreetmap.org/way/466086231'],
    sourceRecordIds: [undefined, undefined, undefined, 'way/466086231'],
    placeType: 'Attraction',
    category: 'attraction',
    tags: ['curated-visitor', 'home-standalone-place', 'current-context'],
    details: 'seasonal exhibition; disabled access; free Wi-Fi; outdoor children’s play area',
  }),
  make({
    id: 'curated-attraction:arbuthnott-st-ternans',
    name: 'St Ternan’s Church and Grassic Gibbon Memorial',
    score: 68,
    coordinates: [-2.327093351469332, 56.862793824517624],
    featureType: 'historic_site',
    significance: 'national',
    description: 'Daily-open medieval parish church with a 13th-century chancel, late-15th-century Arbuthnott aisle, Missal associations and Lewis Grassic Gibbon’s churchyard memorial.',
    reason: 'An unusually complete and accessible medieval church with strong literary connections, but a compact and quiet visit.',
    website: urls.church,
    sourceName: 'St Ternan’s Church, Arbuthnott',
    sourceOrganisation: 'Scotland’s Churches Trust',
    evidenceUrls: [urls.church, urls.churchHes, urls.churchHer],
    placeType: 'Attraction',
    category: 'attraction',
    tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'service-context-heritage'],
    details: 'open daily; active place of worship; consecrated 1242; churchyard memorial',
  }),
  make({
    id: 'curated-attraction:arbuthnott-house-gardens',
    name: 'Arbuthnott House and Gardens',
    score: 64,
    coordinates: [-2.3379029434714553, 56.86659199213954],
    featureType: 'historic_site',
    description: 'Long-held family seat with a house dated 1588 and a steep five-acre formal garden begun in the late 17th century.',
    reason: 'A distinctive private historic house and early garden, materially limited by a small set of pre-booked house days and seasonal garden access.',
    website: urls.estateVisit,
    sourceName: 'Visit Arbuthnott House and Gardens',
    sourceOrganisation: 'Arbuthnott Estate',
    evidenceUrls: [urls.estateVisit, urls.estateGarden, 'https://portal.historicenvironment.scot/designation/LB2880'],
    placeType: 'Attraction',
    category: 'attraction',
    tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'limited-opening'],
    details: 'house tours on published 2026 dates by advance booking; gardens May-July 10:00-16:00 by advance notice; no dogs or picnics; not wheelchair accessible',
  }),
];

const foods = [
  make({
    id: 'curated-food:arbuthnott-grassic-gibbon-cafe',
    name: 'Grassic Gibbon Centre Café',
    tagline: 'Home baking in Sunset Song country',
    opening: 'Seasonal April-October; telephone ahead for current daily hours',
    score: 72,
    coordinates: [-2.328097825, 56.8687494],
    featureType: 'food_drink',
    description: 'Community café serving home-cooked light meals, hot snacks, cakes and other baked goods beside the literary exhibition.',
    reason: 'A distinctive rural café and the only verified coffee, cake and light-lunch stop within Arbuthnott itself.',
    website: urls.centre,
    sourceName: 'The Grassic Gibbon Centre Café',
    sourceOrganisation: 'The Grassic Gibbon Centre',
    evidenceUrls: [urls.centre, urls.exhibition, urls.visitAberdeenshire],
    placeType: 'Eat',
    category: 'food',
    tags: ['curated-visitor', 'current-context', 'food-coffee-cake', 'limited-opening'],
    details: 'seasonal community cafe; takeaway home baking available; accessible entry',
  }),
];

const trails = [
  make({
    id: 'curated-trails:arbuthnott-stonehaven-inverbervie-cycle',
    name: 'Stonehaven–Inverbervie Cycle Route: Arbuthnott Detour',
    score: 64,
    coordinates: [-2.328097825, 56.8687494],
    featureType: 'walking_route',
    description: 'Official cycling map showing an optional circular detour from the wider Stonehaven–Inverbervie route to the Grassic Gibbon Centre.',
    reason: 'A verified council route connection useful to cyclists, but not a self-contained Arbuthnott town trail and excluded from settlement merit.',
    website: urls.cycle,
    sourceName: 'Stonehaven to Inverbervie cycling map',
    sourceOrganisation: 'Aberdeenshire Council',
    evidenceUrls: [urls.cycle, urls.councilTrails],
    placeType: 'Trail',
    category: 'trail',
    tags: ['curated-visitor', 'visitor-context-trail', 'current-context', 'cross-boundary-route'],
    details: 'trail_type=Mapped cycle-route detour; best_for=Cyclists linking the Mearns coast and Arbuthnott; distance=Part of a wider regional circuit; time_to_spend=Allow extra time for the Arbuthnott detour and centre visit; route link checked 2026-08-30',
  }),
];

const parking = [
  make({
    id: 'curated-parking:arbuthnott-grassic-gibbon-centre',
    name: 'Grassic Gibbon Centre Car Park',
    coordinates: [-2.328097825, 56.8687494],
    featureType: 'parking',
    description: 'Extensive free on-site visitor parking at the Grassic Gibbon Centre, with an electric-vehicle charging point.',
    website: urls.visitAberdeenshire,
    sourceName: 'The Grassic Gibbon Centre facilities',
    sourceOrganisation: 'VisitAberdeenshire',
    evidenceUrls: [urls.visitAberdeenshire, urls.estateVisit],
    placeType: 'Parking',
    tags: ['service-context-parking', 'current-context'],
    details: 'access=public; fee=no; payment_required=no; price_display=Free; capacity=not published; capacity:charging=1; visitor parking for the centre and adjacent hall; co-located official visitor-centre coordinate',
  }),
];

const toilets = [
  make({
    id: 'curated-toilets:arbuthnott-grassic-gibbon-centre',
    name: 'Grassic Gibbon Centre Visitor Toilets',
    coordinates: [-2.328097825, 56.8687494],
    featureType: 'toilets',
    description: 'Visitor toilets at the Grassic Gibbon Centre, available during the centre’s seasonal opening.',
    website: urls.estateVisit,
    sourceName: 'Visit Arbuthnott House and Gardens',
    sourceOrganisation: 'Arbuthnott Estate',
    evidenceUrls: [urls.estateVisit, urls.visitAberdeenshire],
    placeType: 'Toilets',
    tags: ['service-context-toilets', 'current-context'],
    details: 'opening_hours:description=Seasonal centre opening; toilets are not available at Arbuthnott House gardens; accessibility of the toilet itself is not specified',
  }),
];

const curated = [...attractions, ...foods, ...trails, ...parking, ...toilets];
pkg.features = [...pkg.features.filter((feature) => !feature.id.startsWith('curated-')), ...curated];

const highlightDetails: Record<string, [string, string, string, string, boolean]> = {
  'curated-attraction:arbuthnott-grassic-gibbon-centre': [
    'Sunset Song life and landscape',
    '45–90 minutes',
    'Seasonal April–October; telephone ahead for current daily hours',
    'Café and shop free to enter; exhibition charge may apply',
    false,
  ],
  'curated-attraction:arbuthnott-st-ternans': [
    'Medieval church and author memorial',
    '30–60 minutes',
    'Open daily; worship may restrict sightseeing',
    'Free; donations welcome',
    true,
  ],
  'curated-attraction:arbuthnott-house-gardens': [
    'Rarely opened family seat and garden',
    '1–2 hours',
    'House on listed 2026 dates by advance booking; gardens May–July 10:00–16:00 by advance notice',
    'House tour £10 including garden; garden £5',
    false,
  ],
};

pkg.project.visitorHighlights = attractions
  .map((feature) => {
    const detail = highlightDetails[feature.id];
    const visitorScore = Object.values(feature.editorialReview!.attractionAssessment)
      .filter((value) => typeof value === 'number')
      .reduce((sum: number, value: any) => sum + value, 0);
    return {
      rank: 1,
      featureId: feature.id,
      name: feature.name,
      reason: feature.editorialReview!.scoreRationale,
      tagline: detail[0],
      visitorScore,
      timeToSpend: detail[1],
      openingTimes: detail[2],
      admission: detail[3],
      freeAdmission: detail[4],
      visitorWebsiteUrl: feature.visitorWebsiteUrl,
      editorialReview: feature.editorialReview,
      sourceName: feature.sourceRecords[0].sourceName,
      sourceUrl: feature.visitorWebsiteUrl!,
      verifiedInBoundaryAt: reviewedDate,
    } as VisitorHighlight;
  })
  .sort((left, right) => right.visitorScore - left.visitorScore)
  .map((item, index) => ({ ...item, rank: index + 1 }));

pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 54,
  dogOwnerScore: 50,
  dogAccessScoreAdjustment: -4,
  rating: 0,
  label: 'Focused Interest',
  summary: 'A focused literary and medieval-church stop with a seasonal community café and rare house-opening days, but too little independent settlement depth for the main town map.',
  dogAccessRating: 1,
  dogAccessSummary: 'The wider rural setting supports responsible outdoor walking, but indoor policies are unconfirmed and Arbuthnott House and Gardens explicitly exclude dogs.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3',
  reviewedAt: reviewedDate,
  sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Sunset Song country and medieval St Ternan’s',
  headline: 'A worthwhile specialist stop, not a complete visitor town',
  intro: 'Arbuthnott is rewarding for Lewis Grassic Gibbon readers and medieval-church enthusiasts. The centre, café and church form a coherent short visit; the house and garden add interest only on limited advertised days.',
  bestFor: ['Lewis Grassic Gibbon and Sunset Song', 'Medieval church architecture', 'A seasonal rural café stop'],
  perfectFor: ['A focused 1–3 hour visit', 'A literary detour through the Mearns'],
  suggestedFirstVisit: {
    title: 'Grassic Gibbon Centre, café and St Ternan’s',
    summary: 'Start at the literary centre and café, then drive or carefully walk the narrow rural lane to the daily-open church and Grassic Gibbon memorial.',
  },
  dontMiss: ['The Grassic Gibbon Centre', 'St Ternan’s Church and Grassic Gibbon Memorial'],
  suggestedTime: '1–3 hours in season; longer only on a house-opening day',
  visitorMood: 'Focused and rewarding for the right interests, with limited public realm and no independent cluster of shops, streets or all-day activities.',
  sourceUrls: Object.values(urls),
  lastReviewedAt: reviewedDate,
};

planner.projects[projectId] = {
  eat: foods.map((feature) => feature.id),
  trails: trails.map((feature) => feature.id),
  parking: parking.map((feature) => feature.id),
  toilets: toilets.map((feature) => feature.id),
  picnic: [],
};

const dogRecord = (rating: number, status: string, label: string, summary: string, sourceUrl: string) => ({
  rating,
  status,
  label,
  summary,
  sourceName: 'Arbuthnott dog-access audit',
  sourceUrl,
  reviewedAt: reviewedDate,
});
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    'curated-attraction:arbuthnott-grassic-gibbon-centre': dogRecord(1, 'unconfirmed', 'Confirm current dog policy', 'No reliable current dog policy was found for the exhibition or café; confirm directly before relying on indoor access.', urls.centre),
    'curated-attraction:arbuthnott-st-ternans': dogRecord(1, 'unconfirmed', 'Confirm church access for dogs', 'No reliable current dog policy was found for the church interior; keep dogs on a short lead and respect the active churchyard.', urls.church),
    'curated-attraction:arbuthnott-house-gardens': dogRecord(0, 'not_allowed', 'No dogs in house or garden', 'The estate explicitly states that dogs are not permitted during public house and garden visits.', urls.estateVisit),
  },
  trail: {
    'curated-trails:arbuthnott-stonehaven-inverbervie-cycle': dogRecord(0, 'not_applicable', 'Cycle route rather than dog walk', 'This is a road-and-cycle-route detour and is not published as a dog-walking recommendation.', urls.cycle),
  },
  eat: {
    'curated-food:arbuthnott-grassic-gibbon-cafe': dogRecord(1, 'unconfirmed', 'Confirm current dog policy', 'No reliable current dog policy was found for the café; confirm directly before relying on indoor seating.', urls.centre),
  },
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((entry: any) => entry.severity === 'error');
if (errors.length) throw new Error(errors.map((entry: any) => entry.message).join('; '));
const hes = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building'));
const visibleHes = hes.filter((feature) => !feature.tags.includes('map-hidden'));
const undatedVisible = visibleHes.filter(
  (feature) =>
    !feature.documentedDateText?.trim() ||
    feature.earliestPossibleYear == null ||
    feature.latestPossibleYear == null ||
    feature.dateBasis === 'unknown',
);
if (undatedVisible.length) throw new Error(`Undated Arbuthnott heritage pins: ${undatedVisible.map((feature) => feature.id).join(', ')}`);

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(
  reportPath,
  `${JSON.stringify({
    reviewedAt,
    projectId,
    townScore: 54,
    dogOwnerScore: 50,
    settlementMerit: {
      result: 'retain_in_selector_but_hide_from_town_map',
      rationale: 'The centre, church and occasional house access make a focused stop, but the settlement lacks the independent public realm, depth and all-day provision required for 60.',
    },
    categoryCounts: { see: attractions.length, eat: foods.length, trails: trails.length, picnic: 0, parking: parking.length, toilets: toilets.length },
    heritageDateAudit: {
      statutoryDesignations: hes.length,
      visiblePins: visibleHes.length,
      datedVisiblePins: visibleHes.length - undatedVisible.length,
      undatedVisiblePins: undatedVisible.map((feature) => feature.id),
      hiddenRetained: hes.filter((feature) => feature.tags.includes('map-hidden')).length,
      localGeometrySource: 'Local HES statutory spatial library',
      descriptionSource: 'Official HES designation descriptions used only where a construction period was stated',
      dateRule: 'Never use designation or database dates as construction dates.',
    },
    trailProviderSearches: [
      { provider: 'TreasureTrails.co.uk', result: 'No Arbuthnott product found; none published.' },
      { provider: 'Aberdeenshire Council', result: 'Verified regional Stonehaven–Inverbervie cycling map with an optional Arbuthnott/Grassic Gibbon Centre detour.' },
      { provider: 'Grassic Gibbon Centre', result: 'A physical leaflet of linked walks is mentioned, but no current route-specific online link was found; excluded from the planner.' },
    ],
    trailBoundaryReview: {
      whollyInTown: [],
      crossBoundaryButServesTown: ['Stonehaven–Inverbervie Cycle Route: Arbuthnott Detour'],
      scoreRule: 'The regional cycle route does not transfer the merit of neighbouring settlements to Arbuthnott.',
    },
    parkingAudit: {
      published: parking.length,
      feeStatus: 'Free visitor parking verified by venue and current event information.',
      coordinateBasis: 'Co-located Grassic Gibbon Centre OSM site centroid; no separate mapped car-park polygon exists in the local extract.',
    },
    foodAudit: {
      published: foods.length,
      brief: 'Coffee, home baking and light lunches; no restaurant-led filler.',
      exclusions: ['No other in-boundary café, tearoom, bakery or farm café verified.'],
    },
    picnicAudit: {
      published: 0,
      result: 'No public picnic site or table in the local OSM extract; Arbuthnott House explicitly prohibits picnics.',
    },
    accessibility: {
      centre: 'VisitAberdeenshire states disabled access; the exact toilet specification is not published.',
      houseAndGarden: 'Officially not wheelchair accessible because of the historic layout and steep garden.',
    },
    boundaryReview: {
      result: 'All published markers fall within Arbuthnott’s existing settlement boundary.',
      excludedNearby: ['Balmakewan Farm Shop', 'Auchenblae', 'Inverbervie', 'Fordoun'],
    },
    verification: {
      linksChecked: reviewedDate,
      visibleHeritageDated: `${visibleHes.length}/${visibleHes.length}`,
      validationErrors: 0,
    },
  }, null, 2)}\n`,
);

console.log(`Arbuthnott audit complete: ${attractions.length} See, ${foods.length} Eat, ${trails.length} Trails, 0 Picnic, ${parking.length} Parking, ${toilets.length} Toilets; ${visibleHes.length}/${visibleHes.length} visible HES pins dated.`);
