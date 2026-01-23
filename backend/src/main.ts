import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3001;
  
  // Enable CORS for local development
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(port, () => {
    Logger.log(`🚀 NestJS backend running on http://localhost:${port}`, 'Bootstrap');
    Logger.log(`📚 API docs available at http://localhost:${port}/api/docs`, 'Bootstrap');
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
