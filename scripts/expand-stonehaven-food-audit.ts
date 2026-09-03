import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'stonehaven-scotland';
const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T21:35:00Z';
const projectPath = resolve('data/projects/stonehaven.json');
const plannerPath = resolve('data/stonehaven-coast-visitor-planner-curation.json');
const dogPath = resolve('data/stonehaven-coast-dog-access-curation.json');
const fullReportPath = resolve('data/review/stonehaven-full-visitor-audit-2026-08-27.json');
const foodReportPath = resolve('data/review/stonehaven-food-audit-2026-08-27.json');

type MutableFeature = HeritageFeature & Record<string, any>;
type MutablePackage = ProjectPackage & {
  project: ProjectPackage['project'] & Record<string, any>;
  features: MutableFeature[];
};

type FoodSpec = {
  slug: string;
  name: string;
  score: number;
  coordinates: [number, number];
  locationType?: 'exact' | 'approximate';
  locationConfidence?: 'high' | 'medium';
  description: string;
  tagline: string;
  cuisine: string;
  price: string;
  hours: string;
  website: string;
  evidenceUrls?: string[];
  dog: {
    rating: 0 | 1 | 2 | 3;
    status: 'welcoming' | 'restricted' | 'unconfirmed';
    label: string;
    summary: string;
    sourceName: string;
    sourceUrl: string;
  };
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as MutablePackage;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dogCuration = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const fullReport = JSON.parse(await readFile(fullReportPath, 'utf8')) as any;

const directoryUrl = 'https://www.stonehavenbusiness.co.uk/business-directory/';
const dogGuideUrl = 'https://bayviewstonehaven.com/dog-friendly-stonehaven/';
const auldToonDogGuideUrl = 'https://www.auldtoonstonehaven.co.uk/index.asp?pageid=725984';

const food: FoodSpec[] = [
  {
    slug: 'tolbooth-seafood-restaurant',
    name: 'The Tolbooth Seafood Restaurant',
    score: 90,
    coordinates: [-2.2020797, 56.960782],
    description: 'Destination seafood dining inside the historic Old Pier building, with harbour views, fixed-price menus and a strong Scottish catch focus.',
    tagline: 'Destination seafood on the Old Pier',
    cuisine: 'Scottish seafood and seasonal local produce',
    price: '£££',
    hours: 'Monday closed; Tuesday 17:00–21:15; Wednesday–Friday 12:00–14:30 and 17:00–21:15; Saturday 12:00–21:15; Sunday 12:00–20:00',
    website: 'https://www.thetolboothrestaurant.co.uk/',
    evidenceUrls: ['https://www.tripadvisor.co.uk/FAQ_Answers-g793710-d971450-t5754530.html'],
    dog: {
      rating: 0,
      status: 'restricted',
      label: 'Assistance dogs only',
      summary: 'The restaurant states that ordinary pet dogs are not admitted; guide and assistance dogs are the exception.',
      sourceName: 'Tolbooth restaurant representative response',
      sourceUrl: 'https://www.tripadvisor.co.uk/FAQ_Answers-g793710-d971450-t5754530.html',
    },
  },
  {
    slug: 'nadarra',
    name: 'Nàdarra',
    score: 86,
    coordinates: [-2.2087133, 56.9630153],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'Independent natural-wine bar and eatery serving brunch, lunch and evening small plates built around seasonal local produce.',
    tagline: 'Natural wine and seasonal small plates',
    cuisine: 'Brunch, sharing plates and low-intervention wine',
    price: '££',
    hours: 'Monday closed; Tuesday–Friday 11:00–23:00; Saturday 10:00–23:00; Sunday 10:00–20:00',
    website: 'https://nadarrawine.co.uk/',
    evidenceUrls: ['https://nadarrawine.co.uk/contact-us/'],
    dog: {
      rating: 2,
      status: 'welcoming',
      label: 'Listed locally as dog-friendly',
      summary: 'A current local dog-friendly guide includes Nàdarra. Confirm the preferred seating area directly when booking.',
      sourceName: 'Bay View dog-friendly Stonehaven guide',
      sourceUrl: dogGuideUrl,
    },
  },
  {
    slug: 'marine-hotel-restaurant',
    name: 'Marine Hotel Restaurant',
    score: 83,
    coordinates: [-2.2039898, 56.9601337],
    description: 'Harbour-view hotel restaurant and Six°North bar serving local produce, seafood and an extensive beer range.',
    tagline: 'Harbour dining and Belgian-style beer',
    cuisine: 'Scottish produce, seafood and pub dishes',
    price: '££',
    hours: 'Food Monday–Friday 12:00–14:30 and 17:30–21:00; Saturday–Sunday 12:00–21:00',
    website: 'https://www.sixdnorth.co.uk/stonehaven/',
    evidenceUrls: ['https://camra.org.uk/pubs/marine-hotel-stonehaven-112817'],
    dog: {
      rating: 3,
      status: 'restricted',
      label: 'Dogs welcome in bar and lounge',
      summary: 'Dogs are welcome in the bar and lounge rather than every dining area; request suitable seating on arrival.',
      sourceName: 'Stunning Stonehaven Marine Hotel listing',
      sourceUrl: 'https://www.stunningstonehaven.com/home/find/lister/marine-hotel_1923',
    },
  },
  {
    slug: 'mollys-cafe-bar',
    name: "Molly's Café Bar",
    score: 82,
    coordinates: [-2.20575, 56.96875],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'Seafront café-bar covering breakfast and lunch daily, with dinner service on Friday and Saturday.',
    tagline: 'All-day seafront café dining',
    cuisine: 'Breakfast, café lunches and evening dishes',
    price: '££',
    hours: 'Monday–Thursday and Sunday 09:00–16:00; Friday–Saturday 09:00–16:00 and 17:00–22:00',
    website: 'https://www.mollyscafebar.com/',
    dog: {
      rating: 2,
      status: 'restricted',
      label: 'Dogs at outside tables only',
      summary: 'Current local guidance limits ordinary dog visits to the outdoor seating area.',
      sourceName: 'Auld Toon dog-friendly guide',
      sourceUrl: auldToonDogGuideUrl,
    },
  },
  {
    slug: 'cool-gourmet',
    name: 'Cool Gourmet',
    score: 81,
    coordinates: [-2.2062181, 56.9611373],
    description: 'Independent café known for home-made breakfasts, soups, stovies, bakes and bookable afternoon tea.',
    tagline: 'Home-made lunches and afternoon tea',
    cuisine: 'Breakfast, Scottish comfort food, cakes and afternoon tea',
    price: '££',
    hours: 'Monday, Thursday–Saturday 10:00–16:00; Sunday 10:30–16:00; Tuesday–Wednesday closed',
    website: 'https://coolgourmet.wixsite.com/cool-gourmet/our-shop',
    dog: {
      rating: 3,
      status: 'welcoming',
      label: 'Dogs welcome inside on a lead',
      summary: 'The operator explicitly welcomes dogs inside provided they are kept on a lead.',
      sourceName: 'Cool Gourmet',
      sourceUrl: 'https://coolgourmet.wixsite.com/cool-gourmet/our-shop',
    },
  },
  {
    slug: 'casa-luisa',
    name: 'Casa Luisa',
    score: 81,
    coordinates: [-2.2093251, 56.9640295],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'A new independent Spanish restaurant from the team behind Picos Deli, serving authentic regional dishes in Market Square.',
    tagline: 'Independent Spanish dining in Market Square',
    cuisine: 'Spanish regional dishes and tapas-style plates',
    price: '££',
    hours: 'Current service hours are not reliably published; check directly before travel',
    website: 'https://www.stonehavenbusiness.co.uk/business-directory/',
    evidenceUrls: ['https://www.pressandjournal.co.uk/fp/news/aberdeen-aberdeenshire/7075407/casa-luisa-stonehaven-sergio-ruiz/'],
    dog: {
      rating: 0,
      status: 'unconfirmed',
      label: 'Dog policy not published',
      summary: 'No reliable current ordinary pet-dog policy was found for the restaurant. Confirm directly.',
      sourceName: 'Casa Luisa policy search',
      sourceUrl: directoryUrl,
    },
  },
  {
    slug: 'old-pier-coffee-house',
    name: 'Old Pier Coffee House',
    score: 80,
    coordinates: [-2.20185, 56.96074],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'Compact harbour coffee house serving quality coffee, cakes and light food beside the Old Pier.',
    tagline: 'Old Pier coffee and light food',
    cuisine: 'Coffee, cakes, breakfast and light lunches',
    price: '£',
    hours: 'Monday and Wednesday–Sunday 09:00–17:00; Tuesday closed',
    website: 'https://www.theoldpierstonehaven.com/opening-times',
    dog: {
      rating: 2,
      status: 'restricted',
      label: 'Dogs downstairs only',
      summary: 'Dogs can use the ground-floor/downstairs area, but not the upstairs seating room.',
      sourceName: 'Auld Toon dog-friendly guide',
      sourceUrl: auldToonDogGuideUrl,
    },
  },
  {
    slug: 'villa-coffee-shop',
    name: 'The Villa Coffee Shop',
    score: 79,
    coordinates: [-2.2067436, 56.9617944],
    description: 'Award-winning independent café with home baking, soups, paninis, baked potatoes and daily specials.',
    tagline: 'Award-winning home baking and café lunches',
    cuisine: 'Cakes, soups, paninis and café lunches',
    price: '£',
    hours: 'Tuesday–Saturday 10:00–15:00; Monday and Sunday closed',
    website: 'https://www.thevillacoffeeshop.co.uk/',
    dog: {
      rating: 2,
      status: 'restricted',
      label: 'Small dogs welcome',
      summary: 'The current local listing specifically welcomes small dogs; larger-dog access is not claimed.',
      sourceName: 'Stunning Stonehaven Villa listing',
      sourceUrl: 'https://www.stunningstonehaven.com/home/find/lister/the-villa-coffee-shop_1808',
    },
  },
  {
    slug: 'aunty-bettys',
    name: "Aunty Betty's",
    score: 78,
    coordinates: [-2.20565, 56.96862],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'Popular family-run seafront ice-cream and dessert shop with sweets and hot drinks.',
    tagline: 'Seafront ice creams and sweet treats',
    cuisine: 'Ice cream, desserts, sweets and hot drinks',
    price: '£',
    hours: 'Seasonal hours vary; current listings commonly show daily daytime and evening opening—check on the day',
    website: 'https://www.auntybettys.co.uk/',
    evidenceUrls: ['https://visitabdn.com/businesses/aunty-bettys'],
    dog: {
      rating: 3,
      status: 'welcoming',
      label: 'Listed as dog-friendly',
      summary: 'VisitAberdeenshire currently marks the business dog-friendly.',
      sourceName: 'VisitAberdeenshire',
      sourceUrl: 'https://visitabdn.com/businesses/aunty-bettys',
    },
  },
  {
    slug: 'pinky-promise-cafe',
    name: 'Pinky Promise Café',
    score: 77,
    coordinates: [-2.2082455, 56.96481],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'Friendly town-centre café for coffee, cakes, ice cream and light bites, including vegan choices.',
    tagline: 'Inclusive coffee, cakes and light bites',
    cuisine: 'Coffee, cakes, ice cream, light bites and vegan options',
    price: '£',
    hours: 'Monday and Wednesday–Saturday 08:00–17:00; Sunday 10:00–17:00; Tuesday closed',
    website: 'https://www.stunningstonehaven.com/home/find/lister/pinky-promise_2180',
    evidenceUrls: ['https://www.happycow.net/reviews/pinky-promise-cafe-stonehaven-477932'],
    dog: {
      rating: 3,
      status: 'welcoming',
      label: 'Listed locally as dog-friendly',
      summary: 'The current local dog-friendly guide includes Pinky Promise Café.',
      sourceName: 'Bay View dog-friendly Stonehaven guide',
      sourceUrl: dogGuideUrl,
    },
  },
  {
    slug: 'carron-to-mumbai',
    name: 'Carron to Mumbai',
    score: 76,
    coordinates: [-2.2108683, 56.9636128],
    description: 'Town-centre Indian restaurant with evening dining, a Sunday buffet and a separate bar and beer garden.',
    tagline: 'Indian dining and Sunday buffet',
    cuisine: 'Indian curries, grills and Sunday buffet',
    price: '££',
    hours: 'Monday–Saturday dinner 17:00–23:00; Sunday buffet 12:30–21:00 and dinner service; bar and beer garden 17:00–00:00',
    website: 'https://www.carrontomumbaistonehaven.co.uk/contact.htm',
    dog: {
      rating: 2,
      status: 'restricted',
      label: 'Dogs in the bar only',
      summary: 'Current local guidance identifies dog access in the bar rather than the restaurant dining room.',
      sourceName: 'Bay View dog-friendly Stonehaven guide',
      sourceUrl: dogGuideUrl,
    },
  },
  {
    slug: 'cafe-noir',
    name: 'Café Noir Coffee House',
    score: 75,
    coordinates: [-2.2074634, 56.9620141],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'French-influenced coffee house specialising in sweet crêpes and savoury buckwheat galettes.',
    tagline: 'French crêpes and savoury galettes',
    cuisine: 'Crêpes, galettes, coffee and cakes',
    price: '££',
    hours: 'Monday–Sunday 10:00–16:00; last orders 15:30',
    website: 'https://cafenoirstonehaven.co.uk/',
    dog: {
      rating: 0,
      status: 'unconfirmed',
      label: 'Dog policy not published',
      summary: 'No reliable current dog policy was found. Confirm ordinary pet access directly.',
      sourceName: 'Café Noir policy search',
      sourceUrl: 'https://cafenoirstonehaven.co.uk/',
    },
  },
  {
    slug: 'station-hotel',
    name: 'Station Hotel',
    score: 72,
    coordinates: [-2.2251833, 56.9662255],
    description: 'Traditional hotel dining close to the railway station, with daily lunch and dinner service.',
    tagline: 'Lunch and dinner by the station',
    cuisine: 'Traditional hotel and pub dishes',
    price: '££',
    hours: 'Lunch Monday–Thursday 12:00–14:30 and Friday–Sunday 12:00–15:00; dinner daily 17:00–20:30',
    website: 'https://www.stationhotelstonehaven.co.uk/opening-hours/',
    evidenceUrls: ['https://www.stationhotelstonehaven.co.uk/'],
    dog: {
      rating: 2,
      status: 'restricted',
      label: 'Dogs in the bar only',
      summary: 'Current local guidance identifies dog access in the bar rather than all dining areas.',
      sourceName: 'Bay View dog-friendly Stonehaven guide',
      sourceUrl: dogGuideUrl,
    },
  },
  {
    slug: 'waterfront-cafe',
    name: 'Waterfront Café',
    score: 70,
    coordinates: [-2.2077423, 56.9647574],
    description: 'Established town-centre café serving home baking and traditional daytime favourites.',
    tagline: 'Home baking and traditional café favourites',
    cuisine: 'Home baking, breakfasts and light lunches',
    price: '£',
    hours: 'Monday–Saturday 09:30–17:00; Sunday 10:00–17:00',
    website: 'https://www.stunningstonehaven.com/home/find/lister/waterfront-cafe_1809',
    dog: {
      rating: 2,
      status: 'restricted',
      label: 'Dogs in the garden only',
      summary: 'Current local guidance limits ordinary dog visits to the garden seating.',
      sourceName: 'Bay View dog-friendly Stonehaven guide',
      sourceUrl: dogGuideUrl,
    },
  },
  {
    slug: 'number-44',
    name: 'No.44 Bar & Restaurant',
    score: 69,
    coordinates: [-2.2080522, 56.9642205],
    description: 'Central hotel bar and restaurant serving British pub food and daily specials in Market Square.',
    tagline: 'Central pub food in Market Square',
    cuisine: 'British pub food and daily specials',
    price: '££',
    hours: 'Current meal hours are not clearly published; check directly before travel',
    website: 'https://www.number44.net/',
    evidenceUrls: ['https://www.stunningstonehaven.com/home/find/lister/no-44-restaurant--bar-meals_1930'],
    dog: {
      rating: 2,
      status: 'welcoming',
      label: 'Listed locally as dog-friendly',
      summary: 'A current local dog-friendly guide includes No.44; confirm the preferred seating area on arrival.',
      sourceName: 'Bay View dog-friendly Stonehaven guide',
      sourceUrl: dogGuideUrl,
    },
  },
  {
    slug: 'cafe-neuk',
    name: 'Café Neuk',
    score: 68,
    coordinates: [-2.213, 56.9655],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'Community-minded daytime café in Arduthie House with breakfast, lunches and home-made meals.',
    tagline: 'Community café and home-made lunches',
    cuisine: 'Breakfast, soups, sandwiches and home-made meals',
    price: '£',
    hours: 'Current hours are not reliably published; check directly before travel',
    website: 'https://www.stonehavenbusiness.co.uk/business-directory/cafe-neuk/',
    evidenceUrls: ['https://www.arduthiehouse.co.uk/wp-content/uploads/go-x/u/05317357-32b5-452d-8107-69986d1d1d0a/CAFE-NEUK-Menu-as-of-180625.pdf'],
    dog: {
      rating: 0,
      status: 'unconfirmed',
      label: 'Dog policy not published',
      summary: 'No reliable current ordinary pet-dog policy was found. Confirm directly.',
      sourceName: 'Café Neuk policy search',
      sourceUrl: 'https://www.stonehavenbusiness.co.uk/business-directory/cafe-neuk/',
    },
  },
  {
    slug: 'picos-deli',
    name: 'Picos Deli',
    score: 67,
    coordinates: [-2.20809, 56.96365],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'Independent Spanish deli selling specialist ingredients, savouries and treats for a distinctive takeaway stop.',
    tagline: 'Spanish deli treats and picnic provisions',
    cuisine: 'Spanish deli food, savouries and specialist groceries',
    price: '££',
    hours: 'Current hours are not reliably published; check directly before travel',
    website: 'https://www.stunningstonehaven.com/home/find/lister/picos-deli_2185',
    evidenceUrls: ['https://ratings.food.gov.uk/business/1795017'],
    dog: {
      rating: 2,
      status: 'welcoming',
      label: 'Listed locally as dog-friendly',
      summary: 'A current local guide includes Picos Deli among dog-friendly food businesses; confirm indoor arrangements directly.',
      sourceName: 'Bay View dog-friendly Stonehaven guide',
      sourceUrl: dogGuideUrl,
    },
  },
  {
    slug: 'red-red-robin',
    name: 'Red Red Robin',
    score: 64,
    coordinates: [-2.20855, 56.9639],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'Early-opening daytime café for sandwiches, paninis, baguettes, coffee and home baking, with vegan and gluten-free choices.',
    tagline: 'Early coffee, filled rolls and bakes',
    cuisine: 'Sandwiches, paninis, home baking and daily specials',
    price: '£',
    hours: 'Monday–Friday 07:30–14:30; Saturday 08:00–14:30; Sunday closed',
    website: 'https://www.stunningstonehaven.com/home/find/lister/red-red-robin_1936',
    dog: {
      rating: 2,
      status: 'welcoming',
      label: 'Listed locally as dog-friendly',
      summary: 'A current local dog-friendly guide includes Red Red Robin; confirm the preferred seating area on arrival.',
      sourceName: 'Bay View dog-friendly Stonehaven guide',
      sourceUrl: dogGuideUrl,
    },
  },
  {
    slug: 'graingers-delicatessen',
    name: 'Graingers Delicatessen',
    score: 73,
    coordinates: [-2.211849, 56.963588],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'Independent deli with sit-in or takeaway Italian coffee, fresh sandwiches, home-made soup, scones and cakes.',
    tagline: 'Deli coffee, soup and fresh sandwiches',
    cuisine: 'Coffee, home baking, soup, deli sandwiches and picnic provisions',
    price: '£',
    hours: 'Tuesday–Saturday 09:30–16:00; Sunday–Monday closed',
    website: 'https://www.graingersdeli.co.uk/',
    evidenceUrls: ['https://www.stunningstonehaven.com/home/find/lister/graingers-delicatessen_1800'],
    dog: {
      rating: 0,
      status: 'unconfirmed',
      label: 'Dog policy not published',
      summary: 'No reliable current dog policy is published by the operator. Confirm ordinary pet access directly before visiting.',
      sourceName: 'Graingers Delicatessen policy review',
      sourceUrl: 'https://www.graingersdeli.co.uk/',
    },
  },
  {
    slug: 'drifters-cafe',
    name: "Drifter's Café",
    score: 68,
    coordinates: [-2.205431, 56.96871],
    locationType: 'approximate',
    locationConfidence: 'medium',
    description: 'Beachfront family café serving coffee, breakfast rolls, fresh sandwiches, soup, light lunches and daily-baked scones.',
    tagline: 'Beachfront coffee, scones and light lunches',
    cuisine: 'Coffee, breakfast, sandwiches, soup, scones and light lunches',
    price: '£',
    hours: 'Monday–Thursday 09:00–16:00; Friday–Sunday 09:00–17:00',
    website: 'https://www.stunningstonehaven.com/home/find/lister/drifters-cafe_2175',
    evidenceUrls: ['https://www.tripadvisor.co.uk/Restaurant_Review-g793710-d23384600-Reviews-Drifters_Cafe-Stonehaven_Aberdeenshire_Scotland.html'],
    dog: {
      rating: 3,
      status: 'welcoming',
      label: 'Dogs welcomed by the business',
      summary: 'The business-managed current listing marks the café dog-friendly and describes indoor and outdoor visitor use with dogs.',
      sourceName: "Drifter's Café managed listing",
      sourceUrl: 'https://www.tripadvisor.co.uk/Restaurant_Review-g793710-d23384600-Reviews-Drifters_Cafe-Stonehaven_Aberdeenshire_Scotland.html',
    },
  },
];

const assessmentFor = (score: number) => ({
  foodAndDrinkQuality: Math.min(30, Math.max(17, Math.round(score * 0.3))),
  daytimeRelevance: Math.min(20, Math.max(10, Math.round(score * 0.2))),
  distinctiveness: Math.min(15, Math.max(9, Math.round(score * 0.15))),
  consistency: Math.min(15, Math.max(9, Math.round(score * 0.15))),
  visitorFit: Math.min(10, Math.max(6, Math.round(score * 0.1))),
  evidenceConfidence: 0,
});

const exactAssessment = (score: number) => {
  const assessment = assessmentFor(score);
  const partial = Object.values(assessment).reduce((sum, value) => sum + value, 0);
  assessment.evidenceConfidence = score - partial;
  return assessment;
};

const publishedSlugs = new Set([
  'mollys-cafe-bar',
  'cool-gourmet',
  'old-pier-coffee-house',
  'villa-coffee-shop',
  'aunty-bettys',
  'pinky-promise-cafe',
  'cafe-noir',
  'waterfront-cafe',
  'red-red-robin',
  'graingers-delicatessen',
  'drifters-cafe',
]);
const publishedFood = food.filter((item) => publishedSlugs.has(item.slug));
const publishedIds = publishedFood.map((item) => `curated-eat:stonehaven-${item.slug}`);

const scoreById = new Map<string, number>([
  ...food.map((item) => [`curated-eat:stonehaven-${item.slug}`, item.score] as [string, number]),
]);

for (const spec of publishedFood) {
  const id = `curated-eat:stonehaven-${spec.slug}`;
  const evidenceUrls = [spec.website, ...(spec.evidenceUrls ?? [])];
  const feature = {
    id,
    projectId,
    name: spec.name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    region: 'Aberdeenshire',
    locality: 'Stonehaven',
    featureType: 'commercial_building',
    significance: spec.score >= 80 ? 'regional' : 'local',
    geometry: { type: 'Point', coordinates: spec.coordinates },
    locationType: spec.locationType ?? 'exact',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    locationConfidence: spec.locationConfidence ?? 'high',
    survival: 'substantially_intact',
    shortDescription: spec.description,
    sourceRecords: [
      {
        sourceName: spec.name,
        sourceOrganisation: spec.name,
        sourceUrl: spec.website,
        accessedAt: reviewedAt,
        licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
        reliability: 'official_non_statutory',
        notes: `Current-place curation: visitor_place_type=Eat; visit_score=${spec.score}; food_score=${spec.score}; price_band=${spec.price}; cuisine=${spec.cuisine}; opening_hours:description=${spec.hours}; dog_friendly=${spec.dog.label}; description=${spec.tagline}: ${spec.description}`,
      },
      ...(spec.evidenceUrls ?? []).map((sourceUrl) => ({
        sourceName: `${spec.name} supporting current evidence`,
        sourceOrganisation: 'Current operator, destination or local visitor source',
        sourceUrl,
        accessedAt: reviewedAt,
        reliability: 'official_non_statutory',
        notes: 'Supporting evidence for current operation, offer, opening pattern or visitor access.',
      })),
    ],
    tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    evidenceScope: 'parish_evidence',
    visitorWebsiteUrl: spec.website,
    editorialReview: {
      status: 'editorially_researched',
      category: 'food',
      methodVersion: '2026-08-13-researched-visitor-value-v1',
      reviewedAt: reviewedDate,
      scoreRationale: `${spec.tagline}. Published after a current Stonehaven-wide food audit at ${spec.score}/100.`,
      evidenceUrls,
      foodAssessment: exactAssessment(spec.score),
    },
  } as MutableFeature;
  const index = pkg.features.findIndex((item) => item.id === id);
  if (index >= 0) pkg.features[index] = feature;
  else pkg.features.push(feature);
}

const publishedIdSet = new Set(publishedIds);
pkg.features = pkg.features.filter(
  (item) => !item.id.startsWith('curated-eat:stonehaven-') || publishedIdSet.has(item.id),
);

const orderedIds = [...new Set(publishedIds)].sort(
  (left, right) => (scoreById.get(right) ?? 0) - (scoreById.get(left) ?? 0),
);
planner.projects[projectId].eat = orderedIds;

const cafeCard = (slug: string) => {
  const spec = publishedFood.find((item) => item.slug === slug);
  if (!spec) throw new Error(`Missing published café spec: ${slug}`);
  return {
    name: spec.name,
    visitorScore: spec.score,
    summary: spec.description,
    openingTimes: spec.hours,
    priceBand: spec.price,
    externalUrl: spec.website,
  };
};
for (const attraction of pkg.features) {
  if (attraction.id === 'curated-attraction:stonehaven-harbour-auld-toon') {
    attraction.attractionGuide = {
      ...attraction.attractionGuide,
      food: [cafeCard('old-pier-coffee-house'), cafeCard('cool-gourmet')],
    };
  }
  if (attraction.id === 'curated-attraction:stonehaven-beach-promenade') {
    attraction.attractionGuide = {
      ...attraction.attractionGuide,
      food: [cafeCard('mollys-cafe-bar'), cafeCard('drifters-cafe'), cafeCard('aunty-bettys')],
    };
  }
  if (attraction.id === 'curated-attraction:stonehaven-tolbooth-museum') {
    attraction.attractionGuide = {
      ...attraction.attractionGuide,
      food: [cafeCard('old-pier-coffee-house'), cafeCard('cool-gourmet')],
    };
  }
}

const dogEntries = dogCuration.projects[projectId].eat;
for (const id of Object.keys(dogEntries)) {
  if (id.startsWith('curated-eat:stonehaven-') && !publishedIdSet.has(id)) delete dogEntries[id];
}
for (const spec of publishedFood) {
  const id = `curated-eat:stonehaven-${spec.slug}`;
  dogEntries[id] = {
    ...spec.dog,
    reviewedAt: reviewedDate,
  };
}

const touristAppeal = pkg.project.touristAppeal;
const townGuide = pkg.project.townGuide;
if (!touristAppeal || !townGuide) {
  throw new Error('Stonehaven town guide and tourist appeal must exist before the food audit');
}
touristAppeal.summary =
  'A complete seaside town with a working 1825 harbour, rare 1934 Art Deco seawater lido, broad bay, free museum, a strong daytime café scene and two useful town walks—scored without borrowing Dunnottar Castle.';
touristAppeal.dogAccessSummary =
  'The beach, promenade and clue trail support a strong outdoor dog day, while several cafés publish dog access. Restrictions vary by room, dog size or outside seating; other café policies remain explicitly unconfirmed.';
touristAppeal.reviewedAt = reviewedDate;
touristAppeal.sourceUrls = [
  ...new Set([...(touristAppeal.sourceUrls ?? []), directoryUrl, dogGuideUrl, ...food.flatMap((item) => [item.website, ...(item.evidenceUrls ?? [])])]),
];
townGuide.sourceUrls = touristAppeal.sourceUrls;
townGuide.lastReviewedAt = reviewedDate;

const errors = validateFeatures(pkg.project, pkg.features).filter((item) => item.severity === 'error');
if (errors.length) {
  throw new Error(`Stonehaven food expansion introduced ${errors.length} validation error(s): ${errors.map((item) => `${item.recordId}: ${item.message}`).join('; ')}`);
}

const published = orderedIds.map((id) => {
  const item = pkg.features.find((feature) => feature.id === id)!;
  const spec = food.find((candidate) => id.endsWith(candidate.slug));
  return {
    id,
    name: item.name,
    score: scoreById.get(id),
    dogRating: spec?.dog.rating ?? dogEntries[id]?.rating,
    dogStatus: spec?.dog.status ?? dogEntries[id]?.status,
  };
});

const excluded = [
  { name: 'The Tolbooth Seafood Restaurant', assessedScore: 90, reason: 'formal_restaurant_not_cafe_or_light_lunch_scope', sourceUrl: 'https://www.thetolboothrestaurant.co.uk/' },
  { name: 'Nàdarra', assessedScore: 86, reason: 'wine_bar_and_restaurant_led_not_cafe_scope', sourceUrl: 'https://nadarrawine.co.uk/' },
  { name: 'The Bay Fish & Chips', assessedScore: 86, reason: 'takeaway_fish_shop_not_cafe_or_light_lunch_scope', sourceUrl: 'https://thebayfishandchips.co.uk/find-us/' },
  { name: 'The Ship Inn', assessedScore: 84, reason: 'pub_and_full_meal_scope', sourceUrl: 'https://shipinnstonehaven.com/' },
  { name: 'Marine Hotel Restaurant', assessedScore: 83, reason: 'hotel_restaurant_and_bar_scope', sourceUrl: 'https://www.sixdnorth.co.uk/stonehaven/' },
  { name: 'Carron Fish Bar', assessedScore: 79, reason: 'takeaway_fish_shop_not_cafe_or_light_lunch_scope', sourceUrl: 'https://www.carronfishbar.com/' },
  { name: 'Carron to Mumbai', assessedScore: 76, reason: 'evening_restaurant_not_cafe_scope', sourceUrl: 'https://www.carrontomumbaistonehaven.co.uk/contact.htm' },
  { name: 'Station Hotel', assessedScore: 72, reason: 'hotel_and_full_meal_scope', sourceUrl: 'https://www.stationhotelstonehaven.co.uk/opening-hours/' },
  { name: 'The View at Stonehaven Golf Club', assessedScore: 75, reason: 'outside_strict_stonehaven_boundary', sourceUrl: 'https://www.stonehavengolfclub.com/the-view-restaurant' },
  { name: 'No.44 Bar & Restaurant', assessedScore: 59, reason: 'current_meal_hours_and_access_contract_not_reliably_published', sourceUrl: 'https://www.number44.net/' },
  { name: 'Casa Luisa', assessedScore: 58, reason: 'new_current_business_but_service_hours_and_dog_policy_not_yet_reliably_published', sourceUrl: 'https://www.stonehavenbusiness.co.uk/business-directory/' },
  { name: 'Bucket & Spade', assessedScore: 58, reason: 'insufficient_current_hours_and_visit_contract', sourceUrl: directoryUrl },
  { name: 'Picos Deli', assessedScore: 57, reason: 'current_specialist_food_shop_but_standalone_eating_contract_and_hours_unconfirmed', sourceUrl: 'https://www.stunningstonehaven.com/home/find/lister/picos-deli_2185' },
  { name: 'Deli Lunch Sandwich Bar', assessedScore: 57, reason: 'insufficient_current_hours_and_evidence_depth', sourceUrl: 'https://www.stunningstonehaven.com/home/find/lister/deli-lunch-sandwich-bar_2000' },
  { name: 'Stonehaven Recreation Grounds Café', assessedScore: 59, reason: 'facility_dependent_and_current_service_hours_unconfirmed', sourceUrl: 'https://www.stunningstonehaven.com/home/find/lister/stonehaven-recreation-grounds_1784' },
  { name: 'Splash Café at the Open Air Pool', assessedScore: 59, reason: 'seasonal_nested_pool_facility_not_a_standalone_food_stop', sourceUrl: 'https://www.stonehavenopenairpool.co.uk/' },
  { name: 'Café Neuk', assessedScore: 0, reason: 'closed_on_22_february_2026', sourceUrl: 'https://www.stonehavenbusiness.co.uk/business-directory/cafe-neuk/' },
  { name: 'J G Ross (Bakers)', assessedScore: 0, reason: 'directory_entry_has_no_confirmed_stonehaven_retail_address_or_current_hours', sourceUrl: 'https://stonehavenbusiness.co.uk/directory/j-g-ross-bakers-ltd/' },
];

const foodReport = {
  projectId,
  reviewedAt: reviewedDate,
  methodology: {
    candidateDiscovery: 'Current Stonehaven Business Association directory, operator sites, official destination listings, current local visitor directories and food hygiene evidence.',
    candidateScope: 'Daytime coffee, tea, cake, bakery, tearoom, ice-cream and genuine light-lunch stops; exclude dinner-led restaurants, hotel dining, ordinary pubs and takeaway-only meal businesses.',
    publicationGate: 'Publish only in-boundary current café-led places scoring 60–100. Bands are 90–100, 80–89, 70–79 and 60–69; nothing below 60 is published.',
    dogPolicy: 'Search and publish a separate dog assessment per business. Absence of a policy is unconfirmed, never assumed welcoming.',
  },
  candidateCount: published.length + excluded.length,
  publishedCount: published.length,
  published,
  excluded,
};

fullReport.foodAudit = {
  report: 'data/review/stonehaven-food-audit-2026-08-27.json',
  candidateCount: foodReport.candidateCount,
  publishedCount: foodReport.publishedCount,
  note: 'Re-audited under the café-led scope: coffee, cake, tearoom, bakery, ice-cream and genuine light-lunch stops only. Restaurant-, pub-, hotel- and takeaway-led businesses are recorded as exclusions rather than published Eat pins.',
};
fullReport.eats = orderedIds;
fullReport.categoryCounts = {
  ...fullReport.categoryCounts,
  eat: orderedIds.length,
};

await Promise.all([
  writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8'),
  writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'),
  writeFile(dogPath, `${JSON.stringify(dogCuration, null, 2)}\n`, 'utf8'),
  writeFile(fullReportPath, `${JSON.stringify(fullReport, null, 2)}\n`, 'utf8'),
  writeFile(foodReportPath, `${JSON.stringify(foodReport, null, 2)}\n`, 'utf8'),
]);

console.log(`Stonehaven food audit expanded: ${foodReport.candidateCount} candidates assessed, ${published.length} published at 60+, ${excluded.length} excluded.`);
