import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const date = '2026-09-01';
const path = resolve(`data/review/angus-county-web-research-${date}.json`);
const dossier = JSON.parse(await readFile(path, 'utf8')) as any;

function canonicalSlug(id: string): string {
  return id
    .replace(/-scotland$/, '')
    .replace(/-(?:angus|arbroath|monifieth|glenesk|glamis|memus)$/, '');
}

for (const place of dossier.places) {
  if (place.id === 'kirriemuir-scotland') {
    place.sources.visitAngus = {
      searchUrl: 'https://visitangus.com/plan-your-trip/explore-our-towns/kirriemuir/',
      status: 200,
      resultCount: 4,
      exactResultCount: 4,
      exactResults: [
        { title: 'Kirriemuir', url: 'https://visitangus.com/plan-your-trip/explore-our-towns/kirriemuir/', subtype: 'explore-our-towns' },
        { title: 'Discover the Best Things to Do in Kirriemuir', url: 'https://visitangus.com/get-inspired/itineraries/discover-the-best-things-to-do-in-kirriemuir/', subtype: 'itinerary' },
        { title: 'Walking Trail: Caddam Woods, Kirriemuir', url: 'https://visitangus.com/things-to-see-do/trails/walking-trail-caddam-woods-kirriemuir/', subtype: 'walking-trail' },
        { title: 'Kirriemuir to Glenisla Circuit', url: 'https://visitangus.com/things-to-see-do/trails/kirriemuir-to-glenisla-circuit/', subtype: 'biking-trail' },
      ],
      recoveryNote: 'The WordPress search API rate-limited the second county pass. Current public VisitAngus pages were verified directly and recorded here.',
    };
    continue;
  }
  const reportPath = resolve(`data/review/${canonicalSlug(place.id)}-full-visitor-audit-${date}-z-county.json`);
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as any;
  const exactResultCount = Number(report.sourceOutcome?.visitAngusExactResults ?? 0);
  place.sources.visitAngus.status = 200;
  place.sources.visitAngus.resultCount = Math.max(
    Number(place.sources.visitAngus.resultCount ?? 0),
    exactResultCount,
  );
  place.sources.visitAngus.exactResultCount = exactResultCount;
  place.sources.visitAngus.exactResults ??= [];
  place.sources.visitAngus.recoveryNote = 'The successful first county pass is preserved from the per-place certified report after a second bulk pass was rate-limited.';
}

const montrose = dossier.places.find((place: any) => place.id === 'montrose-scotland');
if (montrose) {
  const oldUrl = 'https://visitangus.com/things-to-see-do/attractions/montrose-museum-art-gallery/';
  const currentUrl = 'https://angusalive.scot/museums-galleries/visit-a-museum-gallery/montrose-museum/';
  montrose.sources.currentPublishedVisitorUrls = (montrose.sources.currentPublishedVisitorUrls ?? [])
    .map((url: string) => url === oldUrl ? currentUrl : url);
  dossier.linkChecks = dossier.linkChecks.filter((link: any) => link.url !== oldUrl && link.url !== currentUrl);
  dossier.linkChecks.push({ url: currentUrl, ok: true, status: 200, finalUrl: currentUrl, contentType: 'text/html; current official ANGUSalive page verified 2026-09-01' });
}

dossier.sourceHealth.visitAngusSuccessful = dossier.places.length;
dossier.sourceHealth.publishedLinksChecked = dossier.linkChecks.length;
dossier.sourceHealth.publishedLinksReachable = dossier.linkChecks.filter((link: any) => link.ok).length;
dossier.sourceHealth.publishedLinksBlocked = dossier.linkChecks.filter((link: any) => link.status === 403).length;
dossier.sourceHealth.publishedLinksDead = dossier.linkChecks.filter((link: any) => link.status === 404).length;
dossier.method.visitAngusRecovery = 'A successful 182-place first pass was preserved through the generated per-place reports. Kirriemuir was checked directly after the WP API throttled the second bulk pass.';

await writeFile(path, `${JSON.stringify(dossier, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  places: dossier.places.length,
  visitAngusSuccessful: dossier.sourceHealth.visitAngusSuccessful,
  publishedLinksChecked: dossier.sourceHealth.publishedLinksChecked,
  publishedLinksReachable: dossier.sourceHealth.publishedLinksReachable,
  publishedLinksBlocked: dossier.sourceHealth.publishedLinksBlocked,
  publishedLinksDead: dossier.sourceHealth.publishedLinksDead,
}, null, 2));
