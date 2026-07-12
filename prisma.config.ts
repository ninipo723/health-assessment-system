import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // 迁移、generate、db push 统一使用直连库 DIRECT_URL
  datasource: {
    url: env("DIRECT_URL"),
  },
});
