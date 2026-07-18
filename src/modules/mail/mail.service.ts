import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  RenderedEmail,
  bookingCancellationEmail,
  bookingConfirmationEmail,
  businessInvitationEmail,
  passwordChangedEmail,
  passwordResetEmail,
  paymentReceiptEmail,
  paymentRejectedEmail,
  subscriptionConfirmationEmail,
  trialEndingEmail,
  welcomeOwnerEmail,
  welcomePlayerEmail,
} from './templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client: Resend | null;
  private readonly from: string;
  private readonly replyTo?: string;
  private readonly frontendUrl: string;
  private readonly logoUrl?: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('mail.resendApiKey');
    this.from = this.configService.get<string>('mail.from') ?? '';
    this.replyTo = this.configService.get<string>('mail.replyTo');
    this.frontendUrl =
      this.configService.get<string>('mail.frontendUrl') ??
      'http://localhost:5173';
    this.logoUrl = this.configService.get<string>('mail.logoUrl');
    this.enabled = this.configService.get<boolean>('mail.enabled') ?? true;
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  private url(path: string): string {
    const base = this.frontendUrl.replace(/\/$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  // Envío tolerante a fallos: un error de correo nunca debe romper el flujo de
  // negocio que lo disparó (no hay cola de reintentos en esta versión).
  private async sendSafe(to: string, email: RenderedEmail): Promise<void> {
    if (!to) {
      this.logger.warn(`Skipping "${email.subject}" — no recipient`);
      return;
    }
    if (!this.enabled || !this.client) {
      this.logger.log(`Mail disabled — skipped "${email.subject}" to ${to}`);
      return;
    }
    try {
      const { error } = await this.client.emails.send({
        from: this.from,
        to,
        subject: email.subject,
        html: email.html,
        ...(this.replyTo ? { replyTo: this.replyTo } : {}),
      });
      if (error) {
        this.logger.error(
          `Failed to send "${email.subject}" to ${to}: ${error.message}`,
        );
        return;
      }
      this.logger.log(`Sent "${email.subject}" to ${to}`);
    } catch (err) {
      this.logger.error(
        `Error sending "${email.subject}" to ${to}: ${(err as Error).message}`,
      );
    }
  }

  async sendWelcomePlayer(params: { to: string; name: string }): Promise<void> {
    await this.sendSafe(
      params.to,
      welcomePlayerEmail({
        name: params.name,
        appUrl: this.url('/dashboard'),
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendWelcomeOwner(params: {
    to: string;
    name: string;
    businessName: string;
    trialDays: number;
    businessId: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      welcomeOwnerEmail({
        name: params.name,
        businessName: params.businessName,
        trialDays: params.trialDays,
        adminUrl: this.url(`/admin/${params.businessId}`),
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendBookingConfirmation(params: {
    to: string;
    recipientName: string;
    businessName: string;
    courtName: string;
    date: string;
    startTime: string;
    endTime: string;
    price: number;
    bookingId?: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      bookingConfirmationEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        courtName: params.courtName,
        date: params.date,
        startTime: params.startTime,
        endTime: params.endTime,
        price: params.price,
        bookingUrl: params.bookingId
          ? this.url(`/my-bookings/${params.bookingId}`)
          : undefined,
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendBookingCancellation(params: {
    to: string;
    recipientName: string;
    businessName: string;
    courtName: string;
    date: string;
    startTime: string;
    endTime: string;
    businessId: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      bookingCancellationEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        courtName: params.courtName,
        date: params.date,
        startTime: params.startTime,
        endTime: params.endTime,
        rebookUrl: this.url(`/businesses/${params.businessId}/book`),
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendPaymentReceipt(params: {
    to: string;
    recipientName: string;
    businessName: string;
    planName?: string;
    amount: number;
    paidAt: Date;
    paymentId: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      paymentReceiptEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        planName: params.planName,
        amount: params.amount,
        paidAt: params.paidAt,
        paymentId: params.paymentId,
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendPaymentRejected(params: {
    to: string;
    recipientName: string;
    businessName: string;
    businessId: string;
    amount?: number;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      paymentRejectedEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        amount: params.amount,
        retryUrl: this.url(`/admin/${params.businessId}/settings`),
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendSubscriptionConfirmation(params: {
    to: string;
    recipientName: string;
    businessName: string;
    planName: string;
    periodEnd: Date;
    businessId: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      subscriptionConfirmationEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        planName: params.planName,
        periodEnd: params.periodEnd,
        adminUrl: this.url(`/admin/${params.businessId}`),
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendTrialEnding(params: {
    to: string;
    recipientName: string;
    businessName: string;
    trialEndsAt: Date;
    daysLeft: number;
    businessId: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      trialEndingEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        trialEndsAt: params.trialEndsAt,
        daysLeft: params.daysLeft,
        upgradeUrl: this.url(`/admin/${params.businessId}/settings`),
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendBusinessInvitation(params: {
    to: string;
    businessName: string;
    inviterName?: string;
    role: string;
    token: string;
    expiresInDays: number;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      businessInvitationEmail({
        businessName: params.businessName,
        inviterName: params.inviterName,
        role: params.role,
        acceptUrl: this.url(
          `/invitations/accept?token=${encodeURIComponent(params.token)}`,
        ),
        expiresInDays: params.expiresInDays,
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendPasswordReset(params: {
    to: string;
    name: string;
    token: string;
    expiresInMinutes: number;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      passwordResetEmail({
        name: params.name,
        resetUrl: this.url(
          `/reset-password?token=${encodeURIComponent(params.token)}`,
        ),
        expiresInMinutes: params.expiresInMinutes,
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendPasswordChanged(params: {
    to: string;
    name: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      passwordChangedEmail({
        name: params.name,
        logoUrl: this.logoUrl,
      }),
    );
  }
}
