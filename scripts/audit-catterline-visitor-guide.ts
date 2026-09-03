import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T20:15:00Z';
const projectId = 'catterline-scotland';
const projectPath = resolve('data/projects/catterline.json');
const plannerPath = resolve('data/stonehaven-coast-visitor-planner-curation.json');
const dogPath = resolve('data/stonehaven-coast-dog-access-curation.json');

const urls = {
  eardley:
    'https://www.nationalgalleries.org/art-and-artists/features/joan-eardley-land-sea-life-catterline-patrick-elliott',
  painting: 'https://www.nationalgalleries.org/art-and-artists/496/sea-and-snow-catterline',
  southRow: 'https://portal.historicenvironment.scot/designation/LB9511',
  coastalTrail: 'https://www.visitabdn.com/assets/Uploads/aberdeenshire-coastal-trail2.pdf',
  creel: 'https://www.creelinn.co.uk/',
  creelContact: 'https://www.creelinn.co.uk/contact',
  parking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets?area=Kincardine+and+Mearns',
  treasureTrails: 'https://www.treasuretrails.co.uk/collections/aberdeenshire',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

type MutableFeature = HeritageFeature & Record<string, any>;
type MutablePackage = ProjectPackage & {
  project: ProjectPackage['project'] & Record<string, any>;
  features: MutableFeature[];
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as MutablePackage;
const feature = (id: string) => {
  const found = pkg.features.find((item) => item.id === id);
  if (!found) throw new Error(`Missing Catterline feature ${id}`);
  return found;
};

const village = feature('curated-attraction:catterline-harbour-eardley-landscape');
const trail = feature('curated-trails:catterline-coastal-village-walk');
const creel = feature('curated-eat:catterline-creel-inn');

pkg.project.touristAppeal = {
  score: 68,
  dogOwnerScore: 67,
  dogAccessScoreAdjustment: -1,
  rating: 0,
  label: 'Notable Stop',
  summary:
    'The harbour, early-19th-century South Row, compact fisher-village form and Joan Eardley landscape make Catterline itself worth seeing. The Creel Inn and short coastal exploration support that appeal without inflating the settlement score.',
  dogAccessRating: 2,
  dogAccessSummary:
    'Dogs can share the outdoor village visit and the Creel Inn welcomes well-behaved dogs in its lounge, but cliff edges, livestock, harbour activity, narrow approaches and no dependable public facilities keep the dog-owner score slightly lower.',
  methodVersion: '2026-08-27-strict-settlement-visitor-gate-v1',
  reviewedAt: reviewedDate,
  sourceUrls: [
    urls.eardley,
    urls.painting,
    urls.southRow,
    urls.coastalTrail,
    urls.creel,
    urls.creelContact,
    urls.parking,
    urls.toilets,
    urls.treasureTrails,
    urls.outdoorCode,
  ],
};

pkg.project.townGuide = {
  characterTag: 'Joan Eardley’s harbour and fisher-cottage landscape',
  headline: 'A tiny fishing village with an outsized place in modern Scottish art',
  intro:
    'Read the crescent bay, pier, cliff and South Row through Joan Eardley’s paintings, then add the harbour descent, a careful short coastal exploration and the cliff-top inn. Fowlsheugh remains a separate Crawton attraction and is not counted here.',
  bestFor: ['Joan Eardley', 'Fishing-village character', 'Coastal scenery', 'Seafood'],
  perfectFor: ['A focused 2–4 hour art-and-coast visit'],
  suggestedFirstVisit: {
    title: 'Start at South Row and look north-east towards the pier',
    summary:
      'This is the documented viewpoint used for Eardley’s c.1958 Sea and Snow, Catterline; continue only on safe public routes.',
  },
  dontMiss: [village.name, creel.name, trail.name],
  suggestedTime: '2–4 hours with food',
  visitorMood:
    'Small, exposed and residential, with a remarkably concentrated relationship between working-coast form, weather and modern Scottish art.',
  sourceUrls: [
    urls.eardley,
    urls.painting,
    urls.southRow,
    urls.coastalTrail,
    urls.creel,
    urls.parking,
    urls.toilets,
    urls.treasureTrails,
  ],
  lastReviewedAt: reviewedDate,
};

pkg.project.visualIdentity = {
  theme: 'catterline-crescent-bay-and-pier',
  badgeImage: '/town-guides/catterline-bay-watercolour-guide-v1.png',
  badgeAlt: 'Watercolour illustration of Catterline’s crescent pebble bay and harbour pier',
  heroImage: '/town-guides/catterline-bay-watercolour-guide-v1.png',
  heroAlt:
    'Watercolour illustration looking across Catterline Bay from the grassy cliff towards the pier and offshore rocks',
  heroObjectPosition: '52% 53%',
  motifs: ['Crescent pebble bay', 'Harbour pier', 'Offshore rocks', 'Grass-covered cliff'],
  primaryColour: '#174A50',
  accentColour: '#A66A20',
  backgroundColour: '#EDF3EE',
};

Object.assign(village, {
  documentedDateText:
    'South Row probably early 19th century; harbour pier built c.1835–1841; Joan Eardley worked here from 1951 until 1963',
  earliestPossibleYear: 1800,
  latestPossibleYear: 1841,
  dateBasis: 'documented_date_range',
  shortDescription:
    'A tiny cliff-backed harbour and early-19th-century listed fisher row whose weather, cottages, bay and pier became central to Joan Eardley’s mature art.',
  reviewNotes:
    'Settlement attraction only: the harbour, South Row and Eardley viewpoints sit inside Catterline. RSPB Fowlsheugh is deliberately excluded and published separately under Crawton.',
});

village.attractionGuide = {
  ...village.attractionGuide,
  headline: 'Stand inside one of modern Scottish art’s defining coastal landscapes',
  intro:
    'Walk carefully from South Row towards the harbour and compare the cliff, pier, rocks and weather with Eardley’s Catterline works. This is a living residential village and working coastal edge, not an open-air museum.',
  parking:
    'Catterline is absent from the council’s current car-park directory, so no official capacity, tariff, accessible-bay count or payment method can be claimed. Use only clearly signed public parking and never obstruct residents, harbour access or emergency routes; the Creel Inn describes its own parking as very limited.',
  toilets:
    'Catterline is absent from the council’s current public-toilet and comfort-partnership directory. Do not rely on a public facility; customer toilets at the Creel Inn are for its patrons during opening hours.',
  food: [
    {
      name: creel.name,
      visitorScore: 82,
      summary:
        'Current pub, grill and takeaway with Indian dishes and pub favourites; the operator directly welcomes well-behaved dogs in the lounge.',
      openingTimes: 'Mon–Thu 4–10pm; Fri 4–11pm; Sat 2.30–11pm; Sun 2.30pm–midnight.',
      priceBand: '££',
      externalUrl: urls.creel,
    },
  ],
  trails: [
    {
      name: trail.name,
      summary:
        'A flexible village, South Row and harbour exploration rather than a formally waymarked circuit; turn back where cliff, tide, weather or livestock conditions make progress unsafe.',
      routeType: 'Short coastal village exploration',
      distance: 'Variable short circuit',
      duration: '45–90 minutes',
      difficulty: 'Uneven paths, steep slopes and exposed cliff edges.',
      externalUrl: urls.coastalTrail,
    },
  ],
};

creel.shortDescription =
  'A cliff-top pub, grill and takeaway serving Indian dishes and pub favourites; the operator directly welcomes well-behaved dogs in the lounge.';
creel.sourceRecords = [
  {
    sourceName: 'The Creel Inn & Grill',
    sourceOrganisation: 'The Creel Inn & Grill',
    sourceUrl: urls.creel,
    accessedAt: reviewedAt,
    licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
    reliability: 'official_non_statutory',
    notes:
      'Current-place curation: visitor_place_type=Eat; visit_score=82; food_score=82; price_band=££; cuisine=Indian dishes and pub favourites; opening_hours:description=Monday–Thursday 16:00–22:00, Friday 16:00–23:00, Saturday 14:30–23:00 and Sunday 14:30–00:00; dog_friendly=Operator welcomes well-behaved dogs in the lounge; description=Cliff-top pub and grill: Current evening and weekend food stop with a directly published lounge dog policy.',
  },
];
creel.visitorWebsiteUrl = urls.creel;
if (!creel.editorialReview) throw new Error('Catterline Creel Inn is missing its editorial review');
creel.editorialReview.evidenceUrls = [urls.creel, urls.creelContact];

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as {
  projects: Record<string, Record<string, string[]>>;
};
planner.projects[projectId] = {
  eat: [creel.id],
  trails: [trail.id],
  parking: [],
  toilets: [],
  picnic: [],
};
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as {
  reviewedAt: string;
  projects: Record<string, any>;
};
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    [village.id]: {
      rating: 2,
      status: 'restricted',
      label: 'Dog-suitable with cliff and harbour care',
      summary:
        'Dogs can accompany the outdoor village visit under close control. Use a lead beside cliff edges, livestock, the working harbour, roads and residential frontages.',
      sourceName: 'Scottish Outdoor Access Code dog-owner guidance',
      sourceUrl: urls.outdoorCode,
      reviewedAt: reviewedDate,
    },
    [trail.id]: {
      rating: 2,
      status: 'restricted',
      label: 'Coastal route needs a lead',
      summary:
        'The coastal setting is dog-suitable, but exposed cliffs, livestock, wildlife, narrow paths and harbour activity call for a lead and conservative route choices.',
      sourceName: 'Scottish Outdoor Access Code dog-owner guidance',
      sourceUrl: urls.outdoorCode,
      reviewedAt: reviewedDate,
    },
  },
  eat: {
    [creel.id]: {
      rating: 3,
      status: 'welcoming',
      label: 'Well-behaved dogs welcome in the lounge',
      summary:
        'The Creel Inn’s current operator site explicitly welcomes well-behaved dogs in the lounge area. This does not imply access to every dining area.',
      sourceName: 'The Creel Inn & Grill',
      sourceUrl: urls.creel,
      reviewedAt: reviewedDate,
    },
  },
};
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) {
  throw new Error(
    `Catterline audit introduced ${errors.length} validation error(s): ${errors
      .map((item) => item.message)
      .join('; ')}`,
  );
}
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const heritagePins = pkg.features.filter(
  (item) =>
    item.designationType ||
    item.sourceRecords.some((record) => record.sourceUrl?.includes('historicenvironment.scot')),
);
const undated = heritagePins.filter((item) => !item.documentedDateText?.trim());
await writeFile(
  resolve('data/review/catterline-full-visitor-audit-2026-08-27.json'),
  `${JSON.stringify(
    {
      reviewedAt,
      townScore: 68,
      townBand: 'Notable Stop',
      dogOwnerScore: 67,
      dogAccessRating: 2,
      publicationRule:
        'Town score measures Catterline itself. Publish only in-boundary visitor places scoring 60 or more; publish independent regional attractions separately.',
      attractions: [{ name: village.name, score: 74, dogRating: 2, published: true }],
      food: [{ name: creel.name, score: 82, dogRating: 3, published: true }],
      trails: [
        {
          name: trail.name,
          score: 69,
          dogRating: 2,
          distance: 'Variable short circuit',
          duration: '45–90 minutes',
          published: true,
        },
      ],
      facilities: { parking: [], toilets: [], picnic: [] },
      heritageDateAudit: {
        pins: heritagePins.length,
        dated: heritagePins.length - undated.length,
        undated: undated.map((item) => item.id),
      },
      exclusions: [
        'RSPB Fowlsheugh Nature Reserve belongs to Crawton and remains a separate See attraction; it does not increase Catterline’s town score.',
        'No dedicated Catterline Treasure Trails product appears in the current Aberdeenshire catalogue; Stonehaven products are not relabelled as Catterline trails.',
        'No council-listed Catterline car park: no capacity, tariff, accessible-bay count or payment method is invented.',
        'No Catterline public toilet or comfort-partnership facility appears in the current council directory.',
        'Old council asset-list references are not treated as evidence that a visitor toilet is currently open.',
      ],
      artwork: '/town-guides/catterline-bay-watercolour-guide-v1.png',
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `Catterline full audit complete: town 68, dog-owner 67; 1 attraction, 1 Eat, 1 trail, 0 car parks, 0 public toilets; ${heritagePins.length - undated.length}/${heritagePins.length} heritage pins dated.`,
);
