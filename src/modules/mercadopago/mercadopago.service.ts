import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvalidWebhookSignatureError,
  MercadoPagoConfig,
  Preference,
  WebhookSignatureValidator,
} from 'mercadopago';
import type { PreferenceResponse } from 'mercadopago/dist/clients/preference/commonTypes';

export interface MercadoPagoPaymentResponse {
  id: number;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  date_created?: string;
  date_approved?: string;
  external_reference?: string;
}

@Injectable()
export class MercadoPagoService {
  private readonly client: MercadoPagoConfig;
  private readonly preferenceClient: Preference;
  private readonly accessToken: string;
  private readonly webhookSecret: string;
  private readonly backUrl: string;
  private readonly webhookUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.accessToken =
      this.configService.get<string>('mercadoPago.accessToken') ?? '';
    this.webhookSecret =
      this.configService.get<string>('mercadoPago.webhookSecret') ?? '';
    this.backUrl = this.configService.get<string>('mercadoPago.backUrl') ?? '';
    this.webhookUrl =
      this.configService.get<string>('mercadoPago.webhookUrl') ?? '';
    this.client = new MercadoPagoConfig({ accessToken: this.accessToken });
    this.preferenceClient = new Preference(this.client);
  }

  async createPreference(params: {
    title: string;
    amount: number;
    externalReference: string;
    payerEmail?: string;
    backUrlPath: string;
    idempotencyKey?: string;
  }): Promise<PreferenceResponse> {
    return this.preferenceClient.create({
      body: {
        items: [
          {
            id: params.externalReference,
            title: params.title,
            quantity: 1,
            unit_price: params.amount,
            currency_id: 'ARS',
          },
        ],
        payer: params.payerEmail ? { email: params.payerEmail } : undefined,
        external_reference: params.externalReference,
        back_urls: {
          success: this.buildBackUrl(params.backUrlPath),
          failure: this.buildBackUrl(params.backUrlPath),
          pending: this.buildBackUrl(params.backUrlPath),
        },
        auto_return: 'approved',
        // Tell Mercado Pago where to send the payment webhook per-preference, so
        // activation doesn't silently depend on the panel's webhook config being
        // set (and pointing at the `/api`-prefixed path).
        ...(this.webhookUrl ? { notification_url: this.webhookUrl } : {}),
      },
      // Idempotency guarantee from Mercado Pago's side: repeated create calls
      // with the same key (e.g. a double-click or a retry after a network
      // timeout) return the same preference instead of a second one that could
      // be paid independently.
      ...(params.idempotencyKey
        ? { requestOptions: { idempotencyKey: params.idempotencyKey } }
        : {}),
    });
  }

  buildBackUrl(path: string): string {
    return `${this.backUrl}${path}`;
  }

  // Returns null when the payment does not exist (404): a signed webhook can
  // reference an id we can't fetch (e.g. the panel simulator's fake id, or a
  // notification racing ahead of payment visibility). The caller must ACK those
  // with 200 instead of surfacing a 500 that makes Mercado Pago retry forever.
  async getPayment(id: string): Promise<MercadoPagoPaymentResponse | null> {
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${id}`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Mercado Pago payment lookup failed: ${response.status}`);
    }
    return response.json() as Promise<MercadoPagoPaymentResponse>;
  }

  verifyWebhookSignature(params: {
    xSignature: string | string[] | undefined | null;
    xRequestId: string | string[] | undefined | null;
    dataId: string | string[] | undefined | null;
  }): void {
    try {
      WebhookSignatureValidator.validate({
        xSignature: params.xSignature,
        xRequestId: params.xRequestId,
        dataId: params.dataId,
        secret: process.env.MP_WEBHOOK_SECRET ?? this.webhookSecret,
      });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        throw new UnauthorizedException(
          `[FAIL] Mercado Pago webhook signature: ${error.message}`,
        );
      } else throw error;
    }
  }
}
