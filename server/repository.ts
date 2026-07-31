import { Client } from 'pg';
import type { ProjectPackage } from '../src/domain/models';
import { publishedProjectPackages } from '../src/data/publishedProjects';

export interface ProjectRepository {
  list(): Promise<ProjectPackage['project'][]>;
  get(id: string): Promise<ProjectPackage | undefined>;
}
export class StaticProjectRepository implements ProjectRepository {
  async list() {
    return publishedProjectPackages.map((projectPackage) => projectPackage.project);
  }
  async get(id: string) {
    return publishedProjectPackages.find((projectPackage) => projectPackage.project.id === id);
  }
}
export class PostgisProjectRepository implements ProjectRepository {
  constructor(private readonly client: Client) {}
  async list() {
    const result = await this.client.query<{ payload: ProjectPackage['project'] }>(
      'SELECT payload FROM projects ORDER BY published_at DESC',
    );
    return result.rows.map((row) => row.payload);
  }
  async get(id: string) {
    const result = await this.client.query<{ payload: ProjectPackage }>(
      'SELECT payload FROM project_packages WHERE id = $1',
      [id],
    );
    return result.rows[0]?.payload;
  }
}
export async function createProjectRepository(): Promise<ProjectRepository> {
  if (!process.env.DATABASE_URL) return new StaticProjectRepository();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    return new PostgisProjectRepository(client);
  } catch (error) {
    console.warn('PostGIS unavailable; using local starter data.', error);
    await client.end().catch(() => undefined);
    return new StaticProjectRepository();
  }
}
