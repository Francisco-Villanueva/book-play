import {
  Body,
  Controller,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MercadoPagoWebhookDto } from './dto/mercadopago-webhook.dto';
import { WebhookService } from './webhook.service';
import { MercadoPagoWebhookSignatureGuard } from './guards/mercadopago-webhook-signature.guard';

@ApiTags('webhooks')
@Controller('webhooks/mercadopago')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
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
    const dataId = dataIdQuery ?? body.data?.id;
    await this.webhookService.process({ type: body.type, dataId });
    return { received: true };
  }
}
