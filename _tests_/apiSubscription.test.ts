import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { GET } from '../app/api/result/route';
import type { User, Subscription, AssessmentRecord } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    assessmentRecord: { findUnique: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

const testEmail = 'test@example.com';
const mockUserId = 'u1';
const mockResultJson = JSON.stringify({
  bmi: 21.0,
  recommendedCalories: 1800,
  targetDate: '2026-08-12'
});

beforeEach(() => vi.clearAllMocks());

describe('会员鉴权报告接口基础测试', () => {
  it('免费用户：热量、目标日期脱敏隐藏', async () => {
    const subMock = {
      id: 's1',
      userId: mockUserId,
      status: 'free',
      createdAt: new Date()
    } as unknown as Subscription;

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: mockUserId,
      email: testEmail,
      subscription: subMock
    } as unknown as User & { subscription: Subscription | null });

    const recordMock = {
      id: 'rec1',
      userId: mockUserId,
      stepData: '',
      result: mockResultJson,
      isCompleted: true,
      createdAt: new Date()
    } as unknown as AssessmentRecord;
    (prisma.assessmentRecord.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(recordMock);

    const res = await GET();
    const data = await res.json();
    expect(data.isPremium).toBe(false);
    expect(data.result.recommendedCalories).toBe('*** (需开通会员查看)');
    expect(data.result.targetDate).toBe('*** (需开通会员查看)');
  });

  it('会员active：返回完整未脱敏数据', async () => {
    const subMock = {
      id: 's1',
      userId: mockUserId,
      status: 'active',
      createdAt: new Date()
    } as unknown as Subscription;

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: mockUserId,
      email: testEmail,
      subscription: subMock
    } as unknown as User & { subscription: Subscription | null });

    const recordMock = {
      id: 'rec1',
      userId: mockUserId,
      stepData: '',
      result: mockResultJson,
      isCompleted: true,
      createdAt: new Date()
    } as unknown as AssessmentRecord;
    (prisma.assessmentRecord.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(recordMock);

    const res = await GET();
    const data = await res.json();
    expect(data.isPremium).toBe(true);
    expect(data.result.recommendedCalories).toBe(1800);
    expect(data.result.targetDate).toBe('2026-08-12');
  });

  it('测评未完成isCompleted=false，返回404提示', async () => {
    const subMock = {
      id: 's1',
      userId: mockUserId,
      status: 'free',
      createdAt: new Date()
    } as unknown as Subscription;

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: mockUserId,
      email: testEmail,
      subscription: subMock
    } as unknown as User & { subscription: Subscription | null });

    const recordMock = {
      id: 'rec1',
      userId: mockUserId,
      stepData: '',
      result: mockResultJson,
      isCompleted: false,
      createdAt: new Date()
    } as unknown as AssessmentRecord;
    (prisma.assessmentRecord.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(recordMock);

    const res = await GET();
    expect(res.status).toBe(404);
  });
});
