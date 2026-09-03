import { describe, expect, it } from 'vitest';
import { assessPublicVisitorParking } from './publicVisitorParking';

describe('public visitor parking policy', () => {
  it('rejects bare unnamed OSM parking geometry', () => {
    expect(assessPublicVisitorParking({ amenity: 'parking' })).toMatchObject({
      include: false,
      exclusionReason: 'unnamed-without-public-evidence',
    });
  });

  it('rejects private and customer-only car parks', () => {
    expect(
      assessPublicVisitorParking({ amenity: 'parking', name: 'Tesco Car Park', access: 'customers' }),
    ).toMatchObject({ include: false, exclusionReason: 'restricted-access' });
  });

  it('accepts a named council car park with public-use evidence', () => {
    expect(
      assessPublicVisitorParking({
        amenity: 'parking',
        name: 'Newlands Car Park',
        operator: 'West Northamptonshire Council',
        fee: 'no',
      }),
    ).toMatchObject({ include: true, confidence: 'high' });
  });

  it('accepts a meaningful named car park explicitly mapped for public access', () => {
    expect(
      assessPublicVisitorParking({
        amenity: 'parking',
        name: 'Bowen Square',
        access: 'yes',
        parking: 'surface',
      }),
    ).toMatchObject({ include: true, confidence: 'medium' });
  });

  it('does not accept a name alone as proof of public visitor use', () => {
    expect(
      assessPublicVisitorParking({ amenity: 'parking', name: 'Market Square car park' }),
    ).toMatchObject({ include: false, exclusionReason: 'insufficient-public-evidence' });
  });

  it('rejects contextual labels generated from a nearby place', () => {
    expect(
      assessPublicVisitorParking({
        amenity: 'parking',
        name: 'Public car park near Costa',
        access: 'yes',
      }),
    ).toMatchObject({ include: false, exclusionReason: 'generated-or-contextual-name' });
    expect(
      assessPublicVisitorParking({
        amenity: 'parking',
        name: 'Computer Laboratory Cafe car park',
        access: 'yes',
        'townscape:generated_name': 'yes',
      }),
    ).toMatchObject({ include: false, exclusionReason: 'generated-or-contextual-name' });
  });

  it('rejects generated labels and unnamed council-owned geometry', () => {
    expect(
      assessPublicVisitorParking({
        amenity: 'parking',
        name: 'North Daventry car park 16',
        operator: 'West Northamptonshire Council',
      }),
    ).toMatchObject({ include: false, exclusionReason: 'unnamed-without-public-evidence' });
    expect(
      assessPublicVisitorParking({
        amenity: 'parking',
        operator: 'West Northamptonshire Council',
      }),
    ).toMatchObject({ include: false, exclusionReason: 'unnamed-without-public-evidence' });
  });

  it('rejects venue parking even when the polygon has a public operator', () => {
    expect(
      assessPublicVisitorParking({
        amenity: 'parking',
        operator: 'West Northamptonshire Council',
        'townscape:display_name': 'Windser Lodge Tea Room car park',
      }),
    ).toMatchObject({ include: false, exclusionReason: 'customer-or-venue-parking' });
  });

  it('rejects health, leisure and social-club venue parking', () => {
    for (const name of [
      'Health Centre Car Park',
      'Civic and Leisure Centre',
      'Wem Sports and Social Club Car Park',
    ]) {
      expect(
        assessPublicVisitorParking({ amenity: 'parking', name, access: 'yes' }),
      ).toMatchObject({ include: false, exclusionReason: 'customer-or-venue-parking' });
    }
  });

  it('rejects shop, golf-club and clubhouse parking', () => {
    for (const name of [
      'Glebe Green shop car park',
      'Sutton Hall Golf Club',
      'Club House car park',
    ]) {
      expect(
        assessPublicVisitorParking({ amenity: 'parking', name, access: 'permissive' }),
      ).toMatchObject({ include: false, exclusionReason: 'customer-or-venue-parking' });
    }
  });

  it('rejects car parks mapped as closed', () => {
    expect(
      assessPublicVisitorParking({
        amenity: 'parking',
        name: 'Blue Willow Car Park',
        access: 'yes',
        operational_status: 'closed',
      }),
    ).toMatchObject({ include: false, exclusionReason: 'not-parking' });
  });

  it('accepts public access supplied by a reviewed council or operator source', () => {
    expect(
      assessPublicVisitorParking({
        amenity: 'parking',
        name: 'Rollo Park visitor car park',
        access: 'public',
        operator: 'Perth and Kinross Council',
        'townscape:source_backed_public': 'yes',
      }),
    ).toMatchObject({ include: true, confidence: 'high' });
  });

  it('rejects raw roadside fragments and fee tags without general visitor evidence', () => {
    expect(
      assessPublicVisitorParking({
        amenity: 'parking',
        name: 'Cannon Green car park',
        parking: 'lane',
        fee: 'yes',
      }),
    ).toMatchObject({ include: false, exclusionReason: 'insufficient-public-evidence' });
  });

  it('rejects specialist, staff and non-identifying parking names', () => {
    for (const name of [
      'County Hall staff car park',
      'Disabled Parking & Drop off',
      'Coach Parking',
      'Lorry Park',
      'Car Park 2 (North)',
      'Main Entrance Car Park',
    ]) {
      expect(
        assessPublicVisitorParking({ amenity: 'parking', name, access: 'yes' }),
      ).toMatchObject({ include: false });
    }
  });
});
