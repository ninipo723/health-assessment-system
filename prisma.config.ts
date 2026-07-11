import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Migrate 迁移命令固定使用 DIRECT_URL（5432 直连，改表结构专用）
  datasource: {
    url: env("DIRECT_URL"),
  },
});
