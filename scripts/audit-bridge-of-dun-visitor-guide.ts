import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { editorialRatingMethodVersion } from '../src/domain/editorialResearch';

const projectId = 'bridge-of-dun-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/bridge-of-dun.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/bridge-of-dun-full-visitor-audit-2026-08-30.json');

const urls = {
  railway: 'https://www.caledonianrailway.com/',
  railwayPlan: 'https://www.caledonianrailway.com/plan-your-visit',
  railwayFaq: 'https://www.caledonianrailway.com/faq',
  steamSundays: 'https://www.caledonianrailway.com/whats-on-1/steam-sundays',
  visitAngusRailway: 'https://visitangus.com/things-to-see-do/attractions/attractions-trail/',
  bridgeHes: 'https://portal.historicenvironment.scot/designation/LB4677',
  kioskHes: 'https://portal.historicenvironment.scot/designation/LB6387',
  stationTrove: 'https://www.trove.scot/place/165949',
  settlement: 'https://www.openstreetmap.org/node/4159783157',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=Bridge%20of%20Dun',
  outdoorAccess: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));

function assessment(score: number, food = false) {
  if (food) return { foodAndDrinkQuality: Math.round(score * .29), daytimeRelevance: Math.round(score * .21), distinctiveness: Math.round(score * .15), consistency: Math.round(score * .14), visitorFit: Math.round(score * .11), evidenceConfidence: score - Math.round(score * .29) - Math.round(score * .21) - Math.round(score * .15) - Math.round(score * .14) - Math.round(score * .11) };
  return { experienceDepth: Math.round(score * .3), distinctiveness: Math.round(score * .2), presentation: Math.round(score * .2), journeyWorth: Math.round(score * .15), accessAndReliability: Math.round(score * .1), evidenceConfidence: score - Math.round(score * .3) - Math.round(score * .2) - Math.round(score * .2) - Math.round(score * .15) - Math.round(score * .1), visitability: 'full_visitor_experience' };
}

function make(spec: any) {
  const placeType = spec.placeType === 'Toilets' ? 'Public toilets' : spec.placeType;
  const foodNotes = spec.category === 'food' ? `amenity=cafe; food_score=${spec.score}; cuisine=${spec.cuisine}; price_band=${spec.price}; opening_hours:description=${spec.opening}; description=${spec.tagline}. ${spec.description}; ` : '';
  return {
    id: spec.id, projectId, name: spec.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Angus', locality: 'Bridge of Dun', featureType: spec.featureType,
    significance: spec.significance ?? 'local', geometry: { type: 'Point', coordinates: spec.coordinates }, locationType: 'exact', locationConfidence: 'high',
    dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: spec.description, visitorWebsiteUrl: spec.website,
    editorialReview: spec.score ? { status: 'editorially_researched', category: spec.category, methodVersion: editorialRatingMethodVersion, reviewedAt: reviewedDate, scoreRationale: spec.reason, evidenceUrls: spec.evidenceUrls, ...(spec.category === 'food' ? { foodAssessment: assessment(spec.score, true) } : { attractionAssessment: assessment(spec.score) }) } : undefined,
    sourceRecords: spec.evidenceUrls.map((url: string, index: number) => ({ sourceName: index ? `${spec.name} supporting evidence` : spec.sourceName, sourceOrganisation: index ? 'Supporting publisher' : spec.sourceOrganisation, sourceUrl: url, accessedAt: reviewedAt, reliability: url.includes('historicenvironment.scot') ? 'official_statutory' : url.includes('openstreetmap.org') ? 'discovery_only' : 'official_non_statutory', licence: url.includes('openstreetmap.org') ? 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.' : 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes: `Current-place curation: visitor_place_type=${placeType}; ${spec.score ? `visit_score=${spec.score}; ` : ''}${foodNotes}${spec.details ?? ''}` })),
    tags: [...new Set([...spec.tags, ...(spec.category === 'food' ? ['service-context-food', 'visitor-context-food'] : [])])], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
  };
}

const attractions = [
  make({ id:'curated-attraction:bridge-of-dun-railway', name:'Caledonian Railway at Bridge of Dun', score:84, coordinates:[-2.550118,56.718539], featureType:'museum', significance:'national', description:'The rural terminus of the volunteer-run heritage railway from Brechin, with steam and diesel journeys, historic station spaces and countryside connections on published operating days.', reason:'A substantial, bookable heritage-railway experience, scored as a standalone attraction rather than used to inflate the small settlement.', website:urls.railwayPlan, sourceName:'Caledonian Railway visitor information', sourceOrganisation:'Caledonian Railway Brechin Ltd', evidenceUrls:[urls.railwayPlan,urls.railwayFaq,urls.visitAngusRailway,urls.stationTrove], placeType:'Attraction', category:'attraction', tags:['curated-visitor','home-standalone-place','current-context','service-context-heritage'], details:'selected published operating dates, principally summer weekends and special events; multiple trips on operating days; stations and trains wheelchair accessible with ramps; dogs welcome on most daytime services on leads but not food-service trains' }),
];

const foods = [
  make({ id:'curated-food:bridge-of-dun-bufferstop', name:'BufferStop Buffet', tagline:'Hot drinks on running days', opening:'Railway service days only; opening may be reduced when volunteer staffing is limited', score:62, coordinates:[-2.550118,56.718539], featureType:'food_drink', description:'A small station buffet serving snacks and hot and cold drinks when scheduled railway services operate, subject to volunteer availability.', reason:'The only verified refreshment stop in the locality; useful on a railway day but too intermittent to count as normal village café provision.', website:urls.railwayFaq, sourceName:'Caledonian Railway facilities', sourceOrganisation:'Caledonian Railway Brechin Ltd', evidenceUrls:[urls.railwayFaq,urls.railwayPlan], placeType:'Eat', category:'food', cuisine:'snacks, hot drinks and cold drinks', price:'£', tags:['curated-visitor','current-context','limited-opening'], details:'card payment not available at Bridge of Dun on the checked event information; outlet may be closed or reduced when volunteers are unavailable' }),
];

const trails = [
  make({ id:'curated-trails:bridge-of-dun-house-walk', name:'Bridge of Dun to House of Dun Walk', score:68, coordinates:[-2.550118,56.718539], featureType:'walking_route', description:'An official railway-recommended countryside walk from Bridge of Dun Station to the House of Dun estate, taking about 20 minutes each way.', reason:'A current, named-origin walking option with an official working link and a stated journey time; the destination remains separately assessed.', website:urls.steamSundays, sourceName:'Caledonian Railway Steam Sundays', sourceOrganisation:'Caledonian Railway Brechin Ltd', evidenceUrls:[urls.steamSundays,urls.railwayPlan], placeType:'Trail', category:'trail', tags:['curated-visitor','visitor-context-trail','current-context'], details:'trail_type=Official station walk; distance=about 20 minutes each way; route continues beyond the strict settlement boundary; free Walks from Bridge of Dun leaflets are advertised at the station; link checked 2026-08-30' }),
];

const picnic = [
  make({ id:'curated-picnic:bridge-of-dun-station', name:'Bridge of Dun Station Picnic Area', coordinates:[-2.550118,56.718539], featureType:'picnic_site', description:'A railway-station picnic area available to visitors on applicable operating and event days.', website:urls.railwayPlan, sourceName:'Caledonian Railway visitor facilities', sourceOrganisation:'Caledonian Railway Brechin Ltd', evidenceUrls:[urls.railwayPlan,'https://www.caledonianrailway.com/whats-on-1/day-out-with-thomas'], placeType:'Picnic', tags:['service-context-picnic','current-context','limited-opening'], details:'access=visitors; fee=no; admission_context=No separate picnic charge, but event or train admission may govern access; opening follows advertised railway/event access; table count not published' }),
];

const parking = [
  make({ id:'curated-parking:bridge-of-dun-station', name:'Bridge of Dun Station Visitor Parking', coordinates:[-2.550118,56.718539], featureType:'parking', description:'Free off-street parking at Bridge of Dun Station for railway visitors; capacity is not published and access follows railway opening arrangements.', website:urls.railwayPlan, sourceName:'Caledonian Railway parking information', sourceOrganisation:'Caledonian Railway Brechin Ltd', evidenceUrls:[urls.railwayPlan,urls.railwayFaq], placeType:'Parking', tags:['service-context-parking','current-context','limited-opening'], details:'access=visitors; fee=no; payment_required=no; price_display=Free; opening_hours:description=advertised railway operating and event access; capacity=not published; disabled access from the platform ramp into the car park' }),
];

const toilets = [
  make({ id:'curated-toilets:bridge-of-dun-station', name:'Bridge of Dun Station Visitor Toilets', coordinates:[-2.550118,56.718539], featureType:'toilets', description:'Customer toilets at Bridge of Dun Station when scheduled railway services and applicable events operate.', website:urls.railwayPlan, sourceName:'Caledonian Railway facilities', sourceOrganisation:'Caledonian Railway Brechin Ltd', evidenceUrls:[urls.railwayPlan,urls.railwayFaq], placeType:'Toilets', tags:['service-context-toilets','current-context','limited-opening'], details:'opening_hours:description=advertised railway operating and event hours only; no toilets on trains; not a public 24-hour facility' }),
];

const manualDates: Record<string, any> = {
  'hes-listed-building:LB4677': { text:'1785–1787', first:1785, last:1787, evidence:urls.bridgeHes, note:'The official designation transcribes the bridge inscription: founded 7 June 1785 and finished 27 January 1787.' },
  'hes-listed-building:LB6387': { text:'designed 1935; K6 production from 1936', first:1935, last:1936, evidence:urls.kioskHes, note:'The statutory description identifies the standard K6 design by Sir Giles Gilbert Scott, designed in 1935; K6 production began in 1936. The individual kiosk erection year is not stated.' },
};
for (const feature of pkg.features) {
  const fix = manualDates[feature.id];
  if (!fix) continue;
  feature.documentedDateText = fix.text;
  feature.earliestPossibleYear = fix.first;
  feature.latestPossibleYear = fix.last;
  feature.dateBasis = 'estimated_from_authoritative_source';
  feature.dateConfidence = feature.id.endsWith('LB4677') ? 'high' : 'medium';
  feature.tags = feature.tags.filter((tag: string) => tag !== 'map-hidden');
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = `${feature.reviewNotes ?? ''} ${fix.note} The designation/listing date is not used as a construction date.`.trim();
  if (!feature.sourceRecords.some((record: any) => record.sourceUrl === fix.evidence)) feature.sourceRecords.push({ sourceName:'Historic Environment Scotland construction-period evidence', sourceOrganisation:'Historic Environment Scotland', sourceUrl:fix.evidence, accessedAt:reviewedAt, reliability:'official_statutory', licence:'Open Government Licence v3.0; retain Historic Environment Scotland attribution.', notes:fix.note });
}

const curated = [...attractions,...foods,...trails,...picnic,...parking,...toilets];
pkg.features = [...pkg.features.filter((feature: any) => !feature.id.startsWith('curated-')), ...curated];
const highlightInfo: Record<string,[string,string,string,string,boolean]> = {
  'curated-attraction:bridge-of-dun-railway':['Heritage trains at a rural terminus','2–4 hours with a return journey','Selected published dates, principally summer weekends and special events','Steam Sunday adult return currently £10',false],
};
pkg.project.visitorHighlights = attractions.map((feature: any, index: number) => { const info=highlightInfo[feature.id]; return { rank:index+1, featureId:feature.id, name:feature.name, reason:feature.editorialReview.scoreRationale, tagline:info[0], visitorScore:84, timeToSpend:info[1], openingTimes:info[2], admission:info[3], freeAdmission:info[4], visitorWebsiteUrl:feature.visitorWebsiteUrl, editorialReview:feature.editorialReview, sourceName:feature.sourceRecords[0].sourceName, sourceUrl:feature.visitorWebsiteUrl, verifiedInBoundaryAt:reviewedDate }; });
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = { score:36, dogOwnerScore:35, dogAccessScoreAdjustment:-1, rating:0, label:'Minor Interest', summary:'A very small station-and-crossing locality. Its heritage railway terminus is a worthwhile separately scored See place; the historic bridge remains a dated HES landmark rather than being misrepresented as a managed attraction.', dogAccessRating:2, dogAccessSummary:'The railway welcomes dogs on most daytime services and the countryside walk can suit controlled dogs, but facilities are intermittent and the road bridge needs traffic care.', methodVersion:'2026-08-30-strict-settlement-full-audit-v3', reviewedAt:reviewedDate, sourceUrls:Object.values(urls) };
pkg.project.townGuide = { characterTag:'Rural railway terminus and South Esk crossing', headline:'One separate attraction at a very small locality', intro:'Bridge of Dun remains a 36% selector-only settlement. The heritage railway is shown as a separately scored See place; its appeal is not transferred into the hamlet score. The 1785–87 bridge remains visible in the historic heat layer.', bestFor:['Heritage railway journeys','A station-to-estate walk','Historic heat-map exploration'], perfectFor:['A railway operating day','Combining the station with House of Dun','A brief South Esk landmark stop'], suggestedFirstVisit:{title:'Plan around a railway operating day',summary:'Use the station only on an advertised operating day. Take the heritage journey or the official 20-minute walk towards House of Dun; the historic road bridge is a dated landmark rather than a managed visitor site.'}, dontMiss:['Caledonian Railway at Bridge of Dun'], suggestedTime:'Half a day with a booked railway journey; otherwise a pass-through locality', visitorMood:'Attraction-led rather than a visitor town: useful as a rural interchange and walking origin, with facilities tied to railway opening.', sourceUrls:Object.values(urls), lastReviewedAt:reviewedDate };
pkg.project.researchNotes = 'Full strict-boundary audit. Bridge of Dun remains selector-only and below 60. The Caledonian Railway terminus is separately published as a See place but does not inflate the settlement score. The Category A bridge has no genuine visitor-planning page or dedicated visitor provision, so it remains a visible, dated HES heat record rather than a fabricated attraction card. BufferStop Buffet, picnic space, customer parking and toilets operate only with railway access. A current official 20-minute station-to-House-of-Dun walk is published; the destination lies beyond the strict boundary and remains separately assessed. Direct checks found no dedicated Treasure Trails, Curious About, Mystery Guides or Go Quest product.';

planner.projects[projectId] = { eat:foods.map((item:any)=>item.id), trails:trails.map((item:any)=>item.id), picnic:picnic.map((item:any)=>item.id), parking:parking.map((item:any)=>item.id), toilets:toilets.map((item:any)=>item.id) };
const dogEntry = (rating:number,status:string,label:string,summary:string,sourceUrl:string) => ({ rating,status,label,summary,sourceName:'Bridge of Dun dog-access audit',sourceUrl,reviewedAt:reviewedDate });
dog.projects[projectId] = { attraction:{
  [attractions[0].id]:dogEntry(4,'welcoming','Dogs on most daytime trains','Dogs are welcome on most daytime services on leads, but not on trains where food or drink is served.',urls.railwayPlan),
}, trail:{ [trails[0].id]:dogEntry(4,'allowed','Countryside control needed','The station walk can suit dogs under close control; follow the Scottish Outdoor Access Code around livestock and other users.',urls.outdoorAccess) }, eat:{
  [foods[0].id]:dogEntry(0,'unconfirmed','Dog policy not published','No reliable current dog policy is published for the buffet interior; contact the railway before relying on indoor access.',urls.railwayFaq),
} };

const statutory = pkg.features.filter((feature:any)=>feature.tags.includes('hes-listed-building')||feature.tags.includes('hes-scheduled-monument'));
const visible = statutory.filter((feature:any)=>!feature.tags.includes('map-hidden'));
const dated = visible.filter((feature:any)=>feature.documentedDateText?.trim()&&feature.earliestPossibleYear!=null&&feature.latestPossibleYear!=null&&feature.dateBasis!=='unknown');
const report = { reviewedAt, projectId, status:'verified', settlementScore:36, previousScore:46, independentlyWorthwhile:false, publishOnTownMap:false, scoreRationale:'The railway is a separately assessed attraction; the tiny settlement has no independent town-centre depth and remains below 60.', publication:{see:1,eat:1,trails:1,picnic:1,parking:1,toilets:1}, heritage:{expectedListedBuildings:2,representedListedBuildings:statutory.length,visibleDatedStatutoryPins:dated.length,visibleUndatedStatutoryPins:visible.length-dated.length,hiddenStatutoryPins:statutory.length-visible.length,manualDateRepairs:Object.keys(manualDates)}, namedTrailSearch:{TreasureTrails:'No dedicated Bridge of Dun product found after direct search and link check',CuriousAbout:'No dedicated product found',MysteryGuides:'No dedicated product found',GoQuestAdventures:'No dedicated product found',retained:['Bridge of Dun to House of Dun Walk'],officialSource:urls.steamSundays}, practicalAudit:{eat:'BufferStop Buffet only on railway service days and subject to volunteer availability',picnic:'Station picnic area has no separate charge but only applies on operating/event days; table count not published',parking:'Official free station visitor parking is published with access tied to advertised railway/event arrangements; capacity is not published',toilets:'Station customer toilets only during advertised railway/event access',accessibility:'Official railway information states stations and trains are wheelchair accessible with boarding ramps',transport:'The railway is a heritage attraction, not a regular passenger service'}, exclusions:['Historic Bridge of Dun: retained as a visible dated HES landmark, not published as a managed attraction without a genuine visitor-planning page','House of Dun: beyond the strict settlement boundary and separately assessed','Montrose Basin visitor destinations: outside the strict settlement boundary','Arbroath–Montrose cycle route: a 55 km regional route, not misrepresented as a local trail'], verification:{allCuratedCoordinatesCheckedAgainstBoundary:true,trailLinksChecked:[urls.steamSundays,urls.railwayPlan],allStatutoryHesRecordsVisibleAndDated:dated.length===2&&visible.length===2,datesStoredWithoutChangingMapNames:true} };

await writeFile(projectPath,`${JSON.stringify(pkg,null,2)}\n`);
await writeFile(plannerPath,`${JSON.stringify(planner,null,2)}\n`);
await writeFile(dogPath,`${JSON.stringify(dog,null,2)}\n`);
await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
