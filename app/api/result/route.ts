import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { User, Subscription, AssessmentRecord } from '@prisma/client';

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

function parseResult(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return {};
}

export async function GET() {
  const testEmail = "test@example.com";
  try {
    // 带关联subscription，复合类型标注
    const userRaw = await safeDbRun(() => prisma.user.findUnique({
      where: { email: testEmail },
      include: { subscription: true }
    }));
    if (!userRaw) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404, headers: corsHeaders });
    }
    // 复合类型：User + 关联subscription
    const user = userRaw as User & { subscription: Subscription | null };
    const userId = user.id;
    const subscriptionStatus = user.subscription?.status || 'free';

    const record: AssessmentRecord | null = await safeDbRun(() => 
      prisma.assessmentRecord.findUnique({ where: { userId } })
    );

    if (!record || !record.isCompleted) {
      return NextResponse.json({ error: '暂无测评结果，请先完成测评' }, { status: 404, headers: corsHeaders });
    }

    const realResult = parseResult(record.result);
    if (subscriptionStatus === 'active') {
      return NextResponse.json({ isPremium: true, result: realResult }, { headers: corsHeaders });
    } else {
      const maskedResult = {
        bmi: realResult.bmi ?? 0,
        recommendedCalories: '*** (需开通会员查看)',
        targetDate: '*** (需开通会员查看)',
      };
      return NextResponse.json(
        { isPremium: false, result: maskedResult, upgradeMessage: '您的基础BMI已生成，升级会员解锁完整健康规划！' },
        { headers: corsHeaders }
      );
    }
  } catch (error) {
    console.error('GET Result Error:', error);
    return NextResponse.json({ error: '获取结果失败' }, { status: 500, headers: corsHeaders });
  }
}
