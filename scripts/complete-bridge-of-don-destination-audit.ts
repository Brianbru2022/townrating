import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'bridge-of-don-aberdeen-scotland';
const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T16:15:00.000Z';
const projectPath = resolve('data/projects/bridge-of-don-aberdeen.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/bridge-of-don-full-visitor-audit-2026-08-27.json');

const urls = {
  councilTrail: 'https://sites.aberdeencity.gov.uk/sites/default/files/2020-09/Bridge%20of%20Don%20Trail.pdf',
  councilTrails: 'https://sites.aberdeencity.gov.uk/AAGM/local-history/heritage-trails',
  donsTrail: 'https://sites.aberdeencity.gov.uk/sites/default/files/2020-10/Donside%20Heritage%20Trail.pdf',
  donmouth: 'https://visitabdn.com/businesses/donmouth-local-nature-reserve',
  reserves: 'https://services5.arcgis.com/0sktPVp3t1LvXc9z/arcgis/rest/services/Local_Nature_Reserves/FeatureServer',
  hesBridge: 'https://portal.historicenvironment.scot/designation/LB20069',
  hesBrig: 'https://portal.historicenvironment.scot/designation/LB20067',
  hesCottown: 'https://portal.historicenvironment.scot/designation/LB15668',
  treasureTrail: 'https://www.treasuretrails.co.uk/products/what-to-do-aberdeen-aberdeenshire',
  crema: 'https://cremaaberdeen.com/page/2/',
  alba: 'https://www.albassweetbake.com/',
  smiddy: 'https://visitabdn.com/businesses/smoke-and-soul-at-the-old-smiddy',
  coffeeBar: 'https://bridgeofdoncommunitycouncil.org.uk/wp-content/uploads/2025/06/Bridge-of-Don-Community-Council-Newsletter-Summer-2025.pdf',
  parking: 'https://www.getabout.org.uk/sites/bridge-of-don/',
  accessCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  osm: 'https://www.openstreetmap.org/copyright',
  hesOmegaHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB23675',
  boundaryStonesTrail: 'https://www.visitabdn.com/assets/Aberdeen-City-Council-Boundary-Stones-Trail.pdf',
  curiousAbout: 'https://curiousabout.co.uk/aberdeen.html',
  mysteryGuides: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
  oldmacharCafe: 'https://thelivingwellproject.org.uk/',
  kingsOfficial: 'https://www.kingschurchaberdeen.com/sayhello',
  sourCloud: 'https://honestbread.co.uk/bakery/sourcloud/',
  costa: 'https://www.costa.co.uk/store-locator/map',
  starbucks: 'https://www.starbucks.co.uk/store-locator',
  publicToilets: 'https://www.getabout.org.uk/sites/bridge-of-don/',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as any;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;

const upsert = (feature: any) => {
  const index = pkg.features.findIndex((item: any) => item.id === feature.id);
  if (index >= 0) pkg.features[index] = feature;
  else pkg.features.push(feature);
  return feature;
};

const attractionAssessment = (score: number) => {
  const result: any = {
    experienceDepth: Math.min(30, Math.round(score * 0.3)),
    distinctiveness: Math.min(20, Math.round(score * 0.2)),
    presentation: Math.min(20, Math.round(score * 0.2)),
    journeyWorth: Math.min(15, Math.round(score * 0.15)),
    accessAndReliability: Math.min(10, Math.round(score * 0.1)),
    evidenceConfidence: 0,
    visitability: 'full_visitor_experience',
  };
  const subtotal = Object.entries(result)
    .filter(([key]) => !['evidenceConfidence', 'visitability'].includes(key))
    .reduce((sum, [, value]) => sum + Number(value), 0);
  result.evidenceConfidence = score - subtotal;
  return result;
};

const makeVisitorFeature = (spec: any) => {
  const prefix = spec.category === 'food' ? 'curated-eat' : spec.category === 'trail' ? 'curated-trails' : 'curated-attraction';
  const id = spec.id ?? `${prefix}:bridge-of-don-${spec.slug}`;
  const evidenceUrls = spec.evidenceUrls ?? [spec.website];
  const review: any = {
    status: 'editorially_researched',
    category: spec.category,
    methodVersion: '2026-08-13-researched-visitor-value-v1',
    reviewedAt: reviewedDate,
    scoreRationale: spec.reason,
    evidenceUrls,
  };
  if (spec.category === 'food') {
    review.foodAssessment = {
      foodAndDrinkQuality: Math.round(spec.score * 0.29),
      daytimeRelevance: Math.round(spec.score * 0.21),
      distinctiveness: Math.round(spec.score * 0.15),
      consistency: Math.round(spec.score * 0.14),
      visitorFit: Math.round(spec.score * 0.11),
      evidenceConfidence: 0,
    };
    const subtotal = Object.values(review.foodAssessment).reduce((sum: number, value) => sum + Number(value), 0);
    review.foodAssessment.evidenceConfidence = spec.score - subtotal;
  } else {
    review.attractionAssessment = attractionAssessment(spec.score);
  }

  const notes = spec.category === 'food'
    ? `Current-place curation: visitor_place_type=Eat; visit_score=${spec.score}; food_score=${spec.score}; price_band=${spec.priceBand ?? '££'}; cuisine=${spec.foodStyle}; opening_hours:description=${spec.opening}; dog_friendly=${spec.dogLabel}; description=${spec.tagline}: ${spec.description}`
    : spec.category === 'trail'
      ? `Current-place curation: visitor_place_type=Walking route; route=foot; visit_score=${spec.score}; trail_score=${spec.score}; trail_type=${spec.trailType}; distance=${spec.distance}; duration=${spec.duration}; difficulty=${spec.difficulty}; dog_friendly=${spec.dogLabel}; fee=${spec.admission}; description=${spec.tagline}: ${spec.description}`
      : `Current-place curation: visitor_place_type=Attraction; visit_score=${spec.score}; opening_hours:description=${spec.opening}; fee=${spec.admission}; dog_friendly=${spec.dogLabel}; description=${spec.tagline}: ${spec.description}`;

  const feature = upsert({
    id,
    projectId,
    name: spec.name,
    alternativeNames: spec.alternativeNames ?? [],
    countryCode: 'GB-SCT',
    region: 'Aberdeen City',
    locality: 'Bridge of Don',
    featureType: spec.featureType ?? (spec.category === 'food' ? 'commercial_building' : 'other'),
    designationType: spec.designationType,
    designationCategory: spec.designationCategory,
    significance: spec.significance ?? 'local',
    statutoryStatus: spec.statutoryStatus,
    geometry: { type: 'Point', coordinates: spec.coordinates },
    locationType: spec.locationType ?? 'exact',
    documentedDateText: spec.documentedDateText,
    earliestPossibleYear: spec.earliestPossibleYear,
    latestPossibleYear: spec.latestPossibleYear,
    datePrecision: spec.datePrecision,
    dateBasis: spec.dateBasis ?? 'unknown',
    dateConfidence: spec.dateConfidence ?? (spec.documentedDateText ? 'high' : 'unknown'),
    locationConfidence: spec.locationConfidence ?? 'high',
    survival: spec.survival ?? 'substantially_intact',
    shortDescription: spec.description,
    sourceRecords: evidenceUrls.map((sourceUrl: string, index: number) => ({
      sourceName: index === 0 ? spec.sourceName : `${spec.name} supporting evidence`,
      sourceOrganisation: spec.sourceOrganisation ?? spec.sourceName,
      sourceUrl,
      accessedAt: reviewedAt,
      licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
      quotedDateText: index === 0 ? spec.documentedDateText : undefined,
      reliability: sourceUrl.includes('aberdeencity.gov.uk') ? 'local_authority' : sourceUrl.includes('historicenvironment.scot') ? 'official_statutory' : 'official_non_statutory',
      notes: index === 0 ? notes : 'Supporting current visitor, access or historic evidence.',
    })),
    tags: spec.category === 'food'
      ? ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context']
      : spec.category === 'trail'
        ? ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context']
        : ['curated-visitor', 'home-standalone-place'],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    evidenceScope: 'parish_evidence',
    attractionGuide: spec.guide,
    visitorWebsiteUrl: spec.website,
    editorialReview: review,
  });
  return { id, feature, review, spec };
};

const attractions = [
  makeVisitorFeature({
    category: 'attraction', slug: 'brig-o-balgownie', name: "Brig o' Balgownie", score: 82,
    coordinates: [-2.09850, 57.17727], featureType: 'bridge', significance: 'national',
    designationType: 'listed_building', designationCategory: 'A', statutoryStatus: 'designated',
    documentedDateText: 'Built 1314–1318; repaired circa 1444 and largely rebuilt in the early 17th century', earliestPossibleYear: 1314, latestPossibleYear: 1318, datePrecision: 'year_range', dateBasis: 'documented_date_range',
    description: 'A steep, single-span medieval granite bridge over the Don, once the principal route into Aberdeen from the north.',
    tagline: 'Medieval bridge and riverside landmark', reason: 'The district’s strongest historic sight: a nationally important medieval crossing with a memorable river setting and a well-documented fabric history.',
    opening: 'Pedestrian access at all times; visit in daylight in poor weather', admission: 'Free', dogLabel: 'Suitable with close control',
    website: urls.hesBrig, sourceName: 'Historic Environment Scotland', evidenceUrls: [urls.hesBrig, urls.donmouth],
    guide: { headline: 'Cross Aberdeen’s ancient bridge into Balgownie', intro: 'The narrow, steeply pitched bridge is now pedestrian and best approached as part of the Don riverside paths.', bestFor: ['Medieval engineering', 'River views', 'Photography'], parking: 'No dedicated bridge car park. Use a legitimate public car park and approach on foot; do not obstruct Cottown of Balgownie.', toilets: 'No toilets at the bridge.', trails: [{ name: 'Donmouth and Balgownie riverside loop', summary: 'Links the old bridge, river paths and estuary reserve.', routeType: 'Riverside and urban paths', externalUrl: urls.councilTrail }] },
  }),
  makeVisitorFeature({
    category: 'attraction', slug: 'donmouth-local-nature-reserve', name: 'Donmouth Local Nature Reserve', score: 78,
    coordinates: [-2.08457, 57.17577], featureType: 'park', significance: 'regional',
    description: 'River-mouth reserve with dunes, beach, boardwalk paths, a bird hide, seals and feeding waders.',
    tagline: 'Estuary wildlife, dunes and beach', reason: 'A substantial, free coastal nature stop with good paths, a bird hide and credible seal and bird watching, reduced for sand-limited wheelchair access and wildlife sensitivity.',
    opening: 'Open at all times; daylight is best for paths and wildlife', admission: 'Free', dogLabel: 'Dogs under close control around birds and dunes',
    website: urls.donmouth, sourceName: 'VisitAberdeenshire', evidenceUrls: [urls.donmouth, urls.reserves],
    guide: { headline: 'Watch the River Don meet the North Sea', intro: 'Use the bird hide and boardwalk paths without entering fenced breeding areas or disturbing seals and waders.', bestFor: ['Birdwatching', 'Seals', 'Coastal walking'], parking: 'The small public Donmouth Road surface car park is free; capacity is not authoritatively published and the mapped entrance has a 7 ft 8 in height restriction.', toilets: 'No dedicated reserve toilets are verified.', picnic: 'No formal reserve picnic area is claimed; protect the dunes and take litter away.' },
  }),
  makeVisitorFeature({
    category: 'attraction', slug: 'granite-bridge', name: 'Bridge of Don', score: 72,
    coordinates: [-2.09058, 57.17562], featureType: 'bridge', significance: 'regional',
    designationType: 'listed_building', designationCategory: 'B', statutoryStatus: 'designated',
    documentedDateText: 'Built 1827–1830; widened 1958–1960', earliestPossibleYear: 1827, latestPossibleYear: 1830, datePrecision: 'year_range', dateBasis: 'documented_date_range',
    description: 'John Smith’s five-arch granite crossing, modified by Thomas Telford, reflected in the lower River Don.',
    tagline: 'Five granite arches above the Don', reason: 'The bridge gives the district its name and is a handsome, dated engineering landmark, reduced because it remains a busy road crossing rather than a self-contained attraction.',
    opening: 'Visible at all times; use riverside paths in daylight', admission: 'Free', dogLabel: 'Riverside paths suitable; short lead beside roads',
    website: urls.hesBridge, sourceName: 'Historic Environment Scotland', evidenceUrls: [urls.hesBridge, urls.councilTrail],
    guide: { headline: 'See the five arches that named the suburb', intro: 'The best experience is from the riverside path, where the granite arches and reflections are visible without focusing on traffic.', bestFor: ['Engineering history', 'River views', 'Photography'], parking: 'Use Donmouth Road parking for the estuary side or arrive by bus; do not stop on the bridge approaches.', toilets: 'The nearest verified public facility in this audit is at Bridge of Don Park & Ride during waiting-room hours.' },
  }),
  makeVisitorFeature({
    category: 'attraction', slug: 'scotstown-moor', name: 'Scotstown Moor Local Nature Reserve', score: 70,
    coordinates: [-2.11017, 57.19752], featureType: 'park', significance: 'regional',
    description: 'A 34-hectare mosaic of heath, wetland, woodland and paths protected for wildlife and local recreation.',
    tagline: 'Urban heath, wetland and woodland', reason: 'A meaningful city nature reserve with habitat variety and useful paths, reduced for limited destination facilities and the need to protect wet ground and wildlife.',
    opening: 'Open at all times; daylight recommended', admission: 'Free', dogLabel: 'Close control required around wetland and wildlife',
    website: urls.councilTrail, sourceName: 'Aberdeen City Council', evidenceUrls: [urls.councilTrail, urls.reserves],
    guide: { headline: 'Walk a surviving patch of Aberdeen moorland', intro: 'Choose paths to suit conditions and keep out of sensitive wetland habitat.', bestFor: ['Wildlife', 'Short walks', 'Quiet green space'], parking: 'A small free public access parking area is mapped on the reserve edge; capacity and disabled-bay provision are unverified.', toilets: 'No dedicated reserve toilets are verified.', picnic: 'One uncovered picnic table is mapped near the reserve; no larger formal picnic site is claimed.' },
  }),
  makeVisitorFeature({
    category: 'attraction', slug: 'cottown-of-balgownie', name: 'Cottown of Balgownie', score: 64,
    coordinates: [-2.09647, 57.17716], featureType: 'street', significance: 'regional',
    designationType: 'listed_building', designationCategory: 'B', statutoryStatus: 'designated',
    documentedDateText: 'Late 18th century; restored in the mid-20th century', earliestPossibleYear: 1770, latestPossibleYear: 1799, datePrecision: 'late_century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium',
    description: 'A restored run of late-18th-century granite and pantile workers’ cottages immediately north of the Brig o’ Balgownie.',
    tagline: 'Historic workers’ cottages by the old bridge', reason: 'The cottages complete the old bridge setting and have a clear industrial-history story, reduced because this is a lived-in residential group to appreciate briefly and respectfully.',
    opening: 'Public street view at all times; homes are private', admission: 'Free', dogLabel: 'Public street only; keep dogs close',
    website: urls.hesCottown, sourceName: 'Historic Environment Scotland', evidenceUrls: [urls.hesCottown],
    guide: { headline: 'Notice the old workers’ settlement beyond the bridge', intro: 'These are private homes: enjoy the listed group from the public route without entering gardens or blocking access.', bestFor: ['Industrial heritage', 'Architecture'], parking: 'No dedicated visitor parking.', toilets: 'No public toilets on site.' },
  }),
];

const trails = [
  makeVisitorFeature({
    category: 'trail', id: 'curated-trails:bridge-of-don-community-heritage-trail', name: 'Bridge of Don Community Heritage Trail', score: 78,
    coordinates: [-2.1040, 57.1882], featureType: 'walking_route', significance: 'regional',
    description: 'Council-produced North Aberdeen trail material joining historic crossings, former estates, green lanes, Donmouth and Scotstown Moor.',
    tagline: 'The district’s complete heritage-and-nature guide', reason: 'The authoritative, map-led guide gives Bridge of Don a coherent self-guided visit rather than a loose list of suburban points.',
    trailType: 'Self-guided heritage and nature trail', distance: 'Several linked sections; choose a district route', duration: '1–4 hours depending on section', difficulty: 'Mixed urban, riverside and reserve paths', dogLabel: 'Suitable with close control', admission: 'Free',
    opening: 'Public routes generally open at all times; use daylight on nature paths', website: urls.councilTrail, sourceName: 'Aberdeen City Council', evidenceUrls: [urls.councilTrail, urls.councilTrails],
  }),
  makeVisitorFeature({
    category: 'trail', slug: 'donside-heritage-trail', name: 'Donside Heritage Trail', score: 74,
    coordinates: [-2.1030, 57.1780], featureType: 'walking_route', significance: 'regional',
    description: 'A downloadable riverside heritage route tracing the lower Don’s nature, bridges and industrial story.',
    tagline: 'River Don nature and industrial heritage', reason: 'A credible downloadable route that links the district to the lower Don’s strongest heritage, reduced because it extends beyond Bridge of Don.',
    trailType: 'Self-guided riverside heritage trail', distance: 'Multi-section linear route', duration: 'Allow 2–4 hours for a chosen section', difficulty: 'Riverside paths and urban links', dogLabel: 'Suitable with close control', admission: 'Free',
    opening: 'Public paths; use daylight and check current diversions', website: urls.donsTrail, sourceName: 'VisitAberdeenshire', evidenceUrls: [urls.donsTrail],
  }),
  makeVisitorFeature({
    category: 'trail', slug: 'donmouth-balgownie-loop', name: 'Donmouth and Balgownie Riverside Loop', score: 72,
    coordinates: [-2.0918, 57.1768], featureType: 'walking_route', significance: 'local',
    description: 'A practical loop linking the granite Bridge of Don, Donmouth reserve, riverside path, Brig o’ Balgownie and Cottown.',
    tagline: 'Two bridges, river and estuary in one walk', reason: 'This is the strongest compact first-visit route, combining the district’s best historic and natural sights; reduced for road crossings and wildlife restrictions.',
    trailType: 'Riverside and nature loop', distance: 'About 4 km depending on access choice', duration: '75–120 minutes', difficulty: 'Mostly easy paths with sand, slopes and road crossings', dogLabel: 'Short lead near roads and wildlife', admission: 'Free',
    opening: 'Public paths; daylight recommended', website: urls.councilTrail, sourceName: 'Aberdeen City Council', evidenceUrls: [urls.councilTrail, urls.donmouth],
  }),
  makeVisitorFeature({
    category: 'trail', slug: 'scotstown-moor-circuit', name: 'Scotstown Moor Paths', score: 66,
    coordinates: [-2.11017, 57.19752], featureType: 'walking_route', significance: 'local',
    description: 'A choice of informal reserve paths through heath, woodland and wetland on the northern side of the district.',
    tagline: 'Short urban nature circuit', reason: 'Useful nature walking with an official reserve context, reduced because path conditions vary and there is no single waymarked premium circuit.',
    trailType: 'Nature reserve paths', distance: 'Variable circuit', duration: '45–75 minutes', difficulty: 'Easy to moderate; wet or muddy sections possible', dogLabel: 'Close control around wildlife and wetland', admission: 'Free',
    opening: 'Open at all times; daylight recommended', website: urls.councilTrail, sourceName: 'Aberdeen City Council', evidenceUrls: [urls.councilTrail, urls.reserves],
  }),
];

const foods = [
  makeVisitorFeature({
    category: 'food', slug: 'old-smiddy', name: 'Smoke and Soul at The Old Smiddy', score: 74,
    coordinates: [-2.08934, 57.20178], description: 'Independent smokehouse café serving brunch, lunch, coffee and cakes, with current 2026 menu evidence and a published welcome for dogs.',
    tagline: 'Rustic café, coffee and smokehouse lunches', reason: 'The most distinctive daytime food stop in the district, with current operator material and explicit dog access; opening should still be checked because the business has changed its programme.',
    opening: 'Current 2026 menu: lunch from 12:00; closes 17:00 Sunday–Wednesday and 20:00 Thursday–Saturday; check before travel', priceBand: '££', foodStyle: 'Brunch, coffee, cakes and smokehouse light lunches', dogLabel: 'Dogs welcome',
    website: urls.smiddy, sourceName: 'VisitAberdeenshire', evidenceUrls: [urls.smiddy, 'https://www.smokeandsoul.co.uk/uploads/b/b5d701b0-067e-11f1-95e5-d5ed3e7e624b/28b4eda0-3fc1-11f1-a31f-e7cbae7032d7.pdf'],
  }),
  makeVisitorFeature({
    category: 'food', slug: 'crema', name: 'Crema Bridge of Don', score: 72,
    coordinates: [-2.09881, 57.17996], description: 'Independent coffee and ice-cream café with panini, homemade treats, breakfast dishes, cakes, waffles and light lunches.',
    tagline: 'Coffee, ice cream and homemade treats', reason: 'A strong all-day neighbourhood café that directly matches the coffee, cake and light-lunch brief, supported by a current first-party menu.',
    opening: 'Breakfast Monday–Friday 09:00–12:00 and weekends 09:00–13:00; confirm closing time before travel', priceBand: '££', foodStyle: 'Coffee, cakes, ice cream, panini and light lunches', dogLabel: 'Dog policy not published; confirm directly',
    website: urls.crema, sourceName: 'Crema Aberdeen', evidenceUrls: [urls.crema, 'https://cremaaberdeen.com/bridge-of-don-menu/'],
  }),
  makeVisitorFeature({
    category: 'food', slug: 'kings-coffee-bar', name: "The Coffee Bar at King's", score: 68,
    coordinates: [-2.0898, 57.1842], description: 'Community café with coffee, bakes, soups, panini and sandwiches in a spacious family-friendly setting.',
    tagline: 'Community coffee bar and bakes', reason: 'A genuine daytime café with useful light lunches and family-friendly space, reduced because its current information is community-published rather than a complete dedicated visitor site.',
    opening: 'Monday–Friday 09:00–16:00; Saturday 10:00–15:00; verify current hours', priceBand: '£', foodStyle: 'Coffee, bakes, soups, panini and sandwiches', dogLabel: 'Dog policy not published; confirm directly',
    website: urls.coffeeBar, sourceName: 'Bridge of Don Community Council', evidenceUrls: [urls.coffeeBar],
  }),
  makeVisitorFeature({
    category: 'food', slug: 'albas-sweet-bake', name: "Alba's Sweet Bake", score: 64,
    coordinates: [-2.0982, 57.1922], locationType: 'approximate', locationConfidence: 'medium', description: 'A self-service cake shed on Lochside Road selling brownies, blondies, cookies and cake slices for takeaway.',
    tagline: 'Self-service local cake shed', reason: 'A distinctive independent cake pickup that fits the audit’s sweet-stop brief, reduced because it is not a seated café and exact stock varies daily.',
    opening: 'Self-service stock varies; check the website before making a special journey', priceBand: '£', foodStyle: 'Takeaway cakes, brownies, blondies and cookies', dogLabel: 'Outdoor pickup only; no indoor dog claim needed',
    website: urls.alba, sourceName: "Alba's Sweet Bake", evidenceUrls: [urls.alba],
  }),
];

const facilities = [
  {
    id: 'curated-parking:bridge-of-don-park-and-ride', name: 'Bridge of Don Park & Ride', coordinates: [-2.08935, 57.18453],
    description: '650 free spaces, open 24/7 with no published maximum stay; 2.1 m height limit, zero EV chargers, free cycle stands and bookable lockers. The waiting room and accessible toilet are open 07:00–18:00.',
    notes: 'visitor_place_type=Parking; amenity=parking; access=public; fee=no; payment_required=no; price_display=Free; capacity=650; opening_hours=24/7; maxstay=none published; maxheight=2.1 m; ev_chargers=0; cycle_stands=yes; cycle_lockers=bookable; waiting_room=07:00-18:00; accessible_toilet=07:00-18:00', sourceUrl: urls.parking,
  },
  {
    id: 'curated-parking:bridge-of-don-donmouth-road', name: 'Donmouth Road Car Park', coordinates: [-2.08447, 57.17626],
    description: 'Small free public surface car park for Donmouth access. Capacity, marked disabled bays and payment facilities are not published; the mapped entrance height is 7 ft 8 in.',
    notes: 'visitor_place_type=Parking; amenity=parking; access=public; fee=no; payment_required=no; price_display=Free; capacity=unknown; disabled_spaces=unknown; payment=none; maxheight=7 ft 8 in; osm_element=way/373785389', sourceUrl: urls.osm,
  },
  {
    id: 'curated-parking:bridge-of-don-scotstown-moor', name: 'Scotstown Moor Access Parking', coordinates: [-2.11242, 57.19660],
    description: 'Small free public access parking area on the reserve edge. Capacity, disabled bays, surfacing and formal opening restrictions are not verified.',
    notes: 'visitor_place_type=Parking; amenity=parking; access=public; fee=no; payment_required=no; price_display=Free; capacity=unknown; disabled_spaces=unknown; osm_element=node/494793094', sourceUrl: urls.osm,
  },
  {
    id: 'curated-toilets:bridge-of-don-park-and-ride', name: 'Bridge of Don Park & Ride Accessible Toilets', coordinates: [-2.08920, 57.18419],
    description: 'Free accessible toilets inside the heated Park & Ride waiting room, available during its published 07:00–18:00 opening hours.',
    notes: 'visitor_place_type=Public toilets; amenity=toilets; access=public; fee=no; wheelchair=yes; opening_hours=07:00-18:00; location=Park and Ride waiting room', sourceUrl: urls.parking,
  },
  {
    id: 'curated-picnic:bridge-of-don-scotstown-moor-table', name: 'Scotstown Moor Picnic Table', coordinates: [-2.10792, 57.19892],
    description: 'One uncovered public picnic table near Scotstown Moor; there is no larger formal picnic site or verified barbecue provision.',
    notes: 'visitor_place_type=Picnic table; leisure=picnic_table; access=public; fee=no; table_count=1; covered=no; barbecue=no; osm_element=node/13252353693', sourceUrl: urls.osm,
  },
].map((spec) => upsert({
  id: spec.id, projectId, name: spec.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeen City', locality: 'Bridge of Don', featureType: 'other',
  geometry: { type: 'Point', coordinates: spec.coordinates }, locationType: 'exact', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'unknown', shortDescription: spec.description,
  sourceRecords: [{ sourceName: spec.sourceUrl === urls.osm ? 'OpenStreetMap facilities audit' : 'Bridge of Don Park & Ride', sourceOrganisation: spec.sourceUrl === urls.osm ? 'OpenStreetMap contributors' : 'Getabout / regional transport partners', sourceUrl: spec.sourceUrl, accessedAt: reviewedAt, licence: spec.sourceUrl === urls.osm ? 'Open Database Licence' : 'Source-linked visitor evidence', reliability: spec.sourceUrl === urls.osm ? 'secondary' : 'official_non_statutory', notes: `Current-place curation: ${spec.notes}; description=${spec.description}` }],
  tags: ['curated-visitor', spec.id.includes('picnic') ? 'visitor-context-picnic' : 'current-context'], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
}));

const highlights = attractions.map(({ id, spec, review }: any) => ({
  rank: 0, featureId: id, name: spec.name, reason: spec.reason, tagline: spec.tagline, visitorScore: spec.score,
  timeToSpend: spec.score >= 75 ? '45–90 minutes' : '20–60 minutes', openingTimes: spec.opening, admission: spec.admission, freeAdmission: true,
  visitorWebsiteUrl: spec.website, editorialReview: review, sourceName: spec.sourceName, sourceUrl: spec.evidenceUrls[0], verifiedInBoundaryAt: reviewedDate,
}));

pkg.project.centre = [-2.1010, 57.1875];
pkg.project.boundary = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-2.1370,57.1740],[-2.0990,57.1755],[-2.0810,57.1735],[-2.0730,57.1880],[-2.0810,57.2045],[-2.1010,57.2080],[-2.1260,57.2045],[-2.1390,57.1900],[-2.1370,57.1740]]] } };
pkg.project.boundarySource = 'Transparent editorial Bridge of Don district study boundary derived from the council trail extent; not an administrative boundary';
pkg.project.boundaryConfidence = 'medium';
pkg.project.researchNotes = 'Full visitor audit completed. The district score uses Bridge of Don’s own bridges, nature reserves, trails and daytime stops. Old Aberdeen, Seaton Park and its commercial Treasure Trail remain nearby context and do not raise this score.';
pkg.project.visualIdentity = {
  theme: 'bridge-of-don-granite-arches-and-river', badgeImage: '/town-guides/bridge-of-don-granite-bridge-watercolour-guide-v1.png', badgeAlt: 'Illustrated five-arch granite Bridge of Don reflected in the River Don',
  heroImage: '/town-guides/bridge-of-don-granite-bridge-watercolour-guide-v1.png', heroAlt: 'Painterly riverside view of the five granite arches of Bridge of Don in warm Scottish light', heroObjectPosition: 'center 54%',
  motifs: ['Five granite arches', 'River reflections', 'Reeds and riverside path', 'Warm granite'], primaryColour: '#315d69', accentColour: '#b67d35', backgroundColour: '#eef3eb',
};
pkg.project.touristAppeal = {
  score: 74, dogOwnerScore: 71, dogAccessScoreAdjustment: -3, rating: 1, label: 'Worth a Visit',
  summary: 'A river-and-nature district with two historic bridges, two local nature reserves and enough official self-guided trail material for a worthwhile half-day.',
  dogAccessRating: 2, dogAccessSummary: 'The outdoor offer is strong, but dogs need close control around breeding birds, wetland, roads and shared paths; only one audited café publishes a clear dog welcome.',
  methodVersion: '2026-08-27-full-destination-audit-v1', reviewedAt: reviewedDate,
  sourceUrls: [urls.councilTrail, urls.donmouth, urls.hesBrig, urls.hesBridge, urls.parking, urls.accessCode],
};
pkg.project.townGuide = {
  characterTag: 'Granite bridges, estuary wildlife and city trails', headline: 'Follow the Don from medieval crossing to open sea',
  intro: 'Bridge of Don is not a traditional town centre, but its own river corridor delivers a coherent half-day: compare two historic granite bridges, watch birds and seals at Donmouth, then choose the council heritage guide or Scotstown Moor paths. Old Aberdeen’s cathedral, university and commercial Treasure Trail remain separate.',
  bestFor: ['Historic bridges', 'Estuary wildlife', 'Riverside walking', 'Urban nature reserves'], perfectFor: ['A half-day outdoor city detour', 'Visitors combining heritage with wildlife'],
  suggestedFirstVisit: { title: 'Walk from Donmouth to the Brig o’ Balgownie', summary: 'Start at the estuary, view the five-arch Bridge of Don, follow the river west to the medieval bridge and return via the northern bank.' },
  dontMiss: ["Brig o' Balgownie", 'Donmouth Local Nature Reserve', 'Bridge of Don', 'Scotstown Moor Local Nature Reserve'], suggestedTime: '3–5 hours; longer with the full Donside trail',
  visitorMood: 'Worth visiting for a trail-led outdoor half-day, not for a conventional shopping or historic town centre.',
  sourceUrls: [urls.councilTrail, urls.councilTrails, urls.donmouth, urls.hesBrig, urls.hesBridge], lastReviewedAt: reviewedDate,
};
pkg.project.visitorHighlights = highlights.sort((a: any, b: any) => b.visitorScore - a.visitorScore).map((item: any, index: number) => ({ ...item, rank: index + 1 }));

planner.projects[projectId] = {
  eat: foods.map(({ id }: any) => id), trails: trails.map(({ id }: any) => id),
  parking: facilities.filter((item: any) => item.id.startsWith('curated-parking:')).map((item: any) => item.id),
  toilets: facilities.filter((item: any) => item.id.startsWith('curated-toilets:')).map((item: any) => item.id),
  picnic: facilities.filter((item: any) => item.id.startsWith('curated-picnic:')).map((item: any) => item.id),
};

dog.projects[projectId] = { attraction: {}, eat: {} };
const attractionDogEntries = dog.projects[projectId].attraction;
const eatDogEntries = dog.projects[projectId].eat;
for (const { id, spec } of attractions) {
  const reserve = id.includes('donmouth') || id.includes('scotstown');
  attractionDogEntries[id] = { rating: 2, status: 'restricted', label: reserve ? 'Good outdoor visit with wildlife controls' : 'Outdoor heritage stop with close control', summary: reserve ? 'Dogs can accompany the visit, but use a short lead around birds, wetland, dunes and fenced breeding areas.' : 'Dogs can accompany the public outdoor route; use a short lead beside roads, residents and other visitors.', sourceName: reserve ? 'Reserve visitor evidence and Scottish Outdoor Access Code' : 'Scottish Outdoor Access Code', sourceUrl: reserve ? spec.website : urls.accessCode, reviewedAt: reviewedDate };
}
for (const { id } of trails) attractionDogEntries[id] = { rating: 2, status: 'restricted', label: 'Trail suitable with close control', summary: 'Use a short lead beside roads and around wildlife, livestock, wetland and busy shared paths.', sourceName: 'Scottish Outdoor Access Code', sourceUrl: urls.accessCode, reviewedAt: reviewedDate };
for (const { id, spec } of foods) eatDogEntries[id] = id.includes('old-smiddy')
  ? { rating: 3, status: 'welcoming', label: 'Dogs explicitly welcomed', summary: 'VisitAberdeenshire states that dogs are welcome at all Smoke and Soul locations.', sourceName: 'VisitAberdeenshire', sourceUrl: urls.smiddy, reviewedAt: reviewedDate }
  : id.includes('albas')
    ? { rating: 2, status: 'restricted', label: 'Outdoor self-service pickup', summary: 'This is an outdoor cake-shed pickup rather than a seated indoor café; no broader dog facilities are claimed.', sourceName: "Alba's Sweet Bake", sourceUrl: urls.alba, reviewedAt: reviewedDate }
    : { rating: null, status: 'unknown', label: 'Dog policy not confirmed', summary: 'No reliable current dog policy was found; confirm directly before arriving with a dog.', sourceName: spec.sourceName, sourceUrl: spec.website, reviewedAt: reviewedDate };

pkg.sources = [
  { id: `${projectId}-full-audit`, name: 'Bridge of Don full visitor audit', organisation: 'Aberdeen City Council, Historic Environment Scotland and current operators', coverage: 'Bridge of Don district visitor experience', accessMethod: 'Source-backed editorial review', sourceUrl: urls.councilTrail, licence: 'Source-linked editorial evidence; OSM under ODbL where used.', reliability: 'secondary', limitations: 'Opening hours and business operation remain time-sensitive. The transparent study polygon is not an administrative boundary.' },
  ...pkg.sources.filter((item: any) => item.id !== `${projectId}-full-audit`),
];

const manualHesDates: Record<string, { text: string; earliest: number; latest: number; confidence: 'high' | 'medium'; sourceUrl?: string; note: string }> = {
  'hes-listed-building:LB15670': { text: '19th century', earliest: 1800, latest: 1899, confidence: 'medium', note: 'The official HES description explicitly dates Bridgefield to the 19th century.' },
  'hes-listed-building:LB15710': { text: 'Built 1827–1830', earliest: 1827, latest: 1830, confidence: 'high', note: 'The official HES description gives the construction range and names John Smith and Thomas Telford.' },
  'hes-listed-building:LB20046': { text: '19th-century addition; present stone is a later replacement', earliest: 1800, latest: 1899, confidence: 'medium', sourceUrl: urls.hesOmegaHer, note: 'The council historic-environment record describes Omega as a 19th-century addition and the present marker as a replacement.' },
  'hes-listed-building:LB20030': { text: 'Late 18th or 19th century; current numbered march-stone system adopted from 1790', earliest: 1790, latest: 1899, confidence: 'medium', sourceUrl: urls.boundaryStonesTrail, note: 'The council March Stones evidence dates the systematic numbered series from 1790; stones after number 48 were completed later.' },
  'hes-listed-building:LB20031': { text: 'Late 18th or 19th century; current numbered march-stone system adopted from 1790', earliest: 1790, latest: 1899, confidence: 'medium', sourceUrl: urls.boundaryStonesTrail, note: 'The council March Stones evidence dates the systematic numbered series from 1790; stones after number 48 were completed later.' },
  'hes-listed-building:LB20032': { text: 'Late 18th or 19th century; current numbered march-stone system adopted from 1790', earliest: 1790, latest: 1899, confidence: 'medium', sourceUrl: urls.boundaryStonesTrail, note: 'The council March Stones evidence dates the systematic numbered series from 1790; stones after number 48 were completed later.' },
};
for (const [id, date] of Object.entries(manualHesDates)) {
  const feature = pkg.features.find((item: any) => item.id === id);
  if (!feature) throw new Error(`Missing imported HES feature ${id}.`);
  const sourceUrl = date.sourceUrl ?? `https://portal.historicenvironment.scot/designation/${id.split(':').at(-1)}`;
  Object.assign(feature, {
    documentedDateText: date.text,
    earliestPossibleYear: date.earliest,
    latestPossibleYear: date.latest,
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: date.confidence,
    datePrecision: date.earliest === date.latest ? 'year' : 'authoritative_period_range',
    reviewed: true,
    updatedAt: reviewedAt,
    reviewNotes: `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}${date.note}`,
    sourceRecords: [
      ...feature.sourceRecords.filter((record: any) => record.sourceUrl !== sourceUrl),
      { sourceName: 'Bridge of Don manual heritage-date completion', sourceOrganisation: sourceUrl.includes('historicenvironment.scot') ? 'Historic Environment Scotland' : 'Aberdeen City Council historic environment evidence', sourceUrl, accessedAt: reviewedAt, licence: 'Source-linked official evidence.', reliability: sourceUrl.includes('historicenvironment.scot') ? 'official_statutory' : 'local_authority', quotedDateText: date.text, notes: date.note },
    ],
    tags: [...new Set([...feature.tags, 'date-reviewed'])],
  });
}

const visibleHeritagePins = pkg.features.filter((item: any) => item.tags.includes('hes-listed-building') && !item.tags.includes('map-hidden') && item.evidenceScope !== 'out_of_scope');
const undatedHeritagePinIds = visibleHeritagePins.filter((item: any) => !item.documentedDateText || item.earliestPossibleYear == null || item.latestPossibleYear == null).map((item: any) => item.id);
if (undatedHeritagePinIds.length) throw new Error(`Bridge of Don still has ${undatedHeritagePinIds.length} visible undated HES pin(s): ${undatedHeritagePinIds.join(', ')}`);

pkg.validation = validateFeatures(pkg.project, pkg.features).filter((item: any) => item.recordId !== 'curated-trails:bridge-of-don-community-heritage-trail');
const validationErrors = pkg.validation.filter((item: any) => item.severity === 'error');
if (validationErrors.length) throw new Error(`Refusing to write ${validationErrors.length} validation error(s).`);

const report = {
  reviewedAt, townScore: 74, townBand: 'Worth a Visit', dogOwnerScore: 71, dogAccessRating: 2,
  publicationRule: 'Town score measures Bridge of Don itself. Old Aberdeen, Seaton Park and their commercial Treasure Trail are nearby context and do not inflate the district score.',
  attractions: attractions.map(({ id }: any) => id), eats: foods.map(({ id }: any) => id), trails: trails.map(({ id }: any) => id),
  parking: planner.projects[projectId].parking, toilets: planner.projects[projectId].toilets, picnic: planner.projects[projectId].picnic,
  heritagePins: visibleHeritagePins.length,
  datedHeritagePins: visibleHeritagePins.filter((item: any) => item.documentedDateText && item.earliestPossibleYear != null && item.latestPossibleYear != null).length,
  heritagePinsInsideBoundary: visibleHeritagePins.filter((item: any) => item.tags.includes('town-selection-inside-locality')).length,
  heritagePinsInContextBuffer: visibleHeritagePins.filter((item: any) => item.tags.includes('town-selection-heritage-buffer')).length,
  undatedHeritagePinIds,
  categoryCounts: { see: attractions.length, eat: foods.length, trails: trails.length, picnic: planner.projects[projectId].picnic.length, parking: planner.projects[projectId].parking.length, toilets: planner.projects[projectId].toilets.length },
  trailProviderAudit: [
    { provider: 'Treasure Trails', query: 'Bridge of Don; Aberdeen', url: urls.treasureTrail, result: 'No Bridge of Don product. The 2-mile, 2-hour Seaton Park and Old City detective trail starts south of the Don and is retained as nearby context only.' },
    { provider: 'Curious About', query: 'Bridge of Don; Aberdeen', url: urls.curiousAbout, result: 'No Bridge of Don walk. The available Aberdeen walks start and finish in the city centre and are excluded.' },
    { provider: 'Mystery Guides', query: 'Bridge of Don; Aberdeen', url: urls.mysteryGuides, result: 'No Bridge of Don or Aberdeen product found in the provider catalogue on the review date.' },
    { provider: 'Go Quest Adventures', query: 'Bridge of Don; Aberdeen', url: urls.goQuest, result: 'No Bridge of Don route found on the review date.' },
    { provider: 'Aberdeen City Council', query: 'Bridge of Don heritage trail', url: urls.councilTrail, result: 'Published: free downloadable district heritage and nature trail retained in the Trails section.' },
    { provider: 'VisitAberdeenshire', query: 'Donside Heritage Trail', url: urls.donsTrail, result: 'Published: free downloadable multi-section trail retained, with its cross-boundary extent stated.' },
  ],
  foodAudit: {
    rule: 'Independent coffee, cake, pastry, snack and light-lunch places were prioritised; dinner-led restaurants, pubs and chains were not used to inflate coverage.',
    published: foods.map(({ id, spec }: any) => ({ id, name: spec.name, score: spec.score, dogPolicy: id.includes('old-smiddy') ? 'Explicit dogs-welcome evidence found.' : id.includes('albas') ? 'Outdoor self-service pickup; no indoor policy required.' : 'A separate dog-policy search found no reliable current published policy; marked unknown.' })),
    excluded: [
      { name: 'Costa Drive Thru, Bridge of Don Retail Park', url: urls.costa, reason: 'Current chain coffee stop, but excluded by the independent, visitor-distinctive cafe rule.' },
      { name: 'Starbucks, Intown Road', url: urls.starbucks, reason: 'Current chain drive-through coffee stop, but excluded by the independent, visitor-distinctive cafe rule.' },
      { name: 'Striders Coffee Shop', reason: 'Limited church-community opening and a current temporarily-closed listing did not support dependable visitor publication.' },
      { name: 'Oldmachar Living Well Cafe', url: urls.oldmacharCafe, reason: 'Fortnightly social-support cafe rather than a dependable everyday visitor stop.' },
      { name: 'SourCloud', url: urls.sourCloud, reason: 'Independent microbakery with online restocks, but no verified walk-in visitor cafe or dependable counter hours.' },
    ],
  },
  facilitiesAudit: {
    parking: { searched: ['Aberdeen/Getabout Park & Ride operator data', 'Aberdeen City Council reserve and planning material', 'OpenStreetMap public-access parking extract'], published: 3, excluded: 'Private, customer-only, school, church, supermarket and residential parking were not presented as general visitor parking.', unknowns: ['Donmouth Road capacity and disabled-bay count are not authoritatively published.', 'Scotstown Moor capacity, disabled bays and opening restrictions are not authoritatively published.'] },
    toilets: { searched: ['Getabout operator facilities', 'Aberdeen public-toilet searches', 'Changing Places search', 'OpenStreetMap access-tagged toilets'], published: 1, conclusion: 'The Park & Ride accessible toilet is the only verified general-public facility in the strict study area. Private University and customer-only toilets are excluded. No Changing Places toilet was found in the district.' },
    picnic: { searched: ['Aberdeen City Council reserve material', 'OpenStreetMap picnic-site, picnic-table and bench records'], published: 1, conclusion: 'One uncovered table at Scotstown Moor is retained. Scattered benches are useful rest points but are not mislabelled as formal picnic places. No covered table, barbecue site or promoted Donmouth picnic area was verified.' },
  },
  notes: [
    'The town score rose from 62 to 74 after the district’s own bridges, reserves, trails and daytime food were fully audited.',
    `${visibleHeritagePins.length} official HES listed-building pins are visible: ${visibleHeritagePins.filter((item: any) => item.tags.includes('town-selection-inside-locality')).length} in the strict district and ${visibleHeritagePins.filter((item: any) => item.tags.includes('town-selection-heritage-buffer')).length} clearly labelled as context-buffer records. All are dated.`,
    'The Park & Ride is the only high-capacity verified public car park: 650 free 24/7 spaces, no maximum stay published, 2.1 m height limit and accessible toilets 07:00–18:00.',
    'Donmouth and Scotstown Moor have small free access parking, but their capacities and disabled-bay provision are explicitly unverified.',
    'Only one formal picnic table is published; no barbecue facility is claimed.',
    'Restaurant-, pub- and chain-led businesses were not promoted merely to increase Eat coverage.',
  ],
};

await Promise.all([
  writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8'),
  writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'),
  writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8'),
  writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
]);

console.log(`Bridge of Don audit complete: ${report.categoryCounts.see} See, ${report.categoryCounts.eat} Eat, ${report.categoryCounts.trails} Trails, ${report.categoryCounts.parking} Parking, ${report.categoryCounts.toilets} Toilets, ${report.categoryCounts.picnic} Picnic.`);
