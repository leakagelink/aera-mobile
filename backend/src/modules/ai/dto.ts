import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';

class AiLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  accuracy?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(200)
  speed?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  timestamp?: string | null;
}

class AiNavigationDto {
  @IsNumber()
  @Min(0)
  remainingMeters!: number;

  @IsNumber()
  @Min(0)
  remainingSeconds!: number;

  @IsNumber()
  eta!: number;
}

class AiDestinationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;
}

class AiContextDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AiLocationDto)
  location?: AiLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiNavigationDto)
  navigation?: AiNavigationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiDestinationDto)
  destination?: AiDestinationDto;
}

class AiHistoryDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(2000)
  text!: string;
}

export class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AiHistoryDto)
  history?: AiHistoryDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AiContextDto)
  context?: AiContextDto;
}
