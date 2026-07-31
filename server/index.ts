import cors from '@fastify/cors';
import Fastify, { type FastifyReply } from 'fastify';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { featureTimelineState } from '../src/domain/timeline';
import { sortPublishedProjects } from '../src/domain/projects';
import { createProjectRepository } from './repository';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
const repository = await createProjectRepository();
const hesDesignationsExportUrl =
  'https://inspire.hes.scot/arcgis/rest/services/HES/HES_Designations/MapServer/export';
const localMapPackages = new Set([
  'nls-alloa-os-25-inch-1900',
  'nls-alloa-os-25-inch-1900-draft',
  'nls-alloa-os-25-inch-1900-mosaic-draft',
  'nls-alva-os-25-inch-1900-mosaic-draft',
  'nls-culross-os-25-inch-1896-mosaic-draft',
  'nls-kincardine-os-25-inch-1896-mosaic-draft',
  'nls-tillicoultry-os-25-inch-1900-mosaic-draft',
  'nls-alva-os-25-inch-1900',
  'nls-culross-os-25-inch-1896',
  'nls-kincardine-os-25-inch-1896',
]);
const localMapDatabases = new Map<string, DatabaseSync>();

function localMapDatabase(packageId: string): DatabaseSync | undefined {
  if (!localMapPackages.has(packageId)) return undefined;
  const existing = localMapDatabases.get(packageId);
  if (existing) return existing;
  const filename = resolve('data/runtime/tiles', `${packageId}.mbtiles`);
  if (!existsSync(filename)) return undefined;
  const database = new DatabaseSync(filename, { readOnly: true });
  localMapDatabases.set(packageId, database);
  return database;
}

function isWebMercatorBbox(value: string): boolean {
  const parts = value.split(',').map(Number);
  return (
    parts.length === 4 &&
    parts.every(Number.isFinite) &&
    parts.every((coordinate) => Math.abs(coordinate) <= 20037509)
  );
}
function tileBbox(z: number, x: number, y: number): string | undefined {
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 22)
    return undefined;
  const tiles = 2 ** z;
  if (x < 0 || y < 0 || x >= tiles || y >= tiles) return undefined;
  const edge = 20_037_508.342789244;
  const size = (edge * 2) / tiles;
  return `${-edge + x * size},${edge - (y + 1) * size},${-edge + (x + 1) * size},${edge - y * size}`;
}
async function hesDesignationImage(bbox: string, reply: FastifyReply) {
  const upstream = new URL(hesDesignationsExportUrl);
  upstream.search = new URLSearchParams({
    bbox,
    bboxSR: '3857',
    imageSR: '3857',
    size: '256,256',
    format: 'png32',
    transparent: 'true',
    layers: 'show:0,2,5,7',
    f: 'image',
  }).toString();
  const response = await fetch(upstream, { headers: { Accept: 'image/png' } });
  if (!response.ok)
    return reply.code(502).send({ message: 'Historic Environment Scotland map service failed.' });
  reply.header('Content-Type', response.headers.get('content-type') ?? 'image/png');
  reply.header('Cache-Control', 'public, max-age=3600');
  return reply.send(Buffer.from(await response.arrayBuffer()));
}

app.get('/health', async () => ({ status: 'ok' }));
app.get('/api/hes-designations', async (request, reply) => {
  const { bbox = '' } = request.query as { bbox?: string };
  if (!isWebMercatorBbox(bbox))
    return reply.code(400).send({ message: 'A valid Web Mercator bbox is required.' });

  return hesDesignationImage(bbox, reply);
});
app.get('/api/hes-designations/:z/:x/:y.png', async (request, reply) => {
  const { z, x, y } = request.params as { z: string; x: string; y: string };
  const bbox = tileBbox(Number(z), Number(x), Number(y));
  if (!bbox) return reply.code(400).send({ message: 'A valid Web Mercator tile is required.' });
  return hesDesignationImage(bbox, reply);
});
app.get('/api/local-historic-maps/:packageId/:z/:x/:y.png', async (request, reply) => {
  const { packageId, z, x, y } = request.params as {
    packageId: string;
    z: string;
    x: string;
    y: string;
  };
  const zoom = Number(z);
  const column = Number(x);
  const row = Number(y);
  if (!Number.isInteger(zoom) || !Number.isInteger(column) || !Number.isInteger(row) || zoom < 0)
    return reply.code(400).send({ message: 'A valid tile coordinate is required.' });
  const database = localMapDatabase(packageId);
  if (!database)
    return reply.code(404).send({ message: 'The requested local historic map package is unavailable.' });
  const tmsRow = 2 ** zoom - row - 1;
  const tile = database
    .prepare('SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?')
    .get(zoom, column, tmsRow) as { tile_data?: Uint8Array } | undefined;
  if (!tile?.tile_data) return reply.code(204).send();
  reply.header('Content-Type', 'image/png');
  reply.header('Cache-Control', 'public, max-age=31536000, immutable');
  return reply.send(Buffer.from(tile.tile_data));
});
app.get('/api/projects', async () => {
  const projects = sortPublishedProjects(await repository.list());
  const packages = await Promise.all(projects.map((project) => repository.get(project.id)));
  return projects.map((project, index) => ({
    ...project,
    featureCount: packages[index]?.features.length,
  }));
});
app.get('/api/projects/:id/exports/listed-buildings.csv', async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const project = await repository.get(id);
  if (!project) return reply.code(404).send({ message: 'Published project not found.' });
  const filename = resolve('data/exports', `${id}-listed-buildings.csv`);
  if (!existsSync(filename))
    return reply.code(404).send({ message: 'Listed-building export has not been generated yet.' });
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="${id}-listed-buildings.csv"`);
  reply.header('Cache-Control', 'no-cache');
  return reply.send(await readFile(filename));
});
app.get('/api/projects/:id/exports/undated-heritage-review.csv', async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const project = await repository.get(id);
  if (!project) return reply.code(404).send({ message: 'Published project not found.' });
  const filename = resolve('data/exports', `${id}-undated-heritage-review.csv`);
  if (!existsSync(filename))
    return reply.code(404).send({ message: 'Undated heritage-review export has not been generated yet.' });
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="${id}-undated-heritage-review.csv"`);
  reply.header('Cache-Control', 'no-cache');
  return reply.send(await readFile(filename));
});
app.get('/api/projects/:id', async (request, reply) => {
  const project = await repository.get((request.params as { id: string }).id);
  return project ?? reply.code(404).send({ message: 'Published project not found.' });
});
app.get('/api/projects/:id/features', async (request, reply) => {
  const project = await repository.get((request.params as { id: string }).id);
  if (!project) return reply.code(404).send({ message: 'Published project not found.' });
  const { year, includePossible = 'true' } = request.query as {
    year?: string;
    includePossible?: string;
  };
  const features = year
    ? project.features.filter((feature) => {
        const state = featureTimelineState(feature, Number(year));
        return state === 'definite' || (includePossible === 'true' && state === 'possible');
      })
    : project.features;
  return {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      type: 'Feature',
      geometry: feature.geometry,
      properties: feature,
    })),
  };
});
app.get('/api/geocode', async (request) => {
  const { q = '' } = request.query as { q?: string };
  const search = q.trim().toLocaleLowerCase();
  const projects = sortPublishedProjects(await repository.list());
  return projects
    .filter(
      (project) =>
        project.name.toLocaleLowerCase().includes(search) ||
        project.locality.toLocaleLowerCase().includes(search),
    )
    .map((project) => ({
      label: `${project.locality}, ${project.region ?? project.country}`,
      centre: project.centre,
      projectId: project.id,
    }));
});
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' });
