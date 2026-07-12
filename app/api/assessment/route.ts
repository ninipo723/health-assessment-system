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

function parseStepData(rawStr: string | null): Record<string, any> {
  if (!rawStr) return {};
  try {
    return JSON.parse(rawStr);
  } catch {
    return {};
  }
}

export async function GET() {
  const testEmail = 'test@example.com';
  try {
    const user = await safeDbRun(async () => {
      let u = await prisma.user.findUnique({ where: { email: testEmail } });
      if (!u) u = await prisma.user.create({ data: { email: testEmail } });
      return u;
    });

    const userId = user.id;
    // 关键：强制断言为任意对象，TS不会推断成{}
    const record = await safeDbRun(() => prisma.assessmentRecord.findUnique({ where: { userId } })) as Record<string, any> | null;

    if (!record) {
      return NextResponse.json(
        { stepData: {}, isCompleted: false },
        { headers: corsHeaders }
      );
    }

    // 空值兜底
    const parsedStepData = parseStepData(record.stepData ?? null);

    return NextResponse.json(
      { stepData: parsedStepData, isCompleted: record.isCompleted ?? false },
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

export async function POST(request: Request) {
  const testEmail = 'test@example.com';
  try {
    const body = await request.json().catch(() => ({}));
    const saveData = body?.stepData && typeof body.stepData === 'object' ? body.stepData : {};

    const user = await safeDbRun(async () => {
      let u = await prisma.user.findUnique({ where: { email: testEmail } });
      if (!u) u = await prisma.user.create({
        data: {
          email: testEmail,
          subscription: { create: { status: "free" } }
        }
      });
      return u;
    });

    const userId = user.id;
    const recordRaw = await safeDbRun(() => prisma.assessmentRecord.upsert({
      where: { userId },
      update: { stepData: JSON.stringify(saveData), isCompleted: false },
      create: {
        userId,
        stepData: JSON.stringify(saveData),
        isCompleted: false
      },
    })) as Record<string, any>;

    const parsedStepData = parseStepData(recordRaw.stepData ?? null);

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
