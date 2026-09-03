import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { TouristAppeal } from '../src/domain/models';
import {
  townDogAccessScoreAdjustment,
  townScoreAfterDogAccess,
  townScoreBand,
} from '../src/domain/tourism';

const reviewedAt = '2026-08-25';
const methodVersion = '2026-08-25-separated-town-dog-owner-and-access-v3';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/enjoying-scotlands-outdoors';

type Assessment = Pick<TouristAppeal, 'summary' | 'dogAccessRating' | 'dogAccessSummary' | 'sourceUrls'> & {
  score: number;
};

const assessments: Record<string, Assessment> = {
  'aberfoyle-scotland': { score: 72, dogAccessRating: 3, summary: 'A worthwhile Trossachs gateway with village history, the riverside setting, Doon Hill folklore and walks beginning in or immediately from the settlement. The Lodge and wider forest attractions are treated as nearby rather than inflating the village score.', dogAccessSummary: 'An excellent small destination with a dog: outdoor routes begin from the village and much of the experience is open-air, with lead control required around wildlife and livestock.', sourceUrls: ['https://forestryandland.gov.scot/visit/destinations/aberfoyle','https://www.lochlomond-trossachs.org/discover-the-park/towns-villages/aberfoyle/',outdoorCode] },
  'alloa-scotland': { score: 68, dogAccessRating: 1, summary: 'A notable heritage stop led by the substantial, publicly accessible Alloa Tower, with supporting civic and industrial history, but insufficient independent visitor depth for a higher destination band.', dogAccessSummary: 'Worth a limited visit with a dog for outdoor town walking, but pet dogs cannot enter Alloa Tower, the principal reason to stop.', sourceUrls: ['https://www.nts.org.uk/visit/places/alloa-tower/planning-your-visit','https://www.clacks.gov.uk/visiting/alloatower/',outdoorCode] },
  'alva-scotland': { score: 65, dogAccessRating: 2, summary: 'A notable outdoor stop where Alva Glen provides a genuine in-boundary walking experience, supported by parks and mill-town character rather than a broad attraction cluster.', dogAccessSummary: 'Good with a dog because the glen and outdoor spaces form the main experience; normal close-control restrictions apply.', sourceUrls: ['https://www.clacks.gov.uk/visiting/','https://www.clacks.gov.uk/visiting/alvaglen/',outdoorCode] },
  'bathgate-scotland': { score: 64, dogAccessRating: 2, summary: 'A notable town stop for the Bennie Museum, central history trail, cultural venues and parks. Bathgate Hills and other out-of-boundary countryside do not count towards the town score.', dogAccessSummary: 'A reasonable dog-owner stop for parks and the outdoor heritage trail, although indoor cultural attractions limit how much of the core offer can be shared with a dog.', sourceUrls: ['https://www.visitwestlothian.co.uk/explore/bathgate/',outdoorCode] },
  'biggar-scotland': { score: 73, dogAccessRating: 1, summary: 'A worthwhile small-town destination with a strong local museum, historic High Street, seasonal gasworks museum and permanent puppet theatre providing more depth than a picturesque village alone.', dogAccessSummary: 'Outdoor streets and parks remain accessible, but the strongest reasons to visit are predominantly indoor venues with no confirmed broad pet-dog access.', sourceUrls: ['https://www.biggarmuseumtrust.co.uk/visit-us/plan-your-visit/','https://www.historicenvironment.scot/visit/all/biggar-gasworks-museum/plan-your-visit/',outdoorCode] },
  'bridge-of-earn-scotland': { score: 55, dogAccessRating: 1, summary: 'A useful village pause with parks, church and local walking links, but no sufficiently distinctive publicly accessible in-boundary attraction to qualify as a notable tourism stop.', dogAccessSummary: 'Pleasant for a short dog walk through village parks and paths, but the limited tourism offer keeps the dog-owner destination rating modest.', sourceUrls: ['https://www.pkc.gov.uk/media/49518/Walking-the-Perth-Kinross-Council-Core-paths/pdf/WalkPKCPBookFINAL.pdf',outdoorCode] },
  'broxburn-and-uphall-scotland': { score: 63, dogAccessRating: 2, summary: 'A notable specialist stop combining the Union Canal, community museum and heritage art trail. Nearby country parks remain outside the settlement assessment.', dogAccessSummary: 'Good for a dog-assisted visit because the canal towpath and outdoor art trail carry much of the experience, though the museum component is not shared.', sourceUrls: ['https://www.visitwestlothian.co.uk/explore/broxburn-uphall/','https://www.visitwestlothian.co.uk/media/2484/broxburnuphalltrail.pdf',outdoorCode] },
  'callander-scotland': { score: 79, dogAccessRating: 3, summary: 'One of the strongest sub-80 Scottish stops: a coherent walking town with Bracklinn Falls, riverside and woodland routes, a heritage trail, museum interest and a substantial visitor centre and food offer.', dogAccessSummary: 'Excellent with a dog: several of the town’s main reasons to visit are accessible walks starting in Callander, supported by pet-friendly accommodation and outdoor venues.', sourceUrls: ['https://www.visitcallander.uk/walking','https://www.visitcallander.uk/pet-friendly','https://www.lochlomond-trossachs.org/things-to-do/walking/short-moderate-walks/bracklinn-falls-circuit/',outdoorCode] },
  'culross-scotland': { score: 88, dogAccessRating: 1, summary: 'An exceptionally coherent small historic settlement with Culross Palace, conserved 17th- and 18th-century streets, abbey, town house, waterfront and guided interpretation. Its compact completeness makes it a strong destination despite its size.', dogAccessSummary: 'The historic streets and waterfront can be enjoyed with a dog, but pet dogs are excluded from Culross Palace and its garden, materially restricting the principal paid attraction.', sourceUrls: ['https://www.nts.org.uk/visit/places/culross/planning-your-visit','https://portal.historicenvironment.scot/apex/f?p=1505:300:::::VIEWTYPE,VIEWREF:designation,SM5288',outdoorCode] },
  'dunning-scotland': { score: 69, dogAccessRating: 1, summary: 'A high notable-stop score anchored by the nationally important Dupplin Cross inside St Serf’s Church, supported by the historic village, Thorn Tree and short walks, but with limited breadth and seasonal access.', dogAccessSummary: 'Outdoor village walking remains possible, but the defining Dupplin Cross experience is indoors and does not provide a confirmed pet-dog visit.', sourceUrls: ['https://www.historicenvironment.scot/visit/all/st-serfs-church-and-dupplin-cross/','https://dunning.uk.net/duplinx.html',outdoorCode] },
  'gourock-scotland': { score: 67, dogAccessRating: 2, summary: 'A notable Clyde waterfront stop with the heated saltwater pool, esplanade, ferry-town character, Granny Kempock Stone, parks and panoramic viewpoints, but not enough independent attraction depth for 70.', dogAccessSummary: 'Good with a dog for the waterfront, parks and viewpoints; the outdoor pool itself is unavailable to dogs, so the whole core experience cannot be shared.', sourceUrls: ['https://www.gogourock.org/why-come-to-gourock','https://www.gogourock.org/',outdoorCode] },
  'killin-scotland': { score: 79, dogAccessRating: 3, summary: 'A compelling Highland village stop led by the Falls of Dochart and historic bridge, with strong place identity, heritage, riverside scenery and outdoor activity options within the settlement.', dogAccessSummary: 'Excellent with a dog because the falls, riverside and much of the village’s appeal are outdoors, subject to responsible lead control near water, wildlife and livestock.', sourceUrls: ['https://www.lochlomond-trossachs.org/discover-the-park/towns-villages/killin/',outdoorCode] },
  'kincardine-on-forth-scotland': { score: 63, dogAccessRating: 2, summary: 'A notable short heritage stop for its 17th-century mercat cross, historic port streets, bridge views and position at the start of the Fife Coastal Path, without a major destination attraction.', dogAccessSummary: 'Good for a dog-owner stop because the principal townscape and coastal-path experiences are outdoors and shareable, while the overall destination remains modest.', sourceUrls: ['https://www.scotlandsgreattrails.com/trail/fife-coastal-path/','https://www.fife.gov.uk/__data/assets/pdf_file/0023/607217/Kincardine-Local-Place-Plan-20243.pdf',outdoorCode] },
  'kirknewton-scotland': { score: 48, dogAccessRating: 1, summary: 'A village of minor tourism interest within its strict boundary. The better-known craft studio, military museum, Jupiter Artland and wider countryside experiences marketed under Kirknewton are outside the settlement and do not count.', dogAccessSummary: 'Local outdoor walking is possible with a dog, but the in-boundary tourism offer is too limited to make this a meaningful dog-owner destination.', sourceUrls: ['https://www.visitwestlothian.co.uk/explore/kirknewton/',outdoorCode] },
  'kirriemuir-scotland': { score: 73, dogAccessRating: 2, summary: 'A worthwhile literary and cultural town combining J M Barrie’s Birthplace, the rare Camera Obscura, distinctive red-sandstone streets and local music heritage.', dogAccessSummary: 'Good with a dog overall: the hill and town walk remain accessible and the Camera Obscura café welcomes dogs on leads, although dogs cannot enter the camera room or some indoor heritage attractions.', sourceUrls: ['https://www.nts.org.uk/visit/places/J-M-Barries-Birthplace//planning-your-visit','https://www.kirriemuircameraobscura.com/',outdoorCode] },
  'linlithgow-scotland': { score: 86, dogAccessRating: 2, summary: 'A strong historic destination centred on the royal palace, loch and peel, St Michael’s, museum, coherent High Street and canal. Out-of-boundary country parks and castles do not inflate the score.', dogAccessSummary: 'Good with a dog thanks to the peel, loch, canal and outdoor townscape, though access restrictions at the palace and indoor museum prevent a top dog-owner rating.', sourceUrls: ['https://www.historicenvironment.scot/visit/all/linlithgow-palace/','https://www.linlithgowmuseum.org/visit','https://app-hes-pubs-prod-neu-01.azurewebsites.net/api/file/473cdd97-3f1e-4a81-8abf-a8e7010a3d8c',outdoorCode] },
  'livingston-scotland': { score: 76, dogAccessRating: 1, summary: 'A worthwhile modern destination with the substantial Almond Valley family attraction, major retail and leisure offer, parks and public art. Its strength comes from accessible things to do rather than traditional townscape.', dogAccessSummary: 'A reduced dog-owner experience: parks and outdoor public art are available, but pet dogs are excluded from Almond Valley, one of the principal reasons for visiting.', sourceUrls: ['https://www.almondvalley.co.uk/plan-your-visit/','https://www.visitwestlothian.co.uk/things-to-do/family-fun/almond-valley/',outdoorCode] },
  'quarriers-village-scotland': { score: 58, dogAccessRating: 1, summary: 'A distinctive planned philanthropic village with specialist architectural and social-history interest, but too little dependable publicly accessible visitor content inside the settlement to pass the 60 gate.', dogAccessSummary: 'A quiet outdoor heritage walk can be shared with a dog, but the limited visitor offer prevents a higher dog-owner destination rating.', sourceUrls: ['https://www.inverclyde.gov.uk/assets/attach/20378/6717-GHG26-Programme_WEB.pdf',outdoorCode] },
  'south-queensferry-scotland': { score: 87, dogAccessRating: 3, summary: 'A strong destination with an internationally important bridge setting, historic High Street and harbour, waterfront viewpoints, boat trips and the Forth Road Bridge walking experience.', dogAccessSummary: 'Excellent with a dog: bridge and shore trails, some boat trips and numerous food venues explicitly welcome well-behaved dogs, with leads required where appropriate.', sourceUrls: ['https://www.theforthbridges.org/visit-the-forth-bridges/visiting-the-bridges-faqs/','https://forthbridges-live.cssoftware.co.uk/visit-the-local-area-forth-bridges/forth-bridges-itineraries/itinerary-dog-friendly/','https://www.queensferrycommunitycouncil.co.uk/visit-queensferry/'] },
  'strathyre-scotland': { score: 62, dogAccessRating: 2, summary: 'A notable outdoor stop whose in-village forest, picnic site and walking access create a distinctive glen experience despite a very small conventional attraction offer.', dogAccessSummary: 'Good with a dog because the principal experience is outdoor forest walking from the village, but the modest tourism depth caps the dog-owner rating.', sourceUrls: ['https://forestryandland.gov.scot/visit/destinations/strathyre-village',outdoorCode] },
  'tillicoultry-scotland': { score: 64, dogAccessRating: 2, summary: 'A notable stop combining Tillicoultry Glen, mill-town heritage and outlet shopping. The glen is a genuine public experience, but the overall offer lacks the depth for a 70 score.', dogAccessSummary: 'Good with a dog for the glen and outdoor town walk, although indoor retail and activity components are restricted or unsuitable.', sourceUrls: ['https://www.clacks.gov.uk/visiting/tillicoultryglen/','https://www.clacks.gov.uk/visiting/',outdoorCode] },
  'torphichen-scotland': { score: 73, dogAccessRating: 1, summary: 'A worthwhile specialist heritage destination centred on Scotland’s medieval Knights Hospitaller headquarters, supported by the conservation village and related historic features.', dogAccessSummary: 'The village can be explored outdoors with a dog, but the key preceptory experience has limited or unconfirmed pet-dog access and dominates the reason to visit.', sourceUrls: ['https://www.historicenvironment.scot/visit/all/torphichen-preceptory/','https://members.historic-scotland.gov.uk/file/Members-Guide.pdf',outdoorCode] },
  'whitburn-scotland': { score: 54, dogAccessRating: 1, summary: 'A town of minor tourism interest with a community museum and mining memorials, but no sufficient in-boundary attraction cluster. Polkemmet Country Park and the Scottish Owl Centre remain outside the settlement score.', dogAccessSummary: 'Local parks and walking can accommodate a dog, but the small in-town tourism offer does not justify a higher dog-owner destination rating.', sourceUrls: ['https://www.westlothian.gov.uk/article/44864/Whitburn-Community-Museum',outdoorCode] },
};

const projectDirectory = resolve('data/projects');
const files = (await readdir(projectDirectory)).filter(
  (file) => file.endsWith('.json') && !file.includes('.template.'),
);
const found = new Set<string>();

for (const file of files) {
  const path = resolve(projectDirectory, file);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as { project?: { id?: string; countryCode?: string; touristAppeal?: TouristAppeal } };
  if (pkg.project?.countryCode !== 'GB-SCT' || !pkg.project.id) continue;
  const assessment = assessments[pkg.project.id];
  // Newly researched Scottish packages keep the rating embedded by their own
  // source-backed generator; this script maintains only the original review set.
  if (!assessment) continue;
  const dogAccessScoreAdjustment = townDogAccessScoreAdjustment(assessment.dogAccessRating);
  const dogOwnerScore = townScoreAfterDogAccess(assessment.score, assessment.dogAccessRating);
  const band = townScoreBand(assessment.score);
  pkg.project.touristAppeal = {
    score: assessment.score,
    dogOwnerScore,
    dogAccessScoreAdjustment,
    rating: band.rating,
    label: band.label,
    summary: assessment.summary,
    dogAccessRating: assessment.dogAccessRating,
    dogAccessSummary: assessment.dogAccessSummary,
    methodVersion,
    reviewedAt,
    sourceUrls: assessment.sourceUrls,
  };
  found.add(pkg.project.id);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

const missing = Object.keys(assessments).filter((id) => !found.has(id));
if (missing.length || found.size !== Object.keys(assessments).length) {
  throw new Error(`Assessment mismatch. Missing: ${missing.join(', ') || 'none'}; found ${found.size}`);
}

console.log(`Applied reassessed town and dog-owner ratings to ${found.size} Scottish settlements.`);
