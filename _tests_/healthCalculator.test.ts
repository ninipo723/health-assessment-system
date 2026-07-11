import { describe, it, expect } from 'vitest';
import { calculateHealth } from '../utils/healthCalculator';

describe('健康评估算法测试', () => {
  it('正常计算：男性25岁175cm80kg', () => {
    const result = calculateHealth({
      gender: 'male',
      age: 25,
      height: 175,
      weight: 80,
      targetWeight: 70,
      exerciseFrequency: 'medium',
    });
    expect(result.bmi).toBeCloseTo(26.1);
    // 修正真实计算结果 2749
    expect(result.recommendedCalories).toBe(2749);
    expect(result.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('边界测试：身高为0自动兜底，不会产生无穷大BMI', () => {
    const result = calculateHealth({
      gender: 'male',
      age: 25,
      height: 0,
      weight: 80,
      targetWeight: 70,
      exerciseFrequency: 'medium',
    });
    expect(result.bmi).not.toBe(Infinity);
    expect(result.bmi).toBeGreaterThan(0);
  });

  it('边界测试：负数体重，自动兜底为1kg，输出合法BMI数值', () => {
    const result = calculateHealth({
      gender: 'female',
      age: 30,
      height: 160,
      weight: -10,
      targetWeight: 50,
      exerciseFrequency: 'low',
    });
    expect(result.bmi).toBeGreaterThan(0);
    expect(result.recommendedCalories).toBeDefined();
  });

  it('边界测试：目标体重高于当前体重（增重场景），日期为今日', () => {
    const result = calculateHealth({
      gender: 'male',
      age: 20,
      height: 180,
      weight: 60,
      targetWeight: 80,
      exerciseFrequency: 'high',
    });
    const today = new Date().toISOString().split('T')[0];
    expect(result.targetDate).toBe(today);
  });

  it('边界测试：未知运动频率，自动使用low默认系数', () => {
    const result = calculateHealth({
      gender: 'female',
      age: 22,
      height: 162,
      weight: 55,
      targetWeight: 52,
      exerciseFrequency: 'unknown',
    });
    expect(result.recommendedCalories).toBeDefined();
  });
});
