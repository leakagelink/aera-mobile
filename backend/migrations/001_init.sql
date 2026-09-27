CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  is_development BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trips (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  moving_seconds DOUBLE PRECISION,
  stopped_seconds DOUBLE PRECISION,
  average_speed_mps DOUBLE PRECISION,
  max_speed_mps DOUBLE PRECISION,
  start_location GEOGRAPHY(POINT, 4326),
  end_location GEOGRAPHY(POINT, 4326),
  planned_route_geometry GEOGRAPHY(LINESTRING, 4326),
  last_known_progress DOUBLE PRECISION,
  origin_name TEXT,
  destination_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX trips_user_started_idx ON trips (user_id, started_at DESC);
CREATE INDEX trips_start_location_gix ON trips USING GIST (start_location);

CREATE TABLE trip_samples (
  id UUID PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  location_geometry GEOGRAPHY(POINT, 4326) NOT NULL,
  CONSTRAINT trip_samples_latitude_chk CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT trip_samples_longitude_chk CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX trip_samples_trip_time_idx ON trip_samples (trip_id, recorded_at);
CREATE INDEX trip_samples_location_gix ON trip_samples USING GIST (location_geometry);

CREATE TABLE routes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  summary TEXT NOT NULL,
  distance_meters DOUBLE PRECISION NOT NULL,
  duration_seconds DOUBLE PRECISION NOT NULL,
  geometry GEOGRAPHY(LINESTRING, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX routes_user_created_idx ON routes (user_id, created_at DESC);
CREATE INDEX routes_geometry_gix ON routes USING GIST (geometry);

CREATE TABLE route_segments (
  id UUID PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  road_name TEXT,
  length_meters DOUBLE PRECISION NOT NULL,
  geometry GEOGRAPHY(LINESTRING, 4326) NOT NULL,
  UNIQUE (route_id, segment_index)
);

CREATE INDEX route_segments_geometry_gix ON route_segments USING GIST (geometry);

CREATE TABLE saved_places (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT saved_places_latitude_chk CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT saved_places_longitude_chk CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX saved_places_user_idx ON saved_places (user_id, created_at DESC);
CREATE INDEX saved_places_location_gix ON saved_places USING GIST (location);

-- Future anonymized road statistics only. No user identifier. Phase 3 does not write this table.
CREATE TABLE road_segment_stats (
  id UUID PRIMARY KEY,
  segment_key TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_bucket SMALLINT NOT NULL CHECK (time_bucket BETWEEN 0 AND 23),
  average_speed_mps DOUBLE PRECISION,
  historical_travel_seconds DOUBLE PRECISION,
  sample_count INTEGER NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
  confidence DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segment_key, day_of_week, time_bucket)
);

INSERT INTO users (id, display_name, is_development)
VALUES ('00000000-0000-4000-8000-000000000001', 'Development user', true);
