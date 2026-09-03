import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townScoreBand } from '../src/domain/tourism';

const reviewedAt = '2026-08-27';
const createdAt = `${reviewedAt}T18:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const methodVersion = '2026-08-27-settlement-vs-standalone-attraction-v2';

interface MinorSeed {
  id: string;
  name: string;
  centre: [number, number];
  score: number;
  rationale: string;
  requestedName?: string;
}

const cairnMinor: MinorSeed[] = [
  {
    id: 'clatterin-brig-scotland',
    name: "Clatterin' Brig",
    centre: [-2.5522763, 56.8937188],
    score: 22,
    requestedName: 'clattering bridge',
    rationale:
      'A bridge-side place-name and former roadside stop rather than a visitor settlement.',
  },
  {
    id: 'glensaugh-scotland',
    name: 'Glensaugh',
    centre: [-2.5358, 56.9208],
    score: 18,
    rationale:
      'A research estate and accommodation location without a public settlement experience.',
  },
  {
    id: 'bridge-of-dye-scotland',
    name: 'Bridge of Dye',
    centre: [-2.5739827, 56.9643221],
    score: 26,
    rationale:
      'A small rural hamlet and bridge location without enough settlement character or public visitor depth.',
  },
  {
    id: 'glendye-lodge-scotland',
    name: 'Glendye Lodge',
    centre: [-2.584753, 56.9656898],
    score: 15,
    rationale:
      'A private estate accommodation cluster rather than an independent visitor settlement.',
  },
  {
    id: 'greendams-scotland',
    name: 'Greendams',
    centre: [-2.566, 56.989],
    score: 12,
    rationale: 'A rural farm or place-name with no verified public settlement experience.',
  },
  {
    id: 'bridge-of-bogendreip-scotland',
    name: 'Bridge of Bogendreip',
    centre: [-2.5582562, 57.0086541],
    score: 22,
    rationale: 'A historic bridge location rather than a visitor settlement.',
  },
  {
    id: 'whitestone-feughside-scotland',
    name: 'Whitestone, Feughside',
    centre: [-2.5205, 57.0305],
    score: 18,
    requestedName: 'Whitestone',
    rationale: 'A scattered rural locality without a coherent public visitor offer.',
  },
  {
    id: 'deebank-scotland',
    name: 'Deebank',
    centre: [-2.4982306, 57.0465264],
    score: 18,
    rationale:
      'A residential grouping within Banchory’s wider settlement context, not a separate visitor destination.',
  },
  {
    id: 'bridge-of-dee-banchory-scotland',
    name: 'Bridge of Dee, Banchory area',
    centre: [-2.5005073, 57.047666],
    score: 15,
    requestedName: 'Bridge of Dee',
    rationale:
      'A bridge-side locality in Banchory’s context rather than an independent visitor settlement.',
  },
];

const coastMinor: MinorSeed[] = [
  {
    id: 'redcloak-house-scotland',
    name: 'Redcloak House',
    centre: [-2.2308, 56.9748],
    score: 18,
    requestedName: 'Redcloack house',
    rationale: 'A private residential locality without a verified public settlement experience.',
  },
  {
    id: 'dunnottar-scotland',
    name: 'Dunnottar',
    centre: [-2.213, 56.948],
    score: 28,
    requestedName: 'Dunnattar',
    rationale:
      'The hamlet has no independent visitor offer; Dunnottar Castle is published separately under See.',
  },
  {
    id: 'mill-of-uras-scotland',
    name: 'Mill of Uras',
    centre: [-2.2183855, 56.9124054],
    score: 18,
    rationale: 'A residential and agricultural hamlet without a public visitor experience.',
  },
  {
    id: 'midtown-of-barras-scotland',
    name: 'Midtown of Barras',
    centre: [-2.242, 56.9005],
    score: 16,
    rationale: 'A scattered agricultural locality without a coherent visitor offer.',
  },
  {
    id: 'slains-park-scotland',
    name: 'Slains Park',
    centre: [-2.2564767, 56.8793311],
    score: 18,
    rationale: 'A farm and road-end locality rather than a visitor settlement.',
  },
  {
    id: 'fawsyde-scotland',
    name: 'Fawsyde',
    centre: [-2.2537492, 56.8854521],
    score: 18,
    rationale: 'A private house and farm locality without verified general public access.',
  },
  {
    id: 'roadside-of-kinneff-scotland',
    name: 'Roadside of Kinneff',
    centre: [-2.2569549, 56.8812],
    score: 24,
    rationale:
      'A small linear residential settlement with no current attraction cluster of its own.',
  },
  {
    id: 'mill-of-mowtie-scotland',
    name: 'Mill of Mowtie',
    centre: [-2.2679023, 56.9912952],
    score: 16,
    requestedName: 'Mowtie',
    rationale: 'A rural hamlet without a verified public visitor offer.',
  },
];

function circle(centre: [number, number], radius = 350): Feature<Polygon> {
  return buffer(point(centre), radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function dogScore(score: number): number {
  return Math.max(0, score - 1);
}

function minorPackage(seed: MinorSeed): ProjectPackage {
  const boundary = circle(seed.centre);
  const band = townScoreBand(seed.score);
  return {
    project: {
      id: seed.id,
      name: seed.name,
      countryCode: 'GB-SCT',
      country: 'Scotland',
      region: 'Aberdeenshire',
      locality: seed.name,
      centre: seed.centre,
      boundary,
      boundarySource:
        'OpenStreetMap locality position with a conservative 350m editorial study buffer',
      boundaryConfidence: 'low',
      sourceLanguage: 'English',
      preferredBasemap: 'maplibre-streets',
      createdAt,
      methodology: defaultMethodology,
      researchNotes:
        'Retained in the regional catalogue for completeness. Its score measures the settlement itself and excludes nearby or private attractions.',
      touristAppeal: {
        score: seed.score,
        dogOwnerScore: dogScore(seed.score),
        dogAccessScoreAdjustment: -1,
        rating: band.rating,
        label: band.label,
        summary: seed.rationale,
        dogAccessRating: 1 as TouristAppealRating,
        dogAccessSummary:
          'No destination-scale dog visit is verified; normal responsible access applies on public routes.',
        methodVersion,
        reviewedAt,
        sourceUrls: [osmCopyright],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: 'Recorded rural locality',
        headline: 'A mapped locality rather than a tourist destination',
        intro: seed.rationale,
        bestFor: ['Regional reference'],
        perfectFor: ['Identifying the locality while planning a wider route'],
        suggestedTime: 'Pass-through or local-purpose visit',
        visitorMood:
          'Kept in the selector for completeness, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: [osmCopyright],
        lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name,
        sourceName: 'OpenStreetMap locality position with editorial buffer',
        sourceUrl: osmCopyright,
        sourceVersion: reviewedAt,
        bufferMetres: 350,
        localityBoundary: boundary,
        bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary.',
      },
    },
    features: [],
    sources: [
      {
        id: `${seed.id}-locality`,
        name: `${seed.name} locality reference`,
        organisation: 'OpenStreetMap contributors',
        coverage: seed.name,
        accessMethod: 'Mapped locality reference and editorial review',
        sourceUrl: osmCopyright,
        licence: 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.',
        reliability: 'discovery_only',
        limitations: 'Establishes location, not visitor value or public access.',
      },
    ],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };
}

async function load(slug: string): Promise<ProjectPackage> {
  return JSON.parse(
    await readFile(resolve(`data/projects/${slug}.json`), 'utf8'),
  ) as ProjectPackage;
}

async function save(pkg: ProjectPackage): Promise<void> {
  await writeFile(
    resolve(`data/projects/${pkg.project.id.replace(/-scotland$/, '')}.json`),
    `${JSON.stringify(pkg, null, 2)}\n`,
    'utf8',
  );
}

function setTownScore(pkg: ProjectPackage, score: number, summary: string): void {
  const band = townScoreBand(score);
  const current = pkg.project.touristAppeal;
  if (!current) throw new Error(`${pkg.project.id} has no tourist appeal record`);
  pkg.project.touristAppeal = {
    ...current,
    score,
    dogOwnerScore: dogScore(score),
    dogAccessScoreAdjustment: -1,
    rating: band.rating,
    label: band.label,
    summary,
    methodVersion,
    reviewedAt,
  };
}

function standalone(pkg: ProjectPackage, ids: string[]): void {
  const idSet = new Set(ids);
  for (const feature of pkg.features) {
    if (!idSet.has(feature.id)) continue;
    feature.tags = [...new Set([...feature.tags, 'home-standalone-place', 'current-context'])];
    feature.evidenceScope = 'related_context';
    feature.homeMapEligible = true;
  }
  pkg.project.visitorHighlights = (pkg.project.visitorHighlights ?? []).filter(
    (item) => !idSet.has(item.featureId),
  );
  if (pkg.project.townGuide) {
    pkg.project.townGuide.dontMiss = (pkg.project.townGuide.dontMiss ?? []).filter(
      (name) => !pkg.features.some((feature) => idSet.has(feature.id) && feature.name === name),
    );
  }
}

function completeStandalone(
  pkg: ProjectPackage,
  id: string,
  details: {
    score: number;
    tagline: string;
    reason: string;
    time: string;
    opening: string;
    admission: string;
  },
): void {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing standalone feature ${id}`);
  const sourceUrl = feature.visitorWebsiteUrl ?? feature.sourceRecords[0]?.sourceUrl;
  if (!sourceUrl) throw new Error(`Missing visitor source for ${id}`);
  feature.sourceRecords.push({
    sourceName: `${feature.name} standalone visitor contract`,
    sourceOrganisation: 'Townscape Guides editorial audit',
    sourceUrl,
    accessedAt: createdAt,
    licence: 'Source-linked editorial record; verify time-sensitive details before travel.',
    reliability: 'secondary',
    notes: `Current-place curation: visitor_place_type=Attraction; visit_score=${details.score}; time_to_spend=${details.time}; opening_hours:description=${details.opening}; entrance_fee=${details.admission}; description=${details.tagline}: ${details.reason}`,
  });
}

function minorGuide(pkg: ProjectPackage, headline: string, intro: string): void {
  if (!pkg.project.townGuide) return;
  pkg.project.townGuide.headline = headline;
  pkg.project.townGuide.intro = intro;
  pkg.project.townGuide.suggestedFirstVisit = undefined;
  pkg.project.townGuide.suggestedTime = 'Pass-through or attraction-specific visit';
  pkg.project.townGuide.visitorMood =
    'The locality remains selectable for reference, but its separate attractions do not make the settlement a 60+ tourist town.';
}

const fettercairn = await load('fettercairn');
setTownScore(
  fettercairn,
  67,
  'A handsome conservation village whose Royal Arch, historic core and useful centre justify a notable stop even when the distillery is scored separately.',
);
standalone(fettercairn, ['curated-attraction:fettercairn-distillery']);
completeStandalone(fettercairn, 'curated-attraction:fettercairn-distillery', {
  score: 84,
  tagline: 'Working whisky distillery',
  reason: 'Bookable tours and tastings explore a working distillery founded in 1824.',
  time: '1–2 hours',
  opening: 'Wednesday–Saturday 10:00–16:30 at review; booking advised',
  admission: 'Tours and tastings from £20 at review',
});
fettercairn.project.townGuide!.headline = 'A handsome Mearns village beyond its famous distillery';
fettercairn.project.townGuide!.intro =
  'The Royal Arch, market cross, traditional streets and coherent conservation area support a genuine village visit. Fettercairn Distillery remains separately discoverable under See and contributes no town points.';

const potarch = await load('potarch');
setTownScore(
  potarch,
  42,
  'A small roadside and riverside hamlet without sufficient settlement interest once its bridge, Dinnie Stones and recreation area are treated as separate attractions.',
);
standalone(potarch, [
  'curated-attraction:potarch-bridge-dinnie-stones',
  'curated-attraction:potarch-green',
]);
completeStandalone(potarch, 'curated-attraction:potarch-bridge-dinnie-stones', {
  score: 78,
  tagline: 'Dinnie Stones beside the Dee',
  reason:
    'The 1811–13 bridge and Donald Dinnie’s famous lifting stones form a distinctive open-air heritage stop.',
  time: '30–60 minutes',
  opening: 'Open-air site; visit in safe daylight conditions',
  admission: 'Free',
});
completeStandalone(potarch, 'curated-attraction:potarch-green', {
  score: 65,
  tagline: 'Riverside green and picnic stop',
  reason:
    'A practical recreation area beside the River Dee with picnic provision and route access.',
  time: '30–90 minutes',
  opening: 'Open-air site; visit in safe daylight conditions',
  admission: 'Free',
});
minorGuide(
  potarch,
  'A small hamlet beside independently worthwhile attractions',
  'Potarch remains in the regional selector, while the bridge, Dinnie Stones and riverside green are discovered separately under See.',
);

const strachan = await load('strachan');
setTownScore(
  strachan,
  44,
  'A quiet residential village whose main visitor reasons are a separate walking circuit and an appointment-only heritage centre.',
);
standalone(strachan, [
  'curated-attraction:strachan-scolty-circuit',
  'curated-attraction:strachan-heritage-centre',
]);
completeStandalone(strachan, 'curated-attraction:strachan-scolty-circuit', {
  score: 70,
  tagline: 'Village-to-Scolty walking circuit',
  reason:
    'A documented 6.75 km circuit climbs from Strachan Village Hall into the Scolty landscape.',
  time: 'About 3½ hours',
  opening: 'Outdoor route; check weather and current forestry conditions',
  admission: 'Free',
});
minorGuide(
  strachan,
  'A quiet Feughside village rather than a tourist destination',
  'The Scolty circuit and Clan Strachan centre remain independently discoverable, but they no longer inflate the settlement score.',
);

const stonehaven = await load('stonehaven');
const kirktown = await load('kirktown-of-fetteresso');
setTownScore(
  kirktown,
  32,
  'A small residential kirktown without a town-scale visitor offer; St Ciaran’s Old Church is a separate heritage attraction.',
);
standalone(kirktown, ['curated-attraction:kirktown-fetteresso-st-ciarans']);
completeStandalone(kirktown, 'curated-attraction:kirktown-fetteresso-st-ciarans', {
  score: 64,
  tagline: 'A documented 1246 churchyard',
  reason:
    'Surviving medieval lancets, doorway and memorial fabric make a focused open-air heritage visit.',
  time: '30–60 minutes',
  opening: 'Open-access churchyard at reasonable daylight hours; respect closures and services',
  admission: 'Free',
});
minorGuide(
  kirktown,
  'A residential kirktown with one separate heritage site',
  'St Ciaran’s Old Church remains under See, but the church alone does not make Kirktown of Fetteresso a tourist town.',
);

const catterline = await load('catterline');
setTownScore(
  catterline,
  68,
  'The harbour, South Row, compact fisher-village form and Joan Eardley landscape make the settlement itself worth seeing; food and trails support rather than create that interest.',
);

const crawton = await load('crawton');
setTownScore(
  crawton,
  24,
  'A tiny rural hamlet without an independent settlement experience; RSPB Fowlsheugh is a separate nature attraction reached from Crawton.',
);
standalone(crawton, ['curated-attraction:crawton-fowlsheugh']);
completeStandalone(crawton, 'curated-attraction:crawton-fowlsheugh', {
  score: 84,
  tagline: 'Cliffs alive with seabirds',
  reason: 'A free official trail overlooks more than 115,000 breeding seabirds in the peak season.',
  time: '1–2 hours',
  opening:
    'Open year-round in safe daylight conditions; breeding spectacle strongest May–early August',
  admission: 'Free',
});
minorGuide(
  crawton,
  'A tiny hamlet beside a nationally important nature reserve',
  'Crawton remains selectable for reference. RSPB Fowlsheugh appears separately under See and no longer creates a town rating.',
);

for (const pkg of [fettercairn, potarch, strachan, stonehaven, kirktown, catterline, crawton])
  await save(pkg);
for (const seed of [...cairnMinor, ...coastMinor]) await save(minorPackage(seed));

const cairnResults = [
  {
    requestedName: 'Fettercairn',
    resolvedName: 'Fettercairn',
    score: 67,
    mapPublished: true,
    rationale: fettercairn.project.touristAppeal!.summary,
    standaloneAttractions: ['Fettercairn Distillery'],
  },
  {
    requestedName: 'Potarch',
    resolvedName: 'Potarch',
    score: 42,
    mapPublished: false,
    rationale: potarch.project.touristAppeal!.summary,
    standaloneAttractions: ['Potarch Bridge and Dinnie Stones', 'Potarch Green and River Dee'],
  },
  {
    requestedName: 'Strachan',
    resolvedName: 'Strachan',
    score: 44,
    mapPublished: false,
    rationale: strachan.project.touristAppeal!.summary,
    standaloneAttractions: ['Strachan–Scolty Hill Circuit'],
    deferredAttractions: [
      'Clan Strachan Centre for Heritage: appointment-only record lacks clear current admission terms',
    ],
  },
  ...cairnMinor.map((seed) => ({
    requestedName: seed.requestedName ?? seed.name,
    resolvedName: seed.name,
    score: seed.score,
    mapPublished: false,
    rationale: seed.rationale,
    standaloneAttractions: [],
  })),
];
const coastResults = [
  ...coastMinor
    .slice(0, 1)
    .map((seed) => ({
      requestedName: seed.requestedName ?? seed.name,
      normalisedName: seed.name,
      score: seed.score,
      mapPublished: false,
      rationale: seed.rationale,
      standaloneAttractions: [],
    })),
  {
    requestedName: 'Stonehaven',
    normalisedName: 'Stonehaven',
    score: 88,
    mapPublished: true,
    rationale: stonehaven.project.touristAppeal!.summary,
    standaloneAttractions: ['Dunnottar Castle'],
  },
  {
    requestedName: 'Kirktown of fetteresso',
    normalisedName: 'Kirktown of Fetteresso',
    score: 32,
    mapPublished: false,
    rationale: kirktown.project.touristAppeal!.summary,
    standaloneAttractions: ['St Ciaran’s Old Church and Churchyard'],
  },
  ...coastMinor
    .slice(1, 4)
    .map((seed) => ({
      requestedName: seed.requestedName ?? seed.name,
      normalisedName: seed.name,
      score: seed.score,
      mapPublished: false,
      rationale: seed.rationale,
      standaloneAttractions: seed.id === 'dunnottar-scotland' ? ['Dunnottar Castle'] : [],
    })),
  {
    requestedName: 'Vaterline',
    normalisedName: 'Catterline',
    score: 68,
    mapPublished: true,
    rationale: catterline.project.touristAppeal!.summary,
    standaloneAttractions: [],
  },
  {
    requestedName: 'Crawton',
    normalisedName: 'Crawton',
    score: 24,
    mapPublished: false,
    rationale: crawton.project.touristAppeal!.summary,
    standaloneAttractions: ['RSPB Fowlsheugh Nature Reserve'],
  },
  ...coastMinor
    .slice(4)
    .map((seed) => ({
      requestedName: seed.requestedName ?? seed.name,
      normalisedName: seed.name,
      score: seed.score,
      mapPublished: false,
      rationale: seed.rationale,
      standaloneAttractions: [],
    })),
];

await writeFile(
  resolve('data/review/cairn-o-mount-deeside-town-assessment-2026-08-27.json'),
  `${JSON.stringify({ schemaVersion: 2, reviewedAt, rule: 'All reviewed localities remain in the Aberdeenshire selector with a score; only settlement scores of 60 or more appear as towns on Home. Standalone attractions never raise the settlement score.', assessments: cairnResults }, null, 2)}\n`,
  'utf8',
);
await writeFile(
  resolve('data/review/stonehaven-coast-12-settlement-gate-audit-2026-08-27.json'),
  `${JSON.stringify({ schemaVersion: 2, reviewedAt, methodVersion, rule: 'All reviewed localities remain in the Aberdeenshire selector with a score; only settlement scores of 60 or more appear as towns on Home. Standalone attractions remain under See.', threshold: 60, results: coastResults }, null, 2)}\n`,
  'utf8',
);

console.log(
  'Reclassified 24 Aberdeenshire localities: 3 town-map entries and 21 selector-only entries; standalone attractions preserved under See.',
);
