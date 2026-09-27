CREATE TABLE provider_configs (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('ai', 'traffic', 'weather', 'routing', 'geocoding', 'map')),
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  api_key_last4 TEXT,
  model TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  timeout_ms INTEGER NOT NULL DEFAULT 10000 CHECK (timeout_ms BETWEEN 1000 AND 30000),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT CHECK (last_test_status IN ('success', 'failure')),
  last_test_message TEXT,
  last_test_latency_ms INTEGER,
  last_success_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX provider_configs_one_default_idx
  ON provider_configs (provider_type)
  WHERE is_default;

CREATE INDEX provider_configs_type_idx ON provider_configs (provider_type, enabled);

CREATE TABLE admin_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY,
  admin_id UUID REFERENCES admin_users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  provider TEXT,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_logs_created_idx ON admin_audit_logs (created_at DESC);
