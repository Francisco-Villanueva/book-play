import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { CORS } from './config/cors.config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Sin esto el rate limiting es inútil detrás del proxy de Render: todas las
  // peticiones llegan con la misma IP interna, así que o no frena a nadie o
  // frena a todos juntos. Un solo salto de proxy, no `true`: confiar en toda la
  // cadena deja que el cliente falsee su IP con un X-Forwarded-For inventado.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.enableCors(CORS);
  app.setGlobalPrefix('/api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Opt-in explícito, no `NODE_ENV !== 'production'`: si la variable de entorno
  // no está seteada en el hosting, esa comparación deja la documentación entera
  // de la API publicada sin que nadie se entere. Ausente = apagado.
  const swaggerEnabled = process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Book & Play API')
      .setDescription('REST API for sports court rental management')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT || process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`Server running on port ${port}`);
  if (swaggerEnabled) {
    console.log(`Swagger docs available at http://localhost:${port}/docs`);
  }
}
bootstrap();
