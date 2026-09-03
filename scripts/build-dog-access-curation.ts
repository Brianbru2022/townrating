import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishedProjectPackages } from '../src/data/publishedProjects';
import { publishedPlannerCurationForProject } from '../src/data/visitorPlannerCuration';
import type { DogAccessInfo, DogFriendlyRating } from '../src/domain/dogAccess';
import type { HeritageFeature, VisitorHighlight } from '../src/domain/models';

const reviewedAt = '2026-08-11';
const outdoorAccessUrl =
  'https://www.outdooraccess-scotland.scot/enjoying-scotlands-outdoors';
const outdoorDogGuideUrl =
  'https://www.outdooraccess-scotland.scot/practical-guide-all/dog-walkers/dog-walking';
const hesDogPolicyUrl =
  'https://www.historicenvironment.scot/publications/all/publication/?publicationId=3d99b35d-615e-465c-9862-a5b600f284d2';
type DogAccessKind = 'attraction' | 'eat';
type ProjectDogAccess = Partial<Record<DogAccessKind, Record<string, DogAccessInfo>>>;

function dogAccess(
  rating: DogFriendlyRating,
  status: DogAccessInfo['status'],
  label: string,
  summary: string,
  sourceName?: string,
  sourceUrl?: string,
): DogAccessInfo {
  return { rating, status, label, summary, sourceName, sourceUrl, reviewedAt };
}

function openOutdoor(summary: string): DogAccessInfo {
  return dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    summary,
    'Scottish Outdoor Access Code',
    outdoorAccessUrl,
  );
}

function leadRestricted(summary: string, sourceUrl = outdoorDogGuideUrl): DogAccessInfo {
  return dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    summary,
    sourceUrl === hesDogPolicyUrl
      ? 'Historic Environment Scotland dog policy'
      : 'Scottish Outdoor Access Code dog guidance',
    sourceUrl,
  );
}

function limited(summary: string, sourceName?: string, sourceUrl?: string): DogAccessInfo {
  return dogAccess(1, 'restricted', 'Limited dog access', summary, sourceName, sourceUrl);
}

function unconfirmed(sourceUrl?: string): DogAccessInfo {
  return dogAccess(
    0,
    'unconfirmed',
    'Dog policy not confirmed',
    'No reliable current policy confirming pet-dog access was found in the reviewed visitor sources. Check directly before making a dog-dependent journey; assistance-dog access is separate.',
    'Reviewed visitor information',
    sourceUrl,
  );
}

function notAllowed(summary: string, sourceName: string, sourceUrl: string): DogAccessInfo {
  return dogAccess(0, 'not-allowed', 'Pet dogs not admitted', summary, sourceName, sourceUrl);
}

const attractionOverrides: Record<string, DogAccessInfo> = {
  'three-lochs-drive': openOutdoor(
    'Dogs can join the forest-drive stops, trails and picnic pauses under responsible-access rules. Keep them under close control around wildlife, livestock and car parks.',
  ),
  'curated-attraction:aberfoyle-lodge-forest-visitor-centre': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome in the visitor-centre building and cafe as well as on the forest trails. Water and sheltered tie-up points are provided outside.',
    'Forestry and Land Scotland visitor information',
    'https://forestryandland.gov.scot/visit/destinations/the-lodge-forest-visitor-centre/visitor-information',
  ),
  'osm-community:way-307345455': limited(
    'Dogs can join you in the surrounding forest, but active bike trails are not a relaxed dog-walking environment. Keep well clear of riders and use a lead around trail crossings.',
    'Scottish Outdoor Access Code dog guidance',
    outdoorDogGuideUrl,
  ),
  'go-ape': limited(
    'Dogs can accompany non-participating visitors around the forest setting, but cannot take part in the activity and should be kept away from busy landing and equipment areas.',
    'Forestry and Land Scotland visitor information',
    'https://forestryandland.gov.scot/visit/destinations/the-lodge-forest-visitor-centre',
  ),
  'nrhe:320380': limited(
    'Pet dogs are not allowed inside Alloa Tower, but they may use the green space outside under their owner\'s control. This is therefore only a partial visit with a dog.',
    'National Trust for Scotland planning information',
    'https://www.nts.org.uk/visit/places/alloa-tower/planning-your-visit',
  ),
  'curated-attraction:alva-johnstone-cochrane-parks': openOutdoor(
    'Dogs can join a visit to both public parks. Keep them under proper control and use a lead around play areas, sports activity and busy paths.',
  ),
  'nrhe:47770': leadRestricted(
    'Dogs can accompany an outdoor look at the old kirk and burial-ground setting on a lead. Keep to paths and be respectful around graves and services.',
  ),
  'nrhe:48021': notAllowed(
    'Only assistance dogs are permitted inside Culross Palace and the Palace Garden. Pet dogs can still join the surrounding public town walk, but not this attraction itself.',
    'National Trust for Scotland planning information',
    'https://www.nts.org.uk/visit/places/culross/planning-your-visit',
  ),
  'hes-property-in-care:pic066': notAllowed(
    'Historic Environment Scotland states that visitors\' dogs are not permitted at St Serf\'s Church and the Dupplin Cross. Assistance dogs are permitted.',
    'Historic Environment Scotland plan-your-visit information',
    'https://www.historicenvironment.scot/visit/all/st-serfs-church-and-dupplin-cross/plan-your-visit/',
  ),
  'osm-community:node-4802470557': openOutdoor(
    'The Thorn Tree is an outdoor village landmark, so dogs can join the brief stop. Keep them close around the square and road traffic.',
  ),
  'nrhe:49261': leadRestricted(
    'Pet dogs are allowed in the outdoor parts of Linlithgow Palace on a lead, but not in roofed areas. The surrounding Peel offers a much fuller dog walk.',
    'https://www.historicenvironment.scot/visit/all/linlithgow-palace/plan-your-visit/',
  ),
  'curated-visitor:gourock-gourock-outdoor-pool': unconfirmed(),
  'curated-visitor:gourock-gourock-golf-club-visitor-round': unconfirmed(),
  'curated-visitor:gourock-tower-hill-tower-viewpoint': openOutdoor(
    'Dogs can join the climb and outdoor viewpoint visit. Keep them under control on steeper paths and around other people at the tower.',
  ),
  'osm-community:way-548034712': unconfirmed(
    'https://www.nts.org.uk/visit/places/j-m-barries-birthplace',
  ),
  'osm-community:node-5893732662': limited(
    'Dogs can join the Kirrie Hill and pavilion setting, but access inside the small Camera Obscura is not confirmed. A lead is sensible around the pavilion, playpark and viewpoint.',
    'Scottish Outdoor Access Code dog guidance',
    outdoorDogGuideUrl,
  ),
  'osm-community:way-574801962': openOutdoor(
    'The Den is a public green-space walk where dogs can join the full visit. Keep them under control around families, water and wildlife.',
  ),
  'osm-community:way-164703492': limited(
    'Dogs can accompany the wider Kirrie Hill park visit, but should be kept out of the children\'s play equipment area and on a lead nearby.',
    'Scottish Outdoor Access Code dog guidance',
    outdoorDogGuideUrl,
  ),
  'hes-listed-building:LB37362': limited(
    'Dogs can join the public Rose Garden and outdoor setting, but pet-dog access inside the Burgh Halls is not confirmed.',
    'Scottish Outdoor Access Code dog guidance',
    outdoorDogGuideUrl,
  ),
  'hes-listed-building:LB50348': openOutdoor(
    'The monument is an outdoor stop on the village walk, so dogs can join throughout. Keep them close beside the road and around other visitors.',
  ),
  'curated-attraction:biggar-biggar-puppet-theatre': unconfirmed(),
  'osm-community:way-87262038': unconfirmed(),
  'osm-community:node-12922878298': openOutdoor(
    'These are outdoor town-centre memorials, so dogs can join the brief visit. Keep them close around Market Place traffic and pedestrians.',
  ),
  'nrhe:24194': leadRestricted(
    'Dogs can join the outdoor approach to the castle ruins and mausoleum under responsible-access rules. Keep them close around masonry, livestock and other visitors.',
  ),
  'standalone-attraction:barnack-hills-and-holes': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs can join the reserve walk, but should be kept under close control and on a lead around livestock, wildlife and seasonal restriction areas. Follow notices at the entrances.',
    'Natural England reserve information',
    'https://www.gov.uk/government/publications/cambridgeshires-national-nature-reserves/cambridgeshires-national-nature-reserves',
  ),
  'standalone-attraction:bedford-purlieus': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs can join the woodland walk on a lead. Keep to paths and protect sensitive wildlife and ground flora.',
    'Forestry England national nature reserve guidance',
    'https://www.forestryengland.uk/nature-wildlife/national-nature-reserves',
  ),
  'standalone-attraction:sacrewell-farm': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Well-behaved dogs are welcome on leads across the outdoor farm visit and at The Farmhouse Table, with water bowls provided. Dogs are not admitted to the indoor Playbarn.',
    'Sacrewell visitor FAQ',
    'https://www.sacrewell.org.uk/visit/faq/',
  ),
  'standalone-attraction:castor-hanglands': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs can join a responsible reserve walk, but should use a short lead around livestock, wildlife and sensitive grassland and remain on public routes.',
    'Natural England reserve information',
    'https://www.gov.uk/government/publications/cambridgeshires-national-nature-reserves/cambridgeshires-national-nature-reserves',
  ),
  'standalone-attraction:crown-lakes-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'The open paths and lakeside setting make this a useful dog walk. Keep dogs under control around wildlife, cyclists and other park users.',
    'Crown Lakes Country Park activity guide',
    'https://haypeterborough.co.uk/activities/crown-lakes-country-park/',
  ),
  'standalone-attraction:elton-hall': notAllowed(
    'Pet dogs are not admitted to Elton Hall or its gardens. Assistance dogs are permitted in the garden.',
    'Elton Hall visitor information',
    'https://eltonhall.com/visitor-info/',
  ),
  'standalone-attraction:fotheringhay-castle-site': limited(
    'This is an outdoor earthwork visit, but a specific current pet policy is not published. Keep dogs on a short lead around livestock, paths and historic remains.',
    'Visit Northamptonshire',
    'https://visitnorthamptonshire.co.uk/out-and-about/fotheringhay-castle',
  ),
  'standalone-attraction:southwick-hall': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs may accompany visitors in the grounds on a lead during public open days, but are not admitted inside the Hall.',
    'Southwick Hall visitor information',
    'https://www.southwickhall.co.uk/visit/',
  ),
  'standalone-attraction:lyveden-new-bield': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome on short leads throughout Lyveden, including the manor, cafe, gardens and lodge. Follow any temporary livestock or conservation notices.',
    'National Trust dog guidance for Lyveden',
    'https://www.nationaltrust.org.uk/visit/leicestershire-northamptonshire/lyveden/visiting-lyveden-with-your-dog',
  ),
  'standalone-attraction:fermyn-woods-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome throughout the forest and country park. Keep them under control around wildlife, play areas, cafe seating and busy trail junctions.',
    'Forestry England visitor information',
    'https://www.forestryengland.uk/fermyn-woods',
  ),
  'standalone-attraction:barnwell-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome across the country-park walks and designated dog-friendly areas. Keep them out of the children\'s play area and follow lead notices.',
    'North Northamptonshire Council visitor information',
    'https://www.northnorthants.gov.uk/barnwell-country-park',
  ),
  'standalone-attraction:holme-fen': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs are welcome under control, with a lead no longer than two metres required from 1 March to 31 July to protect breeding wildlife.',
    'Great Fen dog-walking guidance',
    'https://www.greatfen.org.uk/explore/information-dog-walkers',
  ),
  'standalone-attraction:woodwalton-fen': notAllowed(
    'Pet dogs are not permitted at Woodwalton Fen because of its sensitive wildlife. Assistance dogs are permitted.',
    'Great Fen dog-walking guidance',
    'https://www.greatfen.org.uk/explore/information-dog-walkers',
  ),
  'standalone-attraction:upwood-meadows': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs are welcome on a lead. Keep to the paths and take particular care around grazing animals and flower-rich meadow habitat.',
    'Wildlife Trust reserve information',
    'https://www.wildlifebcn.org/nature-reserves/upwood-meadows',
  ),
  'standalone-attraction:monks-wood': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs can join the woodland visit on a lead. Keep to paths and protect sensitive ancient-woodland plants and wildlife.',
    'Natural England reserve information',
    'https://www.gov.uk/government/publications/cambridgeshires-national-nature-reserves/cambridgeshires-national-nature-reserves',
  ),
  'standalone-attraction:hamerton-zoo-park': notAllowed(
    'Outside animals, including pet dogs, are not permitted in the wildlife park. Contact the attraction in advance about assistance-dog arrangements.',
    'Hamerton Zoo Park visitor information',
    'https://hamertonzoopark.com/whats-here/',
  ),
  'standalone-attraction:stanwick-lakes': dogAccess(
    2,
    'welcoming',
    'Dog friendly with limits',
    'Well-behaved dogs are welcome but should remain on leads. Keep them away from children\'s play equipment and follow wildlife-protection notices.',
    'Stanwick Lakes visitor FAQ',
    'https://stanwicklakes.org.uk/visitor-info/tourist-faq/',
  ),
  'standalone-attraction:hinchingbrooke-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome across the park. Use a lead in the wildlife area, near the cafe and wherever signs request it, and keep clear of play equipment.',
    'Huntingdonshire District Council visitor information',
    'https://www.huntingdonshire.gov.uk/hinchingbrookecountrypark',
  ),
  'standalone-attraction:burrough-hill-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome across the country park. Keep them under control around livestock, wildlife and the exposed ramparts, and follow seasonal notices.',
    'Leicestershire County Council visitor information',
    'https://leicscountryparks.org.uk/parks/burrough-hill-country-park/',
  ),
  'standalone-attraction:barnsdale-gardens': notAllowed(
    'Pet dogs are not admitted to the gardens. Assistance dogs are welcome.',
    'Barnsdale Gardens access statement',
    'https://barnsdalegardens.co.uk/access-statement.html',
  ),
  'standalone-attraction:rutland-wildlife-sanctuary': notAllowed(
    'Pet dogs are not admitted because of the resident birds and other animals. Contact the sanctuary in advance about assistance-dog arrangements.',
    'Rutland Wildlife Sanctuary visitor information',
    'https://www.rutlandwildlifesanctuary.co.uk/visiting-the-centre/',
  ),
  'standalone-attraction:rutland-water': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs can join the waterside visit but should be kept under close control and on leads around livestock, wildlife areas, beaches, play spaces and busy visitor bases.',
    'Anglian Water Parks visitor information',
    'https://anglianwaterparks.co.uk/rutland-water-park/visitor-information',
  ),
  'standalone-attraction:lyddington-bede-house': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs on leads can join the outdoor village and garden portion of the visit. Confirm access to the historic interior with English Heritage before travelling.',
    'English Heritage visitor information',
    'https://www.english-heritage.org.uk/visit/places/lyddington-bede-house/facilities/',
  ),
  'standalone-attraction:deene-park': notAllowed(
    'Pet dogs are not permitted in the House or Gardens. Registered assistance dogs are welcome.',
    'Deene Park visitor information',
    'https://www.deenepark.com/home/plan-your-visit/visitor-information',
  ),
  'standalone-attraction:kirby-hall': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs on leads are welcome in the roofless areas, gardens and grounds, but not in roofed historic interiors.',
    'English Heritage facilities information',
    'https://www.english-heritage.org.uk/visit/places/kirby-hall/plan-your-visit/facilities/',
  ),
  'standalone-attraction:rockingham-castle': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs on leads are welcome in the grounds and gardens. Only assistance dogs may enter the Castle.',
    'Rockingham Castle visitor FAQ',
    'https://rockinghamcastle.com/your-visit/faqs/',
  ),
  'standalone-attraction:east-carlton-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'The park has extensive dog-friendly walks and off-lead areas. Keep dogs out of the children\'s play area and follow signed controls.',
    'North Northamptonshire Council visitor information',
    'https://www.northnorthants.gov.uk/east-carlton-country-park',
  ),
  'standalone-attraction:boughton-house': dogAccess(
    1,
    'restricted',
    'Limited dog access',
    'Pet dogs are not admitted to the House or formal gardens. Dogs on leads can use the wider parkland where public access is permitted.',
    'Boughton House visitor FAQ',
    'https://www.boughtonhouse.co.uk/questions/',
  ),
  'standalone-attraction:geddington-eleanor-cross': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'This is an outdoor public landmark, so dogs can join the full brief stop. Keep them close around village traffic and pedestrians.',
    'Historic England monument record',
    'https://historicengland.org.uk/listing/the-list/list-entry/1013313',
  ),
  'standalone-attraction:rushton-triangular-lodge': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs on leads can join the outdoor setting. Confirm access inside the compact historic lodge with English Heritage before travelling.',
    'English Heritage visitor information',
    'https://www.english-heritage.org.uk/visit/places/rushton-triangular-lodge/',
  ),
  'standalone-attraction:cottesbrooke-hall-and-gardens': notAllowed(
    'Pet dogs are not admitted to the Hall or Gardens. Assistance dogs are welcome.',
    'Cottesbrooke Hall visitor information',
    'https://www.cottesbrooke.co.uk/visit-us/',
  ),
  'standalone-attraction:lamport-hall': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs on leads are welcome in the gardens and grounds, but not inside the Hall. Assistance dogs are welcome throughout.',
    'Lamport Hall visitor FAQ',
    'https://www.lamporthall.co.uk/plan-your-visit/faqs/',
  ),
  'standalone-attraction:chichele-college': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs on leads are welcome in the garden. Only assistance dogs may enter the historic interior when it is open.',
    'English Heritage visitor information',
    'https://www.english-heritage.org.uk/visit/places/chichele-college/facilities/',
  ),
  'standalone-attraction:irchester-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome across the woodland country park. Keep them under control around wildlife, play areas, the cafe and busy visitor routes.',
    'North Northamptonshire Council visitor information',
    'https://www.northnorthants.gov.uk/irchester-country-park',
  ),
  'standalone-attraction:irchester-narrow-gauge-railway-museum': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs can join the surrounding country-park visit, but access among the museum exhibits is constrained and should be confirmed with the volunteers on arrival.',
    'Irchester Narrow Gauge Railway Museum',
    'https://www.irchesterrailwaymuseum.co.uk/',
  ),
  'standalone-attraction:santa-pod-raceway': notAllowed(
    'Pet dogs and other animals are not admitted to the raceway. Contact the venue in advance about assistance-dog arrangements for a particular event.',
    'Santa Pod Raceway event rules',
    'https://santapod.co.uk/',
  ),
  'standalone-attraction:sywell-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome across the park and may be off lead where conditions allow. Keep them controlled around wildlife, water, play spaces and busy facilities.',
    'North Northamptonshire Council visitor information',
    'https://www.northnorthants.gov.uk/sywell-country-park',
  ),
  'standalone-attraction:billing-aquadrome': dogAccess(
    1,
    'restricted',
    'Limited dog access',
    'Dog access depends on the current holiday booking, accommodation and event rules. Confirm the policy for your date before travelling with a dog.',
    'Billing Aquadrome resort information',
    'https://meadowbay.com/billingaquadrome/',
  ),
  'standalone-attraction:brixworth-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome in the country park. Use a lead around livestock and Pitsford Water, keep dogs out of play areas and follow signed controls.',
    'West Northamptonshire Council visitor information',
    'https://www.westnorthants.gov.uk/brixworth-country-park/visiting-brixworth-country-park',
  ),
  'standalone-attraction:northampton-and-lamport-railway': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Well-behaved dogs are welcome on normal train services and around the station. Some dining and seasonal special trains exclude dogs, so check the event details.',
    'Northampton & Lamport Railway visitor information',
    'https://nlr.org.uk/',
  ),
  'standalone-attraction:hunsbury-hill-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs can join the full outdoor park visit. Keep them under control around wildlife, archaeology, play areas and other path users.',
    'West Northamptonshire Council park information',
    'https://www.westnorthants.gov.uk/major-parks/hunsbury-hill-park',
  ),
  'standalone-attraction:canal-museum-stoke-bruerne': dogAccess(
    1,
    'restricted',
    'Limited dog access',
    'Dogs can join the towpath and outdoor canal-village walk, but pet-dog access inside the museum is not confirmed. Assistance dogs are accommodated.',
    'Canal & River Trust visitor information',
    'https://canalrivertrust.org.uk/things-to-do/museums-and-attractions/the-canal-museum-stoke-bruerne',
  ),
  'standalone-attraction:castle-ashby-gardens': dogAccess(
    2,
    'restricted',
    'Dog friendly with limits',
    'Dogs are welcome on leads in the gardens and may use the designated arboretum area off lead. Dogs are excluded from the menagerie and play areas.',
    'Castle Ashby Gardens visitor information',
    'https://www.castleashbygardens.co.uk/visitors/',
  ),
  'standalone-attraction:stoke-park-pavilions': dogAccess(
    1,
    'restricted',
    'Limited dog access',
    'A general pet policy is not published for the limited open days. Contact the organisers before bringing a dog; assistance-dog access should be arranged in advance.',
    'Stoke Park Pavilions public viewing information',
    'https://www.stokeparkpavilions.co.uk/public-viewing',
  ),
  'standalone-attraction:emberton-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome across the country park. Keep them under control around wildlife, water, play spaces, camping areas and other visitors.',
    'Milton Keynes City Council visitor information',
    'https://www.milton-keynes.gov.uk/environment-parks-and-open-spaces/emberton-country-park',
  ),
  'standalone-attraction:harrold-odell-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome on the country-park paths. Use a lead around wildlife, the cafe, play areas and wherever notices request closer control.',
    'Bedford Borough Council visitor information',
    'https://www.bedford.gov.uk/leisure-parks-and-sport/parks-and-open-spaces/parks-bedford-borough/harrold-odell-country-park',
  ),
  'standalone-attraction:stevington-windmill': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs can join the full exterior visit. Keep them close around roads, farmland and the historic structure.',
    'Bedford Borough Council visitor information',
    'https://www.bedford.gov.uk/leisure-parks-and-sport/arts-and-culture/history-and-heritage/stevington-windmill',
  ),
  'standalone-attraction:stockgrove-rushmere-country-park': dogAccess(
    3,
    'welcoming',
    'Excellent with a dog',
    'Dogs are welcome throughout the woodland park. Keep them under control around wildlife, the lake, play spaces, cafe seating and busy trail junctions.',
    'The Greensand Trust visitor information',
    'https://www.greensandtrust.org/about-rushmere',
  ),
  'standalone-attraction:woburn-safari-park': notAllowed(
    'Pet dogs and other outside animals are not permitted in the safari park because of the resident animals. Contact the park before booking about assistance-dog arrangements.',
    'Woburn Safari Park visitor information',
    'https://www.woburnsafari.co.uk/plan-your-day/',
  ),
};

const indoorAttractionPattern =
  /\b(museum|theatre|centre|shop|shopping|outlet|gallery|pottery|picturehoose|pool|golf club|restaurant|tavern|inn|cafe|bur(?:gh)? halls|ski centre|old mill)\b/i;
const noDogCorePattern = /\b(boat trips?|cruises?|canal centre)\b/i;
const quietGroundPattern =
  /\b(churchyard|kirkyard|cemetery|mausoleum|grave|abbey ruins|castle and|castle ruins|preceptory)\b/i;
const limitedOutdoorPattern = /\b(play area|playpark|skatepark|marina|rose garden)\b/i;
const openOutdoorPattern =
  /\b(glen|park|waterfront|esplanade|viewpoint|falls|river|loch|peel|reservoir|trail|walk|townscape|historic main street|historic high street|historic core|village square|bridge|crossing|harbour|pier|west green|memorial|statue|stone|motte|public art|well|station heritage|fountain|clock mill|cottage homes|sculptures)\b/i;

function attractionDogAccess(
  feature: HeritageFeature,
  highlight: VisitorHighlight,
): DogAccessInfo {
  const overridden = attractionOverrides[feature.id];
  if (overridden) return overridden;
  const name = highlight.name;
  if (noDogCorePattern.test(name)) return unconfirmed(highlight.sourceUrl);
  if (indoorAttractionPattern.test(name)) return unconfirmed(highlight.sourceUrl);
  if (quietGroundPattern.test(name)) {
    return leadRestricted(
      'Dogs can accompany a quiet outdoor visit on a lead. Keep to paths and be considerate around graves, worship, fragile ruins and other visitors.',
      feature.tags.some((tag) => tag.includes('hes-property')) ? hesDogPolicyUrl : outdoorDogGuideUrl,
    );
  }
  if (limitedOutdoorPattern.test(name)) {
    return limited(
      'Dogs can accompany the wider outdoor visit, but should be kept on a lead and away from children\'s play, sport or working areas.',
      'Scottish Outdoor Access Code dog guidance',
      outdoorDogGuideUrl,
    );
  }
  if (/\b(church|kirk|priory)\b/i.test(name)) return unconfirmed(highlight.sourceUrl);
  if (openOutdoorPattern.test(name)) {
    const busyWaterfront = /\b(waterfront|harbour|pier|marina|bridge|crossing|main street|high street|townscape)\b/i.test(
      name,
    );
    return openOutdoor(
      busyWaterfront
        ? 'Dogs can join this outdoor visit. Keep them close around traffic, cyclists, working waterfronts and busy pedestrian sections.'
        : 'Dogs can join the full outdoor visit under responsible-access rules. Keep them under proper control and use a short lead around livestock, wildlife or busy paths.',
    );
  }
  return unconfirmed(highlight.sourceUrl);
}

function featureAuditText(feature: HeritageFeature): string {
  return [
    feature.name,
    feature.shortDescription,
    feature.fullDescription,
    ...feature.tags,
    ...feature.sourceRecords.flatMap((source) => [source.sourceName, source.notes]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

function featurePolicySource(feature: HeritageFeature): { name?: string; url?: string } {
  const dogSource = feature.sourceRecords.find((source) =>
    /\bdog|pet\b/i.test(`${source.sourceName} ${source.notes ?? ''}`),
  );
  const webSource =
    dogSource ?? feature.sourceRecords.find((source) => source.sourceUrl && !source.sourceUrl.includes('openstreetmap.org'));
  return { name: webSource?.sourceName, url: webSource?.sourceUrl };
}

function foodDogAccess(feature: HeritageFeature): DogAccessInfo {
  const text = featureAuditText(feature);
  const source = featurePolicySource(feature);
  const explicitlyExcluded =
    /(?:dog_friendly|dogs?|pets?)=(?:no|false|prohibited)|\b(?:no|not) dog[- ]friendly\b|\bdogs? (?:are )?not (?:allowed|welcome)\b/i.test(
      text,
    );
  const explicitlyWelcomed =
    /(?:dog_friendly|dogs?|pets?)=(?:yes|true|friendly|allowed)|\bdog[- ]friendly\b|\bdogs? (?:are )?welcome\b/i.test(
      text,
    );
  const legacyDogFriendly = explicitlyWelcomed && !explicitlyExcluded;
  if (!legacyDogFriendly) return unconfirmed(source.url);
  if (/outdoor (?:patio|terrace|seating)|patio only|outside only|dogs? welcome outside/i.test(text)) {
    return limited(
      'Dogs are welcomed in the outdoor seating area, but indoor access is not confirmed. Weather and table availability may therefore affect the visit.',
      source.name,
      source.url,
    );
  }
  // Three paws are reserved for a materially better dog visit, not merely permission.
  // Generic "dog friendly" wording and OSM dog=yes therefore remain two paws.
  if (/dog menu|dog treats|water bowls?|dog wash|doggy ice cream|dog biscuits?/i.test(text)) {
    return dogAccess(
      3,
      'welcoming',
      'Excellent with a dog',
      'Dogs are actively welcomed, with specific dog-friendly facilities or treats confirmed in the reviewed venue information. Check the latest house rules when booking.',
      source.name,
      source.url,
    );
  }
  return dogAccess(
    2,
    'welcoming',
    'Dog friendly',
    'The reviewed venue information confirms that dogs are welcomed. Seating areas or busy periods may still affect where you can sit, so check when booking if dog access is essential.',
    source.name,
    source.url,
  );
}

const projects: Record<string, ProjectDogAccess> = {};
const foodReviewQueue: Array<{
  projectId: string;
  locality: string;
  featureId: string;
  name: string;
  sourceUrl?: string;
  researchPriority: 'operator-page-review' | 'venue-research-needed';
}> = [];
let attractionCount = 0;
let foodCount = 0;

for (const projectPackage of publishedProjectPackages) {
  const projectId = projectPackage.project.id;
  const featuresById = new Map(projectPackage.features.map((feature) => [feature.id, feature]));
  const attraction: Record<string, DogAccessInfo> = {};
  const eat: Record<string, DogAccessInfo> = {};

  for (const highlight of projectPackage.project.visitorHighlights ?? []) {
    const feature = featuresById.get(highlight.featureId);
    if (!feature) throw new Error(`Missing attraction feature ${projectId}:${highlight.featureId}`);
    attraction[feature.id] = attractionDogAccess(feature, highlight);
    attractionCount += 1;
  }

  for (const feature of projectPackage.features.filter(
    (candidate) =>
      candidate.tags.includes('home-standalone-place') &&
      !candidate.tags.some((tag) =>
        ['service-context-food', 'visitor-context-food', 'osm-community-food'].includes(tag),
      ),
  )) {
    if (attraction[feature.id]) continue;
    attraction[feature.id] =
      attractionOverrides[feature.id] ??
      unconfirmed(feature.sourceRecords.find((source) => source.sourceUrl)?.sourceUrl);
    attractionCount += 1;
  }

  for (const featureId of publishedPlannerCurationForProject(projectId).eat ?? []) {
    const feature = featuresById.get(featureId);
    if (!feature) throw new Error(`Missing food feature ${projectId}:${featureId}`);
    const access = foodDogAccess(feature);
    eat[feature.id] = access;
    if (access.status === 'unconfirmed') {
      const sourceUrl = featurePolicySource(feature).url;
      foodReviewQueue.push({
        projectId,
        locality: projectPackage.project.locality,
        featureId: feature.id,
        name: feature.name,
        sourceUrl,
        researchPriority:
          sourceUrl && !sourceUrl.includes('openstreetmap.org')
            ? 'operator-page-review'
            : 'venue-research-needed',
      });
    }
    foodCount += 1;
  }

  projects[projectId] = { attraction, eat };
}

const outputPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/dog-access-curation.json',
);
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      reviewedAt,
      description:
        'Bundled 0-3 paw dog-access evidence for every published visitor attraction and curated food stop. Unconfirmed means no defensible current policy was found and is not a negative dog rating.',
      projects,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

foodReviewQueue.sort((left, right) => {
  if (left.researchPriority !== right.researchPriority) {
    return left.researchPriority === 'operator-page-review' ? -1 : 1;
  }
  return (
    left.locality.localeCompare(right.locality) ||
    left.name.localeCompare(right.name) ||
    left.featureId.localeCompare(right.featureId)
  );
});

const queuePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/review/cafe-dog-access-review-queue.json',
);
await writeFile(
  queuePath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: reviewedAt,
      description:
        'Cafe and daytime-food venues whose current pet-dog policy still needs venue-specific research. OSM permission alone is not sufficient evidence for a three-paw rating.',
      total: foodReviewQueue.length,
      venues: foodReviewQueue,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Wrote ${attractionCount} attractions and ${foodCount} food stops to ${outputPath}`);
console.log(`Wrote ${foodReviewQueue.length} unconfirmed cafe policies to ${queuePath}`);
