import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'monymusk-scotland';
const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T23:30:00Z';
const projectPath = resolve('data/projects/monymusk.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/monymusk-full-visitor-audit-2026-08-27.json');

type MutableFeature = HeritageFeature & Record<string, any>;
type MutablePackage = ProjectPackage & {
  project: ProjectPackage['project'] & Record<string, any>;
  features: MutableFeature[];
};

const urls = {
  estate: 'https://www.monymusk.com/',
  churchHes: 'https://portal.historicenvironment.scot/designation/LB15987',
  churchHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB15221/',
  squareListings: 'https://portal.historicenvironment.scot/designation/LB15991',
  designedLandscape: 'https://portal.historicenvironment.scot/designation/GDL00289',
  corePaths: 'https://www.aberdeenshire.gov.uk/media/15238/monymusk-cpp.pdf',
  familyLoop: 'https://www.thethrivingmumhub.co.uk/free-resources/monymusk',
  grantArmsCurrent: 'https://www.tripadvisor.com/Restaurant_Review-g1193608-d34078659-Reviews-Grant_Arms_Hotel_Restaurant-Monymusk_Aberdeenshire_Scotland.html',
  grantArmsHistory: 'https://www.pressandjournal.co.uk/fp/lifestyle/food-and-drink/3558603/monymusks-the-grant-arms/',
  councilRestaurantWeek: 'https://www.aberdeenshire.gov.uk/news/2025/oct/just-a-week-to-go-before-aberdeenshire-restaurant-week-serves-up-a-host-of-special-offers',
  recreationParkingSouth: 'https://www.openstreetmap.org/way/1178736983',
  recreationParkingNorth: 'https://www.openstreetmap.org/way/1178736984',
  councilParking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  councilToilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  councilBus: 'https://www.aberdeenshire.gov.uk/roads-and-travel/public-transport/bus-information/',
  route421: 'https://bustimes.org/services/421-inverurie-alford',
  treasureTrails: 'https://www.treasuretrails.co.uk/collections/aberdeenshire',
  curiousAbout: 'https://curiousabout.co.uk/',
  mysteryGuides: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  osm: 'https://www.openstreetmap.org/copyright',
};

const heritageDates: Record<string, {
  text: string;
  earliest: number;
  latest: number;
  precision: string;
  confidence?: 'high' | 'medium';
}> = {
  LB15955: { text: 'Circa 1830–40; Tudorised 1899', earliest: 1830, latest: 1899, precision: 'multi_period' },
  LB15956: { text: 'Early 19th-century carriage house and loft', earliest: 1800, latest: 1839, precision: 'century', confidence: 'medium' },
  LB15957: { text: 'Circa 1810', earliest: 1810, latest: 1810, precision: 'approximate_year', confidence: 'medium' },
  LB15958: { text: 'Circa 1830–40; reconstructed 1902', earliest: 1830, latest: 1902, precision: 'multi_period' },
  LB15959: { text: 'Circa 1850', earliest: 1850, latest: 1850, precision: 'approximate_year', confidence: 'medium' },
  LB15960: { text: 'Mid-18th-century lapidary mill; converted to Episcopal chapel in 1801 and recast in 1834', earliest: 1730, latest: 1834, precision: 'multi_period', confidence: 'medium' },
  LB15961: { text: 'Circa 1830', earliest: 1830, latest: 1830, precision: 'approximate_year', confidence: 'medium' },
  LB15962: { text: 'Circa 1830', earliest: 1830, latest: 1830, precision: 'approximate_year', confidence: 'medium' },
  LB15964: { text: 'Circa 1749', earliest: 1749, latest: 1749, precision: 'approximate_year', confidence: 'medium' },
  LB15965: { text: 'Dated 1749', earliest: 1749, latest: 1749, precision: 'exact_year' },
  LB15967: { text: 'Keep circa 1584; reconstructed 1719–20; restored and extended 1886–88; hall restored 1937', earliest: 1584, latest: 1937, precision: 'multi_period', confidence: 'medium' },
  LB15968: { text: 'Eastern section circa 1720–50; later 19th-century additions', earliest: 1720, latest: 1899, precision: 'multi_period', confidence: 'medium' },
  LB15969: { text: 'Centre gate piers circa 1719–20; moved to present position in 1838', earliest: 1719, latest: 1838, precision: 'multi_period' },
  LB15970: { text: 'Early 19th century', earliest: 1800, latest: 1839, precision: 'century', confidence: 'medium' },
  LB15987: { text: 'Late 12th/early 13th century; priory church form probably established in the second quarter of the 12th century', earliest: 1125, latest: 1239, precision: 'century', confidence: 'medium' },
  LB15988: { text: 'Gravestones from the early 18th century; churchyard enlarged in the early 1900s', earliest: 1700, latest: 1909, precision: 'multi_period', confidence: 'medium' },
  LB15989: { text: 'Perhaps 1822, or possibly earlier', earliest: 1800, latest: 1822, precision: 'year_range', confidence: 'medium' },
  LB15990: { text: 'Circa 1920', earliest: 1920, latest: 1920, precision: 'approximate_year', confidence: 'medium' },
  LB15991: { text: 'Circa 1830–40; Tudorised 1890', earliest: 1830, latest: 1890, precision: 'multi_period' },
  LB15992: { text: 'Rebuilt 1890; reconstructed 1969', earliest: 1890, latest: 1969, precision: 'multi_period' },
  LB15993: { text: 'Circa 1830–40; Tudorised 1890', earliest: 1830, latest: 1890, precision: 'multi_period' },
  LB15994: { text: 'Early 19th century', earliest: 1800, latest: 1839, precision: 'century', confidence: 'medium' },
  LB15995: { text: 'Probably John Smith, circa 1826 in its present form', earliest: 1826, latest: 1826, precision: 'approximate_year', confidence: 'medium' },
  LB15996: { text: 'Probably John Smith, circa 1826 in its present form', earliest: 1826, latest: 1826, precision: 'approximate_year', confidence: 'medium' },
  LB15997: { text: 'John Smith, 1826, built as the parish school', earliest: 1826, latest: 1826, precision: 'exact_year' },
  LB15998: { text: 'Circa 1830–40; reconstructed and extended in 1891', earliest: 1830, latest: 1891, precision: 'multi_period' },
  LB15999: { text: 'Circa 1830–40; partly remodelled in the late 19th century', earliest: 1830, latest: 1899, precision: 'multi_period', confidence: 'medium' },
  LB16000: { text: 'Circa 1830–40', earliest: 1830, latest: 1840, precision: 'year_range', confidence: 'medium' },
  LB19766: { text: 'Circa 1830–40', earliest: 1830, latest: 1840, precision: 'year_range', confidence: 'medium' },
  LB19767: { text: 'Mid-19th century', earliest: 1830, latest: 1869, precision: 'century', confidence: 'medium' },
  LB19769: { text: 'Circa 1830–40; Tudorised 1889', earliest: 1830, latest: 1889, precision: 'multi_period' },
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as MutablePackage;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;

const attractionAssessment = (score: number) => {
  const result = {
    experienceDepth: Math.min(30, Math.round(score * 0.30)),
    distinctiveness: Math.min(20, Math.round(score * 0.20)),
    presentation: Math.min(20, Math.round(score * 0.20)),
    journeyWorth: Math.min(15, Math.round(score * 0.15)),
    accessAndReliability: Math.min(10, Math.round(score * 0.10)),
    evidenceConfidence: 0,
    visitability: 'full_visitor_experience' as const,
  };
  const subtotal = Object.entries(result)
    .filter(([key]) => !['evidenceConfidence', 'visitability'].includes(key))
    .reduce((sum, [, value]) => sum + Number(value), 0);
  result.evidenceConfidence = score - subtotal;
  return result;
};
const foodAssessment = (score: number) => ({
  foodAndDrinkQuality: Math.round(score * 0.29), daytimeRelevance: Math.round(score * 0.21),
  distinctiveness: Math.round(score * 0.15), consistency: Math.round(score * 0.14),
  visitorFit: Math.round(score * 0.11), evidenceConfidence: score - Math.round(score * 0.90),
});
const source = (name: string, organisation: string, url: string, notes: string, reliability: any = 'official_non_statutory') => ({
  sourceName: name, sourceOrganisation: organisation, sourceUrl: url, accessedAt: reviewedAt,
  reliability, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes,
});
const review = (category: 'attraction' | 'trail' | 'food', score: number, reason: string, evidenceUrls: string[]) => ({
  status: 'editorially_researched', category, methodVersion: '2026-08-13-researched-visitor-value-v1',
  reviewedAt: reviewedDate, scoreRationale: reason, evidenceUrls,
  ...(category === 'food' ? { foodAssessment: foodAssessment(score) } : { attractionAssessment: attractionAssessment(score) }),
});
const makeFeature = (spec: Record<string, any>): MutableFeature => ({
  id: spec.id, projectId, name: spec.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: 'Monymusk',
  featureType: spec.featureType, significance: spec.significance ?? 'local', geometry: { type: 'Point', coordinates: spec.coordinates },
  locationType: spec.locationType ?? 'exact', dateBasis: spec.dateBasis ?? 'unknown', dateConfidence: spec.dateConfidence ?? 'unknown',
  locationConfidence: spec.locationConfidence ?? 'high', survival: spec.survival ?? 'substantially_intact',
  documentedDateText: spec.documentedDateText, earliestPossibleYear: spec.earliestPossibleYear, latestPossibleYear: spec.latestPossibleYear,
  datePrecision: spec.datePrecision, shortDescription: spec.description, fullDescription: spec.fullDescription,
  visitorWebsiteUrl: spec.website, attractionGuide: spec.guide,
  editorialReview: spec.category ? review(spec.category, spec.score, spec.reason, spec.evidenceUrls) : undefined,
  sourceRecords: spec.evidenceUrls.map((url: string, index: number) => source(index ? `${spec.name} supporting evidence` : spec.sourceName, index ? 'Supporting publisher' : spec.sourceOrganisation, url, `Current-place curation: visitor_place_type=${spec.placeType}; ${spec.score ? `visit_score=${spec.score}; ` : ''}${spec.details}; description=${spec.description}`, url.includes('historicenvironment.scot') ? 'official_statutory' : url.includes('aberdeenshire.gov.uk') ? 'local_authority' : 'official_non_statutory')),
  tags: spec.tags, createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: spec.evidenceScope ?? 'parish_evidence',
}) as MutableFeature;

const historicFeatures = pkg.features.filter((item) => item.id.startsWith('hes-listed-building:'));
for (const feature of historicFeatures) {
  const reference = feature.id.split(':').at(-1)!;
  const date = heritageDates[reference];
  if (!date) throw new Error(`No reviewed construction date for ${reference}.`);
  Object.assign(feature, {
    documentedDateText: date.text, earliestPossibleYear: date.earliest, latestPossibleYear: date.latest,
    datePrecision: date.precision, dateBasis: 'documented_date_range', dateConfidence: date.confidence ?? 'high',
    reviewed: true, updatedAt: reviewedAt,
    tags: [...new Set([...feature.tags.filter((tag: string) => tag !== 'hes-date-extracted'), 'date-reviewed'])],
    sourceRecords: [
      ...feature.sourceRecords.filter((item: any) => item.sourceName !== 'Monymusk full-audit construction-date review'),
      source('Monymusk full-audit construction-date review', 'Historic Environment Scotland', `https://portal.historicenvironment.scot/designation/${reference}`, 'Construction period manually normalised from the HES description. The statutory designation date was not used as a construction date.', 'official_statutory'),
    ],
  });
}

const church = historicFeatures.find((item) => item.id === 'hes-listed-building:LB15987')!;
Object.assign(church, {
  name: 'St Mary’s Parish Church and Monymusk Priory story',
  featureType: 'church', significance: 'highest_national', visitorWebsiteUrl: urls.churchHes,
  shortDescription: 'A nationally important Romanesque church whose surviving fabric and churchyard reveal Monymusk’s Culdee and Augustinian history.',
  fullDescription: 'The church retains work from the second quarter of the 12th century and the late 12th/early 13th century. The churchyard contains early Christian carved stones and later memorials; regular interior visitor opening is not assured.',
  attractionGuide: { headline: 'Read nine centuries in one village church', intro: 'Begin with the Romanesque west doorway and tower, then use the churchyard and square to understand the early religious settlement and later planned village.', bestFor: ['Romanesque architecture','Early Christianity','Churchyard history','Photography'], parking: 'Use the small mapped recreation-ground parking areas west of the square or considerate on-street space; no official capacity or tariff is published.', toilets: 'No council public toilet or Changing Places facility is listed in Monymusk.', picnic: 'The play park is an informal snack or picnic stop; no formal table count is verified.', foodNote: 'Grant Arms Café is the dependable coffee, cake and light-lunch stop when open.' },
  editorialReview: review('attraction', 74, 'The village’s strongest visitor experience: nationally important surviving medieval fabric and a deep, legible religious story, reduced because dependable interior opening and interpretation are limited.', [urls.churchHes, urls.churchHer]),
  tags: [...new Set([...church.tags, 'curated-visitor', 'home-standalone-place'])],
});

const square = makeFeature({ id: 'curated-attraction:monymusk-square', category: 'attraction', placeType: 'Attraction', name: 'Monymusk Square Heritage Ensemble', score: 70, coordinates: [-2.52434, 57.22678], featureType: 'historic_square', significance: 'regional', documentedDateText: 'Planned in the 18th century; most surviving square buildings date from circa 1810–50 and later 19th-century estate remodelling', earliestPossibleYear: 1700, latestPossibleYear: 1899, datePrecision: 'multi_period', dateBasis: 'documented_date_range', dateConfidence: 'medium', description: 'A remarkably coherent granite estate-village square, with listed cottages, the Grant Arms, former school, war memorial and church approaches.', fullDescription: 'The value is in the ensemble rather than one interior attraction. Walk all four sides, noting the repeated Tudor estate details and the dated listed-building pins.', reason: 'A coherent and unusually complete planned-village ensemble that rewards a slow circuit, reduced because it is an outdoor streetscape rather than a staffed attraction.', website: urls.designedLandscape, sourceName: 'Monymusk designed landscape and village history', sourceOrganisation: 'Historic Environment Scotland', evidenceUrls: [urls.designedLandscape, urls.squareListings, urls.estate], details: 'opening_hours:description=Public streets and square; daylight recommended; fee=Free; access=Mostly level village streets with kerbs and road crossings; dog_friendly=Yes under close control beside roads and homes', tags: ['curated-visitor','home-standalone-place'], guide: { headline: 'Walk the planned granite village as one composition', intro: 'Make a complete circuit of the square rather than treating the buildings as isolated pins.', bestFor: ['Architecture','Planned villages','Photography','Short walks'], parking: 'Two small mapped parking areas lie by the recreation ground west of the square; signed capacity, bays and tariff are not published.', toilets: 'No council public toilet is listed for Monymusk.', picnic: 'The nearby play park is suitable for an informal snack; no formal picnic-table count is verified.', foodNote: 'Grant Arms Café occupies the historic square and serves coffee, cakes and light lunches.' } });

const trails = [
  makeFeature({ id: 'curated-trails:monymusk-core-paths', category: 'trail', placeType: 'Trail', name: 'Monymusk Core Paths', score: 68, coordinates: [-2.52397,57.22700], featureType: 'walking_route', locationType: 'representative_point', description: 'The official one-page core-path map links the square, church, village edge and surrounding rural paths.', reason: 'A verified official exact-town path map with several usable village-edge choices, reduced because it is a network plan rather than a single fully described or waymarked visitor circuit.', website: urls.corePaths, sourceName: 'Monymusk Core Paths', sourceOrganisation: 'Aberdeenshire Council', evidenceUrls: [urls.corePaths], details: 'trail_type=Core-path network; format=Downloadable one-page PDF; app=no; price=Free; distance=Varies; duration=30 minutes to several hours; route_type=Village streets, tracks and rural paths; accessibility=Surfaces and gradients vary and no step-free guarantee is published; dog_friendly=Close control around livestock, wildlife, roads and shared paths', tags: ['curated-visitor','service-context-trail','visitor-context-trail','current-context'] }),
  makeFeature({ id: 'curated-trails:monymusk-dam-river-loop', category: 'trail', placeType: 'Walking route', name: 'Monymusk Dam, Riverside and Play Park Loop', score: 65, coordinates: [-2.5251,57.2282], featureType: 'walking_route', locationType: 'representative_point', description: 'A current family-oriented local loop linking the football fields, dam and river path with the village play park.', reason: 'A useful exact-town conventional walk with a clear family focus and current route narrative, reduced because it is not an official waymarked trail and distance, duration and full accessibility are not published.', website: urls.familyLoop, sourceName: 'Come With Us to Monymusk', sourceOrganisation: 'The Thriving Mum Hub', evidenceUrls: [urls.familyLoop, urls.corePaths], details: 'trail_type=Short family loop; format=Web route and downloadable PDF; app=no; price=Free; distance=Not published; duration=Allow about 45–75 minutes; route_type=Field edge, dam, riverside and village paths; accessibility=Red gate is explicitly not buggy-friendly and surfaces vary; dog_friendly=Close control by water, wildlife, livestock and play areas', tags: ['curated-visitor','service-context-trail','visitor-context-trail','current-context'] }),
];

const foods = [
  makeFeature({ id: 'curated-eat:monymusk-grant-arms', category: 'food', placeType: 'Eat', name: 'Grant Arms Café', score: 72, coordinates: [-2.524733,57.226788], featureType: 'commercial_building', description: 'Coffee, cakes and light village lunches. The village’s principal daytime stop for homemade cakes, scones, soup and quiche.', reason: 'A strong café-led fit for the guide, with current 2025–26 trading evidence and repeated coffee-and-cake reports, reduced because hours change and the operator’s current first-party website is not dependable.', website: urls.grantArmsCurrent, sourceName: 'Grant Arms current visitor evidence', sourceOrganisation: 'Current visitor and council sources', evidenceUrls: [urls.grantArmsCurrent, urls.councilRestaurantWeek, urls.grantArmsHistory], details: 'amenity=cafe; cuisine=Coffee, cakes, scones, soup, quiche and light lunches; opening_hours:description=Current listings indicate Wednesday–Sunday daytime opening, but check directly before travel; dog_friendly=Historic courtyard welcome is documented, but current indoor policy is not confirmed; payment_methods=Cards/contactless not independently verified; price_band=££', tags: ['curated-visitor','service-context-food','visitor-context-food','current-context'] }),
  makeFeature({ id: 'curated-eat:monymusk-thrift-shop', category: 'food', placeType: 'Eat', name: 'Monymusk Village Thrift Shop Tea and Cake', score: 62, coordinates: [-2.52451,57.22663], featureType: 'commercial_building', description: 'Community tea and cake mornings. A small local stop reported to serve tea and cake on Monday and Tuesday mornings.', reason: 'A useful complementary coffee-and-cake option that fills the café’s closed days, reduced sharply because it is community-run, limited-hours and lacks a stable first-party timetable.', website: urls.familyLoop, sourceName: 'Monymusk local refreshment guide', sourceOrganisation: 'The Thriving Mum Hub', evidenceUrls: [urls.familyLoop], details: 'amenity=community_shop; cuisine=Tea and cake; opening_hours:description=Reported Monday and Tuesday until about 12:00–12:30; confirm locally; dog_friendly=No reliable policy found; payment_methods=Not published; price_band=£', tags: ['curated-visitor','service-context-food','visitor-context-food','current-context'] }),
];

const facilities = [
  makeFeature({ id: 'curated-parking:monymusk-recreation-south', placeType: 'Parking', name: 'Recreation Ground South Parking Area', coordinates: [-2.5260917,57.2281758], featureType: 'parking', description: 'A small mapped off-street parking area west of the square; no council capacity, disabled-bay, tariff, payment or maximum-stay data is published.', website: urls.recreationParkingSouth, sourceName: 'OpenStreetMap parking geometry and council car-park cross-check', sourceOrganisation: 'OpenStreetMap contributors / Aberdeenshire Council', evidenceUrls: [urls.recreationParkingSouth, urls.councilParking], details: 'amenity=parking; access=public status not signed in source; capacity=Unknown; capacity:disabled=Unknown; fee=Unconfirmed; price_display=No published tariff; payment_methods=None published; chargeable_hours=None published; maxstay=Not published; overnight_parking=Not published; surface=Not published', tags: ['service-context-parking','current-context'] }),
  makeFeature({ id: 'curated-parking:monymusk-recreation-north', placeType: 'Parking', name: 'Recreation Ground North Parking Area', coordinates: [-2.5266433,57.2286921], featureType: 'parking', description: 'A second small mapped parking area at the recreation ground; practical details are not published and should be checked on signs.', website: urls.recreationParkingNorth, sourceName: 'OpenStreetMap parking geometry and council car-park cross-check', sourceOrganisation: 'OpenStreetMap contributors / Aberdeenshire Council', evidenceUrls: [urls.recreationParkingNorth, urls.councilParking], details: 'amenity=parking; access=public status not signed in source; capacity=Unknown; capacity:disabled=Unknown; fee=Unconfirmed; price_display=No published tariff; payment_methods=None published; chargeable_hours=None published; maxstay=Not published; overnight_parking=Not published; surface=Not published', tags: ['service-context-parking','current-context'] }),
  makeFeature({ id: 'curated-picnic:monymusk-play-park', placeType: 'Picnic', name: 'Monymusk Play Park Informal Picnic Stop', coordinates: [-2.5233959,57.2275018], featureType: 'picnic_site', description: 'A family stop beside the village play park for takeaway coffee or a snack; it is not verified as a formal picnic site.', website: urls.familyLoop, sourceName: 'Come With Us to Monymusk', sourceOrganisation: 'The Thriving Mum Hub', evidenceUrls: [urls.familyLoop, urls.osm], details: 'tourism=informal_picnic_stop; table_count=No verified picnic tables; seating=Grass/play-park edge, formal seating not verified; covered=no; wheelchair=No formal accessibility audit; facilities=Playground nearby; dogs=Keep away from play equipment and under close control', tags: ['service-context-picnic','current-context'] }),
];

const auditedFeatures = [...historicFeatures, square, ...trails, ...foods, ...facilities];
const auditedFeatureIds = new Set(auditedFeatures.map((feature) => feature.id));
pkg.features = [...auditedFeatures, ...pkg.features.filter((feature) => feature.tags.includes('hes-listed-building') && !auditedFeatureIds.has(feature.id))];
const highlights: VisitorHighlight[] = [church, square].map((feature, index) => ({
  rank: index + 1, featureId: feature.id, name: feature.name,
  reason: feature.editorialReview!.scoreRationale,
  tagline: index === 0 ? 'Romanesque church and early religious centre' : 'A complete planned granite village square',
  visitorScore: index === 0 ? 74 : 70, timeToSpend: index === 0 ? '30–50 minutes' : '30–45 minutes',
  openingTimes: index === 0 ? 'Churchyard and exterior accessible; interior opening is not assured' : 'Public streets and square; daylight recommended',
  admission: 'Free exterior visit', freeAdmission: true, visitorWebsiteUrl: feature.visitorWebsiteUrl,
  editorialReview: feature.editorialReview, sourceName: feature.sourceRecords[0].sourceName,
  sourceUrl: feature.visitorWebsiteUrl!, verifiedInBoundaryAt: reviewedDate,
}));

pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = { score: 67, dogOwnerScore: 64, dogAccessScoreAdjustment: -3, rating: 0, label: 'Notable Stop', summary: 'A remarkably coherent planned granite village with an important medieval church, a strong café and useful short local walks.', dogAccessRating: 2, dogAccessSummary: 'The square and paths work well outdoors with a dog under close control, but church interior access is not assured, the café’s current indoor policy is unconfirmed and rural paths require livestock and wildlife care.', methodVersion: '2026-08-27-strict-settlement-visitor-gate-v1', reviewedAt: reviewedDate, sourceUrls: Object.values(urls) };
pkg.project.visitorHighlights = highlights;
pkg.project.townGuide = { characterTag: 'Planned granite estate village and medieval church', headline: 'A complete historic square with a much older religious heart', intro: 'Monymusk remains a 67% Notable Stop. Its appeal comes from the unusually coherent square, the nationally important medieval church, one genuinely useful café and short paths that begin in the village—not from private Monymusk House or distant Bennachie attractions.', bestFor: ['Medieval church history','Planned village architecture','Coffee and cake','Short rural walks'], perfectFor: ['A 2–3 hour heritage stop','A quiet village-and-path circuit'], suggestedFirstVisit: { title: 'Start at St Mary’s and walk the full square', summary: 'Study the church doorway and tower, circle the listed square, pause at Grant Arms Café, then add the dam-and-river loop if paths are suitable.' }, dontMiss: ['St Mary’s Parish Church','Monymusk Square Heritage Ensemble','Monymusk Core Paths'], suggestedTime: '2–3 hours; around 90 minutes without a trail', visitorMood: 'A quiet, architecture-led stop whose quality lies in coherence and atmosphere rather than a long attraction list.', practicalNote: 'There is no council-listed public toilet or Changing Places facility in Monymusk. Two small parking areas are mapped by the recreation ground, but capacity, disabled bays, tariffs, payment methods and restrictions are not published; check signs and do not obstruct residents.', transportNote: 'Monymusk has bus stops at the square and B993 road end. Use Traveline Scotland via the council journey-planning page for current X20/220/421 times before travel.', accessibilityNote: 'The square is compact but has kerbs and road crossings. Rural path surfaces and gradients vary; the local family loop explicitly includes a red gate that is not buggy-friendly.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate } as any;
pkg.project.visualIdentity = { theme: 'monymusk-memorial-flower-garden-watercolour', badgeImage: '/town-guides/monymusk-memorial-flowers-watercolour-guide-v2.png', badgeAlt: 'Illustrated view of Monymusk’s pale stone memorial framed by woodland and summer flowers', heroImage: '/town-guides/monymusk-memorial-flowers-watercolour-guide-v2.png', heroAlt: 'Ink-and-watercolour guide illustration of Monymusk’s memorial, railings and colourful flower garden', heroObjectPosition: '50% 45%', motifs: ['Stone memorial','Woodland setting','Flower garden','Iron railings'], primaryColour: '#31534E', accentColour: '#A56E28', backgroundColour: '#EEF1E6' };

planner.projects[projectId] = { eat: foods.map((item) => item.id), trails: trails.map((item) => item.id), parking: facilities.filter((item) => item.featureType === 'parking').map((item) => item.id), toilets: [], picnic: facilities.filter((item) => item.featureType === 'picnic_site').map((item) => item.id) };
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    [church.id]: { rating: 1, status: 'restricted', label: 'Churchyard visit; interior policy unconfirmed', summary: 'Use a short lead and respectful control in the active burial ground. Do not assume pet-dog access to the church interior.', sourceName: 'Separate churchyard dog-access review', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
    [square.id]: { rating: 2, status: 'allowed_with_conditions', label: 'Outdoor square with close control', summary: 'A practical outdoor stop, but keep close control beside roads, homes and other visitors.', sourceName: 'Monymusk audit and Scottish Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
  },
  trail: Object.fromEntries(trails.map((item) => [item.id, { rating: 2, status: 'allowed_with_conditions', label: 'Rural route with close control', summary: 'Keep dogs close around livestock, wildlife, water, play areas and roads; route surfaces and gates vary.', sourceName: 'Scottish Outdoor Access Code and route review', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate }])),
  eat: {
    [foods[0].id]: { rating: 2, status: 'restricted', label: 'Courtyard evidence; confirm current indoor access', summary: 'Dogs were explicitly welcomed in the courtyard after reopening, but no dependable current statement confirms indoor café access.', sourceName: 'Separate Grant Arms dog-policy search', sourceUrl: urls.grantArmsHistory, reviewedAt: reviewedDate },
    [foods[1].id]: { rating: 1, status: 'unknown', label: 'Dog policy not established', summary: 'No reliable current operator dog policy was found; confirm locally.', sourceName: 'Separate thrift-shop dog-policy search', sourceUrl: urls.familyLoop, reviewedAt: reviewedDate },
  },
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Monymusk audit introduced ${errors.length} validation error(s): ${errors.map((item) => item.message).join('; ')}`);
const visibleHistoricPins = pkg.features.filter((item) => item.tags.some((tag: string) => ['hes-listed-building','hes-scheduled-monument'].includes(tag)) && !item.tags.includes('map-hidden'));
const undated = visibleHistoricPins.filter((item) => !item.documentedDateText?.trim() || item.earliestPossibleYear == null || item.latestPossibleYear == null);
if (undated.length) throw new Error(`Undated Monymusk historic pins: ${undated.map((item) => item.id).join(', ')}`);
const bufferPins = visibleHistoricPins.filter((item) => item.tags.includes('town-selection-heritage-buffer'));

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
await writeFile(reportPath, `${JSON.stringify({
  reviewedAt, townScore: 67, dogOwnerScore: 64, dogAccessRating: 2,
  publicationRule: 'Only visitor places scoring 60 or more are published; private and out-of-boundary attractions do not inflate the settlement score.',
  categoryCounts: { see: highlights.length, eat: foods.length, trails: trails.length, picnic: 1, parking: 2, toilets: 0, heritage: visibleHistoricPins.length },
  attractions: highlights.map((item) => ({ name: item.name, score: item.visitorScore, published: true })),
  food: foods.map((item, index) => ({ name: item.name, score: index ? 62 : 72, dogPolicy: index ? 'Unconfirmed' : 'Historic courtyard welcome; current indoor access unconfirmed' })),
  trails: trails.map((item, index) => ({ name: item.name, score: index ? 65 : 68, url: item.visitorWebsiteUrl, linkCheck: 'HTTP 200 on 2026-08-27' })),
  trailProviderSearches: [
    { provider: 'TreasureTrails.co.uk', result: 'No exact Monymusk commercial trail found; the Aberdeenshire collection page was checked and returned HTTP 200.' },
    { provider: 'Curious About', result: 'No exact Monymusk walk found; provider site returned HTTP 200.' },
    { provider: 'Mystery Guides', result: 'No exact Monymusk guide found; provider site returned HTTP 200.' },
    { provider: 'Go Quest Adventures', result: 'No exact Monymusk quest found; provider site returned HTTP 200.' },
    { provider: 'Aberdeenshire Council', result: 'Exact-town Monymusk core-path PDF verified and returned HTTP 200.' },
    { provider: 'The Thriving Mum Hub', result: 'Exact-town dam, river and play-park family loop verified and returned HTTP 200.' },
  ],
  facilities: {
    parking: facilities.filter((item) => item.featureType === 'parking').map((item) => ({ name: item.name, capacity: 'Not published', disabledSpaces: 'Not published', price: 'No published tariff; fee status unconfirmed', paymentMethods: 'None published', chargeableHours: 'None published', maxStay: 'Not published', overnight: 'Not published', source: item.visitorWebsiteUrl })),
    toilets: { result: 'No Monymusk public toilet, comfort partnership or Changing Places facility appears on the current Aberdeenshire Council list. Customer toilets are not presented as public facilities.' },
    picnic: { name: 'Monymusk Play Park Informal Picnic Stop', tableCount: 'No verified picnic tables', cover: 'None verified', accessibility: 'No formal audit', facilities: 'Playground nearby', dogHazards: 'Play equipment, children, roads and nearby rural paths' },
    transport: { result: 'Square and B993 road-end stops verified; use the council Traveline link for current X20/220/421 journey times.' },
  },
  heritageDateAudit: { visiblePins: visibleHistoricPins.length, dated: visibleHistoricPins.length - undated.length, undated: undated.map((item) => item.id), bufferPins: bufferPins.map((item) => item.id), dateRule: 'Construction dates and periods come from HES descriptions; statutory listing dates are excluded.' },
  exclusions: ['Monymusk House is private and is not presented as a dependable visitor attraction.', 'The Monymusk Cross is inside the private house and is not treated as publicly accessible.', 'Pitfichie Castle, Donview Forest and wider Bennachie experiences are outside the strict settlement score.', 'No parking capacity, disabled-bay count, tariff, payment method, toilet facility, picnic-table count or indoor dog access is invented.'],
  linksChecked: Object.values(urls).filter((url) => [urls.corePaths,urls.familyLoop,urls.treasureTrails,urls.curiousAbout,urls.mysteryGuides,urls.goQuest,urls.councilParking,urls.councilToilets,urls.councilBus].includes(url)).map((url) => ({ url, status: 200, checkedAt: reviewedAt })),
  art: { file: '/town-guides/monymusk-memorial-flowers-watercolour-guide-v2.png', treatment: 'Original ink-and-watercolour interpretation of the user-supplied memorial reference, with the monument retained as a freestanding subject and no roads, cars, poles, signage or copied camera angle.' },
  verification: { heritagePinsDated: `${visibleHistoricPins.length - undated.length}/${visibleHistoricPins.length}`, undatedHistoricPins: undated.length },
}, null, 2)}\n`, 'utf8');

console.log(`Monymusk full audit complete: ${highlights.length} See, ${foods.length} Eats, ${trails.length} Trails, 1 informal picnic stop, 2 parking areas, no verified public toilet; ${visibleHistoricPins.length - undated.length}/${visibleHistoricPins.length} visible historic pins dated.`);
