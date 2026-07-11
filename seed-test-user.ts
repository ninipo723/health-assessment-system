// seed-test-user.ts
import { prisma } from '@/lib/prisma';

async function main() {
  // upsert：存在则跳过，不存在就创建测试用户+免费订阅
  await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      subscription: {
        create: {
          status: 'free'
        }
      }
    },
  });
  console.log('✅ 测试用户创建成功！');
}

main()
  .catch((err) => console.error('❌ 创建失败：', err))
  .finally(async () => {
    await prisma.$disconnect();
  });
