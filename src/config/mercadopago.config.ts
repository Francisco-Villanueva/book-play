import { registerAs } from '@nestjs/config';

export default registerAs('mercadoPago', () => ({
  accessToken: process.env.MP_ACCESS_TOKEN,
  webhookSecret: process.env.MP_WEBHOOK_SECRET,
  backUrl: process.env.MP_BACK_URL || 'http://localhost:5173',
}));
