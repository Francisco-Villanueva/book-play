import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MercadoPagoService } from '../../mercadopago/mercadopago.service';

// Guards run before Pipes in Nest's request lifecycle, so verifying the signature here
// (instead of inside the controller body) guarantees it happens before the global
// ValidationPipe ever inspects the payload.
@Injectable()
export class MercadoPagoWebhookSignatureGuard implements CanActivate {
  constructor(private readonly mercadoPagoService: MercadoPagoService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const dataId = request.query?.['data.id'] ?? request.body?.data?.id;

    try {
      this.mercadoPagoService.verifyWebhookSignature({
        xSignature: request.headers['x-signature'],
        xRequestId: request.headers['x-request-id'],
        dataId,
      });
    } catch {
      throw new UnauthorizedException('Invalid Mercado Pago webhook signature');
    }

    return true;
  }
}
