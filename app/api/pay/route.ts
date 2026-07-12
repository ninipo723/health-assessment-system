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
    const userRaw = await safeDbRun(() => prisma.user.findUnique({
      where: { email: testEmail },
      include: { subscription: true }
    })) as Record<string, any>;
    if (!userRaw) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404, headers: corsHeaders });
    }
    const userId = userRaw.id;

    if (userRaw.subscription?.status === 'active') {
      return NextResponse.json(
        { message: '您已经是尊贵会员！无需重复开通' },
        { status: 200, headers: corsHeaders }
      );
    }

    const updatedSubscription = await safeDbRun(() => prisma.subscription.upsert({
      where: { userId },
      update: {
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      create: {
        userId,
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    })) as Record<string, any>;

    return NextResponse.json(
      {
        message: '支付成功！您已成功开通30天尊贵会员',
        subscription: updatedSubscription
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Pay Error Full:', error);
    return NextResponse.json(
      { error: '支付状态更新失败' },
      { status: 500, headers: corsHeaders }
    );
  }
}
