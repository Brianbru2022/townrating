export interface OsmParkingElement {
  type?: 'node' | 'way' | 'relation';
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export type ParkingExclusionReason =
  | 'not-parking'
  | 'restricted-access'
  | 'specialist-parking'
  | 'customer-or-venue-parking'
  | 'generated-or-contextual-name'
  | 'unnamed-without-public-evidence'
  | 'insufficient-public-evidence';

export interface PublicVisitorParkingAssessment {
  include: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  exclusionReason?: ParkingExclusionReason;
}

const restrictedAccess =
  /\b(?:private|customers?|residents?|permit|staff|employees?|delivery|loading|members?|guests?|school|no)\b/i;
const specialistParking =
  /^(?:disabled|garage_boxes|motorcycle|bus|coach|hgv|drop_?off|service|loading)$/i;
const customerVenue =
  /\b(?:retail park|shopping centre|supermarket|shop|tesco|asda|aldi|lidl|morrisons|sainsbury|waitrose|john lewis|co-?op|hotel|pub|bar|restaurant|cafe|coffee|tea room|takeaway|school|college|hospital|infirmary|health centre|medical|surgery|gym|business park|industrial estate|holiday park|caravan park|cinema|stadium|football|golf|club ?house|sports? club|social club|leisure centre|church|chapel|mosque|synagogue|temple|community centre|village hall|county hall|office|travel hub|salvation army)\b/i;
const publicOperator =
  /\b(?:council|borough|city|county|district|local authority|national trust|english heritage|forestry|rspb|wildlife trust|network rail|transport|country park)\b/i;
const publicAccess = /^(?:yes|public|permissive)$/i;
const feeEvidence = /^(?:yes|no|free|ticket|pay_and_display|donation)$/i;
const visitorParkingName = /\b(?:car ?park|parking|park\s*(?:&|and)\s*ride)\b/i;
const genericParkingName = /^(?:public\s+)?(?:car\s*park|parking)$/i;
const generatedParkingName = /\b(?:car\s*park|parking)\s+\d+$/i;
const contextualParkingName = /^public\s+car\s*park\s+near\b/i;
const restrictedUseName =
  /\b(?:staff|employees?|residents?|permit holders?|disabled(?: parking)?|coach(?: parking| park)?|bus(?: parking| park)?|lorry(?: parking| park)?|hgv(?: parking| park)?|drop[- ]?off|pick[- ]?up|loading|delivery)\b/i;
const nonIdentifyingParkingName =
  /^(?:north|south|east|west|area\s+[a-z]?\d+|car\s*park[- ]?[a-z0-9]+(?:\s*\([^)]*\))?|main entrance(?: car park)?|short stay(?: car park)?|visitor parking)$/i;

function value(tags: Record<string, string>, key: string): string {
  return tags[key]?.trim() ?? '';
}

function parkingTags(
  elementOrTags: OsmParkingElement | Record<string, string>,
): Record<string, string> {
  const possibleTags = (elementOrTags as OsmParkingElement).tags;
  return possibleTags && typeof possibleTags === 'object'
    ? possibleTags
    : (elementOrTags as Record<string, string>);
}

export function assessPublicVisitorParking(
  elementOrTags: OsmParkingElement | Record<string, string>,
): PublicVisitorParkingAssessment {
  const tags = parkingTags(elementOrTags);
  if (value(tags, 'amenity') !== 'parking') {
    return {
      include: false,
      confidence: 'high',
      reasons: ['The OSM feature is not tagged as a car park.'],
      exclusionReason: 'not-parking',
    };
  }

  const lifecycleEvidence = `${value(tags, 'operational_status')} ${value(tags, 'disused')} ${value(tags, 'abandoned')} ${value(tags, 'closed')}`;
  if (/\b(?:closed|yes|true|demolished)\b/i.test(lifecycleEvidence)) {
    return {
      include: false,
      confidence: 'high',
      reasons: [`Inactive parking evidence: ${lifecycleEvidence.trim()}.`],
      exclusionReason: 'not-parking',
    };
  }

  const accessEvidence = `${value(tags, 'access')} ${value(tags, 'access:conditional')} ${value(tags, 'parking')}`;
  if (restrictedAccess.test(accessEvidence)) {
    return {
      include: false,
      confidence: 'high',
      reasons: [`Restricted-use evidence: ${accessEvidence.trim()}.`],
      exclusionReason: 'restricted-access',
    };
  }
  if (specialistParking.test(value(tags, 'parking'))) {
    return {
      include: false,
      confidence: 'high',
      reasons: [`Specialist parking type: ${value(tags, 'parking')}.`],
      exclusionReason: 'specialist-parking',
    };
  }

  const name = value(tags, 'name');
  if (value(tags, 'townscape:generated_name') === 'yes' || contextualParkingName.test(name)) {
    return {
      include: false,
      confidence: 'high',
      reasons: [`${name || 'This parking feature'} has an inferred contextual label rather than a verified car-park name.`],
      exclusionReason: 'generated-or-contextual-name',
    };
  }
  if (restrictedUseName.test(name)) {
    return {
      include: false,
      confidence: 'high',
      reasons: [`${name} is restricted or specialist parking rather than general visitor parking.`],
      exclusionReason: 'restricted-access',
    };
  }
  const hasMeaningfulName = Boolean(
    name &&
      !genericParkingName.test(name) &&
      !generatedParkingName.test(name) &&
      !nonIdentifyingParkingName.test(name),
  );
  const operator = value(tags, 'operator');
  const venueEvidence = `${name} ${value(tags, 'townscape:display_name')} ${operator} ${value(tags, 'brand')}`;
  const hasPublicOperator =
    publicOperator.test(operator) ||
    /^(?:public|government|council|local_authority)$/i.test(value(tags, 'operator:type')) ||
    /\bCC\b/.test(operator);
  if (customerVenue.test(venueEvidence)) {
    return {
      include: false,
      confidence: 'high',
      reasons: [`The name or operator identifies venue/customer parking: ${venueEvidence.trim()}.`],
      exclusionReason: 'customer-or-venue-parking',
    };
  }

  const hasPublicAccess = publicAccess.test(value(tags, 'access'));
  const hasSourceBackedPublicUse = value(tags, 'townscape:source_backed_public') === 'yes';
  const hasFeeEvidence = feeEvidence.test(value(tags, 'fee'));
  const hasCapacity = /^\d+$/.test(value(tags, 'capacity'));
  const hasVisitorName = visitorParkingName.test(name);
  const reasons: string[] = [];
  if (hasPublicOperator) reasons.push(`Public operator: ${operator}.`);
  if (hasPublicAccess) reasons.push(`Public access: ${value(tags, 'access')}.`);
  if (hasFeeEvidence) reasons.push(`Fee evidence: ${value(tags, 'fee')}.`);
  if (hasCapacity) reasons.push(`Mapped capacity: ${value(tags, 'capacity')}.`);
  if (hasVisitorName) reasons.push(`Visitor-parking name: ${name}.`);

  if (!hasMeaningfulName) {
    return {
      include: false,
      confidence: 'high',
      reasons: ['Unnamed, generic or generated parking geometry is not an identifiable visitor car park.'],
      exclusionReason: 'unnamed-without-public-evidence',
    };
  }

  const isRoadsideFragment = /^(?:street_side|lane|layby)$/i.test(value(tags, 'parking'));
  if (isRoadsideFragment && !hasPublicOperator && !hasSourceBackedPublicUse) {
    return {
      include: false,
      confidence: 'high',
      reasons: [`${name} is a roadside parking fragment without authoritative visitor-use evidence.`],
      exclusionReason: 'insufficient-public-evidence',
    };
  }

  if (hasPublicOperator || hasSourceBackedPublicUse || (hasPublicAccess && hasMeaningfulName)) {
    return { include: true, confidence: hasPublicOperator ? 'high' : 'medium', reasons };
  }

  return {
    include: false,
    confidence: 'high',
    reasons: [`${name} lacks evidence that it is a general public visitor car park.`],
    exclusionReason: 'insufficient-public-evidence',
  };
}

export function publicParkingEvidenceScore(element: OsmParkingElement): number {
  const tags = element.tags ?? {};
  let score = 0;
  if (publicOperator.test(value(tags, 'operator'))) score += 8;
  if (publicAccess.test(value(tags, 'access'))) score += 5;
  if (feeEvidence.test(value(tags, 'fee'))) score += 3;
  if (/^\d+$/.test(value(tags, 'capacity'))) score += 2;
  if (visitorParkingName.test(value(tags, 'name'))) score += 2;
  if (value(tags, 'website')) score += 1;
  return score;
}

export function normalisedParkingName(name: string): string {
  return name
    .toLocaleLowerCase('en-GB')
    .replace(/\b(?:public\s+)?car\s*park\b/g, '')
    .replace(/\bparking\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
