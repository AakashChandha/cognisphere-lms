import 'reflect-metadata';
import helmet from 'helmet';
import compression from 'compression';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { createLoggerOptions } from './config/logger.config';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(createLoggerOptions()),
  });

  const config = app.get(AppConfigService);

  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });

  // Global API prefix. Every route documented in the API spec lives under
  // `/api/...`. Nest's URI versioning (`app.enableVersioning`) can be adopted
  // later on a per-controller basis via `@Version('2')` without breaking these
  // existing unversioned routes, giving a clear path to future API versions.
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CGS LMS API')
    .setDescription(
      'REST API for the CGS Learning Management System. Provides authentication, ' +
        'role-based access for Students, Tutors and Master administrators, course ' +
        'management, lessons, file distribution and announcements.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter the access token issued by /api/auth/login',
      },
      'access-token',
    )
    .addTag('Health', 'Service and database health checks')
    .addTag('Auth', 'Authentication, refresh tokens and password management')
    .addTag('Master - Users', 'Master/administrator user management')
    .addTag('Master - Audit Logs', 'System audit trail')
    .addTag('Students', 'Student dashboard, courses, lessons, files and profile')
    .addTag('Tutors', 'Tutor course, lesson, file and student management')
    .addTag('Courses', 'Course catalog resources shared across roles')
    .addTag('Announcements', 'Announcement management')
    .addTag('Dashboard', 'Role-aware aggregated dashboard metrics')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(config.port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`LMS backend listening on port ${config.port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger documentation available at /api/docs`);
}

bootstrap();
