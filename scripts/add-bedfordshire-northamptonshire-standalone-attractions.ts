import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  AttractionGuide,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
} from '../src/domain/models';

const reviewedAt = '2026-08-09T00:00:00Z';
const auditTag = 'bedfordshire-northamptonshire-standalone-audit-2026-08-09';
const editorialLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

type ProjectKey = 'highamFerrers' | 'wellingborough' | 'northampton' | 'olney' | 'miltonKeynes';

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
  highamFerrers: 'data/projects/higham-ferrers-england.json',
  wellingborough: 'data/projects/wellingborough-england.json',
  northampton: 'data/projects/northampton-england.json',
  olney: 'data/projects/olney-england.json',
  miltonKeynes: 'data/projects/milton-keynes-england.json',
};

const art = {
  woodland: '/attraction-guides/ancient-woodland-reserve-watercolour.png',
  wetland: '/attraction-guides/country-park-wetland-watercolour.png',
  forest: '/attraction-guides/forest-country-park-watercolour.png',
  family: '/attraction-guides/family-country-attraction-watercolour.png',
  heritage: '/attraction-guides/historic-estates-watercolour.png',
};

const attractions: AttractionDefinition[] = [
  {
    project: 'highamFerrers',
    id: 'standalone-attraction:chichele-college',
    name: 'Chichele College',
    featureType: 'historic_building',
    coordinates: [-0.5935048, 52.3076858],
    score: 78,
    visitorType: 'Medieval chantry college ruins and garden',
    description:
      'Step into the quiet remains of a rare fifteenth-century chantry college, founded by Archbishop Henry Chichele in his home town.',
    opening:
      'The garden is open during reasonable daylight hours. Interior access is limited to advertised summer exhibitions and events; check before travelling for indoor access.',
    admission: 'Free entry. A small free car park is available on Saffron Road, about two minutes away.',
    timeToSpend: 'Allow 30-60 minutes',
    website: 'https://www.english-heritage.org.uk/visit/places/chichele-college/',
    sourceName: 'Chichele College visitor information',
    sourceOrganisation: 'English Heritage',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'English Heritage',
    guide: {
      heroImage: art.heritage,
      heroAlt: 'Bright editorial watercolour of medieval stone buildings and a quiet garden',
      headline: 'A rare medieval college hidden behind Higham Ferrers High Street',
      intro:
        'Chichele College is a compact, atmospheric stop whose fragmentary buildings still frame a peaceful garden. It works best with the church and historic streets nearby.',
      motifs: ['Medieval college', 'Quiet garden', 'Henry Chichele', 'Stone ruins'],
      bestFor: ['Medieval history', 'Quiet discoveries', 'Short heritage stops'],
      toilets: 'Toilets are normally available only when the chapel or an event is open.',
      picnic: 'No formal picnic provision is promoted within the monument garden.',
      trails: [
        {
          name: 'Higham Ferrers heritage walk',
          routeType: 'Historic town extension',
          duration: '30-60 minutes',
          difficulty: 'Easy',
          summary: 'Link the college with St Mary the Virgin, the market square and the town\'s surviving historic core.',
          externalUrl: 'https://www.english-heritage.org.uk/visit/places/chichele-college/history/',
        },
      ],
      thingsToDo: [
        { name: 'Explore the college remains', summary: 'Read the surviving buildings as the shell of a medieval religious community.' },
        { name: 'Pause in the garden', summary: 'Enjoy the unusual calm of the enclosed site just off the town centre.' },
        { name: 'Look for an open-day interior', summary: 'Time a visit with a summer exhibition or event if seeing inside matters.' },
        { name: 'Continue through historic Higham Ferrers', summary: 'Add the church, market square and Chichele connections nearby.' },
      ],
    },
  },
  {
    project: 'wellingborough',
    id: 'standalone-attraction:irchester-country-park',
    name: 'Irchester Country Park',
    featureType: 'park',
    coordinates: [-0.6637552, 52.2849257],
    score: 84,
    visitorType: 'Woodland country park and ironstone landscape',
    description:
      'Explore 200 acres of woodland paths, former ironstone workings, play areas and family activities, with a cafe and railway museum at the visitor hub.',
    opening:
      'Open daily. Main facilities generally open 09:00-17:00 in spring and autumn, until 19:00 on summer weekends and holidays, and 09:00-16:00 in winter. Closed Christmas Day.',
    admission: 'Free entry. Pay-and-display parking applies.',
    timeToSpend: 'Allow 2-4 hours',
    website: 'https://www.northnorthants.gov.uk/irchester-country-park',
    sourceName: 'Irchester Country Park visitor information',
    sourceOrganisation: 'North Northamptonshire Council',
    reliability: 'official_non_statutory',
    guide: {
      heroImage: art.forest,
      heroAlt: 'Bright ink-and-watercolour illustration of woodland trails and ironstone quarry scenery',
      headline: 'Woodland adventure with an ironstone story beneath the trees',
      intro:
        'Irchester balances an easy family day with a distinctive industrial landscape. Choose a short accessible circuit or follow the longer trail through the old quarries.',
      motifs: ['Woodland trails', 'Ironstone quarry', 'Family play', 'Railway museum'],
      bestFor: ['Family outings', 'Woodland walks', 'Industrial heritage'],
      toilets: 'Public and accessible toilets are provided at the main visitor facilities.',
      picnic: 'Picnic tables and open spaces are provided around the country park.',
      food: [
        {
          name: 'Quarryman\'s Rest Cafe',
          visitorScore: 74,
          summary: 'Hot and cold drinks, snacks and light daytime food beside the visitor hub.',
          priceBand: '£',
          externalUrl: 'https://www.northnorthants.gov.uk/irchester-country-park',
        },
      ],
      trails: [
        { name: 'Easy Access Trail', routeType: 'Accessible woodland circuit', distance: '0.8 km', difficulty: 'Easy', summary: 'A short surfaced route from the visitor centre.', externalUrl: 'https://www.northnorthants.gov.uk/irchester-country-park' },
        { name: 'Woodland Trail', routeType: 'Waymarked woodland walk', distance: '2.25 km', difficulty: 'Easy to moderate', summary: 'A broader loop through the mature woodland.', externalUrl: 'https://www.northnorthants.gov.uk/irchester-country-park' },
        { name: 'Ironstone Heritage Trail', routeType: 'Heritage trail', distance: '3.8 km', difficulty: 'Moderate', summary: 'The best route for reading the former quarry landscape.', externalUrl: 'https://www.northnorthants.gov.uk/irchester-country-park' },
      ],
      thingsToDo: [
        { name: 'Follow the Ironstone Heritage Trail', summary: 'See how extraction reshaped the land now reclaimed by woodland.' },
        { name: 'Visit the railway museum', summary: 'Add locomotives and quarry railway history on an open Sunday.' },
        { name: 'Use the adventure play areas', summary: 'Build a family visit around the park\'s play and activity spaces.' },
        { name: 'Try the zip-wire course', summary: 'Book the aerial adventure separately when operating.' },
      ],
    },
  },
  {
    project: 'wellingborough',
    id: 'standalone-attraction:irchester-narrow-gauge-railway-museum',
    name: 'Irchester Narrow Gauge Railway Museum',
    featureType: 'museum',
    coordinates: [-0.6582579, 52.2808806],
    score: 76,
    visitorType: 'Volunteer-run industrial railway museum',
    description:
      'See locomotives, wagons and quarrying exhibits that explain the narrow-gauge railway network once used by the local ironstone industry.',
    opening: 'Usually open Sundays 10:00-15:00, subject to volunteer availability. Confirm before travelling.',
    admission: 'Free; donations support the museum. Country-park parking is pay and display.',
    timeToSpend: 'Allow 45-75 minutes, plus the country park',
    website: 'https://www.irchesterrailwaymuseum.co.uk/',
    sourceName: 'Irchester Narrow Gauge Railway Museum',
    sourceOrganisation: 'Irchester Narrow Gauge Railway Museum',
    reliability: 'official_non_statutory',
    guide: {
      heroImage: art.family,
      heroAlt: 'Bright editorial watercolour of a small industrial locomotive in a wooded quarry museum',
      headline: 'Small locomotives, big quarry stories and a woodland setting',
      intro:
        'This volunteer museum makes the surrounding quarry landscape easier to understand. The collection is compact, hands-on in spirit and best paired with the park\'s heritage trail.',
      motifs: ['Narrow gauge', 'Ironstone', 'Locomotives', 'Volunteer museum'],
      bestFor: ['Railway enthusiasts', 'Industrial history', 'Family park visits'],
      toilets: 'Use the public toilets at Irchester Country Park visitor facilities.',
      picnic: 'Picnic tables are available in the surrounding country park.',
      food: [{ name: 'Quarryman\'s Rest Cafe', visitorScore: 74, summary: 'Country-park refreshments near the museum.', priceBand: '£', externalUrl: 'https://www.northnorthants.gov.uk/irchester-country-park' }],
      trails: [{ name: 'Ironstone Heritage Trail', routeType: 'Museum and quarry extension', distance: '3.8 km', difficulty: 'Moderate', summary: 'Follow the park route through the landscape served by the old railway.', externalUrl: 'https://www.northnorthants.gov.uk/irchester-country-park' }],
      thingsToDo: [
        { name: 'Inspect the locomotives', summary: 'See the compact engines that worked the ironstone quarries.' },
        { name: 'Explore the quarry exhibits', summary: 'Connect tools, photographs and wagons with the former industry.' },
        { name: 'Talk to the volunteers', summary: 'Use local knowledge to bring the machinery and working lives into focus.' },
        { name: 'Walk the heritage trail', summary: 'Continue outside to see the landscape the railway once served.' },
      ],
    },
  },
  {
    project: 'wellingborough',
    id: 'standalone-attraction:santa-pod-raceway',
    name: 'Santa Pod Raceway',
    featureType: 'other',
    coordinates: [-0.6016397, 52.235693],
    score: 88,
    visitorType: 'Drag-racing venue and major event attraction',
    description:
      'Experience full-throttle drag racing, specialist car shows and major motorsport weekends at Britain\'s best-known quarter-mile strip.',
    opening: 'Event days only. The raceway is closed to visitors outside advertised events; times vary by meeting.',
    admission: 'Paid event tickets. Prices vary and advance booking is strongly recommended.',
    timeToSpend: 'Allow half a day to a full event day',
    website: 'https://santapod.co.uk/',
    sourceName: 'Santa Pod Raceway event information',
    sourceOrganisation: 'Santa Pod Raceway',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'Santa Pod Raceway',
    guide: {
      heroImage: art.family,
      heroAlt: 'Dynamic bright editorial illustration of drag racing at a British motorsport venue',
      headline: 'Britain\'s loudest quarter mile and a calendar packed with specialist events',
      intro:
        'Santa Pod is a planned event day, not a casual drop-in. Pick the meeting carefully: the biggest weekends deliver racing, paddock atmosphere and spectacle on a national scale.',
      motifs: ['Drag racing', 'Motorsport', 'Event weekends', 'Paddock action'],
      bestFor: ['Motorsport fans', 'High-energy days', 'Specialist car events'],
      toilets: 'Standard, accessible and event toilets are provided across the raceway site.',
      picnic: 'Visitors can bring food for event-day use; follow the event rules on containers, barbecues and restricted areas.',
      food: [{ name: 'Santa Pod event food court', visitorScore: 70, summary: 'A changing event-day mix of hot food, snacks and drinks.', priceBand: '££', externalUrl: 'https://santapod.co.uk/' }],
      trails: [{ name: 'Spectator and paddock route', routeType: 'Event-site walking route', difficulty: 'Easy', summary: 'Move between the grandstand, trackside viewing and permitted paddock areas using the event map.', externalUrl: 'https://santapod.co.uk/' }],
      thingsToDo: [
        { name: 'Watch the quarter-mile action', summary: 'Choose a meeting with the race classes or headline vehicles that interest you.' },
        { name: 'Explore the paddock', summary: 'Use permitted access to see teams and machinery more closely.' },
        { name: 'Catch the headline displays', summary: 'Plan around jet cars, demonstrations or event-specific attractions.' },
        { name: 'Stay for the finals', summary: 'Allow enough time for the event to build towards its strongest racing.' },
      ],
    },
  },
  {
    project: 'wellingborough',
    id: 'standalone-attraction:sywell-country-park',
    name: 'Sywell Country Park',
    featureType: 'park',
    coordinates: [-0.789732, 52.283416],
    score: 83,
    visitorType: 'Reservoir country park and waterworks landscape',
    description:
      'Circle a handsome former water-supply reservoir, explore the preserved pump-house setting and use a strong set of family facilities.',
    opening: 'Open daily. Toilets generally open 06:00-20:00; the Pump House Cafe usually opens 09:00-16:00, weather permitting.',
    admission: 'Free entry. Pay-and-display parking applies in two car parks.',
    timeToSpend: 'Allow 90 minutes to 3 hours',
    website: 'https://www.northnorthants.gov.uk/sywell-country-park',
    sourceName: 'Sywell Country Park visitor information',
    sourceOrganisation: 'North Northamptonshire Council',
    reliability: 'official_non_statutory',
    guide: {
      heroImage: art.wetland,
      heroAlt: 'Bright watercolour of a reservoir path, pump house and meadow at Sywell Country Park',
      headline: 'A satisfying reservoir circuit with waterworks character and easy family pauses',
      intro:
        'Sywell is at its best as a complete waterside loop. The old pump-house features and play areas give the outing more shape than a simple country-park walk.',
      motifs: ['Reservoir', 'Waterworks', 'Family play', 'Waterside walk'],
      bestFor: ['Easy walks', 'Families', 'Industrial landscapes'],
      toilets: 'Public and accessible toilets are provided near the main visitor facilities.',
      picnic: 'Picnic tables and grass areas are available around the park.',
      food: [{ name: 'Pump House Cafe', visitorScore: 76, summary: 'Daytime drinks, cakes and light food beside the visitor hub.', openingTimes: 'Usually 09:00-16:00, weather permitting', priceBand: '£', externalUrl: 'https://www.northnorthants.gov.uk/sywell-country-park' }],
      trails: [
        { name: 'Waterworks Heritage Trail', routeType: 'Short heritage trail', distance: '1 km', difficulty: 'Easy', summary: 'A compact introduction to the reservoir\'s working past.', externalUrl: 'https://www.northnorthants.gov.uk/sywell-country-park' },
        { name: 'Reservoir Trail', routeType: 'Waterside circuit', distance: '4 km', difficulty: 'Easy to moderate', summary: 'The fullest walk around the reservoir and park landscape.', externalUrl: 'https://www.northnorthants.gov.uk/sywell-country-park' },
      ],
      thingsToDo: [
        { name: 'Walk the reservoir circuit', summary: 'Use the full loop for changing water, woodland and meadow views.' },
        { name: 'Follow the waterworks story', summary: 'Look for the pump-house buildings and engineering remnants.' },
        { name: 'Use the play landscapes', summary: 'Break up the walk with the park\'s family play areas.' },
        { name: 'Pause at the Pump House Cafe', summary: 'Finish the circuit with a practical coffee-and-cake stop.' },
      ],
    },
  },
  {
    project: 'northampton',
    id: 'standalone-attraction:billing-aquadrome',
    name: 'Billing Aquadrome',
    featureType: 'park',
    coordinates: [-0.8219731, 52.2424022],
    score: 75,
    visitorType: 'Holiday resort and event venue',
    description:
      'A large lakeside holiday and event site whose visitor value depends on the current resort programme, booked stay or advertised public event.',
    opening: 'Access and facilities depend on resort bookings and advertised events. Confirm directly before making a journey.',
    admission: 'Event tickets, holiday bookings or resort access rules may apply; there is no dependable general day-entry offer.',
    timeToSpend: 'Allow the duration of the booked event or resort visit',
    website: 'https://meadowbay.com/billingaquadrome/',
    sourceName: 'Billing Aquadrome resort information',
    sourceOrganisation: 'Meadow Bay Villages',
    reliability: 'official_non_statutory',
    guide: {
      heroImage: art.wetland,
      heroAlt: 'Bright editorial illustration of lakes and holiday facilities at Billing Aquadrome',
      headline: 'A lakeside event and holiday base that needs advance planning',
      intro:
        'Billing is included for its large public events and resort role, not as an always-open country park. Check the current operator programme before treating it as a day attraction.',
      motifs: ['Lakeside setting', 'Holiday resort', 'Public events', 'Family breaks'],
      bestFor: ['Booked breaks', 'Advertised events', 'Lakeside stays'],
      toilets: 'Toilets are available for resort guests and at public events; day-visitor access is not guaranteed.',
      picnic: 'Outdoor seating may be available during stays or events; confirm the current access and food rules.',
      food: [{ name: 'Resort and event catering', visitorScore: 65, summary: 'Food provision varies with the operating season and event programme.', priceBand: '££', externalUrl: 'https://meadowbay.com/billingaquadrome/' }],
      thingsToDo: [
        { name: 'Choose a public event', summary: 'Use the published programme rather than arriving without a booking.' },
        { name: 'Use the lakeside setting', summary: 'Make water and open space part of a booked resort visit.' },
        { name: 'Plan around on-site facilities', summary: 'Check which activities and catering are operating on your date.' },
      ],
    },
  },
  {
    project: 'northampton',
    id: 'standalone-attraction:brixworth-country-park',
    name: 'Brixworth Country Park',
    featureType: 'park',
    coordinates: [-0.8954456, 52.3206829],
    score: 84,
    visitorType: 'Reservoir country park and family outdoor hub',
    description:
      'Start a Pitsford Water walk or cycle ride from a well-equipped country park with short trails, play, cafe and accessible facilities.',
    opening: 'Open all day. The car park opens 06:00-22:00; toilets generally open 07:00-19:00.',
    admission: 'Free entry. Parking ranges from £2 to £8; Blue Badge holders park free.',
    timeToSpend: 'Allow 90 minutes to a full outdoor day',
    website: 'https://www.westnorthants.gov.uk/brixworth-country-park/visiting-brixworth-country-park',
    sourceName: 'Brixworth Country Park visitor information',
    sourceOrganisation: 'West Northamptonshire Council',
    reliability: 'official_non_statutory',
    guide: {
      heroImage: art.wetland,
      heroAlt: 'Bright watercolour of Pitsford Water and the paths at Brixworth Country Park',
      headline: 'Short family trails or a full Pitsford Water adventure from one easy base',
      intro:
        'Brixworth is unusually flexible: stop for a playground-and-cafe outing, choose a short waymarked walk, or set out around the reservoir for a much bigger day.',
      motifs: ['Pitsford Water', 'Cycling', 'Family play', 'Accessible trails'],
      bestFor: ['Flexible outdoor days', 'Families', 'Walkers and cyclists'],
      toilets: 'Toilets include accessible provision, baby changing and a Changing Places facility.',
      picnic: 'Picnic tables and grass areas are available near the visitor hub and around the park.',
      food: [{ name: 'The Willow Tree Cafe', visitorScore: 77, summary: 'Breakfast, lunch, hot drinks and cakes at the country-park hub.', openingTimes: 'Weekdays 09:30-16:00; weekends and holidays 09:00-17:00, with food service generally to 15:00', priceBand: '££', externalUrl: 'https://www.westnorthants.gov.uk/brixworth-country-park/visiting-brixworth-country-park' }],
      trails: [
        { name: 'Kestrel Trail', routeType: 'Short accessible trail', distance: '0.5 miles', duration: 'About 15 minutes', difficulty: 'Easy', summary: 'A quick level circuit near the visitor hub.', externalUrl: 'https://www.westnorthants.gov.uk/brixworth-country-park/walking-and-cycling-brixworth-country-park' },
        { name: 'Lapwing Trail', routeType: 'Short park trail', distance: '0.75 miles', duration: 'About 30 minutes', difficulty: 'Easy', summary: 'A gentle extension through the park landscape.', externalUrl: 'https://www.westnorthants.gov.uk/brixworth-country-park/walking-and-cycling-brixworth-country-park' },
        { name: 'Skylark Trail', routeType: 'Country-park circuit', distance: '1.25 miles', duration: 'Up to 1 hour', difficulty: 'Easy to moderate', summary: 'The strongest compact walk without committing to the reservoir circuit.', externalUrl: 'https://www.westnorthants.gov.uk/brixworth-country-park/walking-and-cycling-brixworth-country-park' },
        { name: 'Pitsford Water circuit', routeType: 'Reservoir circuit', distance: '7.5 miles', duration: '2-4 hours', difficulty: 'Moderate', summary: 'A much fuller walking or cycling day around the water.', externalUrl: 'https://www.westnorthants.gov.uk/brixworth-country-park/walking-and-cycling-brixworth-country-park' },
      ],
      thingsToDo: [
        { name: 'Choose a waymarked trail', summary: 'Match the walk to your available time, from fifteen minutes to an hour.' },
        { name: 'Circle Pitsford Water', summary: 'Take on the longer reservoir route on foot or by bicycle.' },
        { name: 'Use the play area', summary: 'Build an easy family outing around the visitor hub.' },
        { name: 'Watch the water and wildlife', summary: 'Pause at quieter reservoir viewpoints away from the busiest facilities.' },
      ],
    },
  },
  {
    project: 'northampton',
    id: 'standalone-attraction:northampton-and-lamport-railway',
    name: 'Northampton & Lamport Railway',
    featureType: 'museum',
    coordinates: [-0.92938, 52.289895],
    score: 83,
    visitorType: 'Heritage railway',
    description:
      'Ride a volunteer-restored heritage railway through the Brampton Valley and combine steam or diesel travel with a walk on the neighbouring railway path.',
    opening: 'Selected running days, mainly Sundays. Typical public departures run between 10:00 and 15:00; check the dated timetable.',
    admission: 'Standard return: adult £8.50, child or concession £7.50, family £25; special-event fares vary.',
    timeToSpend: 'Allow 2-3 hours',
    website: 'https://nlr.org.uk/whats-on/',
    sourceName: 'Northampton & Lamport Railway running-day information',
    sourceOrganisation: 'Northampton & Lamport Railway',
    reliability: 'official_non_statutory',
    organisation: 'Northampton & Lamport Railway',
    guide: {
      heroImage: art.family,
      heroAlt: 'Bright editorial watercolour of a heritage train in the Brampton Valley',
      headline: 'A friendly heritage railway with a valley walk running alongside',
      intro:
        'The railway offers more than a short train ride: volunteers, restoration activity and the adjacent Brampton Valley Way make it easy to turn a running day into a fuller outing.',
      motifs: ['Heritage trains', 'Volunteer railway', 'Brampton Valley', 'Steam and diesel'],
      bestFor: ['Railway enthusiasts', 'Families', 'Walk-and-ride days'],
      toilets: 'Visitor toilets are provided at the railway, with accessible provision on the main visitor route.',
      picnic: 'Picnic seating is available; confirm event-day restrictions before bringing a larger picnic.',
      food: [{ name: 'Platform buffet', visitorScore: 72, summary: 'Drinks, snacks and light refreshments on operating days.', priceBand: '£', externalUrl: 'https://nlr.org.uk/' }],
      trails: [{ name: 'Brampton Valley Way', routeType: 'Traffic-free railway path', distance: 'Choose a short out-and-back or longer section', difficulty: 'Easy', summary: 'Walk or cycle beside the heritage railway along the former main line.', externalUrl: 'https://www.westnorthants.gov.uk/country-parks-and-open-spaces/brampton-valley-way' }],
      thingsToDo: [
        { name: 'Ride the heritage train', summary: 'Choose a steam, diesel or special-event operating day.' },
        { name: 'Watch the restoration work', summary: 'Look for locomotives, rolling stock and station features being brought back to life.' },
        { name: 'Talk to the volunteers', summary: 'Use the operating team\'s knowledge to deepen the visit.' },
        { name: 'Walk the Brampton Valley Way', summary: 'Add a traffic-free stroll alongside the line.' },
      ],
    },
  },
  {
    project: 'northampton',
    id: 'standalone-attraction:hunsbury-hill-country-park',
    name: 'Hunsbury Hill Country Park',
    featureType: 'archaeological_site',
    coordinates: [-0.9216423, 52.2188282],
    score: 79,
    visitorType: 'Iron Age hillfort and country park',
    description:
      'Walk through 38 hectares of woodland and grassland around a major Iron Age hillfort, with ironstone railway remains and family play nearby.',
    opening: 'Public park open daily; visit in daylight. Temporary access restrictions may apply for maintenance or events.',
    admission: 'Free entry and free general park access.',
    timeToSpend: 'Allow 60-120 minutes',
    website: 'https://www.westnorthants.gov.uk/major-parks/hunsbury-hill-park',
    sourceName: 'Hunsbury Hill Park visitor information',
    sourceOrganisation: 'West Northamptonshire Council',
    reliability: 'official_non_statutory',
    significance: 'national',
    guide: {
      heroImage: art.woodland,
      heroAlt: 'Bright ink-and-watercolour illustration of wooded Iron Age earthworks at Hunsbury Hill',
      headline: 'Ancient ramparts and an ironstone story in a surprisingly wild city-edge park',
      intro:
        'Hunsbury Hill rewards visitors who look beyond the trees. The surviving hillfort earthworks and quarry railway traces turn a pleasant park walk into a layered landscape visit.',
      motifs: ['Iron Age fort', 'Woodland', 'Ironstone railway', 'City-edge escape'],
      bestFor: ['Archaeology walks', 'Local history', 'Short outdoor escapes'],
      toilets: 'Permanent public-toilet provision is not clearly advertised; plan without relying on on-site toilets.',
      picnic: 'Open grass and informal picnic space are available; barbecues and fires are not permitted.',
      trails: [{ name: 'Hillfort and railway walk', routeType: 'Informal heritage circuit', duration: '45-90 minutes', difficulty: 'Easy to moderate', summary: 'Link the hillfort banks, woodland and surviving ironstone railway landscape using the park paths.', externalUrl: 'https://www.westnorthants.gov.uk/major-parks/hunsbury-hill-park' }],
      thingsToDo: [
        { name: 'Trace the hillfort ramparts', summary: 'Look for the banks and ditches of the nationally important Iron Age enclosure.' },
        { name: 'Find the ironstone railway traces', summary: 'Read the later industrial layer in the paths and earthworks.' },
        { name: 'Walk the woodland circuit', summary: 'Use the tree cover for a calm short escape from the city.' },
        { name: 'Add the railway centre when open', summary: 'Check for public access to the volunteer industrial collection.' },
      ],
    },
  },
  {
    project: 'northampton',
    id: 'standalone-attraction:canal-museum-stoke-bruerne',
    name: 'The Canal Museum, Stoke Bruerne',
    featureType: 'museum',
    coordinates: [-0.9141102, 52.1419884],
    score: 84,
    visitorType: 'Canal museum and historic waterside village',
    description:
      'Explore three floors of canal history in a Grade II-listed former corn mill, then step straight onto the Grand Union towpath at Stoke Bruerne.',
    opening: 'Seasonal opening, commonly Wednesday-Sunday 10:00-16:00 from spring. Check the official page before travelling.',
    admission: 'Museum entry is free. Canal & River Trust parking is typically £3 for four hours or £5 all day.',
    timeToSpend: 'Allow 60-90 minutes, plus a towpath walk',
    website: 'https://canalrivertrust.org.uk/things-to-do/museums-and-attractions/the-canal-museum-stoke-bruerne',
    sourceName: 'The Canal Museum visitor information',
    sourceOrganisation: 'Canal & River Trust',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'Canal & River Trust',
    guide: {
      heroImage: art.family,
      heroAlt: 'Bright editorial watercolour of the canal museum, narrowboats and locks at Stoke Bruerne',
      headline: 'Canal stories inside, working locks and towpath life outside',
      intro:
        'The museum is the anchor for one of England\'s strongest canal-village visits. Its displays make more sense once you step outside to watch boats work through the locks.',
      motifs: ['Canal museum', 'Narrowboats', 'Locks', 'Towpath village'],
      bestFor: ['Industrial heritage', 'Waterside walks', 'Family history visits'],
      toilets: 'Visitor toilets are available in or beside the museum visitor facilities.',
      picnic: 'Towpath-side picnic opportunities are available around the village; keep access clear beside locks and moorings.',
      food: [{ name: 'Stoke Bruerne canal-side cafes and pubs', visitorScore: 76, summary: 'Several daytime options sit within the compact canal village.', priceBand: '££', externalUrl: 'https://canalrivertrust.org.uk/things-to-do/museums-and-attractions/the-canal-museum-stoke-bruerne' }],
      trails: [{ name: 'Stoke Bruerne towpath and locks walk', routeType: 'Canal towpath walk', distance: 'Flexible out-and-back', difficulty: 'Easy', summary: 'Follow the lock flight and working canal landscape directly from the museum.', externalUrl: 'https://canalrivertrust.org.uk/things-to-do/museums-and-attractions/the-canal-museum-stoke-bruerne' }],
      thingsToDo: [
        { name: 'Explore the three museum floors', summary: 'Follow boating, trade and working-life stories through the former mill.' },
        { name: 'Watch boats use the locks', summary: 'See the engineering operate in real time immediately outside.' },
        { name: 'Walk the towpath', summary: 'Extend the visit through the lock flight and canal landscape.' },
        { name: 'Explore Stoke Bruerne village', summary: 'Use the compact historic setting for a relaxed waterside pause.' },
      ],
    },
  },
  {
    project: 'northampton',
    id: 'standalone-attraction:castle-ashby-gardens',
    name: 'Castle Ashby Gardens',
    featureType: 'garden',
    coordinates: [-0.7366762, 52.2212871],
    score: 86,
    visitorType: 'Historic gardens, arboretum and menagerie',
    description:
      'Explore 35 acres of formal gardens, glasshouses and arboretum around the Castle Ashby estate, with a small menagerie and strong family appeal.',
    opening: 'Usually Thursday-Monday 10:00-16:00, last entry 15:00. Closed Tuesday-Wednesday except advertised events.',
    admission: 'Paid admission. Current prices vary by visitor type; parking is charged at £1.50 and included with advance tickets.',
    timeToSpend: 'Allow 2-4 hours',
    website: 'https://www.castleashbygardens.co.uk/visitors/',
    sourceName: 'Castle Ashby Gardens visitor information',
    sourceOrganisation: 'Castle Ashby Gardens',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'Castle Ashby Gardens',
    guide: {
      heroImage: art.heritage,
      heroAlt: 'Bright editorial watercolour of formal gardens, glasshouses and parkland at Castle Ashby',
      headline: 'Formal garden rooms, grand glasshouses and a family-friendly arboretum',
      intro:
        'Castle Ashby has enough variety for a proper half day. Move from polished terraces to the long arboretum, then add the menagerie and tearoom without leaving the grounds.',
      motifs: ['Formal gardens', 'Glasshouses', 'Arboretum', 'Menagerie'],
      bestFor: ['Garden lovers', 'Families', 'Leisurely half days'],
      toilets: 'Visitor and accessible toilets are provided near the tearoom and principal facilities.',
      picnic: 'Picnics are welcome in the Italian Garden and arboretum areas.',
      food: [{ name: 'The Orangery Tearoom', visitorScore: 79, summary: 'Lunches, drinks and cakes within the garden visit.', openingTimes: 'Usually 10:30-15:30 on garden open days', priceBand: '££', externalUrl: 'https://www.castleashbygardens.co.uk/visitors/' }],
      trails: [{ name: 'Formal gardens and arboretum circuit', routeType: 'Garden walk', duration: '60-120 minutes', difficulty: 'Easy', summary: 'Link the terraces, Italian Garden, glasshouses and the longer arboretum paths.', externalUrl: 'https://www.castleashbygardens.co.uk/visitors/' }],
      thingsToDo: [
        { name: 'Tour the formal gardens', summary: 'Move through terraces and contrasting garden rooms close to the house.' },
        { name: 'Explore the glasshouses', summary: 'Look for architectural detail and changing seasonal planting.' },
        { name: 'Walk the arboretum', summary: 'Use the looser parkland section for a longer, quieter circuit.' },
        { name: 'Visit the menagerie', summary: 'Add a compact animal stop, especially with children.' },
        { name: 'Pause at the Orangery Tearoom', summary: 'Build lunch or cake into the middle of the visit.' },
      ],
    },
  },
  {
    project: 'northampton',
    id: 'standalone-attraction:stoke-park-pavilions',
    name: 'Stoke Park Pavilions',
    featureType: 'historic_building',
    coordinates: [-0.919501, 52.1334],
    score: 78,
    visitorType: 'Early Palladian pavilions and historic park',
    description:
      'See an exceptionally early Palladian composition associated with Inigo Jones, set within the surviving Stoke Park landscape.',
    opening: 'Public access is limited to advertised open afternoons and pre-arranged visits. The next published open afternoon is 31 August 2026, 14:00-18:00.',
    admission: 'Admission arrangements vary by open day; confirm when booking or before travelling.',
    timeToSpend: 'Allow 60-90 minutes on an open day',
    website: 'https://www.stokeparkpavilions.co.uk/public-viewing',
    sourceName: 'Stoke Park Pavilions public viewing information',
    sourceOrganisation: 'Stoke Park Pavilions',
    reliability: 'official_non_statutory',
    significance: 'national',
    guide: {
      heroImage: art.heritage,
      heroAlt: 'Bright architectural watercolour of the Palladian pavilions in historic parkland',
      headline: 'A rare early-Palladian landmark revealed on carefully timed open days',
      intro:
        'Stoke Park is for architectural visitors prepared to plan ahead. The elegant pavilions and garden setting are highly distinctive, but this is not an everyday drop-in attraction.',
      motifs: ['Palladian design', 'Inigo Jones', 'Historic park', 'Open days'],
      bestFor: ['Architecture enthusiasts', 'Special open days', 'Historic landscapes'],
      toilets: 'No dependable public visitor toilets or catering are advertised for general viewing days.',
      picnic: 'No general public picnic provision is advertised.',
      trails: [{ name: 'Pavilions and historic garden viewing route', routeType: 'Guided or open-day grounds route', duration: '45-75 minutes', difficulty: 'Easy', summary: 'Use the permitted open-day route to understand the paired pavilions and their designed setting.', externalUrl: 'https://www.stokeparkpavilions.co.uk/public-viewing' }],
      thingsToDo: [
        { name: 'Compare the paired pavilions', summary: 'Read the symmetry and differences across the surviving composition.' },
        { name: 'Study the Palladian detail', summary: 'Look closely at the proportions, roofline and classical references.' },
        { name: 'Understand the park setting', summary: 'Use the open-day access to see how the buildings were intended to be viewed.' },
      ],
    },
  },
  {
    project: 'olney',
    id: 'standalone-attraction:emberton-country-park',
    name: 'Emberton Country Park',
    featureType: 'park',
    coordinates: [-0.7087936, 52.1416069],
    score: 83,
    visitorType: 'Lakeside country park',
    description:
      'Spend an easy outdoor day among lakes, riverside paths, play areas and open grass immediately outside Olney.',
    opening: 'Open daily, generally from dawn until dusk. Seasonal gate times and temporary restrictions may apply.',
    admission: 'Pedestrian and cycle entry is free. A vehicle-entry or parking charge applies.',
    timeToSpend: 'Allow 90 minutes to 4 hours',
    website: 'https://www.milton-keynes.gov.uk/environment-parks-and-open-spaces/emberton-country-park',
    sourceName: 'Emberton Country Park visitor information',
    sourceOrganisation: 'Milton Keynes City Council',
    reliability: 'official_non_statutory',
    guide: {
      heroImage: art.wetland,
      heroAlt: 'Bright watercolour of lakes, riverside paths and meadows at Emberton Country Park',
      headline: 'Lakeside loops, broad lawns and an uncomplicated family day outdoors',
      intro:
        'Emberton is a flexible park for walking, play and a long picnic. Its different lakes and the River Great Ouse give even a short circuit plenty of changing scenery.',
      motifs: ['Lakes', 'River Great Ouse', 'Family play', 'Open grass'],
      bestFor: ['Family picnics', 'Easy walking', 'Relaxed outdoor days'],
      toilets: 'Public, accessible and Changing Places toilets are provided at the park facilities.',
      picnic: 'Numerous picnic spaces and tables are available around the park; follow current barbecue rules.',
      food: [{ name: 'Emberton Country Park cafe', visitorScore: 70, summary: 'Seasonal daytime refreshments; confirm current opening before relying on it.', priceBand: '£', externalUrl: 'https://www.milton-keynes.gov.uk/environment-parks-and-open-spaces/emberton-country-park' }],
      trails: [{ name: 'Emberton lakes circuit', routeType: 'Lakeside country-park walk', distance: 'Flexible circuits', duration: '45-120 minutes', difficulty: 'Easy', summary: 'Combine the principal lakes, river edge and meadow paths to suit your available time.', externalUrl: 'https://www.milton-keynes.gov.uk/environment-parks-and-open-spaces/emberton-country-park' }],
      thingsToDo: [
        { name: 'Walk the lakes circuit', summary: 'Link the water, woodland and riverside sections on an easy loop.' },
        { name: 'Use the play areas', summary: 'Build a family visit around several play stops.' },
        { name: 'Picnic beside the water', summary: 'Choose an open view while keeping clear of sensitive banks and wildlife.' },
        { name: 'Watch riverside wildlife', summary: 'Slow down around quieter lake edges and the Great Ouse.' },
      ],
    },
  },
  {
    project: 'olney',
    id: 'standalone-attraction:harrold-odell-country-park',
    name: 'Harrold-Odell Country Park',
    featureType: 'park',
    coordinates: [-0.5963868, 52.2027851],
    score: 82,
    visitorType: 'Lakeside nature reserve and country park',
    description:
      'Walk around two former gravel-pit lakes beside the Great Ouse, using hides, boardwalks, play and a well-placed cafe.',
    opening: 'Open every day. The main car park is open 24 hours; the overflow car park normally closes at 17:00.',
    admission: 'Free entry and free general access.',
    timeToSpend: 'Allow 90 minutes to 3 hours',
    website: 'https://www.bedford.gov.uk/leisure-parks-and-sport/parks-and-open-spaces/parks-bedford-borough/harrold-odell-country-park',
    sourceName: 'Harrold-Odell Country Park visitor information',
    sourceOrganisation: 'Bedford Borough Council',
    reliability: 'official_non_statutory',
    guide: {
      heroImage: art.wetland,
      heroAlt: 'Bright watercolour of lakes, reeds and a boardwalk at Harrold-Odell Country Park',
      headline: 'Two easy lakes, bird hides and a friendly cafe beside the Great Ouse',
      intro:
        'Harrold-Odell is a polished local country park with enough wildlife interest to reward slow walking. The boardwalks and hides make the water feel close throughout the visit.',
      motifs: ['Two lakes', 'Bird hides', 'River Great Ouse', 'Boardwalks'],
      bestFor: ['Birdwatching', 'Easy family walks', 'Coffee-and-walk outings'],
      toilets: 'Public and accessible toilets are provided near the visitor centre and cafe.',
      picnic: 'Picnic tables and open grass are available around the park.',
      food: [{ name: 'Dragonfly Cafe', visitorScore: 78, summary: 'A useful daytime cafe for drinks, cakes and light food beside the park.', priceBand: '££', externalUrl: 'https://www.bedford.gov.uk/leisure-parks-and-sport/parks-and-open-spaces/parks-bedford-borough/harrold-odell-country-park' }],
      trails: [{ name: 'Harrold-Odell lakes circuit', routeType: 'Lakeside nature walk', distance: 'About 2 miles', difficulty: 'Easy', summary: 'A mostly level circuit using the boardwalks, hides and paths around both lakes.', externalUrl: 'https://www.bedford.gov.uk/leisure-parks-and-sport/parks-and-open-spaces/parks-bedford-borough/harrold-odell-country-park' }],
      thingsToDo: [
        { name: 'Circle both lakes', summary: 'Use the full circuit for the park\'s best range of views and habitats.' },
        { name: 'Pause in the bird hides', summary: 'Look across the water for resident and seasonal wildlife.' },
        { name: 'Use the boardwalks', summary: 'Get closer to reeds and wetland habitat without leaving the surfaced route.' },
        { name: 'Stop at the Dragonfly Cafe', summary: 'Make refreshments part of a relaxed half-day visit.' },
      ],
    },
  },
  {
    project: 'olney',
    id: 'standalone-attraction:stevington-windmill',
    name: 'Stevington Windmill',
    featureType: 'windmill',
    coordinates: [-0.5501053, 52.1662509],
    score: 75,
    visitorType: 'Historic post mill exterior',
    description:
      'See Bedfordshire\'s only complete windmill, an eighteenth-century post mill standing prominently in an open rural setting.',
    opening: 'The exterior can be viewed at any reasonable time. The interior is not currently open while restoration work continues.',
    admission: 'Free exterior visit.',
    timeToSpend: 'Allow 20-40 minutes',
    website: 'https://www.bedford.gov.uk/leisure-parks-and-sport/arts-and-culture/history-and-heritage/stevington-windmill',
    sourceName: 'Stevington Windmill visitor information',
    sourceOrganisation: 'Bedford Borough Council',
    reliability: 'official_non_statutory',
    significance: 'national',
    guide: {
      heroImage: art.heritage,
      heroAlt: 'Bright editorial watercolour of a traditional post mill in open Bedfordshire countryside',
      headline: 'Bedfordshire\'s last complete windmill, best seen as a rural landmark',
      intro:
        'Stevington Windmill is a brief but genuine heritage stop. The post mill\'s silhouette and exposed setting are the experience while interior restoration continues.',
      motifs: ['Post mill', 'Eighteenth century', 'Rural landmark', 'Restoration'],
      bestFor: ['Windmill enthusiasts', 'Photography', 'Brief heritage stops'],
      toilets: 'No visitor toilets are provided at the windmill.',
      picnic: 'No formal picnic facilities are provided at the monument.',
      trails: [{ name: 'Stevington village and windmill walk', routeType: 'Rural village extension', duration: '30-60 minutes', difficulty: 'Easy to moderate', summary: 'Use local public paths to combine the mill exterior with the village and surrounding countryside.', externalUrl: 'https://www.bedford.gov.uk/leisure-parks-and-sport/arts-and-culture/history-and-heritage/stevington-windmill' }],
      thingsToDo: [
        { name: 'Study the post-mill structure', summary: 'Look at how the whole body of the mill turns around its central post.' },
        { name: 'Photograph the rural silhouette', summary: 'Use the open setting and changing sky as part of the composition.' },
        { name: 'Check the restoration story', summary: 'Read the council updates before travelling for any special access.' },
      ],
    },
  },
  {
    project: 'miltonKeynes',
    id: 'standalone-attraction:stockgrove-rushmere-country-park',
    name: 'Stockgrove, Rushmere Country Park',
    featureType: 'park',
    coordinates: [-0.6700759, 51.9504804],
    score: 84,
    visitorType: 'Woodland and lakeside country park',
    description:
      'Enter Rushmere Country Park through its quieter Stockgrove side for woodland, heath, a small lake, family trails and a well-used cafe.',
    opening: 'Stockgrove entrance generally opens 08:30-20:00. Cafe and toilet times are shorter and seasonal.',
    admission: 'Free entry. Parking charges apply.',
    timeToSpend: 'Allow 2-4 hours',
    website: 'https://www.greensandtrust.org/about-rushmere',
    sourceName: 'Rushmere Country Park visitor information',
    sourceOrganisation: 'The Greensand Trust',
    reliability: 'official_non_statutory',
    organisation: 'The Greensand Trust',
    guide: {
      heroImage: art.forest,
      heroAlt: 'Bright editorial watercolour of woodland, heath and a small lake at the Stockgrove entrance to Rushmere',
      headline: 'A quieter gateway to Rushmere\'s woodland, lake and long Greensand paths',
      intro:
        'Stockgrove is the softer, more intimate side of Rushmere. Start around the lake, then climb into woodland and heath or link with the main visitor centre for a much longer day.',
      motifs: ['Woodland', 'Small lake', 'Greensand Ridge', 'Family trails'],
      bestFor: ['Woodland walking', 'Families', 'Dog-friendly outdoor days'],
      toilets: 'Public toilets at the Stockgrove visitor facilities generally open during daytime visitor hours.',
      picnic: 'Picnic tables and outdoor seating are available near the lake and visitor facilities.',
      food: [{ name: 'Stockgrove Cafe', visitorScore: 77, summary: 'A popular daytime stop for light food, drinks and cake beside the lake.', openingTimes: 'Generally 09:30-17:00; check seasonal hours', priceBand: '££', externalUrl: 'https://www.greensandtrust.org/about-rushmere' }],
      trails: [
        { name: 'Stockgrove lake circuit', routeType: 'Short lakeside walk', distance: 'About 1 mile', difficulty: 'Easy', summary: 'A compact family route around the water and visitor facilities.', externalUrl: 'https://www.greensandtrust.org/about-rushmere' },
        { name: 'Stockgrove to Rushmere link', routeType: 'Woodland linear route', distance: 'Variable', difficulty: 'Moderate', summary: 'Climb through woodland and heath to connect the two visitor hubs.', externalUrl: 'https://www.greensandtrust.org/about-rushmere' },
      ],
      thingsToDo: [
        { name: 'Circle the Stockgrove lake', summary: 'Begin with the easiest and most atmospheric short route.' },
        { name: 'Explore Oak Wood', summary: 'Use the woodland paths for a quieter extension away from the cafe.' },
        { name: 'Link to Rushmere', summary: 'Turn the visit into a larger walk between the two park entrances.' },
        { name: 'Pause at Stockgrove Cafe', summary: 'Use the lakeside hub for lunch, coffee or cake.' },
      ],
    },
  },
  {
    project: 'miltonKeynes',
    id: 'standalone-attraction:woburn-safari-park',
    name: 'Woburn Safari Park',
    featureType: 'other',
    coordinates: [-0.5898126, 52.001227],
    score: 92,
    visitorType: 'Drive-through and foot safari park',
    description:
      'Combine a drive-through safari with a large foot safari, animal talks and family play for one of the region\'s strongest full-day attractions.',
    opening: 'Open daily in the main season, commonly 10:00-17:00 with last admission at 17:00 and site closure at 18:00. Check dated times.',
    admission: 'Paid dated tickets; prices vary by date and advance online booking is recommended.',
    timeToSpend: 'Allow 4-6 hours',
    website: 'https://www.woburnsafari.co.uk/plan-your-day/',
    sourceName: 'Woburn Safari Park plan-your-day information',
    sourceOrganisation: 'Woburn Safari Park',
    reliability: 'official_non_statutory',
    significance: 'national',
    organisation: 'Woburn Safari Park',
    guide: {
      heroImage: art.family,
      heroAlt: 'Bright editorial illustration of safari animals, parkland and visitor vehicles at Woburn',
      headline: 'A major safari day with the freedom to repeat the road route',
      intro:
        'Woburn is a full-day animal attraction rather than a quick zoo stop. The drive-through creates the headline moments, while the foot safari, talks and play fill out the day.',
      motifs: ['Road safari', 'Foot safari', 'Animal talks', 'Family day'],
      bestFor: ['Full family days', 'Animal encounters', 'First-time safari visits'],
      toilets: 'Standard, accessible and family toilet facilities are provided around the foot-safari area.',
      picnic: 'Picnic areas are available. Follow the current rules on food, litter and restricted animal areas.',
      food: [
        { name: 'Safari Restaurant', visitorScore: 72, summary: 'Main family restaurant within the foot-safari area.', priceBand: '££', externalUrl: 'https://www.woburnsafari.co.uk/plan-your-day/' },
        { name: 'Safari Park kiosks', visitorScore: 68, summary: 'Seasonal drinks, snacks and takeaway food around the visitor areas.', priceBand: '£', externalUrl: 'https://www.woburnsafari.co.uk/plan-your-day/' },
      ],
      trails: [
        { name: 'Road Safari', routeType: 'Drive-through animal route', duration: '60-90 minutes per circuit', difficulty: 'Drive', summary: 'Follow the one-way safari route through the principal large-animal reserves; repeat visits are normally possible.', externalUrl: 'https://www.woburnsafari.co.uk/plan-your-day/' },
        { name: 'Foot Safari', routeType: 'Walking visitor route', duration: '2-4 hours', difficulty: 'Easy', summary: 'Link the smaller-animal habitats, talks, demonstrations and family facilities on foot.', externalUrl: 'https://www.woburnsafari.co.uk/plan-your-day/' },
      ],
      thingsToDo: [
        { name: 'Drive the Road Safari', summary: 'Take time through the large-animal reserves and consider a second circuit.' },
        { name: 'Explore the Foot Safari', summary: 'See smaller species and habitats not covered by the driving route.' },
        { name: 'Plan around animal talks', summary: 'Use the daily schedule to add keeper insight and demonstrations.' },
        { name: 'Use the family play areas', summary: 'Give younger visitors a change of pace between animal zones.' },
        { name: 'Repeat the strongest safari section', summary: 'Return to the road route later when animal activity may have changed.' },
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
      'Current visitor attraction reviewed from the linked official or responsible visitor source on 2026-08-09. It is explicitly curated for Home regional discovery only and does not enter the host town planner or town rating.',
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
  const ids = new Set(
    attractions.filter((definition) => definition.project === key).map((definition) => definition.id),
  );
  pkg.features = pkg.features.filter(
    (feature) => !feature.tags.includes(auditTag) && !ids.has(feature.id),
  );
  const projectAttractions = attractions.filter((definition) => definition.project === key);
  pkg.features.push(...projectAttractions.map((definition) => featureFor(pkg, definition)));
  const note =
    'Bedfordshire and Northamptonshire standalone attraction audit added 2026-08-09. These are explicit Home-only regional destinations and do not alter the host town planner or tourist rating.';
  pkg.project.researchNotes = pkg.project.researchNotes?.includes(note)
    ? pkg.project.researchNotes
    : `${pkg.project.researchNotes ? `${pkg.project.researchNotes.trim()} ` : ''}${note}`;
  await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  writtenProjects[pkg.project.id] = projectAttractions.map((definition) => definition.id);
}

const audit = {
  schemaVersion: 1,
  reviewedAt,
  requestCount: 19,
  addedCount: attractions.length,
  deferred: [
    {
      requestedName: 'Buckingham Thick Copse',
      reason:
        'Not published as a normal attraction: access is permit-controlled private woodland rather than dependable public visitor access.',
      sourceUrl: 'https://nationalcharacterareas.co.uk/yardley-whittlewood-ridge/description/',
    },
    {
      requestedName: 'Woburn Abbey',
      reason:
        'Not published on Home while the Abbey and gardens remain closed for major refurbishment; review when a reopening date is announced.',
      sourceUrl: 'https://www.woburnabbey.co.uk/',
    },
  ],
  corrections: {
    'Chichelle college': 'Chichele College',
    'Narrow guage railway museum': 'Irchester Narrow Gauge Railway Museum',
    'Billing Aquadrome': 'Billing Aquadrome',
    'Northampton and lamport railway': 'Northampton & Lamport Railway',
    'Hunsbury hill': 'Hunsbury Hill Country Park',
    'Canal museum (Northamptonshire)': 'The Canal Museum, Stoke Bruerne',
    'Harrold Odell Country Park': 'Harrold-Odell Country Park',
    'Stoke Park Pavillions': 'Stoke Park Pavilions',
    'Stockgrove Park': 'Stockgrove, Rushmere Country Park',
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
    'Every published record is explicitly tagged home-standalone-place and excluded from town planner and town rating logic.',
    'Standalone records are current visitor context and never contribute to historic heat-map dating.',
    'Places without dependable public access or a current visitor offer are recorded as deferred rather than shown as normal attractions.',
    'Opening, admission, events and seasonal access should be checked against the linked operator source before a special journey.',
  ],
};

await writeFile(
  resolve('data/review/bedfordshire-northamptonshire-standalone-attractions-2026-08-09.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
);

console.log(
  `Added ${attractions.length} standalone attractions across ${Object.keys(writtenProjects).length} project packages.`,
);
