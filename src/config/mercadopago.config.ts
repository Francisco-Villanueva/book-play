import { registerAs } from '@nestjs/config';

export default registerAs('mercadoPago', () => ({
  accessToken: process.env.MP_ACCESS_TOKEN,
  webhookSecret: process.env.MP_WEBHOOK_SECRET,
  backUrl: process.env.MP_BACK_URL || 'http://localhost:5173',
  // Full public URL of the webhook endpoint (includes the `/api` global prefix),
  // e.g. https://book-play.onrender.com/api/webhooks/mercadopago. Set as
  // notification_url on every preference so activation doesn't depend on the
  // webhook being configured in the Mercado Pago panel.
  webhookUrl: process.env.MP_WEBHOOK_URL,
}));
