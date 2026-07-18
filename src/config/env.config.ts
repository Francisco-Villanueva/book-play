import { z } from 'zod';

const envZodModel = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().optional(),
  APP_PORT: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  MAIL_REPLY_TO: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  MAIL_LOGO_URL: z.string().optional(),
  MAIL_ENABLED: z.string().optional(),
});

envZodModel.parse(process.env);

type EnvType = z.infer<typeof envZodModel>;
declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvType {}
  }
}
