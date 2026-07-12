import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateAssessmentInput } from "@/utils/validateInput";
import { calculateHealth } from "@/utils/healthCalculator";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { stepData } = body;

    const validateRes = validateAssessmentInput(stepData);
    if (!validateRes.pass) {
      return NextResponse.json({ error: validateRes.msg }, { status: 400, headers: corsHeaders });
    }
    const validData = validateRes.data!;

    const testEmail = "test@example.com";
    const userRaw = await safeDbRun(async () => {
      let u = await prisma.user.findUnique({ where: { email: testEmail } });
      if (!u) u = await prisma.user.create({ data: { email: testEmail } });
      return u;
    });
    const user = userRaw as unknown as Record<string, any>;
    const userId = user.id;

    const calcResult = calculateHealth(validData);
    // 转JSON字符串存入Json字段，彻底解决类型不匹配红线
    const resultJson = JSON.parse(JSON.stringify(calcResult));

    const recordRaw = await safeDbRun(() =>
      prisma.assessmentRecord.upsert({
        where: { userId },
        update: {
          stepData: stepData,
          result: resultJson,
          isCompleted: true,
        },
        create: {
          userId,
          stepData: stepData,
          result: resultJson,
          isCompleted: true,
        },
      })
    );

    return NextResponse.json(
      { message: "测评完成，数据已保存", result: calcResult },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error("submit error", e);
    return NextResponse.json({ error: "服务异常" }, { status: 500, headers: corsHeaders });
  }
}
