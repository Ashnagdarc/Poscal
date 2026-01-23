import 'crypto'; // Ensure crypto is available globally for TypeORM
import * as fs from 'fs';
import * as https from 'https';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Determine if we should use HTTPS
  const useHttps = process.env.NODE_ENV === 'production' || process.env.USE_HTTPS === 'true';
  const certPath = process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/api.poscalfx.com/fullchain.pem';
  const keyPath = process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/api.poscalfx.com/privkey.pem';

  let httpsOptions: https.ServerOptions | undefined = undefined;
  if (useHttps && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    httpsOptions = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  }

  const app = await NestFactory.create(AppModule, httpsOptions ? { httpsOptions } : undefined);
  const port = process.env.PORT || 3001;
  
  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'https://www.poscalfx.com', 'https://poscalfx.com', process.env.FRONTEND_URL],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const protocol = httpsOptions ? 'https' : 'http';
  await app.listen(port, () => {
    const host = httpsOptions ? 'api.poscalfx.com' : 'localhost';
    Logger.log(`🚀 NestJS backend running on ${protocol}://${host}:${port}`, 'Bootstrap');
    Logger.log(`📚 API docs available at ${protocol}://${host}:${port}/api/docs`, 'Bootstrap');
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
