import type { ProjectPackage } from './models';

const editorialCharacterTags: Record<string, string> = {
  'aberfoyle-scotland': 'Trossachs forest gateway',
  'alloa-scotland': 'Tower and whisky heritage town',
  'alva-scotland': 'Hillfoot mill and glen town',
  'barmouth-abermaw-gwynedd-wales': 'Victorian seaside and harbour town',
  'bathgate-scotland': 'Post-industrial market town',
  'beddgelert-gwynedd-wales': 'Mountain village of legends and trails',
  'biggar-scotland': 'Historic Upper Clydesdale market town',
  'boston-england': 'Historic port and market town',
  'bridge-of-earn-scotland': 'Riverside Perthshire village',
  'broxburn-and-uphall-scotland': 'Canal-side industrial town',
  'caernarfon-gwynedd-wales': 'Royal castle and harbour town',
  'callander-scotland': 'Trossachs gateway and walking town',
  'cambridge-england': 'Historic university city',
  'chirk-clwyd-wales': 'Castle and canal town',
  'cleethorpes-england': 'Traditional seaside resort',
  'coalville-leicestershire-england': 'Industrial mining heritage town',
  'colwyn-bay-clwyd-wales': 'Victorian seaside town',
  'conwy-clwyd-wales': 'Medieval walled castle town',
  'criccieth-gwynedd-wales': 'Castle and seaside town',
  'crowland-england': 'Abbey and Fenland market town',
  'culross-scotland': 'Preserved 17th-century royal burgh',
  'daventry-england': 'Historic market and coaching town',
  'deeping-st-james-england': 'Riverside village with priory roots',
  'denbigh-clwyd-wales': 'Medieval castle and market town',
  'dunning-scotland': 'Historic Perthshire village',
  'ely-england': 'Cathedral city of the Fens',
  'gainsborough-england': 'Trent-side industrial market town',
  'gourock-scotland': 'Victorian Clyde ferry town',
  'grantham-england': 'Historic coaching and market town',
  'grimsby-england': 'Maritime and fishing heritage town',
  'harlech-gwynedd-wales': 'Castle town above Cardigan Bay',
  'higham-ferrers-england': 'Medieval chartered market town',
  'holywell-clwyd-wales': 'Pilgrimage and industrial heritage town',
  'horncastle-england': 'Antiques and market town',
  'huntingdon-england': 'Great Ouse market town',
  'kettering-england': 'Shoe and lace heritage town',
  'killin-scotland': 'Highland village of falls and lochs',
  'kincardine-scotland': 'Forth-side planned port town',
  'kirriemuir-scotland': 'Literary and music heritage town',
  'kirknewton-scotland': 'Rural village with estate heritage',
  'leicester-leicestershire-england': 'Roman city with multicultural heritage',
  'lincoln-england': 'Cathedral city with Roman roots',
  'linlithgow-scotland': 'Royal palace and loch town',
  'livingston-scotland': 'Modern new town with village roots',
  'llangollen-clwyd-wales': 'Dee Valley canal and festival town',
  'loughborough-leicestershire-england': 'Market town of engineering and bells',
  'louth-england': 'Georgian market town beneath the Wolds',
  'mablethorpe-england': 'Traditional family seaside town',
  'march-england': 'Fenland railway and market town',
  'market-bosworth-leicestershire-england': 'Historic battlefield market town',
  'market-deeping-england': 'Riverside market town',
  'market-harborough-leicestershire-england': 'Georgian market town',
  'melton-mowbray-leicestershire-england': 'Market town of food heritage',
  'milton-keynes-england': 'Modernist green city',
  'mold-clwyd-wales': 'Market town beneath the Clwydian Range',
  'northampton-england': 'Historic shoe-making county town',
  'oundle-england': 'Honey-stone market town',
  'peterborough-england': 'Cathedral city on the Fens',
  'porthmadog-gwynedd-wales': 'Slate port and heritage railway town',
  'prestatyn-clwyd-wales': 'Seaside town beneath the Clwydian Range',
  'pwllheli-gwynedd-wales': 'Market and seaside town',
  'quarriers-village-scotland': 'Planned philanthropic village',
  'rhyl-clwyd-wales': 'Traditional North Wales seaside resort',
  'rothwell-northamptonshire-england': 'Medieval market town with a bone crypt',
  'rushden-england': 'Boot-and-shoe heritage town',
  'ruthin-clwyd-wales': 'Red-sandstone market town',
  'scunthorpe-england': 'Steel town with green spaces',
  'skegness-england': 'Traditional Lincolnshire seaside resort',
  'sleaford-england': 'Riverside industrial market town',
  'south-queensferry-scotland': 'Historic Forth bridge and harbour town',
  'spalding-england': 'Fenland town of gardens and waterways',
  'st-asaph-clwyd-wales': 'Small cathedral city',
  'st-ives-england': 'Riverside market town with a medieval bridge',
  'st-neots-england': 'Great Ouse riverside market town',
  'stamford-england': 'Georgian stone market town',
  'strathyre-scotland': 'Trossachs trail village',
  'thrapston-england': 'Nene Valley market town',
  'tillicoultry-scotland': 'Hillfoot mill town beneath the Ochils',
  'torphichen-scotland': 'Medieval preceptory village',
  'towcester-england': 'Roman market town',
  'wellingborough-england': 'Market town with shoe-making roots',
  'whitburn-scotland': 'West Lothian mining heritage town',
  'whittlesey-england': 'Fenland market town with festival traditions',
  'wisbech-england': 'Georgian Fenland port town',
  'woodhall-spa-england': 'Edwardian spa and aviation town',
  'wrexham-clwyd-wales': 'Industrial heritage city with border roots',
};

function projectText(pkg: ProjectPackage): string {
  const project = pkg.project;
  return [
    project.townGuide?.headline,
    project.townGuide?.intro,
    project.townGuide?.visitorMood,
    project.visualIdentity?.theme,
    ...(project.visualIdentity?.motifs ?? []),
    ...(project.visitorHighlights ?? []).slice(0, 5).flatMap((highlight) => [
      highlight.name,
      highlight.tagline,
      highlight.reason,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

function regionalCharacter(pkg: ProjectPackage): string {
  const region = pkg.project.region?.trim();
  if (region && !/unspecified/i.test(region)) return region;
  if (pkg.project.country === 'Wales') return 'Welsh';
  if (pkg.project.country === 'Scotland') return 'Scottish';
  return 'English';
}

function churchVillageCharacter(pkg: ProjectPackage, region: string): string | undefined {
  const highlights = pkg.project.visitorHighlights ?? [];
  const names = highlights.slice(0, 4).map((highlight) => highlight.name.trim());
  const church = names.find((name) => /\b(church|chapel)\b/i.test(name));
  if (!church) return undefined;

  const otherNames = names.filter((name) => name !== church).join(' ');
  if (/barrow|mound|earthwork|hillfort/i.test(otherNames)) {
    return `${region} village of church and earthworks`;
  }
  if (/cross/i.test(otherNames)) return `${region} church-and-cross village`;
  if (/mill|windmill/i.test(otherNames)) return `${region} church-and-mill village`;
  if (/hall|manor|estate/i.test(otherNames)) return `${region} church-and-estate village`;

  const dedication = church
    .replace(/^parish church of\s+/i, '')
    .replace(/^church of\s+/i, '')
    .replace(/^the parish church of\s+/i, '')
    .replace(/\s+(parish )?church$/i, '')
    .trim();
  if (!dedication || dedication.length > 29) return `Historic ${region} church village`;

  const regional = `${region} village with ${dedication} church`;
  return regional.length <= 55 ? regional : `Village with ${dedication} church`;
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

/**
 * Resolve the short editorial subtitle used by the visitor-guide masthead.
 * Researched copy always wins; the classifier keeps every published and future
 * batch-created town covered until an editor supplies a more specific phrase.
 */
export function townCharacterTag(pkg: ProjectPackage): string {
  const supplied = pkg.project.townGuide?.characterTag?.trim();
  if (supplied) return supplied;

  const editorial = editorialCharacterTags[pkg.project.id];
  if (editorial) return editorial;

  const text = projectText(pkg);
  const rating = pkg.project.touristAppeal?.rating ?? 0;
  const region = regionalCharacter(pkg);

  if (has(text, /university|college courts|college chapel/)) return 'Historic university town';
  if (has(text, /cathedral/)) return 'Historic cathedral city';
  if (has(text, /seaside|sea front|seafront|coastal resort|beach|promenade/)) {
    return has(text, /harbour|port|ferry/) ? 'Seaside and harbour town' : 'Traditional seaside town';
  }
  if (has(text, /walled town|town walls/) && has(text, /castle/)) return 'Medieval walled castle town';
  if (has(text, /harbour|historic port|ferry town|ferry-town|waterfront/)) return 'Historic waterfront town';
  if (has(text, /canal|locks?\b|narrowboat/)) return 'Canal-side heritage town';
  if (has(text, /spa town|spa waters|hydrotherapy/)) return 'Historic spa town';
  if (has(text, /mining|colliery|steelworks|ironworks|textile mill|industrial heritage/)) {
    return 'Industrial heritage town';
  }
  if (has(text, /castle/)) return 'Castle and heritage town';
  if (has(text, /market place|market square|market town|charter market|market cross/)) {
    return 'Historic market town';
  }
  if (has(text, /river|riverside|waterside|bridge/)) return 'Riverside heritage town';
  if (has(text, /country house|manor house|estate village|designed landscape/)) {
    return `${region} estate village`;
  }
  if (has(text, /railway|station heritage|railway town/)) return `${region} railway heritage town`;
  if (has(text, /church|chapel|abbey|priory/)) {
    return churchVillageCharacter(pkg, region) ??
      (rating === 0 ? `Quiet ${region} heritage village` : `Historic ${region} village`);
  }
  if (rating >= 3) return 'Major historic destination';
  if (rating === 2) return `Characterful ${region} heritage town`;
  if (rating === 1) return `${region} local heritage town`;
  return `Quiet ${region} village`;
}

export function hasEditorialTownCharacterTag(projectId: string): boolean {
  return projectId in editorialCharacterTags;
}
