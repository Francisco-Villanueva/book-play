import {
  Body,
  Controller,
  HttpCode,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { MercadoPagoWebhookDto } from './dto/mercadopago-webhook.dto';
import { WebhookService } from './webhook.service';
import { MercadoPagoWebhookSignatureGuard } from './guards/mercadopago-webhook-signature.guard';
@ApiTags('webhooks')
@Controller('webhooks/mercadopago')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(200)
  // Sin cuota a propósito: Mercado Pago reintenta y puede mandar ráfagas, y todas
  // llegan desde el mismo puñado de IPs suyas. Limitarlas sería descartar avisos
  // de pago legítimos — la firma HMAC del guard de abajo ya es el control de
  // acceso, y la idempotencia por `mp_payment_id` cubre el reintento.
  @SkipThrottle()
  @UseGuards(MercadoPagoWebhookSignatureGuard)
  // Overrides the app-wide `forbidNonWhitelisted` pipe: Mercado Pago's webhook payload
  // has varied between API versions, and an unrecognized field must not cause every
  // retry of a legitimate, signed webhook to be silently rejected with a 400.
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  )
  @ApiOperation({
    summary: 'Mercado Pago webhook (payment)',
  })
  async handle(
    @Query('data.id') dataIdQuery: string | undefined,
    @Body() body: MercadoPagoWebhookDto,
  ) {
    // Non-payment notifications (e.g. merchant_order) are ACKed by the guard without a
    // signature check and reach here with no usable id; we take no action on them.
    const dataId = dataIdQuery ?? body.data?.id;
    if (body.type === 'payment' && dataId) {
      await this.webhookService.process({ type: body.type, dataId });
    }
    return { received: true };
  }
}
