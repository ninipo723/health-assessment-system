import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { User, AssessmentRecord, Subscription } from '@prisma/client';

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

/** 安全解析result JSON字符串，兼容null空值 */
function parseResult(rawStr: string | null): Record<string, any> {
  if (!rawStr) return {};
  try {
    return JSON.parse(rawStr);
  } catch {
    return {};
  }
}

export async function GET() {
  const testEmail = "test@example.com";
  try {
    // 查询用户连带订阅关联
    const userRaw = await safeDbRun(() => prisma.user.findUnique({
      where: { email: testEmail },
      include: { subscription: true }
    }));

    if (!userRaw) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404, headers: corsHeaders });
    }

    // 手动类型断言拆分，消除 subscription 访问标红
    const user = userRaw as User & { subscription: Subscription | null };
    const userId = user.id;

    const record: AssessmentRecord | null = await safeDbRun(() =>
      prisma.assessmentRecord.findUnique({ where: { userId } })
    );

    if (!record || !record.isCompleted) {
      return NextResponse.json(
        { error: '暂无测评结果，请先完成测评' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 可选链安全访问订阅状态
    const subscriptionStatus = user.subscription?.status ?? 'free';
    const realResult = parseResult(record.result);

    if (subscriptionStatus === 'active') {
      // 会员完整数据
      return NextResponse.json(
        {
          isPremium: true,
          result: realResult
        },
        { headers: corsHeaders }
      );
    } else {
      // 免费用户脱敏
      const maskedResult = {
        bmi: realResult.bmi ?? 0,
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
