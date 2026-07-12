'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  // 默认女性基础数据，全部使用字符串存储
  const [formData, setFormData] = useState({
    gender: 'female',
    age: '22',
    height: '162',
    weight: '55',
    targetWeight: '52',
    exerciseFrequency: 'medium'
  });
  // 测评报告
  const [report, setReport] = useState<any>(null);
  // 提示文字
  const [tip, setTip] = useState('');
  // 实时会员状态展示
  const [vipStatusText, setVipStatusText] = useState('加载中...');

  // 页面加载自动查询会员状态
  useEffect(() => {
    const fetchUserVipState = async () => {
      try {
        const res = await fetch('/api/result');
        const data = await res.json();
        if (data.isPremium) {
          setVipStatusText('尊贵会员（30天有效期）');
        } else {
          setVipStatusText('非会员');
        }
      } catch (err) {
        setVipStatusText('状态获取失败');
      }
    };
    fetchUserVipState();
  }, []);

  // 直接存储原始输入字符串，不做实时过滤
  const handleInputChange = (key: string, rawValue: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: rawValue
    }));
  };

  // 一键清空所有表单数据（重置为空字符串）
  const clearAllForm = () => {
    setFormData({
      gender: '',
      age: '',
      height: '',
      weight: '',
      targetWeight: '',
      exerciseFrequency: ''
    });
    setReport(null);
    setTip('表单已全部清空，请重新填写完整测评信息');
  };

  // 统一刷新会员状态公共函数
  const refreshVipStatus = async () => {
    try {
      const res = await fetch('/api/result');
      const data = await res.json();
      if (data.isPremium) {
        setVipStatusText('尊贵会员（30天有效期）');
      } else {
        setVipStatusText('非会员');
      }
    } catch (err) {
      setVipStatusText('状态刷新失败');
    }
  };

  // 提交测评分层校验，仅提交时校验，输入无限制
  const submitAssess = async () => {
    setReport(null);
    const { gender, age, height, weight, targetWeight, exerciseFrequency } = formData;

    // 第一层：空白校验，统一转为字符串再trim，彻底修复报错
    const ageStr = String(age);
    const heightStr = String(height);
    const weightStr = String(weight);
    const targetStr = String(targetWeight);

    if (!gender || !exerciseFrequency
      || ageStr.trim() === ''
      || heightStr.trim() === ''
      || weightStr.trim() === ''
      || targetStr.trim() === '') {
      setTip('输入完整信息后才可生成检测报告');
      return;
    }

    // 转为数字，无法转数字则为NaN（文字、火星文、符号等）
    const ageNum = Number(ageStr);
    const heightNum = Number(heightStr);
    const weightNum = Number(weightStr);
    const targetNum = Number(targetStr);

    // 校验年龄：必须是1~99999 整数
    const ageValid = !isNaN(ageNum) && Number.isInteger(ageNum) && ageNum >= 1 && ageNum <= 99999;
    // 身高/体重：0 < 数值 <=99999，支持小数
    const floatValid = (n: number) => !isNaN(n) && n > 0 && n <= 99999;
    const heightValid = floatValid(heightNum);
    const weightValid = floatValid(weightNum);
    const targetValid = floatValid(targetNum);
    const weightEqual = weightNum === targetNum;

    // 任意一项非法 或 体重相等
    if (!ageValid || !heightValid || !weightValid || !targetValid || weightEqual) {
      setTip('请输入有效信息');
      return;
    }

    setTip('正在提交测评数据...');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          stepData: {
            gender,
            age: ageNum,
            height: heightNum,
            weight: weightNum,
            targetWeight: targetNum,
            exerciseFrequency
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTip(data.message);
      refreshVipStatus();
    } catch (err: any) {
      setTip(`提交失败：${err.message}`);
    }
  };

  // 查看测评报告
  const getReport = async () => {
    setTip('正在加载测评报告...');
    try {
      const res = await fetch('/api/result');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data);
      setTip('');
      refreshVipStatus();
    } catch (err: any) {
      setReport(null);
      setTip(`读取报告失败：${err.message}`);
    }
  };

  // 开通会员
  const openVip = async () => {
    setReport(null);
    setTip('正在开通会员...');
    try {
      const res = await fetch('/api/pay', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTip(data.message);
      refreshVipStatus();
    } catch (err: any) {
      setTip(`开通会员失败：${err.message}`);
    }
  };

  // 重置免费用户
  const resetFreeUser = async () => {
    setReport(null);
    setTip('正在重置为免费用户...');
    try {
      const res = await fetch('/api/reset-free', { method: 'POST' });
      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(`接口返回非JSON内容：${rawText.slice(0,100)}`);
      }
      if (!res.ok) throw new Error(data.error);
      setTip(data.message);
      refreshVipStatus();
    } catch (err: any) {
      setTip(`重置失败：${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-black">女性健康体重测评系统</h1>
          {/* 会员状态文字前添加4个空格 */}
          <span className={`px-3 py-1 rounded text-sm font-medium ${vipStatusText.includes('尊贵会员') ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
            &nbsp;&nbsp;&nbsp;&nbsp;会员状态：{vipStatusText}
          </span>
        </div>

        {/* 表单区域，输入无实时过滤限制，可随意输入 */}
        <div className="space-y-4 mb-6 border-b pb-6">
          <div>
            <label className="block mb-1 text-zinc-700">性别</label>
            <select
              className="w-full border p-2 rounded"
              value={formData.gender}
              onChange={(e) => handleInputChange('gender', e.target.value)}
            >
              <option value="">--请选择性别--</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 text-zinc-700">年龄</label>
            <input
              type="text"
              className="w-full border p-2 rounded"
              value={formData.age}
              onChange={(e) => handleInputChange('age', e.target.value)}
              placeholder="仅支持1~99999整数，提交时校验"
            />
          </div>

          <div>
            <label className="block mb-1 text-zinc-700">身高(cm)</label>
            <input
              type="text"
              className="w-full border p-2 rounded"
              value={formData.height}
              onChange={(e) => handleInputChange('height', e.target.value)}
              placeholder="支持1~99999整数/小数，提交时校验"
            />
          </div>

          <div>
            <label className="block mb-1 text-zinc-700">当前体重(kg)</label>
            <input
              type="text"
              className="w-full border p-2 rounded"
              value={formData.weight}
              onChange={(e) => handleInputChange('weight', e.target.value)}
              placeholder="支持1~99999整数/小数，提交时校验"
            />
          </div>

          <div>
            <label className="block mb-1 text-zinc-700">目标体重(kg)</label>
            <input
              type="text"
              className="w-full border p-2 rounded"
              value={formData.targetWeight}
              onChange={(e) => handleInputChange('targetWeight', e.target.value)}
              placeholder="支持1~99999整数/小数，提交时校验"
            />
          </div>

          <div>
            <label className="block mb-1 text-zinc-700">运动频率</label>
            <select
              className="w-full border p-2 rounded"
              value={formData.exerciseFrequency}
              onChange={(e) => handleInputChange('exerciseFrequency', e.target.value)}
            >
              <option value="">--请选择运动频率--</option>
              <option value="low">low 低强度</option>
              <option value="medium">medium 中等强度</option>
              <option value="high">high 高强度</option>
            </select>
          </div>
        </div>

        {/* 统一四列网格容器，所有按钮完全对齐 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {/* 提交按钮跨4列占满整行 */}
          <button
            onClick={submitAssess}
            className="col-span-4 w-full bg-pink-500 text-white py-2 rounded hover:bg-pink-600"
          >
            提交测评计算报告
          </button>
          <button
            onClick={getReport}
            className="border border-pink-500 text-pink-500 py-2 rounded hover:bg-pink-50"
          >
            查看我的测评报告
          </button>
          <button
            onClick={openVip}
            className="bg-amber-500 text-white py-2 rounded hover:bg-amber-600"
          >
            模拟开通会员
          </button>
          <button
            onClick={resetFreeUser}
            className="bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
          >
            重置为免费用户
          </button>
          {/* 清空全部数据放在按钮组最末尾 */}
          <button
            onClick={clearAllForm}
            className="w-full bg-slate-300 text-slate-800 py-2 rounded hover:bg-slate-400"
          >
            清空全部填写数据
          </button>
        </div>

        {/* 提示文字 */}
        {tip && <p className="text-center mb-4 text-red-600 font-medium">{tip}</p>}

        {/* 测评报告展示 */}
        {report && (
          <div className="border-t pt-4">
            <h3 className="font-bold mb-2 text-lg">
              {report.isPremium ? '✅ 会员完整报告' : '🔒 免费用户（部分数据隐藏）'}
            </h3>
            <div className="space-y-2 text-zinc-700">
              <p>BMI指数：{report.result.bmi}</p>
              <p>每日推荐热量：{report.result.resultCalories}</p>
              <p>目标达标日期：{report.result.targetDate}</p>
              {!report.isPremium && (
                <p className="text-sm text-zinc-500 mt-2">{report.upgradeMessage}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
