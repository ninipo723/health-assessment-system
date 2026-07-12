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

// 后端统一参数校验函数，与前端规则完全一致
function validateStepData(data: any): { valid: boolean; msg: string } {
  const { gender, age, height, weight, targetWeight, exerciseFrequency } = data ?? {};

  // 校验空字段
  if (!gender || !exerciseFrequency
    || age === undefined || age === null || String(age).trim() === ''
    || height === undefined || height === null || String(height).trim() === ''
    || weight === undefined || weight === null || String(weight).trim() === ''
    || targetWeight === undefined || targetWeight === null || String(targetWeight).trim() === ''
  ) {
    return { valid: false, msg: "输入完整信息后才可生成检测报告" };
  }

  const ageNum = Number(age);
  const hNum = Number(height);
  const wNum = Number(weight);
  const tNum = Number(targetWeight);

  // 年龄必须 1~99999 整数
  const ageOk = !isNaN(ageNum) && Number.isInteger(ageNum) && ageNum >= 1 && ageNum <= 99999;
  // 身高体重 1~99999，支持小数
  const floatOk = (n: number) => !isNaN(n) && n > 0 && n <= 99999;
  const hOk = floatOk(hNum);
  const wOk = floatOk(wNum);
  const tOk = floatOk(tNum);
  const weightEqual = wNum === tNum;

  if (!ageOk || !hOk || !wOk || !tOk || weightEqual) {
    return { valid: false, msg: "请输入有效信息" };
  }

  return { valid: true, msg: "" };
}

export async function POST(request: Request) {
  const testEmail = "test@example.com";
  try {
    const body = await request.json();
    const { stepData } = body ?? {};

    // 后端第一层校验，非法直接拦截，不进数据库
    const check = validateStepData(stepData);
    if (!check.valid) {
      return NextResponse.json({ error: check.msg }, { status: 400, headers: corsHeaders });
    }

    const resultObj = calculateHealth(stepData);

    // 确保用户存在，无则创建并绑定免费订阅
    const user = await safeDbRun(() => prisma.user.upsert({
      where: { email: testEmail },
      update: {},
      create: {
        email: testEmail,
        subscription: { create: { status: "free" } }
      }
    }));

    const userId = user.id;
    // 保存完整测评记录
    const record = await safeDbRun(() => prisma.assessmentRecord.upsert({
      where: { userId },
      update: {
        stepData: JSON.stringify(stepData),
        result: JSON.stringify(resultObj),
        isCompleted: true,
      },
      create: {
        userId,
        stepData: JSON.stringify(stepData),
        result: JSON.stringify(resultObj),
        isCompleted: true,
      },
    }));

    // 兼容record.result为null场景，消除TS报错
    const rawResultStr = record.result ?? "{}";
    const parseResult = JSON.parse(rawResultStr);

    return NextResponse.json(
      { message: '评估完成', result: parseResult },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Submit Error Full:', error);
    return NextResponse.json({ error: '提交评估失败' }, { status: 500, headers: corsHeaders });
  }
}
