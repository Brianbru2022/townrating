CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS projects (id text PRIMARY KEY, payload jsonb NOT NULL, published_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS project_packages (id text PRIMARY KEY, payload jsonb NOT NULL, published_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS heritage_features (id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), payload jsonb NOT NULL, geometry geometry(Geometry, 4326));
CREATE INDEX IF NOT EXISTS heritage_features_geometry_gix ON heritage_features USING GIST (geometry);
