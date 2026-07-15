import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class MercadoPagoWebhookDataDto {
  @IsString()
  id: string;
}

export class MercadoPagoWebhookDto {
  // Mercado Pago sends `id`/`user_id` as numbers on real webhooks but as strings
  // from the panel's "Simular notificación" tool; coerce so both validate.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsBoolean()
  live_mode?: boolean;

  // Optional because non-payment notifications (e.g. merchant_order) arrive with a
  // `topic`/`resource` shape and no `type`/`data`; they're ACKed without processing.
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  date_created?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  user_id?: number;

  @IsOptional()
  @IsString()
  api_version?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MercadoPagoWebhookDataDto)
  data?: MercadoPagoWebhookDataDto;
}
