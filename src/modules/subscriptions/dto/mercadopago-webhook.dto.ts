import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class MercadoPagoWebhookDataDto {
  @IsString()
  id: string;
}

export class MercadoPagoWebhookDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsBoolean()
  live_mode?: boolean;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  date_created?: string;

  @IsOptional()
  @IsNumber()
  user_id?: number;

  @IsOptional()
  @IsString()
  api_version?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @ValidateNested()
  @Type(() => MercadoPagoWebhookDataDto)
  data: MercadoPagoWebhookDataDto;
}
