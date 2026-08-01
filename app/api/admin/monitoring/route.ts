import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// ============ Vercel 免费版限额配置 ============
const FREE_TIER_LIMITS = {
  functionInvocations: 1_000_000,      // 函数调用 100万次
  cpuTimeMs: 4 * 3600 * 1000,          // CPU 时间 4小时 = 14,400,000ms
  memoryGbHours: 360,                   // 内存 360 GB-小时
  dataTransferBytes: 100 * 1024 * 1024 * 1024, // 数据传输 100GB
  edgeRequests: 1_000_000,              // 边缘请求 100万次
};

// ============ GET /api/admin/monitoring - 获取监控数据 ============
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    // ---- 日期计算 ----
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 当前计费周期（自然月）
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // 查询 N 天内的每日数据
    const nDaysAgo = new Date(todayStart);
    nDaysAgo.setDate(nDaysAgo.getDate() - (days - 1));

    // ---- 并行查询 ----
    const [dailyStats, monthAgg, routeStats, lastDaily, routeRowCount] = await Promise.all([
      // 每日统计（N天）
      prisma.monitoringDaily.findMany({
        where: { date: { gte: nDaysAgo } },
        orderBy: { date: 'asc' },
      }),

      // 当月聚合
      prisma.monitoringDaily.aggregate({
        where: {
          date: {
            gte: monthStart,
            lt: monthEnd,
          },
        },
        _sum: {
          functionInvocations: true,
          edgeRequests: true,
          cpuTimeMs: true,
          dataTransferBytes: true,
        },
        _count: true,
      }),

      // 路由级别统计（按当月总请求数聚合 Top 20）
      prisma.monitoringRoute.groupBy({
        by: ['path', 'method'],
        where: {
          date: {
            gte: monthStart,
            lt: monthEnd,
          },
        },
        _sum: {
          requestCount: true,
          totalCpuMs: true,
          totalDataBytes: true,
        },
        orderBy: {
          _sum: {
            requestCount: 'desc',
          },
        },
        take: 20,
      }),

      prisma.monitoringDaily.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),

      prisma.monitoringRoute.count({
        where: {
          date: {
            gte: monthStart,
            lt: monthEnd,
          },
        },
      }),
    ]);

    // ---- 计算当月总用量 ----
    const monthUsage = {
      functionInvocations: Number(monthAgg._sum.functionInvocations || 0),
      edgeRequests: Number(monthAgg._sum.edgeRequests || 0),
      cpuTimeMs: Number(monthAgg._sum.cpuTimeMs || 0),
      dataTransferBytes: Number(monthAgg._sum.dataTransferBytes || 0),
    };

    // 估算内存使用（GB-hours）
    // 公式：函数调用次数 × 平均内存(0.25GB) × 平均执行时间(小时)
    // cpuTimeMs 是总 CPU 时间，内存 = cpuTimeMs / 3600000 × 0.25 GB·h
    const estimatedMemoryGbHours =
      (monthUsage.cpuTimeMs / (3600 * 1000)) * 0.25;

    // ---- 计算使用百分比 ----
    const usagePercentages = {
      functionInvocations:
        (monthUsage.functionInvocations / FREE_TIER_LIMITS.functionInvocations) * 100,
      cpuTime:
        (monthUsage.cpuTimeMs / FREE_TIER_LIMITS.cpuTimeMs) * 100,
      memory: (estimatedMemoryGbHours / FREE_TIER_LIMITS.memoryGbHours) * 100,
      dataTransfer:
        (monthUsage.dataTransferBytes / FREE_TIER_LIMITS.dataTransferBytes) * 100,
      edgeRequests:
        (monthUsage.edgeRequests / FREE_TIER_LIMITS.edgeRequests) * 100,
    };

    // ---- 每日趋势数据（用于图表） ----
    const trendData = dailyStats.map((d) => ({
      date: d.date.toISOString().split('T')[0],
      functionInvocations: d.functionInvocations,
      edgeRequests: d.edgeRequests,
      cpuTimeMs: d.cpuTimeMs,
      dataTransferMB: Number(d.dataTransferBytes) / (1024 * 1024),
    }));

    // 补齐缺失日期
    const fullTrend: typeof trendData = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(nDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = trendData.find((t) => t.date === dateStr);
      if (existing) {
        fullTrend.push(existing);
      } else {
        fullTrend.push({
          date: dateStr,
          functionInvocations: 0,
          edgeRequests: 0,
          cpuTimeMs: 0,
          dataTransferMB: 0,
        });
      }
    }

    // ---- 路由 Top 列表 ----
    const routeList = routeStats.map((r) => ({
      path: r.path,
      method: r.method,
      requestCount: r._sum.requestCount || 0,
      totalCpuMs: r._sum.totalCpuMs || 0,
      avgCpuMs:
        r._sum.requestCount && r._sum.totalCpuMs
          ? Math.round(r._sum.totalCpuMs / r._sum.requestCount)
          : 0,
      totalDataMB: Number(r._sum.totalDataBytes || 0) / (1024 * 1024),
    }));

    // ---- 剩余配额 ----
    const remaining = {
      functionInvocations: Math.max(0, FREE_TIER_LIMITS.functionInvocations - monthUsage.functionInvocations),
      cpuTimeMs: Math.max(0, FREE_TIER_LIMITS.cpuTimeMs - monthUsage.cpuTimeMs),
      memoryGbHours: Math.max(0, FREE_TIER_LIMITS.memoryGbHours - estimatedMemoryGbHours),
      dataTransferBytes: Math.max(0, FREE_TIER_LIMITS.dataTransferBytes - monthUsage.dataTransferBytes),
      edgeRequests: Math.max(0, FREE_TIER_LIMITS.edgeRequests - monthUsage.edgeRequests),
    };

    // ---- 当前计费周期信息 ----
    const billingInfo = {
      cycleStart: monthStart.toISOString().split('T')[0],
      cycleEnd: new Date(monthEnd.getTime() - 86400000).toISOString().split('T')[0],
      daysElapsed: Math.ceil((now.getTime() - monthStart.getTime()) / (86400000)),
      daysTotal: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    };

    // ---- 今日数据 ----
    const todayData = dailyStats.find(
      (d) => d.date.toISOString().split('T')[0] === todayStart.toISOString().split('T')[0]
    );

    return NextResponse.json({
      limits: {
        functionInvocations: FREE_TIER_LIMITS.functionInvocations,
        cpuTimeMs: FREE_TIER_LIMITS.cpuTimeMs,
        memoryGbHours: FREE_TIER_LIMITS.memoryGbHours,
        dataTransferBytes: FREE_TIER_LIMITS.dataTransferBytes,
        edgeRequests: FREE_TIER_LIMITS.edgeRequests,
      },
      usage: {
        ...monthUsage,
        memoryGbHours: parseFloat(estimatedMemoryGbHours.toFixed(4)),
        dataTransferGB: parseFloat((monthUsage.dataTransferBytes / (1024 ** 3)).toFixed(4)),
        cpuTimeHours: parseFloat((monthUsage.cpuTimeMs / (3600000)).toFixed(4)),
      },
      remaining: {
        ...remaining,
        dataTransferGB: parseFloat((remaining.dataTransferBytes / (1024 ** 3)).toFixed(2)),
        cpuTimeHours: parseFloat((remaining.cpuTimeMs / (3600000)).toFixed(2)),
      },
      percentages: {
        functionInvocations: parseFloat(usagePercentages.functionInvocations.toFixed(2)),
        cpuTime: parseFloat(usagePercentages.cpuTime.toFixed(2)),
        memory: parseFloat(usagePercentages.memory.toFixed(2)),
        dataTransfer: parseFloat(usagePercentages.dataTransfer.toFixed(2)),
        edgeRequests: parseFloat(usagePercentages.edgeRequests.toFixed(2)),
      },
      trend: fullTrend,
      routes: routeList,
      billing: billingInfo,
      meta: {
        source: '站内中间件埋点估算',
        accuracy: '用于趋势和热门路由判断，不等同于 Vercel 官方 Usage 账单',
        lastRecordedAt: lastDaily?.updatedAt?.toISOString() || null,
        routeRowCount,
        trackingMode: 'middleware_waitUntil',
      },
      today: todayData
        ? {
            functionInvocations: todayData.functionInvocations,
            edgeRequests: todayData.edgeRequests,
            cpuTimeMs: todayData.cpuTimeMs,
            dataTransferMB: parseFloat((Number(todayData.dataTransferBytes) / (1024 * 1024)).toFixed(2)),
          }
        : { functionInvocations: 0, edgeRequests: 0, cpuTimeMs: 0, dataTransferMB: 0 },
    });
  } catch (error) {
    console.error('[ADMIN MONITORING ERROR]', error);
    return NextResponse.json(
      { error: '获取监控数据失败' },
      { status: 500 }
    );
  }
}
