-- CULT M0 — enable required PostgreSQL extensions.
-- ADR-0005: PostgreSQL + PostGIS + pg_trgm.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
