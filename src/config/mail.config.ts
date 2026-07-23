import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : 587,
  // true para el puerto 465 (SSL implícito); false para 587/25 (STARTTLS).
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER,
  password: process.env.MAIL_PASSWORD,
  from: process.env.MAIL_FROM || 'Book & Play <no-reply@bookandplay.app>',
  replyTo: process.env.MAIL_REPLY_TO,
  // Base pública del SPA para armar links (reset, aceptar invitación, ver reserva).
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  logoUrl: process.env.MAIL_LOGO_URL,
  // Cuando es false (dev/test) los correos se loguean pero no se envían.
  enabled: process.env.MAIL_ENABLED !== 'false',
}));
