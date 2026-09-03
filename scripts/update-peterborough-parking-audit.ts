import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

type ParkingPlace = {
  id: string;
  name: string;
  coordinates: [number, number];
  parkingType: string;
  spaces?: number;
  accessibleSpaces?: number;
  chargingSpaces?: number;
  height?: string;
  opening: string;
  price: string;
  maxStay?: string;
  operator: string;
  sourceUrl: string;
  sourceName: string;
  osmUrl?: string;
};

const projectPath = resolve('data/projects/peterborough.json');
const plannerPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/peterborough-visitor-audit-2026-08-07.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-08T00:00:00Z';
const editorialLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.';
const councilUrl = 'https://www.peterborough.gov.uk/residents/parking/car-park-locations';
const queensgateUrl = 'https://www.queensgate-shopping.co.uk/parking/';
const stationUrl = 'https://www.nationalrail.co.uk/stations/peterborough/';

const commonCouncilOpening = 'Open 24 hours; charges normally apply 07:00-20:00 daily';
const councilPayment = 'Cash, card, contactless and approved parking apps';

const parkingPlaces: ParkingPlace[] = [
  {
    id: 'curated-parking:peterborough-car-haven',
    name: 'Car Haven Car Park',
    coordinates: [-0.240688, 52.570855],
    parkingType: 'Barrier-controlled surface car park',
    spaces: 214,
    accessibleSpaces: 10,
    chargingSpaces: 2,
    height: '2.3 m',
    opening: 'Open 24 hours; charges Monday-Friday 07:00-15:00 and weekends 07:00-20:00; free after 15:00 on weekdays until March 2028',
    price: 'Pay - 10 minutes free, then £2.60 for 1 hour to £12.50 all day',
    maxStay: 'All day',
    operator: 'Peterborough City Council',
    sourceUrl: councilUrl,
    sourceName: 'Peterborough car park locations and charges',
    osmUrl: 'https://www.openstreetmap.org/way/170338762',
  },
  {
    id: 'curated-parking:peterborough-riverside',
    name: 'Riverside Car Park',
    coordinates: [-0.239619, 52.569254],
    parkingType: 'Barrier-controlled surface car park',
    spaces: 162,
    accessibleSpaces: 7,
    chargingSpaces: 6,
    height: '2.3 m',
    opening: 'Open 24 hours; charges Monday-Friday 07:00-15:00 and weekends 07:00-20:00; free after 15:00 on weekdays until March 2028',
    price: 'Pay - 10 minutes free, then £2.30 for 1 hour to £8.30 all day',
    maxStay: 'All day',
    operator: 'Peterborough City Council',
    sourceUrl: councilUrl,
    sourceName: 'Peterborough car park locations and charges',
    osmUrl: 'https://www.openstreetmap.org/way/236061998',
  },
  {
    id: 'curated-parking:peterborough-bishops-road',
    name: 'Bishops Road Car Park',
    coordinates: [-0.237037, 52.570433],
    parkingType: 'Surface car park',
    spaces: 244,
    accessibleSpaces: 7,
    chargingSpaces: 2,
    height: '2.3 m',
    opening: 'Open 24 hours; charges Monday-Friday 07:00-15:00 and weekends 07:00-20:00; free after 15:00 on weekdays until March 2028',
    price: 'Pay - £2.30 for 1 hour to £8.30 all day',
    maxStay: 'All day',
    operator: 'Peterborough City Council',
    sourceUrl: councilUrl,
    sourceName: 'Peterborough car park locations and charges',
    osmUrl: 'https://www.openstreetmap.org/way/89093404',
  },
  {
    id: 'curated-parking:peterborough-queensgate-cavell',
    name: 'Queensgate Cavell (Blue) Car Park',
    coordinates: [-0.247521, 52.575233],
    parkingType: 'Multi-storey car park',
    spaces: 759,
    opening: 'Open daily; check Queensgate for the current colour-coded car park hours',
    price: 'Pay - current Queensgate tariff applies',
    operator: 'Queensgate Shopping Centre',
    sourceUrl: queensgateUrl,
    sourceName: 'Queensgate parking information',
    osmUrl: 'https://www.openstreetmap.org/way/44444725',
  },
  {
    id: 'curated-parking:peterborough-queensgate-clare',
    name: 'Queensgate Clare (Green) Car Park',
    coordinates: [-0.247058, 52.574217],
    parkingType: 'Multi-storey car park',
    spaces: 414,
    opening: 'Open daily; check Queensgate for the current colour-coded car park hours',
    price: 'Pay - current Queensgate tariff applies',
    operator: 'Queensgate Shopping Centre',
    sourceUrl: queensgateUrl,
    sourceName: 'Queensgate parking information',
    osmUrl: 'https://www.openstreetmap.org/way/42778824',
  },
  {
    id: 'curated-parking:peterborough-queensgate-perkins',
    name: 'Queensgate Perkins (Yellow) Car Park',
    coordinates: [-0.248028, 52.574235],
    parkingType: 'Multi-storey car park',
    spaces: 391,
    opening: 'Open daily; check Queensgate for the current colour-coded car park hours',
    price: 'Pay - current Queensgate tariff applies',
    operator: 'Queensgate Shopping Centre',
    sourceUrl: queensgateUrl,
    sourceName: 'Queensgate parking information',
    osmUrl: 'https://www.openstreetmap.org/way/43056900',
  },
  {
    id: 'curated-parking:peterborough-queensgate-royce',
    name: 'Queensgate Royce (Red) Car Park',
    coordinates: [-0.246805, 52.575094],
    parkingType: 'Multi-storey car park',
    spaces: 710,
    opening: 'Open daily; check Queensgate for the current colour-coded car park hours',
    price: 'Pay - current Queensgate tariff applies',
    operator: 'Queensgate Shopping Centre',
    sourceUrl: queensgateUrl,
    sourceName: 'Queensgate parking information',
    osmUrl: 'https://www.openstreetmap.org/way/42778830',
  },
  {
    id: 'curated-parking:peterborough-station',
    name: 'Peterborough Station Car Park',
    coordinates: [-0.248067, 52.572532],
    parkingType: 'Station surface car parks',
    opening: 'Open for station users; allow extra time while Station Quarter works reduce the main car park',
    price: 'Pay - check the current LNER parking tariff',
    operator: 'LNER',
    sourceUrl: stationUrl,
    sourceName: 'Peterborough station facilities',
    osmUrl: 'https://www.openstreetmap.org/way/89093451',
  },
  {
    id: 'curated-parking:peterborough-brook-street',
    name: 'Brook Street Council Car Park',
    coordinates: [-0.238563, 52.576364],
    parkingType: 'Surface car park',
    spaces: 136,
    accessibleSpaces: 5,
    opening: commonCouncilOpening,
    price: 'Pay - £2.10 for 1 hour to £6.20 all day',
    maxStay: '13 hours',
    operator: 'Peterborough City Council',
    sourceUrl: councilUrl,
    sourceName: 'Peterborough car park locations and charges',
    osmUrl: 'https://www.openstreetmap.org/way/33915445',
  },
  {
    id: 'curated-parking:peterborough-dickens-street',
    name: 'Dickens Street Car Park',
    coordinates: [-0.233922, 52.577274],
    parkingType: 'Surface car park',
    spaces: 171,
    height: '2.3 m',
    opening: commonCouncilOpening,
    price: 'Pay - £2.10 for 1 hour to £6.20 for 24 hours',
    maxStay: '24 hours',
    operator: 'Peterborough City Council',
    sourceUrl: councilUrl,
    sourceName: 'Peterborough car park locations and charges',
    osmUrl: 'https://www.openstreetmap.org/way/1083874736',
  },
  {
    id: 'curated-parking:peterborough-wellington-street',
    name: 'Wellington Street Car Park',
    coordinates: [-0.233931, 52.575997],
    parkingType: 'Surface car park',
    spaces: 671,
    accessibleSpaces: 10,
    height: '2.3 m',
    opening: commonCouncilOpening,
    price: 'Pay - £2.10 for 1 hour to £6.20 for 24 hours',
    maxStay: '24 hours',
    operator: 'Peterborough City Council',
    sourceUrl: councilUrl,
    sourceName: 'Peterborough car park locations and charges',
    osmUrl: 'https://www.openstreetmap.org/way/43142010',
  },
  {
    id: 'curated-parking:peterborough-trinity-street',
    name: 'Trinity Street Car Park',
    coordinates: [-0.246044, 52.571242],
    parkingType: 'Surface car park',
    spaces: 50,
    opening: 'Permit holders Monday-Friday 08:00-18:00; public after 18:00 on weekdays and all day at weekends',
    price: 'Pay when open to the public - £3.60 for 2 hours or £5.70 for 3 hours',
    maxStay: '3 hours during public sessions',
    operator: 'Peterborough City Council',
    sourceUrl: councilUrl,
    sourceName: 'Peterborough car park locations and charges',
    osmUrl: 'https://www.openstreetmap.org/way/89093434',
  },
  {
    id: 'curated-parking:peterborough-pleasure-fair-meadow',
    name: 'Pleasure Fair Meadow Car Park',
    coordinates: [-0.243266, 52.566694],
    parkingType: 'Surface car park',
    spaces: 316,
    height: '2.3 m',
    opening: 'Open 24 hours; charges Monday-Friday 07:00-15:00 and weekends 07:00-20:00; free after 15:00 on weekdays until March 2028',
    price: 'Pay - £2.60 for 1 hour to £6.20 for 24 hours',
    maxStay: '24 hours',
    operator: 'Peterborough City Council',
    sourceUrl: councilUrl,
    sourceName: 'Peterborough car park locations and charges',
    osmUrl: 'https://www.openstreetmap.org/way/77920261',
  },
  {
    id: 'curated-parking:peterborough-railway-sidings',
    name: 'Railway Sidings Car Park',
    coordinates: [-0.234497, 52.565696],
    parkingType: 'Surface car park',
    spaces: 79,
    chargingSpaces: 4,
    height: '2.3 m',
    opening: commonCouncilOpening,
    price: 'Pay - £2.60 for 1 hour to £12.50 weekday or £6.20 weekend day rate',
    maxStay: '13 hours',
    operator: 'Peterborough City Council',
    sourceUrl: councilUrl,
    sourceName: 'Peterborough car park locations and charges',
    osmUrl: 'https://www.openstreetmap.org/way/668566846',
  },
  {
    id: 'curated-parking:peterborough-sand-martin-house',
    name: 'Sand Martin House Multi-storey',
    coordinates: [-0.24705, 52.5659],
    parkingType: 'Barrier-controlled multi-storey car park',
    spaces: 386,
    accessibleSpaces: 14,
    chargingSpaces: 4,
    height: '2.1 m',
    opening: 'Open and charged 24 hours daily',
    price: 'Pay - £2.60 for 1 hour to £12.50 weekday or £6.20 weekend day rate; £3 overnight',
    maxStay: 'All day',
    operator: 'Peterborough City Council',
    sourceUrl: councilUrl,
    sourceName: 'Peterborough car park locations and charges',
  },
  {
    id: 'curated-parking:peterborough-regional-pool',
    name: 'Regional Pool Car Park',
    coordinates: [-0.232266, 52.571539],
    parkingType: 'Surface car park',
    spaces: 123,
    accessibleSpaces: 5,
    height: '2.3 m',
    opening: 'Open 24 hours; charges 09:00-16:00 daily',
    price: 'Pay - £1.50 for 1 hour to £6.50 for 7 hours',
    maxStay: '7 hours',
    operator: 'Peterborough City Council',
    sourceUrl: councilUrl,
    sourceName: 'Peterborough car park locations and charges',
  },
  {
    id: 'curated-parking:peterborough-ferry-meadows',
    name: 'Ferry Meadows Main Car Park',
    coordinates: [-0.30755, 52.5629],
    parkingType: 'Surface country-park car park',
    opening: 'Seasonal vehicle gate times; charges apply all day every day',
    price: 'Pay - £2.60 up to 1 hour, rising to £7.80 over 8 hours',
    maxStay: 'Over 8 hours available within gate times',
    operator: 'Nene Park Trust',
    sourceUrl: 'https://www.nenepark.org.uk/news/parking-tariff-increase-from-1st-february-2026',
    sourceName: 'Ferry Meadows parking tariffs',
  },
];

function sourceRecord(place: ParkingPlace): SourceRecord {
  const details = [
    'amenity=parking',
    `parking=${place.parkingType}`,
    'access=public',
    place.spaces ? `capacity=${place.spaces}` : undefined,
    place.accessibleSpaces ? `capacity:disabled=${place.accessibleSpaces}` : undefined,
    place.chargingSpaces ? `capacity:charging=${place.chargingSpaces}` : undefined,
    place.height ? `maxheight=${place.height}` : undefined,
    'payment_required=yes',
    `price_display=${place.price}`,
    `opening_hours:description=${place.opening}`,
    place.maxStay ? `maxstay=${place.maxStay}` : undefined,
    `payment=${councilPayment}`,
    `operator=${place.operator}`,
    `website=${place.sourceUrl}`,
  ].filter(Boolean);

  return {
    sourceName: place.sourceName,
    sourceOrganisation: place.operator,
    sourceRecordId: `visitor-audit:${place.id}`,
    sourceUrl: place.sourceUrl,
    accessedAt: reviewedAt,
    reliability: place.operator === 'Peterborough City Council' ? 'local_authority' : 'official_non_statutory',
    licence: editorialLicence,
    notes: `Current-place curation: ${details.join('; ')}.`,
  };
}

function parkingFeature(place: ParkingPlace): HeritageFeature {
  const existing = pkg.features.find((feature) => feature.id === place.id);
  const geometrySource: SourceRecord | undefined = place.osmUrl
    ? {
        sourceName: 'OpenStreetMap current parking geometry',
        sourceOrganisation: 'OpenStreetMap contributors',
        sourceRecordId: `osm-location:${place.id}`,
        sourceUrl: place.osmUrl,
        accessedAt: reviewedAt,
        reliability: 'secondary',
        licence: osmLicence,
        notes: 'Representative map point derived from the current mapped car-park geometry.',
      }
    : undefined;

  return {
    id: place.id,
    projectId: pkg.project.id,
    name: place.name,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType: 'parking',
    significance: 'local',
    geometry: point(place.coordinates).geometry,
    locationType: 'representative_point',
    locationConfidence: place.osmUrl ? 'high' : 'medium',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription: `${place.parkingType} operated by ${place.operator}.`,
    sourceRecords: [sourceRecord(place), ...(geometrySource ? [geometrySource] : [])],
    tags: ['peterborough-visitor-audit', 'current-context', 'service-context-parking'],
    createdAt: existing?.createdAt ?? reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: 'Public visitor parking reviewed against current operator information on 2026-08-08.',
    evidenceScope: 'related_context',
    licence: editorialLicence,
  };
}

const visitorBoundary = pkg.project.townStudyArea?.visitorBoundary;
if (!visitorBoundary) throw new Error('Peterborough active visitor boundary is missing');

for (const place of parkingPlaces) {
  const feature = parkingFeature(place);
  if (!booleanPointInPolygon(point(place.coordinates), visitorBoundary)) {
    throw new Error(`Parking place falls outside the Peterborough visitor boundary: ${place.name}`);
  }
  const index = pkg.features.findIndex((candidate) => candidate.id === feature.id);
  if (index === -1) pkg.features.push(feature);
  else pkg.features[index] = feature;
}

planner.projects[pkg.project.id] = {
  ...(planner.projects[pkg.project.id] ?? {}),
  parking: parkingPlaces.map((place) => place.id),
};

const audit = JSON.parse(await readFile(auditPath, 'utf8')) as {
  reviewedAt?: string;
  counts?: Record<string, number>;
  validation?: Record<string, boolean>;
  notes?: string[];
};
audit.reviewedAt = reviewedAt;
audit.counts = { ...(audit.counts ?? {}), parking: parkingPlaces.length };
audit.validation = {
  ...(audit.validation ?? {}),
  customerOnlyParkingExcluded: true,
  allPublicParkingInsideActiveBoundary: true,
};
audit.notes = [
  ...(audit.notes ?? []).filter((note) => !note.startsWith('Parking re-audited')),
  'Parking re-audited 2026-08-08: all 11 current council car parks plus four Queensgate car parks, Peterborough station parking and Ferry Meadows are curated; private, permit-only, hospital, hotel, retail-customer and ambiguous unnamed OSM parking are excluded.',
];

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(`Updated Peterborough public parking: ${parkingPlaces.length} curated visitor choices.`);
