import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const verifiedAt = '2026-09-02T20:44:00.000Z';
const reviewDir = resolve('data/review');
const auditFiles = [
  'scotscraig-full-visitor-audit-2026-09-02.json',
  'tayport-full-visitor-audit-2026-09-02.json',
  'rhynd-fife-full-visitor-audit-2026-09-02.json',
  'carrick-leuchars-full-visitor-audit-2026-09-02.json',
  'leuchars-full-visitor-audit-2026-09-02.json',
  'guardbridge-full-visitor-audit-2026-09-02.json',
];

for (const fileName of auditFiles) {
  const path = resolve(reviewDir, fileName);
  const audit = JSON.parse(readFileSync(path, 'utf8'));
  audit.certification.liveBrowserVerifiedAt = verifiedAt;
  writeFileSync(path, `${JSON.stringify(audit, null, 2)}\n`);
}

const summaryPath = resolve(
  reviewDir,
  'scotscraig-guardbridge-sequential-audit-summary-2026-09-02.json',
);
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
summary.liveBrowserVerification = {
  verifiedAt,
  selectorScoresVerified: true,
  plannerCountsVerified: true,
  mapThresholdVerified: true,
  consoleErrors: 0,
  consoleWarnings: 0,
};
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log(`Recorded live browser verification for ${auditFiles.length} sequential audits.`);
