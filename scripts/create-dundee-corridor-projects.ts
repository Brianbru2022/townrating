import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import {
  townDogAccessScoreAdjustment,
  townScoreAfterDogAccess,
  townScoreBand,
} from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-09-01';
const createdAt = `${reviewedAt}T12:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'relation', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  stem: string;
  id: string;
  name: string;
  region: 'Angus' | 'Dundee City';
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  rationale: string;
  sourceUrl: string;
  boundarySource?: string;
}

// Newbigging and Bucklerheads already have stable catalogue IDs and are deliberately
// not regenerated here. Their preliminary packages are upgraded by the audit script.
const seeds: Seed[] = [
  {
    stem: 'tealing', id: 'tealing-scotland', name: 'Tealing', region: 'Angus',
    centre: [-2.959138, 56.5331528], radius: 1_100, score: 56, dogRating: 2,
    character: 'Sidlaw-foot village with nationally important ancient monuments',
    rationale: 'The village and its two HES-managed monuments are assessed together, without borrowing Dundee or nearby country parks.',
    sourceUrl: osm('node', 1294994574),
  },
  {
    stem: 'kirkton-dundee', id: 'kirkton-dundee-scotland', name: 'Kirkton', region: 'Dundee City',
    centre: [-2.9829432, 56.4868699], radius: 800, score: 34, dogRating: 1,
    character: 'Residential north-Dundee district',
    rationale: 'This is Kirkton in Dundee, not another Scottish Kirkton. City-centre and neighbouring park value is excluded.',
    sourceUrl: osm('node', 1404498750),
  },
  {
    stem: 'muir-of-pert-tealing', id: 'muir-of-pert-tealing-scotland', name: 'Muir of Pert', region: 'Angus',
    centre: [-2.97001, 56.52277], radius: 650, score: 18, dogRating: 0,
    character: 'Former Tealing airfield and agricultural locality',
    rationale: 'This resolves to Muir of Pert by Tealing, centred on the former airfield/piggery complex, not the unrelated Logie Pert forest.',
    sourceUrl: 'https://www.trove.scot/site/94183',
    boundarySource: 'HES NRHE Tealing Airfield/Muir of Pert point with a conservative editorial buffer',
  },
  {
    stem: 'inveraldie', id: 'inveraldie-scotland', name: 'Inveraldie', region: 'Angus',
    centre: [-2.9466279, 56.5216466], radius: 650, score: 26, dogRating: 1,
    character: 'Small Tealing-area village and community-hall locality',
    rationale: 'Tealing Earth House and Dovecot are not transferred into Inveraldie.',
    sourceUrl: osm('node', 1295225993),
  },
  {
    stem: 'burnside-of-duntrune', id: 'burnside-of-duntrune-scotland', name: 'Burnside of Duntrune', region: 'Angus',
    centre: [-2.9111501, 56.5024946], radius: 650, score: 26, dogRating: 1,
    character: 'Small rural settlement on Dundee’s north-eastern edge',
    rationale: 'The public community garden is retained as its own See place, but nearby Dundee attractions and services do not inflate the settlement.',
    sourceUrl: osm('node', 5000008612),
  },
  {
    stem: 'fintry-dundee', id: 'fintry-dundee-scotland', name: 'Fintry', region: 'Dundee City',
    centre: [-2.9395177, 56.490483], radius: 1_000, score: 48, dogRating: 2,
    character: 'North-east Dundee district beside Finlathen Park and the Dighty',
    rationale: 'Finlathen Park and the Fintry walk are published independently; they do not turn a residential district into a tourist town.',
    sourceUrl: osm('node', 241070781),
  },
  {
    stem: 'douglas-and-angus-dundee', id: 'douglas-and-angus-dundee-scotland', name: 'Douglas and Angus', region: 'Dundee City',
    centre: [-2.905211, 56.4788786], radius: 850, score: 32, dogRating: 1,
    character: 'Residential eastern-Dundee district',
    rationale: 'Claypotts Castle and Broughty Ferry lie beyond this strict district study area and are not borrowed.',
    sourceUrl: osm('node', 1403704102),
  },
  {
    stem: 'craigie-dundee', id: 'craigie-dundee-scotland', name: 'Craigie', region: 'Dundee City',
    centre: [-2.9171198, 56.4731991], radius: 800, score: 32, dogRating: 1,
    character: 'Residential east-Dundee district',
    rationale: 'Baxter Park, the city centre and Broughty Ferry are outside this district boundary and are not transferred into its score.',
    sourceUrl: osm('node', 11577380287),
  },
  {
    stem: 'stannergate-dundee', id: 'stannergate-dundee-scotland', name: 'Stannergate', region: 'Dundee City',
    centre: [-2.9131047, 56.4681668], radius: 650, score: 28, dogRating: 1,
    character: 'Tay-side residential and industrial Dundee locality',
    rationale: 'The waterfront route context is recorded without borrowing central Dundee or Broughty Ferry attractions.',
    sourceUrl: osm('node', 10002892200),
  },
  {
    stem: 'dundee', id: 'dundee-scotland', name: 'Dundee', region: 'Dundee City',
    centre: [-2.97019, 56.4605938], radius: 2_150, score: 93, dogRating: 1,
    character: 'Compact design city, maritime destination and industrial-heritage centre',
    rationale: 'The editorial city-core boundary includes the waterfront, centre, Law and West End museum quarter while excluding separately catalogued Broughty Ferry, Craigie, Fintry, Douglas, Kirkton and Stannergate.',
    sourceUrl: osm('node', 21262495),
    boundarySource: 'OpenStreetMap Dundee city-centre position with an explicit editorial city-core buffer excluding separately catalogued districts',
  },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id,
      name: seed.name,
      countryCode: 'GB-SCT',
      country: 'Scotland',
      region: seed.region,
      locality: seed.name,
      centre: seed.centre,
      boundary,
      boundarySource: seed.boundarySource ?? 'OpenStreetMap named-place position with a conservative strict editorial study buffer',
      boundaryConfidence: 'high',
      sourceLanguage: 'English',
      preferredBasemap: 'voyager',
      createdAt,
      methodology: defaultMethodology,
      researchNotes: 'Project created for the 2026-09-01 full sequential audit. Only records inside the strict locality study boundary may be assigned.',
      touristAppeal: {
        score: seed.score,
        dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating),
        dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating,
        label: band.label,
        summary: seed.rationale,
        dogAccessRating: seed.dogRating,
        dogAccessSummary: 'Dog suitability is assessed separately from general tourist appeal.',
        methodVersion: '2026-09-01-full-settlement-visitor-audit-v1',
        reviewedAt,
        sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character,
        headline: seed.score >= 60 ? 'A fully audited visitor destination' : 'A fully audited regional reference',
        intro: seed.rationale,
        bestFor: seed.score >= 60 ? ['A planned visitor day'] : ['Regional orientation'],
        perfectFor: seed.score >= 60 ? ['Building a destination visit from verified places'] : ['Understanding what is and is not independently visitable'],
        dontMiss: [],
        suggestedTime: seed.score >= 60 ? 'Half day to full day' : 'Pass-through or a specific verified place only',
        visitorMood: seed.score >= 60 ? 'Published on the town map.' : 'Selector-only below the 60-point town-map threshold.',
        sourceUrls: [seed.sourceUrl],
        lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name,
        sourceName: seed.boundarySource ?? 'OpenStreetMap named-place position',
        sourceUrl: seed.sourceUrl,
        sourceVersion: reviewedAt,
        bufferMetres: seed.radius,
        localityBoundary: boundary,
        bufferedBoundary: boundary,
        notes: 'Strict editorial visitor study area, not an administrative boundary. Nearby attraction value is excluded.',
      },
    },
    features: [],
    sources: [{
      id: `${seed.id}-locality`,
      name: `${seed.name} locality identity and boundary`,
      organisation: seed.sourceUrl.includes('trove.scot') ? 'Historic Environment Scotland' : 'OpenStreetMap contributors',
      coverage: seed.name,
      accessMethod: 'Named-place identity and boundary-aware editorial review',
      sourceUrl: seed.sourceUrl,
      licence: seed.sourceUrl.includes('openstreetmap.org') ? 'OpenStreetMap ODbL; retain attribution.' : 'Source-linked evidence; retain publisher attribution.',
      reliability: seed.sourceUrl.includes('trove.scot') ? 'official_non_statutory' : 'secondary',
      limitations: 'The boundary is an editorial visitor study area, not an administrative claim.',
    }],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

for (const seed of seeds) {
  const pkg = packageFor(seed);
  await writeFile(resolve('data/projects', `${seed.stem}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

console.log(`Created ${seeds.length} strict-boundary Dundee corridor project packages.`);
