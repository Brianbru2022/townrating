import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

interface FeatureUpdate {
  file: string;
  featureId: string;
  name?: string;
  source: SourceRecord;
}

const reviewedAt = '2026-08-08T00:00:00.000Z';

const updates: FeatureUpdate[] = [
  {
    file: 'linlithgow.json',
    featureId: 'osm-community:way-263513939',
    source: {
      sourceName: 'Linlithgow Station facilities',
      sourceOrganisation: 'ScotRail',
      sourceRecordId: 'scotrail-linlithgow-station-parking-2026',
      sourceUrl: 'https://www.scotrail.co.uk/plan-your-journey/stations-and-facilities/lin',
      accessedAt: reviewedAt,
      notes:
        'Current-place curation: amenity=parking; parking=surface; access=public; capacity=96; capacity:disabled=2; price_display=Free; payment_required=no; opening_hours:description=Open 24 hours daily; description=Free station car park on the east side of Linlithgow station; website=https://www.scotrail.co.uk/plan-your-journey/stations-and-facilities/lin.',
      reliability: 'official_non_statutory',
    },
  },
  {
    file: 'kirknewton.json',
    featureId: 'osm-community:way-294736243',
    name: 'Kirknewton Park Pavilion car park',
    source: {
      sourceName: 'OpenStreetMap current parking tags',
      sourceOrganisation: 'OpenStreetMap contributors',
      sourceRecordId: 'way/294736243-fee-audit-2026-08-08',
      sourceUrl: 'https://www.openstreetmap.org/way/294736243',
      accessedAt: reviewedAt,
      notes:
        'Current-place curation: amenity=parking; parking=surface; access=public; capacity=9; capacity:disabled=1; price_display=Free; payment_required=no; description=Small free public surface car park at Kirknewton Park Pavilion; website=https://www.openstreetmap.org/way/294736243.',
      reliability: 'discovery_only',
    },
  },
  {
    file: 'whitburn.json',
    featureId: 'osm-community:way-1019746049',
    source: {
      sourceName: 'OpenStreetMap current parking tags',
      sourceOrganisation: 'OpenStreetMap contributors',
      sourceRecordId: 'way/1019746049-fee-audit-2026-08-08',
      sourceUrl: 'https://www.openstreetmap.org/way/1019746049',
      accessedAt: reviewedAt,
      notes:
        'Current-place curation: amenity=parking; parking=surface; access=public; price_display=Free; payment_required=no; capacity:disabled=3; ev_charging=yes; description=Free central surface car park beside Whitburn Partnership Centre and the Community Museum; website=https://www.westlothian.gov.uk/whitburnpartnershipcentre.',
      reliability: 'discovery_only',
    },
  },
  {
    file: 'livingston.json',
    featureId: 'osm-community:way-87166954',
    name: "St John's Hospital Car Park A",
    source: {
      sourceName: "St John's Hospital parking",
      sourceOrganisation: 'NHS Lothian',
      sourceRecordId: 'nhs-lothian-st-johns-free-parking-2026-a',
      sourceUrl: 'https://children.nhslothian.scot/parents-and-carers/financial-help-advice/',
      accessedAt: reviewedAt,
      notes:
        "Current-place curation: amenity=parking; parking=surface; access=public; price_display=Free; payment_required=no; description=Free patient and visitor parking at St John's Hospital; follow current hospital signs for visitor areas; website=https://children.nhslothian.scot/parents-and-carers/financial-help-advice/.",
      reliability: 'official_non_statutory',
    },
  },
  {
    file: 'livingston.json',
    featureId: 'osm-community:relation-20134428',
    name: "St John's Hospital Car Park B",
    source: {
      sourceName: "St John's Hospital parking",
      sourceOrganisation: 'NHS Lothian',
      sourceRecordId: 'nhs-lothian-st-johns-free-parking-2026-b',
      sourceUrl: 'https://children.nhslothian.scot/parents-and-carers/financial-help-advice/',
      accessedAt: reviewedAt,
      notes:
        "Current-place curation: amenity=parking; parking=surface; access=public; price_display=Free; payment_required=no; description=Free patient and visitor parking at St John's Hospital; follow current hospital signs for visitor areas; website=https://children.nhslothian.scot/parents-and-carers/financial-help-advice/.",
      reliability: 'official_non_statutory',
    },
  },
  {
    file: 'livingston.json',
    featureId: 'osm-community:way-43997152',
    source: {
      sourceName: 'The Centre Livingston parking',
      sourceOrganisation: 'The Centre Livingston',
      sourceRecordId: 'the-centre-livingston-car-park-2-2026',
      sourceUrl: 'https://thecentrelivingston.com/parking/',
      accessedAt: reviewedAt,
      notes:
        'Current-place curation: amenity=parking; parking=multi-storey; access=public; price_display=Pay; payment_required=yes; charge=£0.50 per hour up to £5 for 10 hours, £6 up to 24 hours; payment_methods=Card at exit barrier or cash/card pay station; opening_hours:description=08:00-00:00 daily; charging_hours=08:00-18:00 daily, free after 18:00; description=Paid town-centre parking serving The Centre; website=https://thecentrelivingston.com/parking/.',
      reliability: 'official_non_statutory',
    },
  },
  {
    file: 'livingston.json',
    featureId: 'osm-community:way-176818869',
    source: {
      sourceName: 'The Centre Livingston parking',
      sourceOrganisation: 'The Centre Livingston',
      sourceRecordId: 'the-centre-livingston-car-park-3-2026',
      sourceUrl: 'https://thecentrelivingston.com/parking/',
      accessedAt: reviewedAt,
      notes:
        'Current-place curation: amenity=parking; parking=surface; access=public; price_display=Pay; payment_required=yes; charge=£0.50 per hour up to £5 for 10 hours, £6 up to 24 hours; payment_methods=Card at exit barrier or cash/card pay station; opening_hours:description=08:00-00:00 daily; charging_hours=08:00-18:00 daily, free after 18:00; description=Paid town-centre parking serving The Centre; website=https://thecentrelivingston.com/parking/.',
      reliability: 'official_non_statutory',
    },
  },
  {
    file: 'livingston.json',
    featureId: 'osm-community:way-492631334',
    source: {
      sourceName: 'Livingston Designer Outlet parking',
      sourceOrganisation: 'Livingston Designer Outlet',
      sourceRecordId: 'livingston-designer-outlet-blue-car-park-2026',
      sourceUrl: 'https://livingston-designer-outlet.co.uk/parking',
      accessedAt: reviewedAt,
      notes:
        'Current-place curation: amenity=parking; parking=surface; access=public; price_display=Pay; payment_required=yes; charge=Check current on-site tariff; payment_methods=Coin or card at pay-and-display machine; charging_hours=Charges apply 08:00-18:00, free 18:00-08:00; description=Paid surface parking by Livingston Designer Outlet and the cinema; check zone signs before leaving the car park; website=https://livingston-designer-outlet.co.uk/parking.',
      reliability: 'official_non_statutory',
    },
  },
  {
    file: 'livingston.json',
    featureId: 'osm-community:way-86501918',
    source: {
      sourceName: 'Almondvale West Red Car Park operator clarification',
      sourceOrganisation: 'Livingston Designer Outlet',
      sourceRecordId: 'almondvale-west-red-car-park-operator-2026',
      sourceUrl: 'https://www.tripadvisor.com/Attraction_Review-g551897-d5327828-Reviews-Livingston_Designer_Outlet-Livingston_West_Lothian_Scotland.html',
      accessedAt: reviewedAt,
      notes:
        'Current-place curation: amenity=parking; parking=surface; access=public; price_display=Pay; payment_required=yes; charge=Check current Red Car Park tariff; payment_methods=Pay at the car park and retain proof; description=ANPR-controlled paid parking for Almondvale West Retail Park, separate from Livingston Designer Outlet parking; check the red-zone signs carefully; website=https://www.openstreetmap.org/way/86501918.',
      reliability: 'secondary',
    },
  },
];

function addSource(feature: HeritageFeature, update: FeatureUpdate): void {
  if (update.name) feature.name = update.name;
  feature.sourceRecords = feature.sourceRecords.filter(
    (record) => record.sourceRecordId !== update.source.sourceRecordId,
  );
  feature.sourceRecords.push(update.source);
  feature.updatedAt = reviewedAt;
}

for (const file of [...new Set(updates.map((update) => update.file))]) {
  const path = resolve('data/projects', file);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  for (const update of updates.filter((candidate) => candidate.file === file)) {
    const feature = pkg.features.find((candidate) => candidate.id === update.featureId);
    if (!feature) throw new Error(`${update.featureId} was not found in ${file}.`);
    addSource(feature, update);
  }
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(`Updated ${file}.`);
}
