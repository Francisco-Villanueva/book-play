import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MercadoPagoConfig,
  PreApproval,
  PreApprovalPlan,
  WebhookSignatureValidator,
} from 'mercadopago';
import type { PreApprovalResponse } from 'mercadopago/dist/clients/preApproval/commonTypes';
import type { PreApprovalUpdateResponse } from 'mercadopago/dist/clients/preApproval/update/types';
import type { PreApprovalPlanResponse } from 'mercadopago/dist/clients/preApprovalPlan/commonTypes';
import { Plan } from '../plans/entities/plan.model';

export interface AuthorizedPaymentResponse {
  id: string;
  preapproval_id?: string;
  status?: string;
  transaction_amount?: number;
  date_created?: string;
}

@Injectable()
export class MercadoPagoService {
  private readonly client: MercadoPagoConfig;
  private readonly preApprovalPlanClient: PreApprovalPlan;
  private readonly preApprovalClient: PreApproval;
  private readonly accessToken: string;
  private readonly webhookSecret: string;
  private readonly backUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.accessToken = this.configService.get<string>('mercadoPago.accessToken') ?? '';
    this.webhookSecret = this.configService.get<string>('mercadoPago.webhookSecret') ?? '';
    this.backUrl = this.configService.get<string>('mercadoPago.backUrl') ?? '';
    this.client = new MercadoPagoConfig({ accessToken: this.accessToken });
    this.preApprovalPlanClient = new PreApprovalPlan(this.client);
    this.preApprovalClient = new PreApproval(this.client);
  }

  async createPreApprovalPlan(plan: Plan): Promise<PreApprovalPlanResponse> {
    return this.preApprovalPlanClient.create({
      body: {
        reason: plan.name,
        back_url: this.backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.priceArs,
          currency_id: 'ARS',
        },
      },
    });
  }

  async createPreApproval(params: {
    preapprovalPlanId: string;
    payerEmail: string;
    externalReference: string;
    backUrl?: string;
  }): Promise<PreApprovalResponse> {
    return this.preApprovalClient.create({
      body: {
        preapproval_plan_id: params.preapprovalPlanId,
        payer_email: params.payerEmail,
        external_reference: params.externalReference,
        back_url: params.backUrl ?? this.backUrl,
      },
    });
  }

  buildBackUrl(path: string): string {
    return `${this.backUrl}${path}`;
  }

  async getPreApproval(id: string): Promise<PreApprovalResponse> {
    return this.preApprovalClient.get({ id });
  }

  async cancelPreApproval(id: string): Promise<PreApprovalUpdateResponse> {
    return this.preApprovalClient.update({ id, body: { status: 'cancelled' } });
  }

  async getAuthorizedPayment(id: string): Promise<AuthorizedPaymentResponse> {
    const response = await fetch(`https://api.mercadopago.com/authorized_payments/${id}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Mercado Pago authorized_payments lookup failed: ${response.status}`);
    }
    return response.json() as Promise<AuthorizedPaymentResponse>;
  }

  verifyWebhookSignature(params: {
    xSignature: string | string[] | undefined | null;
    xRequestId: string | string[] | undefined | null;
    dataId: string | string[] | undefined | null;
  }): void {
    WebhookSignatureValidator.validate({
      xSignature: params.xSignature,
      xRequestId: params.xRequestId,
      dataId: params.dataId,
      secret: this.webhookSecret,
      toleranceSeconds: 300,
    });
  }
}
