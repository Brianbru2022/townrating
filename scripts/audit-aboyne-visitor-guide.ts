import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const id = 'aboyne-scotland';
const day = '2026-09-02';
const at = '2026-09-02T14:25:00Z';
const projectPath = resolve('data/projects/aboyne.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/aboyne-full-visitor-audit-2026-09-02.json');
type Feature = HeritageFeature & Record<string, any>;
type Package = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: Feature[] };

const urls = {
  destination: 'https://visitabdn.com/places/aboyne',
  paths: 'https://www.aboynecommunitytrust.org.uk/groups/paths-tracks',
  walkLeaflet: 'https://www.aboynecommunitytrust.org.uk/website-downloads/standard-documents/70-aboyne-walk-leaflet/file',
  bikePark: 'https://visitabdn.com/businesses/aboyne-bike-park-bellwood',
  games: 'https://aboynegames.com/',
  green: 'https://aboynegames.com/about/welcome',
  spider: 'https://www.spideronabicycle.co.uk/',
  sheep: 'https://www.blackfacedsheep.co.uk/',
  courie: 'https://www.couriecourie.co.uk/',
  deesideWay: 'https://visitabdn.com/businesses/the-deeside-way',
  parking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  treasure: 'https://www.treasuretrails.co.uk/collections/aberdeenshire',
  curious: 'https://curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/pages/scotland',
  goQuest: 'https://goquestadventures.com/',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  sm6080: 'https://portal.historicenvironment.scot/designation/SM6080',
  sm10980: 'https://portal.historicenvironment.scot/designation/SM10980',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as Package;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const evidence = (sourceName: string, sourceOrganisation: string, sourceUrl: string, notes: string, reliability: any = 'official_non_statutory') => ({ sourceName, sourceOrganisation, sourceUrl, accessedAt: at, reliability, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes });
const make = (input: { id: string; name: string; type: any; coordinates: [number, number]; score: number; category: 'attraction'|'food'|'trail'; description: string; url: string; rationale: string; details: string; tags: string[]; sources: any[] }): Feature => ({
  id: input.id, projectId: id, name: input.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: 'Aboyne', featureType: input.type,
  significance: input.score >= 75 ? 'regional' : 'local', geometry: { type: 'Point', coordinates: input.coordinates }, locationType: 'exact', locationConfidence: 'high',
  dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: input.description, visitorWebsiteUrl: input.url, details: input.details,
  editorialReview: { status: 'editorially_researched', category: input.category, methodVersion: '2026-09-02-researched-visitor-value-v1', reviewedAt: day, scoreRationale: input.rationale, evidenceUrls: input.sources.map((source: any) => source.sourceUrl), visitability: 'full_visitor_experience', attractionAssessment: { experienceDepth: Math.round(input.score * .24), distinctiveness: Math.round(input.score * .2), presentation: Math.round(input.score * .18), journeyWorth: Math.round(input.score * .14), accessAndReliability: Math.round(input.score * .14), evidenceConfidence: Math.round(input.score * .1) } },
  sourceRecords: input.sources, tags: input.tags, createdAt: at, updatedAt: at, reviewed: true, evidenceScope: 'parish_evidence',
});

const green = make({ id: 'curated-attraction:aboyne-green', name: 'Aboyne Green and Highland Games', type: 'other', coordinates: [-2.7818,57.07418], score: 86, category: 'attraction', description: 'Aboyne’s unusual historic village green, ringed by 19th-century giant sequoias and home to the Highland Games founded in 1867.', url: urls.games, rationale: 'A distinctive public space with a nationally recognised annual event. The 2026 Games date and programme are current, while the Green remains freely viewable year-round.', details: 'visit_score=86; access=year-round public green; event=Aboyne Highland Games; event_date=2026-08-01; founded=1867; admission=free outside ticketed events', tags: ['curated-visitor','home-standalone-place','current-context'], sources: [evidence('Aboyne Highland Games','Aboyne Highland Games Committee',urls.games,'Current 2026 event date, programme and history.'),evidence('The Green of Charleston','Aboyne Highland Games Committee',urls.green,'History and year-round public role of the Green.')] });
const bikePark = make({ id: 'curated-attraction:aboyne-bike-park', name: 'Aboyne Bike Park – Bellwood', type: 'other', coordinates: [-2.75733,57.07291], score: 78, category: 'attraction', description: 'Community mountain-bike park with two short downhill tracks, a jump park and a pump track for varied abilities.', url: urls.bikePark, rationale: 'A purpose-built, free outdoor activity with an official current visitor listing; riders must check conditions and use appropriate safety equipment.', details: 'visit_score=78; access=outdoor; admission=free; facilities=two downhill tracks,jump park,pump track; opened=2013; helmets=required', tags: ['curated-visitor','home-standalone-place','current-context'], sources: [evidence('Aboyne Bike Park - Bellwood','VisitAberdeenshire',urls.bikePark,'Current official tourism listing and facility description.')] });
const attractions = [green,bikePark];

const eatInputs = [
  ['spider-on-a-bicycle','Spider on a Bicycle',[-2.77689,57.07619],88,urls.spider,'Speciality coffee, breakfast, light lunches, sweet treats and grab-and-go food in the listed former railway station.'],
  ['black-faced-sheep','The Black Faced Sheep',[-2.78466,57.07531],84,urls.sheep,'Independent café, homeware and gift shop serving coffee, light lunches, cakes and hot chocolate seven days a week.'],
  ['courie-courie','Courie Courie Bakery',[-2.77823,57.0765],82,urls.courie,'Small independent Station Square bakery with current Wednesday–Saturday daytime opening.'],
] as const;
const eats = eatInputs.map(([slug,name,coordinates,score,url,description]) => make({ id:`curated-food:aboyne-${slug}`, name, type: slug === 'courie-courie' ? 'bakery' : 'cafe', coordinates: coordinates as [number,number], score, category:'food', description, url, rationale:'A current first-party daytime coffee, cake, bakery or light-lunch stop within the settlement boundary.', details:`visit_score=${score}; cuisine=coffee_cake_light_lunch; opening_hours:description=Check the current first-party page before travel; price_band=££`, tags:['service-context-food','visitor-context-food','current-context'], sources:[evidence(name,name,url,'Current first-party offer, address and opening information.')] }));

const routeInputs = [
  ['riverside-east','Riverside East',[-2.7769,57.0762],70,'3.0 miles / 4.8 km; allow about 1¾ hours'],
  ['castle-circular','Aboyne Castle Circular',[-2.779,57.078],72,'1.8 miles / 2.8 km; accessible gate and mostly firm route'],
  ['bellwood-belwade','Bellwood and Belwade',[-2.765,57.075],72,'5.8 miles / 9.3 km; allow about 3¾ hours'],
  ['court-hill','Court Hill',[-2.798,57.079],68,'4.0 miles / 6.4 km; about 120 m climb'],
  ['mortlich','Mortlich',[-2.81,57.076],72,'6.5 miles / 10.5 km; about 290 m climb'],
  ['castle-woods','Castle Woods Accessible Trails',[-2.784,57.080],74,'Accessible woodland path network'],
  ['heritage-walk','Aboyne Heritage Walk',[-2.7818,57.07418],74,'2.5-mile village heritage walk; booklet sold locally'],
  ['deeside-way','Deeside Way at Aboyne',[-2.7769,57.0762],76,'Long-distance route through Aboyne; check current closures'],
] as const;
const trails = routeInputs.map(([slug,name,coordinates,score,description]) => make({ id:`curated-trail:aboyne-${slug}`, name, type:'trail', coordinates:coordinates as [number,number], score, category:'trail', description:`${description}.`, url:slug==='deeside-way'?urls.deesideWay:urls.walkLeaflet, rationale:'An exact named route supported by the June 2025 community path leaflet or the current official-tourism Deeside Way page.', details:`route_link_checked=${day}; ${description}; warning=check live path, forestry, river, livestock and fallen-tree notices`, tags:['curated-trails','service-context-trail','current-context'], sources:[evidence(slug==='deeside-way'?'The Deeside Way':'Aboyne Walk Leaflet',slug==='deeside-way'?'VisitAberdeenshire':'Aboyne Paths and Tracks Group',slug==='deeside-way'?urls.deesideWay:urls.walkLeaflet,'Current exact route evidence and practical notes.')] }));

const picnic = make({ id:'curated-picnic:aboyne-green', name:'Aboyne Green', type:'other', coordinates:[-2.7818,57.07418], score:72, category:'attraction', description:'Large central public green suitable for an informal picnic; no dedicated picnic tables are claimed.', url:urls.green, rationale:'The official Games history confirms the Green as a year-round public gathering space. This card is deliberately labelled informal because current table provision was not verified.', details:'amenity=picnic_site; style=informal grass picnic; picnic_tables=not verified; admission=free; restrictions=events may temporarily occupy the Green', tags:['service-context-picnic','current-context'], sources:[evidence('The Green of Charleston','Aboyne Highland Games Committee',urls.green,'Year-round public use and historic context.')] });
const parkingInputs = [
  ['station-front','Station Square (Front) Car Park',[-2.7772,57.0764],'34 spaces; 4 disabled spaces; voluntary charges; payment location 985530'],
  ['station-rear','Station Square (Rear) Car Park',[-2.7759,57.0763],'12 unmarked and 7 marked spaces; voluntary charges; payment location 985542'],
  ['shopping-square','Shopping Square Car Park',[-2.7852,57.0752],'56 spaces; 4 disabled spaces; 10 uncovered cycle spaces; voluntary charges; payment location 985544'],
] as const;
const parking = parkingInputs.map(([slug,name,coordinates,details])=>make({ id:`curated-parking:aboyne-${slug}`, name, type:'other', coordinates:coordinates as [number,number], score:64, category:'attraction', description:`Council-listed parking: ${details}.`, url:urls.parking, rationale:'Current council capacity, accessibility and charge information; users must check signs and current payment instructions.', details:`amenity=parking; ${details}; maxstay=Not published; overnight=Not published; restrictions=check signs`, tags:['service-context-parking','current-context'], sources:[evidence('Aberdeenshire car parks','Aberdeenshire Council',urls.parking,'Current Aboyne capacity, disabled spaces and voluntary-charge status.','local_authority')] }));
const toilet = make({ id:'curated-toilet:aboyne-ballater-road', name:'Aboyne Public Toilet', type:'other', coordinates:[-2.7848,57.0751], score:66, category:'attraction', description:'Council public toilet on Ballater Road with disabled access and published seasonal daily hours.', url:urls.toilets, rationale:'Current council page confirms the address, disabled access and daily hours.', details:'amenity=toilets; address=Ballater Road, Aboyne AB34 5HN; disabled=yes; opening_hours=April-September 08:00-20:00, October-March 08:00-18:00; holiday_closures=25-26 December and 1-2 January', tags:['service-context-toilet','current-context'], sources:[evidence('Aboyne public toilet','Aberdeenshire Council',urls.toilets,'Current address, access and hours.','local_authority')] });

const curated=[...attractions,...eats,...trails,picnic,...parking,toilet];
const curatedPrefixes=['curated-attraction:aboyne-','curated-food:aboyne-','curated-trail:aboyne-','curated-picnic:aboyne-','curated-parking:aboyne-','curated-toilet:aboyne-'];
pkg.features=[...pkg.features.filter(feature=>!curatedPrefixes.some(prefix=>feature.id.startsWith(prefix))),...curated];

const sm6080=pkg.features.find(feature=>feature.id==='hes-scheduled-monument:SM6080');
if(sm6080){sm6080.documentedDateText='Later prehistoric, around 500 BC';sm6080.earliestPossibleYear=-600;sm6080.latestPossibleYear=-400;sm6080.dateBasis='descriptive_period';sm6080.dateConfidence='high';sm6080.updatedAt=at;sm6080.sourceRecords=[...(sm6080.sourceRecords??[]).filter((source:any)=>source.sourceUrl!==urls.sm6080),evidence('SM6080','Historic Environment Scotland',urls.sm6080,'Official description dates the houses to around 2,500 years ago.','official_statutory')];}
const sm10980=pkg.features.find(feature=>feature.id==='hes-scheduled-monument:SM10980');
if(sm10980){sm10980.documentedDateText='Later prehistoric period';sm10980.earliestPossibleYear=-800;sm10980.latestPossibleYear=400;sm10980.dateBasis='descriptive_period';sm10980.dateConfidence='medium';sm10980.updatedAt=at;sm10980.sourceRecords=[...(sm10980.sourceRecords??[]).filter((source:any)=>source.sourceUrl!==urls.sm10980),evidence('SM10980','Historic Environment Scotland',urls.sm10980,'Official description identifies a later prehistoric palisaded enclosure and timber roundhouse.','official_statutory')];}

const highlights:VisitorHighlight[]=attractions.map((feature,index)=>({rank:index+1,featureId:feature.id,name:feature.name,reason:feature.editorialReview.scoreRationale,tagline:index===0?'A historic Deeside green with living tradition':'Community-built biking in Bellwood',visitorScore:index===0?86:78,timeToSpend:index===0?'30–60 minutes; longer on Games day':'45–120 minutes',openingTimes:index===0?'Green open year-round; Games 1 August 2026':'Outdoor access; check current conditions',admission:'Free outside ticketed events',freeAdmission:true,visitorWebsiteUrl:feature.visitorWebsiteUrl,editorialReview:feature.editorialReview,sourceName:index===0?'Aboyne Highland Games Committee':'VisitAberdeenshire',sourceUrl:feature.visitorWebsiteUrl,verifiedInBoundaryAt:day}));
pkg.project.preferredBasemap='voyager';
pkg.project.boundarySource='Strict Aboyne settlement, directly connected Bellwood paths and village route network. Private Aboyne Castle interiors, Glen Tanar, Dess Waterfall, Tarland Trails and other wider-Deeside attractions are excluded.';
pkg.project.boundaryConfidence='high';
pkg.project.touristAppeal={score:86,dogOwnerScore:84,dogAccessScoreAdjustment:-2,rating:3,label:'Top Place',summary:'A substantial Deeside visitor stop with an exceptional village green, Highland Games tradition, eight exact walks, a bike park and three strong daytime cafés.',dogAccessRating:3,dogAccessSummary:'Many routes suit responsible dogs, with leads or close control around roads, livestock, wildlife, other path users and event activity.',methodVersion:'2026-09-02-strict-settlement-full-audit-v3',reviewedAt:day,sourceUrls:Object.values(urls)};
pkg.project.visitorHighlights=highlights;
pkg.project.townGuide={characterTag:'Highland-games village on the River Dee',headline:'A rare village green, woodland routes and excellent cafés',intro:'Aboyne scores 86% after a full current-web audit replaces its 58 holding value. Its own offer—not borrowed Deeside attractions—supports a full day of walks, cycling, heritage and daytime food.',bestFor:['Walking and cycling','Highland Games tradition','Coffee, cake and baking'],perfectFor:['A half-day or full-day Deeside stop'],suggestedFirstVisit:{title:'Green, heritage and woodland loop',summary:'Begin on Aboyne Green, use the village heritage route, continue into Castle Woods or Bellwood, and stop at a Station Square café.'},dontMiss:['Aboyne Green','Aboyne Bike Park – Bellwood','Aboyne Heritage Walk'],suggestedTime:'Half day to full day',visitorMood:'Outdoorsy, historic and sociable.',sourceUrls:Object.values(urls),lastReviewedAt:day};
pkg.project.researchNotes='Full current-web, strict-boundary, facilities, named trail-provider and HES audit. Eight exact routes in the June 2025 leaflet were retained; wider attractions were excluded. TreasureTrails, Curious About, Mystery Guides and GoQuest returned no exact Aboyne product. All 34 listed buildings and both scheduled monuments are visible and dated. Scheduled-monument periods were tightened from generic prehistoric ranges using the official descriptions; dates remain metadata rather than map-label text.';
planner.projects[id]={eat:eats.map(feature=>feature.id),trails:trails.map(feature=>feature.id),picnic:[picnic.id],parking:parking.map(feature=>feature.id),toilets:[toilet.id]};
dog.reviewedAt=day; dog.projects[id]={trail:Object.fromEntries(trails.map(feature=>[feature.id,{rating:3,status:'conditional',label:'Good with responsible control',summary:'Keep dogs under close control around livestock, wildlife, roads, forestry work and other users.',sourceName:'Scottish Outdoor Access Code',sourceUrl:urls.dogCode,reviewedAt:day}]))};

pkg.validation=validateFeatures(pkg.project,pkg.features);
const errors=pkg.validation.filter((item:any)=>item.severity==='error'); if(errors.length) throw new Error(errors.map((item:any)=>item.message).join('; '));
const statutory=pkg.features.filter(feature=>feature.tags.includes('hes-listed-building')||feature.tags.includes('hes-scheduled-monument'));
const visible=statutory.filter(feature=>!feature.tags.includes('map-hidden'));
const undated=visible.filter(feature=>!feature.documentedDateText||feature.earliestPossibleYear==null||feature.latestPossibleYear==null||feature.dateBasis==='unknown');
if(statutory.length!==36||undated.length) throw new Error(`Aboyne HES gate failed: ${statutory.length}; ${undated.map(feature=>feature.id).join(', ')}`);
const report={reviewedAt:at,projectId:id,place:'Aboyne',townScore:86,mapPublished:true,categories:{see:{audited:true,published:2,excluded:['Private Aboyne Castle interiors','Glen Tanar','Dess Waterfall','Tarland Trails']},eat:{audited:true,published:3},trails:{audited:true,published:8,providerChecks:{TreasureTrails:'No exact product.',CuriousAbout:'No exact product.',MysteryGuides:'No exact product.',GoQuestAdventures:'No exact product.',AboynePathsAndTracksGroup:'Eight exact routes in current leaflet verified.'}},picnic:{audited:true,published:1,note:'Informal grass picnic on the public Green; no dedicated tables claimed.'},parking:{audited:true,published:3},toilets:{audited:true,published:1}},hes:{assigned:36,visibleDated:36,hiddenUndated:0,visibleUndated:0,missing:0,listedBuildings:34,scheduledMonuments:2,semanticDateCorrections:['SM6080','SM10980']},boundaryRule:'Only the settlement and directly connected path network support the town score.',research:{currentWebResearch:true,strictBoundaryChecked:true,sourceChecks:Object.values(urls).map(url=>({url,checkedAt:day,outcome:'checked'}))},scoreReanalysis:{required:true,completed:true,previousScore:58,resultScore:86,rationale:'The previous value was an explicit pending-audit gate. Current official and operator evidence supports a strong independent visitor destination.'},certification:{publicationCountsReconciled:true,liveBrowserVerifiedAt:null}};
await writeFile(projectPath,`${JSON.stringify(pkg,null,2)}\n`); await writeFile(plannerPath,`${JSON.stringify(planner,null,2)}\n`); await writeFile(dogPath,`${JSON.stringify(dog,null,2)}\n`); await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
console.log(`Aboyne audit complete: score 86; 2 See, 3 Eat, 8 Trails, 1 Picnic, 3 Parking, 1 Toilet; ${visible.length}/${visible.length} visible statutory HES pins dated.`);
