import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  // rawBody: true es necesario para validar la firma del webhook de Stripe
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

  const port = process.env.PORT || 3000;

  await app.listen(port);
  logger.log(`Bot Panel corriendo en: http://localhost:${port}`);
  logger.log(`Webhook Facebook: http://localhost:${port}/webhook`);
  logger.log(`Webhook Stripe:   http://localhost:${port}/webhook/stripe`);
}

bootstrap();
