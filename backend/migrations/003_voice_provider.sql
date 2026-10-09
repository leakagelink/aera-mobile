ALTER TABLE provider_configs DROP CONSTRAINT IF EXISTS provider_configs_provider_type_check;
ALTER TABLE provider_configs ADD CONSTRAINT provider_configs_provider_type_check
  CHECK (provider_type IN ('ai', 'traffic', 'weather', 'routing', 'geocoding', 'map', 'voice'));
