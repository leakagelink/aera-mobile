CREATE TABLE google_integration (
  id TEXT PRIMARY KEY,
  web_client_id TEXT,
  android_client_id TEXT,
  service_account_encrypted TEXT,
  project_id TEXT,
  client_email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
