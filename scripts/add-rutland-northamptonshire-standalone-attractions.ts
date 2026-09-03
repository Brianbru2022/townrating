import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  AttractionGuide,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
} from '../src/domain/models';

const reviewedAt = '2026-08-09T00:00:00Z';
const auditTag = 'rutland-northamptonshire-standalone-audit-2026-08-09';
const editorialLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

type ProjectKey = 'oakham' | 'uppingham' | 'corby' | 'kettering';

interface AttractionDefinition {
  project: ProjectKey;
  id: string;
  name: string;
  featureType: string;
  coordinates: [number, number];
  score: number;
  visitorType: string;
  description: string;
  opening: string;
  admission: string;
  timeToSpend: string;
  website: string;
  sourceName: string;
  sourceOrganisation: string;
  reliability?: SourceRecord['reliability'];
  significance?: HeritageFeature['significance'];
  organisation?: string;
  guide: AttractionGuide;
}

const projects: Record<ProjectKey, string> = {
  oakham: 'data/projects/oakham-england.json',
  uppingham: 'data/projects/uppingham-england.json',
  corby: 'data/projects/corby-england.json',
  kettering: 'data/projects/kettering-england.json',
};

const art = {
  burroughHill: '/attraction-guides/burrough-hill-country-park-watercolour.png',
  barnsdale: '/attraction-guides/barnsdale-gardens-watercolour.png',
  rutlandWildlife: '/attraction-guides/rutland-wildlife-sanctuary-watercolour.png',
  rutlandWater: '/attraction-guides/rutland-water-watercolour.png',
  bedeHouse: '/attraction-guides/lyddington-bede-house-watercolour.png',
  deene: '/attraction-guides/deene-park-watercolour.png',
  kirby: '/attraction-guides/kirby-hall-watercolour.png',
  rockingham: '/attraction-guides/rockingham-castle-watercolour.png',
  eastCarlton: '/attraction-guides/east-carlton-country-park-watercolour.png',
  boughton: '/attraction-guides/boughton-house-watercolour.png',
  eleanorCross: '/attraction-guides/geddington-eleanor-cross-watercolour.png',
  rushton: '/attraction-guides/rushton-triangular-lodge-watercolour.png',
  cottesbrooke: '/attraction-guides/cottesbrooke-hall-watercolour.png',
  lamport: '/attraction-guides/lamport-hall-watercolour.png',
};

const attractions: AttractionDefinition[] = [
  {
    project: 'oakham',
    id: 'standalone-attraction:burrough-hill-country-park',
    name: 'Burrough Hill Country Park',
    featureType: 'archaeological_site',
    coordinates: [-0.8726176, 52.701774],
    score: 82,
    visitorType: 'Iron Age hillfort and country park',
    description:
      'Climb one of Leicestershire\'s best-preserved Iron Age hillforts for broad countryside views and an atmospheric walk around its ramparts.',
    opening:
      'Open daily. The car park opens at 07:00 and closes seasonally between 16:00 in midwinter and 20:00 in summer.',
    admission: 'Free entry. Parking costs from £2.50 for one hour to £5.50 for over three hours.',
    timeToSpend: 'Allow 60-120 minutes',
    website: 'https://leicscountryparks.org.uk/parks/burrough-hill-country-park/',
    sourceName: 'Burrough Hill Country Park visitor information',
    sourceOrganisation: 'Leicestershire County Council',
    reliability: 'official_non_statutory',
    significance: 'national',
    guide: {
      heroImage: art.burroughHill,
      heroAlt: 'Bright ink-and-watercolour illustration of the grassy ramparts and wide views at Burrough Hill',
      headline: 'Iron Age ramparts and some of the widest views in Leicestershire',
      intro:
        'Burrough Hill combines a genuine prehistoric landmark with an uncomplicated country walk. The final rise is rewarded by a broad, breezy panorama.',
      motifs: ['Iron Age fort', 'Hilltop views', 'Country walk', 'Archaeology'],
      bestFor: ['Walkers', 'Big views', 'Prehistoric landscapes'],
      toilets: 'Public toilets are provided near the main car park.',
      picnic: 'Picnic tables and open grass are available near the visitor facilities.',
      thingsToDo: [
        { name: 'Walk the hillfort ramparts', summary: 'Trace the surviving banks and ditches around the summit.' },
        { name: 'Take in the summit panorama', summary: 'Use the exposed hilltop for long views across rural Leicestershire.' },
        { name: 'Read the archaeological landscape', summary: 'Look for the defended entrance and the shape of the Iron Age enclosure.' },
        { name: 'Follow the country-park paths', summary: 'Extend the summit visit through the surrounding grassland.' },
      ],
    },
  },
  {
    project: 'oakham',
    id: 'standalone-attraction:barnsdale-gardens',
    name: 'Barnsdale Gardens',
    featureType: 'garden',
    coordinates: [-0.6516075, 52.6875577],
    score: 87,
    visitorType: 'Garden attraction',
    description:
      'Explore 38 individually designed gardens created around Geoff Hamilton\'s television garden, with an excellent tearoom and nursery alongside.',
    opening:
      'March-October 09:00-17:00, last garden entry 16:00. November-February 10:00-16:00, last entry 15:00. Closed 24-26 December.',
    admission:
      'March-October adult £16; November-February adult £12; under-18s free. Tearoom and nursery do not require garden admission.',
    timeToSpend: 'Allow at least 3 hours',
    website: 'https://barnsdalegardens.co.uk/visitor-information.html',
    sourceName: 'Barnsdale Gardens visitor information',
    sourceOrganisation: 'Barnsdale Gardens',
    reliability: 'official_non_statutory',
    organisation: 'Barnsdale Gardens',
    guide: {
      heroImage: art.barnsdale,
      heroAlt: 'Bright editorial watercolour of richly planted garden rooms at Barnsdale Gardens',
      headline: 'Thirty-eight inspiring garden rooms, packed with practical ideas and colour',
      intro:
        'Barnsdale feels both intimate and abundant: a sequence of contrasting gardens where keen gardeners can linger and casual visitors always have another corner to discover.',
      motifs: ['Garden rooms', 'Geoff Hamilton', 'Seasonal colour', 'Plant nursery'],
      bestFor: ['Garden lovers', 'Slow afternoons', 'Practical planting ideas'],
      toilets: 'Visitor toilets include an accessible toilet and baby-changing provision.',
      picnic: 'No general picnic area is promoted; use the on-site tearoom or confirm current arrangements before bringing food.',
      food: [
        {
          name: 'Helenium Tea Room',
          visitorScore: 82,
          summary: 'A destination tearoom for breakfast, light lunches, afternoon tea and home baking.',
          openingTimes: 'March-October 09:00-16:30; November-February 10:00-15:30',
          priceBand: '££',
          externalUrl: 'https://barnsdalegardens.co.uk/visitor-information.html',
        },
      ],
      thingsToDo: [
        { name: 'Explore all 38 garden rooms', summary: 'Compare formal, cottage, wildlife and practical domestic-garden ideas.' },
        { name: 'Revisit Geoff Hamilton\'s television garden', summary: 'See the setting associated with one of Britain\'s best-known gardeners.' },
        { name: 'Follow the seasonal highlights', summary: 'Ask staff what is at its best on the day of your visit.' },
        { name: 'Browse the nursery', summary: 'Find plants and advice inspired by the gardens you have just explored.' },
        { name: 'Pause in the Helenium Tea Room', summary: 'Round off the visit with lunch, tea or home baking.' },
      ],
    },
  },
  {
    project: 'oakham',
    id: 'standalone-attraction:rutland-wildlife-sanctuary',
    name: 'Rutland Wildlife Sanctuary and Falconry Centre',
    featureType: 'other',
    coordinates: [-0.6680524, 52.6846053],
    score: 79,
    visitorType: 'Bird-of-prey and wildlife sanctuary',
    description:
      'Meet rescued birds of prey and other animals in a small independent sanctuary, with woodland paths and bookable owl or hawk experiences.',
    opening:
      'Usually Tuesday-Sunday and bank holidays, 10:00-16:00 in winter; seasonal closing and last-entry times vary. Confirm before travelling.',
    admission: 'Paid admission, cash only. Telephone ahead to confirm current prices.',
    timeToSpend: 'Allow 90-150 minutes',
    website: 'https://www.rutlandwildlifesanctuary.co.uk/visiting-the-centre/',
    sourceName: 'Visiting the centre',
    sourceOrganisation: 'Rutland Wildlife Sanctuary',
    reliability: 'official_non_statutory',
    organisation: 'Rutland Wildlife Sanctuary',
    guide: {
      heroImage: art.rutlandWildlife,
      heroAlt: 'Bright ink-and-watercolour illustration of an owl and falcon in a leafy Rutland sanctuary',
      headline: 'Close encounters with rescued birds of prey in a quietly wooded sanctuary',
      intro:
        'This is a modest, independently run animal visit rather than a polished zoo. Its strength is the chance to slow down and look closely at an unusual collection of birds.',
      motifs: ['Owls', 'Falconry', 'Rescue work', 'Woodland'],
      bestFor: ['Bird enthusiasts', 'Families', 'Close-up animal encounters'],
      toilets: 'Visitor toilets are available at the sanctuary.',
      picnic: 'Picnic provision is not clearly published; confirm before bringing a picnic.',
      thingsToDo: [
        { name: 'Meet the birds of prey', summary: 'See the sanctuary\'s collection of owls, hawks and falcons.' },
        { name: 'Book a handling experience', summary: 'Arrange an owl or hawk encounter in advance for a more memorable visit.' },
        { name: 'Follow the woodland walk', summary: 'Use the quieter paths to broaden the visit beyond the aviaries.' },
        { name: 'Learn about the rescue work', summary: 'Understand the sanctuary\'s rehabilitation and long-term care role.' },
      ],
    },
  },
  {
    project: 'oakham',
    id: 'standalone-attraction:rutland-water',
    name: 'Rutland Water',
    featureType: 'park',
    coordinates: [-0.617503, 52.6642564],
    score: 94,
    visitorType: 'Reservoir country park and outdoor destination',
    description:
      'Plan a full outdoor day around a vast reservoir with waterside walking and cycling, wildlife, boat trips, family activities, cafes and broad open views.',
    opening:
      'Main car parks open from 09:00 with seasonal closing times. Sykes Lane Visitor Centre opens 10:00-17:00 April-October, with shorter winter hours. Closed Christmas Day.',
    admission: 'Free general access. Parking is £2 per hour up to six hours, then £16.',
    timeToSpend: 'Allow 3 hours to a full day',
    website: 'https://anglianwaterparks.co.uk/rutland-water-park/visitor-information',
    sourceName: 'Rutland Water visitor information',
    sourceOrganisation: 'Anglian Water Parks',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'Anglian Water Parks',
    guide: {
      heroImage: art.rutlandWater,
      heroAlt: 'Bright editorial watercolour of Rutland Water, Normanton Church and active waterside paths',
      headline: 'Big-water views, wildlife and a full day of easy outdoor choices',
      intro:
        'Rutland Water is a genuine destination rather than a single stop. Choose a base to suit your day, from family-friendly Sykes Lane to watersports at Whitwell or the quieter Normanton shore.',
      motifs: ['Reservoir views', 'Cycling', 'Wildlife', 'Boat trips'],
      bestFor: ['Full outdoor days', 'Families', 'Cyclists and walkers'],
      toilets: 'Accessible toilets and Changing Places facilities are available at the principal visitor bases.',
      picnic: 'Formal picnic and barbecue areas are marked around the main visitor bases.',
      food: [
        { name: 'Harbour Bar Cafe', visitorScore: 78, summary: 'Dine-in and takeaway food at Whitwell.', priceBand: '££', externalUrl: 'https://anglianwaterparks.co.uk/rutland-water-park/visitor-information' },
        { name: 'Waterside Cafe', visitorScore: 77, summary: 'Accessible waterside cafe beside Normanton.', priceBand: '££', externalUrl: 'https://anglianwaterparks.co.uk/rutland-water-park/visitor-information' },
        { name: 'Funky Fox Takeaway Cafe', visitorScore: 72, summary: 'Family-day refreshments at Sykes Lane.', priceBand: '£', externalUrl: 'https://anglianwaterparks.co.uk/rutland-water-park/visitor-information' },
      ],
      trails: [
        { name: 'Sykes Lane to Normanton', routeType: 'Accessible linear waterside route', distance: 'About 2 miles each way', difficulty: 'Easy', summary: 'Mostly level surfaced route linking two principal visitor bases and Normanton Church.', externalUrl: 'https://anglianwaterparks.co.uk/rutland-water-park/walking-relaxing' },
        { name: 'Sykes Lane to Whitwell', routeType: 'Linear waterside walk', distance: 'About 1.5 miles each way', difficulty: 'Easy to moderate', summary: 'A short, slightly hillier link between the visitor centre and Whitwell.', externalUrl: 'https://anglianwaterparks.co.uk/rutland-water-park/walking-relaxing' },
        { name: 'Rutland Water Nature Reserve route', routeType: 'Nature-reserve walk', distance: 'About 1.6 miles', difficulty: 'Easy', summary: 'A compact route from Egleton through lagoons and bird hides.', externalUrl: 'https://anglianwaterparks.co.uk/rutland-water-park/walking-relaxing' },
      ],
      thingsToDo: [
        { name: 'Walk or cycle the shoreline', summary: 'Choose a short accessible section or make a much bigger circuit of the reservoir.' },
        { name: 'See Normanton Church', summary: 'Visit the reservoir\'s most recognisable landmark on its small peninsula.' },
        { name: 'Watch wildlife at Egleton', summary: 'Use the reserve visitor centre and hides for birds and seasonal nature.' },
        { name: 'Take to the water', summary: 'Choose a cruise, fishing or watersports from the appropriate visitor base.' },
        { name: 'Build a family day at Sykes Lane', summary: 'Combine the beach, play area, mini golf and visitor centre.' },
      ],
    },
  },
  {
    project: 'uppingham',
    id: 'standalone-attraction:lyddington-bede-house',
    name: 'Lyddington Bede House',
    featureType: 'historic_building',
    coordinates: [-0.7093497, 52.5638593],
    score: 79,
    visitorType: 'Medieval bishops\' palace and almshouse',
    description:
      'Step inside the surviving wing of a medieval bishops\' palace, later adapted as an almshouse, and combine it with Lyddington\'s handsome village streets.',
    opening: 'Seasonal dated opening. Check the official calendar before travelling.',
    admission: 'Paid admission; English Heritage members free. Advance booking is recommended.',
    timeToSpend: 'Allow about 1 hour, plus the village walk',
    website: 'https://www.english-heritage.org.uk/visit/places/lyddington-bede-house/prices-and-opening-times/',
    sourceName: 'Lyddington Bede House visitor information',
    sourceOrganisation: 'English Heritage',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'English Heritage',
    guide: {
      heroImage: art.bedeHouse,
      heroAlt: 'Bright ink-and-watercolour illustration of Lyddington Bede House and its quiet village setting',
      headline: 'A rare medieval palace survivor hidden in one of Rutland\'s loveliest villages',
      intro:
        'The Bede House is compact, atmospheric and best enjoyed as part of Lyddington itself. Its carved interiors and almshouse story reward a patient look.',
      motifs: ['Medieval palace', 'Almshouse', 'Village walk', 'Walled garden'],
      bestFor: ['Medieval history', 'Quiet villages', 'Compact heritage visits'],
      toilets: 'There are no visitor toilets at the Bede House.',
      picnic: 'Picnics are welcome on the lawn, although tables and benches are not provided.',
      trails: [
        { name: 'Lyddington village and fishponds walk', routeType: 'Short village extension', duration: '20-40 minutes', difficulty: 'Easy', summary: 'Continue through the village to the medieval fishpond earthworks, five to ten minutes from the site.', externalUrl: 'https://www.english-heritage.org.uk/visit/places/lyddington-bede-house/facilities/' },
      ],
      thingsToDo: [
        { name: 'Explore the surviving palace wing', summary: 'Read the building\'s transformation from episcopal residence to almshouse.' },
        { name: 'Look for carved interior detail', summary: 'Give the small rooms time; their architectural detail carries much of the story.' },
        { name: 'Pause in the walled garden', summary: 'Use the quiet garden to appreciate the building in its village setting.' },
        { name: 'Walk to the medieval fishponds', summary: 'Add a short outdoor extension through Lyddington.' },
      ],
    },
  },
  {
    project: 'corby',
    id: 'standalone-attraction:deene-park',
    name: 'Deene Park',
    featureType: 'historic_building',
    coordinates: [-0.60087, 52.5239],
    score: 84,
    visitorType: 'Historic house and gardens',
    description:
      'Visit a lived-in country house shaped by the Brudenell family, with richly furnished rooms and a sequence of formal gardens.',
    opening: 'Selected 2026 open days. Gardens 13:00-17:00; house from 14:00; last entry 15:45.',
    admission: 'House and garden adult £18, child £8, family £50. Garden adult £11, child £6, family £30.',
    timeToSpend: 'Allow 2-3 hours',
    website: 'https://deenepark.com/home/plan-your-visit/opening-times-and-admission-fees',
    sourceName: 'Deene Park opening and visitor information',
    sourceOrganisation: 'Deene Park',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'Historic Houses',
    guide: {
      heroImage: art.deene,
      heroAlt: 'Bright editorial watercolour of Deene Park house, formal garden and parkland',
      headline: 'A warm, lived-in country house with gardens made for an unhurried afternoon',
      intro:
        'Deene feels personal rather than palatial. The rooms remain visibly lived in, while the gardens move from clipped formality to softer seasonal planting.',
      motifs: ['Country house', 'Formal gardens', 'Brudenell family', 'Parkland'],
      bestFor: ['Historic interiors', 'Garden lovers', 'Slow summer afternoons'],
      toilets: 'Visitor toilets and accessible facilities are available near the main visitor route.',
      picnic: 'Picnics are welcome on the East Lawn; barbecues are not permitted.',
      food: [
        { name: 'Old Kitchen Tearoom', visitorScore: 76, summary: 'Home-made cakes, snacks and cream teas on public open days.', priceBand: '££', externalUrl: 'https://deenepark.com/home/plan-your-visit' },
      ],
      thingsToDo: [
        { name: 'Tour the lived-in interiors', summary: 'See rooms that retain the character of a family home.' },
        { name: 'Walk the formal gardens', summary: 'Move through the parterre, rose garden, white garden and long borders.' },
        { name: 'Find the garden summer house', summary: 'Pause for the estate story and a different view across the planting.' },
        { name: 'Picnic on the East Lawn', summary: 'Use the permitted lawn for a relaxed pause away from the formal garden.' },
      ],
    },
  },
  {
    project: 'corby',
    id: 'standalone-attraction:kirby-hall',
    name: 'Kirby Hall',
    featureType: 'historic_building',
    coordinates: [-0.6365208, 52.5245389],
    score: 86,
    visitorType: 'Elizabethan great house and gardens',
    description:
      'Explore the spectacular shell of an Elizabethan prodigy house, where roofless state rooms, surviving interiors and formal gardens create a richly atmospheric visit.',
    opening: 'Seasonal dated opening. Check the official calendar before travelling.',
    admission: 'Paid admission; English Heritage members free. Advance booking saves 15%.',
    timeToSpend: 'Allow 90-150 minutes',
    website: 'https://www.english-heritage.org.uk/visit/places/kirby-hall/prices-and-opening-times/',
    sourceName: 'Kirby Hall visitor information',
    sourceOrganisation: 'English Heritage',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'English Heritage',
    guide: {
      heroImage: art.kirby,
      heroAlt: 'Bright ink-and-watercolour illustration of Kirby Hall and its formal garden',
      headline: 'A grand Elizabethan house made more atmospheric by its beautiful incompleteness',
      intro:
        'Kirby Hall balances scale and romance: intact rooms lead into roofless ranges, while the restored formal garden helps the whole place make visual sense.',
      motifs: ['Elizabethan house', 'Romantic ruins', 'Formal garden', 'Audio tour'],
      bestFor: ['Architecture', 'Historic ruins', 'Garden-and-house visits'],
      toilets: 'Male, female and accessible toilets with baby-changing facilities are provided.',
      picnic: 'Picnics are welcome in the grounds.',
      thingsToDo: [
        { name: 'Walk through the roofless state rooms', summary: 'Experience the scale of the house beneath open sky.' },
        { name: 'Explore the surviving interiors', summary: 'Contrast the intact rooms with the romantic ruined ranges.' },
        { name: 'Follow the included audio tour', summary: 'Use the commentary to rebuild the house\'s former life.' },
        { name: 'See the formal garden', summary: 'Take in the patterned planting and the best composed views of the house.' },
        { name: 'Walk the wider grounds', summary: 'Step back from the building to appreciate its isolated setting.' },
      ],
    },
  },
  {
    project: 'corby',
    id: 'standalone-attraction:rockingham-castle',
    name: 'Rockingham Castle',
    featureType: 'historic_building',
    coordinates: [-0.7241896, 52.5129796],
    score: 88,
    visitorType: 'Castle, historic house and gardens',
    description:
      'Discover a castle occupied for almost a thousand years, combining medieval defences, a richly furnished house, gardens and a commanding view across five counties.',
    opening:
      '3 May-29 September 2026 on Tuesdays, Sundays and bank-holiday Mondays. Grounds 11:00; castle 11:30; last castle entry 15:00; site closes 16:00.',
    admission: 'House and gardens adult £19.25, child £11.50, family £49.90. Gardens-only tickets are available.',
    timeToSpend: 'Allow 2-3 hours',
    website: 'https://rockinghamcastle.com/opening-times-2026/',
    sourceName: 'Rockingham Castle 2026 opening times',
    sourceOrganisation: 'Rockingham Castle',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'Historic Houses',
    guide: {
      heroImage: art.rockingham,
      heroAlt: 'Bright editorial watercolour of Rockingham Castle, gatehouse and terraced gardens',
      headline: 'A thousand years of castle life above one of the Midlands\' great viewpoints',
      intro:
        'Rockingham is both fortress and family home. The gatehouse supplies the drama, the interiors the continuity, and the terrace the immense final view.',
      motifs: ['Castle gatehouse', 'Historic interiors', 'Terraced gardens', 'Five-county view'],
      bestFor: ['Castle enthusiasts', 'Historic interiors', 'Grand viewpoints'],
      toilets: 'Visitor toilets, including accessible provision, are available on site.',
      picnic: 'Picnics are welcome in the grounds.',
      food: [
        { name: "Walker's House Tea Room", visitorScore: 78, summary: 'Light lunches, cakes and refreshments on summer open days.', openingTimes: 'Open on general public summer days', priceBand: '££', externalUrl: 'https://rockinghamcastle.com/your-visit/faqs/' },
      ],
      thingsToDo: [
        { name: 'Enter through the medieval gatehouse', summary: 'Start with the castle\'s strongest defensive and visual statement.' },
        { name: 'Tour the furnished rooms', summary: 'Follow almost a millennium of occupation through a still-lived-in house.' },
        { name: 'Walk the terraced gardens', summary: 'See formal planting arranged against the castle walls.' },
        { name: 'Find the five-county view', summary: 'Use the elevated terrace for the visit\'s biggest panorama.' },
        { name: 'Look for the Civil War story', summary: 'Trace the events that reshaped the castle and its defences.' },
      ],
    },
  },
  {
    project: 'corby',
    id: 'standalone-attraction:east-carlton-country-park',
    name: 'East Carlton Country Park',
    featureType: 'park',
    coordinates: [-0.7761564, 52.4953464],
    score: 80,
    visitorType: 'Country park and heritage centre',
    description:
      'Choose from easy woodland and meadow circuits around a former country-house estate, with a cafe, play area and local ironstone heritage displays.',
    opening:
      'Park open daily. Cafe and toilets open 10:00-16:30 April-September and 10:00-15:30 October-March.',
    admission: 'Free entry and free parking.',
    timeToSpend: 'Allow 60-150 minutes',
    website: 'https://www.northnorthants.gov.uk/east-carlton-country-park',
    sourceName: 'East Carlton Country Park visitor information',
    sourceOrganisation: 'North Northamptonshire Council',
    reliability: 'official_non_statutory',
    guide: {
      heroImage: art.eastCarlton,
      heroAlt: 'Bright ink-and-watercolour illustration of East Carlton parkland, woodland and heritage centre',
      headline: 'Easy estate walks, family space and a thread of ironstone history',
      intro:
        'East Carlton is a flexible local day out: short enough for coffee and a stroll, but with enough linked paths, play and heritage to fill a relaxed half day.',
      motifs: ['Parkland', 'Woodland walks', 'Ironstone heritage', 'Family play'],
      bestFor: ['Easy walks', 'Families', 'Dog-friendly outings'],
      toilets: 'Public toilets include accessible and Changing Places facilities.',
      picnic: 'Picnic tables and open grass are available across the park.',
      food: [
        { name: 'East Carlton Country Park Cafe', visitorScore: 72, summary: 'Coffee, cake and light refreshments beside the visitor facilities.', openingTimes: '10:00-16:30 summer; 10:00-15:30 winter', priceBand: '£', externalUrl: 'https://www.northnorthants.gov.uk/east-carlton-country-park' },
      ],
      trails: [
        { name: 'Green route', routeType: 'Country-park circuit', distance: '0.6 miles / 1 km', difficulty: 'Easy', summary: 'The shortest circuit for a gentle visit.', externalUrl: 'https://www.northnorthants.gov.uk/east-carlton-country-park' },
        { name: 'Blue route', routeType: 'Country-park circuit', distance: '1 mile / 1.6 km', difficulty: 'Easy', summary: 'A medium loop through the estate landscape.', externalUrl: 'https://www.northnorthants.gov.uk/east-carlton-country-park' },
        { name: 'Red route', routeType: 'Country-park circuit', distance: '1.3 miles / 2.1 km', difficulty: 'Easy to moderate', summary: 'The longest signed park circuit.', externalUrl: 'https://www.northnorthants.gov.uk/east-carlton-country-park' },
      ],
      thingsToDo: [
        { name: 'Choose a signed park circuit', summary: 'Pick the green, blue or red route to match your time.' },
        { name: 'Visit the heritage centre', summary: 'Connect the estate landscape with the local ironstone story.' },
        { name: 'Use the play area', summary: 'Give younger visitors an active stop beside the main facilities.' },
        { name: 'Explore the woodland edges', summary: 'Look for seasonal colour and wildlife away from the busier lawns.' },
      ],
    },
  },
  {
    project: 'kettering',
    id: 'standalone-attraction:boughton-house',
    name: 'Boughton House',
    featureType: 'historic_building',
    coordinates: [-0.6778635, 52.4243353],
    score: 87,
    visitorType: 'Country house, art collection and gardens',
    description:
      'See one of Britain\'s great privately held houses, with exceptional collections, formal state rooms and a restored landscape of avenues, water and garden structures.',
    opening:
      'Selected 2026 dates in April, May, August and early September. House and gardens 12:30-17:00; tours and tearoom from 13:00.',
    admission: 'House tours from adult £14; garden adult £8. Tour supplements apply to selected routes.',
    timeToSpend: 'Allow 3-4 hours',
    website: 'https://www.boughtonhouse.co.uk/plan-a-visit/',
    sourceName: 'Boughton House plan a visit',
    sourceOrganisation: 'Boughton House',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'Historic Houses',
    guide: {
      heroImage: art.boughton,
      heroAlt: 'Bright editorial watercolour of Boughton House, formal water and tree-lined avenues',
      headline: 'Grand collections and a restored landscape on an almost palatial scale',
      intro:
        'Boughton rewards planning: opening is limited, but the combination of major interiors, art and an ambitious French-influenced landscape makes those dates feel special.',
      motifs: ['Great house', 'Art collection', 'Formal gardens', 'Historic parkland'],
      bestFor: ['Art and interiors', 'Garden history', 'Special-occasion visits'],
      toilets: 'Visitor toilets and accessible facilities are provided in the visitor area.',
      picnic: 'Picnic arrangements vary by event and opening day; use the tearoom or confirm before bringing food.',
      food: [
        { name: 'Stableyard Tearoom', visitorScore: 75, summary: 'Drinks, cakes and pre-packed snacks on house open days.', openingTimes: '13:00-17:00 on open days', priceBand: '££', externalUrl: 'https://www.boughtonhouse.co.uk/plan-a-visit/' },
      ],
      trails: [
        { name: 'Boughton gardens and parkland walk', routeType: 'Self-guided estate walk', difficulty: 'Easy', summary: 'Use the official garden map to explore avenues, water features, Orpheus and Star Pond.', externalUrl: 'https://www.boughtonhouse.co.uk/gardens/' },
      ],
      thingsToDo: [
        { name: 'Choose a house tour', summary: 'Select the route that best matches your interest in state rooms, collections or private life.' },
        { name: 'Walk the grand avenues', summary: 'Experience the landscape at the scale intended by its ducal creators.' },
        { name: 'Find Orpheus', summary: 'See the estate\'s remarkable inverted pyramid landform.' },
        { name: 'Pause at the restored Star Pond', summary: 'Enjoy one of the landscape\'s most tranquil recent restorations.' },
        { name: 'Study the art and furniture', summary: 'Give the major collection time rather than treating the house as a quick circuit.' },
      ],
    },
  },
  {
    project: 'kettering',
    id: 'standalone-attraction:geddington-eleanor-cross',
    name: 'Geddington Eleanor Cross',
    featureType: 'monument',
    coordinates: [-0.6856178, 52.4378854],
    score: 76,
    visitorType: 'Medieval royal memorial',
    description:
      'Stop in Geddington to see one of only three surviving Eleanor Crosses, raised by Edward I after Queen Eleanor\'s funeral procession halted here in 1290.',
    opening: 'Outdoor public monument with no formal opening hours.',
    admission: 'Free',
    timeToSpend: 'Allow 15-30 minutes',
    website: 'https://historicengland.org.uk/listing/the-list/list-entry/1013313',
    sourceName: 'Eleanor Cross scheduled monument record',
    sourceOrganisation: 'Historic England',
    reliability: 'official_statutory',
    significance: 'national',
    guide: {
      heroImage: art.eleanorCross,
      heroAlt: 'Bright ink-and-watercolour illustration of the medieval Eleanor Cross in Geddington village',
      headline: 'One of England\'s three surviving Eleanor Crosses, still anchoring its village',
      intro:
        'The cross is a brief visit but an exceptional survivor. Its rich medieval carving turns an ordinary village junction into a place of national memory.',
      motifs: ['Medieval sculpture', 'Royal history', 'Village landmark', 'Outdoor stop'],
      bestFor: ['Medieval history', 'Short heritage detours', 'Architectural detail'],
      toilets: 'No dedicated attraction toilets are provided at the outdoor monument.',
      picnic: 'No dedicated picnic area is provided at the monument.',
      thingsToDo: [
        { name: 'Study the carved figures', summary: 'Look closely at the surviving royal imagery and Gothic detail.' },
        { name: 'Walk around the full cross', summary: 'Each face contributes to the memorial\'s design and story.' },
        { name: 'Explore Geddington village', summary: 'Add the bridge, church and old village streets to make a fuller stop.' },
      ],
    },
  },
  {
    project: 'kettering',
    id: 'standalone-attraction:rushton-triangular-lodge',
    name: 'Rushton Triangular Lodge',
    featureType: 'historic_building',
    coordinates: [-0.779853, 52.4394],
    score: 80,
    visitorType: 'Elizabethan symbolic lodge',
    description:
      'Decode an extraordinary triangular Elizabethan building whose three-sided plan and dense decoration express Sir Thomas Tresham\'s Catholic faith.',
    opening: 'Usually the first and third weekend of each month, 11:00-14:00, until October. Check dated opening before travel.',
    admission: 'Free',
    timeToSpend: 'Allow 30-60 minutes',
    website: 'https://www.english-heritage.org.uk/visit/places/rushton-triangular-lodge/prices-and-opening-times/',
    sourceName: 'Rushton Triangular Lodge visitor information',
    sourceOrganisation: 'English Heritage',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'English Heritage',
    guide: {
      heroImage: art.rushton,
      heroAlt: 'Bright editorial watercolour of Rushton Triangular Lodge and its three-sided Elizabethan form',
      headline: 'An architectural puzzle in stone, built entirely around the number three',
      intro:
        'Rushton is small, singular and intensely detailed. The pleasure lies in decoding how faith, geometry and Elizabethan craftsmanship meet in one compact building.',
      motifs: ['Elizabethan design', 'Symbolism', 'Catholic history', 'Architecture'],
      bestFor: ['Architectural curiosities', 'Elizabethan history', 'Short focused visits'],
      toilets: 'No visitor toilets are provided.',
      picnic: 'No formal picnic area is provided.',
      thingsToDo: [
        { name: 'Walk all three sides', summary: 'Compare the elevations and repeated triangular motifs.' },
        { name: 'Decode the inscriptions', summary: 'Look for numbers, texts and symbols tied to the Trinity.' },
        { name: 'Explore the compact interior', summary: 'See how the triangular plan works inside the lodge.' },
        { name: 'Photograph the geometry', summary: 'Use oblique angles to make the unusual form legible.' },
      ],
    },
  },
  {
    project: 'kettering',
    id: 'standalone-attraction:cottesbrooke-hall-and-gardens',
    name: 'Cottesbrooke Hall and Gardens',
    featureType: 'historic_building',
    coordinates: [-0.9574738, 52.3591761],
    score: 83,
    visitorType: 'Queen Anne house and gardens',
    description:
      'Visit a graceful Queen Anne house known for sporting art, then roam a sequence of richly planted gardens and quiet parkland views.',
    opening:
      '4 May-24 September 2026. May-June Wednesday and Thursday 14:00-17:30; July-September Thursday only 14:00-17:30; selected bank-holiday Mondays.',
    admission: 'House and garden adult £17; garden adult £14. Child and online-discount rates are available.',
    timeToSpend: 'Allow 2-3 hours',
    website: 'https://www.cottesbrooke.co.uk/visit-us/',
    sourceName: 'Cottesbrooke Hall visit information',
    sourceOrganisation: 'Cottesbrooke Hall and Gardens',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'Historic Houses',
    guide: {
      heroImage: art.cottesbrooke,
      heroAlt: 'Bright ink-and-watercolour illustration of Cottesbrooke Hall and its flower-filled gardens',
      headline: 'A poised Queen Anne house surrounded by gardens with real horticultural depth',
      intro:
        'Cottesbrooke is a composed, seasonal visit: an elegant house tour followed by gardens that reward slow looking rather than a hurried circuit.',
      motifs: ['Queen Anne house', 'Sporting art', 'Flower gardens', 'Parkland'],
      bestFor: ['Garden lovers', 'Country-house interiors', 'Quiet summer visits'],
      toilets: 'Visitor toilets are available during public opening.',
      picnic: 'Use the designated picnic area beside the lake near the car park; picnics are not allowed in the gardens.',
      food: [
        { name: 'Old Laundry Tearoom', visitorScore: 74, summary: 'Homemade cakes and drinks for ticketed visitors.', openingTimes: '14:30-17:00 on public open days', priceBand: '£', externalUrl: 'https://www.cottesbrooke.co.uk/visit-us/' },
      ],
      thingsToDo: [
        { name: 'Take the house tour', summary: 'Allow about 45 minutes for the interiors and sporting-art collection.' },
        { name: 'Explore the formal gardens', summary: 'Move through distinct planted areas with changing seasonal highlights.' },
        { name: 'Find the quieter garden rooms', summary: 'Look beyond the main lawns for more intimate planting and detail.' },
        { name: 'Picnic beside the lake', summary: 'Use the designated area before or after the formal visit.' },
      ],
    },
  },
  {
    project: 'kettering',
    id: 'standalone-attraction:lamport-hall',
    name: 'Lamport Hall',
    featureType: 'historic_building',
    coordinates: [-0.8868858, 52.3635621],
    score: 82,
    visitorType: 'Historic house, gardens and museum',
    description:
      'Tour an intriguing country house with a long family story, unusual collections, formal gardens and one of the county\'s better destination cafes.',
    opening:
      '1 April-1 October 2026. House Wednesday-Thursday: tours 11:00, free flow 12:00-15:00, last entry 14:30. Gardens Wednesday-Friday 10:00-16:00.',
    admission: 'House and garden adult £16; garden adult £11. Child and family rates are available.',
    timeToSpend: 'Allow 2-3 hours',
    website: 'https://www.lamporthall.co.uk/plan-your-visit/opening-times-and-admission/',
    sourceName: 'Lamport Hall opening and admission information',
    sourceOrganisation: 'Lamport Hall Preservation Trust',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'Historic Houses',
    guide: {
      heroImage: art.lamport,
      heroAlt: 'Bright editorial watercolour of Lamport Hall, its formal lawn and garden planting',
      headline: 'An eccentric country-house story with handsome gardens and a strong cafe stop',
      intro:
        'Lamport mixes architectural polish with characterful collections. It is easy to pair a one-hour house visit with gardens, exhibitions and a leisurely lunch.',
      motifs: ['Country house', 'Unusual collections', 'Formal gardens', 'Cafe'],
      bestFor: ['Characterful interiors', 'Garden visits', 'Lunch-and-history days'],
      toilets: 'Visitor toilets and accessible facilities are available near the cafe and visitor route.',
      picnic: 'Picnics may be eaten in the stable courtyard, but not in the main gardens.',
      food: [
        { name: 'The Stables Cafe', visitorScore: 81, summary: 'A strong independent daytime stop for breakfast, lunch, coffee and cake.', openingTimes: 'Wednesday-Friday 09:30-16:00 in the open season', priceBand: '££', externalUrl: 'https://www.lamporthall.co.uk/plan-your-visit/tearoom/' },
      ],
      thingsToDo: [
        { name: 'Tour the Hall', summary: 'Allow about an hour for the principal rooms and layered family story.' },
        { name: 'Explore the gardens', summary: 'Walk the formal areas and seasonal planting around the house.' },
        { name: 'Look for the unusual collections', summary: 'Give the smaller displays time; eccentric detail is part of Lamport\'s appeal.' },
        { name: 'Have lunch at The Stables', summary: 'Make the cafe part of the visit rather than an afterthought.' },
      ],
    },
  },
];

function currentSource(definition: AttractionDefinition): SourceRecord {
  const organisation = definition.organisation ? `; operator=${definition.organisation}` : '';
  return {
    sourceName: definition.sourceName,
    sourceOrganisation: definition.sourceOrganisation,
    sourceRecordId: `standalone-audit:${definition.id}`,
    sourceUrl: definition.website,
    accessedAt: reviewedAt,
    licence: editorialLicence,
    reliability: definition.reliability ?? 'official_non_statutory',
    notes:
      `Current-place curation: tourism=attraction; name=${definition.name}; ` +
      `visitor_place_type=${definition.visitorType}; visit_score=${definition.score}; ` +
      `opening_hours:description=${definition.opening}; entrance_fee=${definition.admission}; ` +
      `time_to_spend=${definition.timeToSpend}; description=${definition.description}; ` +
      `toilets=${definition.guide.toilets ?? 'Not confirmed'}; ` +
      `picnic=${definition.guide.picnic ?? 'Not confirmed'}${organisation}; website=${definition.website}.`,
  };
}

function featureFor(pkg: ProjectPackage, definition: AttractionDefinition): HeritageFeature {
  return {
    id: definition.id,
    projectId: pkg.project.id,
    name: definition.name,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType: definition.featureType,
    significance: definition.significance ?? 'regional',
    geometry: { type: 'Point', coordinates: definition.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription: definition.description,
    sourceRecords: [currentSource(definition)],
    tags: ['current-context', 'service-context-visitor', 'home-standalone-place', auditTag],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Current visitor attraction reviewed from the linked official or responsible visitor source on 2026-08-09. It is outside the active town boundary and appears only in Home discovery.',
    evidenceScope: 'related_context',
    attractionGuide: definition.guide,
    homeMapEligible: true,
    licence: editorialLicence,
  };
}

const writtenProjects: Record<string, string[]> = {};
for (const [key, relativePath] of Object.entries(projects) as [ProjectKey, string][]) {
  const projectPath = resolve(relativePath);
  const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
  const ids = new Set(attractions.filter((definition) => definition.project === key).map((definition) => definition.id));
  pkg.features = pkg.features.filter(
    (feature) => !feature.tags.includes(auditTag) && !ids.has(feature.id),
  );
  const projectAttractions = attractions.filter((definition) => definition.project === key);
  pkg.features.push(...projectAttractions.map((definition) => featureFor(pkg, definition)));
  const note =
    'Rutland and Northamptonshire standalone attraction audit added 2026-08-09. These regional destinations sit outside the active town boundary, appear only on Home discovery, and do not alter the town tourist rating.';
  pkg.project.researchNotes = pkg.project.researchNotes?.includes(note)
    ? pkg.project.researchNotes
    : `${pkg.project.researchNotes ? `${pkg.project.researchNotes.trim()} ` : ''}${note}`;
  await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  writtenProjects[pkg.project.id] = projectAttractions.map((definition) => definition.id);
}

const audit = {
  schemaVersion: 1,
  reviewedAt,
  requestCount: 16,
  uniqueRequestCount: 15,
  addedCount: attractions.length,
  alreadyPresent: [
    {
      requestedName: 'Fermyn Woods Country Park',
      id: 'standalone-attraction:fermyn-woods-country-park',
      hostProject: 'thrapston-england',
      reason: 'Already shipped as a researched standalone Home attraction.',
    },
  ],
  duplicates: [{ requestedName: 'East Carlton Country Park', occurrences: 2, addedOnce: true }],
  corrections: {
    'Burrough hill country partk': 'Burrough Hill Country Park',
    'Bede House': 'Lyddington Bede House',
    'Kirkby Hall': 'Kirby Hall',
    'Broughton House': 'Boughton House',
    'Eleanor Cross': 'Geddington Eleanor Cross',
  },
  added: attractions.map((definition) => ({
    id: definition.id,
    name: definition.name,
    project: definition.project,
    score: definition.score,
    coordinates: definition.coordinates,
    sourceUrl: definition.website,
  })),
  projectFeatureIds: writtenProjects,
  rules: [
    'All added attractions are outside the active town visitor boundary and are tagged home-standalone-place.',
    'Standalone records are current visitor context and never contribute to historic heat-map dating or town tourist ratings.',
    'East Carlton Country Park was requested twice and is stored once.',
    'Fermyn Woods Country Park was preserved from the existing Peterborough-region standalone library.',
    'Opening, admission and access details should be checked against the linked source before a special journey.',
  ],
};

await writeFile(
  resolve('data/review/rutland-northamptonshire-standalone-attractions-2026-08-09.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
);

console.log(`Added ${attractions.length} standalone attractions across ${Object.keys(writtenProjects).length} project packages.`);
