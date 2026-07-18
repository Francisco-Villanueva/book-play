import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  resendApiKey: process.env.RESEND_API_KEY,
  from: process.env.MAIL_FROM || 'Book & Play <onboarding@resend.dev>',
  replyTo: process.env.MAIL_REPLY_TO,
  // Base pública del SPA para armar links (reset, aceptar invitación, ver reserva).
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  logoUrl: process.env.MAIL_LOGO_URL,
  // Cuando es false (dev/test) los correos se loguean pero no se envían.
  enabled: process.env.MAIL_ENABLED !== 'false',
}));
