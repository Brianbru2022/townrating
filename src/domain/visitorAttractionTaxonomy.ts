export type VisitorAttractionCategory =
  | 'active-and-adventure'
  | 'animal-and-family'
  | 'arts-and-entertainment'
  | 'beach-and-coast'
  | 'general-attraction'
  | 'lake-and-waterside'
  | 'museum-and-gallery'
  | 'outdoor-and-nature'
  | 'visitor-centre'
  | 'water-activity'
  | 'viewpoint-and-landmark';

export interface VisitorAttractionClassification {
  category: VisitorAttractionCategory;
  featureType: string;
  /** Research ordering only. It must never be rendered as a public visit score. */
  candidatePriorityScore: number;
  researchPriority: number;
  defaultDuration: string;
  bestFor: string[];
  descriptionNoun: string;
}

const excludedAccess = /^(?:no|private|permit|residents|customers)$/i;
const unsuitableName = /(?:^|\b)(?:entrance|exit|car park|parking|ticket office|toilets?|memorial(?: bench| garden)?|garden of remembrance|war memorial|butchers?|play area|playground|playing fields?|recreation ground)(?:\b|$)/i;
const unsuitableShortName = /^(?:[a-z]|[a-z]\d|\d[a-z])$/i;
const attractionComponentName = /(?:^(?:block [a-z0-9]+|hut \d+|the mansion|central museum|information point|tourist information(?: centre)?|visitor information centre)$|\bcollections? centre\b)/i;

function hasVisitorEvidence(tags: Record<string, string>): boolean {
  return Boolean(
    tags.website ||
      tags['contact:website'] ||
      tags.wikidata ||
      tags.wikipedia ||
      tags.operator ||
      tags.tourism,
  );
}

function hasIndependentVisitorEvidence(tags: Record<string, string>): boolean {
  return Boolean(
    tags.website ||
      tags['contact:website'] ||
      tags.wikidata ||
      tags.wikipedia ||
      tags.operator ||
      tags.opening_hours,
  );
}

function hasPublicVisitorEvidence(tags: Record<string, string>): boolean {
  return Boolean(
    tags.website ||
      tags['contact:website'] ||
      tags.wikidata ||
      tags.wikipedia ||
      tags.opening_hours,
  );
}

function hasDestinationEvidence(tags: Record<string, string>): boolean {
  return Boolean(
    tags.website ||
      tags['contact:website'] ||
      tags.wikipedia ||
      tags.opening_hours,
  );
}

function withEvidence(base: number, tags: Record<string, string>, maximum = 74): number {
  const evidence = [
    tags.website || tags['contact:website'],
    tags.wikidata || tags.wikipedia,
    tags.opening_hours,
    tags.operator,
  ].filter(Boolean).length;
  return Math.min(maximum, base + Math.min(4, evidence));
}

function result(
  tags: Record<string, string>,
  category: VisitorAttractionCategory,
  featureType: string,
  baseScore: number,
  researchPriority: number,
  defaultDuration: string,
  bestFor: string[],
  descriptionNoun: string,
): VisitorAttractionClassification {
  return {
    category,
    featureType,
    candidatePriorityScore: withEvidence(baseScore, tags),
    researchPriority: researchPriority + (hasVisitorEvidence(tags) ? 5 : 0),
    defaultDuration,
    bestFor,
    descriptionNoun,
  };
}

/**
 * Classifies current OSM places that can broaden a town's visitor offer.
 * Candidate priorities help order research. They are not public ratings: OSM
 * discovers candidates, while an editorial web review awards every visit score.
 */
export function classifyMappedVisitorAttraction(
  tags: Record<string, string>,
): VisitorAttractionClassification | undefined {
  const name = tags.name?.trim();
  if (
    !name ||
    unsuitableName.test(name) ||
    unsuitableShortName.test(name) ||
    excludedAccess.test(tags.access ?? '')
  ) {
    return undefined;
  }
  if (/^(?:yes|true)$/i.test([tags.disused, tags.abandoned, tags.demolished, tags.closed].filter(Boolean).join(' '))) {
    return undefined;
  }
  if (tags.attraction === 'animal' || tags.zoo === 'enclosure' || tags.animal || tags.species) {
    return undefined;
  }
  if (/^(?:hotel|hostel|guest_house|motel|apartment|camp_site|caravan_site|chalet)$/i.test(tags.tourism ?? '')) {
    return undefined;
  }

  if (/^(?:theme_park|zoo|aquarium)$/i.test(tags.tourism ?? '') || tags.leisure === 'water_park') {
    if (
      (/\b(?:area|enclosure)\b/i.test(name) || /^(?:eco |theme )?park$/i.test(name)) &&
      !hasIndependentVisitorEvidence(tags)
    ) {
      return undefined;
    }
    return result(tags, 'animal-and-family', tags.tourism ?? 'water_park', 70, 95, 'Allow 2-4 hours', ['Family days out', 'A substantial attraction'], 'family attraction');
  }
  if (/^(?:amusement_arcade|miniature_golf|bowling_alley|escape_game|trampoline_park|ice_rink)$/i.test(tags.leisure ?? '')) {
    if (
      /^(?:bar|pub|nightclub)$/i.test(tags.amenity ?? '') ||
      (/^(?:arcade|amusements?|crazy golf|mini golf)$/i.test(name) &&
        !hasIndependentVisitorEvidence(tags))
    ) {
      return undefined;
    }
    return result(tags, 'arts-and-entertainment', tags.leisure, 53, 60, 'Allow 45-90 minutes', ['Family entertainment', 'A wet-weather option'], tags.leisure.replaceAll('_', ' '));
  }
  if (
    (/^(?:indoor_play|high_ropes_course)$/i.test(tags.leisure ?? '') ||
      /^(?:axe_throwing|climbing|karting)$/i.test(tags.sport ?? '')) &&
    hasIndependentVisitorEvidence(tags) &&
    /\b(?:activity|adventure|axe|boulder|climb(?:ing)?|high ropes|indoor play|kart(?:ing)?|play centre)\b/i.test(
      name,
    )
  ) {
    return result(tags, 'active-and-adventure', tags.leisure ?? tags.sport, 57, 72, 'Allow 1-2 hours', ['Active days out', 'A bookable experience'], 'activity or adventure venue');
  }
  if (
    (/^(?:swimming_area|swimming_pool)$/i.test(tags.leisure ?? '') ||
      tags.sport === 'swimming') &&
    hasIndependentVisitorEvidence(tags) &&
    /\b(?:lido|open air|outdoor pool)\b/i.test(name)
  ) {
    return result(tags, 'water-activity', tags.leisure ?? 'swimming', 58, 74, 'Allow 1-2 hours', ['Outdoor swimming', 'Active visits'], 'lido or outdoor swimming venue');
  }
  if (
    /^(?:theatre|arts_centre|planetarium)$/i.test(tags.amenity ?? '') &&
    hasPublicVisitorEvidence(tags) &&
    !/\b(?:lecture|school|college)\b/i.test(name)
  ) {
    return result(tags, 'arts-and-entertainment', tags.amenity, 57, 70, 'Allow 1-3 hours, depending on the programme', ['Culture and entertainment', 'A programmed visit'], tags.amenity.replaceAll('_', ' '));
  }
  if (
    (/^(?:museum|gallery)$/i.test(tags.tourism ?? '') || tags.amenity === 'museum') &&
    !attractionComponentName.test(name) &&
    (tags.tourism !== 'gallery' || hasPublicVisitorEvidence(tags)) &&
    (!tags.building || hasPublicVisitorEvidence(tags))
  ) {
    return result(tags, 'museum-and-gallery', tags.tourism ?? 'museum', 66, 85, 'Allow 1-2 hours', ['Collections and exhibitions', 'A focused indoor visit'], tags.tourism === 'gallery' ? 'gallery' : 'museum');
  }
  if (
    tags.tourism === 'information' &&
    /^(?:visitor_centre|office)$/i.test(tags.information ?? '') &&
    /\b(?:forest|heritage|national park|nature reserve|wetlands?)\b/i.test(name)
  ) {
    if (
      /(?:help desk|customer service|guest services|tourist information|information point)/i.test(name) ||
      !hasPublicVisitorEvidence(tags) ||
      /^(?:visitor|information) centre$/i.test(name)
    ) {
      return undefined;
    }
    return result(tags, 'visitor-centre', 'visitor_centre', 55, 65, 'Allow 20-45 minutes', ['Local orientation', 'Trip planning'], 'visitor centre');
  }
  if (tags.natural === 'beach') {
    return result(tags, 'beach-and-coast', 'beach', 61, 78, 'Allow 1-3 hours', ['Coastal scenery', 'Fresh-air time'], 'beach or seafront');
  }
  if (
    tags.man_made === 'lighthouse' ||
    (tags.man_made === 'pier' && /\bpier\b/i.test(name))
  ) {
    return result(tags, 'beach-and-coast', tags.man_made ?? 'waterfront', 56, 72, 'Allow 30-90 minutes', ['Waterfront views', 'Photography'], 'waterfront landmark');
  }
  if (
    tags.leisure === 'water_sports' ||
    (/^(?:boat_rental|boat_sharing)$/i.test(tags.amenity ?? '') &&
      hasIndependentVisitorEvidence(tags)) ||
    (/^(?:marina|slipway)$/i.test(tags.leisure ?? '') &&
      hasIndependentVisitorEvidence(tags) &&
      /\b(?:boat|cruise|trip|tour|adventure|activity|watersport|narrowboat)\b/i.test(name)) ||
    (/^(?:canoe|kayak|paddle|rowing|sailing|surfing|water_ski|wakeboard)$/i.test(
      tags.sport ?? '',
    ) &&
      hasIndependentVisitorEvidence(tags) &&
      !/\b(?:clubs?|association|society)\b/i.test(name) &&
      /\b(?:activity|adventure|boat|canoe|centre|kayak|outdoor|paddle|sail|watersport)\b/i.test(
        name,
      ) &&
      tags.leisure !== 'fitness_centre')
  ) {
    return result(tags, 'water-activity', tags.leisure ?? tags.amenity ?? 'water_sports', 61, 80, 'Allow 1-3 hours', ['Watersports', 'Active visits'], 'watersports or boating venue');
  }
  if (
    tags.natural === 'water' &&
    /^(?:lake|reservoir|lagoon)$/i.test(tags.water ?? '') &&
    (hasIndependentVisitorEvidence(tags) ||
      /^(?:yes|public|permissive)$/i.test(tags.access ?? '') ||
      Boolean(tags.leisure) ||
      /\b(?:boating|country park|nature reserve|visitor)\b/i.test(name))
  ) {
    return result(tags, 'lake-and-waterside', tags.water, 51, 65, 'Allow 45 minutes to 2 hours', ['Waterside scenery', 'Outdoor time'], 'named lake or reservoir');
  }
  if (tags.waterway === 'waterfall' || tags.natural === 'cave_entrance') {
    return result(tags, 'outdoor-and-nature', tags.waterway ?? 'cave', 60, 78, 'Allow 30-90 minutes', ['Natural scenery', 'Outdoor exploring'], tags.waterway === 'waterfall' ? 'waterfall' : 'cave');
  }
  if (/^(?:nature_reserve|garden|park|bird_hide)$/i.test(tags.leisure ?? '')) {
    if (
      tags['garden:type'] === 'community' ||
      tags.shop ||
      tags.historic ||
      tags.heritage ||
      /\b(?:roman fort|castle site|churchyard|memorial)\b/i.test(name)
    ) {
      return undefined;
    }
    const destinationGreenSpace =
      tags.leisure === 'nature_reserve' ||
      hasDestinationEvidence(tags) ||
      /\b(?:country park|botanic|arboretum|nature reserve|heritage garden|formal garden)\b/i.test(name);
    if (!destinationGreenSpace) return undefined;
    return result(tags, 'outdoor-and-nature', tags.leisure, tags.leisure === 'nature_reserve' ? 57 : 53, 68, 'Allow 45 minutes to 2 hours', ['Nature and green space', 'A relaxed outdoor stop'], tags.leisure.replaceAll('_', ' '));
  }
  if (
    tags.tourism === 'viewpoint' ||
    /^(?:observatory|tower)$/i.test(tags.man_made ?? '') ||
    (tags.natural === 'peak' && hasVisitorEvidence(tags))
  ) {
    return result(tags, 'viewpoint-and-landmark', tags.tourism ?? tags.man_made ?? 'viewpoint', 55, 66, 'Allow 20-60 minutes', ['Views and photography', 'A short outdoor stop'], 'viewpoint or landmark');
  }
  if (tags.tourism === 'attraction') {
    if (/^(?:train|wey)$/i.test(name) || !hasPublicVisitorEvidence(tags)) return undefined;
    return result(tags, 'general-attraction', 'attraction', 58, 75, 'Allow 45 minutes to 2 hours', ['A visitor attraction', 'A local day out'], 'visitor attraction');
  }
  if (
    tags.railway === 'preserved' &&
    hasIndependentVisitorEvidence(tags) &&
    /\b(?:heritage|museum|railway|steam)\b/i.test(name)
  ) {
    return result(tags, 'general-attraction', 'heritage railway', 66, 84, 'Allow 1-3 hours', ['Heritage railways', 'A substantial visitor experience'], 'heritage railway');
  }
  if (
    tags.amenity === 'marketplace' &&
    hasVisitorEvidence(tags) &&
    /\b(?:bazaar|fair|market|markets|marketplace)\b/i.test(name)
  ) {
    return result(tags, 'arts-and-entertainment', 'market', 50, 55, 'Allow 30-60 minutes', ['Local character', 'Markets and browsing'], 'market');
  }
  return undefined;
}

export function mappedAttractionDescription(
  name: string,
  locality: string,
  classification: VisitorAttractionClassification,
): string {
  const guidance: Partial<Record<VisitorAttractionCategory, string>> = {
    'active-and-adventure': 'adds an active or bookable experience beyond sightseeing',
    'beach-and-coast': 'offers a change of pace by the water',
    'general-attraction': 'adds another distinct experience to the town visit',
    'lake-and-waterside': 'adds waterside scenery and outdoor time',
    'water-activity': 'adds an active boating or watersports option',
    'outdoor-and-nature': 'broadens the visit beyond buildings and historic records',
    'arts-and-entertainment': 'adds entertainment or culture to the town visit',
    'animal-and-family': 'adds a family-focused visitor experience',
    'museum-and-gallery': 'adds collections or exhibitions to explore',
    'visitor-centre': 'helps visitors understand and plan the area',
    'viewpoint-and-landmark': 'offers a visual landmark or rewarding view',
  };
  return `${name} is a mapped ${classification.descriptionNoun} within the active ${locality} visitor boundary and ${guidance[classification.category]}.`;
}
