import { describe, it, expect } from 'vitest';
import { calculateHealth } from '../utils/healthCalculator';

describe('健康评估算法单元测试（全覆盖边界场景）', () => {
  it('标准正常场景：男性25岁175cm80kg，中等运动减重', () => {
    const result = calculateHealth({
      gender: 'male',
      age: 25,
      height: 175,
      weight: 80,
      targetWeight: 70,
      exerciseFrequency: 'medium',
    });
    expect(result.bmi).toBeCloseTo(26.1);
    expect(result.recommendedCalories).toBe(2749);
    expect(result.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('边界：身高0兜底计算，杜绝Infinity无穷大BMI', () => {
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

  it('边界：负数体重自动兜底为1kg，输出合法BMI', () => {
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

  it('业务场景：目标体重＞当前体重（增重），目标日期返回今日', () => {
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

  it('边界：未知非法运动频率，自动降级low系数计算', () => {
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

  // 考题强制边界：体重=目标体重，无有效测评
  it('边界：当前体重与目标体重相等，不生成有效减重日期', () => {
    const result = calculateHealth({
      gender: 'female',
      age: 22,
      height: 162,
      weight: 55,
      targetWeight: 55,
      exerciseFrequency: 'medium',
    });
    // 逻辑：体重相等无减重需求，targetDate为空字符串
    expect(result.targetDate).toBe('');
  });

  // 年龄带小数（年龄仅允许整数，非法参数）
  it('边界：年龄传入小数22.5，无有效计算结果', () => {
    const result = calculateHealth({
      gender: 'female',
      age: 22.5,
      height: 162,
      weight: 55,
      targetWeight: 52,
      exerciseFrequency: 'medium',
    });
    expect(result.bmi).toBe(0);
  });

  // 数值超过5位上限99999，超大数值非法
  it('边界：身高传入123456六位数，超出上限判定非法', () => {
    const result = calculateHealth({
      gender: 'male',
      age: 25,
      height: 123456,
      weight: 80,
      targetWeight: 70,
      exerciseFrequency: 'medium',
    });
    expect(result.bmi).toBe(0);
  });

  // 全零极端非法参数
  it('边界：年龄/身高/体重全部为0，判定非法', () => {
    const result = calculateHealth({
      gender: 'male',
      age: 0,
      height: 0,
      weight: 0,
      targetWeight: 70,
      exerciseFrequency: 'medium',
    });
    expect(result.bmi).toBe(0);
  });
});
