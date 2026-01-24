import 'crypto'; // Ensure crypto is available globally for TypeORM
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Note: HTTPS is handled by nginx reverse proxy on VPS
  // Backend runs on HTTP locally and nginx terminates TLS
  const app = await NestFactory.create<any>(AppModule);
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

  const protocol = 'http';
  await app.listen(port, () => {
    const host = 'localhost';
    Logger.log(`🚀 NestJS backend running on ${protocol}://${host}:${port}`, 'Bootstrap');
    Logger.log(`📚 API docs available at ${protocol}://${host}:${port}/api/docs`, 'Bootstrap');
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
