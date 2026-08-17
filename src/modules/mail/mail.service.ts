import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  RenderedEmail,
  bookingCancellationEmail,
  bookingCancelledByClientEmail,
  bookingConfirmationEmail,
  bookingSuspendedEmail,
  businessInvitationEmail,
  recurringBookingConfirmationEmail,
  recurringBookingEndedEmail,
  passwordChangedEmail,
  passwordResetEmail,
  paymentReceiptEmail,
  paymentRejectedEmail,
  subscriptionConfirmationEmail,
  subscriptionExpiringEmail,
  subscriptionSuspendedEmail,
  welcomeOwnerEmail,
  welcomePlayerEmail,
} from './templates';
import type { ExpiryReason } from './templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly replyTo?: string;
  private readonly frontendUrl: string;
  private readonly logoUrl?: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('mail.host');
    const port = this.configService.get<number>('mail.port') ?? 587;
    const secure = this.configService.get<boolean>('mail.secure') ?? false;
    const user = this.configService.get<string>('mail.user');
    const password = this.configService.get<string>('mail.password');
    this.from = this.configService.get<string>('mail.from') ?? '';
    this.replyTo = this.configService.get<string>('mail.replyTo');
    this.frontendUrl =
      this.configService.get<string>('mail.frontendUrl') ??
      'https://platform.book-and-play.com.ar';
    this.logoUrl = this.configService.get<string>('mail.logoUrl');
    this.enabled = this.configService.get<boolean>('mail.enabled') ?? true;
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port,
          secure,
          auth: user && password ? { user, pass: password } : undefined,
        })
      : null;
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
    if (!this.enabled || !this.transporter) {
      this.logger.log(`Mail disabled — skipped "${email.subject}" to ${to}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: email.subject,
        html: email.html,
        ...(this.replyTo ? { replyTo: this.replyTo } : {}),
      });
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
    businessId: string;
    bookingId: string;
    guestCancellationToken?: string;
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
        // Los invitados no tienen cuenta, así que "Ver mi reserva" (que requiere
        // login) no les sirve — reciben en cambio un link de cancelación directo.
        bookingUrl: params.guestCancellationToken
          ? undefined
          : this.url(`/my-bookings/${params.bookingId}`),
        cancelUrl: params.guestCancellationToken
          ? this.url(
              `/businesses/${params.businessId}/bookings/${params.bookingId}/cancel?token=${encodeURIComponent(params.guestCancellationToken)}`,
            )
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

  async sendBookingCancelledByClient(params: {
    to: string;
    recipientName: string;
    businessName: string;
    clientName: string;
    courtName: string;
    date: string;
    startTime: string;
    endTime: string;
    isRecurringInstance: boolean;
    businessId: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      bookingCancelledByClientEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        clientName: params.clientName,
        courtName: params.courtName,
        date: params.date,
        startTime: params.startTime,
        endTime: params.endTime,
        isRecurringInstance: params.isRecurringInstance,
        agendaUrl: this.url(`/admin/${params.businessId}/agenda`),
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendRecurringBookingConfirmation(params: {
    to: string;
    recipientName: string;
    businessName: string;
    courtName: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    price: number;
    dates: string[];
    businessId: string;
    seriesId: string;
    manageToken?: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      recurringBookingConfirmationEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        courtName: params.courtName,
        dayOfWeek: params.dayOfWeek,
        startTime: params.startTime,
        endTime: params.endTime,
        price: params.price,
        dates: params.dates,
        manageUrl: params.manageToken
          ? this.url(
              `/businesses/${params.businessId}/turnos-fijos/${params.seriesId}?token=${encodeURIComponent(params.manageToken)}`,
            )
          : undefined,
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendRecurringBookingEnded(params: {
    to: string;
    recipientName: string;
    businessName: string;
    courtName: string;
    dayOfWeek: number;
    startTime: string;
    cancelledCount: number;
    from: string;
    businessId: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      recurringBookingEndedEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        courtName: params.courtName,
        dayOfWeek: params.dayOfWeek,
        startTime: params.startTime,
        cancelledCount: params.cancelledCount,
        from: params.from,
        rebookUrl: this.url(`/businesses/${params.businessId}/book`),
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendBookingSuspended(params: {
    to: string;
    recipientName: string;
    businessName: string;
    courtName: string;
    date: string;
    startTime: string;
    endTime: string;
    reason?: string;
    isRecurring: boolean;
    businessId: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      bookingSuspendedEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        courtName: params.courtName,
        date: params.date,
        startTime: params.startTime,
        endTime: params.endTime,
        reason: params.reason,
        isRecurring: params.isRecurring,
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

  async sendSubscriptionExpiring(params: {
    to: string;
    recipientName: string;
    businessName: string;
    expiresAt: Date;
    daysLeft: number;
    reason: ExpiryReason;
    businessId: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      subscriptionExpiringEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        expiresAt: params.expiresAt,
        daysLeft: params.daysLeft,
        reason: params.reason,
        upgradeUrl: this.url(`/admin/${params.businessId}/upgrade`),
        logoUrl: this.logoUrl,
      }),
    );
  }

  async sendSubscriptionSuspended(params: {
    to: string;
    recipientName: string;
    businessName: string;
    daysSuspended: number;
    businessId: string;
  }): Promise<void> {
    await this.sendSafe(
      params.to,
      subscriptionSuspendedEmail({
        recipientName: params.recipientName,
        businessName: params.businessName,
        daysSuspended: params.daysSuspended,
        upgradeUrl: this.url(`/admin/${params.businessId}/upgrade`),
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
