import { describe, expect, it } from 'vitest';
import type {
  EditorialRecordReview,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
} from './models';
import { editorialRatingMethodVersion } from './editorialResearch';
import {
  currentPlaceDetailsFromSource,
  foodAndDrinkScore,
  osmDetailLabel,
  osmTagValue,
  parkingPriceStatus,
  practicalStops,
  safeExternalUrl,
  topFoodAndDrink,
  visitorDetails,
  visitorFacts,
  visitorInterestLabel,
  visitorNeedPlaces,
  visitorNeedDisplayLimit,
  visitorPitch,
  visitorPlaceType,
} from './visitorExperience';

function currentSource(notes: string): SourceRecord {
  return {
    sourceName: 'OpenStreetMap current community places',
    sourceOrganisation: 'OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/',
    accessedAt: '2026-08-01',
    reliability: 'discovery_only',
    notes,
  };
}

function feature(options: {
  id: string;
  name: string;
  tags?: string[];
  notes?: string;
  sourceRecords?: SourceRecord[];
  coordinates?: [number, number];
  featureType?: string;
  details?: string;
  editorialReview?: EditorialRecordReview;
}): HeritageFeature {
  return {
    id: options.id,
    projectId: 'test-town',
    name: options.name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    featureType: options.featureType ?? 'other',
    geometry: { type: 'Point', coordinates: options.coordinates ?? [0, 0] },
    locationType: 'exact',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    locationConfidence: 'high',
    sourceRecords: options.sourceRecords ?? (options.notes ? [currentSource(options.notes)] : []),
    details: options.details,
    tags: options.tags ?? [],
    createdAt: '',
    updatedAt: '',
    reviewed: true,
    editorialReview: options.editorialReview,
  };
}

function trailReview(evidenceUrl: string): EditorialRecordReview {
  return {
    status: 'editorially_researched',
    category: 'trail',
    methodVersion: editorialRatingMethodVersion,
    reviewedAt: '2026-08-13',
    scoreRationale: 'A responsible publisher describes a complete visitor trail.',
    evidenceUrls: [evidenceUrl],
  };
}

function pkg(features: HeritageFeature[]): ProjectPackage {
  return {
    project: {
      id: 'test-town',
      name: 'Test Town',
      countryCode: 'GB-SCT',
      country: 'Scotland',
      locality: 'Test Town',
      centre: [0, 0],
      boundary: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
              [-1, -1],
            ],
          ],
        },
      },
      boundarySource: '',
      boundaryConfidence: 'high',
      sourceLanguage: 'en',
      preferredBasemap: 'openstreetmap',
      createdAt: '',
      methodology: {
        age: {},
        significance: {
          highest_national: 1,
          national: 1,
          regional: 1,
          local: 1,
          recognised: 1,
        },
        confidence: { high: 1, medium: 1, low: 1, unknown: 1 },
        survival: {
          substantially_intact: 1,
          altered_recognisable: 1,
          heavily_altered: 1,
          site_only_or_demolished: 1,
          unknown: 1,
        },
      },
    },
    features,
    sources: [],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };
}

describe('visitor planner display limits', () => {
  it('caps discovery lists and leaves reviewed practical categories uncapped', () => {
    expect(visitorNeedDisplayLimit('see')).toBe(20);
    expect(visitorNeedDisplayLimit('eat')).toBe(20);
    expect(visitorNeedDisplayLimit('trails')).toBe(Number.MAX_SAFE_INTEGER);
    expect(visitorNeedDisplayLimit('picnic')).toBe(Number.MAX_SAFE_INTEGER);
    expect(visitorNeedDisplayLimit('parking')).toBe(Number.MAX_SAFE_INTEGER);
    expect(visitorNeedDisplayLimit('toilets')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('recognises generated practical feature types without embedded OSM detail notes', () => {
    const generatedToilets = feature({
      id: 'generated-toilets',
      name: 'Public toilets near Market Square',
      featureType: 'toilets',
      tags: ['service-context-toilets'],
    });
    const generatedPicnic = feature({
      id: 'generated-picnic',
      name: 'Picnic area near Campbell Park',
      featureType: 'picnic_site',
      tags: ['service-context-picnic'],
    });

    expect(visitorPlaceType(generatedToilets)).toBe('Public toilets');
    expect(visitorPlaceType(generatedPicnic)).toBe('Picnic area');
    expect(visitorNeedPlaces(pkg([generatedToilets]), 'toilets')).toHaveLength(1);
    expect(visitorNeedPlaces(pkg([generatedPicnic]), 'picnic')).toHaveLength(1);
  });

  it('publishes researched current-context facts stored in feature details', () => {
    const parking = feature({
      id: 'researched-parking',
      name: 'Market Place Car Park',
      featureType: 'other',
      details: 'amenity=parking; capacity=42; fee=no',
      tags: ['service-context-parking', 'current-context'],
    });
    const toilets = feature({
      id: 'researched-toilets',
      name: 'Market Place Public Toilets',
      featureType: 'other',
      details: 'amenity=toilets; disabled=yes',
      tags: ['service-context-toilet', 'current-context'],
    });

    expect(visitorPlaceType(parking)).toBe('Parking');
    expect(visitorPlaceType(toilets)).toBe('Public toilets');
    expect(visitorNeedPlaces(pkg([parking]), 'parking')).toHaveLength(1);
    expect(visitorNeedPlaces(pkg([toilets]), 'toilets')).toHaveLength(1);
  });

  it('allows only explicitly related curated visitor context beyond the town polygon', () => {
    const connectedParking = feature({
      id: 'connected-parking',
      name: 'Connected Trailhead Car Park',
      coordinates: [2, 2],
      featureType: 'other',
      details: 'amenity=parking; fee=no',
      tags: ['service-context-parking', 'current-context'],
    });
    connectedParking.evidenceScope = 'related_context';

    expect(
      visitorNeedPlaces(pkg([connectedParking]), 'parking', 5, {
        curatedFeatureIds: [connectedParking.id],
      }),
    ).toHaveLength(1);

    connectedParking.evidenceScope = 'parish_evidence';
    expect(
      visitorNeedPlaces(pkg([connectedParking]), 'parking', 5, {
        curatedFeatureIds: [connectedParking.id],
      }),
    ).toHaveLength(0);
  });
});

describe('visitor experience helpers', () => {
  it('allows bundled public download paths as safe external URLs', () => {
    expect(safeExternalUrl('/trails/south-queensferry/walk.pdf')).toBe(
      '/trails/south-queensferry/walk.pdf',
    );
    expect(safeExternalUrl('//example.com/not-a-local-path.pdf')).toBeUndefined();
  });

  it('parses current-place detail notes into key-value visitor fields', () => {
    expect(
      currentPlaceDetailsFromSource(
        currentSource(
          'Current OSM details: amenity=cafe; opening_hours=Mo-Sa 09:00-17:00; wheelchair=yes.',
        ),
      ),
    ).toEqual([
      { key: 'amenity', value: 'cafe' },
      { key: 'opening_hours', value: 'Mo-Sa 09:00-17:00' },
      { key: 'wheelchair', value: 'yes' },
    ]);
  });

  it('does not confuse namespaced OSM keys with their parent key', () => {
    const cafe = feature({
      id: 'cafe-with-customer-toilets',
      name: 'Town Cafe',
      notes: 'Current OSM details: amenity=cafe; toilets:access=customers; dog=yes.',
    });

    expect(osmTagValue(cafe, 'access')).toBeUndefined();
    expect(osmTagValue(cafe, 'toilets:access')).toBe('customers');
  });

  it('does not treat the colon in an unprefixed https URL as a note prefix', () => {
    const source = {
      sourceName: 'OpenStreetMap current community places',
      sourceOrganisation: 'OpenStreetMap contributors',
      sourceUrl: 'https://www.openstreetmap.org/node/1',
      accessedAt: '2026-08-11T00:00:00.000Z',
      reliability: 'discovery_only' as const,
      notes:
        'name=Example Trail; external_url=https://example.org/trail; trail_score=86; duration=90 minutes',
    };

    expect(currentPlaceDetailsFromSource(source)).toEqual([
      { key: 'name', value: 'Example Trail' },
      { key: 'external_url', value: 'https://example.org/trail' },
      { key: 'trail_score', value: '86' },
      { key: 'duration', value: '90 minutes' },
    ]);
  });

  it('uses external_url details for public trail links', () => {
    const packageData = pkg([
      feature({
        id: 'external-url-trail',
        name: 'Linked Town Trail',
        tags: ['service-context-trails'],
        notes:
          'Current-place curation: external_url=https://example.org/linked-trail; trail_score=86; route=foot.',
        editorialReview: trailReview('https://example.org/linked-trail'),
      }),
    ]);

    expect(visitorNeedPlaces(packageData, 'trails')).toEqual([
      expect.objectContaining({
        id: 'external-url-trail',
        externalUrl: 'https://example.org/linked-trail',
        visitorScore: 86,
      }),
    ]);
  });

  it('recognises the singular service-context trail tag', () => {
    const packageData = pkg([
      feature({
        id: 'singular-service-trail',
        name: 'Town Heritage Walk',
        tags: ['service-context-trail'],
        notes:
          'Current-place curation: external_url=https://example.org/heritage-walk; trail_score=82.',
        editorialReview: trailReview('https://example.org/heritage-walk'),
      }),
    ]);

    expect(visitorNeedPlaces(packageData, 'trails')).toEqual([
      expect.objectContaining({
        id: 'singular-service-trail',
        visitorScore: 82,
      }),
    ]);
  });

  it('uses the newest current-place curation when a place has been audited again', () => {
    const parking = feature({
      id: 'reviewed-parking',
      name: 'Reviewed car park',
      tags: ['osm-community-parking'],
      sourceRecords: [
        currentSource('Current OSM details: amenity=parking; parking=surface.'),
        {
          ...currentSource(
            'Current-context curation: amenity=parking; parking=surface; capacity=10; description=Older review.',
          ),
          sourceName: 'Earlier current-place review',
        },
        {
          ...currentSource(
            'Current-place curation: amenity=parking; parking=surface; price_display=Check signs; payment_required=unknown.',
          ),
          sourceName: 'Latest visitor parking audit',
        },
      ],
    });

    expect(visitorFacts(parking)).toEqual(
      expect.arrayContaining([
        { label: 'Parking type', value: 'Open surface car park' },
        { label: 'Spaces', value: '10' },
        { label: 'Pricing', value: 'Check signs' },
      ]),
    );
  });

  it('gives friendly place types and interest labels', () => {
    const cafe = feature({
      id: 'cafe',
      name: 'Town Cafe',
      tags: ['osm-community-food'],
      notes: 'Current OSM details: amenity=cafe.',
    });
    const archaeology = feature({
      id: 'ancient',
      name: 'Ancient mound',
      featureType: 'archaeological_site',
    });

    expect(visitorPlaceType(cafe)).toBe('Cafe');
    expect(visitorInterestLabel(cafe)).toBe('Food & drink');
    expect(visitorPlaceType(archaeology)).toBe('Ancient site');
  });

  it('prioritises cafes, coffee and bakeries for food and drink', () => {
    const restaurant = feature({
      id: 'restaurant',
      name: 'Town Restaurant',
      tags: ['osm-community-food'],
      notes: 'Current OSM details: amenity=restaurant.',
    });
    const cafe = feature({
      id: 'cafe',
      name: 'Independent Cafe',
      tags: ['osm-community-food'],
      notes: 'Current OSM details: amenity=cafe.',
    });
    const bakery = feature({
      id: 'bakery',
      name: 'High Street Bakery',
      tags: ['osm-community-food'],
      notes: 'Current OSM details: shop=bakery.',
    });
    const places = topFoodAndDrink(
      pkg([
        restaurant,
        cafe,
        bakery,
        feature({
          id: 'car-park',
          name: 'Main Street Parking',
          tags: ['osm-community-parking'],
          notes: 'Current OSM details: amenity=parking.',
        }),
      ]),
    );

    expect(places).toEqual([]);
    expect(foodAndDrinkScore(cafe)).toBeUndefined();
    expect(foodAndDrinkScore(restaurant)).toBeUndefined();
  });

  it('includes practical stops and excludes candidates outside the polygon', () => {
    const stops = practicalStops(
      pkg([
        feature({
          id: 'toilets',
          name: 'Public toilets',
          tags: ['osm-community-amenities'],
          notes: 'Current OSM details: amenity=toilets.',
        }),
        feature({
          id: 'parking',
          name: 'Visitor parking',
          tags: ['osm-community-parking'],
          notes: 'Current OSM details: amenity=parking.',
        }),
        feature({
          id: 'outside',
          name: 'Outside toilets',
          tags: ['osm-community-amenities'],
          notes: 'Current OSM details: amenity=toilets.',
          coordinates: [5, 5],
        }),
      ]),
    );

    expect(stops.map((place) => place.name)).toEqual(['Public toilets', 'Visitor parking']);
  });

  it('uses tourist-facing copy for practical mapped stops', () => {
    const parking = feature({
      id: 'parking',
      name: 'Visitor parking',
      tags: ['osm-community-parking'],
      notes: 'Current OSM details: amenity=parking.',
    });

    expect(visitorPitch(parking)).toContain('practical place to check before you arrive');
    expect(visitorPitch(parking)).not.toContain('Current OpenStreetMap parking');
  });

  it('surfaces visitor-useful parking details when OSM provides them', () => {
    const parking = feature({
      id: 'parking',
      name: 'Visitor parking',
      tags: ['osm-community-parking'],
      notes:
        'Current OSM details: amenity=parking; parking=surface; capacity=42; capacity:disabled=3; fee=yes; charge=£2 for 2 hours; maxstay=4 hours; payment:cash=yes; payment:contactless_cards=yes.',
    });

    expect(visitorFacts(parking)).toEqual(
      expect.arrayContaining([
        { label: 'Parking type', value: 'Open surface car park' },
        { label: 'Spaces', value: '42' },
        { label: 'Accessible spaces', value: '3' },
        { label: 'Pricing', value: '£2 for 2 hours' },
        { label: 'Max stay', value: '4 hours' },
        { label: 'Payment', value: 'cash, contactless cards' },
      ]),
    );
    expect(visitorDetails(parking).map((detail) => osmDetailLabel(detail.key))).toEqual(
      expect.arrayContaining(['Payment - cash', 'Payment - contactless cards']),
    );
  });

  it('classifies parking prices for free, paid and unknown visitor styling', () => {
    expect(
      parkingPriceStatus(
        feature({
          id: 'free-parking',
          name: 'Free car park',
          tags: ['osm-community-parking'],
          notes: 'Current OSM details: amenity=parking; fee=no; payment_required=no.',
        }),
      ),
    ).toBe('free');
    expect(
      parkingPriceStatus(
        feature({
          id: 'paid-parking',
          name: 'Paid car park',
          tags: ['osm-community-parking'],
          notes: 'Current OSM details: amenity=parking; charge=£2 for 2 hours.',
        }),
      ),
    ).toBe('paid');
    expect(
      parkingPriceStatus(
        feature({
          id: 'mixed-tariff-parking',
          name: 'Marina car park',
          tags: ['osm-community-parking'],
          notes:
            'Current-place curation: amenity=parking; price_display=First hour free, £3 per hour thereafter; payment_required=yes.',
        }),
      ),
    ).toBe('paid');
    expect(
      parkingPriceStatus(
        feature({
          id: 'unknown-parking',
          name: 'Unknown car park',
          tags: ['osm-community-parking'],
          notes: 'Current OSM details: amenity=parking.',
        }),
      ),
    ).toBe('unknown');
  });

  it('keeps authoritative parking fee evidence ahead of a later check-signs note', () => {
    const publicationSource: SourceRecord = {
      sourceName: 'Townscape Guides publication curation',
      sourceOrganisation: 'Townscape Guides',
      accessedAt: '2026-08-09',
      reliability: 'secondary',
      notes:
        'Current-place curation: price_display=Check signs; payment_required=unknown; review_note=No defensible current tariff was available.',
    };

    expect(
      parkingPriceStatus(
        feature({
          id: 'free-with-stale-note',
          name: 'Park car park',
          tags: ['osm-community-parking'],
          sourceRecords: [
            currentSource('amenity=parking; fee=no; payment_required=no; price_display=Free'),
            publicationSource,
          ],
        }),
      ),
    ).toBe('free');

    expect(
      parkingPriceStatus(
        feature({
          id: 'paid-with-stale-note',
          name: 'Town-centre car park',
          tags: ['osm-community-parking'],
          sourceRecords: [
            currentSource('amenity=parking; fee=yes; charge=£2 for 2 hours'),
            publicationSource,
          ],
        }),
      ),
    ).toBe('paid');
  });

  it('surfaces visitor-useful attraction details when OSM provides them', () => {
    const attraction = feature({
      id: 'museum',
      name: 'Town Museum',
      tags: ['service-context-heritage'],
      notes:
        'Current-place curation: tourism=museum; opening_hours=Tu-Sa 10:00-16:00; fee=yes; entrance_fee=£5; wheelchair=limited; toilets=yes; website=https://example.com.',
    });

    expect(visitorFacts(attraction)).toEqual(
      expect.arrayContaining([
        { label: 'Opening times', value: 'Tu-Sa 10:00-16:00' },
        { label: 'Price', value: '£5' },
        { label: 'Accessibility', value: 'Limited' },
        { label: 'Toilets', value: 'Yes' },
      ]),
    );
    expect(visitorDetails(attraction).map((detail) => osmDetailLabel(detail.key))).toEqual(
      expect.arrayContaining([
        'Opening hours',
        'Entry price',
        'Accessibility',
        'Toilets',
        'Website',
      ]),
    );
  });

  it('does not show historic-date facts for curated current food records', () => {
    const cafe = feature({
      id: 'cafe-obscura',
      name: 'Cafe Obscura',
      tags: ['service-context-food'],
      sourceRecords: [
        {
          sourceName: 'Cafe Obscura visitor curation',
          sourceOrganisation: 'Test visitor source',
          sourceUrl: 'https://example.com/cafe',
          accessedAt: '2026-08-02',
          reliability: 'secondary',
          notes:
            'Current-place curation: amenity=cafe; cuisine=coffee_tea_cakes; price_band=£; opening_hours:description=April to mid-October.',
        },
      ],
    });

    expect(visitorFacts(cafe)).toEqual(
      expect.arrayContaining([
        { label: 'Place type', value: 'Cafe' },
        { label: 'Price guide', value: '£' },
      ]),
    );
    expect(visitorFacts(cafe).map((fact) => fact.label)).not.toContain('Historic date');
    expect(visitorFacts(cafe).map((fact) => fact.label)).not.toContain('Time to spend');
  });

  it('does not describe curated current visitor highlights as non-attractions', () => {
    const museum = feature({
      id: 'museum',
      name: 'Town Museum',
      tags: ['service-context-heritage'],
      notes: 'Current-place curation: tourism=museum; website=https://example.com.',
    });

    expect(visitorPitch(museum)).toContain('easy museum stop while exploring the town');
    expect(visitorPitch(museum)).not.toContain('not as a historic attraction');
    expect(visitorPitch(museum)).not.toContain('inside the town boundary');
  });

  it('splits visitor needs into walks, trails, parks, picnic, parking and toilets', () => {
    const packageData = pkg([
      feature({
        id: 'parking',
        name: 'Visitor parking',
        tags: ['osm-community-parking'],
        notes: 'Current OSM details: amenity=parking.',
      }),
      feature({
        id: 'toilets',
        name: 'Public toilets',
        tags: ['osm-community-amenities'],
        notes: 'Current OSM details: amenity=toilets.',
      }),
      feature({
        id: 'viewpoint',
        name: 'Hill viewpoint',
        tags: ['osm-community-nature'],
        notes: 'Current OSM details: tourism=viewpoint.',
      }),
      feature({
        id: 'walk',
        name: 'Riverside Walk',
        tags: ['osm-community-nature'],
        notes: 'Current OSM details: highway=path.',
      }),
      feature({
        id: 'trail',
        name: 'Test Town Heritage Trail',
        tags: ['service-context-walk'],
        editorialReview: trailReview('https://example.com/test-town-heritage-trail'),
        sourceRecords: [
          {
            sourceName: 'Test Town heritage trail',
            sourceOrganisation: 'Test Town Trust',
            sourceUrl: 'https://example.com/test-town-heritage-trail',
            accessedAt: '2026-08-02',
            reliability: 'secondary',
            notes:
              'Current-place curation: route=heritage_trail; name=Test Town Heritage Trail; visit_score=88; trail_type=Puzzle heritage trail; best_for=Families and local-history fans; distance=2 miles; website=https://example.com/test-town-heritage-trail; time_to_spend=90 minutes; entrance_fee=£10; description=Town trail route and visitor itinerary.',
          },
        ],
      }),
      feature({
        id: 'top-trail',
        name: 'Top-rated Town Trail',
        tags: ['service-context-walk'],
        notes:
          'Current-place curation: route=heritage_trail; visit_score=94; website=https://example.com/top-trail.',
        editorialReview: trailReview('https://example.com/top-trail'),
      }),
      feature({
        id: 'park',
        name: 'Town park',
        tags: ['service-context-park'],
        notes: 'Current OSM details: leisure=park.',
      }),
      feature({
        id: 'playground',
        name: 'Town playground',
        tags: ['osm-community-leisure'],
        notes: 'Current OSM details: leisure=playground.',
      }),
      feature({
        id: 'picnic',
        name: 'Town picnic tables',
        tags: ['osm-community-picnic'],
        notes: 'Current OSM details: leisure=picnic_table.',
      }),
      feature({
        id: 'bench',
        name: 'High Street bench',
        tags: ['osm-community-picnic'],
        notes: 'Current OSM details: amenity=bench.',
      }),
      feature({
        id: 'outside',
        name: 'Outside car park',
        tags: ['osm-community-parking'],
        notes: 'Current OSM details: amenity=parking.',
        coordinates: [5, 5],
      }),
    ]);

    expect(visitorNeedPlaces(packageData, 'parking').map((place) => place.name)).toEqual([
      'Visitor parking',
    ]);
    expect(visitorNeedPlaces(packageData, 'toilets').map((place) => place.name)).toEqual([
      'Public toilets',
    ]);
    expect(visitorNeedPlaces(packageData, 'photo').map((place) => place.name)).toEqual([
      'Hill viewpoint',
    ]);
    expect(visitorNeedPlaces(packageData, 'walk').map((place) => place.name)).toEqual([
      'Hill viewpoint',
      'Riverside Walk',
    ]);
    expect(visitorNeedPlaces(packageData, 'trails')).toEqual([
      expect.objectContaining({
        name: 'Top-rated Town Trail',
        visitorScore: 94,
      }),
      expect.objectContaining({
        name: 'Test Town Heritage Trail',
        externalUrl: 'https://example.com/test-town-heritage-trail',
        admission: '£10',
        freeAdmission: false,
        visitorScore: 88,
      }),
    ]);
    expect(
      visitorNeedPlaces(packageData, 'trails', 5, {
        curatedFeatureIds: ['trail', 'top-trail'],
      }).map((place) => place.name),
    ).toEqual(['Top-rated Town Trail', 'Test Town Heritage Trail']);
    const trail = packageData.features.find((item) => item.id === 'trail');
    expect(trail && visitorFacts(trail)).toEqual(
      expect.arrayContaining([
        { label: 'Trail type', value: 'Puzzle heritage trail' },
        { label: 'Best for', value: 'Families and local-history fans' },
        { label: 'Distance', value: '2 miles' },
        { label: 'Time to spend', value: '90 minutes' },
        { label: 'Price', value: '£10' },
      ]),
    );
    expect(visitorNeedPlaces(packageData, 'parks').map((place) => place.name)).toEqual([
      'Town park',
      'Town playground',
    ]);
    expect(visitorNeedPlaces(packageData, 'picnic').map((place) => place.name)).toEqual([
      'Town picnic tables',
    ]);
    expect(
      visitorNeedPlaces(packageData, 'picnic', 5, {
        curatedFeatureIds: ['bench'],
      }).map((place) => place.name),
    ).toEqual(['High Street bench']);
  });
});
