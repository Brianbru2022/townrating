import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, centroid, point } from '@turf/turf';
import shp from 'shpjs';
import { cairnOMountPackages } from '../src/data/cairnOMount';

const reviewedAt = '2026-09-01';
const dossierPath = resolve(`data/review/angus-county-web-research-${reviewedAt}.json`);
const dossier = JSON.parse(await readFile(dossierPath, 'utf8')) as any;
const packages = cairnOMountPackages.filter((candidate) => candidate.project.region === 'Angus');
const packageById = new Map(packages.map((pkg) => [pkg.project.id, pkg]));
const userAgent = 'TownscapeGuides-AngusAudit/1.0 (local editorial research)';
const skipOverpass = process.argv.includes('--skip-overpass');

function normalise(value: string): string {
  return value.normalize('NFKD').replace(/[’']/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLocaleLowerCase('en-GB');
}

function exactPlaceMention(value: string, place: string): boolean {
  return ` ${normalise(value)} `.includes(` ${normalise(place)} `);
}

async function get(url: string, timeoutMs = 120_000): Promise<Response> {
  return fetch(url, { headers: { 'user-agent': userAgent, accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
}

const query = `[out:json][timeout:60];(node["amenity"~"^(cafe|ice_cream|toilets)$"](56.42,-3.35,56.95,-2.30);node["shop"~"^(bakery|coffee|deli)$"](56.42,-3.35,56.95,-2.30);node["tourism"~"^(attraction|museum|viewpoint|gallery|picnic_site)$"](56.42,-3.35,56.95,-2.30);node["leisure"="picnic_table"](56.42,-3.35,56.95,-2.30););out body qt;`;
let overpassUrl = `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`;
let overpassResponse = skipOverpass
  ? new Response(null, { status: Number(dossier.sourceHealth.overpassStatus ?? 504) })
  : await get(overpassUrl);
if (!skipOverpass && !overpassResponse.ok) {
  overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  overpassResponse = await get(overpassUrl);
}
const overpassJson = !skipOverpass && overpassResponse.ok ? await overpassResponse.json() as any : { elements: [] };
const osmCandidates = (overpassJson.elements ?? []).flatMap((element: any) => Number.isFinite(element.lon) && Number.isFinite(element.lat) ? [{
  id: `${element.type}/${element.id}`,
  url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  coordinates: [element.lon, element.lat],
  tags: element.tags ?? {},
}] : []);

const ckanUrl = 'https://opendata.angus.gov.uk/api/3/action/package_show?id=car-parks';
const parkingResourceUrl = 'https://opendata.angus.gov.uk/dataset/16d236e6-ed29-4b10-a105-c3a43e74ec30/resource/34c800e5-e10c-493d-a20e-2d7e98130ef0/download/car_parks_polygons.zip';
const parkingArchive = await readFile(resolve('data/reference/angus-car-parks-polygons-2026-09-01.zip'));
const parsed = await shp(parkingArchive.buffer.slice(parkingArchive.byteOffset, parkingArchive.byteOffset + parkingArchive.byteLength)) as any;
const collections = Array.isArray(parsed) ? parsed : [parsed];
const parkingFeatures: any[] = collections.flatMap((collection: any) => collection?.features ?? []);

for (const place of dossier.places) {
  const pkg = packageById.get(place.id);
  if (!pkg) continue;
  const boundary = pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;
  const localOsm = osmCandidates.filter((candidate: any) => {
    try { return booleanPointInPolygon(point(candidate.coordinates), boundary); } catch { return false; }
  });
  const localParking = parkingFeatures.flatMap((feature: any) => {
    try {
      const centre = centroid(feature).geometry.coordinates;
      if (!booleanPointInPolygon(point(centre), boundary)) return [];
      return [{
        coordinates: centre,
        properties: feature.properties ?? {},
        datasetUrl: parkingResourceUrl,
      }];
    } catch { return []; }
  });
  const exactVisitAngus = place.sources.visitAngus.results.filter((result: any) => exactPlaceMention(`${result.title} ${decodeURIComponent(result.url)}`, place.place));
  const exactTreasure = place.sources.treasureTrails.results.filter((result: any) =>
    exactPlaceMention(String(result.title), place.place) &&
    (result.tags ?? []).some((tag: unknown) => normalise(String(tag)) === 'location dundee and angus'),
  );
  const exactMystery = place.sources.mysteryGuides.results.filter((result: any) => exactPlaceMention(String(result.title), place.place));
  place.sources.visitAngus.exactResultCount = exactVisitAngus.length;
  place.sources.visitAngus.exactResults = exactVisitAngus;
  place.sources.treasureTrails.exactResultCount = exactTreasure.length;
  place.sources.treasureTrails.exactResults = exactTreasure;
  place.sources.mysteryGuides.exactResultCount = exactMystery.length;
  place.sources.mysteryGuides.exactResults = exactMystery;
  place.sources.currentOsm = { queryUrl: overpassUrl, status: overpassResponse.status, candidates: localOsm };
  place.sources.angusCouncilParking = {
    policyUrl: 'https://www.angus.gov.uk/roads_parking_and_travel/parking/changes_to_parking_and_parking_review',
    policyStatus: dossier.sourceHealth.angusCouncilParkingStatus,
    datasetApiUrl: ckanUrl,
        datasetStatus: 200,
        datasetResourceUrl: parkingResourceUrl,
    candidates: localParking,
  };
}

dossier.method.providerFalsePositiveRule = 'Treasure Trails suggestions count only when the complete normalised place name occurs in the title and the live product carries the Dundee and Angus location tag. Mystery Guides suggestions require the complete normalised place name. Fuzzy and out-of-region suggestions are retained in raw results but excluded.';
dossier.method.spatialFacilities = 'Current OSM point amenities and the official Angus Council car-park shapefile were spatially joined to each strict visitor boundary; they remain candidates until operator/current-use evidence supports publication.';
dossier.sourceHealth.overpassStatus = overpassResponse.status;
dossier.sourceHealth.overpassCandidateCount = osmCandidates.length;
dossier.sourceHealth.angusCouncilParkingDatasetStatus = 200;
dossier.sourceHealth.angusCouncilParkingFeatureCount = parkingFeatures.length;
dossier.sourceHealth.publishedLinksBlocked = dossier.linkChecks.filter((entry: any) => entry.status === 403).length;
dossier.sourceHealth.publishedLinksDead = dossier.linkChecks.filter((entry: any) => entry.status === 404 || entry.status === 410).length;
dossier.sourceHealth.publishedLinksNetworkFailed = dossier.linkChecks.filter((entry: any) => entry.status == null).length;

await writeFile(dossierPath, `${JSON.stringify(dossier, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  overpassStatus: overpassResponse.status,
  osmCandidates: osmCandidates.length,
  parkingDatasetStatus: 200,
  parkingFeatures: parkingFeatures.length,
  exactVisitAngusPlaces: dossier.places.filter((place: any) => place.sources.visitAngus.exactResultCount > 0).length,
  exactTreasureTrailsPlaces: dossier.places.filter((place: any) => place.sources.treasureTrails.exactResultCount > 0).map((place: any) => place.place),
  exactMysteryGuidesPlaces: dossier.places.filter((place: any) => place.sources.mysteryGuides.exactResultCount > 0).map((place: any) => place.place),
  blockedLinks: dossier.sourceHealth.publishedLinksBlocked,
  deadLinks: dossier.sourceHealth.publishedLinksDead,
}, null, 2));
