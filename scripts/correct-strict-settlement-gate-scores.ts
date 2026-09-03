import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage } from '../src/domain/models';
import { townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-30';
const flawedMethod = '2026-08-30-strict-settlement-gate-v1';
const correctedMethod = '2026-08-30-evidence-informed-settlement-score-v2';

interface Override {
  score: number;
  rationale: string;
  sources?: string[];
}

// Only settlement-level merit is scored here. A nearby attraction can be
// published under See, but cannot promote a locality which is otherwise not a
// worthwhile stop. These overrides remove the former artificial 58 ceiling.
const overrides: Record<string, Override> = {
  'arbroath-scotland': { score: 86, rationale: 'A strong independent coastal destination with a nationally important abbey, working harbour and Smokie identity, Signal Tower Museum, historic centre, beaches, cliff and heritage trails, rail access and substantial daytime visitor provision.', sources: ['https://visitangus.com/plan-your-trip/explore-our-towns/arbroath/', 'https://visitangus.com/get-inspired/itineraries/discover-the-best-things-to-do-in-arbroath/', 'https://visitangus.com/get-inspired/heritage-trails/arbroath-heritage-trail/'] },
  'montrose-scotland': { score: 83, rationale: 'A strong independent destination with a historic town centre, museum, beach, major aviation museum, cultural venue, rail access and a broad visitor offer; the Basin and House of Dun remain separately scored See destinations.', sources: ['https://visitangus.com/get-inspired/itineraries/discover-the-best-things-to-do-in-montrose/'] },
  'brechin-scotland': { score: 74, rationale: 'A worthwhile historic city visit centred on the cathedral and round tower, Caledonian Railway, town heritage and café provision; out-of-town attractions are not required to clear the threshold.', sources: ['https://visitangus.com/plan-your-trip/explore-our-towns/brechin/', 'https://visitangus.com/get-inspired/itineraries/discover-the-best-things-to-do-in-brechin/'] },
  'edzell-scotland': { score: 72, rationale: 'A worthwhile village destination with strong planned character, the Dalhousie Arch, visitor centre, cafés and direct walking choices; separately published castle and glen attractions add itinerary depth without being substituted for the village.', sources: ['https://visitangus.com/plan-your-trip/explore-our-towns/edzell/', 'https://visitangus.com/things-to-see-do/attractions/edzell-castle-and-gardens/'] },
  'glamis-scotland': { score: 68, rationale: 'The picturesque planned village has Pictish heritage, an in-village visitor experience and café provision and functions as a coherent stop; Glamis Castle remains an independently scored See destination.', sources: ['https://visitangus.com/plan-your-trip/explore-our-towns/glamis/'] },
  'auchmithie-scotland': { score: 67, rationale: 'A distinctive historic clifftop fishing village with nationally recognised Smokie associations, dramatic shore and cliffs, a signed coastal route, beach access and a destination food stop.', sources: ['https://visitangus.com/things-to-see-do/attractions/the-arbroath-smokie-trail/', 'https://visitangus.com/things-to-see-do/attractions/beach-trail/'] },
  'johnshaven-scotland': { score: 65, rationale: 'A coherent historic harbour village with maritime museum, working harbour, coastal walking, public green space and a seasonal festival, supporting a notable independent stop.', sources: ['https://visitabdn.com/places/johnshaven', 'https://visitabdn.com/businesses/johnshaven-harbour'] },
  'gourdon-aberdeenshire-scotland': { score: 64, rationale: 'A distinctive working fishing village with harbour character, coastal path access and visitor food provision sufficient for a notable stop independent of neighbouring Inverbervie.' },
  'st-vigeans-scotland': { score: 63, rationale: 'A compact, unusually complete historic hamlet with restored cottages, a nationally important collection of Pictish stones, ancient church and direct trail connections, supporting a focused heritage stop.', sources: ['https://visitangus.com/st-vigeans-doors-open-days/', 'https://visitangus.com/get-inspired/heritage-trails/the-pictish-trail/'] },
  'inverbervie-scotland': { score: 62, rationale: 'A historic coastal burgh with an identifiable centre, beach, literary associations, practical services and direct coastal walks to neighbouring fishing villages.', sources: ['https://www.egcp.scot/inverbervie'] },

  // These places were previously placed immediately below 60 because their
  // audits were incomplete. Their settlement-only evidence does not justify
  // promotion, so the corrected scores move away from that artificial cap.
  'auchenblae-scotland': { score: 52, rationale: 'An attractive village with The Den and local character, but limited independent visitor depth once nearby castles and estates are excluded.' },
  'laurencekirk-scotland': { score: 48, rationale: 'A useful service and rail town with local character but limited destination-scale See and trail depth.' },
  'st-cyrus-scotland': { score: 48, rationale: 'The village has services and access links, but its principal visitor draw is the independently published National Nature Reserve rather than the settlement itself.' },
  'fordoun-scotland': { score: 50, rationale: 'A historic village with genuine fabric and local interest, but not enough independently verified visitor depth for a town marker.' },
  'kinneff-scotland': { score: 42, rationale: 'A small historic village whose church and coast context support interest but not a complete independent visitor stop.' },
  'luthermuir-scotland': { score: 40, rationale: 'A coherent village with local services but little independently verified visitor depth.' },
  'arbuthnott-scotland': { score: 38, rationale: 'A historic rural hamlet whose church and cultural associations are limited as a complete public visit.' },
  'benholm-scotland': { score: 42, rationale: 'A historic parish village with local character; Mill of Benholm is separately assessed and cannot alone create a town marker.' },
  'marykirk-scotland': { score: 38, rationale: 'A recognisable village with modest historic character but limited independent visitor provision.' },
  'letham-angus-scotland': { score: 44, rationale: 'A substantial service village, but its independently visitable heritage, trails and visitor amenities remain modest.' },
  'ferryden-scotland': { score: 48, rationale: 'A characterful fishing village and harbour-side settlement, but with limited independent visitor depth beyond a short coastal stop.' },
  'monikie-scotland': { score: 42, rationale: 'The settlement has local identity, while Monikie Country Park remains a separate See destination and does not determine the village score.' },
  'newtyle-scotland': { score: 44, rationale: 'A planned village with historic interest and services, but limited destination-scale visitor depth.' },
  'lunan-scotland': { score: 40, rationale: 'A small historic hamlet; Lunan Bay and Red Castle are separately assessed See destinations rather than settlement merit.' },
  'friockheim-scotland': { score: 38, rationale: 'An established village with services but limited independently verified visitor appeal.' },
  'inverkeilor-scotland': { score: 42, rationale: 'A historic parish village with some character but insufficient independent visitor depth for a notable-stop rating.' },
  'bridge-of-dun-scotland': { score: 36, rationale: 'A small crossing and railway locality; House of Dun and the heritage railway are separately assessed attractions.' },
  'dunnichen-scotland': { score: 40, rationale: 'A historic village with local character, while the wider battle landscape is separately treated as See evidence.' },
  'fishtown-of-usan-scotland': { score: 42, rationale: 'A distinctive historic fishing hamlet with coastal atmosphere but limited practical visitor provision.' },
  'inverarity-scotland': { score: 38, rationale: 'A historic rural village with modest independent visitor depth.' },
  'carmyllie-scotland': { score: 36, rationale: 'A recognisable rural village with local heritage but little destination-scale visitor provision.' },
  'douglastown-angus-scotland': { score: 38, rationale: 'A coherent village with heritage interest but limited independent visitor infrastructure.' },
  'eassie-scotland': { score: 38, rationale: 'A small historic locality; the Pictish stone is separately assessed heritage evidence rather than a complete village visit.' },
  'hillside-montrose-scotland': { score: 30, rationale: 'A residential settlement which does not inherit Montrose attractions or services.' },
  'kingsmuir-scotland': { score: 28, rationale: 'A residential and rural-edge settlement with no independently verified destination-scale visitor offer.' },
};

function retainedRationale(pkg: ProjectPackage, score: number): string {
  const character = pkg.project.townGuide?.characterTag?.toLowerCase() ?? 'named locality';
  if (score < 25) return `${pkg.project.name} was re-screened as a ${character}; no independently visitable settlement-level experience was verified.`;
  if (score < 35) return `${pkg.project.name} was re-screened as a ${character}; limited character or heritage is present, but not a complete public visitor stop.`;
  if (score < 50) return `${pkg.project.name} was re-screened as a ${character}; it has recognisable local identity but modest independent visitor depth.`;
  return `${pkg.project.name} was re-screened as a ${character}; it has strong character but does not independently meet the notable-stop threshold.`;
}

const results: Array<Record<string, unknown>> = [];
for (const fileName of await readdir(resolve('data/projects'))) {
  if (!fileName.endsWith('.json')) continue;
  const path = resolve('data/projects', fileName);
  let pkg: ProjectPackage;
  try { pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage; } catch { continue; }
  if (pkg.project.touristAppeal?.methodVersion !== flawedMethod) continue;

  const previousScore = pkg.project.touristAppeal.score ?? 0;
  const correction = overrides[pkg.project.id];
  const score = correction?.score ?? previousScore;
  const rationale = correction?.rationale ?? retainedRationale(pkg, score);
  const sourceUrls = [...new Set([...(pkg.project.touristAppeal.sourceUrls ?? []), ...(correction?.sources ?? [])])];
  const band = townScoreBand(score);
  const dogRating = pkg.project.touristAppeal.dogAccessRating;
  Object.assign(pkg.project.touristAppeal, {
    score,
    dogOwnerScore: townScoreAfterDogAccess(score, dogRating),
    rating: band.rating,
    label: band.label,
    summary: rationale,
    methodVersion: correctedMethod,
    reviewedAt,
    sourceUrls,
  });
  if (pkg.project.townGuide) {
    pkg.project.townGuide.headline = score >= 60 ? band.label : 'A locally distinctive place with limited visitor depth';
    pkg.project.townGuide.intro = rationale;
    pkg.project.townGuide.visitorMood = score >= 60
      ? `Evidence-based settlement score ${score}; eligible for the town map independently of nearby standalone attractions.`
      : `Evidence-based settlement score ${score}; remains selectable but below the 60-point town-map threshold.`;
    pkg.project.townGuide.sourceUrls = [...new Set([...(pkg.project.townGuide.sourceUrls ?? []), ...(correction?.sources ?? [])])];
    pkg.project.townGuide.lastReviewedAt = reviewedAt;
  }
  pkg.project.researchNotes = `${pkg.project.researchNotes ?? ''} Score corrected after removal of the artificial sub-60 catalogue gate. Settlement merit was assessed before applying the map threshold; standalone attractions were not transferred into the town score.`.trim();
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`${pkg.project.name}: ${errors.map((item) => item.message).join('; ')}`);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  results.push({
    projectId: pkg.project.id,
    name: pkg.project.name,
    region: pkg.project.region,
    previousScore,
    correctedScore: score,
    changed: score !== previousScore,
    publishOnTownMap: score >= 60,
    rationale,
    sourceUrls,
  });
}

await writeFile(resolve('data/review/strict-settlement-score-correction-2026-08-30.json'), `${JSON.stringify({
  schemaVersion: 1,
  reviewedAt,
  affectedProjects: results.length,
  changedScores: results.filter((item) => item.changed).length,
  mappedAfterCorrection: results.filter((item) => item.publishOnTownMap).map((item) => ({ projectId: item.projectId, name: item.name, score: item.correctedScore })),
  rubric: {
    '90-100': 'Exceptional national or international destination with outstanding independent depth.',
    '80-89': 'Strong destination supporting a substantial day visit through several independent draws and practical provision.',
    '70-79': 'Worth a visit, with enough independent attractions, character, trails and services for a planned half or full day.',
    '60-69': 'Notable stop with multiple independent reasons to visit and adequate practical provision.',
    '50-59': 'Strong character or a focused draw, but insufficient independent depth for the main town map.',
    '35-49': 'Recognisable village or hamlet with modest independent interest.',
    '20-34': 'Minor locality, estate or district with limited public visitor value.',
    '0-19': 'Named property or dispersed locality without a verified public settlement experience.',
  },
  rules: [
    'The score is assessed before the 60-point map threshold is applied.',
    'Standalone attractions remain under See and cannot substitute for settlement merit.',
    'A score review does not falsely claim completion of the separate See, Eat, trails, parking, toilets, picnic, accessibility and heritage content audit.',
    'Existing dog-access ratings remain separate and produce the dog-owner score adjustment.',
  ],
  results,
}, null, 2)}\n`, 'utf8');

console.log(`Corrected ${results.length} settlement scores; ${results.filter((item) => item.changed).length} changed and ${results.filter((item) => item.publishOnTownMap).length} now clear 60.`);
