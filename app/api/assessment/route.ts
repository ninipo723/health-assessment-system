import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// 恢复官方类型导入，彻底解决“无导出成员”报错
import type { User, AssessmentRecord } from '@prisma/client';

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

// 适配Prisma Json类型解析，接收unknown安全转换
function parseStepData(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return {};
}

export async function GET() {
  const testEmail = 'test@example.com';
  try {
    // 明确标注User类型，TS不再推断unknown
    const user: User = await safeDbRun(async () => {
      let u = await prisma.user.findUnique({ where: { email: testEmail } });
      if (!u) u = await prisma.user.create({ data: { email: testEmail } });
      return u;
    });

    const userId = user.id;
    // 原生标注AssessmentRecord | null，TS识别所有字段
    const record: AssessmentRecord | null = await safeDbRun(() => 
      prisma.assessmentRecord.findUnique({ where: { userId } })
    );

    if (!record) {
      return NextResponse.json(
        { stepData: {}, isCompleted: false },
        { headers: corsHeaders }
      );
    }

    // 原生识别record.stepData，不会报“属性不存在于{}”
    const parsedStepData = parseStepData(record.stepData);
    return NextResponse.json(
      { stepData: parsedStepData, isCompleted: record.isCompleted },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: '获取进度失败' }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  const testEmail = 'test@example.com';
  try {
    const body = await request.json().catch(() => ({}));
    const saveData = body?.stepData && typeof body.stepData === 'object' ? body.stepData : {};

    const user: User = await safeDbRun(async () => {
      let u = await prisma.user.findUnique({ where: { email: testEmail } });
      if (!u) u = await prisma.user.create({
        data: { email: testEmail, subscription: { create: { status: "free" } } }
      });
      return u;
    });

    const userId = user.id;
    // 重点：Prisma Json字段直接传对象，删除JSON.stringify
    const record: AssessmentRecord = await safeDbRun(() => prisma.assessmentRecord.upsert({
      where: { userId },
      update: { stepData: saveData, isCompleted: false },
      create: { userId, stepData: saveData, isCompleted: false }
    }));

    const parsedStepData = parseStepData(record.stepData);
    return NextResponse.json(
      { message: '分步进度保存成功', stepData: parsedStepData },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('POST Assessment Error:', error);
    return NextResponse.json({ error: '分步保存失败' }, { status: 500, headers: corsHeaders });
  }
}
