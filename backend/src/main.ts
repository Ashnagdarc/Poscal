import * as nodeCrypto from 'crypto';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  // Ensure the Node crypto API is available as a global before loading any modules that expect it
  (global as any).crypto = nodeCrypto;

  // Dynamically import AppModule after crypto is set on global
  const { AppModule } = await import('./app.module');
  // Note: HTTPS is handled by nginx reverse proxy on VPS
  // Backend runs on HTTP locally and nginx terminates TLS
  const app = await NestFactory.create<any>(AppModule, {
    bodyParser: true,
    rawBody: true,
  });
  const port = process.env.PORT || 3001;
  
  // Enable CORS for frontend
  app.enableCors({
    origin: [
      'http://localhost:5173', 
      'http://localhost:3000', 
      'https://www.poscalfx.com', 
      'https://poscalfx.com',
      'https://api.poscalfx.com',
      process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 3600,
  });

  // Configure body size limits (2MB for files, 1MB for JSON)
  app.use(require('express').json({ limit: '2mb' }));
  app.use(require('express').urlencoded({ limit: '2mb', extended: true }));

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Setup Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Poscal Trading Platform API')
    .setDescription('REST API for Poscal Trading Platform')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

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
