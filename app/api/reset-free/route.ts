import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

async function safeDbRun<T>(fn: () => Promise<T>, retryCount = 1): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (retryCount > 0 && err.message.includes("Connection terminated")) {
      console.log("数据库连接断开，自动重试一次");
      await prisma.$disconnect();
      return safeDbRun(fn, retryCount - 1);
    }
    throw err;
  }
}

export async function POST() {
  const testEmail = "test@example.com";
  try {
    const user = await safeDbRun(() => prisma.user.findUnique({
      where: { email: testEmail }
    }));
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404, headers: corsHeaders });
    }

    await safeDbRun(() => prisma.subscription.update({
      where: { userId: user.id },
      data: { status: "free" }
    }));

    return NextResponse.json({ message: "已重置为免费用户" }, { headers: corsHeaders });
  } catch (error) {
    console.error('Reset Full Error:', error);
    return NextResponse.json(
      { error: '重置失败' },
      { status: 500, headers: corsHeaders }
    );
  }
}
