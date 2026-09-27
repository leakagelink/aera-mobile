import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

import type { ProviderSlug, ProviderType } from '../../providers/catalog';

const PROVIDERS = ['gemini', 'tomtom', 'openweather', 'osrm', 'nominatim', 'martin'] as const;
const TYPES = ['ai', 'traffic', 'weather', 'routing', 'geocoding', 'map'] as const;

export class CreateProviderDto {
  @IsIn(PROVIDERS)
  provider!: ProviderSlug;

  @IsIn(TYPES)
  providerType!: ProviderType;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  baseUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsInt()
  @Min(1000)
  @Max(30000)
  timeoutMs!: number;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}

export class UpdateProviderDto {
  @IsOptional()
  @IsIn(PROVIDERS)
  provider?: ProviderSlug;

  @IsOptional()
  @IsIn(TYPES)
  providerType?: ProviderType;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(30000)
  timeoutMs?: number;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}

export class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
