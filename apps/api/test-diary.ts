import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DiaryService } from './src/modules/diary/diary.service';
import { PrismaService } from './src/prisma/prisma.service';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
process.env.DATABASE_URL = process.env.DIRECT_URL;

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const diaryService = app.get(DiaryService);
  const prisma = app.get(PrismaService);

  // Get a user to test with
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No users found");
    return;
  }

  console.log("Testing indexing for user:", user.supabaseId);

  try {
    const res = await diaryService.create(user.supabaseId, {
      title: "Nhật kí omakase",
      content: "Hôm nay tôi đi học nhóm, sau đó đi ăn với Nhân Khiêm Lâm, về nhà thay đồ và đi ăn omakase. Ngày hôm nay tôi mặc đồ màu đỏ, mọi người thích bộ đồ này. Học nhóm khá mệt nhưng vui !"
    });
    console.log("SUCCESS:", res);
  } catch (e) {
    console.error("FAILED TO INDEX:", e);
  }

  await app.close();
}

bootstrap();
