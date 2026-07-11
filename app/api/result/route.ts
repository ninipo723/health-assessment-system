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

export async function GET() {
  const testEmail = "test@example.com";
  try {
    // 通过邮箱查询用户
    const user = await safeDbRun(() => prisma.user.findUnique({
      where: { email: testEmail },
      include: { subscription: true }
    }));

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404, headers: corsHeaders });
    }

    const record = await safeDbRun(() => prisma.assessmentRecord.findUnique({
      where: { userId: user.id }
    }));

    if (!record || !record.isCompleted) {
      return NextResponse.json(
        { error: '暂无测评结果，请先完成测评' },
        { status: 404, headers: corsHeaders }
      );
    }

    const subscriptionStatus = user.subscription?.status || 'free';
    let realResult = {};
    try {
      realResult = JSON.parse(String(record.result));
    } catch (e) {
      realResult = {};
    }

    if (subscriptionStatus === 'active') {
      return NextResponse.json(
        {
          isPremium: true,
          result: realResult
        },
        { headers: corsHeaders }
      );
    } else {
      const maskedResult = {
        bmi: (realResult as any).bmi,
        recommendedCalories: '*** (需开通会员查看)',
        targetDate: '*** (需开通会员查看)',
      };

      return NextResponse.json(
        {
          isPremium: false,
          result: maskedResult,
          upgradeMessage: '您的基础BMI已生成，升级会员解锁完整健康规划！'
        },
        { headers: corsHeaders }
      );
    }
  } catch (error) {
    console.error('GET Result Error:', error);
    return NextResponse.json(
      { error: '获取结果失败' },
      { status: 500, headers: corsHeaders }
    );
  }
}
