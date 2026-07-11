import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

// GET 进度接口
export async function GET() {
  try {
    const testEmail = 'test@example.com';

    const user = await safeDbRun(async () => {
      let u = await prisma.user.findUnique({ where: { email: testEmail } });
      if (!u) u = await prisma.user.create({ data: { email: testEmail } });
      return u;
    });

    const userId = user.id;
    const record = await safeDbRun(() => prisma.assessmentRecord.findUnique({ where: { userId } }));

    if (!record) {
      return NextResponse.json({ stepData: {}, isCompleted: false }, { headers: corsHeaders });
    }

    // 数据库是text字符串，必须解析为对象再返回
    let parsedStepData = {};
    try {
      parsedStepData = JSON.parse(String(record.stepData));
    } catch (e) {
      parsedStepData = {};
    }

    return NextResponse.json(
      { stepData: parsedStepData, isCompleted: record.isCompleted },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: '获取进度失败' }, { status: 500, headers: corsHeaders });
  }
}

// POST 保存接口
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { stepData } = body;
    const testEmail = 'test@example.com';

    const user = await safeDbRun(async () => {
      let u = await prisma.user.findUnique({ where: { email: testEmail } });
      if (!u) u = await prisma.user.create({ data: { email: testEmail } });
      return u;
    });

    // 数据库为text类型，对象转字符串存入
    const record = await safeDbRun(() => prisma.assessmentRecord.upsert({
      where: { userId: user.id },
      update: { stepData: JSON.stringify(stepData) },
      create: { userId: user.id, stepData: JSON.stringify(stepData) },
    }));

    // 取出库中字符串，转回对象返回前端
    let parsedStepData = {};
    try {
      parsedStepData = JSON.parse(String(record.stepData));
    } catch (e) {
      parsedStepData = {};
    }

    return NextResponse.json(
      { message: '保存成功', stepData: parsedStepData },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500, headers: corsHeaders });
  }
}
