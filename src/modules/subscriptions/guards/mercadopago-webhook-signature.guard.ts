import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { MercadoPagoService } from '../../mercadopago/mercadopago.service';

interface MercadoPagoWebhookBody {
  type?: string;
  topic?: string;
  data?: { id?: string };
}

// Guards run before Pipes in Nest's request lifecycle, so verifying the signature here
// (instead of inside the controller body) guarantees it happens before the global
// ValidationPipe ever inspects the payload.
@Injectable()
export class MercadoPagoWebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(MercadoPagoWebhookSignatureGuard.name);

  constructor(private readonly mercadoPagoService: MercadoPagoService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as MercadoPagoWebhookBody | undefined;

    // We only act on `payment` notifications. Mercado Pago also emits `merchant_order`
    // (and others) that carry no `data.id` and are signed over a different manifest;
    // since we take no action on them, ACK them (200) instead of failing the signature
    // check and making MP retry a notification we intentionally ignore.
    const notificationType =
      (typeof request.query['type'] === 'string'
        ? request.query['type']
        : undefined) ??
      (typeof request.query['topic'] === 'string'
        ? request.query['topic']
        : undefined) ??
      body?.type ??
      body?.topic;
    if (notificationType !== 'payment') {
      return true;
    }

    // Mercado Pago builds its HMAC manifest from the `data.id` query param, so the
    // signature only matches when we read the id from the same place. The body is a
    // fallback for the legacy shape. Express (qs, allowDots off) exposes the literal
    // key "data.id" — do NOT parse the query JSON.
    const queryDataId = request.query['data.id'];
    const bodyDataId = body?.data?.id;
    const dataId: string | undefined =
      (typeof queryDataId === 'string' ? queryDataId : undefined) ?? bodyDataId;
    const xSignature = request.headers['x-signature'];
    const xRequestId = request.headers['x-request-id'];

    try {
      this.mercadoPagoService.verifyWebhookSignature({
        xSignature,
        xRequestId,
        dataId,
      });
    } catch (error) {
      // UnauthorizedException is an HttpException, so AllExceptionsFilter never logs
      // it — without this, a rejected webhook leaves zero trace in the server logs.
      this.logger.warn(
        `Rejected webhook (dataId=${dataId}, hasSignature=${!!xSignature}, hasRequestId=${!!xRequestId}): ${error instanceof Error ? error.message : error}`,
      );
      throw new UnauthorizedException('Invalid Mercado Pago webhook signature');
    }

    return true;
  }
}
