import {
  Body,
  Controller,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MercadoPagoWebhookDto } from './dto/mercadopago-webhook.dto';
import { MercadoPagoService } from '../mercadopago/mercadopago.service';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Controller('webhooks/mercadopago')
export class WebhookController {
  constructor(
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly webhookService: WebhookService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Mercado Pago webhook (subscription_preapproval, subscription_authorized_payment)' })
  async handle(
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Query('data.id') dataIdQuery: string | undefined,
    @Body() body: MercadoPagoWebhookDto,
  ) {
    const dataId = dataIdQuery ?? body.data?.id;

    try {
      this.mercadoPagoService.verifyWebhookSignature({ xSignature, xRequestId, dataId });
    } catch {
      throw new UnauthorizedException('Invalid Mercado Pago webhook signature');
    }

    await this.webhookService.process({ type: body.type, dataId });
    return { received: true };
  }
}
