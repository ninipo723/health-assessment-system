import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '../app/api/assessment/route';

// 全局mock prisma模块
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    assessmentRecord: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

describe('分步存储/进度恢复接口集成测试', () => {
  const testEmail = 'test@example.com';
  const mockUserId = 'user_001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET 无历史记录，返回空进度', async () => {
    // mock 用户存在，无测评记录
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: mockUserId, email: testEmail });
    (prisma.assessmentRecord.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stepData).toEqual({});
    expect(data.isCompleted).toBe(false);
  });

  it('GET 存在历史填写记录，正常读取回填进度', async () => {
    const mockStep = { gender: 'female', age: '22' };
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: mockUserId, email: testEmail });
    (prisma.assessmentRecord.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: mockUserId,
      stepData: JSON.stringify(mockStep),
      isCompleted: false,
      id: 'rec_001',
      createdAt: new Date(),
    });

    const res = await GET();
    const data = await res.json();

    expect(data.stepData).toEqual(mockStep);
    expect(data.isCompleted).toBe(false);
  });

  it('POST 第一次分步保存，创建新记录', async () => {
    const partialData = { gender: 'female', age: '22' };
    const req = new Request('http://localhost/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepData: partialData }),
    });

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: mockUserId, email: testEmail });
    (prisma.assessmentRecord.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: mockUserId,
      stepData: JSON.stringify(partialData),
      isCompleted: false,
      id: 'rec_001',
      createdAt: new Date(),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe('分步进度保存成功');
    expect(data.stepData).toEqual(partialData);
    expect(prisma.assessmentRecord.upsert).toHaveBeenCalledTimes(1);
  });

  it('POST 重复多次分步提交，自动覆盖旧数据（乱序提交兼容）', async () => {
    const firstData = { gender: 'female', age: '22' };
    const updateData = { gender: 'female', age: '23', height: '162' };

    // 第一次提交
    let req1 = new Request('http://localhost/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepData: firstData }),
    });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: mockUserId, email: testEmail });
    (prisma.assessmentRecord.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: mockUserId,
      stepData: JSON.stringify(firstData),
      isCompleted: false,
      id: 'rec_001',
      createdAt: new Date(),
    });
    await POST(req1);

    // 第二次更新提交
    let req2 = new Request('http://localhost/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepData: updateData }),
    });
    (prisma.assessmentRecord.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: mockUserId,
      stepData: JSON.stringify(updateData),
      isCompleted: false,
      id: 'rec_001',
      createdAt: new Date(),
    });
    const res2 = await POST(req2);
    const data2 = await res2.json();

    expect(data2.stepData).toEqual(updateData);
    expect(prisma.assessmentRecord.upsert).toHaveBeenCalledTimes(2);
  });
});
