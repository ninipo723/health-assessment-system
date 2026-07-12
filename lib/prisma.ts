import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

// 全局缓存 Prisma 实例，开发热更新不重复新建连接
const globalPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

let prismaClient: PrismaClient;

if (!globalPrisma.prisma) {
  // 创建pg适配器，读取业务事务池DATABASE_URL（6543端口）
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  })
  globalPrisma.prisma = new PrismaClient({ adapter })
}

prismaClient = globalPrisma.prisma;

// 导出全局唯一prisma实例
export const prisma = prismaClient

// 开发环境挂载到global，避免每次热重载新建客户端占满连接池
if (process.env.NODE_ENV !== 'production') {
  globalPrisma.prisma = prismaClient
}
