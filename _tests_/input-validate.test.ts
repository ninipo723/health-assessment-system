import { describe, test, expect } from "vitest";
import { validateAssessmentInput } from "@/utils/validateInput";

describe("后端入参校验工具", () => {
  const baseData = {
    gender: "female",
    age: "22",
    height: "162",
    weight: "55",
    targetWeight: "52",
    exerciseFrequency: "medium",
  };

  test("合法完整参数校验通过", () => {
    const res = validateAssessmentInput(baseData);
    expect(res.pass).toBe(true);
  });

  test("空性别，拦截提交", () => {
    const res = validateAssessmentInput({ ...baseData, gender: "" });
    expect(res.pass).toBe(false);
    expect(res.msg).toBe("输入完整信息后才可生成检测报告");
  });

  test("年龄为负数，非法参数拦截", () => {
    const res = validateAssessmentInput({ ...baseData, age: "-10" });
    expect(res.pass).toBe(false);
    expect(res.msg).toBe("请输入有效信息");
  });

  test("身高文字字符串，非法拦截", () => {
    const res = validateAssessmentInput({ ...baseData, height: "abc" });
    expect(res.pass).toBe(false);
  });

  test("当前体重与目标体重相等，拦截", () => {
    const res = validateAssessmentInput({ ...baseData, weight: "52", targetWeight: "52" });
    expect(res.pass).toBe(false);
  });

  test("年龄带小数，非法拦截", () => {
    const res = validateAssessmentInput({ ...baseData, age: "22.5" });
    expect(res.pass).toBe(false);
  });
});
