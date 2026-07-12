import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { AssessmentRecord } from '@prisma/client';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// 数据库断连重试封装，解决 Connection terminated 报错
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

/** 安全解析 stepData JSON 字符串 */
function parseStepData(rawStr: string | null): Record<string, any> {
  if (!rawStr) return {};
  try {
    return JSON.parse(rawStr);
  } catch {
    return {};
  }
}

// GET 进度恢复接口
export async function GET() {
  try {
    const testEmail = 'test@example.com';

    // 获取/创建测试用户
    const user = await safeDbRun(async () => {
      let u = await prisma.user.findUnique({ where: { email: testEmail } });
      if (!u) u = await prisma.user.create({ data: { email: testEmail } });
      return u;
    });

    const userId = user.id;
    const record: AssessmentRecord | null = await safeDbRun(() =>
      prisma.assessmentRecord.findUnique({ where: { userId } })
    );

    if (!record) {
      return NextResponse.json(
        { stepData: {}, isCompleted: false },
        { headers: corsHeaders }
      );
    }

    const parsedStepData = parseStepData(record.stepData);

    return NextResponse.json(
      { stepData: parsedStepData, isCompleted: record.isCompleted },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json(
      { error: '获取进度失败' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST 分步保存接口
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { stepData } = body ?? {};
    const testEmail = 'test@example.com';

    // 获取/创建测试用户
    const user = await safeDbRun(async () => {
      let u = await prisma.user.findUnique({ where: { email: testEmail } });
      if (!u) u = await prisma.user.create({ data: { email: testEmail } });
      return u;
    });

    // upsert 更新/创建测评记录，JSON转字符串入库
    const record: AssessmentRecord = await safeDbRun(() =>
      prisma.assessmentRecord.upsert({
        where: { userId: user.id },
        update: { stepData: JSON.stringify(stepData) },
        create: {
          userId: user.id,
          stepData: JSON.stringify(stepData),
          isCompleted: false,
        },
      })
    );

    const parsedStepData = parseStepData(record.stepData);

    return NextResponse.json(
      { message: '保存成功', stepData: parsedStepData },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json(
      { error: '保存失败' },
      { status: 500, headers: corsHeaders }
    );
  }
}
