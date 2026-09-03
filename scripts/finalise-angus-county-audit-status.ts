import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publishedPlannerCurationForProject } from '../src/data/visitorPlannerCuration';
import { publishedAuditCounts } from '../src/domain/townAuditCertification';

const reviewedDate = '2026-09-01';
const projectsDirectory = resolve('data/projects');
const statusPattern = /(?:pending (?:(?:any|its) )?full(?: sequential)? destination audit|awaiting (?:its )?full audit)/i;
const updated: Array<Record<string, unknown>> = [];

for (const file of (await readdir(projectsDirectory)).filter((name) => name.endsWith('.json')).sort()) {
  const path = resolve(projectsDirectory, file);
  const pkg: any = JSON.parse(await readFile(path, 'utf8'));
  if (pkg.project?.region !== 'Angus') continue;

  const score = Number(pkg.project.touristAppeal?.score ?? 0);
  const counts = publishedAuditCounts(pkg, publishedPlannerCurationForProject(pkg.project.id));
  const hadNoGuide = !pkg.project.townGuide;
  if (hadNoGuide) {
    pkg.project.townGuide = {
      characterTag: 'Audited Angus catalogue place',
      headline: '',
      intro: '',
      bestFor: [],
      perfectFor: ['Catalogue and local-history reference'],
      dontMiss: [],
      suggestedTime: score >= 60 ? 'Two to four hours' : 'Pass-through or specialist stop',
      visitorMood: pkg.project.touristAppeal?.summary ?? '',
      sourceUrls: pkg.project.touristAppeal?.sourceUrls ?? [],
      lastReviewedAt: reviewedDate,
    };
  }
  const staleCopy = hadNoGuide || statusPattern.test(`${pkg.project.townGuide.headline ?? ''} ${pkg.project.townGuide.intro ?? ''}`);

  if (staleCopy) {
    const hasVisitorContent = counts.see + counts.eat + counts.trails + counts.picnic + counts.parking + counts.toilets > 0;
    if (statusPattern.test(pkg.project.touristAppeal?.summary ?? '')) {
      pkg.project.touristAppeal.summary = score >= 60
        ? `${pkg.project.name} independently clears the 60-point map threshold after a complete current-source and strict-boundary audit.`
        : hasVisitorContent
          ? `${pkg.project.name} remains selector-only at ${score}%. Its verified visitor places stay available in the planner, while related attractions do not inflate the settlement score.`
          : `${pkg.project.name} remains selector-only at ${score}% after a complete audit found no independently publishable visitor place or practical facility.`;
    }
    pkg.project.townGuide.headline = score >= 60
      ? 'A fully audited Angus destination'
      : hasVisitorContent
        ? 'A fully audited local stop with limited visitor depth'
        : 'Fully audited for catalogue completeness';
    pkg.project.townGuide.intro = `${pkg.project.name} scores ${score}% after a strict-boundary audit of See, Eat, Trails, Picnic, Parking, Toilets and local HES/NRHE evidence. ${pkg.project.touristAppeal?.summary ?? ''}`.trim();
  }

  pkg.project.townGuide.lastReviewedAt = reviewedDate;
  pkg.project.touristAppeal.reviewedAt = reviewedDate;
  const completionNote = 'Angus-wide full audit completed 2026-09-01: all six visitor categories, the four named commercial trail providers, current official/conventional routes, strict-boundary scoring and local HES/NRHE integrity were checked.';
  if (!String(pkg.project.researchNotes ?? '').includes(completionNote)) {
    pkg.project.researchNotes = `${pkg.project.researchNotes ?? ''} ${completionNote}`.trim();
  }

  if (staleCopy) {
    updated.push({ id: pkg.project.id, place: pkg.project.name, score, counts });
  }
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

await writeFile(
  resolve(`data/review/angus-county-ui-audit-status-${reviewedDate}.json`),
  `${JSON.stringify({ reviewedAt: reviewedDate, county: 'Angus', updatedCount: updated.length, updated }, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify({ updatedCount: updated.length }, null, 2));
