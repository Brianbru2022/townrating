import { Client } from 'pg';
import { publishedProjectPackages } from '../src/data/publishedProjects';
import { validateFeatures } from '../src/domain/validation';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to seed PostGIS.');
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
for (const projectPackage of publishedProjectPackages) {
  const validation = validateFeatures(projectPackage.project, projectPackage.features);
  if (validation.some((result) => result.severity === 'error'))
    throw new Error(`Refusing to seed invalid curated data for ${projectPackage.project.id}.`);
  await client.query(
    'INSERT INTO projects (id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, published_at = now()',
    [projectPackage.project.id, JSON.stringify(projectPackage.project)],
  );
  await client.query(
    'INSERT INTO project_packages (id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, published_at = now()',
    [projectPackage.project.id, JSON.stringify({ ...projectPackage, validation })],
  );
}
await client.end();
console.log(`Seeded ${publishedProjectPackages.length} published project packages.`);
