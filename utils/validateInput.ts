// utils/validateInput.ts
type FormRawData = {
  gender?: string;
  age?: string | number;
  height?: string | number;
  weight?: string | number;
  targetWeight?: string | number;
  exerciseFrequency?: string;
};

type ValidateResult = {
  pass: boolean;
  msg: string;
  data?: {
    gender: string;
    age: number;
    height: number;
    weight: number;
    targetWeight: number;
    exerciseFrequency: string;
  };
};

// 统一后端表单校验，拦截所有非法输入
export function validateAssessmentInput(raw: FormRawData): ValidateResult {
  const { gender, age, height, weight, targetWeight, exerciseFrequency } = raw;

  // 1. 空白必填项校验
  if (!gender || !exerciseFrequency) {
    return { pass: false, msg: "输入完整信息后才可生成检测报告" };
  }
  const strAge = String(age ?? "").trim();
  const strHeight = String(height ?? "").trim();
  const strWeight = String(weight ?? "").trim();
  const strTarget = String(targetWeight ?? "").trim();
  if (!strAge || !strHeight || !strWeight || !strTarget) {
    return { pass: false, msg: "输入完整信息后才可生成检测报告" };
  }

  // 2. 转数字校验
  const numAge = Number(strAge);
  const numHeight = Number(strHeight);
  const numWeight = Number(strWeight);
  const numTarget = Number(strTarget);

  // 年龄必须正整数
  if (isNaN(numAge) || numAge <= 0 || !Number.isInteger(numAge)) {
    return { pass: false, msg: "请输入有效信息" };
  }
  // 身高、体重、目标体重 正数合法小数
  if (
    isNaN(numHeight) || numHeight <= 0 ||
    isNaN(numWeight) || numWeight <= 0 ||
    isNaN(numTarget) || numTarget <= 0
  ) {
    return { pass: false, msg: "请输入有效信息" };
  }
  // 当前体重 = 目标体重，无测评意义
  if (numWeight === numTarget) {
    return { pass: false, msg: "请输入有效信息" };
  }

  // 全部校验通过，格式化返回
  return {
    pass: true,
    msg: "",
    data: {
      gender,
      age: numAge,
      height: numHeight,
      weight: numWeight,
      targetWeight: numTarget,
      exerciseFrequency,
    },
  };
}
