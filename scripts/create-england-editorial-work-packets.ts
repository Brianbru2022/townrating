import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

type Category = 'see' | 'eat' | 'parking' | 'trails';

interface RecordAudit {
  id: string;
  name: string;
  score?: number;
  evidenceTier: string;
  issues: string[];
}

interface ProjectAudit {
  projectId: string;
  locality: string;
  region: string;
  rating: number;
  issueCount: number;
  records: Record<Category, RecordAudit[]>;
}

interface AuditReport {
  generatedAt: string;
  projects: ProjectAudit[];
}

const categories: Category[] = ['see', 'eat', 'parking', 'trails'];
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function searches(locality: string, region: string, category: Category): string[] {
  const place = `"${locality}" "${region}"`;
  if (category === 'see') {
    return [
      `${place} official tourism things to do attractions`,
      `${place} museums galleries parks gardens visitor attractions`,
      `${place} family attractions nature reserve lake beach watersports theatre`,
      `${place} attraction opening times admission dog policy official`,
    ];
  }
  if (category === 'eat') {
    return [
      `${place} best independent cafes coffee cake lunch official`,
      `${place} cafe brunch lunch opening hours menu official`,
      `${place} cafe dog friendly policy official`,
      `${place} daytime food local tourism guide`,
    ];
  }
  if (category === 'parking') {
    return [
      `${place} council public car parks charges`,
      `${place} car park tariff payment methods maximum stay`,
      `${place} visitor parking official council`,
    ];
  }
  return [
    `${place} heritage trail town trail official`,
    `${place} circular walk walking route official council`,
    `${place} self guided walk art trail nature trail`,
    `${place} treasure trail`,
    `site:treasuretrails.co.uk ${locality}`,
  ];
}

async function latestAuditPath(): Promise<string> {
  const reviewDir = resolve('data/review');
  const files = (await readdir(reviewDir))
    .filter((file) => /^england-editorial-completeness-\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort();
  const latest = files.at(-1);
  if (!latest) throw new Error('Run npm run audit:england-editorial first.');
  return resolve(reviewDir, latest);
}

const requested = new Set(
  (argument('projects') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const limit = Number(argument('limit') ?? 0);
const auditPath = await latestAuditPath();
const audit = JSON.parse(await readFile(auditPath, 'utf8')) as AuditReport;
let projects = audit.projects.filter((project) => requested.size === 0 || requested.has(project.projectId));
if (Number.isFinite(limit) && limit > 0) projects = projects.slice(0, limit);

const packets = projects.map((project) => ({
  projectId: project.projectId,
  locality: project.locality,
  region: project.region,
  rating: project.rating,
  issueCount: project.issueCount,
  editorialRule:
    'OSM and designation records are discovery/evidence only. Publish no score or tourist website until the opened-source editorial assessment is saved on the attraction or food record.',
  categories: Object.fromEntries(
    categories.map((category) => [
      category,
      {
        status: 'research_required',
        searches: searches(project.locality, project.region, category),
        records: project.records[category]
          .filter((record) => record.issues.length > 0)
          .map((record) => ({
            id: record.id,
            name: record.name,
            currentEvidenceTier: record.evidenceTier,
            missingOrUnverified: record.issues,
          })),
        acceptedSources: [],
        rejectedCandidates: [],
        publicationTemplate:
          category === 'see'
            ? {
                visitorWebsiteUrl: null,
                editorialReview: {
                  status: 'editorially_researched',
                  category: 'attraction',
                  methodVersion: '2026-08-13-researched-visitor-value-v1',
                  reviewedAt: 'YYYY-MM-DD',
                  scoreRationale: '',
                  evidenceUrls: [],
                  attractionAssessment: {
                    experienceDepth: '0-30',
                    distinctiveness: '0-20',
                    presentation: '0-20',
                    journeyWorth: '0-15',
                    accessAndReliability: '0-10',
                    evidenceConfidence: '0-5',
                    visitability:
                      'full_visitor_experience | substantial_visible_remains | fragmentary_remains | earthworks_or_site | no_visible_remains | not_applicable',
                  },
                },
              }
            : category === 'eat'
              ? {
                  visitorWebsiteUrl: null,
                  editorialReview: {
                    status: 'editorially_researched',
                    category: 'food',
                    methodVersion: '2026-08-13-researched-visitor-value-v1',
                    reviewedAt: 'YYYY-MM-DD',
                    scoreRationale: '',
                    evidenceUrls: [],
                    foodAssessment: {
                      foodAndDrinkQuality: '0-30',
                      daytimeRelevance: '0-20',
                      distinctiveness: '0-15',
                      consistency: '0-15',
                      visitorFit: '0-10',
                      evidenceConfidence: '0-10',
                    },
                  },
                }
              : category === 'trails'
                ? {
                    visitorWebsiteUrl: null,
                    editorialReview: {
                      status: 'editorially_researched',
                      category: 'trail',
                      methodVersion: '2026-08-13-researched-visitor-value-v1',
                      reviewedAt: 'YYYY-MM-DD',
                      scoreRationale: '',
                      evidenceUrls: [],
                    },
                  }
                : {
                    officialName: '',
                    reviewedAt: 'YYYY-MM-DD',
                    sourceUrls: [],
                    freeOrPaid: 'free | paid | unknown',
                    tariff: null,
                    paymentMethods: [],
                    maximumStay: null,
                  },
        notes: '',
      },
    ]),
  ),
}));

const outputPath = resolve(`data/review/england-editorial-work-packets-${date}.json`);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      sourceAudit: auditPath,
      packetCount: packets.length,
      sourcePriority: [
        'operator or venue',
        'local authority, official destination body or land manager',
        'established specialist or local source',
        'current secondary listing',
        'OSM discovery only',
      ],
      packets,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(JSON.stringify({ outputPath, packetCount: packets.length }, null, 2));
