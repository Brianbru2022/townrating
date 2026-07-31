import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, HistoricMapLayer, ProjectPackage } from '../src/domain/models';
import { hasHistoricTimelineDate } from '../src/domain/timeline';
import { validateFeatures } from '../src/domain/validation';

const projectPaths = [
  'data/projects/alloa.json',
  'data/projects/alva.json',
  'data/projects/culross.json',
  'data/projects/kincardine.json',
  'data/projects/tillicoultry.json',
  'data/projects/quarriers-village.json',
  'data/projects/biggar.json',
  'data/projects/killin.json',
];
const jsonReportPath = resolve('data/review/published-project-final-audit.json');
const markdownReportPath = resolve('data/review/published-project-final-audit.md');
const hesCrossCheckLayerId = 'hes-listed-buildings-by-category';

function isPublicFeature(feature: HeritageFeature): boolean {
  return feature.evidenceScope !== 'out_of_scope';
}

function isMapHidden(feature: HeritageFeature): boolean {
  return feature.tags.includes('map-hidden') || feature.tags.includes('catalogue-general-view');
}

function isRenderableMap(layer: HistoricMapLayer): boolean {
  return (
    Boolean(layer.tileUrl) &&
    (layer.layerType === 'xyz' ||
      layer.layerType === 'wms' ||
      layer.layerType === 'georeferenced_raster_tiles')
  );
}

function duplicateOfficialReferences(features: HeritageFeature[]) {
  const references = new Map<string, Set<string>>();
  for (const feature of features) {
    const featureReferences = new Set<string>();
    for (const source of feature.sourceRecords) {
      const id = source.sourceRecordId?.trim();
      if (!id || !/^(?:LB|SM|GDL)\d+$/i.test(id)) continue;
      featureReferences.add(id);
    }
    for (const id of featureReferences) {
      references.set(id, new Set([...(references.get(id) ?? []), feature.id]));
    }
  }
  return [...references.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([reference, featureIds]) => ({ reference, featureIds: [...featureIds].sort() }))
    .sort((left, right) => left.reference.localeCompare(right.reference));
}

function byTag(features: HeritageFeature[], tag: string): number {
  return features.filter((feature) => feature.tags.includes(tag)).length;
}

const packages = await Promise.all(
  projectPaths.map(
    async (path) => JSON.parse(await readFile(resolve(path), 'utf8')) as ProjectPackage,
  ),
);

const projects = packages.map((pkg) => {
  const validation = validateFeatures(pkg.project, pkg.features);
  const publicFeatures = pkg.features.filter(isPublicFeature);
  const publicUndated = publicFeatures.filter((feature) => !hasHistoricTimelineDate(feature));
  const noGeometry = publicFeatures.filter((feature) => !feature.geometry);
  const noLicence = publicFeatures.filter((feature) => !feature.licence);
  const sourceUseRestricted = publicFeatures.filter((feature) =>
    feature.tags.includes('source-use-restricted'),
  );
  const mapFeatures = publicFeatures.filter((feature) => feature.geometry && !isMapHidden(feature));
  const historicMaps = pkg.historicMaps.filter((layer) => layer.id !== hesCrossCheckLayerId);
  const selectableHistoricMaps = historicMaps.filter(isRenderableMap);
  const mapLayerIssues = historicMaps
    .filter((layer) => !isRenderableMap(layer) || !layer.licence || !layer.attribution)
    .map((layer) => ({
      id: layer.id,
      title: layer.title,
      reasons: [
        ...(!isRenderableMap(layer) ? ['not configured as a selectable browser overlay'] : []),
        ...(!layer.licence ? ['licence is not recorded'] : []),
        ...(!layer.attribution ? ['attribution is not recorded'] : []),
      ],
    }));
  const validationErrors = validation.filter((item) => item.severity === 'error');
  const validationWarnings = validation.filter((item) => item.severity === 'warning');
  const blockers = [
    ...(validationErrors.length ? [`${validationErrors.length} validation error(s)`] : []),
    ...(noLicence.length ? [`${noLicence.length} public record(s) without a licence`] : []),
  ];

  return {
    projectId: pkg.project.id,
    town: pkg.project.locality,
    region: pkg.project.region,
    status: blockers.length ? 'needs_review' : 'ready_with_known_limitations',
    blockers,
    records: {
      total: pkg.features.length,
      public: publicFeatures.length,
      outOfScope: pkg.features.length - publicFeatures.length,
      relatedContext: publicFeatures.filter(
        (feature) => feature.evidenceScope === 'related_context',
      ).length,
      mapRenderable: mapFeatures.length,
      hiddenCatalogue: publicFeatures.filter(isMapHidden).length,
      historicDateEvidence: publicFeatures.filter(hasHistoricTimelineDate).length,
      publicUndatedReview: publicUndated.length,
      pendingGeometry: noGeometry.length,
      missingLicence: noLicence.length,
      sourceUseRestricted: sourceUseRestricted.length,
      namedDateResearch: byTag(publicFeatures, 'curation-priority-named-site'),
      archaeologyEvidence: byTag(publicFeatures, 'archaeology-evidence'),
    },
    validation: {
      errors: validationErrors,
      warningCount: validationWarnings.length,
    },
    duplicates: {
      officialReferenceCollisions: duplicateOfficialReferences(publicFeatures),
    },
    historicMaps: {
      configured: historicMaps.length,
      selectable: selectableHistoricMaps.map((layer) => ({ id: layer.id, title: layer.title })),
      issues: mapLayerIssues,
    },
    settlementEvidence: {
      publishedPolygons: pkg.settlementPolygons.length,
      pendingGeometryRecords: noGeometry
        .filter((feature) =>
          /settlement|context|area/i.test(`${feature.id} ${feature.locationType}`),
        )
        .map((feature) => feature.id),
    },
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  purpose:
    'Read-only final publication audit. It distinguishes public town records from retained out-of-scope audit records and does not alter curated evidence.',
  completionRule:
    'A project is ready with known limitations when it has no validation errors and every public record has a licence. Pending geometry, undated evidence and unpublished map candidates remain explicit review limitations.',
  projects,
  summary: {
    projects: projects.length,
    readyWithKnownLimitations: projects.filter(
      (project) => project.status === 'ready_with_known_limitations',
    ).length,
    needsReview: projects
      .filter((project) => project.status === 'needs_review')
      .map((project) => project.town),
  },
};

const markdown = [
  '# Published Towns — Final Audit',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  report.purpose,
  '',
  '| Town | Status | Public / total records | Dated | Undated review | Pending geometry | Licence gaps | Selectable historic maps |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...projects.map(
    (project) =>
      `| ${project.town} | ${project.status.replaceAll('_', ' ')} | ${project.records.public} / ${project.records.total} | ${project.records.historicDateEvidence} | ${project.records.publicUndatedReview} | ${project.records.pendingGeometry} | ${project.records.missingLicence} | ${project.historicMaps.selectable.length} |`,
  ),
  '',
  '## Remaining publication limitations',
  '',
  ...projects.flatMap((project) => {
    const items = [
      ...project.blockers,
      ...(project.records.publicUndatedReview
        ? [
            `${project.records.publicUndatedReview} public record(s) still need historic-date review.`,
          ]
        : []),
      ...(project.records.pendingGeometry
        ? [
            `${project.records.pendingGeometry} public record(s) have intentionally pending geometry.`,
          ]
        : []),
      ...(project.records.sourceUseRestricted
        ? [
            `${project.records.sourceUseRestricted} public record(s) are citation-only and do not redistribute source media or text.`,
          ]
        : []),
      ...(project.historicMaps.issues.length
        ? [
            `${project.historicMaps.issues.length} historic-map catalogue item(s) are not publishable overlays.`,
          ]
        : []),
    ];
    return items.length
      ? [`- **${project.town}:** ${items.join(' ')}`]
      : [`- **${project.town}:** no open publication limitation.`];
  }),
  '',
  'The JSON companion lists validation messages, duplicate official-reference checks, map-layer checks and the IDs of context records awaiting geometry.',
  '',
].join('\n');

await mkdir(dirname(jsonReportPath), { recursive: true });
await writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(markdownReportPath, markdown, 'utf8');
console.log(
  `Audited ${projects.length} published town project(s): ${report.summary.readyWithKnownLimitations} ready with known limitations, ${report.summary.needsReview.length} needing review.`,
);
