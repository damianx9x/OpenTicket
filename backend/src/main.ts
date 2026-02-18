import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigLoaderService } from './config/config-loader.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Load configuration before initializing the app
  const configLoader = new ConfigLoaderService();
  const config = await configLoader.loadConfig();
  
  // Set DATABASE_URL from config
  process.env.DATABASE_URL = config.databaseUrl;
  
  if (config.setupMode) {
    logger.warn('⚠️  SYSTEM IN SETUP MODE - Configure via POST /setup/init');
  } else {
    logger.log('✅ Configuration loaded from file');
  }

  const app = await NestFactory.create(AppModule);

  // Global Validation Pipe - wymusza walidację DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // usuwa pola, których nie ma w DTO
      transform: true, // automatycznie konwertuje typy (np. string -> number w params)
      forbidNonWhitelisted: true, // rzuca błąd, gdy przyjdą nadmiarowe pola
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Swagger Configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ticket System API')
    .setDescription('API documentation for the Ticket System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.port || 3000;
  await app.listen(port);
  
  const baseUrl = await app.getUrl();
  logger.log(`✅ Application is running on: ${baseUrl}`);
  logger.log(`📚 Swagger docs available at: ${baseUrl}/api/docs`);
  logger.log(`🎯 API is available at: ${baseUrl}/api/v1`);
  
  if (config.setupMode) {
    logger.log(`⚙️  Setup endpoint: POST ${baseUrl}/api/v1/setup/init`);
  }
}

bootstrap();

// Fix BigInt serialization for Prisma
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
