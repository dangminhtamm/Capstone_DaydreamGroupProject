import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips away properties that don't have decorators in the DTO
      forbidNonWhitelisted: true, // Throws an error if extra properties are sent
      transform: true, // Automatically transforms payloads to be objects typed according to DTOs
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
