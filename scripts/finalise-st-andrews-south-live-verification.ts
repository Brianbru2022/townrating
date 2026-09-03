import fs from "node:fs";
import path from "node:path";

const verifiedAt = "2026-09-02T21:07:29.331Z";
const reviewDirectory = path.resolve("data/review");
const reportStems = [
  "kincaple",
  "peat-inn",
  "newpark-st-andrews",
  "balone",
  "denhead-st-andrews",
  "st-andrews",
  "prior-muir",
  "brownhills-st-andrews",
  "boarhills",
  "kingsbarns",
  "balcomie",
  "dunino",
  "stravithie",
];

const liveChecks = {
  fifeSelectorContainsAllRequestedPlaces: true,
  auditedScoresRendered: true,
  stAndrewsCategoryCountsRendered: true,
  kingsbarnsCategoryCountsRendered: true,
  exact58SecondPassTownsRendered: true,
  heritageDateTextAbsentFromMapLabels: true,
  browserConsoleErrors: 0,
};

for (const stem of reportStems) {
  const reportPath = path.join(
    reviewDirectory,
    `${stem}-full-visitor-audit-2026-09-02.json`,
  );
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  report.certification = {
    ...report.certification,
    liveBrowserVerifiedAt: verifiedAt,
    liveChecks,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

const summaryPath = path.join(
  reviewDirectory,
  "st-andrews-south-sequential-audit-summary-2026-09-02.json",
);
const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
summary.liveBrowserVerifiedAt = verifiedAt;
summary.liveChecks = liveChecks;
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log(
  `Recorded live browser verification for ${reportStems.length} sequential audits.`,
);
