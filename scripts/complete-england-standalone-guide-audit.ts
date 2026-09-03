import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { AttractionGuideFoodOption, AttractionGuideTrail, ProjectPackage } from '../src/domain/models';

const reviewedAt = '2026-08-09T00:00:00Z';
const projectsDirectory = resolve('data/projects');
const reportPath = resolve('data/review/england-standalone-guide-audit-2026-08-09.json');

interface GuideCompletion {
  trails: AttractionGuideTrail[];
  food: AttractionGuideFoodOption[];
  sources: string[];
  note: string;
}

const completions: Record<string, GuideCompletion> = {
  'standalone-attraction:deene-park': {
    trails: [],
    food: [],
    sources: ['https://www.deenepark.com/home/the-estate/public-access'],
    note: 'Estate rights of way were reviewed, but no permanent named attraction trail is promoted; the separately curated Old Kitchen Tearoom remains the on-site food entry.',
  },
  'standalone-attraction:kirby-hall': {
    trails: [
      {
        name: 'Tapestry Trail',
        routeType: 'Family discovery trail',
        duration: 'About 45-60 minutes',
        difficulty: 'Easy',
        summary: 'A family trail through the house, romantic roofless ranges and restored gardens.',
        externalUrl: 'https://www.english-heritage.org.uk/visit/places/kirby-hall/',
      },
      {
        name: 'Folktale Creature Trail',
        routeType: 'Seasonal family trail',
        duration: 'About 45-60 minutes',
        difficulty: 'Easy',
        summary: 'A seasonal creature-finding trail around the historic house and grounds.',
        externalUrl: 'https://www.english-heritage.org.uk/visit/places/kirby-hall/',
      },
    ],
    food: [
      {
        name: 'Kirby Hall drinks and snacks',
        visitorScore: 45,
        summary: 'Hot and cold drinks, snacks and ice cream from vending provision rather than a full cafe.',
        priceBand: '£',
        externalUrl: 'https://www.english-heritage.org.uk/visit/places/kirby-hall/plan-your-visit/facilities/',
      },
    ],
    sources: [
      'https://www.english-heritage.org.uk/visit/places/kirby-hall/',
      'https://www.english-heritage.org.uk/visit/places/kirby-hall/plan-your-visit/facilities/',
    ],
    note: 'English Heritage confirms family trails and vending-only refreshments.',
  },
  'standalone-attraction:rockingham-castle': {
    trails: [
      {
        name: "Wentworth's Eye Spy",
        routeType: 'Family castle trail',
        duration: 'About 45-60 minutes',
        difficulty: 'Easy',
        summary: 'A family observation trail around the castle and its historic details.',
        externalUrl: 'https://rockinghamcastle.com/whatstoseeanddo/',
      },
      {
        name: 'Wild Garden wellbeing walks',
        routeType: 'Garden walking routes',
        duration: '20-45 minutes',
        difficulty: 'Easy to moderate',
        summary: 'Short routes through the Wild Garden, complementing the formal terraces and castle tour.',
        externalUrl: 'https://rockinghamcastle.com/whatstoseeanddo/',
      },
    ],
    food: [],
    sources: ['https://rockinghamcastle.com/whatstoseeanddo/'],
    note: "The official visitor page confirms Wentworth's Eye Spy, garden trails and Wild Garden wellbeing routes; the existing Walker's House Tea Room remains the food entry.",
  },
  'standalone-attraction:geddington-eleanor-cross': {
    trails: [],
    food: [],
    sources: ['https://www.english-heritage.org.uk/visit/places/eleanor-cross-geddington/'],
    note: 'The roadside monument has no formal attraction trail or on-site food provision.',
  },
  'standalone-attraction:rushton-triangular-lodge': {
    trails: [],
    food: [],
    sources: [
      'https://www.english-heritage.org.uk/visit/places/rushton-triangular-lodge/',
      'https://www.english-heritage.org.uk/visit/places/rushton-triangular-lodge/facilities/',
    ],
    note: 'English Heritage confirms a compact monument visit without a named trail or on-site refreshments.',
  },
  'standalone-attraction:cottesbrooke-hall-and-gardens': {
    trails: [],
    food: [],
    sources: ['https://www.cottesbrooke.co.uk/visit-us/'],
    note: 'No separate named public trail is promoted; the existing garden visit and Old Laundry Tearoom entries remain authoritative.',
  },
  'standalone-attraction:lamport-hall': {
    trails: [],
    food: [],
    sources: [
      'https://www.lamporthall.co.uk/plan-your-visit/opening-times-and-admission/',
      'https://www.lamporthall.co.uk/plan-your-visit/tearoom/',
    ],
    note: 'No separate named trail is promoted; the existing Hall, gardens and Stables Cafe entries remain authoritative.',
  },
  'standalone-attraction:stoke-park-pavilions': {
    trails: [],
    food: [],
    sources: ['https://www.stokeparkpavilions.co.uk/public-viewing'],
    note: 'The operator explicitly says entertainment and catering are not provided on public viewing days.',
  },
  'standalone-attraction:burrough-hill-country-park': {
    trails: [
      {
        name: 'Hillfort and country-park paths',
        routeType: 'Country-park walking network',
        duration: '45-90 minutes',
        difficulty: 'Moderate',
        summary: 'A choice of grassland paths around the Iron Age ramparts, with a link to the Leicestershire Round.',
        externalUrl: 'https://leicscountryparks.org.uk/parks/burrough-hill-country-park/',
      },
    ],
    food: [],
    sources: ['https://leicscountryparks.org.uk/parks/burrough-hill-country-park/'],
    note: 'The council confirms varied paths and a Leicestershire Round link, but no on-site cafe.',
  },
  'standalone-attraction:barnsdale-gardens': {
    trails: [
      {
        name: 'Woodland Walk',
        routeType: 'Garden and woodland walk',
        duration: 'About 20-30 minutes',
        difficulty: 'Easy',
        summary: 'A quieter wooded extension to the sequence of 38 garden rooms.',
        externalUrl: 'https://barnsdalegardens.co.uk/the-gardens.html',
      },
    ],
    food: [],
    sources: [
      'https://www.barnsdalegardens.co.uk/',
      'https://barnsdalegardens.co.uk/the-gardens.html',
    ],
    note: 'The official gardens information confirms the Woodland Walk; the existing Helenium Tea Room remains the food entry.',
  },
  'standalone-attraction:rutland-wildlife-sanctuary': {
    trails: [
      {
        name: 'Woodland Walk',
        routeType: 'Sanctuary woodland walk',
        duration: 'About 20-40 minutes',
        difficulty: 'Easy',
        summary: 'A quiet woodland extension to the bird-of-prey aviaries and booked experiences.',
        externalUrl: 'https://www.rutlandwildlifesanctuary.co.uk/',
      },
    ],
    food: [],
    sources: ['https://www.rutlandwildlifesanctuary.co.uk/'],
    note: 'The sanctuary confirms its Woodland Walk; no dependable on-site cafe is published.',
  },
  'standalone-attraction:stevington-windmill': {
    trails: [],
    food: [],
    sources: ['https://www.centralbedfordshire.gov.uk/info/202/school_holiday_activities/1472/stevington_windmill'],
    note: 'The council promotes free exterior viewing without on-site food; the existing village-walk entry remains the trail review.',
  },
  'standalone-attraction:bedford-purlieus': {
    trails: [],
    food: [],
    sources: ['https://www.gov.uk/government/publications/cambridgeshires-national-nature-reserves/cambridgeshires-national-nature-reserves'],
    note: 'Natural England confirms the woodland reserve, but no formal named visitor trail or on-site food provision was found.',
  },
  'standalone-attraction:elton-hall': {
    trails: [
      {
        name: 'Elton Hall and garden visitor route',
        routeType: 'House-and-garden walk',
        duration: 'About 45-75 minutes',
        difficulty: 'Easy',
        summary: 'The 300-metre tree-lined approach continues through a garden circuit that takes about 45 minutes.',
        externalUrl: 'https://eltonhall.com/visitor-info/',
      },
    ],
    food: [
      {
        name: 'The Mulberry Cafe',
        visitorScore: 72,
        summary: 'Daytime cafe beside the visitor approach in the adjacent walled-garden garden centre.',
        openingTimes: 'Daily 09:00-16:30; confirm seasonal changes before travelling',
        priceBand: '££',
        externalUrl: 'https://eltonhall.com/visitor-info/',
      },
    ],
    sources: ['https://eltonhall.com/visitor-info/'],
    note: 'The official visitor page confirms the approach walk, garden visit and adjacent Mulberry Cafe.',
  },
  'standalone-attraction:fotheringhay-castle-site': {
    trails: [],
    food: [],
    sources: ['https://discover-northamptonshire.co.uk/wp-content/uploads/2025/07/Fotheringhay-Woodnewton-White.pdf'],
    note: 'No on-site food is provided; the existing Fotheringhay to Woodnewton route remains the trail review.',
  },
  'standalone-attraction:southwick-hall': {
    trails: [],
    food: [],
    sources: [
      'https://www.southwickhall.co.uk/visit/',
      'https://www.southwickhall.co.uk/grounds/',
    ],
    note: 'The grounds are part of selected open days, but no permanent named trail or dependable cafe is offered.',
  },
  'standalone-attraction:barnack-hills-and-holes': {
    trails: [
      {
        name: 'Limestone Trail',
        routeType: 'Waymarked nature trail',
        distance: '1.5 km / 0.9 miles',
        duration: 'About 30 minutes',
        difficulty: 'Easy to moderate',
        summary: 'A waymarked circuit through the quarry ridges, limestone hollows and flower-rich grassland.',
        externalUrl: 'https://publications.naturalengland.org.uk/file/5918422786113536',
      },
    ],
    food: [],
    sources: [
      'https://publications.naturalengland.org.uk/file/5918422786113536',
      'https://publications.naturalengland.org.uk/publication/6508585115451392',
    ],
    note: 'Natural England confirms the Limestone Trail and no on-site visitor facilities.',
  },
  'standalone-attraction:castor-hanglands': {
    trails: [],
    food: [],
    sources: ['https://www.gov.uk/government/publications/cambridgeshires-national-nature-reserves/cambridgeshires-national-nature-reserves'],
    note: 'No on-site food is provided; the existing John Clare route remains the trail review.',
  },
  'standalone-attraction:crown-lakes-country-park': {
    trails: [],
    food: [],
    sources: ['https://haypeterborough.co.uk/activities/crown-lakes-country-park/'],
    note: 'The park has walking and cycling tracks but no on-site cafe; the existing Crown Lakes walk remains the trail review.',
  },
  'standalone-attraction:holme-fen': {
    trails: [],
    food: [],
    sources: ['https://www.greatfen.org.uk/explore/walks-trails/trail-guides'],
    note: 'No on-site food is provided; the existing Lost Lake trail remains the trail review.',
  },
  'standalone-attraction:woodwalton-fen': {
    trails: [],
    food: [],
    sources: ['https://www.greatfen.org.uk/explore/walks-trails/trail-guides'],
    note: 'No on-site food is provided; the three existing Great Fen routes remain the trail review.',
  },
  'standalone-attraction:upwood-meadows': {
    trails: [],
    food: [],
    sources: ['https://www.wildlifebcn.org/nature-reserves/upwood-meadows'],
    note: 'The reserve is a path-based meadow visit without a formal named trail or on-site food.',
  },
  'standalone-attraction:monks-wood': {
    trails: [],
    food: [],
    sources: ['https://www.gov.uk/government/publications/cambridgeshires-national-nature-reserves/cambridgeshires-national-nature-reserves'],
    note: 'The reserve has established woodland paths but no formal named visitor trail or on-site food.',
  },
  'standalone-attraction:hamerton-zoo-park': {
    trails: [
      {
        name: 'Hamerton Zoo Picture Trail',
        routeType: 'Family wildlife trail',
        duration: 'About 60-90 minutes',
        difficulty: 'Easy',
        summary: 'A printable family trail using pictures and clues around the zoo collection.',
        externalUrl: 'https://hamertonzoopark.com/wp-content/uploads/2025/07/PICTURE-TRAIL.pdf',
      },
    ],
    food: [],
    sources: [
      'https://hamertonzoopark.com/wp-content/uploads/2025/07/PICTURE-TRAIL.pdf',
      'https://hamertonzoopark.com/whats-here/',
    ],
    note: 'The operator confirms the Picture Trail; the existing coffee-shop entry remains the food review.',
  },
  'standalone-attraction:lyddington-bede-house': {
    trails: [],
    food: [],
    sources: ['https://www.english-heritage.org.uk/visit/places/lyddington-bede-house/'],
    note: 'English Heritage confirms no on-site food; the existing village-and-fishponds walk remains the trail review.',
  },
};

const entries = await readdir(projectsDirectory, { withFileTypes: true });
const report: Array<{ projectId: string; featureId: string; name: string; trails: number; food: number; sources: string[] }> = [];
const completed = new Set<string>();

for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
  const filePath = resolve(projectsDirectory, entry.name);
  const pkg = JSON.parse(await readFile(filePath, 'utf8')) as ProjectPackage;
  if (pkg.project.countryCode !== 'GB-ENG') continue;
  let changed = false;
  for (const feature of pkg.features) {
    const completion = completions[feature.id];
    if (!completion || !feature.attractionGuide) continue;
    completed.add(feature.id);
    if (!feature.attractionGuide.trails) feature.attractionGuide.trails = completion.trails;
    if (!feature.attractionGuide.food) feature.attractionGuide.food = completion.food;
    feature.updatedAt = reviewedAt;
    feature.reviewed = true;
    feature.reviewNotes = [
      feature.reviewNotes,
      `${completion.note} Standalone visitor facilities and trails reviewed ${reviewedAt.slice(0, 10)}.`,
    ].filter(Boolean).join(' ');
    changed = true;
    report.push({
      projectId: pkg.project.id,
      featureId: feature.id,
      name: feature.name,
      trails: feature.attractionGuide.trails.length,
      food: feature.attractionGuide.food.length,
      sources: completion.sources,
    });
  }
  if (changed) {
    await writeFile(filePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    console.log(`Updated ${basename(filePath)}`);
  }
}

const missing = Object.keys(completions).filter((featureId) => !completed.has(featureId));
if (missing.length) throw new Error(`Could not find standalone features: ${missing.join(', ')}`);
await writeFile(reportPath, `${JSON.stringify({ reviewedAt, records: report }, null, 2)}\n`, 'utf8');
console.log(`Completed ${report.length} standalone guide reviews.`);
