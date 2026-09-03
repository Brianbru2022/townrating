import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  AttractionGuide,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
} from '../src/domain/models';

const reviewedAt = '2026-08-08T00:00:00Z';
const auditTag = 'peterborough-region-standalone-audit-2026-08-08';
const editorialLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

type ProjectKey = 'peterborough' | 'oundle' | 'thrapston' | 'sawtry';

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
  peterborough: 'data/projects/peterborough.json',
  oundle: 'data/projects/oundle.json',
  thrapston: 'data/projects/thrapston.json',
  sawtry: 'data/projects/sawtry.json',
};

const art = {
  limestone: '/attraction-guides/limestone-wildflower-reserve-watercolour.png',
  woodland: '/attraction-guides/ancient-woodland-reserve-watercolour.png',
  countryPark: '/attraction-guides/country-park-wetland-watercolour.png',
  barnwell: '/attraction-guides/barnwell-country-park-watercolour.png',
  crownLakes: '/attraction-guides/crown-lakes-country-park-watercolour.png',
  stanwick: '/attraction-guides/stanwick-lakes-country-park-watercolour.png',
  holmeFen: '/attraction-guides/holme-fen-watercolour.png',
  historic: '/attraction-guides/historic-estates-watercolour.png',
  lyveden: '/attraction-guides/lyveden-new-bield-watercolour.png',
  southwick: '/attraction-guides/southwick-hall-watercolour.png',
  fotheringhay: '/attraction-guides/fotheringhay-castle-site-watercolour.png',
  family: '/attraction-guides/family-country-attraction-watercolour.png',
  hamerton: '/attraction-guides/hamerton-zoo-park-watercolour.png',
  hinchingbrooke: '/attraction-guides/hinchingbrooke-country-park-watercolour.png',
  monksWood: '/attraction-guides/monks-wood-watercolour.png',
  upwood: '/attraction-guides/upwood-meadows-watercolour.png',
  woodwalton: '/attraction-guides/woodwalton-fen-watercolour.png',
  sacrewell: '/attraction-guides/sacrewell-farm-watercolour.png',
  castor: '/attraction-guides/castor-hanglands-watercolour.png',
  forest: '/attraction-guides/forest-country-park-watercolour.png',
};

const attractions: AttractionDefinition[] = [
  {
    project: 'peterborough',
    id: 'standalone-attraction:barnack-hills-and-holes',
    name: 'Barnack Hills and Holes',
    featureType: 'archaeological_site',
    coordinates: [-0.4132, 52.6276],
    score: 82,
    visitorType: 'Wildflower-rich limestone nature reserve',
    description:
      'Wander through an extraordinary hummocky landscape left by medieval limestone quarrying, now celebrated for rare limestone grassland and orchids.',
    opening: 'Open access throughout the year. Visit in daylight and follow seasonal reserve notices.',
    admission: 'Free. A voluntary RingGo parking donation may apply at the main car park.',
    timeToSpend: 'Allow 60-120 minutes',
    website:
      'https://www.gov.uk/government/publications/cambridgeshires-national-nature-reserves/cambridgeshires-national-nature-reserves',
    sourceName: 'Cambridgeshire national nature reserves',
    sourceOrganisation: 'Natural England',
    reliability: 'official_non_statutory',
    significance: 'national',
    guide: {
      heroImage: art.limestone,
      heroAlt:
        'Light ink-and-watercolour illustration of flower-rich limestone hollows and grassland paths',
      headline: 'Orchids, limestone hollows and a landscape shaped by medieval quarrying',
      intro:
        'Barnack is small enough for an easy wander but botanically exceptional. Its ridges and hollows make the walk distinctive even outside peak orchid season.',
      motifs: ['Wildflowers', 'Medieval quarry', 'Limestone grassland', 'Nature walk'],
      bestFor: ['Spring and summer flowers', 'Quiet nature walks', 'Unusual landscapes'],
      toilets: 'No public toilets are confirmed within the reserve.',
      picnic: 'No formal picnic area is confirmed. Use the reserve sensitively and take litter home.',
      thingsToDo: [
        { name: 'Follow the quarry ridges and hollows', summary: 'Read the medieval stone workings in the reserve\'s unusual relief.' },
        { name: 'Look for pasqueflowers and orchids', summary: 'Seasonal flowers are the reserve\'s greatest natural spectacle.' },
        { name: 'Explore the limestone grassland', summary: 'Notice how thin soils support a specialist plant community.' },
        { name: 'Pause at the wider viewpoints', summary: 'The higher ridges open views across the surrounding farmland.' },
      ],
    },
  },
  {
    project: 'oundle',
    id: 'standalone-attraction:bedford-purlieus',
    name: 'Bedford Purlieus',
    featureType: 'park',
    coordinates: [-0.4663596, 52.5846146],
    score: 78,
    visitorType: 'Ancient woodland national nature reserve',
    description:
      'Explore one of lowland England\'s richest ancient woods, with a long history, varied rides and a notably diverse ground flora.',
    opening: 'Open access. Visit in daylight and follow Forestry England and reserve notices.',
    admission: 'Free',
    timeToSpend: 'Allow 75-150 minutes',
    website:
      'https://www.gov.uk/government/publications/cambridgeshires-national-nature-reserves/cambridgeshires-national-nature-reserves',
    sourceName: 'Cambridgeshire national nature reserves',
    sourceOrganisation: 'Natural England',
    reliability: 'official_non_statutory',
    significance: 'national',
    guide: {
      heroImage: art.woodland,
      heroAlt: 'Light ink-and-watercolour illustration of an ancient woodland ride in spring',
      headline: 'A deep ancient-woodland walk rich in flowers, insects and layered history',
      intro:
        'Bedford Purlieus rewards an unhurried walk along its rides. It feels much wilder than its lowland setting suggests and is particularly rewarding in spring.',
      motifs: ['Ancient woodland', 'Spring flowers', 'Wildlife', 'Forest paths'],
      bestFor: ['Woodland walkers', 'Spring colour', 'Natural-history enthusiasts'],
      toilets: 'No public toilets are confirmed within the reserve.',
      picnic: 'No formal picnic area is confirmed within the reserve.',
      thingsToDo: [
        { name: 'Walk the main woodland rides', summary: 'Use the established paths to sample the reserve without disturbing sensitive habitat.' },
        { name: 'Look for ancient-woodland plants', summary: 'Spring flowers are one of the strongest reasons to visit.' },
        { name: 'Watch for butterflies and insects', summary: 'Sunny rides and varied vegetation support a rich invertebrate life.' },
        { name: 'Notice the woodland structure', summary: 'Old coppice, mature trees and open rides reveal generations of management.' },
      ],
    },
  },
  {
    project: 'peterborough',
    id: 'standalone-attraction:sacrewell-farm',
    name: 'Sacrewell Farm and Country Centre',
    featureType: 'other',
    coordinates: [-0.4058058, 52.5893052],
    score: 86,
    visitorType: 'Family farm and country centre',
    description:
      'Make a family day of farm animals, outdoor play, the indoor Playbarn and the restored 18th-century watermill in an attractive rural setting.',
    opening: 'Daily 09:00-16:30 except Christmas Day, Boxing Day and New Year\'s Day. Advance booking is recommended.',
    admission: 'Paid admission. Current dated tickets should be checked and booked online.',
    timeToSpend: 'Allow 3-5 hours',
    website: 'https://www.sacrewell.org.uk/visit/times-and-prices/',
    sourceName: 'Sacrewell times and prices',
    sourceOrganisation: 'Sacrewell Farm and Country Centre',
    reliability: 'official_non_statutory',
    organisation: 'Sacrewell',
    guide: {
      heroImage: art.sacrewell,
      heroAlt:
        'Light ink-and-watercolour illustration of Sacrewell farmhouse, its spring garden and picnic lawn',
      headline: 'Farm animals, energetic play and a beautifully restored watermill',
      intro:
        'Sacrewell is the strongest all-weather family attraction in the immediate Peterborough countryside, with enough variety for a substantial half day.',
      motifs: ['Farm animals', 'Watermill', 'Family play', 'Country walks'],
      bestFor: ['Families with younger children', 'All-weather visits', 'Easy country days'],
      toilets: 'Toilets, accessible toilets and baby-changing facilities are provided across the site.',
      picnic: 'Outdoor picnic space is available. Follow current site guidance on where outside food may be eaten.',
      food: [
        {
          name: 'The Farmhouse Table',
          visitorScore: 82,
          summary: 'Farm cafe for breakfast, lunch, coffee and cake, accessible without a farm ticket.',
          openingTimes: 'Daily 09:00-16:15',
          priceBand: '££',
          externalUrl: 'https://www.sacrewell.org.uk/the-farmhouse-table/',
        },
      ],
      trails: [
        {
          name: 'Wildlife & Nature Walk',
          routeType: 'On-site nature walk',
          summary:
            'Follow the marked visitor footpath through the quieter countryside side of the farm visit.',
          externalUrl:
            'https://www.sacrewell.org.uk/site/wp-content/uploads/2019/08/Scarewell-Farm-Map-Signage_150cmx200cm_PR3.pdf',
        },
      ],
      thingsToDo: [
        { name: 'Meet the farm animals', summary: 'See the changing mix of cattle, sheep, pigs, goats, poultry and small animals.' },
        { name: 'Explore the 18th-century watermill', summary: 'Discover Sacrewell\'s strongest heritage feature and its restored machinery.' },
        { name: 'Use the indoor Playbarn', summary: 'A major wet-weather option with active play for children.' },
        { name: 'Try the outdoor play areas', summary: 'Combine traditional play with the wider farm setting.' },
        { name: 'Take a tractor ride', summary: 'A small extra-charge ride gives the visit a classic farm-day-out moment.' },
      ],
    },
  },
  {
    project: 'peterborough',
    id: 'standalone-attraction:castor-hanglands',
    name: 'Castor Hanglands',
    featureType: 'park',
    coordinates: [-0.3451402, 52.6006328],
    score: 77,
    visitorType: 'Woodland and limestone-grassland nature reserve',
    description:
      'Follow public routes through an unusually varied reserve where ancient woodland, limestone grassland, scrub and wetland sit close together.',
    opening: 'Open access. Visit in daylight and use signed public routes.',
    admission: 'Free',
    timeToSpend: 'Allow 60-120 minutes',
    website:
      'https://www.gov.uk/government/publications/cambridgeshires-national-nature-reserves/cambridgeshires-national-nature-reserves',
    sourceName: 'Cambridgeshire national nature reserves',
    sourceOrganisation: 'Natural England',
    reliability: 'official_non_statutory',
    significance: 'national',
    guide: {
      heroImage: art.castor,
      heroAlt:
        'Light ink-and-watercolour illustration of the grass path between Castor Hanglands meadow and woodland',
      headline: 'Ancient woodland and flower-rich grassland in one compact reserve',
      intro:
        'Castor Hanglands is a specialist nature stop rather than a formal country park. Its appeal lies in moving quickly between contrasting habitats.',
      motifs: ['Ancient woodland', 'Grassland', 'Wildlife', 'Quiet paths'],
      bestFor: ['Natural-history walks', 'Wildflowers', 'Peaceful detours'],
      toilets: 'No public toilets are confirmed within the reserve.',
      picnic: 'No formal picnic area is confirmed within the reserve.',
      trails: [
        {
          name: "John Clare's footsteps through Castor Hanglands",
          routeType: 'Heritage and nature route',
          summary:
            'A locally published route connecting the reserve landscape with poet John Clare and Castor.',
          externalUrl: 'https://castor-pc.gov.uk/documents/jcap-agree-february-2026/',
        },
      ],
      thingsToDo: [
        { name: 'Walk between woodland and grassland', summary: 'The rapid change of habitat is the reserve\'s defining experience.' },
        { name: 'Look for seasonal wildflowers', summary: 'Limestone grassland supports a specialist range of plants.' },
        { name: 'Watch the woodland edges', summary: 'Rides and scrub margins are productive places for birds and insects.' },
      ],
    },
  },
  {
    project: 'peterborough',
    id: 'standalone-attraction:crown-lakes-country-park',
    name: 'Crown Lakes Country Park',
    featureType: 'park',
    coordinates: [-0.239055, 52.5339755],
    score: 75,
    visitorType: 'Lakeside country park',
    description:
      'Use easy paths around lakes, woodland and open grassland for an uncomplicated local walk, cycle or family picnic south of Peterborough.',
    opening: 'Open access. Daylight visits are recommended.',
    admission: 'Free',
    timeToSpend: 'Allow 45-120 minutes',
    website: 'https://haypeterborough.co.uk/activities/crown-lakes-country-park/',
    sourceName: 'Crown Lakes Country Park activity guide',
    sourceOrganisation: 'Healthy Active Youth Peterborough',
    reliability: 'secondary',
    guide: {
      heroImage: art.crownLakes,
      heroAlt: 'Ink-and-watercolour illustration of the curved shore and wooded lake at Crown Lakes Country Park',
      headline: 'An easy lakeside breathing space for walks, cycles and picnics',
      intro:
        'Crown Lakes is a useful uncomplicated outdoor stop. It is more local country park than major attraction, but works well when a relaxed walk is exactly what is wanted.',
      motifs: ['Lakes', 'Easy paths', 'Cycling', 'Picnic stop'],
      bestFor: ['Short outdoor breaks', 'Family walks', 'Dog walks'],
      toilets: 'No reliable public-toilet provision is confirmed within the park.',
      picnic: 'Benches and informal picnic opportunities are available around the park.',
      trails: [
        {
          name: 'Crown Lakes walk',
          routeType: 'Self-guided circular',
          duration: 'About 60 minutes',
          difficulty: 'Moderate',
          summary:
            'A council-published circuit through the lakes, woodland and open grassland.',
          externalUrl:
            'https://www.huntingdonshire.gov.uk/media/1410/self-guided-walks-yaxley.pdf',
        },
      ],
      thingsToDo: [
        { name: 'Circuit the lakes', summary: 'Choose a short loop or extend through the wider park paths.' },
        { name: 'Walk through the woodland', summary: 'Tree-lined sections add variety to the open lakeside paths.' },
        { name: 'Pause for a picnic', summary: 'Use the available seating or a suitable open-grass location.' },
      ],
    },
  },
  {
    project: 'oundle',
    id: 'standalone-attraction:elton-hall',
    name: 'Elton Hall',
    featureType: 'country_house',
    coordinates: [-0.3976797, 52.5235714],
    score: 85,
    visitorType: 'Historic house and gardens',
    description:
      'Step into a richly layered family home whose architecture spans centuries, then explore formal gardens framed by the house and surrounding parkland.',
    opening: '2026 public season runs on selected days from 24 May to 31 August, generally 14:00-17:00. Check the calendar before travel.',
    admission: 'Hall and garden £18. Garden only £10. Under-16s free.',
    timeToSpend: 'Allow 90-150 minutes',
    website: 'https://eltonhall.com/visitor-info/',
    sourceName: 'Elton Hall visitor information',
    sourceOrganisation: 'Elton Hall',
    reliability: 'official_non_statutory',
    significance: 'national',
    guide: {
      heroImage: art.historic,
      heroAlt: 'Light ink-and-watercolour illustration of a historic English country house and garden',
      headline: 'A deeply atmospheric family house with centuries of architecture and art',
      intro:
        'Elton Hall feels personal rather than institutional. Limited seasonal opening makes it one to plan carefully, but the combination of house and garden merits the effort.',
      motifs: ['Historic interiors', 'Family collections', 'Formal gardens', 'Country estate'],
      bestFor: ['Historic-house enthusiasts', 'Garden visits', 'Planned summer afternoons'],
      toilets: 'Visitor and accessible toilets are available at the hall and garden centre during opening.',
      picnic: 'No dedicated visitor picnic provision is confirmed within the ticketed house and garden visit.',
      thingsToDo: [
        { name: 'Tour the historic interiors', summary: 'See rooms shaped by successive generations and architectural periods.' },
        { name: 'Explore the art and collections', summary: 'The family collections are a central part of the house experience.' },
        { name: 'Walk the formal garden', summary: 'Use the structured garden rooms to frame views back to the house.' },
        { name: 'Study the changing architecture', summary: 'Look for medieval, Tudor and later work within the same building.' },
      ],
    },
  },
  {
    project: 'oundle',
    id: 'standalone-attraction:fotheringhay-castle-site',
    name: 'Fotheringhay Castle Site',
    featureType: 'castle',
    coordinates: [-0.4354056, 52.5241992],
    score: 78,
    visitorType: 'Medieval castle earthworks and royal history site',
    description:
      'Stand on the earthworks of a vanished royal castle associated with Richard III and the imprisonment and execution of Mary, Queen of Scots.',
    opening: 'Open outdoor site. Visit in daylight and follow local access signs.',
    admission: 'Free',
    timeToSpend: 'Allow 30-60 minutes',
    website: 'https://visitnorthamptonshire.co.uk/out-and-about/fotheringhay-castle',
    sourceName: 'Fotheringhay Castle visitor guide',
    sourceOrganisation: 'Visit Northamptonshire',
    reliability: 'secondary',
    significance: 'national',
    guide: {
      heroImage: art.fotheringhay,
      heroAlt: 'Ink-and-watercolour illustration of Fotheringhay Castle earthworks beside the River Nene and stone bridge',
      headline: 'A quiet mound carrying the memory of kings, queens and a vanished castle',
      intro:
        'Little masonry survives, so this is a place for historical imagination. The compact site becomes much more rewarding when combined with Fotheringhay church and village.',
      motifs: ['Richard III', 'Mary Queen of Scots', 'Castle earthworks', 'Village history'],
      bestFor: ['Royal-history enthusiasts', 'Atmospheric short stops', 'Village walks'],
      toilets: 'No public toilets are confirmed at the castle site.',
      picnic: 'No formal picnic provision is confirmed at the castle site.',
      trails: [
        {
          name: 'Fotheringhay to Woodnewton walk',
          routeType: 'Circular village and riverside walk',
          distance: '3.4 miles / 5.5 km',
          duration: 'About 90 minutes',
          difficulty: 'Moderate',
          summary:
            'Extend the castle visit into a countryside circuit linking Fotheringhay and Woodnewton.',
          externalUrl:
            'https://discover-northamptonshire.co.uk/wp-content/uploads/2025/07/Fotheringhay-Woodnewton-White.pdf',
        },
      ],
      thingsToDo: [
        { name: 'Climb the castle mound', summary: 'Use the elevated earthwork to understand the vanished stronghold\'s position.' },
        { name: 'Find the memorial stone', summary: 'Pause at the principal marker commemorating the castle and Mary, Queen of Scots.' },
        { name: 'Trace the surviving earthworks', summary: 'Look for the remaining shape of the motte and bailey landscape.' },
        { name: 'Combine it with Fotheringhay church', summary: 'The nearby church adds important Yorkist and royal context.' },
      ],
    },
  },
  {
    project: 'oundle',
    id: 'standalone-attraction:southwick-hall',
    name: 'Southwick Hall',
    featureType: 'manor_house',
    coordinates: [-0.4959583, 52.5176384],
    score: 76,
    visitorType: 'Historic manor house',
    description:
      'Visit a lived-in manor whose rooms and collections retain the intimate character of a private family house rather than a large formal attraction.',
    opening: 'Selected public open days and pre-booked visits only. Check the current programme before travelling.',
    admission: 'Paid admission. Current prices are shown with the selected open date or booking.',
    timeToSpend: 'Allow 75-120 minutes',
    website: 'https://www.southwickhall.co.uk/visit/',
    sourceName: 'Southwick Hall visitor information',
    sourceOrganisation: 'Southwick Hall',
    reliability: 'official_non_statutory',
    significance: 'regional',
    guide: {
      heroImage: art.southwick,
      heroAlt: 'Ink-and-watercolour illustration of Southwick Hall with its stone frontage and spring daffodils',
      headline: 'An intimate private manor with family collections and a long-lived atmosphere',
      intro:
        'Southwick Hall is a niche but rewarding pre-planned visit. Its limited opening and domestic scale are part of the appeal rather than inconveniences to overlook.',
      motifs: ['Private manor', 'Family collections', 'Historic rooms', 'Selected open days'],
      bestFor: ['Historic-interior enthusiasts', 'Quiet planned visits', 'Small-scale country houses'],
      toilets: 'Visitor toilets are available on public open days.',
      picnic: 'Visitors may picnic in the grounds on public open days where directed.',
      thingsToDo: [
        { name: 'Tour the lived-in interiors', summary: 'Experience rooms that retain the feel of a private family home.' },
        { name: 'Explore the family collections', summary: 'Objects and pictures give the visit much of its personal character.' },
        { name: 'Walk the immediate grounds', summary: 'Use the outdoor setting to understand the hall\'s scale and seclusion.' },
      ],
    },
  },
  {
    project: 'oundle',
    id: 'standalone-attraction:lyveden-new-bield',
    name: 'Lyveden New Bield',
    featureType: 'country_house',
    coordinates: [-0.5532484, 52.4569094],
    score: 89,
    visitorType: 'Elizabethan lodge and symbolic garden',
    description:
      'Explore an unfinished Elizabethan garden lodge, moated orchard and symbolic landscape whose incompleteness makes it one of the region\'s most haunting historic places.',
    opening: 'Normally 10:00-17:00. Check the National Trust page for seasonal changes and last entry.',
    admission: 'Adult £12 without Gift Aid. National Trust members free. Other ticket prices vary.',
    timeToSpend: 'Allow 2-3 hours',
    website: 'https://www.nationaltrust.org.uk/visit/leicestershire-northamptonshire/lyveden',
    sourceName: 'Lyveden visitor information',
    sourceOrganisation: 'National Trust',
    reliability: 'official_non_statutory',
    significance: 'highest_national',
    organisation: 'NTS',
    guide: {
      heroImage: art.lyveden,
      heroAlt: 'Ink-and-watercolour illustration of the roofless Lyveden New Bield reflected in its surrounding water',
      headline: 'An unfinished Elizabethan dream set within a remarkable symbolic landscape',
      intro:
        'Lyveden is far more than a ruined building. The lodge, terraces, orchard, moat and religious symbolism create a slow, contemplative historic landscape.',
      motifs: ['Elizabethan lodge', 'Symbolic garden', 'Moat and orchard', 'National Trust'],
      bestFor: ['Architecture and garden lovers', 'Atmospheric walks', 'Slow heritage visits'],
      toilets: 'Visitor toilets and an accessible toilet are available near the manor and cafe.',
      picnic: 'Picnics are welcome in suitable areas of the grounds. Follow current property guidance.',
      food: [
        {
          name: 'Lyveden Cafe',
          visitorScore: 83,
          summary: 'National Trust cafe for drinks, cakes and light daytime food near the visitor facilities.',
          openingTimes: 'Usually 10:00-16:30',
          priceBand: '££',
          externalUrl: 'https://www.nationaltrust.org.uk/visit/leicestershire-northamptonshire/lyveden',
        },
      ],
      trails: [
        {
          name: 'Lyveden Way',
          routeType: 'Circular countryside walk',
          distance: 'About 10 miles / 16 km',
          duration: 'Allow most of a day',
          difficulty: 'Strenuous',
          summary:
            'A substantial circular route from Fermyn Woods through the Northamptonshire countryside to Lyveden.',
          externalUrl:
            'https://www.nationaltrust.org.uk/visit/leicestershire-northamptonshire/lyveden/exploring-the-grounds-at-lyveden',
        },
      ],
      thingsToDo: [
        { name: 'Circle the New Bield', summary: 'Study the unfinished lodge from every side and look for its symbolic geometry.' },
        { name: 'Walk the garden terraces', summary: 'Trace the surviving structure of Sir Thomas Tresham\'s designed landscape.' },
        { name: 'Explore the moat and orchard', summary: 'These restored elements help the original garden plan make sense.' },
        { name: 'Visit Lyveden Manor', summary: 'Use the visitor facilities and interpretation in the older house.' },
        { name: 'Follow a wider estate walk', summary: 'Extend the visit through the surrounding rural landscape.' },
      ],
    },
  },
  {
    project: 'thrapston',
    id: 'standalone-attraction:fermyn-woods-country-park',
    name: 'Fermyn Woods Country Park',
    featureType: 'park',
    coordinates: [-0.5961148, 52.4552053],
    score: 83,
    visitorType: 'Forest country park',
    description:
      'Choose from easy woodland routes, family play and wildlife-rich forest edges, with a visitor centre and cafe making this an unusually convenient forest day out.',
    opening: 'Country park open dawn to dusk. Visitor-centre and cafe hours vary seasonally.',
    admission: 'Free entry. Parking charges apply.',
    timeToSpend: 'Allow 90 minutes to 4 hours',
    website: 'https://www.forestryengland.uk/fermyn-woods',
    sourceName: 'Fermyn Woods visitor information',
    sourceOrganisation: 'Forestry England',
    reliability: 'official_non_statutory',
    guide: {
      heroImage: art.forest,
      heroAlt: 'Light ink-and-watercolour illustration of a broad woodland trail and forest visitor area',
      headline: 'Family-friendly forest trails with wildlife, play and useful visitor facilities',
      intro:
        'Fermyn Woods makes woodland easy to enjoy. It works for a short cafe-and-trail stop, but has enough routes and family facilities for a much longer visit.',
      motifs: ['Forest trails', 'Wildlife', 'Family play', 'Cafe stop'],
      bestFor: ['Family woodland days', 'Easy walks', 'Dog-friendly outings'],
      toilets: 'Public and accessible toilets are available daily at the visitor facilities.',
      picnic: 'Picnic areas are provided around the country park.',
      food: [
        {
          name: 'Skylark Cafe',
          visitorScore: 79,
          summary: 'Convenient country-park cafe for lunch, drinks and cake beside the visitor facilities.',
          openingTimes: 'Generally 10:00-16:30 April-September and 10:00-15:30 October-March',
          priceBand: '££',
          externalUrl: 'https://www.northnorthants.gov.uk/fermyn-woods-country-park',
        },
      ],
      trails: [
        {
          name: 'Red route',
          routeType: 'Hard-standing park loop',
          distance: '0.8 km',
          difficulty: 'Easy',
          summary: 'The shortest firm-surfaced circuit around the country park.',
          externalUrl: 'https://www.northnorthants.gov.uk/fermyn-woods-country-park',
        },
        {
          name: 'Purple route',
          routeType: 'Hard-standing woodland route',
          distance: '1.7 km',
          difficulty: 'Easy',
          summary: 'A longer surfaced route passing through the woods.',
          externalUrl: 'https://www.northnorthants.gov.uk/fermyn-woods-country-park',
        },
        {
          name: 'Orange route',
          routeType: 'Woodland perimeter route',
          distance: '3.5 km',
          difficulty: 'Moderate',
          summary: 'A mixed hard-standing and grass route around the woodland perimeter.',
          externalUrl: 'https://www.northnorthants.gov.uk/fermyn-woods-country-park',
        },
        {
          name: 'Lyveden Way',
          routeType: 'Circular countryside walk',
          distance: 'About 10 miles / 16 km',
          duration: 'Allow most of a day',
          difficulty: 'Strenuous',
          summary: 'A full-day circuit from Fermyn Woods to Lyveden and back.',
          externalUrl:
            'https://www.nationaltrust.org.uk/visit/leicestershire-northamptonshire/lyveden/exploring-the-grounds-at-lyveden',
        },
      ],
      thingsToDo: [
        { name: 'Follow the Woodland Walk', summary: 'An approachable route through the park\'s core woodland.' },
        { name: 'Try the longer forest route', summary: 'Extend beyond the visitor-centre area for a quieter walk.' },
        { name: 'Look for woodland wildlife', summary: 'Butterflies, birds and forest-edge habitats reward patient visitors.' },
        { name: 'Use the children\'s play area', summary: 'Add active family time before or after the trails.' },
        { name: 'Pause at the visitor centre', summary: 'Use the cafe and information to shape a relaxed visit.' },
      ],
    },
  },
  {
    project: 'oundle',
    id: 'standalone-attraction:barnwell-country-park',
    name: 'Barnwell Country Park',
    featureType: 'park',
    coordinates: [-0.4774046, 52.4740654],
    score: 82,
    visitorType: 'Lakeside country park',
    description:
      'Follow easy waterside trails through lakes, meadows and wildlife areas, with a cafe, play and practical facilities making this a dependable family outdoor stop.',
    opening: 'Park open 24 hours. Cafe and visitor facilities use separate daytime hours.',
    admission: 'Free entry. Pay-and-display parking applies, including for Blue Badge holders.',
    timeToSpend: 'Allow 60 minutes to 3 hours',
    website: 'https://www.northnorthants.gov.uk/barnwell-country-park',
    sourceName: 'Barnwell Country Park visitor information',
    sourceOrganisation: 'North Northamptonshire Council',
    reliability: 'local_authority',
    guide: {
      heroImage: art.barnwell,
      heroAlt: 'Ink-and-watercolour illustration of the reed-framed lake at Barnwell Country Park',
      headline: 'Easy lake circuits, wildlife and a relaxed family-friendly park day',
      intro:
        'Barnwell is one of the easiest outdoor visits near Oundle. Three trails, useful facilities and plenty of water-and-meadow scenery make it flexible rather than demanding.',
      motifs: ['Lakeside trails', 'Wildlife', 'Family play', 'Cafe stop'],
      bestFor: ['Easy family walks', 'Wildlife watching', 'Picnic afternoons'],
      toilets: 'Public and accessible toilets are available at the visitor facilities.',
      picnic: 'Formal picnic areas and outdoor seating are available around the park.',
      food: [
        {
          name: 'Kingfisher Cafe',
          visitorScore: 78,
          summary: 'Country-park cafe for drinks, cakes and daytime light food.',
          priceBand: '££',
          externalUrl: 'https://www.northnorthants.gov.uk/barnwell-country-park',
        },
      ],
      trails: [
        {
          name: 'Lakeside stroll',
          routeType: 'Yellow route',
          distance: '0.4 km',
          duration: 'About 15 minutes',
          difficulty: 'Easy',
          summary: 'A short hard-surfaced waterside stroll close to the visitor facilities.',
          externalUrl: 'https://www.northnorthants.gov.uk/barnwell-country-park',
        },
        {
          name: 'Kingfisher nature trail',
          routeType: 'Red route',
          distance: '0.8 km',
          duration: 'About 30 minutes',
          difficulty: 'Easy',
          summary: 'A hard-surfaced nature circuit through the park habitats.',
          externalUrl:
            'https://www.northnorthants.gov.uk/barnwell-country-park/barnwell-country-park-nature-trail',
        },
        {
          name: 'Riverside walk',
          routeType: 'Black route',
          distance: '1.6 km',
          duration: 'About 45 minutes',
          difficulty: 'Moderate',
          summary: 'The longest park route, mixing firm paths with sand, boardwalk and grass.',
          externalUrl: 'https://www.northnorthants.gov.uk/barnwell-country-park',
        },
      ],
      thingsToDo: [
        { name: 'Walk the lakeside trail', summary: 'Take the easiest route for close water views and birdlife.' },
        { name: 'Choose one of three marked routes', summary: 'Adjust the distance to suit time, weather and mobility.' },
        { name: 'Use the wildlife hides', summary: 'Pause quietly for water birds and seasonal wildlife.' },
        { name: 'Visit the play area', summary: 'Add an active family stop beside the main visitor facilities.' },
        { name: 'Picnic beside the lakes', summary: 'Use the park\'s strongest asset as the backdrop to a relaxed break.' },
      ],
    },
  },
  {
    project: 'sawtry',
    id: 'standalone-attraction:holme-fen',
    name: 'Holme Fen',
    featureType: 'park',
    coordinates: [-0.229291, 52.4872122],
    score: 85,
    visitorType: 'Lowland fen and birch woodland nature reserve',
    description:
      'Walk through atmospheric silver-birch woodland and peatland at one of Britain\'s lowest landscapes, marked by the famous Holme Posts.',
    opening: 'Open access all year. Paths can be wet or flooded, so check conditions and visit in daylight.',
    admission: 'Free',
    timeToSpend: 'Allow 60-150 minutes',
    website: 'https://www.greatfen.org.uk/holme-fen',
    sourceName: 'Holme Fen visitor information',
    sourceOrganisation: 'The Great Fen',
    reliability: 'official_non_statutory',
    significance: 'national',
    guide: {
      heroImage: art.holmeFen,
      heroAlt: 'Ink-and-watercolour illustration of a peat-dark woodland path through silver birch and golden bracken at Holme Fen',
      headline: 'Silver-birch woodland, deep peat and one of Britain\'s lowest landscapes',
      intro:
        'Holme Fen feels unlike a conventional woodland. The peat, birches and enormous skies tell the story of a drained landscape slowly being reconnected through the Great Fen.',
      motifs: ['Great Fen', 'Holme Posts', 'Birch woodland', 'Peat landscape'],
      bestFor: ['Distinctive landscapes', 'Wildlife walks', 'Quiet photography'],
      toilets: 'No public toilets are provided at the reserve.',
      picnic: 'No formal picnic area is confirmed. Take all litter home.',
      trails: [
        {
          name: 'Lost Lake and other Holme Histories',
          routeType: 'Waymarked circular trail',
          distance: '1 mile / 1.7 km',
          difficulty: 'Easy',
          summary:
            'A short waymarked route from Holme Post exploring the reserve landscape and its history.',
          externalUrl: 'https://www.greatfen.org.uk/explore/walks-trails/trail-guides',
        },
      ],
      thingsToDo: [
        { name: 'Find the Holme Posts', summary: 'See the striking markers that reveal how much the drained peat surface has fallen.' },
        { name: 'Walk through the birch woodland', summary: 'The pale trunks and wet ground create the reserve\'s most atmospheric scenery.' },
        { name: 'Follow the Great Fen trail', summary: 'Use the marked route for the clearest introduction to the reserve.' },
        { name: 'Look for fenland wildlife', summary: 'Seasonal birds, insects and wetland habitats reward quiet observation.' },
      ],
    },
  },
  {
    project: 'sawtry',
    id: 'standalone-attraction:woodwalton-fen',
    name: 'Woodwalton Fen',
    featureType: 'park',
    coordinates: [-0.1917422, 52.4448357],
    score: 83,
    visitorType: 'Historic fen national nature reserve',
    description:
      'Enter one of Britain\'s oldest nature reserves for reedbeds, pools, hides and a rare surviving fragment of undrained fenland.',
    opening: 'Open all year, but flooding can close or severely affect trails. Check current conditions before travel.',
    admission: 'Free',
    timeToSpend: 'Allow 90-180 minutes',
    website: 'https://www.greatfen.org.uk/woodwalton-fen',
    sourceName: 'Woodwalton Fen visitor information',
    sourceOrganisation: 'The Great Fen',
    reliability: 'official_non_statutory',
    significance: 'highest_national',
    guide: {
      heroImage: art.woodwalton,
      heroAlt: 'Ink-and-watercolour illustration of a reflective fen drain between tall reedbeds at Woodwalton Fen',
      headline: 'A rare surviving fen of reedbeds, pools, hides and extraordinary wildlife',
      intro:
        'Woodwalton is the more serious nature reserve of the Great Fen pair. Its history, habitats and three trails are exceptional, but water levels and strict no-dog rules need planning.',
      motifs: ['Reedbeds', 'Wildlife hides', 'Rothschild bungalow', 'Great Fen'],
      bestFor: ['Birdwatchers', 'Serious nature visits', 'Fenland history'],
      toilets: 'No public toilets are provided at the reserve.',
      picnic: 'No formal picnic area is confirmed within the sensitive reserve.',
      trails: [
        {
          name: 'Woodwalton Marsh Harrier Trail',
          routeType: 'Nature trail',
          distance: '1 mile / 1.6 km',
          summary: 'A reserve circuit focused on fen habitats and wildlife watching.',
          externalUrl: 'https://www.greatfen.org.uk/explore/walks-trails/trail-guides',
        },
        {
          name: 'Waterbirds Trail',
          routeType: 'Nature trail',
          distance: '1.5 miles / 2.4 km',
          summary: 'The longest of the published Woodwalton Fen trail-guide routes.',
          externalUrl: 'https://www.greatfen.org.uk/explore/walks-trails/trail-guides',
        },
        {
          name: 'Bungalow Trail',
          routeType: 'Historic nature trail',
          distance: '0.75 miles / 1.2 km',
          summary: "A shorter route towards Rothschild's historic bungalow and the fen landscape.",
          externalUrl: 'https://www.greatfen.org.uk/explore/walks-trails/trail-guides',
        },
      ],
      thingsToDo: [
        { name: 'Choose one of three marked trails', summary: 'Select a route according to water levels and available time.' },
        { name: 'Use the wildlife hides', summary: 'Watch pools and reedbeds without disturbing sensitive species.' },
        { name: 'See Rothschild\'s bungalow', summary: 'Find the historic base associated with conservation pioneer Charles Rothschild.' },
        { name: 'Look across the reedbeds', summary: 'The open fen views are the reserve\'s defining landscape.' },
        { name: 'Read the reserve\'s conservation story', summary: 'Understand why this fragment survived when so much fenland was drained.' },
      ],
    },
  },
  {
    project: 'sawtry',
    id: 'standalone-attraction:upwood-meadows',
    name: 'Upwood Meadows',
    featureType: 'park',
    coordinates: [-0.1599227, 52.4274396],
    score: 75,
    visitorType: 'Wildflower meadow nature reserve',
    description:
      'Visit in late spring or early summer for an increasingly rare display of traditionally managed ridge-and-furrow meadows rich in wildflowers.',
    opening: 'Open at all times. Paths can be muddy or flooded and the best flower season is spring into summer.',
    admission: 'Free',
    timeToSpend: 'Allow 45-90 minutes',
    website: 'https://www.wildlifebcn.org/nature-reserves/upwood-meadows',
    sourceName: 'Upwood Meadows visitor information',
    sourceOrganisation: 'Wildlife Trust for Beds, Cambs and Northants',
    reliability: 'official_non_statutory',
    significance: 'national',
    guide: {
      heroImage: art.upwood,
      heroAlt:
        'Ink-and-watercolour illustration of the wildflower-rich ridge-and-furrow grassland at Upwood Meadows',
      headline: 'Traditional ridge-and-furrow meadows alive with seasonal wildflowers',
      intro:
        'Upwood is strongly seasonal. At its best it is a lovely quiet flower walk; outside that window it remains pleasant but is a more specialist nature stop.',
      motifs: ['Wildflower meadow', 'Ridge and furrow', 'Traditional grazing', 'Seasonal colour'],
      bestFor: ['Late-spring flowers', 'Short nature walks', 'Meadow ecology'],
      toilets: 'No public toilets are provided at the reserve.',
      picnic: 'No formal picnic area is confirmed within the reserve.',
      thingsToDo: [
        { name: 'Walk the ridge and furrow', summary: 'The historic field pattern is still visible beneath the meadow.' },
        { name: 'Look for seasonal wildflowers', summary: 'Late spring and early summer give the strongest display.' },
        { name: 'Watch for butterflies', summary: 'Flower-rich grassland supports a range of insects in suitable weather.' },
      ],
    },
  },
  {
    project: 'sawtry',
    id: 'standalone-attraction:monks-wood',
    name: 'Monks Wood',
    featureType: 'park',
    coordinates: [-0.2396955, 52.4055181],
    score: 79,
    visitorType: 'Ancient woodland national nature reserve',
    description:
      'Walk beneath ancient woodland canopy along paths known for spring flowers, butterflies and a rich tradition of ecological research.',
    opening: 'Open access. Visit in daylight and keep to paths.',
    admission: 'Free',
    timeToSpend: 'Allow 60-120 minutes',
    website:
      'https://www.gov.uk/government/publications/cambridgeshires-national-nature-reserves/cambridgeshires-national-nature-reserves',
    sourceName: 'Cambridgeshire national nature reserves',
    sourceOrganisation: 'Natural England',
    reliability: 'official_non_statutory',
    significance: 'national',
    guide: {
      heroImage: art.monksWood,
      heroAlt:
        'Ink-and-watercolour illustration of a sunlit path winding through bluebells in Monks Wood',
      headline: 'An ancient wood celebrated for spring flowers, butterflies and ecological history',
      intro:
        'Monks Wood is a quiet, research-rich reserve best approached as a proper woodland walk rather than a facility-led country park.',
      motifs: ['Ancient woodland', 'Bluebells', 'Butterflies', 'Ecological research'],
      bestFor: ['Spring woodland', 'Butterfly watchers', 'Quiet nature walks'],
      toilets: 'No public toilets are provided at the reserve.',
      picnic: 'No formal picnic area is confirmed within the reserve.',
      thingsToDo: [
        { name: 'Follow the woodland paths', summary: 'Stay on established routes through the ancient woodland.' },
        { name: 'Look for spring flowers', summary: 'Bluebells and other ancient-woodland plants provide the strongest seasonal colour.' },
        { name: 'Watch sunny rides for butterflies', summary: 'The reserve has a long reputation for insect diversity.' },
        { name: 'Consider its research legacy', summary: 'Monks Wood has played an important role in British ecological science.' },
      ],
    },
  },
  {
    project: 'sawtry',
    id: 'standalone-attraction:hamerton-zoo-park',
    name: 'Hamerton Zoo Park',
    featureType: 'other',
    coordinates: [-0.3260736, 52.4098166],
    score: 88,
    visitorType: 'Independent wildlife park',
    description:
      'Spend a substantial family day among an unusual collection of mammals and birds, with play areas, picnic space and a small railway adding variety.',
    opening: 'Daily except Christmas Day and Boxing Day. Summer 10:00-17:00 with last entry 16:00. Winter 10:00-16:00 with last entry 15:00.',
    admission: 'Adult from £18.36. Child from £14.86. Senior from £17.49. Under-3s free.',
    timeToSpend: 'Allow 3-5 hours',
    website: 'https://hamertonzoopark.com/',
    sourceName: 'Hamerton Zoo Park visitor information',
    sourceOrganisation: 'Hamerton Zoo Park',
    reliability: 'official_non_statutory',
    guide: {
      heroImage: art.hamerton,
      heroAlt:
        'Ink-and-watercolour illustration of a white tiger resting in the landscaped grounds of Hamerton Zoo Park',
      headline: 'Unusual wildlife, generous picnic space and an easy full family day',
      intro:
        'Hamerton stands out for a collection that goes beyond the most familiar zoo species. The rural layout, play and picnic facilities suit a relaxed multi-hour visit.',
      motifs: ['Rare wildlife', 'Family day out', 'Play areas', 'Miniature railway'],
      bestFor: ['Wildlife-loving families', 'Longer day trips', 'Outdoor animal encounters'],
      toilets: 'Visitor toilets, accessible facilities and baby-changing provision are available on site.',
      picnic: 'Outdoor and covered picnic areas are available. Visitors may bring their own food.',
      food: [
        {
          name: 'Hamerton Coffee Shop',
          visitorScore: 74,
          summary: 'Practical on-site stop for hot and cold drinks, snacks and light food.',
          priceBand: '££',
          externalUrl: 'https://hamertonzoopark.com/whats-here/',
        },
      ],
      thingsToDo: [
        { name: 'Seek out the specialist animal collection', summary: 'Prioritise species rarely seen in larger mainstream zoos.' },
        { name: 'Follow the full wildlife circuit', summary: 'Allow enough time for the spread-out rural site.' },
        { name: 'Ride the miniature railway', summary: 'Check current operation and any small extra charge on the day.' },
        { name: 'Use the adventure play areas', summary: 'Build active family time into the animal visit.' },
        { name: 'Plan a covered picnic', summary: 'Sheltered picnic provision makes bringing lunch more practical.' },
      ],
    },
  },
  {
    project: 'thrapston',
    id: 'standalone-attraction:stanwick-lakes',
    name: 'Stanwick Lakes Country Park',
    featureType: 'park',
    coordinates: [-0.5802302, 52.3371086],
    score: 90,
    visitorType: 'Lakes, heritage and adventure country park',
    description:
      'Combine broad lake views and wildlife with imaginative adventure play, cycling, archaeology and an excellent visitor centre in one of the region\'s strongest country parks.',
    opening: 'Site generally 07:00-19:00 April-September and 07:00-17:00 October-March. Visitor centre normally 09:30-17:00.',
    admission: 'Free entry on foot or bicycle. Variable car-parking charges apply.',
    timeToSpend: 'Allow 2-5 hours',
    website: 'https://stanwicklakes.org.uk/visit/',
    sourceName: 'Stanwick Lakes visitor information',
    sourceOrganisation: 'Rockingham Forest Trust',
    reliability: 'official_non_statutory',
    significance: 'regional',
    guide: {
      heroImage: art.stanwick,
      heroAlt:
        'Ink-and-watercolour illustration of the Stanwick Lakes visitor centre overlooking the reed-framed lake',
      headline: 'Big skies, lakes, archaeology and one of the region\'s best adventure playgrounds',
      intro:
        'Stanwick Lakes succeeds as both a nature-rich landscape and a family destination. It can be a quick waterside walk, but the best visits make room for play, cycling and heritage.',
      motifs: ['Lakes and wildlife', 'Adventure play', 'Cycling', 'Archaeology'],
      bestFor: ['Full family days', 'Cycling and walking', 'Mixed-interest groups'],
      toilets: 'Public, accessible and family toilet facilities are available at the visitor centre.',
      picnic: 'Multiple outdoor picnic areas are available around the park.',
      food: [
        {
          name: 'Stanwick Lakes Cafe',
          visitorScore: 82,
          summary: 'Visitor-centre cafe for lunch, drinks and cakes overlooking the park.',
          openingTimes: 'Normally within visitor-centre hours, around 09:30-17:00',
          priceBand: '££',
          externalUrl: 'https://stanwicklakes.org.uk/visit/',
        },
      ],
      trails: [
        {
          name: 'Solstice Lake Loop',
          routeType: 'Waymarked lake circuit',
          summary: 'A self-led circuit around the park landscape and its principal lake.',
          externalUrl: 'https://stanwicklakes.org.uk/activities/',
        },
        {
          name: 'Nature Ramble',
          routeType: 'Self-led nature trail',
          summary: 'A nature-focused route through the wetland and lakeside habitats.',
          externalUrl: 'https://stanwicklakes.org.uk/activities/',
        },
        {
          name: 'Heritage Trail',
          routeType: 'Self-led heritage trail',
          summary: 'Explore the archaeology and long human story of the Stanwick landscape.',
          externalUrl: 'https://stanwicklakes.org.uk/activities/',
        },
        {
          name: 'Adventure Trail',
          routeType: 'Family activity trail',
          summary: 'A more active self-led option suited to family visits.',
          externalUrl: 'https://stanwicklakes.org.uk/activities/',
        },
        {
          name: 'Mindfulness Trail',
          routeType: 'Wellbeing trail',
          summary: 'A slower route using the country-park setting for mindful pauses.',
          externalUrl: 'https://stanwicklakes.org.uk/activities/',
        },
      ],
      thingsToDo: [
        { name: 'Tackle the adventure playground', summary: 'The large imaginative play landscape is a major destination in its own right.' },
        { name: 'Walk or cycle the lakes', summary: 'Choose short circuits or extend onto the wider trail network.' },
        { name: 'Visit the heritage area', summary: 'Explore reconstructions and interpretation rooted in local archaeology.' },
        { name: 'Watch wildlife from the paths', summary: 'Lakes, reedbeds and open ground support varied birdlife.' },
        { name: 'Use the visitor centre', summary: 'Combine exhibitions, facilities and a cafe stop with the outdoor visit.' },
      ],
    },
  },
  {
    project: 'sawtry',
    id: 'standalone-attraction:hinchingbrooke-country-park',
    name: 'Hinchingbrooke Country Park',
    featureType: 'park',
    coordinates: [-0.2120845, 52.3286463],
    score: 84,
    visitorType: 'Lakeside country park and nature reserve',
    description:
      'Explore 150 acres of lakes, woodland and meadow on a useful network of paths, with family play, picnics and a cafe close to Huntingdon.',
    opening: 'Country park open daily. Vehicle access and facilities use signed daytime hours.',
    admission: 'Free entry. Parking £1 up to 2 hours or £2 up to 6 hours during published charging hours.',
    timeToSpend: 'Allow 60 minutes to 3 hours',
    website: 'https://www.huntingdonshire.gov.uk/hinchingbrookecountrypark',
    sourceName: 'Hinchingbrooke Country Park visitor information',
    sourceOrganisation: 'Huntingdonshire District Council',
    reliability: 'local_authority',
    guide: {
      heroImage: art.hinchingbrooke,
      heroAlt:
        'Ink-and-watercolour illustration of the lake, willow and timber boardwalk at Hinchingbrooke Country Park',
      headline: 'Lakes, woodland and meadows for an easy all-ages outdoor escape',
      intro:
        'Hinchingbrooke is a practical, flexible country park rather than a single-sight attraction. It works especially well for families and dog walkers needing space close to town.',
      motifs: ['Lakeside paths', 'Woodland', 'Family play', 'Nature reserve'],
      bestFor: ['Easy walks', 'Family outdoor time', 'Dog-friendly visits'],
      toilets: 'Temporary toilets remain available during the current visitor-centre redevelopment, including accessible provision.',
      picnic: 'Picnic areas and open grass are available around the park.',
      food: [
        {
          name: 'Temporary park cafe',
          visitorScore: 77,
          summary: 'Daytime drinks, cakes and light food continue during the visitor-centre redevelopment.',
          openingTimes: 'Current temporary service generally Monday-Saturday 09:00-16:00 and Sunday 10:00-15:00',
          priceBand: '££',
          externalUrl:
            'https://www.huntingdonshire.gov.uk/leisure/parks-nature-reserves-and-green-spaces/hinchingbrooke-country-park/investment-at-hinchingbrooke-country-park/investment-at-hcp-faqs',
        },
      ],
      trails: [
        {
          name: 'Hinchingbrooke Circular',
          routeType: 'Country-park circuit',
          duration: 'About 90 minutes',
          difficulty: 'Advanced',
          summary:
            'A council-published longer circuit through the lakes, woodland and meadows of the park.',
          externalUrl: 'https://www.huntingdonshire.gov.uk/media/4910/hinchingbrooke-walks.pdf',
        },
      ],
      thingsToDo: [
        { name: 'Walk a lake circuit', summary: 'Use the waterside paths for the park\'s most immediately rewarding route.' },
        { name: 'Explore the nature reserve', summary: 'Move between meadow, woodland and wetland habitats.' },
        { name: 'Use the play area', summary: 'Add an active family stop close to the main facilities.' },
        { name: 'Follow a longer park loop', summary: 'Link the principal paths for a more substantial walk.' },
        { name: 'Pause for a picnic', summary: 'Choose an open area away from the busiest paths.' },
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
    tags: [
      'current-context',
      'service-context-visitor',
      'home-standalone-place',
      auditTag,
    ],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Current visitor attraction reviewed from the linked official or responsible visitor source on 2026-08-08. It is outside the active town boundary and appears only in Home discovery.',
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
  pkg.features = pkg.features.filter((feature) => !feature.tags.includes(auditTag));
  const projectAttractions = attractions.filter((definition) => definition.project === key);
  pkg.features.push(...projectAttractions.map((definition) => featureFor(pkg, definition)));
  const note =
    'Standalone attraction audit added 2026-08-08. These regional destinations are outside the active town boundary, appear only on Home discovery, and do not alter the town tourist rating.';
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
  added: attractions.map((definition) => ({
    id: definition.id,
    name: definition.name,
    project: definition.project,
    score: definition.score,
    coordinates: definition.coordinates,
    sourceUrl: definition.website,
  })),
  corrections: {
    'Bredford Purlieus': 'Bedford Purlieus',
    'Caster Hanglands': 'Castor Hanglands',
    'East Hornstock': 'Easton Hornstocks',
    'Hammerton Zoo': 'Hamerton Zoo Park',
    'Hunchingbrook Country Park': 'Hinchingbrooke Country Park',
  },
  excluded: [
    {
      requestedName: 'Collyweston Great Wood and East Hornstock',
      correctName: 'Collyweston Great Wood and Easton Hornstocks',
      reason:
        'Not suitable for casual Home discovery. Natural England states that access is by permit only, by agreement with the owners, and dogs are not permitted except guide dogs.',
      sourceUrl:
        'https://www.gov.uk/government/publications/northamptonshires-national-nature-reserves/northamptonshires-national-nature-reserves',
    },
  ],
  projectFeatureIds: writtenProjects,
  rules: [
    'All added attractions are outside the active town visitor boundary and are tagged home-standalone-place.',
    'Standalone records are current visitor context and never contribute to historic heat-map dating.',
    'Opening, admission and access details should be checked against the linked source before a special journey.',
  ],
};

await writeFile(
  resolve('data/review/peterborough-region-standalone-attractions-2026-08-08.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
);

console.log(`Added ${attractions.length} standalone attractions across ${Object.keys(writtenProjects).length} project packages.`);
