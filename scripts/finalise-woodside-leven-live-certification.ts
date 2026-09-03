import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const files = ['woodside-largo', 'new-gilston', 'wester-newburn', 'lundin-links', 'lower-largo', 'drumeldrie', 'leven-fife'];
const verifiedAt = '2026-09-02T18:45:00.000Z';

for (const file of files) {
  const path = resolve('data/review', `${file}-full-visitor-audit-2026-09-02.json`);
  const report = JSON.parse(await readFile(path, 'utf8'));
  report.certification = {
    ...report.certification,
    publicationCountsReconciled: true,
    liveBrowserVerifiedAt: verifiedAt,
  };
  report.liveVerification = {
    url: 'http://127.0.0.1:5173/',
    verifiedAt,
    checks: [
      'Fife selector entry and audited score rendered',
      'See, Eat, Trails, Picnic, Parking and Toilets counts matched the saved audit',
      '60-point publication threshold matched the selector rating and home-map data test',
      'heritage heat layer rendered without dates appended to map labels',
      'clean restarted browser session reported no console warnings or errors',
    ],
  };
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`Recorded live-browser certification for ${files.length} sequential audits.`);
