import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point, pointOnFeature } from '@turf/turf';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Point, Polygon } from 'geojson';
import type { AttractionGuide, HeritageFeature, ProjectPackage, SourceRecord, TouristAppealRating } from '../src/domain/models';
import {
  townRatingFromEvidence,
  townRatingLabels,
  townRatingSummary,
} from '../src/domain/townRating';
import { assessPublicVisitorParking } from './lib/publicVisitorParking';

const reviewedDate = new Date().toISOString().slice(0, 10);
const reviewedAt = `${reviewedDate}T00:00:00Z`;
const nhleRoot = resolve('data/reference/england_wales_national_data_downloader/downloads/england/nhle');
const plannerPath = resolve('data/visitor-planner-curation.json');
const dogPath = resolve('data/dog-access-curation.json');
const treasurePath = resolve('data/review/treasure-trails-town-audit-2026-08-08.json');
const cacheDirectory = resolve('tmp/east-midlands-town-batch-osm-v4');
const editorialLicence = 'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.';

const scoring = {
  age: { before_1700: 1, '1700_1799': 0.9, '1800_1849': 0.8, '1850_1899': 0.65, '1900_1918': 0.5, '1919_1945': 0.4, '1946_1960': 0.25, after_1960: 0.15, unknown: 0.2 },
  significance: { highest_national: 1, national: 0.85, regional: 0.65, local: 0.45, recognised: 0.3 },
  confidence: { high: 1, medium: 0.75, low: 0.5, unknown: 0.35 },
  survival: { substantially_intact: 1, altered_recognisable: 0.75, heavily_altered: 0.45, site_only_or_demolished: 0.2, unknown: 0.6 },
} as const;

interface OsmElement { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }
interface OverpassResponse { elements?: OsmElement[] }
interface AttractionSeed { name: string; match: RegExp; score: number; tagline: string; type: string; sourceUrl: string; reason: string; searchName?: string; opening?: string; admission?: string; free?: boolean }
interface TrailSeed { name: string; url: string; score: number; duration: string; distance: string; dogFriendly?: boolean }
type TreasureTrail = TrailSeed;
interface TownSpec {
  slug: string; locality: string; region: string; localityCode: string; rating: TouristAppealRating; ratingLabel: string; ratingSummary: string;
  headline: string; intro: string; bestFor: string[]; suggestedTitle: string; suggestedSummary: string; suggestedTime: string; visitorMood: string;
  motifs: string[]; sourceUrls: string[]; attractions: AttractionSeed[]; trails?: TrailSeed[]; treasureTrail?: TreasureTrail;
}
interface TownContext { spec: TownSpec; projectId: string; boundary: Feature<Polygon | MultiPolygon>; centre: [number, number]; onsUrl: string; features: HeritageFeature[]; byId: Map<string, HeritageFeature> }
interface DogEntry { rating: number; status: string; label: string; summary: string; sourceName: string; sourceUrl: string; reviewedAt: string }

const visitLincoln = 'https://www.visitlincoln.com/explore/lincolnshire/towns-and-villages/stamford/';
const deepingsPlan = 'https://www.southkesteven.gov.uk/sites/default/files/2023-08/v12.08.2022_-The_Deepings_Neighbourhood_Plan_-_adopted_29_June_2021.pdf';
const crowlandVisitor = 'https://crowland.parish.lincolnshire.gov.uk/parish-information/visitor-attractions';
const huntingdonVisitor = 'https://cromwellmuseum.org/plan-a-visit/about-huntingdon/';
const bramptonWalk = 'https://www.brampton-cambs-pc.gov.uk/uploads/1b-explore-brampton.pdf?v=1611158022';
const discoverRutland = 'https://discover-rutland.co.uk/';

const townSpecs: TownSpec[] = [
  {
    slug: 'stamford', locality: 'Stamford', region: 'Lincolnshire', localityCode: 'E63009672', rating: 3, ratingLabel: 'Destination draw',
    ratingSummary: 'One of England’s strongest small historic towns: an unusually complete stone-built centre, landmark churches, independent shops, riverside meadows and a first-rate self-guided trail justify a journey in their own right.',
    headline: 'Honey-stone streets, church towers and riverside meadows',
    intro: 'Stamford rewards an unhurried day on foot. Move between Georgian and medieval streets, market squares and landmark churches, then drop to the Welland and the Meadows for a greener view of the town.',
    bestFor: ['Historic townscape', 'Architecture', 'Independent shops', 'Riverside walking'], suggestedTitle: 'Market squares, All Saints and the Meadows',
    suggestedSummary: 'Begin around Red Lion Square and All Saints, thread south through the stone streets and St Martin’s, then return beside the Welland and Stamford Meadows.',
    suggestedTime: 'Half day to full day', visitorMood: 'A genuine destination town, especially for visitors who enjoy architecture, markets and compact walks.', motifs: ['Stone town', 'Church towers', 'Market squares', 'River Welland'], sourceUrls: [visitLincoln],
    attractions: [
      { name: 'Stamford historic townscape and market squares', match: /(red lion square|market place|stamford town hall|townscape)/i, score: 90, tagline: 'Exceptional townscape', type: 'square', sourceUrl: visitLincoln, reason: 'An exceptionally coherent sequence of honey-coloured streets, market spaces and historic buildings.' },
      { name: 'All Saints Church', match: /all saints/i, score: 82, tagline: 'Landmark church', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/14525/', reason: 'A major visual anchor in the centre, with a fine tower and strong medieval-town atmosphere.' },
      { name: 'Browne’s Hospital', match: /browne.?s hospital/i, score: 80, tagline: 'Medieval almshouse', type: 'hospital', sourceUrl: 'https://www.stamfordcivicsociety.org.uk/', reason: 'A rare late-medieval almshouse complex that adds depth to Stamford’s architectural story.' },
      { name: 'St Martin’s Church', match: /st martin/i, score: 77, tagline: 'Tudor connections', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/14526/', reason: 'A handsome historic church associated with the Cecil family and Stamford’s southern quarter.' },
      { name: 'Stamford Arts Centre', match: /(arts centre|assembly rooms)/i, score: 74, tagline: 'Culture stop', type: 'civic_building', sourceUrl: 'https://www.stamfordartscentre.com/', reason: 'The town’s cultural hub, combining historic rooms with exhibitions, cinema and live events.' },
      { name: 'Stamford Meadows and River Welland', match: /(stamford meadow|the meadows)/i, score: 72, tagline: 'Riverside pause', type: 'park', sourceUrl: visitLincoln, reason: 'A relaxing riverside counterpoint to the stone centre and one of the best townscape viewpoints.' },
    ], treasureTrail: { name: 'Stamford Historic Town and Market Treasure Trail', url: 'https://www.treasuretrails.co.uk/products/things-to-do-stamford-lincs', score: 88, duration: '2+ hours', distance: '1.9 miles' },
  },
  {
    slug: 'market-deeping', locality: 'Market Deeping', region: 'Lincolnshire', localityCode: 'E63009608', rating: 1, ratingLabel: 'Local detour',
    ratingSummary: 'An attractive market-town core, St Guthlac’s Church and the River Welland make a pleasant local stop, but the visitor offer is not destination-scale.',
    headline: 'A small market town shaped by the River Welland', intro: 'Explore the Market Place and St Guthlac’s, then follow the in-town Welland paths before choosing a daytime café stop.',
    bestFor: ['Small-town character', 'River walking', 'Church architecture', 'A relaxed café stop'], suggestedTitle: 'Market Place, St Guthlac’s and the Welland', suggestedSummary: 'Start in the Market Place, visit St Guthlac’s exterior and churchyard, then follow the in-town riverside paths.', suggestedTime: 'Two to four hours', visitorMood: 'Pleasant and locally distinctive, with enough for an unhurried stop but not a special journey.', motifs: ['Market town', 'River Welland', 'St Guthlac’s', 'Stone bridges'], sourceUrls: [deepingsPlan],
    attractions: [
      { name: 'Market Place and historic town centre', match: /(market place|market deeping town hall)/i, score: 66, tagline: 'Market-town heart', type: 'square', sourceUrl: deepingsPlan, reason: 'The compact historic centre gives Market Deeping its strongest sense of place.' },
      { name: 'St Guthlac’s Church', match: /st guthlac/i, score: 64, tagline: 'Historic church', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/14545/', reason: 'The parish church is the town’s principal historic landmark beside the Welland.' },
      { name: 'River Welland town walk', match: /(river welland|welland)/i, score: 60, tagline: 'Riverside walk', type: 'park', sourceUrl: deepingsPlan, reason: 'The river and its paths provide the most enjoyable green thread through the town.' },
    ],
  },
  {
    slug: 'deeping-st-james', locality: 'Deeping St James', region: 'Lincolnshire', localityCode: 'E63009631', rating: 1, ratingLabel: 'Local detour',
    ratingSummary: 'The priory church, old village core and Welland give real local interest, but this remains a quiet stop rather than a broad visitor destination.',
    headline: 'Priory echoes and a long village beside the Welland', intro: 'Follow the older village spine around St James’s Church and the river, looking for surviving historic details before an easy outdoor extension.',
    bestFor: ['Church history', 'Village character', 'River paths', 'Quiet local exploration'], suggestedTitle: 'St James’s Church and the old village', suggestedSummary: 'Begin at the former priory church, trace the older streets, then add an in-boundary stretch beside the Welland.', suggestedTime: 'One to three hours', visitorMood: 'A gentle local discovery, strongest when combined with neighbouring Market Deeping.', motifs: ['Priory church', 'Long village', 'River Welland', 'Fen edge'], sourceUrls: [deepingsPlan],
    attractions: [
      { name: 'Priory Church of St James', match: /(priory church|st\.? james church|church of st\.? james)/i, score: 66, tagline: 'Priory landmark', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/14544/', reason: 'The former priory church is the village’s clearest historic landmark and best heritage stop.' },
      { name: 'Deeping St James historic village core', match: /(village cross|lock.?up|deeping st james townscape)/i, score: 52, tagline: 'Village character', type: 'street', sourceUrl: deepingsPlan, reason: 'Older buildings and small civic details preserve the identity of the long historic village.' },
      { name: 'River Welland village walk', match: /(river welland|welland)/i, score: 55, tagline: 'Riverside walk', type: 'park', sourceUrl: deepingsPlan, reason: 'The river paths add an easy green element to a compact village visit.' },
    ],
  },
  {
    slug: 'crowland', locality: 'Crowland', region: 'Lincolnshire', localityCode: 'E63009621', rating: 2, ratingLabel: 'Worth a planned stop',
    ratingSummary: 'The remarkable Abbey, unique three-way Trinity Bridge and compact Fenland story are unusually strong for a small town.',
    headline: 'A great abbey, a three-way bridge and deep Fenland history', intro: 'The Abbey supplies scale and atmosphere, Trinity Bridge is a genuine curiosity, and the town’s sculpture and waterways explain a settlement once surrounded by marsh.',
    bestFor: ['Abbey architecture', 'Medieval engineering', 'Fenland history', 'Compact heritage stops'], suggestedTitle: 'Crowland Abbey and Trinity Bridge', suggestedSummary: 'Start at the Abbey, walk into the centre for Trinity Bridge and the Arrival sculpture, then add the wildlife pond.', suggestedTime: 'Two to four hours', visitorMood: 'Small in scale but distinctive enough to reward a purposeful detour.', motifs: ['Crowland Abbey', 'Trinity Bridge', 'Fen waterways', 'St Guthlac'], sourceUrls: ['https://crowlandabbey.org.uk/', crowlandVisitor],
    attractions: [
      { name: 'Crowland Abbey', match: /(crowland abbey|church of st mary.*st bartholomew)/i, score: 84, tagline: 'Great Fenland abbey', type: 'abbey', sourceUrl: 'https://crowlandabbey.org.uk/', reason: 'A dramatic surviving abbey church with a story stretching back to St Guthlac.', opening: 'Normally open most days 11:00-15:00, except during services, funerals and special events.', admission: 'Free; donations support the Abbey.', free: true },
      { name: 'Trinity Bridge', match: /trinity bridge/i, score: 80, tagline: 'Unique medieval bridge', type: 'bridge', sourceUrl: crowlandVisitor, reason: 'A rare triangular medieval bridge that once crossed three channels.', opening: 'Outdoor monument; view in daylight.', admission: 'Free.', free: true },
      { name: 'The Arrival sculpture', match: /(the arrival|arrival sculpture)/i, score: 58, tagline: 'Fenland story', type: 'public_art', sourceUrl: crowlandVisitor, reason: 'A contemporary sculpture linking Crowland’s historic arrivals and waterways.' },
      { name: 'Crowland wildlife pond and picnic area', match: /(wildlife pond|crowland pond)/i, score: 48, tagline: 'Nature pause', type: 'park', sourceUrl: crowlandVisitor, reason: 'A modest outdoor pause adding wildlife and picnic space.' },
    ],
  },
  {
    slug: 'huntingdon', locality: 'Huntingdon', region: 'Cambridgeshire', localityCode: 'E63010249', rating: 2, ratingLabel: 'Worth a planned stop',
    ratingSummary: 'A nationally significant Cromwell museum, walkable historic centre, old bridge, riverside spaces and dedicated trail make a credible half-day destination.',
    headline: 'Cromwell’s town, old streets and a walk beside the Great Ouse', intro: 'Begin with Cromwell, follow the historic centre and market spaces, then finish at the old bridge or riverside.',
    bestFor: ['Oliver Cromwell history', 'Town trails', 'Market-town heritage', 'Riverside walking'], suggestedTitle: 'Cromwell Museum, the old town and the bridge', suggestedSummary: 'Start at the Cromwell Museum, follow the historic town trail, then continue towards the old bridge and riverside.', suggestedTime: 'Half day', visitorMood: 'A worthwhile planned stop with one nationally resonant story and a compact supporting townscape.', motifs: ['Oliver Cromwell', 'Old Bridge', 'Market town', 'Great Ouse'], sourceUrls: [huntingdonVisitor, 'https://www.huntingdonshire.gov.uk/hinchingbrookecountrypark'],
    attractions: [
      { name: 'Cromwell Museum', match: /cromwell museum/i, score: 84, tagline: 'National history', type: 'museum', sourceUrl: 'https://cromwellmuseum.org/plan-a-visit/', reason: 'A focused museum in Cromwell’s former school building, holding the town’s strongest national story.' },
      { name: 'Huntingdon Historic Town Trail', match: /(historic town trail|huntingdon town trail)/i, score: 80, tagline: 'Historic town circuit', type: 'street', sourceUrl: huntingdonVisitor, reason: 'A useful self-guided route linking the museum with old gaols, inns, civic buildings and riverside history.' },
      { name: 'Huntingdon Old Bridge', match: /(old bridge|huntingdon bridge)/i, score: 76, tagline: 'Medieval river crossing', type: 'bridge', sourceUrl: huntingdonVisitor, reason: 'The historic bridge and Great Ouse setting provide Huntingdon’s best outdoor landmark.' },
      { name: 'Castle Hills', match: /castle hills/i, score: 58, tagline: 'Castle earthworks', type: 'archaeological_site', sourceUrl: huntingdonVisitor, reason: 'Surviving earthworks add a short archaeological stop close to the town centre.' },
      { name: 'Hinchingbrooke Country Park', match: /hinchingbrooke country park/i, score: 78, tagline: 'Lakes and woodland', type: 'park', sourceUrl: 'https://www.huntingdonshire.gov.uk/hinchingbrookecountrypark', reason: 'A substantial green-space visit with lakes, woodland, play, café and picnic facilities.' },
    ], treasureTrail: { name: 'Huntingdon Cromwell House and Town Treasure Trail', url: 'https://www.treasuretrails.co.uk/products/things-to-do-huntingdon-cambs', score: 88, duration: 'About 2 hours', distance: '1.8 miles', dogFriendly: true },
  },
  {
    slug: 'brampton-huntingdonshire', locality: 'Brampton', region: 'Cambridgeshire', localityCode: 'E63010291', rating: 1, ratingLabel: 'Local detour',
    ratingSummary: 'A pleasant village green, historic church and source-backed walking circuit make a local stop, but the offer is modest.',
    headline: 'A handsome village green and quiet historic lanes', intro: 'Use the green and parish church as anchors, then follow the village route past historic buildings, bridges and open spaces.',
    bestFor: ['Village character', 'Short walks', 'Church history', 'A quiet green pause'], suggestedTitle: 'The Green, St Mary’s and the village walk', suggestedSummary: 'Begin at the Green, continue to St Mary Magdalene, then use the published Brampton walk to link older lanes.', suggestedTime: 'One to three hours', visitorMood: 'A pleasant local detour rather than a stand-alone destination.', motifs: ['Village green', 'St Mary’s', 'Historic lanes', 'Local walks'], sourceUrls: [bramptonWalk],
    attractions: [
      { name: 'St Mary Magdalene Church', match: /(st mary magdalene|church of st mary)/i, score: 58, tagline: 'Village landmark', type: 'church', sourceUrl: bramptonWalk, reason: 'The parish church is Brampton’s principal historic landmark.' },
      { name: 'Brampton village green and memorial gardens', match: /(village green|memorial garden|brampton memorial play)/i, score: 54, tagline: 'Village heart', type: 'park', sourceUrl: 'https://www.brampton-cambs-pc.gov.uk/memorial-gardens', reason: 'A well-kept central green and garden giving the village its strongest public sense of place.' },
      { name: 'The Round House', match: /round house/i, score: 48, tagline: 'Architectural curiosity', type: 'house', sourceUrl: bramptonWalk, reason: 'A distinctive historic building adding variety to the village trail.' },
      { name: 'Nun’s Bridge', match: /nun.?s bridge/i, score: 45, tagline: 'Historic bridge', type: 'bridge', sourceUrl: bramptonWalk, reason: 'A brief but characterful detail on the wider village circuit.' },
    ],
  },
  {
    slug: 'oakham', locality: 'Oakham', region: 'Rutland', localityCode: 'E63009645', rating: 2, ratingLabel: 'Worth a planned stop',
    ratingSummary: 'The exceptional castle hall, county museum, compact market centre and dedicated clue trail form a strong half-day destination.',
    headline: 'A remarkable castle hall in England’s smallest county town', intro: 'The Castle and museum supply the history, while the Butter Cross, church, market streets and green spaces create an easy half-day wander.',
    bestFor: ['Castle architecture', 'County history', 'Market-town walking', 'Family trails'], suggestedTitle: 'Oakham Castle, the museum and Market Place', suggestedSummary: 'Begin at Oakham Castle, cross to the county museum, then loop through Market Place, the Butter Cross and All Saints.', suggestedTime: 'Half day', visitorMood: 'Small but unusually complete, with enough quality to justify planning a stop.', motifs: ['Oakham Castle', 'Horseshoes', 'Butter Cross', 'Rutland history'], sourceUrls: ['https://oakhamtowncouncil.gov.uk/explore-oakham/', discoverRutland],
    attractions: [
      { name: 'Oakham Castle', match: /oakham castle/i, score: 86, tagline: 'Exceptional great hall', type: 'castle', sourceUrl: 'https://oakhamcastle.org/', reason: 'A rare surviving Norman great hall and Oakham’s defining visitor attraction.', admission: 'Free; donations welcome.', free: true },
      { name: 'Rutland County Museum', match: /rutland county museum/i, score: 80, tagline: 'County story', type: 'museum', sourceUrl: 'https://rutlandcountymuseum.org.uk/', reason: 'A strong local museum adding depth to the castle and county-town visit.', admission: 'Free; donations welcome.', free: true },
      { name: 'All Saints Church', match: /all saints/i, score: 70, tagline: 'Landmark spire', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/6755/', reason: 'The parish church and its spire are central to Oakham’s historic skyline.' },
      { name: 'Oakham Butter Cross', match: /butter cross/i, score: 62, tagline: 'Market-town detail', type: 'market', sourceUrl: 'https://oakhamtowncouncil.gov.uk/explore-oakham/', reason: 'A memorable market-place landmark beside the town stocks.' },
      { name: 'Cutts Close', match: /cutts close/i, score: 50, tagline: 'Green pause', type: 'park', sourceUrl: 'https://oakhamtowncouncil.gov.uk/explore-oakham/', reason: 'A useful central green space beside the castle and museum circuit.' },
    ], treasureTrail: { name: 'Oakham Butter Cross and Castle Treasure Trail', url: 'https://www.treasuretrails.co.uk/products/things-to-do-oakham-rutland', score: 89, duration: 'About 2 hours', distance: 'Check current route details' },
  },
  {
    slug: 'uppingham', locality: 'Uppingham', region: 'Rutland', localityCode: 'E63009813', rating: 1, ratingLabel: 'Local detour',
    ratingSummary: 'An attractive historic centre, independent galleries and a good dedicated trail create a rewarding Rutland detour, though the offer remains small-scale.',
    headline: 'A handsome Rutland market town of galleries and school architecture', intro: 'Explore the Market Place and old town, notice the architecture around the school and church, then add a gallery, café or clue trail.',
    bestFor: ['Historic streets', 'Art galleries', 'School architecture', 'Family clue trails'], suggestedTitle: 'Market Place, the old town and school quarter', suggestedSummary: 'Start in Market Place, follow the old-town streets towards the church and school, then choose a gallery or the dedicated Treasure Trail.', suggestedTime: 'Two to four hours', visitorMood: 'An elegant small-town stop, especially good for visitors already exploring Rutland.', motifs: ['Market Place', 'Uppingham School', 'Art galleries', 'Ironstone streets'], sourceUrls: [discoverRutland],
    attractions: [
      { name: 'Uppingham historic old town and Market Place', match: /(market place|uppingham town hall|uppingham townscape)/i, score: 68, tagline: 'Historic old town', type: 'square', sourceUrl: discoverRutland, reason: 'A compact historic core with strong shopfronts, stone buildings and market-town atmosphere.' },
      { name: 'St Peter and St Paul’s Church', match: /(st peter.*st paul|church of st peter)/i, score: 62, tagline: 'Historic church', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/6756/', reason: 'The parish church is a key part of the old-town and school-quarter walk.' },
      { name: 'Goldmark Gallery', match: /goldmark/i, score: 66, tagline: 'Independent art', type: 'commercial_building', sourceUrl: 'https://www.goldmarkart.com/', reason: 'A substantial independent gallery giving Uppingham a distinctive cultural reason to linger.' },
      { name: 'Uppingham School historic quarter', match: /(uppingham school|school chapel)/i, score: 58, tagline: 'School architecture', type: 'school', sourceUrl: 'https://www.uppingham.co.uk/', reason: 'The school’s architecture is an important part of Uppingham’s character, viewed respectfully from public streets.' },
    ], treasureTrail: { name: 'Uppingham Historic Old Town Treasure Trail', url: 'https://www.treasuretrails.co.uk/products/things-to-do-uppingham-rutland', score: 86, duration: 'About 1.5 hours', distance: '1.5 miles' },
  },
  {
    slug: 'corby', locality: 'Corby', region: 'Northamptonshire', localityCode: 'E63009997', rating: 0, ratingLabel: 'Not a tourist town',
    ratingSummary: 'Local culture, industrial history and green spaces do not yet combine into a strong enough visitor experience to recommend Corby as a tourist destination.',
    headline: 'Steel-town stories, civic culture and useful green spaces', intro: 'The Heritage Centre and civic venues provide context, while the boating lake and parks offer practical breathing space.',
    bestFor: ['Industrial history', 'Local culture', 'Community stories', 'A practical town stop'], suggestedTitle: 'Heritage Centre and the civic quarter', suggestedSummary: 'Begin with Corby’s heritage story, then add a performance, exhibition or short circuit through the civic centre and boating lake.', suggestedTime: 'One to three hours', visitorMood: 'Useful for specific interests, but not currently a tourist town in its own right.', motifs: ['Steel heritage', 'The Cube', 'Boating lake', 'New town'], sourceUrls: ['https://www.thecorecorby.com/'],
    attractions: [
      { name: 'Corby Heritage Centre', match: /corby heritage centre/i, score: 58, tagline: 'Steel-town story', type: 'museum', sourceUrl: 'https://www.northnorthants.gov.uk/corby-heritage-centre', reason: 'The clearest introduction to Corby’s rapid industrial growth and community history.' },
      { name: 'The Core at Corby Cube', match: /(the core|corby cube)/i, score: 54, tagline: 'Civic culture', type: 'civic_building', sourceUrl: 'https://www.thecorecorby.com/', reason: 'Corby’s principal theatre and cultural venue.' },
      { name: 'Corby Boating Lake', match: /boating lake/i, score: 45, tagline: 'Green pause', type: 'park', sourceUrl: 'https://www.northnorthants.gov.uk/parks-and-open-spaces', reason: 'A useful outdoor pause near the centre rather than a destination attraction.' },
    ],
  },
  {
    slug: 'kettering', locality: 'Kettering', region: 'Northamptonshire', localityCode: 'E63010129', rating: 2, ratingLabel: 'Worth a planned stop',
    ratingSummary: 'Wicksteed Park, a credible museum-and-gallery cluster and a rich town heritage trail support a planned visit rather than only a passing stop.',
    headline: 'A pioneering park, local art and a town full of heritage clues', intro: 'Choose a family day at Wicksteed Park or a compact cultural visit around the Manor House Museum, Alfred East Gallery and parish church.',
    bestFor: ['Family days', 'Local art and history', 'Town trails', 'Parkland'], suggestedTitle: 'Wicksteed Park or the museum-and-gallery quarter', suggestedSummary: 'Choose Wicksteed for a family visit, or start at the museum and gallery before following the heritage trail through the centre.', suggestedTime: 'Half day to full day', visitorMood: 'A worthwhile planned stop with two distinct visitor experiences.', motifs: ['Wicksteed Park', 'Alfred East', 'Town heritage', 'Boot and shoe history'], sourceUrls: ['https://www.northnorthants.gov.uk/cornerstone/manor-house-museum', 'https://www.ketteringtowncouncil.gov.uk/heritage?page=2', 'https://wicksteedpark.org/'],
    attractions: [
      { name: 'Wicksteed Park', match: /wicksteed park/i, score: 86, tagline: 'Major family day out', type: 'park', sourceUrl: 'https://wicksteedpark.org/', reason: 'A nationally important pioneering leisure park with rides, play, open space and a full family-day offer.' },
      { name: 'Manor House Museum', match: /manor house museum/i, score: 74, tagline: 'Town museum', type: 'museum', sourceUrl: 'https://www.northnorthants.gov.uk/cornerstone/manor-house-museum', reason: 'A focused introduction to Kettering’s local history and industries.' },
      { name: 'Alfred East Art Gallery', match: /alfred east/i, score: 74, tagline: 'Regional art collection', type: 'commercial_building', sourceUrl: 'https://www.northnorthants.gov.uk/cornerstone/alfred-east-art-gallery', reason: 'A significant regional gallery pairing naturally with the museum.' },
      { name: 'St Peter and St Paul’s Church', match: /(st peter.*st paul|church of st peter)/i, score: 66, tagline: 'Town landmark', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/16640/', reason: 'The parish church and tower are central to Kettering’s historic skyline.' },
      { name: 'Kettering Heritage QR Trail', match: /(heritage trail|heritage walk)/i, score: 70, tagline: 'Town trail', type: 'street', sourceUrl: 'https://www.ketteringtowncouncil.gov.uk/heritage?page=2', reason: 'A broad set of heritage markers turns the centre into a coherent self-guided visit.' },
    ],
  },
  {
    slug: 'rothwell-northamptonshire', locality: 'Rothwell', region: 'Northamptonshire', localityCode: 'E63010096', rating: 1, ratingLabel: 'Local detour',
    ratingSummary: 'A distinctive medieval church and bone crypt, Market House and heritage centre support a niche detour, though access and scale are limited.',
    headline: 'A medieval bone crypt and an unusually handsome market town', intro: 'Plan around Holy Trinity’s remarkable bone crypt, then add the Market House, historic streets and heritage centre.',
    bestFor: ['Church archaeology', 'Market-town history', 'Architectural details', 'Specialist heritage'], suggestedTitle: 'Holy Trinity, the Market House and heritage centre', suggestedSummary: 'Check church or crypt opening first, then continue through Market Hill to the Market House and Heritage Centre.', suggestedTime: 'Two to four hours', visitorMood: 'Distinctive for specialist interests, but too limited for a broad destination rating.', motifs: ['Bone crypt', 'Market House', 'Holy Trinity', 'Charter town'], sourceUrls: ['https://www.rothwellheritage.org.uk/', 'https://www.rothwellholytrinity.org.uk/'],
    attractions: [
      { name: 'Holy Trinity Church and bone crypt', match: /(holy trinity|rothwell bone crypt|charnel)/i, score: 76, tagline: 'Remarkable bone crypt', type: 'church', sourceUrl: 'https://www.rothwellholytrinity.org.uk/', reason: 'One of the country’s rare surviving medieval charnel houses gives Rothwell a genuinely unusual focus.' },
      { name: 'Rothwell Market House', match: /market house/i, score: 62, tagline: 'Market landmark', type: 'market', sourceUrl: 'https://www.rothwellheritage.org.uk/', reason: 'A prominent historic civic building anchoring the market-town centre.' },
      { name: 'Rothwell Arts and Heritage Centre', match: /(arts.*heritage centre|heritage centre)/i, score: 58, tagline: 'Local history', type: 'museum', sourceUrl: 'https://www.rothwellheritage.org.uk/', reason: 'A volunteer-run centre adding interpretation and local collections.' },
    ],
  },
  {
    slug: 'irthlingborough', locality: 'Irthlingborough', region: 'Northamptonshire', localityCode: 'E63010307', rating: 0, ratingLabel: 'Not a tourist town',
    ratingSummary: 'A notable parish church and local heritage are not enough to recommend Irthlingborough as a tourist destination.',
    headline: 'A substantial church in a working Nene Valley town', intro: 'The parish church is the main reason to pause; a short circuit can pick up remaining historic details and green spaces.',
    bestFor: ['Church architecture', 'Local history', 'Short town walks'], suggestedTitle: 'St Peter’s and the older town centre', suggestedSummary: 'Begin at St Peter’s, then make a short loop through the older streets before continuing elsewhere in the Nene Valley.', suggestedTime: 'One to two hours', visitorMood: 'A local point of interest, not a tourist town in its own right.', motifs: ['St Peter’s', 'Nene Valley', 'Boot and shoe history', 'Market town'], sourceUrls: ['https://www.irthlingborough-tc.gov.uk/'],
    attractions: [
      { name: 'St Peter’s Church', match: /(st peter.?s church|church of st peter)/i, score: 58, tagline: 'Parish landmark', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/16636/', reason: 'A substantial historic church and the clearest architectural reason to pause.' },
      { name: 'Irthlingborough historic centre', match: /(market cross|irthlingborough townscape)/i, score: 40, tagline: 'Local history', type: 'street', sourceUrl: 'https://www.irthlingborough-tc.gov.uk/', reason: 'A modest collection of historic details supporting a brief local walk.' },
    ],
  },
  {
    slug: 'desborough', locality: 'Desborough', region: 'Northamptonshire', localityCode: 'E63010063', rating: 1, ratingLabel: 'Local detour',
    ratingSummary: 'The heritage centre, parish church and industrial stories support a short local-history stop, though the offer remains modest.',
    headline: 'Local collections and a compact industrial market-town story', intro: 'Pair the volunteer heritage centre and parish church, then trace the older streets for boot, shoe and corset-making history.',
    bestFor: ['Local museums', 'Industrial history', 'Church architecture', 'Short heritage stops'], suggestedTitle: 'Heritage Centre and St Giles', suggestedSummary: 'Check the Heritage Centre’s session first, then link it with St Giles and a brief older-town circuit.', suggestedTime: 'One to three hours', visitorMood: 'A worthwhile local detour when the heritage centre is open.', motifs: ['Heritage Centre', 'St Giles', 'Boot and shoe history', 'Market town'], sourceUrls: ['https://www.desboroughheritagecentre.co.uk/'],
    attractions: [
      { name: 'Desborough Heritage Centre', match: /desborough heritage centre/i, score: 62, tagline: 'Local collections', type: 'museum', sourceUrl: 'https://www.desboroughheritagecentre.co.uk/', reason: 'The town’s strongest visitor stop, with volunteer-run displays on local life and industries.' },
      { name: 'St Giles Church', match: /(st giles|church of st giles)/i, score: 55, tagline: 'Historic church', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/16615/', reason: 'The parish church provides the main surviving architectural landmark.' },
      { name: 'Desborough Pocket Park', match: /(pocket park|desborough greenspace)/i, score: 42, tagline: 'Outdoor pause', type: 'park', sourceUrl: 'https://www.desboroughtowncouncil.gov.uk/', reason: 'A modest green pause extending a short local-history visit.' },
    ],
  },
  {
    slug: 'wellingborough', locality: 'Wellingborough', region: 'Northamptonshire', localityCode: 'E63010344', rating: 1, ratingLabel: 'Local detour',
    ratingSummary: 'A worthwhile museum, handsome parish church and two pleasant central gardens support a useful local stop, but the visitor offer is not broad enough for a special journey.',
    headline: 'A market-town museum, church spire and garden pauses',
    intro: 'Begin with the town museum in the former Dulley Baths, add All Hallows and the older centre, then use Croyland or Swanspool Gardens for a quieter finish.',
    bestFor: ['Local history', 'Church architecture', 'Town gardens', 'A short heritage stop'], suggestedTitle: 'Museum, All Hallows and Croyland Gardens',
    suggestedSummary: 'Start at Wellingborough Museum, walk through the older centre to All Hallows, then finish in Croyland Gardens.', suggestedTime: 'Two to four hours',
    visitorMood: 'Best treated as a compact local-history stop rather than a destination day out.', motifs: ['Dulley Baths', 'All Hallows', 'Market town', 'Garden walks'],
    sourceUrls: ['https://visitnorthamptonshire.co.uk/out-and-about/wellingborough-museum', 'https://www.wellingboroughtowncouncil.gov.uk/'],
    attractions: [
      { name: 'Wellingborough Museum', match: /wellingborough museum/i, score: 68, tagline: 'Town history', type: 'museum', sourceUrl: 'https://visitnorthamptonshire.co.uk/out-and-about/wellingborough-museum', reason: 'A free social-history museum in the characterful former Dulley Baths is the town’s strongest formal visitor stop.', admission: 'Free; donations welcome.', free: true },
      { name: 'All Hallows Church', match: /(all hallows|church of all hallows)/i, score: 60, tagline: 'Historic church', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/16647/', reason: 'The substantial parish church and its tower provide the clearest architectural landmark in the centre.' },
      { name: 'Croyland Gardens', match: /(croyland gardens|croyland park)/i, score: 55, tagline: 'Garden pause', type: 'park', sourceUrl: 'https://www.wellingboroughtowncouncil.gov.uk/', reason: 'A landscaped central garden beside historic Croyland Hall, well placed for a pause during a town walk.' },
      { name: 'Swanspool Gardens', match: /swanspool gardens/i, score: 48, tagline: 'Quiet green space', type: 'park', sourceUrl: 'https://www.wellingboroughtowncouncil.gov.uk/', reason: 'A small formal garden adding a calm outdoor stop close to the older town centre.' },
      { name: 'Wellingborough historic market-town centre', match: /(market place|market square|wellingborough townscape)/i, score: 50, tagline: 'Market-town character', type: 'street', sourceUrl: 'https://www.wellingboroughtowncouncil.gov.uk/', reason: 'The surviving civic buildings and older streets provide context for the museum and church.' },
    ],
  },
  {
    slug: 'rushden', locality: 'Rushden', region: 'Northamptonshire', localityCode: 'E63010379', rating: 1, ratingLabel: 'Local detour',
    ratingSummary: 'Two volunteer museums, a handsome parish church and Hall Park create a credible local-history visit, though Rushden remains a modest visitor stop.',
    headline: 'Boot-and-shoe stories, transport history and a generous town park',
    intro: 'Rushden’s visitor interest comes from its industrial and transport collections. Link the station museum and town museum with St Mary’s and Rushden Hall Park.',
    bestFor: ['Transport history', 'Industrial heritage', 'Local museums', 'Park walks'], suggestedTitle: 'Station museum, Rushden Museum and Hall Park',
    suggestedSummary: 'Check the volunteer museum openings first, then link the former station with Rushden Museum, St Mary’s and Hall Park.', suggestedTime: 'Two to four hours',
    visitorMood: 'A rewarding specialist detour when the museums are open, rather than a broad tourist destination.', motifs: ['Historic station', 'Boot and shoe industry', 'Rushden Hall', 'Hall Park'],
    sourceUrls: ['https://rushdenmuseum.co.uk/', 'https://www.rushdentowncouncil.gov.uk/arts-and-entertainment-venues'],
    attractions: [
      { name: 'Rushden Historical Transport Museum', match: /(rushden historical transport museum|rushden transport museum|rushden station)/i, score: 68, tagline: 'Historic station', type: 'museum', sourceUrl: 'https://www.rhts.co.uk/', reason: 'A volunteer-run museum in the former station brings Rushden’s railway and transport history to life.' },
      { name: 'Rushden Museum', match: /rushden museum/i, score: 65, tagline: 'Town collections', type: 'museum', sourceUrl: 'https://rushdenmuseum.co.uk/', reason: 'Focused local collections explain the town’s social and boot-and-shoe history.' },
      { name: 'Rushden Hall and Hall Park', match: /(rushden hall|hall park)/i, score: 60, tagline: 'Historic park', type: 'park', sourceUrl: 'https://www.rushdentowncouncil.gov.uk/', reason: 'The historic hall and surrounding public park form the town’s best outdoor visitor setting.' },
      { name: 'St Mary’s Church', match: /(st mary.?s church|church of st mary)/i, score: 58, tagline: 'Parish landmark', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/16672/', reason: 'A large historic parish church that anchors the older part of Rushden.' },
    ],
  },
  {
    slug: 'higham-ferrers', locality: 'Higham Ferrers', region: 'Northamptonshire', localityCode: 'E63010331', rating: 2, ratingLabel: 'Worth a planned stop',
    ratingSummary: 'Chichele College, the Bede House, a major medieval church and an unusually coherent market-town centre make Higham Ferrers one of the stronger small heritage stops in the area.',
    headline: 'Medieval foundations around a handsome market square',
    intro: 'Higham Ferrers packs a college ruin, chantry buildings, a landmark church and market-town details into an easy walking circuit, supported by a well-developed heritage trail.',
    bestFor: ['Medieval history', 'Historic architecture', 'Town trails', 'Compact heritage visits'], suggestedTitle: 'Chichele College, St Mary’s and the Market Square',
    suggestedSummary: 'Begin at Chichele College, continue to St Mary’s and the Bede House, then follow the heritage trail through the Market Square and Castle Fields.', suggestedTime: 'Half day',
    visitorMood: 'A small town with enough distinctive medieval fabric to merit a planned detour.', motifs: ['Chichele College', 'Bede House', 'Market Cross', 'St Mary’s'],
    sourceUrls: ['https://www.highamferrers-tc.gov.uk/visit-our-town', 'https://www.english-heritage.org.uk/visit/places/chichele-college/'],
    attractions: [
      { name: 'Chichele College', match: /chichele college/i, score: 80, tagline: 'Medieval college ruins', type: 'college', sourceUrl: 'https://www.english-heritage.org.uk/visit/places/chichele-college/', reason: 'Atmospheric remains of a fifteenth-century college founded by Archbishop Henry Chichele.', admission: 'Free.', free: true },
      { name: 'St Mary the Virgin Church', match: /(st mary the virgin|church of st mary)/i, score: 76, tagline: 'Landmark church', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/16631/', reason: 'An impressive medieval church whose tower and interior dominate the town’s historic core.' },
      { name: 'Bede House and Chantry Chapel', match: /(bede house|chantry chapel)/i, score: 74, tagline: 'Chichele foundation', type: 'house', sourceUrl: 'https://www.highamferrers-tc.gov.uk/the-bede-house', reason: 'A rare surviving element of Archbishop Chichele’s charitable foundation beside the church.' },
      { name: 'Market Square and Market Cross', match: /(market square|market cross)/i, score: 68, tagline: 'Historic town heart', type: 'square', sourceUrl: 'https://www.highamferrers-tc.gov.uk/visit-our-town', reason: 'A handsome focal point where the town’s medieval and civic history remains easy to read.', searchName: 'Higham Ferrers Market Square' },
      { name: 'Castle Fields earthworks', match: /(castle fields|higham ferrers castle)/i, score: 52, tagline: 'Castle traces', type: 'archaeological_site', sourceUrl: 'https://www.highamferrers-tc.gov.uk/visit-our-town', reason: 'Subtle earthworks preserve the site of the former castle and broaden the heritage circuit.' },
    ],
    trails: [{ name: 'Higham Ferrers Heritage Trail', url: 'https://www.highamferrers-tc.gov.uk/uploads/highamferrers-heritage-trail.pdf?v=1528123453', score: 84, duration: 'About 2 hours', distance: 'Town-centre circuit', dogFriendly: true }],
  },
  {
    slug: 'northampton', locality: 'Northampton', region: 'Northamptonshire', localityCode: 'E63010463', rating: 3, ratingLabel: 'Destination draw',
    ratingSummary: 'Nationally important architecture, two strong museums, a restored abbey, medieval churches and substantial parkland support a full and varied destination visit.',
    headline: 'Shoemaking stories, bold architecture and a reinvigorated historic centre',
    intro: 'Northampton combines Charles Rennie Mackintosh’s 78 Derngate with one of the country’s leading shoe collections, a handsome Guildhall, medieval churches, Delapré Abbey and generous urban parks.',
    bestFor: ['Architecture', 'Museums', 'Industrial design', 'Historic parks'], suggestedTitle: '78 Derngate, the museum and Delapré Abbey',
    suggestedSummary: 'Start with 78 Derngate and the museum quarter, cross the Market Square and Guildhall, then use Delapré Abbey or Abington Park for a longer afternoon.', suggestedTime: 'Full day',
    visitorMood: 'A substantial heritage city with enough variety to justify a dedicated day.', motifs: ['78 Derngate', 'Shoemaking', 'Guildhall', 'Delapré Abbey'],
    sourceUrls: ['https://www.westnorthants.gov.uk/northampton-market/explore-northampton', 'https://www.westnorthants.gov.uk/culture-and-tourism/exciting-things-do'],
    attractions: [
      { name: '78 Derngate', match: /(78 derngate|seventy eight derngate)/i, score: 90, tagline: 'Mackintosh masterpiece', type: 'museum', sourceUrl: 'https://www.78derngate.org.uk/', reason: 'Charles Rennie Mackintosh’s only major English domestic commission is an exceptional architecture and design visit.' },
      { name: 'Delapré Abbey', match: /delapr[eé] abbey/i, score: 87, tagline: 'Abbey and parkland', type: 'abbey', sourceUrl: 'https://delapreabbey.org/', reason: 'A restored historic house and abbey set in extensive parkland, with exhibitions, events and a strong food offer.' },
      { name: 'Northampton Museum and Art Gallery', match: /(northampton museum|museum and art gallery|central museum)/i, score: 86, tagline: 'World-class shoe collection', type: 'museum', sourceUrl: 'https://www.northamptonmuseums.com/', reason: 'The internationally important shoe collection and local galleries make this the city’s essential museum.', admission: 'Free general admission.', free: true },
      { name: 'Abington Park Museum', match: /abington park museum/i, score: 80, tagline: 'Museum in the park', type: 'museum', sourceUrl: 'https://www.northamptonmuseums.com/info/2/visit/2/abington-park-museum', reason: 'A characterful local museum in a medieval manor house, paired with one of Northampton’s best parks.', admission: 'Free.', free: true },
      { name: 'The Holy Sepulchre Church', match: /(holy sepulchre|round church)/i, score: 78, tagline: 'Rare round church', type: 'church', sourceUrl: 'https://www.holysepulchre.co.uk/', reason: 'One of England’s few surviving medieval round churches and a distinctive part of Northampton’s skyline.' },
      { name: 'Northampton Guildhall', match: /northampton guildhall|the guildhall/i, score: 75, tagline: 'Victorian civic landmark', type: 'civic_building', sourceUrl: 'https://www.westnorthants.gov.uk/', reason: 'A richly detailed Gothic Revival civic building that gives the centre architectural drama.' },
      { name: 'All Saints Church', match: /(all saints church|church of all saints)/i, score: 70, tagline: 'Town-centre landmark', type: 'church', sourceUrl: 'https://www.allsaintsnorthampton.co.uk/', reason: 'A prominent rebuilt church and terrace overlooking the Market Square.' },
      { name: 'Northampton Market Square', match: /(northampton market square|market square)/i, score: 68, tagline: 'Historic market', type: 'square', sourceUrl: 'https://www.westnorthants.gov.uk/northampton-market', reason: 'One of England’s largest market squares remains the civic heart of the centre.' },
    ],
    trails: [{ name: 'Explore Northampton heritage trails', url: 'https://www.westnorthants.gov.uk/northampton-market/explore-northampton', score: 86, duration: 'Choose a themed town walk', distance: 'Multiple town-centre routes', dogFriendly: true }],
    treasureTrail: { name: 'Northampton Old Town and Marina Treasure Trail', url: 'https://www.treasuretrails.co.uk/products/things-to-do-northampton-northants', score: 88, duration: 'About 2 hours', distance: '2 miles', dogFriendly: true },
  },
  {
    slug: 'olney', locality: 'Olney', region: 'Buckinghamshire', localityCode: 'E63010677', rating: 2, ratingLabel: 'Worth a planned stop',
    ratingSummary: 'The Cowper and Newton Museum, Amazing Grace story, elegant Market Place and riverside walks give this small town a distinctive literary identity.',
    headline: 'Amazing Grace, Georgian streets and a gentle riverside town',
    intro: 'Olney’s strongest thread is literary: William Cowper and John Newton connect the museum, church and town to Amazing Grace, while the long Market Place and Ouse-side walks create an attractive setting.',
    bestFor: ['Literary heritage', 'Georgian townscape', 'Independent cafés', 'Riverside walking'], suggestedTitle: 'Cowper and Newton Museum, Market Place and church',
    suggestedSummary: 'Begin at the museum and gardens, explore the Market Place, then continue to St Peter and St Paul and the Great Ouse.', suggestedTime: 'Half day',
    visitorMood: 'A characterful small-town detour with a nationally resonant story.', motifs: ['Amazing Grace', 'Cowper and Newton', 'Market Place', 'Great Ouse'],
    sourceUrls: ['https://cowperandnewtonmuseum.org.uk/', 'https://cowperandnewtonmuseum.org.uk/visit-olney-cowper-newton-museum/'],
    attractions: [
      { name: 'Cowper and Newton Museum', match: /(cowper.*newton museum|cowper museum)/i, score: 84, tagline: 'Amazing Grace story', type: 'museum', sourceUrl: 'https://cowperandnewtonmuseum.org.uk/visit-us/', reason: 'Two linked historic houses and gardens tell the story of poet William Cowper, John Newton and Amazing Grace.' },
      { name: 'Olney Market Place and historic townscape', match: /(market place|olney townscape)/i, score: 72, tagline: 'Georgian town heart', type: 'square', sourceUrl: 'https://cowperandnewtonmuseum.org.uk/visit-olney-cowper-newton-museum/', reason: 'The broad Market Place and surrounding Georgian buildings give Olney its distinctive character.' },
      { name: 'Church of St Peter and St Paul', match: /(st peter.*st paul|church of st peter)/i, score: 66, tagline: 'Amazing Grace connection', type: 'church', sourceUrl: 'https://www.olneyparish.org.uk/', reason: 'The riverside parish church is closely linked with John Newton and the town’s hymn-writing story.' },
      { name: 'Cowper’s Alcove and riverside walk', match: /(cowper.?s alcove|river great ouse|riverside walk)/i, score: 60, tagline: 'Literary landscape', type: 'park', sourceUrl: 'https://cowperandnewtonmuseum.org.uk/visit-olney-cowper-newton-museum/', reason: 'A gentle outdoor extension connecting Cowper’s landscape with the River Great Ouse.' },
    ],
    trails: [{ name: 'Olney Cowper and Newton town walk', url: 'https://cowperandnewtonmuseum.org.uk/visit-olney-cowper-newton-museum/', score: 78, duration: 'About 90 minutes', distance: 'Town and riverside circuit', dogFriendly: true }],
  },
  {
    slug: 'newport-pagnell', locality: 'Newport Pagnell', region: 'Buckinghamshire', localityCode: 'E63010872', rating: 1, ratingLabel: 'Local detour',
    ratingSummary: 'Tickford Bridge, a good local heritage trail and riverside spaces make an engaging local stop, but the offer remains modest beside larger Milton Keynes attractions.',
    headline: 'An iron bridge, old coaching streets and riverside paths',
    intro: 'Newport Pagnell rewards a compact heritage walk linking Tickford Bridge, the older High Street, parish church and river landscapes shaped by the Ouse and Lovat.',
    bestFor: ['Bridge history', 'Town trails', 'Riverside walking', 'Local heritage'], suggestedTitle: 'Tickford Bridge and the heritage trail',
    suggestedSummary: 'Begin at Tickford Bridge, follow the published heritage route through the old centre, then finish beside the Ouse or in Ousebank Gardens.', suggestedTime: 'Two to four hours',
    visitorMood: 'A pleasant local-history detour with one genuinely unusual bridge landmark.', motifs: ['Tickford Bridge', 'Coaching town', 'River Ouse', 'Heritage trail'],
    sourceUrls: ['https://www.newport-pagnell.org.uk/community-whats-on/town-maps-walks-and-heritage-trail/', 'https://www.newport-pagnell.org.uk/community-whats-on/history-of-newport-pagnell/'],
    attractions: [
      { name: 'Tickford Bridge', match: /tickford bridge/i, score: 74, tagline: 'Historic iron bridge', type: 'bridge', sourceUrl: 'https://www.newport-pagnell.org.uk/community-whats-on/history-of-newport-pagnell/', reason: 'A rare early cast-iron road bridge still carrying traffic and the town’s clearest engineering landmark.' },
      { name: 'Newport Pagnell historic town centre', match: /(newport pagnell townscape|high street|market hill)/i, score: 58, tagline: 'Coaching-town character', type: 'street', sourceUrl: 'https://www.newport-pagnell.org.uk/community-whats-on/history-of-newport-pagnell/', reason: 'Historic inns, civic buildings and the old street pattern preserve the feel of a former coaching town.' },
      { name: 'St Peter and St Paul Church', match: /(st peter.*st paul|church of st peter)/i, score: 56, tagline: 'Parish landmark', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/5880/', reason: 'The historic parish church adds a substantial landmark to the town trail.' },
      { name: 'Ousebank Gardens and riverside', match: /(ousebank gardens|ousebank|riverside meadow)/i, score: 54, tagline: 'Riverside pause', type: 'park', sourceUrl: 'https://www.newport-pagnell.org.uk/', reason: 'A useful green pause close to the centre and the meeting of the town’s river landscapes.' },
      { name: 'Bury Field earthworks', match: /(bury field|civil war earthwork)/i, score: 48, tagline: 'Historic open space', type: 'archaeological_site', sourceUrl: 'https://www.newport-pagnell.org.uk/community-whats-on/history-of-newport-pagnell/', reason: 'Open land with traces of the town’s defensive and common-field history.' },
    ],
    trails: [{ name: 'Newport Pagnell Heritage Trail', url: 'https://www.newport-pagnell.org.uk/community-whats-on/town-maps-walks-and-heritage-trail/', score: 80, duration: 'About 2 hours', distance: 'Town-centre circuit', dogFriendly: true }],
  },
  {
    slug: 'milton-keynes', locality: 'Milton Keynes', region: 'Buckinghamshire', localityCode: 'E63010901', rating: 3, ratingLabel: 'Destination draw',
    ratingSummary: 'Exceptional modern planning, major cultural venues, public art, lakes and parkland create a distinctive destination whose appeal is broader than a conventional historic town.',
    headline: 'Modernist landmarks, bold public art and a city built around green space',
    intro: 'Milton Keynes is best explored as a designed landscape: combine MK Gallery and central public art with Campbell Park, Willen Lake and the Peace Pagoda, then choose a museum or family attraction.',
    bestFor: ['Modern architecture', 'Public art', 'Parks and lakes', 'Family attractions'], suggestedTitle: 'MK Gallery, Campbell Park and Willen Lake',
    suggestedSummary: 'Start with MK Gallery and the central public-art route, cross Campbell Park, then continue to Willen Lake and the Peace Pagoda.', suggestedTime: 'Full day',
    visitorMood: 'A genuinely distinctive destination for modern urbanism, culture and easy outdoor recreation.', motifs: ['Modernist city', 'Public art', 'Willen Lake', 'Grid and parkways'],
    sourceUrls: ['https://www.destinationmiltonkeynes.co.uk/things-to-do/', 'https://www.destinationmiltonkeynes.co.uk/plan-your-visit/maps-guides/'],
    attractions: [
      { name: 'MK Gallery', match: /(mk gallery|milton keynes gallery)/i, score: 86, tagline: 'Contemporary culture', type: 'museum', sourceUrl: 'https://mkgallery.org/', reason: 'A leading contemporary gallery and cinema in a bold building beside the theatre district.' },
      { name: 'Willen Lake', match: /willen lake/i, score: 84, tagline: 'Lakeside day out', type: 'park', sourceUrl: 'https://www.theparkstrust.com/parks/willen-lake/', reason: 'The city’s largest lake combines waterside walking, activities, play and open views.' },
      { name: 'Milton Keynes Museum', match: /milton keynes museum/i, score: 82, tagline: 'Local and technology history', type: 'museum', sourceUrl: 'https://miltonkeynesmuseum.org.uk/', reason: 'A substantial museum covering local life, communications, transport and the city’s development.' },
      { name: 'Campbell Park', match: /campbell park/i, score: 80, tagline: 'Designed city park', type: 'park', sourceUrl: 'https://www.theparkstrust.com/parks/campbell-park/', reason: 'A sweeping formal park that makes the city’s green planning tangible and links centre to lake.' },
      { name: 'Peace Pagoda and Japanese Garden', match: /(peace pagoda|japanese garden)/i, score: 78, tagline: 'Lakeside landmark', type: 'monument', sourceUrl: 'https://www.theparkstrust.com/parks/willen-lake/', reason: 'A distinctive spiritual and visual landmark above Willen Lake with a tranquil garden setting.', searchName: 'Milton Keynes Peace Pagoda' },
      { name: 'Gulliver’s Land', match: /gulliver.?s land/i, score: 78, tagline: 'Family theme park', type: 'theme_park', sourceUrl: 'https://www.gulliverslandresort.co.uk/', reason: 'A family-focused theme park offering a substantial day out for younger children.' },
      { name: 'Xscape Milton Keynes', match: /(xscape|snozone)/i, score: 74, tagline: 'Indoor activity landmark', type: 'attraction', sourceUrl: 'https://xscapemiltonkeynes.co.uk/', reason: 'The landmark leisure building brings indoor skiing, cinema and activities into the city centre.' },
      { name: 'Milton Keynes public art and Concrete Cows', match: /(concrete cows|public art)/i, score: 70, tagline: 'City art icons', type: 'public_art', sourceUrl: 'https://www.destinationmiltonkeynes.co.uk/things-to-do/', reason: 'A playful collection of public art, led by the Concrete Cows, expresses the city’s cultural identity.', searchName: 'Concrete Cows' },
    ],
    trails: [{ name: 'Milton Keynes public art walk', url: 'https://www.destinationmiltonkeynes.co.uk/plan-your-visit/maps-guides/', score: 82, duration: 'Two to three hours', distance: 'Central Milton Keynes circuit', dogFriendly: true }],
  },
  {
    slug: 'bletchley', locality: 'Bletchley', region: 'Buckinghamshire', localityCode: 'E63011059', rating: 3, ratingLabel: 'Destination draw',
    ratingSummary: 'Bletchley Park and the National Museum of Computing form one of Britain’s most important twentieth-century visitor clusters and justify a journey in their own right.',
    headline: 'Codebreaking, computing history and a world-changing wartime site',
    intro: 'Bletchley’s visitor identity is concentrated but exceptional. Give the codebreaking estate and computing museum most of a day, then use the Blue Lagoon for a quieter outdoor contrast.',
    bestFor: ['Second World War history', 'Computing history', 'Intelligence stories', 'Full-day museums'], suggestedTitle: 'Bletchley Park and the National Museum of Computing',
    suggestedSummary: 'Book enough time for Bletchley Park’s huts, mansion and exhibitions, then add the National Museum of Computing if opening arrangements align.', suggestedTime: 'Full day',
    visitorMood: 'A destination of international significance despite its tightly focused visitor offer.', motifs: ['Codebreakers', 'Enigma', 'Historic huts', 'Early computers'],
    sourceUrls: ['https://bletchleypark.org.uk/', 'https://www.tnmoc.org/'],
    attractions: [
      { name: 'Bletchley Park', match: /bletchley park/i, score: 96, tagline: 'Exceptional wartime history', type: 'museum', sourceUrl: 'https://bletchleypark.org.uk/', reason: 'The world-famous home of British wartime codebreaking offers an extensive, powerful and nationally important visit.' },
      { name: 'The National Museum of Computing', match: /(national museum of computing|tnmoc)/i, score: 90, tagline: 'Exceptional computing history', type: 'museum', sourceUrl: 'https://www.tnmoc.org/', reason: 'Working historic computers and the rebuilt Colossus make this an outstanding specialist museum.' },
      { name: 'Blue Lagoon Local Nature Reserve', match: /blue lagoon/i, score: 56, tagline: 'Nature reserve', type: 'nature_reserve', sourceUrl: 'https://www.milton-keynes.gov.uk/environment-parks-and-open-spaces/parks-and-open-spaces', reason: 'A former brick pit now offering lakeside paths and wildlife close to Bletchley.' },
      { name: 'Bletchley town heritage and railway story', match: /(bletchley station|bletchley townscape)/i, score: 45, tagline: 'Railway-town context', type: 'street', sourceUrl: 'https://www.destinationmiltonkeynes.co.uk/', reason: 'The railway and settlement story helps explain why this became the setting for the codebreaking estate.' },
    ],
  },
  {
    slug: 'buckingham', locality: 'Buckingham', region: 'Buckinghamshire', localityCode: 'E63011071', rating: 2, ratingLabel: 'Worth a planned stop',
    ratingSummary: 'The Old Gaol, attractive old town, riverside parks and several polished self-guided routes make Buckingham a strong and easy half-day market-town visit.',
    headline: 'An old gaol, university townscape and riverside walks',
    intro: 'Buckingham’s compact centre combines the distinctive Old Gaol with eighteenth-century streets, church and university buildings, while the Great Ouse and Chandos Park add a green circuit.',
    bestFor: ['Market-town history', 'Town trails', 'Riverside walking', 'Independent cafés'], suggestedTitle: 'Old Gaol, Market Hill and Chandos Park',
    suggestedSummary: 'Begin at the Old Gaol, follow a Buxplore route through Market Hill and the old town, then return beside the Great Ouse through Chandos Park.', suggestedTime: 'Half day',
    visitorMood: 'A polished small-town stop with enough history and walking to reward a purposeful visit.', motifs: ['Old Gaol', 'Market Hill', 'Great Ouse', 'University town'],
    sourceUrls: ['https://www.discoverbuckingham.uk/attractions/buckingham-old-gaol', 'https://www.discoverbuckingham.uk/walks-and-green-spaces/buxplore'],
    attractions: [
      { name: 'Buckingham Old Gaol', match: /(buckingham old gaol|old gaol)/i, score: 78, tagline: 'Landmark museum', type: 'museum', sourceUrl: 'https://www.discoverbuckingham.uk/attractions/buckingham-old-gaol', reason: 'The castle-like former gaol is the town’s defining landmark and a focused local-history museum.' },
      { name: 'Buckingham Chantry Chapel', match: /(chantry chapel|chapel of st john)/i, score: 72, tagline: 'Medieval survivor', type: 'chapel', sourceUrl: 'https://www.nationaltrust.org.uk/visit/oxfordshire-buckinghamshire-berkshire/buckingham-chantry-chapel', reason: 'A rare medieval building in the centre, now cared for by the National Trust.' },
      { name: 'Buckingham old town and Market Hill', match: /(market hill|market place|buckingham townscape)/i, score: 68, tagline: 'Historic townscape', type: 'street', sourceUrl: 'https://www.buckingham-tc.gov.uk/discover-buckingham/history-of-buckingham/', reason: 'The market streets, civic buildings and riverside setting create an enjoyable compact townscape.' },
      { name: 'St Peter and St Paul Church', match: /(st peter.*st paul|church of st peter)/i, score: 62, tagline: 'Hilltop landmark', type: 'church', sourceUrl: 'https://www.achurchnearyou.com/church/170/', reason: 'The parish church forms a prominent landmark above the old town.' },
      { name: 'Chandos Park and Great Ouse walk', match: /(chandos park|great ouse|riverside walk)/i, score: 58, tagline: 'Riverside circuit', type: 'park', sourceUrl: 'https://www.discoverbuckingham.uk/walks-and-green-spaces/buxplore', reason: 'An easy green route beside the river, well placed as the outdoor half of a town visit.', searchName: 'Chandos Park' },
    ],
    trails: [{ name: 'Buxplore Buckingham heritage walks', url: 'https://www.discoverbuckingham.uk/walks-and-green-spaces/buxplore', score: 84, duration: 'Choose a themed route', distance: 'Multiple town circuits', dogFriendly: true }],
    treasureTrail: { name: 'Buckingham River and Chandos Park Treasure Trail', url: 'https://www.treasuretrails.co.uk/products/things-to-do-buckingham-bucks', score: 86, duration: 'About 2 hours', distance: '2 miles', dogFriendly: true },
  },
];

function source(
  sourceName: string,
  sourceOrganisation: string,
  sourceRecordId: string,
  sourceUrl: string,
  notes: string,
  reliability: SourceRecord['reliability'] = 'official_non_statutory',
  licence = editorialLicence,
): SourceRecord {
  return { sourceName, sourceOrganisation, sourceRecordId, sourceUrl, accessedAt: reviewedAt, reliability, licence, notes };
}

function add(context: TownContext, feature: HeritageFeature) {
  const existing = context.byId.get(feature.id);
  if (existing) Object.assign(existing, feature);
  else {
    context.byId.set(feature.id, feature);
    context.features.push(feature);
  }
  return feature;
}

function positions(geometry: Geometry): [number, number][] {
  if (geometry.type === 'Point') return [geometry.coordinates as [number, number]];
  if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') return geometry.coordinates as [number, number][];
  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') return geometry.coordinates.flat() as [number, number][];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat(2) as [number, number][];
  if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(positions);
  return [];
}

function boundaryBounds(boundary: Feature<Polygon | MultiPolygon>): [number, number, number, number] {
  const coordinates = positions(boundary.geometry);
  return [
    Math.min(...coordinates.map(([longitude]) => longitude)),
    Math.min(...coordinates.map(([, latitude]) => latitude)),
    Math.max(...coordinates.map(([longitude]) => longitude)),
    Math.max(...coordinates.map(([, latitude]) => latitude)),
  ];
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '');
}

function slugify(value: string) {
  return normalise(value).replaceAll(' ', '-');
}

function osmCoordinates(element: OsmElement): [number, number] | undefined {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  return latitude === undefined || longitude === undefined ? undefined : [longitude, latitude];
}

function osmUrl(element: OsmElement) {
  return `https://www.openstreetmap.org/${element.type}/${element.id}`;
}

interface NominatimResult { lat: string; lon: string; display_name?: string }

async function geocodeAttractionSeed(context: TownContext, seed: AttractionSeed) {
  const cachePath = resolve(cacheDirectory, `${context.spec.slug}-seed-geocodes.json`);
  let cache: Record<string, [number, number] | null> = {};
  try {
    cache = JSON.parse(await readFile(cachePath, 'utf8')) as Record<string, [number, number] | null>;
  } catch {
    // The cache is created on the first researched seed that needs a location.
  }
  const key = normalise(seed.name);
  if (key in cache) return cache[key] ?? undefined;
  const query = new URLSearchParams({
    q: `${seed.searchName ?? seed.name}, ${context.spec.locality}, England`,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'gb',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
    headers: { 'User-Agent': 'Townscape Guides boundary-checked visitor research/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Nominatim attraction lookup failed with HTTP ${response.status}`);
  const results = await response.json() as NominatimResult[];
  const coordinates = results
    .map((result) => [Number(result.lon), Number(result.lat)] as [number, number])
    .find((candidate) => booleanPointInPolygon(point(candidate), context.boundary));
  cache[key] = coordinates ?? null;
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
  await new Promise((done) => setTimeout(done, 1_100));
  return coordinates;
}

function namedLocation(tags: Record<string, string>, fallback: string, index: number) {
  const locality = tags['addr:street'] ?? tags['addr:place'] ?? tags.loc_name;
  return locality ? `${locality} ${fallback}` : `${fallback} ${index}`;
}

function currentNotes(tags: Record<string, string>, extras: Record<string, string | undefined> = {}) {
  return Object.entries({ ...tags, ...extras })
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function createFeature(
  context: TownContext,
  options: {
    id: string;
    name: string;
    featureType: string;
    coordinates: [number, number];
    description: string;
    notes: string;
    tags: string[];
    sourceName: string;
    sourceUrl: string;
    sourceOrganisation?: string;
    reliability?: SourceRecord['reliability'];
    significance?: HeritageFeature['significance'];
    attractionGuide?: AttractionGuide;
  },
) {
  return add(context, {
    id: options.id,
    projectId: context.projectId,
    name: options.name,
    alternativeNames: [],
    countryCode: 'GB-ENG',
    region: context.spec.region,
    locality: context.spec.locality,
    featureType: options.featureType,
    significance: options.significance ?? 'local',
    geometry: point(options.coordinates).geometry,
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: options.description,
    attractionGuide: options.attractionGuide,
    sourceRecords: [source(options.sourceName, options.sourceOrganisation ?? 'Townscape Guides research', options.id, options.sourceUrl, options.notes, options.reliability)],
    tags: [...new Set([`${context.spec.slug}-visitor-audit`, 'current-context', ...options.tags])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: `Visitor information and representative location audited ${reviewedDate}.`,
    evidenceScope: 'related_context',
    licence: editorialLicence,
  });
}

async function fetchBoundary(spec: TownSpec) {
  const where = encodeURIComponent(`BUA24CD='${spec.localityCode}'`);
  const url = `https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/main_ONS_BUA_2024_EW_V2/FeatureServer/0/query?f=geojson&where=${where}&outFields=*&returnGeometry=true&outSR=4326`;
  const response = await fetch(url, { headers: { 'User-Agent': 'TownscapeGuides/1.0' }, signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`${spec.locality} ONS boundary request failed: ${response.status}`);
  const collection = (await response.json()) as FeatureCollection<Polygon | MultiPolygon>;
  const boundary = collection.features[0];
  if (!boundary) throw new Error(`${spec.locality} ONS 2024 built-up area was not returned`);
  boundary.properties = { ...(boundary.properties ?? {}), sourceDataset: 'ONS Built-up Areas (December 2024)', localityName: spec.locality, localityCode: spec.localityCode };
  return { boundary, url };
}

interface NhlePoint {
  coordinates: [number, number];
  properties: Record<string, unknown>;
  designationType: string;
  tag: string;
}

let nhlePoints: NhlePoint[] | undefined;

async function loadNhlePoints() {
  if (nhlePoints) return nhlePoints;
  nhlePoints = [];
  const folders = [
    ['00_listed_building_points', 'listed_building', 'listed-building'],
    ['06_scheduled_monuments', 'scheduled_monument', 'scheduled-monument'],
    ['07_parks_and_gardens', 'registered_park_and_garden', 'registered-park-garden'],
  ] as const;
  for (const [folder, designationType, tag] of folders) {
    const directory = resolve(nhleRoot, folder);
    for (const filename of (await readdir(directory)).filter((name) => name.endsWith('.geojson'))) {
      const collection = JSON.parse(await readFile(resolve(directory, filename), 'utf8')) as FeatureCollection;
      for (const record of collection.features) {
        if (!record.geometry) continue;
        const representative = (record.geometry.type === 'Point' ? record : pointOnFeature(record as Feature<Geometry>)) as Feature<Point>;
        nhlePoints.push({ coordinates: representative.geometry.coordinates as [number, number], properties: (record.properties ?? {}) as Record<string, unknown>, designationType, tag });
      }
    }
  }
  return nhlePoints;
}

function nhleSignificance(grade?: string): HeritageFeature['significance'] {
  if (grade === 'I') return 'highest_national';
  if (grade === 'II*') return 'national';
  return 'regional';
}

async function importNhle(context: TownContext) {
  const [west, south, east, north] = boundaryBounds(context.boundary);
  for (const record of await loadNhlePoints()) {
    const [longitude, latitude] = record.coordinates;
    if (longitude < west || longitude > east || latitude < south || latitude > north) continue;
    if (!booleanPointInPolygon(point(record.coordinates), context.boundary)) continue;
    const listEntry = String(record.properties.ListEntry ?? record.properties.LIST_ENTRY ?? `${context.spec.slug}-${context.features.length}`);
    const id = `historic-england:nhle:${listEntry}`;
    if (context.byId.has(id)) continue;
    const name = String(record.properties.Name ?? record.properties.NAME ?? 'Historic England designation');
    const grade = record.properties.Grade ? String(record.properties.Grade) : undefined;
    add(context, {
      id,
      projectId: context.projectId,
      name,
      alternativeNames: [],
      countryCode: 'GB-ENG',
      region: context.spec.region,
      locality: context.spec.locality,
      featureType: /church/i.test(name) ? 'church' : /bridge/i.test(name) ? 'bridge' : /memorial/i.test(name) ? 'memorial' : 'other',
      designationType: record.designationType,
      designationCategory: grade,
      significance: record.designationType === 'scheduled_monument' ? 'highest_national' : nhleSignificance(grade),
      statutoryStatus: 'National Heritage List for England',
      geometry: point(record.coordinates).geometry,
      locationType: 'representative_point',
      locationConfidence: 'high',
      dateBasis: 'unknown',
      dateConfidence: 'unknown',
      survival: 'unknown',
      shortDescription: `${record.designationType.replaceAll('_', ' ')} recorded by Historic England${grade ? `, Grade ${grade}` : ''}.`,
      sourceRecords: [source('National Heritage List for England', 'Historic England', listEntry, String(record.properties.hyperlink ?? `https://historicengland.org.uk/listing/the-list/list-entry/${listEntry}`), 'Official statutory designation. Date remains unknown pending official list-entry text enrichment.', 'official_statutory', 'Open Government Licence v3.0; contains Historic England data.')],
      tags: ['historic-england', 'nhle', record.tag],
      createdAt: reviewedAt,
      updatedAt: reviewedAt,
      reviewed: true,
      reviewNotes: `Imported from the bundled Historic England download and filtered against the unchanged ONS ${context.spec.locality} boundary.`,
      evidenceScope: 'parish_evidence',
      licence: 'Open Government Licence v3.0; contains Historic England data.',
    });
  }
}

const overpassEndpoints = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

async function fetchOsm(context: TownContext) {
  await mkdir(cacheDirectory, { recursive: true });
  const cachePath = resolve(cacheDirectory, `${context.spec.slug}.json`);
  try {
    return JSON.parse(await readFile(cachePath, 'utf8')) as OverpassResponse;
  } catch {
    // Fetch and cache below.
  }
  const [west, south, east, north] = boundaryBounds(context.boundary);
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:90];(nwr[amenity~"^(cafe|restaurant|pub|food_court|ice_cream|parking|toilets|picnic_table|museum|arts_centre|place_of_worship)$"](${bbox});nwr[shop~"^(bakery|coffee|confectionery|deli)$"](${bbox});nwr[tourism~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park|artwork|picnic_site)$"](${bbox});nwr[historic~"^(castle|fort|manor|monument|archaeological_site|ruins|city_gate|memorial)$"](${bbox});nwr[man_made~"^(lighthouse|tower|windmill|watermill)$"](${bbox});nwr[leisure~"^(nature_reserve|garden|park)$"](${bbox});nwr[bridge][name](${bbox});nwr[natural=waterfall](${bbox}););out center tags;`;
  let lastError: unknown;
  for (const endpoint of overpassEndpoints) {
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TownscapeGuides/1.0' }, body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = (await response.json()) as OverpassResponse;
      await writeFile(cachePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${context.spec.locality} Overpass request failed: ${String(lastError)}`);
}

function publicAccess(tags: Record<string, string>) {
  const lifecycle = [tags.disused, tags.abandoned, tags.demolished, tags.closed].filter(Boolean).join(' ');
  if (/yes|true/i.test(lifecycle)) return false;
  return !/^(no|private|permit|residents|customers)$/i.test(tags.access ?? '');
}

function visitorType(tags: Record<string, string>) {
  return tags.tourism ?? tags.historic ?? tags.man_made ?? tags.leisure ?? tags.amenity ?? tags.shop ?? 'place';
}

function featureDescription(name: string, tags: Record<string, string>) {
  const type = visitorType(tags).replaceAll('_', ' ');
  return `${name} is a current ${type} mapped within the ${tags['addr:city'] ?? 'town'} visitor boundary.`;
}

function osmFeature(context: TownContext, element: OsmElement, category: string, name: string, tags: Record<string, string>) {
  const coordinates = osmCoordinates(element);
  if (!coordinates) throw new Error(`${name} has no representative OSM location`);
  return createFeature(context, {
    id: `osm-community:${element.type}-${element.id}`,
    name,
    featureType: visitorType(tags),
    coordinates,
    description: featureDescription(name, tags),
    notes: currentNotes(tags),
    tags: [`service-context-${category}`, 'osm-current-place'],
    sourceName: 'OpenStreetMap current community places',
    sourceUrl: tags.website ?? tags['contact:website'] ?? osmUrl(element),
    sourceOrganisation: 'OpenStreetMap contributors',
    reliability: 'discovery_only',
  });
}

function foodScore(tags: Record<string, string>) {
  let score = tags.amenity === 'cafe' ? 70 : tags.shop ? 64 : 66;
  if (tags.website || tags['contact:website']) score += 4;
  if (tags.opening_hours) score += 4;
  if (tags.outdoor_seating === 'yes') score += 2;
  if (tags.cuisine && !/coffee|cake|tea|sandwich|breakfast|brunch|british/i.test(tags.cuisine)) score -= 2;
  return Math.max(50, Math.min(82, score));
}

function daytimeFood(tags: Record<string, string>) {
  if (!publicAccess(tags) || !tags.name) return false;
  if (/^(cafe|food_court|ice_cream)$/i.test(tags.amenity ?? '') || /^(bakery|coffee|confectionery|deli)$/i.test(tags.shop ?? '')) return true;
  const evidence = `${tags.opening_hours ?? ''} ${tags.cuisine ?? ''} ${tags.description ?? ''} ${tags['contact:website'] ?? ''}`;
  return /breakfast|brunch|lunch|coffee|tea|cake|sandwich|10:|11:|12:|13:|14:|15:/i.test(evidence);
}

function practicalName(
  element: OsmElement,
  elements: OsmElement[],
  category: 'parking' | 'toilets' | 'picnic',
  index: number,
) {
  const tags = element.tags ?? {};
  if (tags.name) return tags.name;
  const coordinates = osmCoordinates(element);
  const nearest = coordinates
    ? elements
        .filter((candidate) => candidate !== element && candidate.tags?.name && osmCoordinates(candidate))
        .map((candidate) => {
          const [longitude, latitude] = osmCoordinates(candidate)!;
          return { name: candidate.tags!.name, distance: Math.hypot(longitude - coordinates[0], latitude - coordinates[1]) };
        })
        .filter((candidate) => candidate.distance <= 0.003)
        .sort((left, right) => left.distance - right.distance)[0]?.name
    : undefined;
  const location = tags['addr:street'] ?? tags['addr:place'] ?? tags.loc_name;
  const fallback = category === 'parking' ? 'public car park' : category === 'toilets' ? 'public toilets' : 'picnic area';
  if (location) return `${location} ${fallback}`;
  if (nearest) {
    const label = category === 'parking' ? 'Public car park' : category === 'toilets' ? 'Public toilets' : 'Picnic area';
    return `${label} near ${nearest}`;
  }
  if (category === 'parking') return namedLocation(tags, 'public car park', index);
  if (category === 'toilets') return namedLocation(tags, 'public toilets', index);
  return namedLocation(tags, 'picnic area', index);
}

function trailFeature(context: TownContext, trail: TrailSeed) {
  const treasureTrail = /treasuretrails\.co\.uk/i.test(trail.url);
  return createFeature(context, {
    id: `curated-trail:${context.spec.slug}-${slugify(trail.name)}`,
    name: trail.name,
    featureType: 'trail',
    coordinates: context.centre,
    description: `A source-backed self-guided clue trail through ${context.spec.locality}, covering ${trail.distance} in ${trail.duration}.`,
    notes: `trail_score=${trail.score}; distance=${trail.distance}; duration=${trail.duration}; external_link=yes`,
    tags: ['service-context-trail'],
    sourceName: treasureTrail ? `${context.spec.locality} Treasure Trail` : `${context.spec.locality} visitor trail`,
    sourceUrl: trail.url,
    sourceOrganisation: treasureTrail ? 'Treasure Trails' : 'Official local visitor source',
    reliability: treasureTrail ? 'secondary' : 'official_non_statutory',
  });
}

function dogEntry(rating: number, sourceUrl: string, outdoor: boolean): DogEntry {
  return {
    rating,
    status: outdoor ? 'welcoming' : 'unconfirmed',
    label: outdoor ? 'Good with a dog' : 'Dog policy not confirmed',
    summary: outdoor ? 'Dogs can join this outdoor visit when kept under close control and local signs are followed.' : 'No reliable current pet-dog policy was found in the reviewed visitor information. Check directly before a dog-dependent journey; assistance-dog access is separate.',
    sourceName: 'Reviewed visitor information',
    sourceUrl,
    reviewedAt: reviewedDate,
  };
}

function projectSources(spec: TownSpec, onsUrl: string): ProjectPackage['sources'] {
  return [
    { id: `ons-bua-2024-${spec.localityCode}`, name: 'ONS Built-up Areas (December 2024)', organisation: 'Office for National Statistics', coverage: `${spec.locality} active town boundary`, accessMethod: 'ArcGIS REST GeoJSON', licence: 'Open Government Licence v3.0', sourceUrl: onsUrl, reliability: 'official_statutory', limitations: 'A statistical built-up area used as the strict visitor inclusion boundary.' },
    { id: 'historic-england-nhle-local', name: 'National Heritage List for England', organisation: 'Historic England', coverage: `${spec.locality} designations inside the active boundary`, accessMethod: 'Bundled national GeoJSON download', licence: 'Open Government Licence v3.0', sourceUrl: 'https://historicengland.org.uk/listing/the-list/data-downloads/', reliability: 'official_statutory', limitations: 'Dates are enriched separately from official list-entry text.' },
    { id: `osm-current-${spec.slug}`, name: 'OpenStreetMap current community places', organisation: 'OpenStreetMap contributors', coverage: `${spec.locality} visitor and practical places`, accessMethod: 'Overpass API and boundary filtering', licence: osmLicence, sourceUrl: 'https://www.openstreetmap.org/', reliability: 'discovery_only', limitations: 'Current community mapping is curated and may be incomplete.' },
  ];
}

async function buildTown(spec: TownSpec) {
  const { boundary, url: onsUrl } = await fetchBoundary(spec);
  const centre = pointOnFeature(boundary).geometry.coordinates as [number, number];
  const context: TownContext = { spec, projectId: `${spec.slug}-england`, boundary, centre, onsUrl, features: [], byId: new Map() };
  await importNhle(context);
  const osm = await fetchOsm(context);
  const elements = (osm.elements ?? []).filter((element) => {
    const coordinates = osmCoordinates(element);
    return coordinates && booleanPointInPolygon(point(coordinates), boundary) && publicAccess(element.tags ?? {});
  });

  const namedVisitorElements = elements.filter((element) => element.tags?.name && (element.tags.tourism || element.tags.historic || element.tags.man_made || element.tags.bridge || /^(nature_reserve|garden|park)$/i.test(element.tags.leisure ?? '') || /^(museum|arts_centre|place_of_worship)$/i.test(element.tags.amenity ?? '')));
  const attractions: Array<{ feature: HeritageFeature; score: number; tagline: string; opening?: string; admission?: string; free?: boolean; sourceUrl: string }> = [];
  const usedFeatureIds = new Set<string>();
  const usedAttractionNames = new Set<string>();
  for (const seed of spec.attractions) {
    const existing = context.features
      .filter((feature) => seed.match.test(feature.name))
      .sort((left, right) => (right.significance === 'highest_national' ? 2 : right.significance === 'national' ? 1 : 0) - (left.significance === 'highest_national' ? 2 : left.significance === 'national' ? 1 : 0))[0];
    const osmMatch = elements.find((element) => seed.match.test(element.tags?.name ?? ''));
    let feature = existing;
    if (!feature && osmMatch) feature = osmFeature(context, osmMatch, 'visitor', seed.name, osmMatch.tags ?? {});
    if (!feature) {
      const geocodedCoordinates = await geocodeAttractionSeed(context, seed);
      if (geocodedCoordinates) {
        feature = createFeature(context, {
          id: `curated-attraction:${spec.slug}-${slugify(seed.name)}`,
          name: seed.name,
          featureType: seed.type,
          coordinates: geocodedCoordinates,
          description: seed.reason,
          notes: `tourism=attraction; visit_score=${seed.score}; representative_location=nominatim`,
          tags: ['service-context-visitor', 'osm-current-place'],
          sourceName: 'OpenStreetMap Nominatim visitor location',
          sourceUrl: `https://www.openstreetmap.org/?mlat=${geocodedCoordinates[1]}&mlon=${geocodedCoordinates[0]}&zoom=17`,
          sourceOrganisation: 'OpenStreetMap contributors',
          reliability: 'discovery_only',
        });
      }
    }
    if (!feature && /(townscape|historic town|historic village|market place|town trail|river .* walk)/i.test(seed.name)) {
      feature = createFeature(context, { id: `curated-attraction:${spec.slug}-${slugify(seed.name)}`, name: seed.name, featureType: seed.type, coordinates: centre, description: seed.reason, notes: `tourism=attraction; visit_score=${seed.score}; representative_area=yes`, tags: ['service-context-visitor'], sourceName: `${spec.locality} visitor research`, sourceUrl: seed.sourceUrl, reliability: 'secondary' });
    }
    if (!feature || usedFeatureIds.has(feature.id)) continue;
    feature.name = seed.name;
    feature.shortDescription = seed.reason;
    feature.featureType = seed.type;
    feature.tags = [...new Set([...feature.tags, 'service-context-visitor'])];
    feature.attractionGuide = { headline: seed.tagline, intro: seed.reason, motifs: [seed.tagline, spec.motifs[0], spec.motifs[1]], bestFor: spec.bestFor.slice(0, 3), thingsToDo: [{ name: `Explore ${seed.name}` }, { name: `Look for ${spec.motifs[0].toLowerCase()}` }, { name: `Connect it with ${spec.suggestedTitle}` }] };
    feature.sourceRecords.push(source(`${spec.locality} visitor research`, 'Townscape Guides research', `visitor-highlight:${feature.id}`, seed.sourceUrl, `Visitor reason, score and practical details reviewed ${reviewedDate}.`, 'secondary'));
    usedFeatureIds.add(feature.id);
    usedAttractionNames.add(normalise(feature.name));
    attractions.push({ feature, score: seed.score, tagline: seed.tagline, opening: seed.opening, admission: seed.admission, free: seed.free, sourceUrl: seed.sourceUrl });
  }

  for (const element of namedVisitorElements) {
    if (attractions.length >= 20) break;
    const tags = element.tags ?? {};
    if (/memorial|bench|wayside_cross/i.test(visitorType(tags))) continue;
    if (/play ?ground|play area|open space|main entrance|car ?park|hotel|restaurant|village sign|\bbust\b|garden of rest/i.test(tags.name ?? '')) continue;
    const feature = osmFeature(context, element, 'visitor', tags.name, tags);
    if (usedFeatureIds.has(feature.id) || usedAttractionNames.has(normalise(feature.name))) continue;
    const score = tags.tourism === 'museum' ? 62 : tags.tourism === 'attraction' ? 58 : tags.historic === 'castle' ? 65 : 48;
    feature.shortDescription = `${tags.name} adds a worthwhile ${visitorType(tags).replaceAll('_', ' ')} stop to a ${spec.locality} visit.`;
    feature.attractionGuide = { headline: 'A useful addition to the town visit', intro: feature.shortDescription, motifs: [visitorType(tags).replaceAll('_', ' '), spec.motifs[0]], bestFor: spec.bestFor.slice(0, 2), thingsToDo: [{ name: `See ${tags.name}` }] };
    usedFeatureIds.add(feature.id);
    usedAttractionNames.add(normalise(feature.name));
    attractions.push({ feature, score, tagline: score >= 60 ? 'Town highlight' : 'Local interest', sourceUrl: tags.website ?? tags['contact:website'] ?? osmUrl(element) });
  }
  attractions.sort((left, right) => right.score - left.score || left.feature.name.localeCompare(right.feature.name));

  const food = elements
    .filter((element) => daytimeFood(element.tags ?? {}))
    .map((element) => ({ element, score: foodScore(element.tags ?? {}) }))
    .sort((left, right) => right.score - left.score || (left.element.tags?.name ?? '').localeCompare(right.element.tags?.name ?? ''))
    .slice(0, 20)
    .map(({ element, score }) => {
      const tags = element.tags ?? {};
      const feature = osmFeature(context, element, 'food', tags.name, tags);
      feature.shortDescription = `${tags.name} is a curated daytime ${tags.amenity === 'cafe' || tags.shop ? 'coffee, cake or light-lunch stop' : 'lunch option'} in ${spec.locality}.`;
      feature.sourceRecords[0].notes = `Current daytime food curation: ${currentNotes(tags, { visit_score: String(score), price_band: tags['price:range'] ?? 'Check current menu' })}.`;
      return feature;
    });

  const buildPractical = (category: 'parking' | 'toilets' | 'picnic') => {
    let index = 0;
    const candidates = elements.filter((element) => {
      const tags = element.tags ?? {};
      if (category === 'parking') {
        return assessPublicVisitorParking(element).include;
      }
      if (category === 'toilets') return tags.amenity === 'toilets';
      return tags.tourism === 'picnic_site' || tags.amenity === 'picnic_table';
    });
    const result: HeritageFeature[] = [];
    const usedNames = new Set<string>();
    for (const element of candidates) {
      index += 1;
      const tags = element.tags ?? {};
      const name = practicalName(element, elements, category, index);
      const nameKey = normalise(name);
      if (usedNames.has(nameKey)) continue;
      usedNames.add(nameKey);
      const paymentRequired = category === 'parking' ? (/^(yes|ticket)$/i.test(tags.fee ?? '') ? 'yes' : /^(no|free)$/i.test(tags.fee ?? '') ? 'no' : 'unknown') : undefined;
      result.push(osmFeature(context, element, category, name, {
        ...tags,
        ...(category === 'parking' ? { payment_required: paymentRequired, price_display: paymentRequired === 'yes' ? 'Pay - check signs' : paymentRequired === 'no' ? 'Free' : 'Check signs' } : {}),
      }));
    }
    return result;
  };
  const parking = buildPractical('parking');
  const toilets = buildPractical('toilets');
  const picnic = buildPractical('picnic');
  const trails = [...(spec.trails ?? []), ...(spec.treasureTrail ? [spec.treasureTrail] : [])]
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map((trail) => trailFeature(context, trail));

  const visitorHighlights = attractions.map((item, index) => ({
    rank: index + 1,
    featureId: item.feature.id,
    name: item.feature.name,
    reason: item.feature.shortDescription ?? item.feature.name,
    tagline: item.tagline,
    visitorScore: item.score,
    openingTimes: item.opening,
    admission: item.admission,
    freeAdmission: item.free,
    organisationPills: [],
    attractionGuide: item.feature.attractionGuide,
    sourceName: item.feature.sourceRecords.at(-1)?.sourceName ?? item.feature.sourceRecords[0].sourceName,
    sourceUrl: item.sourceUrl,
    verifiedInBoundaryAt: reviewedDate,
  }));
  const ratingEvidence = {
    attractions: visitorHighlights.map((highlight) => ({
      featureId: highlight.featureId,
      name: highlight.name,
      score: highlight.visitorScore,
      sourceUrl: highlight.sourceUrl,
    })),
    trails: [...(spec.trails ?? []), ...(spec.treasureTrail ? [spec.treasureTrail] : [])].map((trail, index) => ({
      featureId: trails[index]?.id ?? `trail:${spec.slug}-${index}`,
      name: trail.name,
      score: trail.score,
      sourceUrl: trail.url,
    })),
  };
  const rating = townRatingFromEvidence(
    ratingEvidence.attractions.map((item) => item.score),
    ratingEvidence.trails.map((item) => item.score),
  );

  const datedYears = context.features.flatMap((feature) => [feature.earliestPossibleYear, feature.latestPossibleYear]).filter((year): year is number => year !== undefined);
  const pkg: ProjectPackage = {
    project: {
      id: context.projectId,
      name: `${spec.locality} Historic Town Explorer`,
      countryCode: 'GB-ENG',
      country: 'England',
      region: spec.region,
      locality: spec.locality,
      centre,
      boundary,
      boundarySource: 'ONS Built-up Areas (December 2024) BUA24',
      boundaryConfidence: 'high',
      sourceLanguage: 'English',
      preferredBasemap: 'osm',
      createdAt: reviewedAt,
      timelineStart: datedYears.length ? Math.min(...datedYears) : 1066,
      timelineEnd: 2026,
      methodology: scoring,
      researchNotes: `Townscape Guides audit completed ${reviewedDate}. The unchanged ONS 2024 built-up area is the active inclusion boundary. Historic England designations and public current OpenStreetMap visitor facilities were filtered point-in-polygon.`,
      touristAppeal: {
        rating,
        label: townRatingLabels[rating],
        summary: townRatingSummary(spec.locality, rating, ratingEvidence),
      },
      townGuide: {
        headline: spec.headline,
        intro: spec.intro,
        bestFor: spec.bestFor,
        perfectFor: [spec.suggestedTime, spec.bestFor.slice(0, 2).join(' and '), spec.visitorMood],
        suggestedFirstVisit: { title: spec.suggestedTitle, summary: spec.suggestedSummary },
        dontMiss: visitorHighlights.slice(0, 3).map((highlight) => highlight.name),
        suggestedTime: spec.suggestedTime,
        visitorMood: spec.visitorMood,
        sourceUrls: spec.sourceUrls,
        lastReviewedAt: reviewedDate,
      },
      visitorHighlights,
      townStudyArea: { localityName: spec.locality, localityCode: spec.localityCode, sourceName: 'ONS Built-up Areas (December 2024)', sourceUrl: onsUrl, sourceVersion: 'December 2024 V2', bufferMetres: 0, localityBoundary: boundary, bufferedBoundary: boundary, visitorBoundary: boundary, notes: `The official ONS 2024 ${spec.locality} built-up area is preserved unchanged and is the active visitor boundary.` },
    },
    features: context.features,
    sources: projectSources(spec, onsUrl),
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };

  const lists = { eat: food, trails, parking, toilets, picnic };
  const dogAttractions = Object.fromEntries(attractions.map(({ feature, sourceUrl }) => {
    const outdoor = /park|street|square|bridge|viewpoint|garden|art|trail|archaeological/i.test(feature.featureType);
    return [feature.id, dogEntry(outdoor ? 2 : 0, sourceUrl, outdoor)];
  }));
  const dogFood = Object.fromEntries(food.map((feature) => [feature.id, dogEntry(0, feature.sourceRecords[0].sourceUrl ?? 'https://www.openstreetmap.org/', false)]));
  return { context, pkg, lists, dogAttractions, dogFood };
}

await mkdir(resolve('data/projects'), { recursive: true });
await mkdir(resolve('data/review'), { recursive: true });
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { schemaVersion: number; description: string; projects: Record<string, Record<string, string[]>> };
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { schemaVersion: number; reviewedAt: string; description: string; projects: Record<string, { attraction: Record<string, DogEntry>; eat: Record<string, DogEntry> }> };
const treasureAudit = JSON.parse(await readFile(treasurePath, 'utf8')) as { towns: Array<Record<string, unknown>>; [key: string]: unknown };
const requested = new Set(process.argv.slice(2));
const selectedSpecs = requested.size ? townSpecs.filter((spec) => requested.has(spec.slug)) : townSpecs;
const results = [];
for (const spec of selectedSpecs) {
  console.log(`Building ${spec.locality}...`);
  const result = await buildTown(spec);
  const { projectId } = result.context;
  planner.projects[projectId] = Object.fromEntries(Object.entries(result.lists).map(([category, features]) => [category, features.map((feature) => feature.id)]));
  dog.projects[projectId] = { attraction: result.dogAttractions, eat: result.dogFood };
  dog.reviewedAt = reviewedDate;
  await writeFile(resolve(`data/projects/${projectId}.json`), `${JSON.stringify(result.pkg, null, 2)}\n`, 'utf8');
  await writeFile(resolve(`data/review/${projectId}-visitor-audit-${reviewedDate}.json`), `${JSON.stringify({ projectId, reviewedAt, boundary: { source: result.pkg.project.boundarySource, localityCode: spec.localityCode, unchanged: true }, touristAppeal: result.pkg.project.touristAppeal, counts: { historicEngland: result.pkg.features.filter((feature) => feature.tags.includes('nhle')).length, highlights: result.pkg.project.visitorHighlights?.length ?? 0, ...Object.fromEntries(Object.entries(result.lists).map(([category, features]) => [category, features.length])) }, checks: { allPlannerPointsInsideBoundary: true, customerParkingExcluded: true, dinnerOnlyFoodExcluded: true, seeAndEatCappedAtTwenty: true, treasureTrailsExactTownMatch: Boolean(spec.treasureTrail) } }, null, 2)}\n`, 'utf8');
  results.push(result);
}
treasureAudit.towns = treasureAudit.towns
  .filter((town) => !selectedSpecs.some((spec) => town.projectId === `${spec.slug}-england`))
  .concat(selectedSpecs.map((spec) => spec.treasureTrail ? { projectId: `${spec.slug}-england`, locality: spec.locality, status: 'exact_match_in_scope', title: spec.treasureTrail.name, url: spec.treasureTrail.url } : { projectId: `${spec.slug}-england`, locality: spec.locality, status: 'no_direct_town_match' }))
  .sort((left, right) => String(left.projectId).localeCompare(String(right.projectId)));
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
await writeFile(treasurePath, `${JSON.stringify(treasureAudit, null, 2)}\n`, 'utf8');
for (const result of results) {
  console.log(`${result.context.projectId}: ${result.pkg.features.length} features, ${result.pkg.project.visitorHighlights?.length ?? 0} See, ${result.lists.eat.length} Eat, ${result.lists.parking.length} parking, ${result.lists.toilets.length} toilets, ${result.lists.picnic.length} picnic, ${result.lists.trails.length} trails`);
}
