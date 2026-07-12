import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { MercadoPagoService } from '../../mercadopago/mercadopago.service';

// Guards run before Pipes in Nest's request lifecycle, so verifying the signature here
// (instead of inside the controller body) guarantees it happens before the global
// ValidationPipe ever inspects the payload.
@Injectable()
export class MercadoPagoWebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(MercadoPagoWebhookSignatureGuard.name);

  constructor(private readonly mercadoPagoService: MercadoPagoService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const dataId: string | undefined =
      request.query?.['data.id'] ?? request.body?.data?.id;
    const xSignature: string | undefined = request.headers['x-signature'];
    const xRequestId: string | undefined = request.headers['x-request-id'];

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
