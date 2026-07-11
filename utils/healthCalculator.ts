// utils/healthCalculator.ts
export interface HealthInput {
  gender: string;
  age: number;
  height: number; // cm
  weight: number; // kg
  targetWeight: number; // kg
  exerciseFrequency: string; // 如 'low', 'medium', 'high'
}

export interface HealthResult {
  bmi: number;
  recommendedCalories: number;
  targetDate: string; // YYYY-MM-DD
}

export function calculateHealth(input: HealthInput): HealthResult {
  // 边界兜底1：身高<=0 防止除以0产生Infinity
  let heightInMeters = input.height / 100;
  if (heightInMeters <= 0) {
    heightInMeters = 1;
  }

  // 边界兜底2：体重不能小于1，避免负BMI
  const realWeight = Math.max(1, input.weight);

  // 1. 计算 BMI
  const bmi = parseFloat((realWeight / (heightInMeters * heightInMeters)).toFixed(1));

  // 2. 计算BMR
  let bmr = 10 * realWeight + 6.25 * input.height - 5 * input.age;
  if (input.gender === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }
  
  // 运动系数
  const activityMultipliers: Record<string, number> = {
    low: 1.2,
    medium: 1.55,
    high: 1.9,
  };
  const multiplier = activityMultipliers[input.exerciseFrequency] || 1.2;
  const recommendedCalories = Math.round(bmr * multiplier);

  // 3. 目标日期
  const realTargetWeight = Math.max(1, input.targetWeight);
  const weightToLose = realWeight - realTargetWeight;
  const weeksNeeded = Math.max(0, weightToLose / 0.5);
  
  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() + weeksNeeded * 7);
  const targetDate = targetDateObj.toISOString().split('T')[0];

  return {
    bmi,
    recommendedCalories,
    targetDate,
  };
}
