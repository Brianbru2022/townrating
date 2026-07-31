# Architecture

The React/MapLibre client is public and read-only. A Fastify API provides published project, feature, and geocoder endpoints. PostGIS is the production store; Git-versioned source manifests and import files are validated by CLI before deployment. Country adapters normalise source-specific records into the neutral domain model. The tile and geocoder services are self-hosted operator dependencies.
