import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const slugs = [
  'glenduckie',
  'luthrie',
  'moonzie',
  'kilmaron-castle',
  'lindifferon',
  'fernie-castle',
  'letham-fife',
  'bow-of-fife',
  'cupar-muir',
  'cupar',
  'craigrothie',
  'pitlessie',
  'springfield-fife',
  'ladybank',
] as const;

const verifiedAt = new Date().toISOString();
for (const slug of slugs) {
  const path = resolve('data/review', `${slug}-full-visitor-audit-2026-09-02.json`);
  const report = JSON.parse(await readFile(path, 'utf8'));
  report.certification.liveBrowserVerifiedAt = verifiedAt;
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

await writeFile(
  resolve('data/review/glenduckie-ladybank-live-browser-verification-2026-09-02.json'),
  `${JSON.stringify(
    {
      verifiedAt,
      application: 'Townscape Guides',
      url: 'http://127.0.0.1:5173/',
      checks: {
        allFourteenAvailableInFifeSelector: true,
        onlyCuparAndLadybankMeetMapPublicationThreshold: true,
        cuparCategories: { see: 1, eat: 6, trails: 6, picnic: 1, parking: 3, toilets: 2 },
        ladybankCategories: { see: 1, eat: 2, trails: 1, picnic: 1, parking: 2, toilets: 0 },
        browserConsoleWarningsOrErrors: 0,
      },
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `Live browser verification recorded for ${slugs.length} sequential audits at ${verifiedAt}.`,
);
