import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateHealth } from '../../../utils/healthCalculator';

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

export async function POST(request: Request) {
  const testEmail = "test@example.com";
  try {
    const body = await request.json();
    const { stepData } = body;
    const resultObj = calculateHealth(stepData);

    // 先确保用户存在，不存在自动创建
    const user = await safeDbRun(() => prisma.user.upsert({
      where: { email: testEmail },
      update: {},
      create: {
        email: testEmail,
        subscription: { create: { status: "free" } }
      }
    }));

    // 使用真实存在的用户ID
    const record = await safeDbRun(() => prisma.assessmentRecord.upsert({
      where: { userId: user.id },
      update: {
        stepData: JSON.stringify(stepData),
        result: JSON.stringify(resultObj),
        isCompleted: true,
      },
      create: {
        userId: user.id,
        stepData: JSON.stringify(stepData),
        result: JSON.stringify(resultObj),
        isCompleted: true,
      },
    }));

    const parseResult = JSON.parse(String(record.result));
    return NextResponse.json(
      { message: '评估完成', result: parseResult },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Submit Error Full:', error);
    return NextResponse.json({ error: '提交评估失败' }, { status: 500, headers: corsHeaders });
  }
}
