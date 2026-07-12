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

/** 安全解析 stepData JSON 字符串 */
function parseStepData(rawStr: string | null): Record<string, any> {
  if (!rawStr) return {};
  try {
    return JSON.parse(rawStr);
  } catch {
    return {};
  }
}

// GET 进度恢复接口：读取用户上次填写的分步数据
export async function GET() {
  const testEmail = 'test@example.com';
  try {
    const user = await safeDbRun(async () => {
      let u = await prisma.user.findUnique({
        where: { email: testEmail }
      });
      if (!u) u = await prisma.user.create({ data: { email: testEmail } });
      return u;
    });

    const userId = user.id;
    const record = await safeDbRun(() =>
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

// POST 分步增量保存接口
export async function POST(request: Request) {
  const testEmail = 'test@example.com';
  try {
    const body = await request.json();
    const { stepData } = body ?? {};
    const saveData = stepData && typeof stepData === 'object' ? stepData : {};

    const user = await safeDbRun(async () => {
      let u = await prisma.user.findUnique({ where: { email: testEmail } });
      if (!u) u = await prisma.user.create({ data: { email: testEmail } });
      return u;
    });

    const userId = user.id;
    const record = await safeDbRun(() =>
      prisma.assessmentRecord.upsert({
        where: { userId },
        update: { stepData: JSON.stringify(saveData) },
        create: {
          userId,
          stepData: JSON.stringify(saveData),
          isCompleted: false,
        },
      })
    );

    const parsedStepData = parseStepData(record.stepData);

    return NextResponse.json(
      { message: '分步进度保存成功', stepData: parsedStepData },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json(
      { error: '分步保存失败' },
      { status: 500, headers: corsHeaders }
    );
  }
}
