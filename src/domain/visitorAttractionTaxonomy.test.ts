import { describe, expect, it } from 'vitest';
import { classifyMappedVisitorAttraction } from './visitorAttractionTaxonomy';

describe('classifyMappedVisitorAttraction', () => {
  it.each([
    [{ name: 'Central Beach', natural: 'beach' }, 'beach-and-coast'],
    [{ name: 'Adventure Island', leisure: 'amusement_arcade' }, 'arts-and-entertainment'],
    [
      { name: 'Town Lake', natural: 'water', water: 'lake', access: 'public' },
      'lake-and-waterside',
    ],
    [
      { name: 'Paddlesports Centre', sport: 'canoe', website: 'https://example.com/paddling' },
      'water-activity',
    ],
    [{ name: 'Wildlife Park', tourism: 'zoo' }, 'animal-and-family'],
    [
      {
        name: 'Riverside Climbing Centre',
        sport: 'climbing',
        website: 'https://example.com/climbing',
      },
      'active-and-adventure',
    ],
    [
      {
        name: 'Town Lido',
        leisure: 'swimming_pool',
        website: 'https://example.com/lido',
      },
      'water-activity',
    ],
  ])('recognises broad visitor category %#', (tags, category) => {
    expect(classifyMappedVisitorAttraction(tags)?.category).toBe(category);
  });

  it('does not publish subordinate animal enclosures as attractions', () => {
    expect(
      classifyMappedVisitorAttraction({
        name: 'Tiger enclosure',
        tourism: 'attraction',
        attraction: 'animal',
      }),
    ).toBeUndefined();
  });

  it('returns a research priority rather than a public visitor score', () => {
    expect(
      classifyMappedVisitorAttraction({
        name: 'Example Theme Park',
        tourism: 'theme_park',
        website: 'https://example.com',
        wikidata: 'Q1',
        opening_hours: 'Mo-Su 10:00-18:00',
        operator: 'Example Operator',
      })?.candidatePriorityScore,
    ).toBe(74);
  });

  it('does not turn an ordinary recreation park into a tourist attraction', () => {
    expect(
      classifyMappedVisitorAttraction({ name: 'Jubilee Recreation Ground', leisure: 'park' }),
    ).toBeUndefined();
  });

  it('does not infer beaches or watersports from business and place names', () => {
    expect(
      classifyMappedVisitorAttraction({ name: 'Reemas Beauty by the Beach', shop: 'beauty' }),
    ).toBeUndefined();
    expect(
      classifyMappedVisitorAttraction({ name: 'Surfleet Primary School', amenity: 'school' }),
    ).toBeUndefined();
  });

  it('excludes generic chain cinemas while retaining destination theatres', () => {
    expect(classifyMappedVisitorAttraction({ name: 'Odeon', amenity: 'cinema' })).toBeUndefined();
    expect(
      classifyMappedVisitorAttraction({
        name: 'Blackfriars Theatre',
        amenity: 'theatre',
        website: 'https://example.com/theatre',
      }),
    ).toMatchObject({ category: 'arts-and-entertainment' });
  });

  it('does not publish ordinary cinemas, playing fields or visitor information counters', () => {
    expect(
      classifyMappedVisitorAttraction({
        name: 'Independent Cinema',
        amenity: 'cinema',
        website: 'https://example.com/cinema',
      }),
    ).toBeUndefined();
    expect(
      classifyMappedVisitorAttraction({ name: 'Jubilee Playing Field', leisure: 'park' }),
    ).toBeUndefined();
    expect(
      classifyMappedVisitorAttraction({
        name: 'Town Tourist Information Centre',
        tourism: 'information',
        information: 'office',
        website: 'https://example.com/information',
      }),
    ).toBeUndefined();
  });

  it('requires public destination evidence for ordinary parks and gardens', () => {
    expect(
      classifyMappedVisitorAttraction({
        name: 'The Lion Garden',
        leisure: 'garden',
        operator: 'Example Business',
      }),
    ).toBeUndefined();
    expect(
      classifyMappedVisitorAttraction({
        name: 'Riverside Gardens',
        leisure: 'garden',
        website: 'https://example.com/garden',
      }),
    ).toMatchObject({ category: 'outdoor-and-nature' });
    expect(
      classifyMappedVisitorAttraction({
        name: 'Chapel Lane Park',
        leisure: 'park',
        wikidata: 'Q1',
      }),
    ).toBeUndefined();
  });

  it('does not treat a pub with an amusement machine tag as a visitor attraction', () => {
    expect(
      classifyMappedVisitorAttraction({
        name: 'Millers',
        amenity: 'pub',
        leisure: 'amusement_arcade',
        website: 'https://example.com/pub',
      }),
    ).toBeUndefined();
  });

  it('rejects sports-club clusters and subordinate museum buildings', () => {
    expect(
      classifyMappedVisitorAttraction({
        name: 'College Boat Clubs',
        sport: 'rowing',
        wikidata: 'Q1',
      }),
    ).toBeUndefined();
    expect(
      classifyMappedVisitorAttraction({
        name: 'Hut 8',
        tourism: 'museum',
        building: 'yes',
        wikipedia: 'en:Hut 8',
      }),
    ).toBeUndefined();
    expect(
      classifyMappedVisitorAttraction({
        name: "County Museums' Collections Centre",
        tourism: 'museum',
        website: 'https://example.com/collections',
      }),
    ).toBeUndefined();
    expect(
      classifyMappedVisitorAttraction({
        name: 'The Drawing Room',
        tourism: 'gallery',
      }),
    ).toBeUndefined();
  });

  it('rejects mis-tagged shops, community gardens and historic park aliases', () => {
    expect(
      classifyMappedVisitorAttraction({
        name: 'Quality Butchers',
        leisure: 'amusement_arcade',
      }),
    ).toBeUndefined();
    expect(
      classifyMappedVisitorAttraction({
        name: 'Unity Garden',
        leisure: 'garden',
        'garden:type': 'community',
        website: 'https://example.com/community',
      }),
    ).toBeUndefined();
    expect(
      classifyMappedVisitorAttraction({
        name: 'King Street Roman Fort',
        leisure: 'park',
        website: 'https://example.com/fort',
      }),
    ).toBeUndefined();
  });

  it('keeps generic OSM attractions out of the family category', () => {
    expect(
      classifyMappedVisitorAttraction({
        name: 'Flag Fen Bronze Age Centre',
        tourism: 'attraction',
        website: 'https://example.com/flag-fen',
      }),
    ).toMatchObject({ category: 'general-attraction' });
  });

  it('requires public evidence for generic OSM attractions', () => {
    expect(
      classifyMappedVisitorAttraction({ name: 'Hedge Circle', tourism: 'attraction' }),
    ).toBeUndefined();
  });

  it('rejects anonymous infrastructure labels', () => {
    expect(classifyMappedVisitorAttraction({ name: 'A', man_made: 'pier' })).toBeUndefined();
  });

  it('does not promote private sports clubs or ordinary named lakes automatically', () => {
    expect(
      classifyMappedVisitorAttraction({
        name: 'Town Rowing Club',
        sport: 'rowing',
        website: 'https://example.com/club',
      }),
    ).toBeUndefined();
    expect(
      classifyMappedVisitorAttraction({ name: 'Fishing Lake', natural: 'water', water: 'lake' }),
    ).toBeUndefined();
  });

  it('keeps visitor markets while rejecting unrelated pop-up businesses', () => {
    expect(
      classifyMappedVisitorAttraction({
        amenity: 'marketplace',
        name: 'Ely Markets',
        website: 'https://example.com/market',
      }),
    ).toMatchObject({ category: 'arts-and-entertainment', featureType: 'market' });
    expect(
      classifyMappedVisitorAttraction({
        amenity: 'marketplace',
        name: 'Little Orange',
        website: 'https://example.com',
      }),
    ).toBeUndefined();
  });
});
